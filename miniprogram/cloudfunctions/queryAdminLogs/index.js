/**
 * queryAdminLogs 云函数
 *
 * 查询操作日志（仅 superadmin 可调用）。
 * 支持按操作人、时间范围、操作类型筛选，游标分页。
 *
 * 入参: { operatorOpenId?, action?, startDate?, endDate?, pageSize?, cursor? }
 * 返回: { success, logs[], total, hasMore, nextCursor }
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;

exports.main = async function(event, context) {
  var openid = cloud.getWXContext().OPENID;

  // 内部鉴权：仅 superadmin 可查日志
  try {
    var adminDoc = await db.collection('admins').doc(openid).get();
    if (!adminDoc.data || adminDoc.data.role !== 'superadmin') {
      return { success: false, error: '权限不足：仅超级管理员可查询操作日志' };
    }
  } catch (e) {
    return { success: false, error: '权限不足：非管理员' };
  }

  var pageSize = Math.min(event.pageSize || 20, 50);
  var cursor = event.cursor;

  try {
    var where = {};
    if (event.operatorOpenId) where.operatorOpenId = event.operatorOpenId;
    if (event.action) where.action = event.action;

    // 时间范围
    if (event.startDate || event.endDate) {
      where.timestamp = {};
      if (event.startDate) where.timestamp = _.gte(new Date(event.startDate));
      if (event.endDate) {
        var endDate = _.lte(new Date(event.endDate));
        where.timestamp = event.startDate ? _.and(_.gte(new Date(event.startDate)), endDate) : endDate;
      }
    }

    var query = db.collection('admin_logs')
      .where(where)
      .orderBy('timestamp', 'desc')
      .limit(pageSize + 1);

    if (cursor) {
      query = query.where(Object.assign({}, where, { _id: _.lt(cursor) }));
    }

    var res = await query.get();
    var hasMore = res.data.length > pageSize;
    var logs = hasMore ? res.data.slice(0, pageSize) : res.data;

    return {
      success: true,
      logs: logs,
      hasMore: hasMore,
      nextCursor: hasMore ? logs[logs.length - 1]._id : null
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
