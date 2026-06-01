var account = require('../../utils/account');

Page({
  data: {
    loading: false
  },

  onLogin: function() {
    var that = this;
    that.setData({ loading: true });
    account.login().then(function(result) {
      that.setData({ loading: false });
      // 登录成功，跳转首页
      wx.switchTab({ url: '/pages/home/home' });
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
