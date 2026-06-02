/** 数据存储模块 */
const { getTodayStr, getYesterdayStr } = require('./date');
var _syncTimer = null;

const STORAGE_KEY = 'kid_checkin_data';

// ===== 多孩账号 =====

var DEFAULT_CHILD = { id: 'default', name: '孩子' };

function getChildrenList() {
  return wx.getStorageSync('children_list') || [DEFAULT_CHILD];
}

function saveChildrenList(list) {
  wx.setStorageSync('children_list', list);
}

function getCurrentChildId() {
  return wx.getStorageSync('current_child_id') || 'default';
}

function switchChild(childId) {
  wx.setStorageSync('current_child_id', childId);
}

function getStorageKey() {
  var childId = getCurrentChildId();
  return childId === 'default' ? STORAGE_KEY : STORAGE_KEY + '_' + childId;
}

// ===== 默认数据 =====

const DEFAULT_TASKS = [
  { id: 1,  name: '语文练习', icon: '📖', points: 10, category: '语文', linkPractice: { subject: 'chinese', grades: [6] } },
  { id: 2,  name: '数学练习', icon: '🧮', points: 10, category: '数学', linkPractice: { subject: 'math', grades: [6] } },
  { id: 3,  name: '英语练习', icon: '🔤', points: 10, category: '英语', linkPractice: { subject: 'english', grades: [6] } }
];

const DEFAULT_REWARDS = [
  { id: 1, name: '看30分钟动画',   icon: '📺', cost: 40, imageBase64: '' },
  { id: 2, name: '吃一个冰淇淋',   icon: '🍦', cost: 25, imageBase64: '' },
  { id: 3, name: '周末去公园',     icon: '🏞️', cost: 80, imageBase64: '' },
  { id: 4, name: '选一本新书',     icon: '📖', cost: 60, imageBase64: '' },
  { id: 5, name: '玩20分钟游戏',   icon: '🎮', cost: 50, imageBase64: '' },
  { id: 6, name: '看一集纪录片',   icon: '📽️', cost: 35, imageBase64: '' }
];

const BADGE_DEFS = [
  // 连续打卡（4级：铜→银→金→钻）
  { key: 'streak_3',   name: '连续3天',   level: 1, tier: '🥉', desc: '连续打卡≥3天',     check: d => d.user.streak >= 3 },
  { key: 'streak_7',   name: '一周坚持',   level: 1, tier: '🥉', desc: '连续打卡≥7天',     check: d => d.user.streak >= 7 },
  { key: 'streak_30',  name: '月度冠军',   level: 1, tier: '🥈', desc: '连续打卡≥30天',    check: d => d.user.streak >= 30 },
  { key: 'streak_60',  name: '双月霸主',   level: 2, tier: '🥈', desc: '连续打卡≥60天',    check: d => d.user.streak >= 60 },
  { key: 'streak_100', name: '百天传奇',   level: 2, tier: '🥇', desc: '连续打卡≥100天',   check: d => d.user.streak >= 100 },
  { key: 'streak_180', name: '半年坚持',   level: 3, tier: '🥇', desc: '连续打卡≥180天',   check: d => d.user.streak >= 180 },
  { key: 'streak_365', name: '年度王者',   level: 4, tier: '💎', desc: '连续打卡≥365天',   check: d => d.user.streak >= 365 },
  // 累计打卡
  { key: 'total_50',   name: '50次打卡',   level: 1, tier: '🥉', desc: '累计打卡≥50次',    check: d => d.user.totalCheckins >= 50 },
  { key: 'total_100',  name: '100次打卡',  level: 2, tier: '🥈', desc: '累计打卡≥100次',   check: d => d.user.totalCheckins >= 100 },
  { key: 'total_200',  name: '200次打卡',  level: 3, tier: '🥇', desc: '累计打卡≥200次',   check: d => d.user.totalCheckins >= 200 },
  { key: 'total_500',  name: '500次打卡',  level: 4, tier: '💎', desc: '累计打卡≥500次',   check: d => d.user.totalCheckins >= 500 },
  // 星星积分
  { key: 'stars_100',  name: '百星富翁',   level: 1, tier: '🥉', desc: '累计获得≥100⭐',  check: d => d.user.totalStarsEarned >= 100 },
  { key: 'stars_500',  name: '五星上将',   level: 2, tier: '🥈', desc: '累计获得≥500⭐',  check: d => d.user.totalStarsEarned >= 500 },
  { key: 'stars_1000', name: '千星传奇',   level: 3, tier: '🥇', desc: '累计获得≥1000⭐', check: d => d.user.totalStarsEarned >= 1000 },
  { key: 'stars_5000', name: '财富自由',   level: 4, tier: '💎', desc: '累计获得≥5000⭐', check: d => d.user.totalStarsEarned >= 5000 },
  // 学科达人
  { key: 'master_math',    name: '数学小达人', level: 1, tier: '🥉', desc: '数学≥30次', check: d => (d.categoryStats['数学']||0) >= 30 },
  { key: 'master_math_60', name: '数学小天才', level: 2, tier: '🥈', desc: '数学≥60次', check: d => (d.categoryStats['数学']||0) >= 60 },
  { key: 'master_chinese', name: '语文小学霸', level: 1, tier: '🥉', desc: '语文≥30次', check: d => (d.categoryStats['语文']||0) >= 30 },
  { key: 'master_english', name: '英语小能手', level: 1, tier: '🥉', desc: '英语≥30次', check: d => (d.categoryStats['英语']||0) >= 30 },
  // 隐藏徽章
  { key: 'hidden_dawn',    name: '黎明之光',   level: 3, tier: '🥇', desc: '凌晨5点前打卡',   check: d => { var h = new Date().getHours(); return h >= 0 && h < 5; } },
  { key: 'hidden_speed',   name: '闪电侠',     level: 2, tier: '🥈', desc: '连续完成所有任务≤30分钟', check: d => d.user.streak >= 1 }
];

