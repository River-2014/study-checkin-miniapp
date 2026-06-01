const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 提交练习记录，更新题目统计
 * 入参：{ mode, paperId, subject, grade, answers, correctCount, totalCount, duration }
 * answers: [{ questionId, userAnswer, isCorrect }]
 */
exports.main = async function(event) {
  var mode = event.mode || 'practice';
  var paperId = event.paperId || null;
  var subject = event.subject || '';
  var grade = event.grade || '';
  var answers = event.answers || [];
  var correctCount = event.correctCount || 0;
  var totalCount = event.totalCount || 0;
  var duration = event.duration || 0;

  if (answers.length === 0) {
    return { success: false, error: 'answers 不能为空' };
  }

  try {
    var wxContext = cloud.getWXContext();
    var openid = wxContext.OPENID;

    // 写入练习记录
    var record = {
      _openid: openid,
      mode: mode,
      paperId: paperId,
      subject: subject,
      grade: grade,
      answers: answers,
      correctCount: correctCount,
      totalCount: totalCount,
      score: totalCount > 0 ? Math.round(correctCount / totalCount * 100) : 0,
      duration: duration,
      createdAt: db.serverDate()
    };

    var addResult = await db.collection('exam_practice_records').add({ data: record });

    // 批量更新题目使用统计
    for (var i = 0; i < answers.length; i++) {
      var ans = answers[i];
      try {
        await db.collection('exam_questions').doc(ans.questionId).update({
          data: {
            usageCount: db.command.inc(1),
            correctCount: ans.isCorrect ? db.command.inc(1) : db.command.inc(0)
          }
        });
      } catch (e) {
        // 单条更新失败不影响整体
      }
    }

    return {
      success: true,
      recordId: addResult._id
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
