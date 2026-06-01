/** 日历页 */
const storage = require('../../utils/storage');
const { getFirstDayOfMonth, getDaysInMonth, getTodayStr, formatDate } = require('../../utils/date');

Page({
  data: {
    year: 0,
    month: 0,
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    todayStr: '',
    checkinDays: 0,
    totalCheckins: 0
  },

  onLoad() {
    // 仅保存参数，不加载数据（首次切到该 tab 时 onShow 再加载）
    const now = new Date();
    this.data.year = now.getFullYear();
    this.data.month = now.getMonth() + 1;
  },

  onShow() {
    if (!this.data._loaded) {
      this.data._loaded = true;
    }
    this.loadMonth(this.data.year, this.data.month);
  },

  /** 加载指定月份 */
  loadMonth(year, month) {
    const data = storage.getAppData();
    const firstDay = getFirstDayOfMonth(year, month);
    const daysInMonth = getDaysInMonth(year, month);
    const todayStr = getTodayStr();

    // 检查本月有哪些日期有打卡记录
    const checkinDates = new Set();
    Object.keys(data.checkins).forEach(dateStr => {
      if (dateStr.startsWith(`${year}-${String(month).padStart(2, '0')}`)) {
        if (data.checkins[dateStr].length > 0) {
          checkinDates.add(dateStr);
        }
      }
    });

    const calendarDays = [];

    // 填充空白
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push({ isEmpty: true, day: '', dateStr: '' });
    }

    // 填充日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarDays.push({
        isEmpty: false,
        day: d,
        dateStr,
        isToday: dateStr === todayStr,
        hasCheckin: checkinDates.has(dateStr)
      });
    }

    // 本月打卡天数和累计打卡
    const checkinDays = checkinDates.size;
    const totalCheckins = data.user.totalCheckins;

    this.setData({
      year,
      month,
      calendarDays,
      checkinDays,
      totalCheckins
    });
  },

  /** 上个月 */
  prevMonth() {
    let { year, month } = this.data;
    month--;
    if (month < 1) { month = 12; year--; }
    this.loadMonth(year, month);
  },

  /** 下个月 */
  nextMonth() {
    let { year, month } = this.data;
    month++;
    if (month > 12) { month = 1; year++; }
    this.loadMonth(year, month);
  },

  /** 点击日期 */
  onDateTap(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;

    const data = storage.getAppData();
    const taskIds = data.checkins[date];
    if (!taskIds || taskIds.length === 0) {
      wx.showToast({ title: '这天没有打卡记录', icon: 'none' });
      return;
    }

    // 查找任务名称
    const taskNames = taskIds.map(id => {
      const t = data.tasks.find(t => t.id === id);
      return t ? `${t.icon} ${t.name}` : null;
    }).filter(Boolean);

    wx.showModal({
      title: `${date} 的打卡`,
      content: taskNames.join('\n'),
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
