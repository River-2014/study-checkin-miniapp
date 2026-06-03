var adminGuard = require('../../utils/adminGuard');

Page({
  data: {
    timeRange: 'last30days',
    loading: true,
    stats: null,
    subjectChart: null,
    difficultyChart: null,
    topMistakes: [],
    kpErrors: {}
  },

  onLoad: function() {
    adminGuard.checkAdminPermission(this);
    this.loadStats();
  },

  loadStats: function() {
    var that = this;
    that.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'getStats',
      data: { timeRange: that.data.timeRange }
    }).then(function(res) {
      var data = (res.result || {}).data || {};
      that.setData({
        stats: data,
        loading: false,
        subjectChart: { items: (data.subjectAccuracy || []).map(function(s) { return { label: s.subject, value: s.accuracy }; }) },
        difficultyChart: { items: (data.difficultyAccuracy || []).map(function(d) { return { label: d.difficulty, value: d.accuracy }; }) },
        topMistakes: data.topMistakes || [],
        kpErrors: data.knowledgePointErrors || {}
      });
    }).catch(function() {
      wx.showToast({ title: '加载失败', icon: 'none' });
      that.setData({ loading: false });
    });
  },

  onTimeRangeChange: function(e) {
    this.setData({ timeRange: e.detail.value });
    this.loadStats();
  }
});
