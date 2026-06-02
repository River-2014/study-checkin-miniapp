var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();

/**
 * 生成模拟试卷（含题目快照）
 *
 * 入参：{
 *   name, subject, grade, typeDistribution, difficulty, duration,
 *   snapshotQuestions: boolean  // 默认 true，对每道题创建快照
 * }
 *
 * typeDistribution 示例：{ "选择题": 10, "填空题": 5, "判断题": 5 }
 *
 * 快照机制：
 *   - 组卷时将题目完整内容（stem/options/answer/type/difficulty/knowledgePoints）
 *     复制到试卷文档中，后续作答不依赖题目表
 *   - 记录 originalQuestionId 和 versionUsed，支持溯源
 */
exports.main = async function(event) {
  var name = event.name || '';
  var subject = event.subject;
  var grade = event.grade;
  var typeDistribution = event.typeDistribution || {};
  var difficulty = event.difficulty || '';
  var duration = event.duration || 60;
  var snapshot = event.snapshotQuestions !== false; // 默认启用快照

  if (!subject || !grade) {
    return { success: false, error: 'subject 和 grade 为必填项' };
  }

  var typeNames = Object.keys(typeDistribution);
  if (typeNames.length === 0) {
    return { success: false, error: 'typeDistribution 不能为空' };
  }

  try {
    var questionDocs = [];      // snapshot 模式：完整题目
    var questionIds = [];       // 非 snapshot 模式：仅 ID
    var totalScore = 0;
    var scoreMap = { '选择题': 3, '填空题': 4, '判断题': 2, '简答题': 8 };

    // 逐个题型抽取题目
    for (var i = 0; i < typeNames.length; i++) {
      var typeName = typeNames[i];
      var needed = typeDistribution[typeName];
      if (needed <= 0) continue;

      var where = { subject: subject, grade: grade, type: typeName };
      if (difficulty) where.difficulty = difficulty;
      // 只抽取最新版本(含已审核)
      where.isLatest = true;

      var result = await db.collection('exam_questions')
        .aggregate()
        .match(where)
        .sample({ size: needed })
        .end();

      for (var j = 0; j < result.list.length; j++) {
        var q = result.list[j];

        if (snapshot) {
          // 快照模式：复制题目全部内容到试卷
          questionDocs.push({
            snapshotQuestion: {
              stem: q.stem || '',
              options: q.options || [],
              answer: q.answer || '',
              type: q.type || typeName,
              difficulty: q.difficulty || '基础巩固',
              knowledgePoints: q.knowledgePoints || []
            },
            originalQuestionId: q.questionId || '',
            familyId: q.familyId || q.questionId || '',
            versionUsed: q.versionNumber || 1,
            score: scoreMap[typeName] || 3
          });
        } else {
          questionIds.push(q._id);
        }

        totalScore += Math.min(result.list.indexOf(q) + 1, needed) > 0 ? (scoreMap[typeName] || 3) : 0;
      }
      // 重新计算实际分数
      totalScore -= Math.max(0, (result.list.length - needed)) * (scoreMap[typeName] || 3);
    }

    var questionCount = snapshot ? questionDocs.length : questionIds.length;
    if (questionCount === 0) {
      return { success: false, error: '未找到匹配的题目，请调整筛选条件或补充题库' };
    }

    // 写入试卷记录
    var paperDoc = {
      name: name || (grade + subject + '模拟卷'),
      subject: subject,
      grade: grade,
      typeDistribution: typeDistribution,
      totalScore: totalScore,
      duration: duration,
      questionCount: questionCount,
      snapshotEnabled: snapshot,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    };

    if (snapshot) {
      paperDoc.questions = questionDocs;
    } else {
      paperDoc.questionIds = questionIds;
    }

    var addResult = await db.collection('exam_papers').add({ data: paperDoc });

    return {
      success: true,
      paper: {
        paperId: addResult._id,
        name: paperDoc.name,
        subject: subject,
        grade: grade,
        totalScore: totalScore,
        duration: duration,
        questionCount: questionCount,
        snapshotEnabled: snapshot
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
