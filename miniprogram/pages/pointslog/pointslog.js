/** 积分明细页面 */
const storage = require('../../utils/storage');

Page({
  data: {
    list: [],
    filter: 'all'
  },

  onShow() {
    this.loadList('all');
  },

  loadList(filter) {
    const all = storage.getPointsLog();
    const list = filter === 'all' ? all : all.filter(l => l.type === filter);
    this.setData({ list, filter });
  },

  onFilter(e) {
    this.loadList(e.currentTarget.dataset.filter);
  },

  /** 格式化时间为本地字符串 */
  formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month}月${day}日 ${hour}:${min}`;
  }
});
