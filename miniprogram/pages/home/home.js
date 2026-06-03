/** 首页 - 打卡页 */
const storage = require('../../utils/storage');

function stageLabel(stage) {
  return stage === 'primary-low' ? '小学低段' : stage === 'primary-high' ? '小学高段' : stage === 'middle' ? '初中' : '高中';
}

function getExamCountdown(grade) {
  return grade === 9 || grade === 12;
}

function getExamCountdownLabel(grade) {
  if (grade === 9) return '距中考还有';
  if (grade === 12) return '距高考还有';
  return '';
}

function calcExamDays(grade) {
  var now = new Date();
  var examDate;
  if (grade === 9) {
    examDate = new Date(now.getFullYear(), 5, 15);
    if (now > examDate) examDate = new Date(now.getFullYear() + 1, 5, 15);
  } else if (grade === 12) {
    examDate = new Date(now.getFullYear(), 5, 7);
    if (now > examDate) examDate = new Date(now.getFullYear() + 1, 5, 7);
  } else {
    return 0;
  }
  return Math.max(0, Math.ceil((examDate - now) / (1000 * 60 * 60 * 24)));
}

var ENCOURAGE_LIST = [
  // 通用
  '太棒了！离梦想更近了🌟', '坚持就是胜利💪', '你是最棒的！🏆',
  '今天的努力，明天的收获🌱', '爸爸妈妈为你骄傲❤️', '又向前迈了一步📈',
  '学习使我快乐😊', '加油，小升初必胜🔥',
  // 语文
  '腹有诗书气自华📖', '文字的力量伴你成长✏️',
  // 数学
  '逻辑小达人！数学因你而简单🧮', '数字在跳舞，你在闪闪发光✨',
  // 英语
  'Practice makes perfect! 🔤', 'Every word counts! 🌍',
  // 清晨 (0-10)
  '一日之计在于晨，好的开始是成功的一半☀️',
  // 午后 (12-17)
  '下午也要元气满满！🌤️',
  // 晚间 (18-23)
  '夜猫子也闪耀！睡前打卡好梦相随🌙',
  // 深夜 (0-5)
  '黎明前的努力最珍贵🌟', '深夜的坚持，未来的王牌🃏',
  // 周末
  '周末学习，悄悄超越所有人🚀', '周末也在进步，自律是最酷的事😎',
  // 连击突破
  '连续打卡新纪录！你就是传奇🔥', '每一次坚持都在书写你的故事📝'
];

/** 根据学科和时段选择鼓励语 */
function pickEncourage(subject, hour) {
  var pool = [];
  if (subject === '语文') pool = ENCOURAGE_LIST.slice(8, 10);
  else if (subject === '数学') pool = ENCOURAGE_LIST.slice(10, 12);
  else if (subject === '英语') pool = ENCOURAGE_LIST.slice(12, 14);

  if (hour < 6) pool = pool.concat(ENCOURAGE_LIST.slice(18, 20));
  else if (hour < 10) pool = pool.concat([ENCOURAGE_LIST[14]]);
  else if (hour < 18) pool = pool.concat([ENCOURAGE_LIST[15]]);
  else pool = pool.concat([ENCOURAGE_LIST[16]]);

  var day = new Date().getDay();
  if (day === 0 || day === 6) pool = pool.concat(ENCOURAGE_LIST.slice(20, 22));

  // 至少混入2条通用语
  pool = pool.concat(ENCOURAGE_LIST.slice(0, 8));
  return pool[Math.floor(Math.random() * pool.length)];
}

const CONFETTI_EMOJIS = ['🎉', '🌟', '✨', '⭐', '🌈', '🎊', '💫', '🌸', '🎀', '🏆'];

// 徽章对应的emoji
const BADGE_EMOJI_MAP = {
  streak_3: '🔥', streak_7: '🔥', streak_14: '🔥', streak_30: '🔥',
  total_50: '📅', total_100: '📅',
  stars_100: '⭐', stars_500: '⭐',
  master_math: '🧮', master_chinese: '📖', master_english: '🔤'
};

