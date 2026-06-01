/** 错题本页面 */
const storage = require('../../utils/storage');

const SUBJECTS = ['全部', '语文', '数学', '英语', '综合', '运动', '生活'];
const SUBJECT_CLASS_MAP = { '语文': 'chinese', '数学': 'math', '英语': 'english', '综合': 'general', '运动': 'sport', '生活': 'life' };

Page({
  data: {
    subjects: SUBJECTS,
    currentSubject: '全部',
    list: [],
    taskNames: {},
    subjectClassMap: SUBJECT_CLASS_MAP,
    showReview: false,
    reviewList: [],
    reviewIndex: 0
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const data = storage.getAppData();
    const taskNames = {};
    data.tasks.forEach(t => { taskNames[t.id] = t.icon + ' ' + t.name; });
    this.setData({ taskNames });
    this.filterList();
  },

  filterList(subject) {
    const s = subject || this.data.currentSubject;
    const list = storage.getMistakes(s === '全部' ? null : s);
    this.setData({ list: list.slice().reverse(), currentSubject: s });
  },

  onFilter(e) {
    this.filterList(e.currentTarget.dataset.subject);
  },

  onPreview(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find(m => m.id === id);
    if (item && item.imageBase64) {
      wx.previewImage({ urls: ['data:image/jpeg;base64,' + item.imageBase64] });
    } else {
      wx.showToast({ title: '没有图片', icon: 'none' });
    }
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.idDel;
    wx.showModal({
      title: '删除错题',
      content: '确定要删除这条错题记录吗？',
      success: (res) => {
        if (res.confirm) {
          storage.deleteMistake(id);
          this.filterList();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  // ===== 复习模式 =====
  onReview() {
    const list = storage.getReviewMistakes();
    if (list.length === 0) {
      wx.showToast({ title: '没有待复习的错题', icon: 'none' });
      return;
    }
    const data = storage.getAppData();
    const taskNames = {};
    data.tasks.forEach(t => { taskNames[t.id] = t.icon + ' ' + t.name; });
    this.setData({
      showReview: true,
      reviewList: list,
      reviewIndex: 0,
      taskNames
    });
  },

  closeReview() {
    this.setData({ showReview: false });
  },

  stopPropagation() {},

  onSwiperChange(e) {
    this.setData({ reviewIndex: e.detail.current });
  },

  onReviewDone() {
    const item = this.data.reviewList[this.data.reviewIndex];
    if (item) {
      storage.markMistakeReviewed(item.id);
      storage.addPointsLog('earn', 2, '复习错题奖励（' + item.subject + '）');
      const data = storage.getAppData();
      data.user.stars += 2;
      data.user.totalStarsEarned += 2;
      storage.saveAppData(data);
      wx.showToast({ title: '复习完成 +2⭐', icon: 'success' });
      // 从复习列表移除
      const remaining = this.data.reviewList.filter(m => m.id !== item.id);
      if (remaining.length === 0) {
        this.closeReview();
        this.filterList();
      } else {
        this.setData({ reviewList: remaining, reviewIndex: 0 });
      }
    }
  }
});
