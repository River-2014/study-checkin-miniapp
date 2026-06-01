/**
 * userLogin 云函数
 * 微信登录，自动注册或返回已有用户记录
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const usersCollection = db.collection('users');

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    return { success: false, error: { code: 'AUTH_FAIL', message: '获取用户身份失败' } };
  }

  try {
    // 查找已有用户
    const result = await usersCollection.where({ _openid: OPENID }).get();
    if (result.data && result.data.length > 0) {
      const user = result.data[0];
      // 更新最后登录时间
      await usersCollection.doc(user._id).update({
        data: { lastLoginAt: db.serverDate() }
      });
      return {
        success: true,
        isNewUser: false,
        userRecord: user
      };
    }

    // 新用户自动注册
    const newUser = {
      _openid: OPENID,
      role: 'parent',
      nickname: '',
      avatar: '',
      children: [],
      parentOpenid: null,
      createdAt: db.serverDate(),
      lastLoginAt: db.serverDate(),
      settings: {}
    };
    const addResult = await usersCollection.add({ data: newUser });
    return {
      success: true,
      isNewUser: true,
      userRecord: Object.assign({}, newUser, { _id: addResult._id })
    };
  } catch (e) {
    return { success: false, error: { code: 'DB_ERR', message: e.message } };
  }
};