const CAT_CLASS_MAP = {
  '语文': 'chinese',
  '数学': 'math',
  '英语': 'english',
  '综合': 'general',
  '运动': 'sport',
  '生活': 'life'
};

// 火焰状态配置
var FLAME_CONFIG = {
  burning:   { emoji: '🔥', color: '#FF6B35', text: '火焰正旺！继续保持', border: '#FF9F43' },
  weakening: { emoji: '🕯️', color: '#F39C12', text: '火焰还在，今天打卡就能重新燃起来', border: '#F39C12' },
  embers:    { emoji: '💨', color: '#E17055', text: '余烬尚温，使用守护卡可以恢复', border: '#E17055' },
  extinguished: { emoji: '❄️', color: '#B2BEC3', text: '火焰已熄，重新开始新的旅程', border: '#B2BEC3' }
};

Page({
  data: {
    greeting: '',
    currentStage: 'primary-high',
    currentGradeLabel: '六年级',
    currentStageLabel: '小学高段',
    stageRole: { icon: '🦊', name: '小勇士' },
    transitionBonus: false,
    showExamCountdown: false,
    examCountdownLabel: '',
    examCountdownDays: 0,
    stars: 0,
    streak: 0,
    longestStreak: 0,
    flameState: 'burning',     // burning|weakening|embers|extinguished
    flameStreak: 0,
    guardianCards: 2,
    tasks: [],
    doneMap: {},
    doneCount: 0,
    totalCount: 0,
    progressPercent: 0,
    allBadges: [],
    confettiList: [],
    catClassMap: CAT_CLASS_MAP,
    aiAdvice: '',
    aiLoading: false,
    isParent: false,
    dailyPlan: null,
    chartData: { items: [] },
    chartOptions: { padding: { top: 25, right: 15, bottom: 30, left: 40 } },
    nextTask: null,         // 第一个未完成任务
    allDone: false,          // 今日任务是否全部完成
    showAIRecommend: false,  // AI 练习推荐卡片
    aiRecommendSubject: '',  // 推荐学科
    activeContracts: [],     // 活跃亲子契约
    showShareCard: false,
    shareImagePath: '',
    foldExpanded: false       // 更多功能折叠面板
  },

  _confettiTimer: null,

  /** 页面加载时立即初始化数据 */
  onLoad() {
    this.loadData();
  },

  onShow() {
    // 首次展示跳过（onLoad 已加载），后续切 tab 返回时刷新
    if (!this._dataLoaded) {
      this._dataLoaded = true;
      return;
    }
    this.loadData();
    // 检查打卡提醒
    this._checkReminder();
  },

  /** AI 学习建议 - 加载本地兜底建议（云函数需配置后启用） */
  refreshAIReport() {
    const data = storage.getAppData();
    const tasks = data.tasks || [];
    const total = tasks.length;

    // 近7天完成率
    const dailyRates = [];
    let subjectSet = new Set();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      const done = (data.checkins[dateStr] || []).length;
      dailyRates.push(total > 0 ? Math.round(done / total * 100) : 0);
      // 收集当天任务的学科
      if (data.checkins[dateStr]) {
        data.checkins[dateStr].forEach(tid => {
          const t = tasks.find(x => x.id === tid);
          if (t) subjectSet.add(t.category);
        });
      }
    }

    // 错题学科分布
    const mistakes = data.mistakes || [];
    const mistakeSubjects = [...new Set(mistakes.map(m => m.subject))].join('、');

    this.setData({ aiLoading: true, aiAdvice: '' });

    // 尝试调用云函数，失败则用本地兜底
    const fallbacks = [
      '坚持就是胜利！每天进步一点点，每一步都算数🔥',
      '你已经连续打卡 ' + data.user.streak + ' 天了，非常棒的坚持！继续保持💪',
      '近7天完成率：' + dailyRates.filter(r => r > 0).length + ' 天有打卡，继续加油哦📈',
      mistakeSubjects ? '错题主要集中在 ' + mistakeSubjects + '，建议多练练这些学科📖' : '',
      '累计获得 ' + data.user.totalStarsEarned + ' 颗星星，你是最棒的🌟',
      '学习是一个积累的过程，今天的努力会在明天开花结果🌱'
    ];
    const picked = fallbacks.filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 2).join('\n');

    // 异步尝试云端AI建议
    var hasCloud = false;
    try {
      if (typeof wx.cloud !== 'undefined') {
        var that = this;
        wx.cloud.callFunction({
          name: 'ai-report',
          data: { dailyRates: dailyRates, subjects: mistakeSubjects || '无', streak: data.user.streak, stars: data.user.stars },
          success: function(res) {
            var text = (res.result && res.result.advice) ? res.result.advice : (res.result && res.result.fallback) || null;
            if (text) that.setData({ aiAdvice: text, aiLoading: false });
          },
          fail: function() {
            that.setData({ aiAdvice: picked, aiLoading: false });
          }
        });
        hasCloud = true;
      }
    } catch(e) {}

    if (!hasCloud) {
      this.setData({ aiAdvice: picked, aiLoading: false });
    }
  },

  /** 跳转到排行榜 */
  goToLeaderboard() {
    wx.navigateTo({ url: '/subpkg-learn/pages/leaderboard/leaderboard' });
  },

  /** 跳转到番茄钟 */
  goToPomodoro() {
    wx.navigateTo({ url: '/subpkg-learn/pages/pomodoro/pomodoro' });
  },

  /** 跳转到学习周报 */
  goToWeeklyReport() {
    wx.navigateTo({ url: '/subpkg-learn/pages/weekly-report/weekly-report' });
  },

  /** 跳转到 PK 赛 */
  goToPK() {
    wx.navigateTo({ url: '/subpkg-learn/pages/pk/pk' });
  },

  /** 生成分享卡片 */
  generateShareCard() {
    var share = require('../../utils/share');
    var that = this;
    share.generateShareCard(this.data.streak, this.data.stars, '小勇士', {
      monthCheckins: this.data.doneCount,
      totalCheckins: this.data.totalCount
    }).then(function(path) {
      that.setData({ shareImagePath: path, showShareCard: true });
    }).catch(function() {});
  },

  closeShareCard() { this.setData({ showShareCard: false }); },

  /** 跳转到 AI 出题 */
  goToAI() {
    wx.navigateTo({ url: '/subpkg-learn/pages/ai-exam/ai-exam' });
  },

  /** 跳转到错题本 */
  toggleFold: function() {
    this.setData({ foldExpanded: !this.data.foldExpanded });
  },

  goToWrongBook() {
    wx.navigateTo({ url: '/subpkg-learn/pages/wrongbook/wrongbook' });
  },

  /** 跳转到题库练习 */
  goToLocalPractice() {
    wx.navigateTo({ url: '/subpkg-learn/pages/practice/practice' });
  },

  /** 跳转到模拟考试 */
  goToPaperExam() {
    wx.navigateTo({ url: '/subpkg-learn/pages/exam-paper/exam-paper' });
  },

  /** 跳转到家长中心 */
  goToDetail() {
    wx.navigateTo({ url: '/subpkg-user/pages/detail/detail' });
  },

  /** 生成每日推荐练习 */
  generateDailyPlan(data) {
    const wrongBook = data.wrongBook || [];
    const records = data.aiRecords || [];

    // 1. 高频错题知识点
    const kpCount = {};
    wrongBook.forEach(item => {
      const kp = item.knowledge || '综合';
      kpCount[kp] = (kpCount[kp] || 0) + 1;
    });
    const topKp = Object.entries(kpCount).sort((a, b) => b[1] - a[1])[0];

    // 2. 正确率最低的学科
    const subjectRates = {};
    records.forEach(r => {
      if (!subjectRates[r.subject]) subjectRates[r.subject] = { total: 0, correct: 0 };
      subjectRates[r.subject].total += r.totalCount;
      subjectRates[r.subject].correct += r.correctCount;
    });

    let worstSubject = '数学';
    let worstRate = 100;
    Object.entries(subjectRates).forEach(([sub, d]) => {
      const rate = d.total > 0 ? d.correct / d.total : 1;
      if (rate < worstRate) { worstRate = rate; worstSubject = sub; }
    });

    const plan = {
      subject: worstSubject,
      knowledge: topKp ? topKp[0] : '综合练习',
      difficulty: worstRate < 0.5 ? '基础巩固' : (worstRate < 0.75 ? '能力提升' : '冲刺拔高'),
      count: 5
    };

    return plan;
  },

  /** 一键开始今日推荐练习 */
  startDailyPlan() {
    const plan = this.data.dailyPlan;
    if (!plan) return;
    const q = 'subject=' + encodeURIComponent(plan.subject)
      + '&knowledge=' + encodeURIComponent(plan.knowledge)
      + '&difficulty=' + encodeURIComponent(plan.difficulty)
      + '&count=' + plan.count + '&autoDifficulty=1';
    wx.navigateTo({ url: '/subpkg-learn/pages/ai-exam/ai-exam?' + q });
  },

  /** 分享鼓励卡 */
  onShareCard() {
    const data = storage.getAppData();
    const share = require('../../utils/share');
    wx.showLoading({ title: '生成中...' });
    // 计算本月打卡天数
    var now = new Date();
    var monthCheckins = 0;
    for (var d = 1; d <= now.getDate(); d++) {
      var key = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      if (data.checkins[key] && data.checkins[key].length > 0) monthCheckins++;
    }
    // 最新勋章
    var earnedBadges = data.user.earnedBadges || [];
    var latestBadge = '';
    if (earnedBadges.length > 0) {
      var latestKey = earnedBadges[earnedBadges.length - 1];
      var found = storage.BADGE_DEFS.find(function(b) { return b.key === latestKey; });
      if (found) latestBadge = found.name;
    }
    share.generateShareCard(data.user.streak, data.user.stars, '小勇士', {
      monthCheckins: monthCheckins,
      totalCheckins: data.user.totalCheckins,
      latestBadge: latestBadge
    }).then(tempPath => {
      wx.hideLoading();
      wx.showActionSheet({
        itemList: ['保存到相册', '转发给好友'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.saveImageToPhotosAlbum({
              filePath: tempPath,
              success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
              fail: () => wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' })
            });
          } else if (res.tapIndex === 1) {
            wx.shareFileMessage({ filePath: tempPath });
          }
        }
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    });
  },

  /** 检查任务提醒 */
  _checkReminder() {
    const result = storage.checkReminder();
    if (result) {
      wx.showModal({
        title: '⏰ 小升初打卡提醒',
        content: '宝贝，该完成今天的打卡任务啦！坚持就是胜利~',
        confirmText: '去打卡',
        showCancel: true,
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) {
            // 当前已在首页，无需跳转
          }
        }
      });
    }
  },

  goToBadges() {
    wx.navigateTo({ url: '/subpkg-learn/pages/badges/badges' });
  },

  onUnload() {
    if (this._confettiTimer) {
      clearTimeout(this._confettiTimer);
      this._confettiTimer = null;
    }
  },

  /** 将 doneIds 数组转为 doneMap 对象（用于WXML安全访问） */
  _buildDoneMap(doneIds) {
    const map = {};
    doneIds.forEach(id => { map[id] = true; });
    return map;
  },

  /** 加载并刷新数据 */
  loadData() {
    try {
      storage.validateStreak();
      var data = storage.getAppData();
      var doneIds = storage.getTodayCheckins();
      var tasks = data.tasks || [];

      // 问候语
      var hour = new Date().getHours();
      var greeting = hour < 6 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';

      // 徽章（轻量计算，仅更新 earned 状态）
      var earnedSet = {};
      (data.user.earnedBadges || []).forEach(function(k) { earnedSet[k] = true; });
      var allBadges = storage.BADGE_DEFS.map(function(b) {
        return { key: b.key, name: b.name, desc: b.desc, emoji: BADGE_EMOJI_MAP[b.key] || '🏅', earned: !!earnedSet[b.key] };
      });

      var plan = this.generateDailyPlan(data);
      var nextTask = this._getNextTask(tasks, doneIds);
      var doneMap = this._buildDoneMap(doneIds);

      // 合并为单次 setData（减少 JS→渲染线程通信次数）
      this.setData({
        greeting: greeting,
        currentStage: data.user.stage || 'primary-high',
        stageRole: storage.getStageRole(data.user.stage || 'primary-high'),
        transitionBonus: storage.isInTransitionBonus(data),
        currentGradeLabel: storage.getGradeLabel(data.user.currentGrade || 6),
        currentStageLabel: stageLabel(data.user.stage || 'primary-high'),
        showExamCountdown: getExamCountdown(data.user.currentGrade || 6),
        examCountdownLabel: getExamCountdownLabel(data.user.currentGrade || 6),
        examCountdownDays: calcExamDays(data.user.currentGrade || 6),
        stars: data.user.stars || 0,
        streak: data.user.streak || 0,
        longestStreak: data.user.longestStreak || 0,
        flameState: data.user.flameState || 'burning',
        flameStreak: data.user.flameStreak || data.user.streak || 0,
        guardianCards: data.user.guardianCards || 0,
        tasks: tasks,
        doneMap: doneMap,
        doneCount: doneIds.length,
        totalCount: tasks.length,
        progressPercent: tasks.length > 0 ? Math.round(doneIds.length / tasks.length * 100) : 0,
        allBadges: allBadges,
        isParent: storage.isParentMode(),
        dailyPlan: plan,
        nextTask: nextTask,
        allDone: doneIds.length >= tasks.length && tasks.length > 0,
        activeContracts: data.contracts ? data.contracts.filter(function(c) { return c.status === 'active'; }) : []
      });

      // 柱状图数据异步准备（非阻塞）
      this.prepareChartData();

      // AI 建议延迟加载（避免阻塞首屏渲染）
      if (!this._aiLoaded) {
        this._aiLoaded = true;
        setTimeout(this.refreshAIReport.bind(this), 1000);
      }
    } catch (e) {
      console.error('loadData error:', e);
    }
  },

  /** 跳转到 AI 出题（任务卡片"练习"按钮） */
  goToPractice(e) {
    const task = e.currentTarget.dataset.task;
    if (!task || !task.linkPractice || this.data.doneMap[task.id]) return;
    const params = {
      taskId: task.id,
      taskName: task.name,
      subject: task.linkPractice.subject,
      grades: task.linkPractice.grades
    };
    wx.navigateTo({
      url: '/subpkg-learn/pages/ai-exam/ai-exam?sourceTask=' + encodeURIComponent(JSON.stringify(params))
    });
  },

  /** 从练习页面回调用：自动完成任务（供 practice.js 调用） */
  autoCompleteTask(taskId) {
    storage.autoCompleteTask(taskId);
    this.loadData(); // 刷新界面
    wx.showToast({ title: '✅ 任务已完成！', icon: 'success' });
  },

  /** 获取第一个未完成任务 */
  _getNextTask(tasks, doneIds) {
    for (var i = 0; i < tasks.length; i++) {
      if (doneIds.indexOf(tasks[i].id) < 0) {
        return tasks[i];
      }
    }
    return null;
  },

  /** 一键开始：点击 hero 卡片进入下一个任务 */
  startNextTask() {
    var task = this.data.nextTask;
    if (!task) return;

    // 带练习链接的任务：直接跳转 AI 出题
    if (task.linkPractice) {
      var params = {
        taskId: task.id,
        taskName: task.name,
        subject: task.linkPractice.subject,
        grades: task.linkPractice.grades
      };
      wx.navigateTo({
        url: '/subpkg-learn/pages/ai-exam/ai-exam?sourceTask=' + encodeURIComponent(JSON.stringify(params))
      });
    } else {
      // 普通任务：直接打卡
      var result = storage.toggleTask(task.id);
      if (result) {
        this.playCelebrate();
        storage.checkBadges();
        this.loadData();
      }
    }
  },

  /** 使用守护卡恢复火焰 */
  useGuardianCard() {
    var that = this;
    wx.showModal({
      title: '使用火焰守护卡',
      content: '确定消耗1张守护卡恢复火焰吗？剩余：' + this.data.guardianCards + '张',
      success: function(res) {
        if (!res.confirm) return;
        var data = storage.getAppData();
        var result = storage.useGuardianCard(data);
        if (result.success) {
          wx.showToast({ title: '火焰已恢复！🔥', icon: 'success' });
          that.loadData();
          that.playCelebrate();
        } else {
          wx.showToast({ title: result.msg, icon: 'none' });
        }
      }
    });
  },

  /** 关闭 AI 推荐 */
  closeAIRecommend() { this.setData({ showAIRecommend: false }); },

  /** 快速 AI 练习：5 道题，跳过配置 */
  startQuickAI() {
    this.setData({ showAIRecommend: false });
    var subj = this.data.aiRecommendSubject;
    var plan = this.data.dailyPlan;
    var knowledge = plan ? plan.knowledge : '';
    wx.navigateTo({
      url: '/subpkg-learn/pages/ai-exam/ai-exam?mode=quick&subject=' + subj + '&knowledge=' + (knowledge || '') + '&count=5'
    });
  },

  /** 积分购买守护卡 */
  buyGuardianCard() {
    var that = this;
    wx.showModal({
      title: '购买守护卡',
      content: '消耗50⭐购买1张守护卡？',
      success: function(res) {
        if (!res.confirm) return;
        var data = storage.getAppData();
        var result = storage.buyGuardianCard(data, 50);
        if (result.success) {
          wx.showToast({ title: '购买成功！剩余：' + result.remaining + '张', icon: 'success' });
          that.loadData();
        } else {
          wx.showToast({ title: result.msg, icon: 'none' });
        }
      }
    });
  },

  /** 切换任务打卡状态 */
  toggleTask(e) {
    const id = e.currentTarget.dataset.id;
    // 已完成的任务不可点击
    if (this.data.doneMap[id]) return;
    // 带练习链接的任务由 goToPractice 处理，点击卡片本身不触发打卡
    const task = this.data.tasks.find(t => t.id === id);
    if (task && task.linkPractice) return;

    const result = storage.toggleTask(id);
    if (!result) return;

    const doneIds = storage.getTodayCheckins();
    const wasChecked = !!this.data.doneMap[id];
    const nowChecked = doneIds.indexOf(id) !== -1;

    // 如果是完成打卡（非取消）
    if (!wasChecked && nowChecked) {
      // DECR 埋点
      storage.trackDailyMetric('checkin');
      // 更新契约进度
      storage.updateContractProgress();
      // 播放动画（传入任务科目）
      this.playCelebrate(task ? task.category : '');

      // 生成分享卡片
      this.generateShareCard();

      // 检查徽章（需重新计算徽章数据的 earned 状态）
      const newBadges = storage.checkBadges();
      if (newBadges.length > 0) {
        const names = newBadges.map(b => b.name).join('、');
        wx.showToast({
          title: `🏆 获得徽章：${names}`,
          icon: 'none',
          duration: 2500
        });
        // 刷新徽章数据
        const earnedSet = {};
        (result.user.earnedBadges || []).forEach(k => { earnedSet[k] = true; });
        const allBadges = storage.BADGE_DEFS.map(b => ({
          key: b.key, name: b.name, desc: b.desc,
          emoji: BADGE_EMOJI_MAP[b.key] || '🏅',
          earned: !!earnedSet[b.key]
        }));
        this.setData({ allBadges });
      }
    }

    // 打卡完成后弹出 AI 练习推荐
    if (!wasChecked && nowChecked && task && task.linkPractice) {
      this.setData({ showAIRecommend: true, aiRecommendSubject: task.linkPractice.subject });
    }

    // 刷新界面（合并为单次 setData）
    var newDoneMap = this._buildDoneMap(doneIds);
    this.setData({
      stars: result.user.stars,
      streak: result.user.streak,
      longestStreak: result.user.longestStreak,
      doneMap: newDoneMap,
      doneCount: doneIds.length,
      progressPercent: result.tasks.length > 0 ? Math.round(doneIds.length / result.tasks.length * 100) : 0,
      allDone: doneIds.length >= result.tasks.length && result.tasks.length > 0,
      nextTask: this._getNextTask(result.tasks, doneIds)
    });
    // 图表异步更新
    this.prepareChartData();
  },

  /** 长按任务 - 记录错题 */
  onRecordMistake(e) {
    const id = e.currentTarget.dataset.id;
    const data = storage.getAppData();
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;
    wx.showModal({
      title: '📝 记录错题 - ' + task.name,
      content: '是否记录这道题的错题？可输入错误原因',
      editable: true,
      placeholderText: '如：乘法口诀记错了',
      success: (res) => {
        if (res.confirm) {
          wx.chooseMedia({
            count: 1, mediaType: ['image'], sizeType: ['compressed'],
            success: (mediaRes) => {
              wx.getFileSystemManager().readFile({
                filePath: mediaRes.tempFiles[0].tempFilePath,
                encoding: 'base64',
                success: (br) => {
                  storage.addMistake(task.id, task.category, br.data, res.content || '');
                  wx.showToast({ title: '错题已记录 📝', icon: 'success' });
                }
              });
            },
            fail: () => {
              storage.addMistake(task.id, task.category, '', res.content || '');
              wx.showToast({ title: '错题已记录（无图）', icon: 'success' });
            }
          });
        }
      }
    });
  },

  /** 播放庆祝效果 */
  playCelebrate(category) {
    // 鼓励语：根据学科和时段动态选择
    var hour = new Date().getHours();
    var msg = pickEncourage(category || '', hour);
    wx.showToast({
      title: msg,
      icon: 'none',
      duration: 2000
    });

    // 短震动
    wx.vibrateShort({ type: 'light' }).catch(() => {});

    // 撒花特效
    this.spawnConfetti();
  },

  /** 准备近7天完成率柱状图数据 */
  prepareChartData: function() {
    var data = storage.getAppData();
    var tasks = data.tasks || [];
    var totalCount = tasks.length;

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var dateStr = y + '-' + m + '-' + day;
      var checkinIds = data.checkins[dateStr] || [];
      var done = checkinIds.length;
      var rate = totalCount > 0 ? Math.round((done / totalCount) * 100) : 0;
      days.push({ label: String(d.getDate()) + '日', value: rate });
    }

    this.setData({ chartData: { items: days } });
  },
  spawnConfetti() {
    const pieces = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      pieces.push({
        emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
        left: Math.random() * 100,
        delay: Math.random() * 0.3,
        duration: 0.8 + Math.random() * 0.6
      });
    }
    this.setData({ confettiList: pieces });

    if (this._confettiTimer) clearTimeout(this._confettiTimer);
    this._confettiTimer = setTimeout(() => {
      this.setData({ confettiList: [] });
      this._confettiTimer = null;
    }, 1500);
  },

});
