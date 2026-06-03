Page({
  data: {
    message: '您没有权限访问此页面'
  },

  onLoad: function(options) {
    if (options.msg) {
      this.setData({ message: decodeURIComponent(options.msg) });
    }
  },

  goBack: function() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
