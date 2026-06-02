/**
 * getQuestionVersion 云函数
 *
 * 查询题目的指定版本或最新版本。
 *
 * 入参:
 *   { questionId }        - 查询最新版本（isLatest=true）
 *   { familyId }          - 查询整个版本族的最新版本
 *   { familyId, versionNumber } - 查询特定版本
 *
 * 返回:
 *   { success, question } - 单个题目文档，或 null
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();

exports.main = async function(event) {
  var questionId = event.questionId;
  var familyId = event.familyId;
  var versionNumber = event.versionNumber;

  try {
    var coll = db.collection('exam_questions');
    var query;

    if (familyId && versionNumber) {
      // 查询特定版本
      query = coll.where({
        familyId: familyId,
        versionNumber: versionNumber
      }).limit(1);
    } else if (familyId) {
      // 查询家族最新版本
      query = coll.where({
        familyId: familyId,
        isLatest: true
      }).limit(1);
    } else if (questionId) {
      // 先根据 questionId 找到 familyId，再返回最新版本
      // 两步查询：先查 familyId，再查最新
      var doc = await coll.where({ questionId: questionId }).limit(1).get();
      if (!doc.data || doc.data.length === 0) {
        return { success: false, question: null, error: '题目不存在' };
      }
      var fid = doc.data[0].familyId || doc.data[0].questionId;
      query = coll.where({
        familyId: fid,
        isLatest: true
      }).limit(1);
    } else {
      return { success: false, error: '请提供 questionId 或 familyId' };
    }

    var result = await query.get();
    return {
      success: true,
      question: result.data && result.data.length > 0 ? result.data[0] : null
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
