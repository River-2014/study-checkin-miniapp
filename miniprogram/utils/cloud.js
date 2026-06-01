/**
 * 云同步模块（重写）
 * 基于 account.js 云函数封装的同步接口
 */
var account = require('./account');

function initCloud() {
  // 云开发初始化由 app.js onLaunch 完成
}

function getOpenid() {
  return new Promise(function(resolve) {
    if (account.isLoggedIn()) {
      var user = account.getCurrentUser();
      resolve(user.openid || null);
    } else {
      account.login().then(function(result) {
        resolve((result.userRecord || {})._openid || null);
      }).catch(function() {
        resolve(null);
      });
    }
  });
}

function uploadData(data, childId, version) {
  return account.uploadData(data, childId, version);
}

function fetchFromCloud(childId) {
  return account.downloadData(childId).then(function(result) {
    return result.data || null;
  }).catch(function() {
    return null;
  });
}

function trySync() {
  var user = account.getCurrentUser();
  if (!user) return Promise.resolve(false);
  var storage = require('./storage');
  var data = storage.getAppData();
  return account.uploadData(data, user.currentChildId || 'default', Date.now()).then(function() {
    return true;
  }).catch(function() {
    return false;
  });
}

module.exports = { initCloud: initCloud, getOpenid: getOpenid, uploadData: uploadData, fetchFromCloud: fetchFromCloud, trySync: trySync };
