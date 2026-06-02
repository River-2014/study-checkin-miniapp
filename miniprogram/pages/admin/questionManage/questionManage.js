var adminGuard = require('../../../utils/adminGuard');

Page({
  data: {
    // 筛选条件
    subject: '', grade: '', type: '', difficulty: '', status: '', keyword: '',
    subjects: ['数学', '语文', '英语'],
    grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
    types: ['选择题', '填空题', '判断题', '计算题', '简答题', '应用题'],
    difficulties: ['基础巩固', '能力提升', '冲刺拔高'],
    statuses: [
      { value: '', label: '全部' },
      { value: 'draft', label: '草稿' },
      { value: 'pending', label: '待审核' },
      { value: 'approved', label: '已审核' },
      { value: 'rejected', label: '已拒绝' },
      { value: 'archived', label: '已归档' }
    ],

    // 列表
    questions: [],
    selectedIds: [],
    total: -1,
    hasMore: false,
    cursor: '',

    // 预览
    previewVisible: false,
    previewQuestion: null,

    // 批量操作
    batchVisible: false,

    // AI 标注状态
    aiTagging: false
  },

  onLoad: function() {
    adminGuard.checkAdminPermission(this);
  },

  onShow: function() {
    this.search(true);
  },

  // 搜索
  search: function(reset) {
    var that = this;
    if (reset) this.setData({ cursor: '', questions: [] });

    wx.cloud.callFunction({
      name: 'manageQuestions',
      data: {
        action: 'search',
        subject: that.data.subject,
        grade: that.data.grade,
        type: that.data.type,
        difficulty: that.data.difficulty,
        status: that.data.status,
        keyword: that.data.keyword,
        cursor: reset ? '' : that.data.cursor,
        pageSize: 20
      }
    }).then(function(res) {
      var r = res.result || {};
      var list = reset ? r.list : that.data.questions.concat(r.list);
      that.setData({
        questions: list,
        total: r.total,
        hasMore: r.hasMore,
        cursor: r.nextCursor || ''
      });
    }).catch(function(e) {
      wx.showToast({ title: '查询失败', icon: 'none' });
    });
  },

  // 选择/取消题目
  toggleSelect: function(e) {
    var id = e.currentTarget.dataset.id;
    var selected = this.data.selectedIds.slice();
    var idx = selected.indexOf(id);
    if (idx >= 0) selected.splice(idx, 1);
    else selected.push(id);
    this.setData({ selectedIds: selected });
  },

  // 预览题目
  preview: function(e) {
    var id = e.currentTarget.dataset.id;
    var q = this.data.questions.find(function(item) { return item._id === id; });
    this.setData({ previewVisible: true, previewQuestion: q });
  },

  closePreview: function() {
    this.setData({ previewVisible: false, previewQuestion: null });
  },

  // 批量操作
  batchUpdate: function(status) {
    var that = this;
    if (that.data.selectedIds.length === 0) {
      wx.showToast({ title: '请先选择题目', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认操作',
      content: '将' + that.data.selectedIds.length + '道题状态改为"' + status + '"?',
      success: function(modalRes) {
        if (!modalRes.confirm) return;
        wx.cloud.callFunction({
          name: 'manageQuestions',
          data: { action: 'batchUpdate', questionIds: that.data.selectedIds, updates: { status: status } }
        }).then(function(res) {
          wx.showToast({ title: '更新完成', icon: 'success' });
          that.setData({ selectedIds: [] });
          that.search(true);
        }).catch(function() {
          wx.showToast({ title: '更新失败', icon: 'none' });
        });
      }
    });
  },

  // AI 智能标注
  startAiTag: function() {
    var that = this;
    that.setData({ aiTagging: true });
    wx.cloud.callFunction({
      name: 'aiAutoTag',
      data: { subject: that.data.subject, grade: that.data.grade, limit: 20 }
    }).then(function(res) {
      var r = res.result || {};
      wx.showModal({
        title: '标注完成',
        content: '成功: ' + (r.tagged || 0) + ' 道\n需人工复核: ' + (r.needManualReview || 0) + ' 道\n失败: ' + (r.failed || 0) + ' 道',
        showCancel: false
      });
      that.setData({ aiTagging: false });
      that.search(true);
    }).catch(function() {
      wx.showToast({ title: 'AI标注失败', icon: 'none' });
      that.setData({ aiTagging: false });
    });
  },

  // 筛选条件变更
  onSubjectChange: function(e) { this.setData({ subject: e.detail.value }); },
  onGradeChange: function(e) { this.setData({ grade: e.detail.value }); },
  onTypeChange: function(e) { this.setData({ type: e.detail.value }); },
  onDifficultyChange: function(e) { this.setData({ difficulty: e.detail.value }); },
  onStatusChange: function(e) { this.setData({ status: e.detail.value }); },
  onKeywordInput: function(e) { this.setData({ keyword: e.detail.value }); },

  resetFilters: function() {
    this.setData({ subject: '', grade: '', type: '', difficulty: '', status: '', keyword: '' });
    this.search(true);
  },

  loadMore: function() {
    if (this.data.hasMore) this.search(false);
  }
});
