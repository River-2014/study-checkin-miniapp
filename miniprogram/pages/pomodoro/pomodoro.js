var storage = require('../../utils/storage');

Page({
  data: {
    workMinutes: 25,
    breakMinutes: 5,
    minutes: 25,
    seconds: 0,
    running: false,
    isBreak: false,
    completed: 0,     // 今日完成番茄数
    totalCompleted: 0, // 累计番茄数
    totalMinutes: 0    // 累计专注分钟
  },

  onLoad: function() {
    var data = storage.getAppData();
    this.setData({
      totalCompleted: data.user.pomodoroCount || 0,
      totalMinutes: data.user.pomodoroMinutes || 0
    });
    if (!data.user.pomodoroToday) data.user.pomodoroToday = 0;
    this.setData({ completed: data.user.pomodoroToday });
  },

  onUnload: function() { this.stop(); },

  start: function() {
    if (this.data.running) return;
    this.setData({ running: true, minutes: this.data.workMinutes, seconds: 0 });
    this._timer = setInterval(this.tick.bind(this), 1000);
  },

  stop: function() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.setData({ running: false });
  },

  pause: function() {
    this.setData({ running: !this.data.running });
    if (!this.data.running) { clearInterval(this._timer); this._timer = null; }
    else { this._timer = setInterval(this.tick.bind(this), 1000); }
  },

  tick: function() {
    if (!this.data.running) return;
    var m = this.data.minutes, s = this.data.seconds;
    if (s > 0) { s--; }
    else if (m > 0) { m--; s = 59; }
    else {
      this.finish();
      return;
    }
    this.setData({ minutes: m, seconds: s });
  },

  finish: function() {
    this.stop();
    var that = this;
    if (!this.data.isBreak) {
      // 工作完成 → 庆祝 + 记录
      var data = storage.getAppData();
      data.user.pomodoroCount = (data.user.pomodoroCount || 0) + 1;
      data.user.pomodoroMinutes = (data.user.pomodoroMinutes || 0) + this.data.workMinutes;
      data.user.pomodoroToday = (data.user.pomodoroToday || 0) + 1;
      storage.saveAppData(data);

      wx.vibrateShort();
      wx.showModal({
        title: '🎉 番茄完成！',
        content: '完成 ' + this.data.workMinutes + ' 分钟专注\n\n休息 ' + this.data.breakMinutes + ' 分钟吧',
        confirmText: '开始休息',
        cancelText: '跳过',
        success: function(res) {
          that.setData({ completed: data.user.pomodoroToday, totalCompleted: data.user.pomodoroCount, totalMinutes: data.user.pomodoroMinutes });
          if (res.confirm) that.startBreak();
        }
      });
    } else {
      // 休息完成
      wx.showModal({
        title: '休息结束',
        content: '准备好开始下一个番茄了吗？',
        confirmText: '开始工作',
        success: function(res) {
          that.setData({ isBreak: false });
          if (res.confirm) that.start();
        }
      });
    }
  },

  startBreak: function() {
    this.setData({ isBreak: true, minutes: this.data.breakMinutes, seconds: 0, running: true });
    this._timer = setInterval(this.tick.bind(this), 1000);
  },

  reset: function() {
    this.stop();
    this.setData({ isBreak: false, minutes: this.data.workMinutes, seconds: 0 });
  },

  onWorkChange: function(e) { this.setData({ workMinutes: Number(e.detail.value) || 25 }); },
  onBreakChange: function(e) { this.setData({ breakMinutes: Number(e.detail.value) || 5 }); }
});