// ===== 云缓存层 =====

var CLOUD_CACHE_PREFIX = '_cloudCache_';

function setCloudCache(key, data) {
  wx.setStorageSync(CLOUD_CACHE_PREFIX + key, data);
}

function getCloudCache(key) {
  return wx.getStorageSync(CLOUD_CACHE_PREFIX + key) || null;
}

function triggerAutoSync() {
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
  _syncTimer = setTimeout(function() {
    _syncTimer = null;
    try {
      var account = require('./account');
      if (account.isLoggedIn()) {
        var data = getAppData();
        var user = account.getCurrentUser();
        account.uploadData(data, user.currentChildId || 'default', Date.now());
      }
    } catch (e) {
      // 静默处理同步失败
    }
  }, 3000);
}

// ===== 初始化 =====

function initData() {
  return {
    tasks: JSON.parse(JSON.stringify(DEFAULT_TASKS)),
    rewards: JSON.parse(JSON.stringify(DEFAULT_REWARDS)),
    checkins: {},
    categoryStats: { 语文: 0, 数学: 0, 英语: 0, 综合: 0, 运动: 0, 生活: 0 },
    user: {
      stars: 0,
      streak: 0,
      longestStreak: 0,
      totalCheckins: 0,
      totalStarsEarned: 0,
      lastCheckinDate: null,
      earnedBadges: [],
      parentPassword: '1234',
      isParentUnlocked: false,
      reminder: { enabled: false, hour: 19, minute: 30, lastRemindedDate: null },
      flameState: 'burning',        // burning|weakening|embers|extinguished
      flameStreak: 0,               // 火焰显示用的连续天数
      guardianCards: 2,             // 每月免费守护卡
      guardianCardsMax: 5,          // 每月上限
      lastGuardianReset: '',        // 上次重置月份 YYYY-MM
      leaderboardOptIn: false,      // 是否加入排行榜
      pomodoroCount: 0,              // 累计番茄数
      pomodoroMinutes: 0,            // 累计专注分钟
      pomodoroToday: 0               // 今日番茄数
    },
    nextTaskId: 100,
    nextRewardId: 100,
    nextMistakeId: 200,
    nextLogId: 300,
    mistakes: [],
    pointsLog: [],
    logs: [],
    taskLog: [],
    cloudSync: { enabled: false, lastSyncTime: null, openid: '', bindCode: '', parentOpenid: '' },

    // === 新增字段 ===
    userMode: 'student',          // 'student' | 'parent'
    wrongBook: [],                // [{ id, content, type, difficulty, options, answer, analysis, examPoint, subject, knowledge, addedTime }]
    aiRecords: [],                // [{ time, subject, knowledge, difficulty, type, textbook, preference, totalCount, correctCount }]
    dailyMetrics: {},             // { "YYYY-MM-DD": { active, checkedIn } } DECR 北极星指标
    contracts: [],                // [{ id, title, condition, reward, status, progress, childSigned, createdAt }]
    pendingRedeems: []            // [{ id, rewardId, rewardName, cost, status, createdAt, approvedAt }]
  };
}

// ===== 读写 =====

