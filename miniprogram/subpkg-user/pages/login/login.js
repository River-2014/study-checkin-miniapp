var account = require('../../utils/account');
var storage = require('../../utils/storage');

Page({
  data: {
    loading: false
  },

  onLogin: function() {
    var that = this;
    that.setData({ loading: true });
    account.login().then(function(result) {
      that.setData({ loading: false });
      // 首次登录 → 选择身份；已选过 → 直接回首页
      var appData = storage.getAppData();
      if (!appData.userMode) {
        wx.redirectTo({ url: '/subpkg-user/pages/role/role' });
      } else {
        wx.switchTab({ url: '/pages/home/home' });
      }
    }).catch(function(err) {
      that.setData({ loading: false });
      wx.showModal({
        title: '登录失败',
        content: (err && err.message) || '请稍后重试',
        showCancel: false
      });
    });
  }
});
