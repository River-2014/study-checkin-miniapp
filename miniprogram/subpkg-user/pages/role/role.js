const storage = require('../../utils/storage');

Page({
  selectRole(e) {
    var role = e.currentTarget.dataset.role;
    var appData = storage.getAppData();
    appData.userMode = role;
    storage.saveAppData(appData);
    wx.switchTab({ url: '/pages/home/home' });
  }
});