function getAppData() {
  const raw = wx.getStorageSync(getStorageKey());
  if (!raw) {
    const data = initData();
    saveAppData(data);
    return data;
  }
  // 兼容旧数据格式：补齐可能缺失的字段
  if (!raw.checkins) raw.checkins = {};
  if (!raw.categoryStats) raw.categoryStats = { 语文: 0, 数学: 0, 英语: 0, 综合: 0, 运动: 0, 生活: 0 };
  if (!raw.user) {
    raw.user = initData().user;
  } else {
    if (raw.user.earnedBadges === undefined) raw.user.earnedBadges = [];
    if (raw.user.totalStarsEarned === undefined) raw.user.totalStarsEarned = 0;
    if (raw.user.stars === undefined) raw.user.stars = 0;
    if (raw.user.streak === undefined) raw.user.streak = 0;
    if (raw.user.totalCheckins === undefined) raw.user.totalCheckins = 0;
    if (raw.user.longestStreak === undefined) raw.user.longestStreak = 0;
    if (raw.user.parentPassword === undefined) raw.user.parentPassword = '1234';
    if (raw.user.isParentUnlocked === undefined) raw.user.isParentUnlocked = false;
    if (!raw.user.reminder) raw.user.reminder = { enabled: false, hour: 19, minute: 30, lastRemindedDate: null };
  }
  // 给已有奖励补 imageBase64 字段
  if (raw.rewards) {
    raw.rewards.forEach(r => { if (r.imageBase64 === undefined) r.imageBase64 = ''; });
  }
  if (!raw.mistakes) raw.mistakes = [];
  if (!raw.pointsLog) raw.pointsLog = [];
  if (!raw.logs) raw.logs = [];
  if (!raw.taskLog) raw.taskLog = [];
  if (!raw.cloudSync) raw.cloudSync = { enabled: false, lastSyncTime: null, openid: '', bindCode: '', parentOpenid: '' };
  if (!raw.nextMistakeId) raw.nextMistakeId = 200;
  if (!raw.nextLogId) raw.nextLogId = 300;
  if (!raw.nextTaskId) raw.nextTaskId = 100;
  if (!raw.nextRewardId) raw.nextRewardId = 100;
  return raw;
}

function saveAppData(data) {
  wx.setStorageSync(getStorageKey(), data);
  // 触发防抖自动同步
  triggerAutoSync();
}

// ===== 打卡相关 =====

/** 切换任务打卡状态，返回更新后的数据 */
function toggleTask(taskId) {
  const data = getAppData();
  const today = getTodayStr();
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return null;

  if (!data.checkins[today]) {
    data.checkins[today] = [];
  }

  const idx = data.checkins[today].indexOf(taskId);
  if (idx > -1) {
    // 取消打卡
    data.checkins[today].splice(idx, 1);
    data.user.stars = Math.max(0, data.user.stars - task.points);
    data.user.totalStarsEarned = Math.max(0, data.user.totalStarsEarned - task.points);
    addPointsLog(data, 'spend', task.points, '取消「' + task.name + '」', task.id);
    addLog(data.logs, 'uncheck', '取消「' + task.name + '」', -task.points);
    if (data.categoryStats[task.category] !== undefined) {
      data.categoryStats[task.category] = Math.max(0, data.categoryStats[task.category] - 1);
    }

    // 如果这是今日最后一个任务，更新连续天数和总打卡天数
    if (data.checkins[today].length === 0) {
      data.user.totalCheckins = Math.max(0, data.user.totalCheckins - 1);
      const yesterday = getYesterdayStr();
      if (data.checkins[yesterday] && data.checkins[yesterday].length > 0) {
        data.user.streak = Math.max(0, data.user.streak - 1);
      } else {
        data.user.streak = 0;
      }
    }
  } else {
    // 完成打卡
    data.checkins[today].push(taskId);
    data.user.stars += task.points;
    data.user.totalStarsEarned += task.points;
    addPointsLog(data, 'earn', task.points, '完成「' + task.name + '」', task.id);
    addLog(data.logs, 'checkin', '完成「' + task.name + '」', task.points);
    if (data.categoryStats[task.category] !== undefined) {
      data.categoryStats[task.category] += 1;
    }

    const yesterday = getYesterdayStr();
    const hadYesterday = data.checkins[yesterday] && data.checkins[yesterday].length > 0;

    if (data.checkins[today].length === 1) {
      // 今日首次打卡
      data.user.streak = hadYesterday ? data.user.streak + 1 : 1;
      data.user.totalCheckins += 1;
    }

    // 更新最长连续
    if (data.user.streak > data.user.longestStreak) {
      data.user.longestStreak = data.user.streak;
    }
  }

  data.user.lastCheckinDate = today;
  saveAppData(data);
  return data;
}

/** 检查并颁发新徽章，返回新获得的徽章列表 */
function checkBadges() {
  const data = getAppData();
  const earned = data.user.earnedBadges || [];
  const newBadges = [];

  BADGE_DEFS.forEach(bd => {
    if (!earned.includes(bd.key) && bd.check(data)) {
      earned.push(bd.key);
      newBadges.push({ key: bd.key, name: bd.name });
    }
  });

  if (newBadges.length > 0) {
    data.user.earnedBadges = earned;
    saveAppData(data);
  }

  return newBadges;
}

/** 获取已获得的徽章详情列表 */
function getEarnedBadges() {
  const data = getAppData();
  const earned = data.user.earnedBadges || [];
  return BADGE_DEFS.filter(b => earned.includes(b.key)).map(b => ({
    key: b.key, name: b.name, desc: b.desc
  }));
}

