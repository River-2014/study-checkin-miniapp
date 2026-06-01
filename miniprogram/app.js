var account = require('./utils/account');

App({
  onLaunch: function() {
    var logs = (wx.getStorageSync('logs') || []).slice(0, 9);
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    // 初始化云开发
    try {
      wx.cloud.init({
        env: 'cloud1-d8geyz0ynb367e0bf',
        traceUser: true
      });
    } catch (e) {
      console.warn('云开发初始化失败:', e);
    }

    // 登录态检查 + 自动同步
    this.initLoginAndSync();
  },

  initLoginAndSync: function() {
    if (account.isLoggedIn()) {
      // 已登录，每天首次自动同步
      var today = new Date().toDateString();
      var lastSyncDate = wx.getStorageSync('last_cloud_sync_date');
      if (lastSyncDate !== today) {
        wx.setStorageSync('last_cloud_sync_date', today);
        account.syncData(null, null, Date.now());
      }
    }
  },

  isParentMode: function() {
    var storage = require('./utils/storage');
    return storage.isParentMode();
  }
});
