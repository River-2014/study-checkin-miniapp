/**
 * writeAdminLog 云函数
 *
 * 记录管理员敏感操作日志，写入 admin_logs 集合。
 *
 * 入参: { action, targetType, targetIds, details }
 * 返回: { success, logId }
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();

exports.main = async function(event, context) {
  var openid = cloud.getWXContext().OPENID;
  var action = event.action || '';
  var targetType = event.targetType || '';
  var targetIds = event.targetIds || [];
  var details = event.details || {};

  if (!action || !targetType) {
    return { success: false, error: 'action 和 targetType 为必填项' };
  }

  try {
    var result = await db.collection('admin_logs').add({
      data: {
        operatorOpenId: openid,
        action: action,
        targetType: targetType,
        targetIds: Array.isArray(targetIds) ? targetIds : [targetIds],
        details: details,
        timestamp: db.serverDate()
      }
    });

    return { success: true, logId: result._id };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
