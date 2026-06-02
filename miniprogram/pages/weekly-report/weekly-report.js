var storage = require('../../utils/storage');

Page({
  data: {
    weekRange: '',
    checkinDays: 0, totalTasks: 0, starsEarned: 0,
    dailyChart: { items: [] },
    subjectChart: { items: [] },
    aiCorrectRate: '--', wrongCount: 0,
    highlight: '', streak: 0
  },

  onShow: function() {
    this.generate();
  },

  generate: function() {
    var data = storage.getAppData();
    var checkins = data.checkins || {};
    var today = new Date();

    // 本周一~周日
    var day = today.getDay() || 7;
    var monday = new Date(today);
    monday.setDate(today.getDate() - day + 1);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    this.setData({
      weekRange: this._fmt(monday) + ' ~ ' + this._fmt(sunday)
    });

    var checkinDays = 0, totalTasks = 0, starsEarned = 0;
    var dailyItems = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      var ds = this._fmt(d);
      var tasks = checkins[ds] || [];
      if (tasks.length > 0) checkinDays++;
      totalTasks += tasks.length;
      dailyItems.push({ label: String(d.getMonth()+1) + '/' + d.getDate(), value: Math.min(tasks.length * 20, 100) });
    }

    // 积分统计
    var pointsLog = data.pointsLog || [];
    var weekStart = monday.getTime();
    for (var p = 0; p < pointsLog.length; p++) {
      var pl = pointsLog[p];
      if (pl.type === 'earn' && new Date(pl.time).getTime() >= weekStart) {
        starsEarned += pl.amount || 0;
      }
    }

    // 学科分布
    var cats = data.categoryStats || {};
    var subjItems = [];
    ['语文','数学','英语'].forEach(function(s) {
      subjItems.push({ label: s, value: cats[s] || 0 });
    });

    // AI正确率
    var aiRecs = (data.aiRecords || []).filter(function(r) {
      return r.time && new Date(r.time).getTime() >= weekStart;
    });
    var aiRate = '--';
    if (aiRecs.length > 0) {
      var totalQ = 0, correctQ = 0;
      aiRecs.forEach(function(r) { totalQ += (r.totalCount||0); correctQ += (r.correctCount||0); });
      aiRate = totalQ > 0 ? Math.round(correctQ / totalQ * 100) + '%' : '--';
    }

    // 亮点
    var wrongCount = (data.wrongBook || []).length;
    var highlight = checkinDays >= 7 ? '🎉 本周全勤！太厉害了！' :
      checkinDays >= 5 ? '💪 本周表现优秀！' :
      checkinDays >= 3 ? '👍 继续保持，还有提升空间' : '🌱 新的一周，新的开始！';

    this.setData({
      checkinDays: checkinDays, totalTasks: totalTasks, starsEarned: starsEarned,
      dailyChart: { items: dailyItems },
      subjectChart: { items: subjItems },
      aiCorrectRate: aiRate, wrongCount: wrongCount,
      highlight: highlight, streak: data.user.streak || 0
    });
  },

  _fmt: function(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
});
