const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 本地题库随机抽题
 * 入参：{ subject, grade, types, knowledgePoints, difficulty, excludeIds, count }
 */
exports.main = async function(event) {
  var subject = event.subject;
  var grade = event.grade;
  var types = event.types || [];
  var knowledgePoints = event.knowledgePoints || [];
  var difficulty = event.difficulty || '';
  var excludeIds = event.excludeIds || [];
  var count = event.count || 10;

  if (!subject || !grade) {
    return { success: false, error: 'subject 和 grade 为必填项' };
  }

  var where = { subject: subject, grade: grade };
  if (types.length > 0) where.type = db.command.in(types);
  if (knowledgePoints.length > 0) where.knowledgePoints = db.command.in(knowledgePoints);
  if (difficulty) where.difficulty = difficulty;
  if (excludeIds.length > 0) where._id = db.command.nin(excludeIds);

  try {
    var result = await db.collection('exam_questions')
      .aggregate()
      .match(where)
      .sample({ size: count })
      .end();

    return {
      success: true,
      questions: result.list,
      totalAvailable: result.list.length,
      requested: count,
      insufficient: result.list.length < count
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