/** 获取今日已完成任务ID列表 */
function getTodayCheckins() {
  const data = getAppData();
  const today = getTodayStr();
  return data.checkins[today] || [];
}

/** 火焰降温4级机制: 断1天→微弱, 断2天→余烬, 断3天→熄灭 */
function updateFlameState(data) {
  var today = getTodayStr();
  var yesterday = getYesterdayStr();
  var hasToday = !!(data.checkins[today] && data.checkins[today].length > 0);
  var hasYesterday = !!(data.checkins[yesterday] && data.checkins[yesterday].length > 0);

  // 每月1日重置守护卡
  resetMonthlyGuardianCards(data);

  if (hasToday && hasYesterday) {
    // 连续打卡: 升级火焰
    data.user.flameStreak = data.user.streak;
    if (data.user.streak >= 3) data.user.flameState = 'burning';
    else if (data.user.streak >= 1) data.user.flameState = 'burning';
  } else if (hasToday && !hasYesterday) {
    // 今天打卡了但昨天没打: 恢复中
    data.user.flameStreak = data.user.streak;
    if (data.user.flameState === 'embers') data.user.flameState = 'weakening';
    else if (data.user.flameState === 'extinguished') data.user.flameState = 'weakening';
  } else if (!hasToday && hasYesterday) {
    // 今天还没打但昨天打了: 暂不降级
  } else if (!hasToday && !hasYesterday) {
    // 连续两天没打卡: 降级
    if (data.user.flameState === 'burning') data.user.flameState = 'weakening';
    else if (data.user.flameState === 'weakening') data.user.flameState = 'embers';
    else if (data.user.flameState === 'embers') {
      data.user.flameState = 'extinguished';
      data.user.streak = 0;
      data.user.flameStreak = 0;
    }
  }
}

/** 使用守护卡：补签昨天，恢复火焰 */
function useGuardianCard(data) {
  if (!data) data = getAppData();
  var yesterday = getYesterdayStr();

  if (data.user.guardianCards <= 0) return { success: false, msg: '守护卡不足' };
  if (data.user.flameState === 'extinguished') return { success: false, msg: '火焰已熄，无法使用守护卡' };
  if (data.user.flameState === 'burning') return { success: false, msg: '火焰正旺，无需使用守护卡' };

  // 消耗守护卡
  data.user.guardianCards--;
  // 补签昨天（补一个虚拟打卡记录）
  if (!data.checkins[yesterday]) data.checkins[yesterday] = [];
  if (data.checkins[yesterday].indexOf('_guardian') < 0) {
    data.checkins[yesterday].push('_guardian');
  }
  // 恢复火焰
  data.user.flameState = 'burning';
  data.user.streak = Math.max(data.user.streak, 1);
  data.user.flameStreak = data.user.streak;
  data.user.lastCheckinDate = getTodayStr();

  saveAppData(data);
  return { success: true, remaining: data.user.guardianCards };
}

/** 积分购买守护卡 */
function buyGuardianCard(data, cost) {
  if (!data) data = getAppData();
  cost = cost || 50;
  if (data.user.stars < cost) return { success: false, msg: '积分不足' };
  if (data.user.guardianCards >= data.user.guardianCardsMax) return { success: false, msg: '已达上限' };

  data.user.stars -= cost;
  data.user.guardianCards++;
  data.user.totalStarsEarned -= cost;
  addPointsLog(data, 'spend', cost, '购买火焰守护卡');
  saveAppData(data);
  return { success: true, remaining: data.user.guardianCards };
}

/** 积分衰减检查：连续7天未使用积分，每日衰减2% */
function applyPointsDecay(data) {
  var today = getTodayStr();
  if (!data.user.lastPointsUseDate) data.user.lastPointsUseDate = today;

  var lastUse = new Date(data.user.lastPointsUseDate);
  var now = new Date();
  var daysSince = Math.floor((now - lastUse) / (1000 * 60 * 60 * 24));

  if (daysSince > 7 && data.user.stars > 0) {
    var daysDecay = daysSince - 7;
    var decayRate = Math.pow(0.98, daysDecay);
    var newStars = Math.floor(data.user.stars * decayRate);
    if (newStars < data.user.stars) {
      var lost = data.user.stars - newStars;
      data.user.stars = Math.max(newStars, 10);
      addPointsLog(data, 'spend', lost, '积分衰减（' + daysSince + '天未使用）');
    }
  }
  data.user.lastPointsUseDate = today;
}

/** 限时双倍积分：周末双倍 */
function getPointMultiplier() {
  var day = new Date().getDay();
  return (day === 0 || day === 6) ? 2 : 1;  // 周末双倍
}

