const storage = require('../../utils/storage');

Page({
  data: {
    gradeLabels: storage.GRADE_LIST,
    gradeIndex: 5  // 默认六年级
  },

  onGradeChange: function(e) {
    this.setData({ gradeIndex: Number(e.detail.value) });
  },

  selectRole(e) {
    var role = e.currentTarget.dataset.role;
    var grade = this.data.gradeIndex + 1; // 1-indexed
    var appData = storage.getAppData();
    appData.userMode = role;
    storage.setUserGrade(appData, grade);
    storage.saveAppData(appData);
    wx.switchTab({ url: '/pages/home/home' });
  }
});
