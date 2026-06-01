/** 家长中心 - 查看数据明细 */
const storage = require('../../utils/storage');

Page({
  data: {
    activeTab: 0,
    groupedCheckins: [],
    logs: [],
    redeemLogs: [],
    aiRecords: [],
    radarData: [],
    lineChartData: { items: [] },
    lineChartOptions: { padding: { top: 30, right: 20, bottom: 40, left: 50 } },
    radarChartData: { items: [] },
    radarChartOptions: { padding: { top: 25, right: 25, bottom: 25, left: 25 }, levels: 4 }
  },

  onShow() { this.loadData(); },

  loadData() {
    var appData = storage.getAppData();
    var checkins = appData.checkins || {};
    var tasks = appData.tasks || [];
    var logs = appData.logs || [];

    // 打卡明细：按日期倒序
    var grouped = [];
    var dates = Object.keys(checkins).sort().reverse();
    for (var d = 0; d < dates.length; d++) {
      var date = dates[d];
      var taskIds = checkins[date];
      if (taskIds.length > 0) {
        var taskList = [];
        for (var t = 0; t < taskIds.length; t++) {
          var found = null;
          for (var ft = 0; ft < tasks.length; ft++) {
            if (tasks[ft].id === taskIds[t]) { found = tasks[ft]; break; }
          }
          if (found) taskList.push(found);
        }
        grouped.push({ date: date, tasks: taskList });
      }
    }

    // 积分流水
    var all = [];
    for (var i = logs.length - 1; i >= 0; i--) {
      all.push(logs[i]);
    }
    var formattedLogs = [];
    for (var l = 0; l < all.length; l++) {
      formattedLogs.push(Object.assign({}, all[l], { timeStr: this._fmt(all[l].time) }));
    }
    var redeemLogs = [];
    for (var r = 0; r < formattedLogs.length; r++) {
      if (formattedLogs[r].type === 'redeem') {
        redeemLogs.push(formattedLogs[r]);
      }
    }

    // 处理AI记录
    var records = appData.aiRecords || [];
    var aiRecords = [];
    for (var ri = 0; ri < records.length; ri++) {
      var rec = records[ri];
      var total = rec.totalCount || 0;
      var correct = rec.correctCount || 0;
      var rate = total > 0 ? Math.round(correct / total * 100) : 0;
      aiRecords.push({
        time: rec.time,
        timeStr: this._fmt(rec.time),
        subject: rec.subject || '',
        knowledge: rec.knowledge || '',
        textbook: rec.textbook || '',
        preference: rec.preference || '',
        totalCount: total,
        correctCount: correct,
        correctRate: rate
      });
    }
    aiRecords.reverse();

    this.setData({ groupedCheckins: grouped, logs: formattedLogs, redeemLogs: redeemLogs, aiRecords: aiRecords });

    // 切换到 AI 选项卡时准备图表
    if (this.data.activeTab === 3) {
      this.calcRadarData();
      this.prepareLineChart();
    }
  },

  _fmt: function(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  },

  switchTab: function(e) {
    var index = parseInt(e.currentTarget.dataset.index);
    this.setData({ activeTab: index });
    if (index === 3) {
      // 准备折线图数据
      var that = this;
      setTimeout(function() { that.prepareLineChart(); }, 200);
    }
  },

  // ====== 正确率趋势折线图（数据准备） ======
  prepareLineChart: function() {
    var records = this.data.aiRecords;
    if (!records || records.length < 2) return;

    var items = [];
    for (var i = 0; i < records.length; i++) {
      var label = (records[i].timeStr || '').split(' ')[0];
      if (label.length > 5) label = label.substring(5);
      items.push({ label: label, value: records[i].correctRate || 0 });
    }

    this.setData({ lineChartData: { items: items } });
  },

  // ====== 知识点雷达图 ======
  calcRadarData: function() {
    var records = this.data.aiRecords;
    if (!records || records.length === 0) return;

    // 按知识点聚合
    var kpMap = {};
    for (var ri = 0; ri < records.length; ri++) {
      var r = records[ri];
      // 原始 aiRecords 中 knowledge 是中文，从 storage 取完整数据
      var kp = r.knowledge || '未分类';
      if (!kpMap[kp]) kpMap[kp] = { total: 0, correct: 0 };
      kpMap[kp].total += r.totalCount;
      kpMap[kp].correct += r.correctCount;
    }

    var entries = Object.keys(kpMap);
    var radarData = [];
    for (var ei = 0; ei < entries.length && ei < 6; ei++) {
      var label = entries[ei];
      var data = kpMap[label];
      radarData.push({
        label: label,
        value: data.total > 0 ? Math.round(data.correct / data.total * 100) : 0
      });
    }

    var that = this;
    this.setData({
      radarData: radarData,
      radarChartData: { items: radarData }
    });
  }
});