/** 每月重置守护卡 */
function resetMonthlyGuardianCards(data) {
  var now = new Date();
  var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  if (data.user.lastGuardianReset !== monthKey) {
    data.user.guardianCards = Math.min(data.user.guardianCards + 2, data.user.guardianCardsMax);
    data.user.lastGuardianReset = monthKey;
  }
}

/** 跨天校验：进入首页时调用 */
function validateStreak() {
  var data = getAppData();
  updateFlameState(data);
  applyPointsDecay(data);
  saveAppData(data);
  return data;
}

/** DECR 埋点: 记录每日活跃/打卡状态 */
function trackDailyMetric(action) {
  var today = getTodayStr();
  var data = getAppData();
  if (!data.dailyMetrics) data.dailyMetrics = {};
  if (!data.dailyMetrics[today]) {
    data.dailyMetrics[today] = { active: false, checkedIn: false };
  }
  if (action === 'active') data.dailyMetrics[today].active = true;
  if (action === 'checkin') data.dailyMetrics[today].checkedIn = true;
  // 保留最近 60 天
  var keys = Object.keys(data.dailyMetrics).sort();
  while (keys.length > 60) {
    delete data.dailyMetrics[keys.shift()];
  }
  saveAppData(data);
}

// ===== 亲子契约 =====

var CONTRACT_TEMPLATES = [
  { id: 'streak_7',  title: '连续 7 天打卡',   condition: { type: 'streak', value: 7 },  desc: '坚持每日打卡 7 天，养成好习惯' },
  { id: 'streak_14', title: '连续 14 天打卡',  condition: { type: 'streak', value: 14 }, desc: '坚持每日打卡两周，挑战升级' },
  { id: 'streak_30', title: '连续 30 天打卡',  condition: { type: 'streak', value: 30 }, desc: '月度打卡冠军，超级自律达人' },
  { id: 'weekly_math', title: '本周数学打卡 5 次', condition: { type: 'subject_count', subject: '数学', value: 5 }, desc: '数学专项强化' },
  { id: 'points_100', title: '累计获得 100⭐',   condition: { type: 'total_stars', value: 100 }, desc: '积分达人计划' }
];

/** 创建契约 */
function addContract(templateId, rewardName) {
  var data = getAppData();
  var tpl = CONTRACT_TEMPLATES.find(function(t) { return t.id === templateId; });
  if (!tpl) return { success: false, msg: '模板不存在' };

  var contract = {
    id: 'c_' + String(data.nextLogId++),
    title: tpl.title,
    condition: tpl.condition,
    reward: { name: rewardName || '自定义奖励' },
    status: 'pending',  // pending|active|completed|rejected
    progress: { current: 0, target: tpl.condition.value },
    childSigned: false,
    createdBy: 'parent',
    createdAt: new Date().toISOString().substring(0, 10)
  };
  data.contracts.push(contract);
  saveAppData(data);
  return { success: true, contract: contract };
}

/** 孩子签署契约 */
function signContract(contractId) {
  var data = getAppData();
  var c = data.contracts.find(function(x) { return x.id === contractId; });
  if (!c) return { success: false, msg: '契约不存在' };
  if (c.childSigned) return { success: false, msg: '已签署' };
  c.childSigned = true;
  c.status = 'active';
  saveAppData(data);
  return { success: true };
}

/** 拒绝契约 */
function rejectContract(contractId) {
  var data = getAppData();
  var c = data.contracts.find(function(x) { return x.id === contractId; });
  if (!c) return { success: false, msg: '契约不存在' };
  c.status = 'rejected';
  saveAppData(data);
  return { success: true };
}

/** 更新契约进度（每次打卡后调用） */
function updateContractProgress() {
  var data = getAppData();
  var changed = false;
  for (var i = 0; i < data.contracts.length; i++) {
    var c = data.contracts[i];
    if (c.status !== 'active') continue;

    if (c.condition.type === 'streak') {
      c.progress.current = Math.max(c.progress.current, data.user.streak);
    } else if (c.condition.type === 'subject_count') {
      var subj = c.condition.subject;
      c.progress.current = data.categoryStats[subj] || 0;
    } else if (c.condition.type === 'total_stars') {
      c.progress.current = data.user.totalStarsEarned;
    }

    // 达标自动完成
    if (c.progress.current >= c.progress.target) {
      c.progress.current = Math.min(c.progress.current, c.progress.target);
      c.status = 'completed';
    }
    changed = true;
  }
  if (changed) saveAppData(data);
  return data.contracts;
}

/** 获取活跃契约 */
function getActiveContracts() {
  return getAppData().contracts.filter(function(c) {
    return c.status === 'active' || c.status === 'pending';
  });
}

// ===== 任务管理 =====

function getTasks() {
  return getAppData().tasks;
}

const SUBJECT_MAP = { '语文': 'chinese', '数学': 'math', '英语': 'english' };

