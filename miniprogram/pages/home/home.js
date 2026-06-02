/** 首页 - 打卡页 */
const storage = require('../../utils/storage');

const ENCOURAGE_LIST = [
  '太棒了！离梦想更近了🌟',
  '坚持就是胜利💪',
  '你是最棒的！🏆',
  '今天的努力，明天的收获🌱',
  '爸爸妈妈为你骄傲❤️',
  '又向前迈了一步📈',
  '学习使我快乐😊',
  '加油，小升初必胜🔥'
];

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
    aiRecommendSubject: ''   // 推荐学科
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
    const tryCloud = () => {
      if (typeof wx.cloud !== 'undefined') {
        try {
          wx.cloud.callFunction({
            name: 'ai-report',
            data: { dailyRates, subjects: mistakeSubjects || '无', streak: data.user.streak, stars: data.user.stars },
            success: (res) => {
              const text = res.result && res.result.advice ? res.result.advice : (res.result && res.result.fallback ? res.result.fallback : null);
              if (text) {
                this.setData({ aiAdvice: text, aiLoading: false });
                return true;
              }
              return false;
            },
            fail: () => false
          });
          return true;
        } catch(e) {
          return false;
        }
      }
      return false;
    };

    if (!tryCloud()) {
      // 本地兜底建议
      const fallbacks = [
        '坚持就是胜利！每天进步一点点，小升初必胜🔥',
        '你已经连续打卡 ' + data.user.streak + ' 天了，非常棒的坚持！继续保持💪',
        '近7天完成率：' + dailyRates.filter(r => r > 0).length + ' 天有打卡，继续加油哦📈',
        mistakeSubjects ? '错题主要集中在 ' + mistakeSubjects + '，建议多练练这些学科📖' : '',
        '累计获得 ' + data.user.totalStarsEarned + ' 颗星星，你是最棒的🌟',
        '学习是一个积累的过程，今天的努力会在明天开花结果🌱'
      ];
      const picked = fallbacks.filter(Boolean).sort(() => Math.random() - 0.5).slice(0, 2).join('\n');
      setTimeout(() => {
        this.setData({ aiAdvice: picked, aiLoading: false });
      }, 800);
    }
  },

  /** 跳转到 AI 出题 */
  goToAI() {
    wx.navigateTo({ url: '/pages/ai-exam/ai-exam' });
  },

  /** 跳转到错题本 */
  goToWrongBook() {
    wx.navigateTo({ url: '/pages/wrongbook/wrongbook' });
  },

  /** 跳转到题库练习 */
  goToLocalPractice() {
    wx.navigateTo({ url: '/pages/practice/practice' });
  },

  /** 跳转到模拟考试 */
  goToPaperExam() {
    wx.navigateTo({ url: '/pages/exam-paper/exam-paper' });
  },

  /** 跳转到家长中心 */
  goToDetail() {
    wx.navigateTo({ url: '/pages/detail/detail' });
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
    wx.navigateTo({ url: '/pages/ai-exam/ai-exam?' + q });
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
    wx.navigateTo({ url: '/pages/badges/badges' });
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
      const data = storage.getAppData();
      const doneIds = storage.getTodayCheckins();
      const tasks = data.tasks || [];

      // 问候语
      const hour = new Date().getHours();
      let greeting = '';
      if (hour < 6) greeting = '夜深了';
      else if (hour < 9) greeting = '早上好';
      else if (hour < 12) greeting = '上午好';
      else if (hour < 14) greeting = '中午好';
      else if (hour < 18) greeting = '下午好';
      else greeting = '晚上好';

      // 徽章
      const earnedSet = {};
      (data.user.earnedBadges || []).forEach(k => { earnedSet[k] = true; });
      const allBadges = storage.BADGE_DEFS.map(b => ({
        key: b.key, name: b.name, desc: b.desc,
        emoji: BADGE_EMOJI_MAP[b.key] || '🏅',
        earned: !!earnedSet[b.key]
      }));

      var plan = this.generateDailyPlan(data);
      var nextTask = this._getNextTask(tasks, doneIds);
      this.setData({
        greeting,
        stars: data.user.stars || 0,
        streak: data.user.streak || 0,
        longestStreak: data.user.longestStreak || 0,
        flameState: data.user.flameState || 'burning',
        flameStreak: data.user.flameStreak || data.user.streak || 0,
        guardianCards: data.user.guardianCards || 0,
        tasks,
        doneMap: this._buildDoneMap(doneIds),
        doneCount: doneIds.length,
        totalCount: tasks.length,
        progressPercent: tasks.length > 0 ? (doneIds.length / tasks.length) * 100 : 0,
        allBadges,
        isParent: storage.isParentMode(),
        dailyPlan: plan,
        nextTask: nextTask,
        allDone: doneIds.length >= tasks.length && tasks.length > 0
      });
      // 准备柱状图数据
      this.prepareChartData();
      // 自动加载AI建议
      if (!this._aiLoaded) {
        this._aiLoaded = true;
        this.refreshAIReport();
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
      url: '/pages/ai-exam/ai-exam?sourceTask=' + encodeURIComponent(JSON.stringify(params))
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
        url: '/pages/ai-exam/ai-exam?sourceTask=' + encodeURIComponent(JSON.stringify(params))
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
      url: '/pages/ai-exam/ai-exam?mode=quick&subject=' + subj + '&knowledge=' + (knowledge || '') + '&count=5'
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
      // 播放动画
      this.playCelebrate();

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

    // 刷新界面
    this.setData({
      stars: result.user.stars,
      streak: result.user.streak,
      longestStreak: result.user.longestStreak,
      doneMap: this._buildDoneMap(doneIds),
      doneCount: doneIds.length,
      progressPercent: result.tasks.length > 0 ? (doneIds.length / result.tasks.length) * 100 : 0
    });
    // 更新图表
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
  playCelebrate() {
    // 鼓励语
    const msg = ENCOURAGE_LIST[Math.floor(Math.random() * ENCOURAGE_LIST.length)];
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
