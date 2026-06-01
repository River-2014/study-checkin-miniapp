/**
 * 账号模块
 * 封装登录、家庭绑定、数据同步等前端操作
 * 所有云函数调用通过 wx.cloud.callFunction 完成
 */

var APP = getApp();

/**
 * 微信登录：获取 openid，自动注册/返回用户
 */
function login() {
  return new Promise(function(resolve, reject) {
    // 云函数通过 cloud.getWXContext() 自动获取 openid，无需传递 wx.login code
    wx.cloud.callFunction({
      name: 'userLogin',
      success: function(cloudRes) {
            var result = cloudRes.result;
            if (result.success) {
              // 缓存登录态
              wx.setStorageSync('loginUser', {
                openid: result.userRecord._openid,
                role: result.userRecord.role,
                nickname: result.userRecord.nickname,
                currentChildId: 'default'
              });
              resolve(result);
            } else {
              reject(result.error || { code: 'UNKNOWN', message: '登录失败' });
            }
          },
          fail: function(err) {
            reject({ code: 'CLOUD_FAIL', message: '云函数调用失败', detail: err });
          }
        });
  });
}

/**
 * 检查是否已登录
 */
function isLoggedIn() {
  try {
    var user = wx.getStorageSync('loginUser');
    return user && user.openid ? true : false;
  } catch (e) {
    return false;
  }
}

/**
 * 获取当前用户信息
 */
function getCurrentUser() {
  try {
    return wx.getStorageSync('loginUser') || null;
  } catch (e) {
    return null;
  }
}

/**
 * 创建家庭邀请码
 */
function createFamilyCode() {
  return new Promise(function(resolve, reject) {
    wx.cloud.callFunction({
      name: 'familyBind',
      data: { action: 'createInvite' },
      success: function(res) {
        if (res.result && res.result.success) {
          resolve(res.result.data);
        } else {
          reject(res.result.error || { code: 'UNKNOWN', message: '生成邀请码失败' });
        }
      },
      fail: function(err) {
        reject({ code: 'CLOUD_FAIL', message: '云函数调用失败', detail: err });
      }
    });
  });
}

/**
 * 加入家庭
 */
function joinFamily(familyCode, childName) {
  return new Promise(function(resolve, reject) {
    wx.cloud.callFunction({
      name: 'familyBind',
      data: { action: 'joinFamily', familyCode: familyCode, childName: childName || '孩子' },
      success: function(res) {
        if (res.result && res.result.success) {
          resolve(res.result.data);
        } else {
          reject(res.result.error || { code: 'UNKNOWN', message: '加入家庭失败' });
        }
      },
      fail: function(err) {
        reject({ code: 'CLOUD_FAIL', message: '云函数调用失败', detail: err });
      }
    });
  });
}

/**
 * 同步数据到云端
 */
function uploadData(data, childId, clientVersion) {
  return new Promise(function(resolve, reject) {
    wx.cloud.callFunction({
      name: 'dataSync',
      data: {
        action: 'upload',
        data: data,
        childId: childId || 'default',
        clientVersion: clientVersion || 0
      },
      success: function(res) {
        if (res.result && res.result.success) {
          resolve(res.result);
        } else if (res.result && res.result.conflict) {
          // 版本冲突，返回云端数据供合并
          resolve(res.result);
        } else {
          reject(res.result.error || { code: 'UNKNOWN', message: '上传失败' });
        }
      },
      fail: function(err) {
        reject({ code: 'CLOUD_FAIL', message: '云函数调用失败', detail: err });
      }
    });
  });
}

/**
 * 从云端下载数据
 */
function downloadData(childId) {
  return new Promise(function(resolve, reject) {
    wx.cloud.callFunction({
      name: 'dataSync',
      data: { action: 'download', childId: childId || 'default' },
      success: function(res) {
        if (res.result && res.result.success) {
          resolve(res.result);
        } else {
          reject(res.result.error || { code: 'UNKNOWN', message: '下载失败' });
        }
      },
      fail: function(err) {
        reject({ code: 'CLOUD_FAIL', message: '云函数调用失败', detail: err });
      }
    });
  });
}

/**
 * 合并同步（自动判断上传/下载）
 */
function syncData(childId, localData, localVersion) {
  return new Promise(function(resolve, reject) {
    wx.cloud.callFunction({
      name: 'dataSync',
      data: {
        action: 'merge',
        childId: childId || 'default',
        localData: localData,
        localVersion: localVersion || 0
      },
      success: function(res) {
        if (res.result && res.result.success) {
          resolve(res.result);
        } else {
          reject(res.result.error || { code: 'UNKNOWN', message: '同步失败' });
        }
      },
      fail: function(err) {
        reject({ code: 'CLOUD_FAIL', message: '云函数调用失败', detail: err });
      }
    });
  });
}

/**
 * 获取孩子列表（家长端）
 */
function getChildren(childIds) {
  return new Promise(function(resolve, reject) {
    wx.cloud.callFunction({
      name: 'getChildData',
      data: { childIds: childIds || [] },
      success: function(res) {
        if (res.result && res.result.success) {
          resolve(res.result.data);
        } else {
          reject(res.result.error || { code: 'UNKNOWN', message: '获取孩子数据失败' });
        }
      },
      fail: function(err) {
        reject({ code: 'CLOUD_FAIL', message: '云函数调用失败', detail: err });
      }
    });
  });
}

/**
 * 切换当前孩子
 */
function switchChild(childId) {
  var user = getCurrentUser();
  if (user) {
    user.currentChildId = childId;
    wx.setStorageSync('loginUser', user);
  }
}

/**
 * 清除登录态
 */
function logout() {
  try {
    wx.removeStorageSync('loginUser');
  } catch (e) {}
}

module.exports = {
  login: login,
  isLoggedIn: isLoggedIn,
  getCurrentUser: getCurrentUser,
  createFamilyCode: createFamilyCode,
  joinFamily: joinFamily,
  uploadData: uploadData,
  downloadData: downloadData,
  syncData: syncData,
  getChildren: getChildren,
  switchChild: switchChild,
  logout: logout
};
