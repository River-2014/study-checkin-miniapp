const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 生成模拟试卷
 * 入参：{ name, subject, grade, typeDistribution, difficulty, duration }
 * typeDistribution 示例：{ "选择题": 10, "填空题": 5, "判断题": 5 }
 */
exports.main = async function(event) {
  var name = event.name || '';
  var subject = event.subject;
  var grade = event.grade;
  var typeDistribution = event.typeDistribution || {};
  var difficulty = event.difficulty || '';
  var duration = event.duration || 60;

  if (!subject || !grade) {
    return { success: false, error: 'subject 和 grade 为必填项' };
  }

  var typeNames = Object.keys(typeDistribution);
  if (typeNames.length === 0) {
    return { success: false, error: 'typeDistribution 不能为空' };
  }

  try {
    var allQuestionIds = [];
    var totalScore = 0;
    var scoreMap = { '选择题': 3, '填空题': 4, '判断题': 2, '简答题': 8 };

    // 逐个题型抽取题目
    for (var i = 0; i < typeNames.length; i++) {
      var typeName = typeNames[i];
      var needed = typeDistribution[typeName];
      if (needed <= 0) continue;

      var where = { subject: subject, grade: grade, type: typeName };
      if (difficulty) where.difficulty = difficulty;

      var result = await db.collection('exam_questions')
        .aggregate()
        .match(where)
        .sample({ size: needed })
        .end();

      for (var j = 0; j < result.list.length; j++) {
        allQuestionIds.push(result.list[j]._id);
      }
      totalScore += Math.min(result.list.length, needed) * (scoreMap[typeName] || 3);
    }

    if (allQuestionIds.length === 0) {
      return { success: false, error: '未找到匹配的题目，请调整筛选条件或补充题库' };
    }

    // 写入试卷记录
    var paperDoc = {
      name: name || (grade + subject + '模拟卷'),
      subject: subject,
      grade: grade,
      questionIds: allQuestionIds,
      typeDistribution: typeDistribution,
      totalScore: totalScore,
      duration: duration,
      createdAt: db.serverDate()
    };

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
        questionCount: allQuestionIds.length
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