function addCustomTask(name, icon, points, category, taskType, linkSubject) {
  const data = getAppData();
  const task = {
    id: data.nextTaskId++,
    name,
    icon: icon || '📌',
    points: points || 10,
    category: category || '综合',
    linkPractice: null
  };
  // 练习类任务自动设置 linkPractice
  if (taskType === 'practice' && linkSubject && SUBJECT_MAP[linkSubject]) {
    task.linkPractice = { subject: SUBJECT_MAP[linkSubject], grades: [6] };
    task.category = linkSubject;
  }
  data.tasks.push(task);
  addLog(data.taskLog, 'task_add', '添加任务「' + name + '」', points);
  saveAppData(data);
  return task;
}

function resetTasks() {
  const data = getAppData();
  data.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
  addLog(data.taskLog, 'task_reset', '恢复默认任务');
  saveAppData(data);
}

// ===== 奖励管理 =====

function getRewards() {
  return getAppData().rewards;
}

/** 兑换奖励，返回成功/失败 */
function redeemReward(rewardId) {
  const data = getAppData();
  const reward = data.rewards.find(r => r.id === rewardId);
  if (!reward) return { success: false, msg: '奖励不存在' };
  if (data.user.stars < reward.cost) return { success: false, msg: '积分不足' };

  data.user.stars -= reward.cost;
  addPointsLog(data, 'spend', reward.cost, '兑换' + reward.name, reward.id);
  addLog(data.logs, 'redeem', '兑换「' + reward.name + '」', -reward.cost);
  saveAppData(data);
  return { success: true, msg: `兑换成功！已扣除 ${reward.cost} 积分` };
}

/** 提交兑换申请（需家长确认） */
function requestRedeem(rewardId) {
  var data = getAppData();
  var reward = data.rewards.find(function(r) { return r.id === rewardId; });
  if (!reward) return { success: false, msg: '奖励不存在' };
  if (data.user.stars < reward.cost) return { success: false, msg: '积分不足' };

  // 冻结积分
  data.user.stars -= reward.cost;
  var redeemId = 'r_' + String(data.nextLogId++);
  data.pendingRedeems = data.pendingRedeems || [];
  data.pendingRedeems.push({
    id: redeemId,
    rewardId: reward.id,
    rewardName: reward.name,
    cost: reward.cost,
    status: 'pending',  // pending|approved|rejected
    createdAt: new Date().toISOString()
  });
  addPointsLog(data, 'spend', reward.cost, '申请兑换「' + reward.name + '」（待家长确认）', reward.id);
  saveAppData(data);
  return { success: true, msg: '已提交兑换申请，等待家长确认', redeemId: redeemId };
}

/** 家长确认兑现 */
function approveRedeem(redeemId) {
  var data = getAppData();
  var pr = (data.pendingRedeems || []).find(function(r) { return r.id === redeemId; });
  if (!pr) return { success: false, msg: '申请不存在' };
  if (pr.status !== 'pending') return { success: false, msg: '该申请已处理' };
  pr.status = 'approved';
  pr.approvedAt = new Date().toISOString();
  addLog(data.logs, 'redeem_approved', '家长确认兑现「' + pr.rewardName + '」', 0);
  saveAppData(data);
  return { success: true, msg: '已确认兑现！' };
}

/** 家长拒绝兑现 */
function rejectRedeem(redeemId) {
  var data = getAppData();
  var pr = (data.pendingRedeems || []).find(function(r) { return r.id === redeemId; });
  if (!pr) return { success: false, msg: '申请不存在' };
  if (pr.status !== 'pending') return { success: false, msg: '该申请已处理' };
  pr.status = 'rejected';
  // 退分
  data.user.stars += pr.cost;
  addPointsLog(data, 'earn', pr.cost, '兑换「' + pr.rewardName + '」被拒绝，积分退回', pr.rewardId);
  saveAppData(data);
  return { success: true, msg: '已拒绝，积分退回' };
}

function resetRewards() {
  const data = getAppData();
  data.rewards = JSON.parse(JSON.stringify(DEFAULT_REWARDS));
  addLog(data.taskLog, 'reward_reset', '恢复默认奖励');
  saveAppData(data);
}

// ===== 重置 =====

function resetAllData() {
  const data = initData();
  addLog(data.logs, 'reset_all', '重置全部数据');
  saveAppData(data);
  return data;
}

// ===== 家长模式 =====

/** 验证家长密码 */
function verifyPassword(input) {
  const data = getAppData();
  return data.user.parentPassword === input;
}

/** 修改家长密码 */
function changePassword(newPwd) {
  const data = getAppData();
  data.user.parentPassword = newPwd;
  saveAppData(data);
}

/** 设置解锁状态 */
function setParentUnlocked(val) {
  const data = getAppData();
  data.user.isParentUnlocked = val;
  saveAppData(data);
}

// ===== 任务提醒 =====

