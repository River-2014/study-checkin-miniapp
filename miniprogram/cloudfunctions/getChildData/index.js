/**
 * getChildData 云函数
 * 家长查询指定孩子的学习数据（权限校验后返回摘要）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const usersCollection = db.collection('users');
const userDataCollection = db.collection('user_data');

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: { code: 'AUTH_FAIL', message: '获取用户身份失败' } };

  try {
    // 校验当前用户为家长且包含该孩子
    var userResult = await usersCollection.where({ _openid: OPENID }).get();
    if (!userResult.data || userResult.data.length === 0) {
      return { success: false, error: { code: 'USER_NOT_FOUND', message: '用户不存在' } };
    }
    var user = userResult.data[0];

    var childIds = event.childIds;
    if (!childIds || childIds.length === 0) {
      // 返回所有孩子列表（含简要信息）
      return { success: true, data: { children: user.children || [] } };
    }

    // 批量查询多个孩子的数据摘要
    var results = [];
    for (var i = 0; i < childIds.length; i++) {
      var childId = childIds[i];
      // 校验权限：该孩子是否在家长的 children 列表中
      var isAuthorized = false;
      var childName = childId;
      var children = user.children || [];
      for (var ci = 0; ci < children.length; ci++) {
        if (children[ci].childOpenid === childId) {
          isAuthorized = true;
          childName = children[ci].childName || '孩子';
          break;
        }
      }
      if (!isAuthorized) continue;

      // 读取孩子数据摘要（不含详细错题列表）
      var dataResult = await userDataCollection.where({
        recordId: childId + '_default'
      }).get();

      var summary = {
        childId: childId,
        childName: childName,
        data: null
      };

      if (dataResult.data && dataResult.data.length > 0) {
        var fullData = dataResult.data[0].data;
        // 只返回摘要字段
        summary.data = {
          stars: (fullData.user || {}).stars || 0,
          streak: (fullData.user || {}).streak || 0,
          tasks: fullData.tasks || [],
          checkinSummary: fullData.checkins ? Object.keys(fullData.checkins).length : 0,
          recentCheckins: fullData.checkins || {},
          aiRecordCount: (fullData.aiRecords || []).length,
          wrongBookCount: (fullData.wrongBook || []).length
        };
      }
      results.push(summary);
    }

    return { success: true, data: { children: results } };
  } catch (e) {
    return { success: false, error: { code: 'DB_ERR', message: e.message } };
  }
};
