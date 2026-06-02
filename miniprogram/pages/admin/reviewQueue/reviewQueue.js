var adminGuard = require('../../../utils/adminGuard');

Page({
  data: {
    questions: [],
    loading: false,
    reviewComment: ''
  },

  onLoad: function() {
    adminGuard.checkAdminPermission(this);
    this.loadPending();
  },

  loadPending: function() {
    var that = this;
    that.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'manageQuestions',
      data: { action: 'search', status: 'pending', pageSize: 50 }
    }).then(function(res) {
      that.setData({ questions: (res.result || {}).list || [], loading: false });
    }).catch(function() {
      wx.showToast({ title: '加载失败', icon: 'none' });
      that.setData({ loading: false });
    });
  },

  approve: function(e) {
    var id = e.currentTarget.dataset.id;
    this.updateStatus([id], 'approved', '');
  },

  reject: function(e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '拒绝原因',
      editable: true,
      placeholderText: '请输入拒绝原因',
      success: function(res) {
        if (res.confirm) {
          that.updateStatus([id], 'rejected', res.content || '未说明原因');
        }
      }
    });
  },

  batchApprove: function() {
    var ids = this.data.questions.map(function(q) { return q._id; });
    if (ids.length === 0) return;
    this.updateStatus(ids, 'approved', '');
  },

  updateStatus: function(ids, status, comment) {
    var that = this;
    wx.cloud.callFunction({
      name: 'manageQuestions',
      data: { action: 'batchUpdate', questionIds: ids, updates: { status: status, reviewComment: comment } }
    }).then(function() {
      wx.showToast({ title: '操作成功', icon: 'success' });
      that.loadPending();
    }).catch(function() {
      wx.showToast({ title: '操作失败', icon: 'none' });
    });
  }
});