/** 保存提醒设置 */
function saveReminder(reminder) {
  const data = getAppData();
  data.user.reminder = reminder;
  saveAppData(data);
}

/** 获取提醒设置 */
function getReminder() {
  const data = getAppData();
  return data.user.reminder || { enabled: false, hour: 19, minute: 30, lastRemindedDate: null };
}

/** 检查提醒条件并返回是否需要弹窗 */
function checkReminder() {
  const data = getAppData();
  const r = data.user.reminder;
  if (!r || !r.enabled) return null;
  const now = new Date();
  const todayStr = getTodayStr();
  if (r.lastRemindedDate === todayStr) return null;
  const remindTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), r.hour, r.minute, 0);
  const diff = now - remindTime;
  if (diff >= 0 && diff < 5 * 60 * 1000) {
    data.user.reminder.lastRemindedDate = todayStr;
    saveAppData(data);
    return { hour: r.hour, minute: r.minute };
  }
  return null;
}

// ===== 奖励图片 =====

/** 添加奖励（含图片base64） */
function addRewardWithImage(name, icon, cost, imageBase64) {
  const data = getAppData();
  const reward = {
    id: data.nextRewardId++,
    name,
    icon: icon || '🎁',
    cost: cost || 10,
    imageBase64: imageBase64 || ''
  };
  data.rewards.push(reward);
  saveAppData(data);
  return reward;
}

// ===== 积分日志 =====

/** 添加积分日志（调用方需自行 saveAppData，避免重复写入覆盖） */
function addPointsLog(data, type, amount, description, relatedId) {
  data.pointsLog.unshift({
    id: data.nextLogId++,
    type,
    amount,
    description,
    time: new Date().toISOString(),
    relatedId: relatedId || null
  });
}

/** 获取积分日志 */
function getPointsLog() {
  return getAppData().pointsLog;
}

// ===== 操作日志 =====

/** 添加操作日志（自动保留最近500条） */
function addLog(logs, type, desc, points) {
  logs.push({ time: new Date().toISOString(), type, desc, points: points || 0 });
  if (logs.length > 500) logs.splice(0, logs.length - 500);
}

// ===== 练习关联打卡 =====

const SUBJECT_TASK_MAP = { '数学': 2, '语文': 1, '英语': 3 };

/** 内部共用：执行一次打卡的所有数据更新（不校验是否已打卡） */
function _doAutoCheckin(taskId) {
  var data = getAppData();
  var today = getTodayStr();
  if (!data.checkins[today]) data.checkins[today] = [];
  if (data.checkins[today].indexOf(taskId) !== -1) return;
  var task = data.tasks.find(function(t) { return t.id === taskId; });
  if (!task) return;

  data.checkins[today].push(taskId);
  data.user.stars += task.points;
  data.user.totalStarsEarned += task.points;
  if (data.categoryStats[task.category] !== undefined) {
    data.categoryStats[task.category] += 1;
  }
  var yesterday = getYesterdayStr();
  var hadYesterday = !!(data.checkins[yesterday] && data.checkins[yesterday].length > 0);
  if (data.checkins[today].length === 1) {
    data.user.streak = hadYesterday ? data.user.streak + 1 : 1;
    data.user.totalCheckins += 1;
  }
  if (data.user.streak > data.user.longestStreak) {
    data.user.longestStreak = data.user.streak;
  }
  data.user.lastCheckinDate = today;
  addPointsLog(data, 'earn', task.points, '完成练习任务：' + task.name, task.id);
  saveAppData(data);
}

/** 任务跳转练习完成后，自动完成指定任务 */
function autoCompleteTask(taskId) {
  _doAutoCheckin(taskId);
}

/** 练习完成后自动关联今日打卡：找到对应学科第一个未完成的任务并自动完成 */
function autoCheckinPractice(subject) {
  var taskId = SUBJECT_TASK_MAP[subject];
  if (!taskId) return;
  _doAutoCheckin(taskId);
}

// ===== 错题本 =====

/** 添加错题记录 */
function addMistake(taskId, subject, imageBase64, note) {
  const data = getAppData();
  const mistake = {
    id: data.nextMistakeId++,
    taskId,
    subject: subject || '综合',
    imageBase64: imageBase64 || '',
    note: note || '',
    date: getTodayStr(),
    reviewed: false
  };
  data.mistakes.push(mistake);
  saveAppData(data);
  return mistake;
}

/** 获取错题列表，可选按学科筛选 */
function getMistakes(subject) {
  const data = getAppData();
  let list = data.mistakes;
  if (subject && subject !== '全部') {
    list = list.filter(m => m.subject === subject);
  }
  return list;
}

/** 删除错题 */
function deleteMistake(id) {
  const data = getAppData();
  data.mistakes = data.mistakes.filter(m => m.id !== id);
  saveAppData(data);
}

/** 标记错题已复习 */
function markMistakeReviewed(id) {
  const data = getAppData();
  const m = data.mistakes.find(x => x.id === id);
  if (m) {
    m.reviewed = true;
    saveAppData(data);
  }
}

/** 获取待复习错题（随机3条） */
function getReviewMistakes() {
  const data = getAppData();
  const unreviewed = data.mistakes.filter(m => !m.reviewed);
  const shuffled = unreviewed.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// ===== 错题本 & AI记录 =====

/** 添加错题（按内容去重） */
function addWrongQuestion(appData, question) {
  var exists = appData.wrongBook.some(function(item) { return item.content === question.content; });
  if (!exists) {
    appData.wrongBook.push({
      id: Date.now(),
      content: question.content,
      type: question.type,
      difficulty: question.difficulty,
      options: question.options || [],
      answer: question.answer,
      analysis: question.analysis,
      examPoint: question.examPoint,
      subject: question.subject,
      knowledge: question.knowledge,
      addedTime: new Date().toISOString()
    });
  }
}

/** 删除错题 */
function removeWrongQuestion(appData, id) {
  appData.wrongBook = appData.wrongBook.filter(function(item) { return item.id !== id; });
}

/** 添加AI练习记录 */
function addAIRecord(appData, record) {
  appData.aiRecords.push({
    time: new Date().toISOString(),
    subject: record.subject,
    knowledge: record.knowledge,
    difficulty: record.difficulty,
    type: record.type,
    textbook: record.textbook,
    preference: record.preference,
    totalCount: record.totalCount,
    correctCount: record.correctCount
  });
  if (appData.aiRecords.length > 100) {
    appData.aiRecords = appData.aiRecords.slice(-100);
  }
}

/** 获取用户模式 */
function getUserMode() {
  return getAppData().userMode || 'student';
}

/** 设置用户模式 */
function setUserMode(mode) {
  var data = getAppData();
  data.userMode = mode;
  saveAppData(data);
}

/** 判断是否为家长模式 */
function isParentMode() {
  return getUserMode() === 'parent';
}

// ===== 云同步 =====

/** 获取可用于同步的完整数据 */
function getSyncData() {
  const data = getAppData();
  data._version = Date.now();
  return data;
}

/** 保存云同步设置 */
function saveCloudSync(config) {
  const data = getAppData();
  data.cloudSync = config;
  saveAppData(data);
}

/** 获取错题数量（用于首页显示） */
function getMistakeCount() {
  return getAppData().mistakes.length;
}

/** 获取今日是否有错题记录 */
function getTodayHasMistakes() {
  const today = getTodayStr();
  return getAppData().mistakes.some(m => m.date === today);
}

// ===== 开发工具 =====

function addStars(amount) {
  const data = getAppData();
  data.user.stars += amount;
  data.user.totalStarsEarned += amount;
  addLog(data.logs, 'stars_test', '加星测试+' + amount, amount);
  saveAppData(data);
  return data;
}

module.exports = {
  getAppData,
  saveAppData,
  toggleTask,
  checkBadges,
  getEarnedBadges,
  getTodayCheckins,
  validateStreak,
  getTasks,
  addCustomTask,
  resetTasks,
  getRewards,
  redeemReward,
  requestRedeem,
  approveRedeem,
  rejectRedeem,
  resetRewards,
  resetAllData,
  addStars,
  // 家长模式
  verifyPassword,
  changePassword,
  setParentUnlocked,
  // 任务提醒
  saveReminder,
  getReminder,
  checkReminder,
  // 奖励图片
  addRewardWithImage,
  // 积分日志
  addPointsLog,
  getPointsLog,
  // 操作日志
  addLog,
  // 练习关联打卡
  autoCompleteTask,
  autoCheckinPractice,
  // 错题本
  addMistake,
  getMistakes,
  deleteMistake,
  markMistakeReviewed,
  getReviewMistakes,
  getMistakeCount,
  getTodayHasMistakes,
  // 云同步
  getSyncData,
  saveCloudSync,
  // 默认数据
  DEFAULT_TASKS,
  DEFAULT_REWARDS,
  BADGE_DEFS,
  // 错题本 & AI 记录
  addWrongQuestion,
  removeWrongQuestion,
  addAIRecord,
  getUserMode,
  setUserMode,
  isParentMode,
  // 多孩账号
  getChildrenList,
  saveChildrenList,
  getCurrentChildId,
  switchChild,
  // 云缓存
  setCloudCache,
  getCloudCache,
  // 火焰降温 & 守护卡
  useGuardianCard,
  buyGuardianCard,
  updateFlameState,
  getPointMultiplier,
  // DECR 埋点
  trackDailyMetric,
  // 亲子契约
  CONTRACT_TEMPLATES,
  addContract,
  signContract,
  rejectContract,
  updateContractProgress,
  getActiveContracts
};
