/**
 * getStats 云函数
 *
 * 聚合统计数据：学科正确率、难度正确率、高频错题、知识点热力图、使用趋势。
 * 默认从 daily_stats 预聚合表读取（每天凌晨更新），也可实时统计。
 *
 * 入参: { timeRange: 'last7days'|'last30days'|'all', realtime: boolean }
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;

var COLL_Q = 'exam_questions';
var COLL_R = 'exam_practice_records';
var COLL_S = 'daily_stats';

// ====== 预聚合查询（默认） ======
async function getCachedStats(timeRange) {
  try {
    var key = timeRange || 'last30days';
    var res = await db.collection(COLL_S).where({ type: 'stats_summary', period: key }).orderBy('date', 'desc').limit(1).get();
    if (res.data && res.data.length > 0) {
      return Object.assign({}, res.data[0].data || {}, { fromCache: true });
    }
  } catch (e) {
    /* 预聚合表不存在或为空 */
  }
  return null;
}

// ====== 实时聚合 ======
async function getRealtimeStats(timeRange) {
  var stats = {};

  // 1. 学科正确率
  var qStats = await db.collection(COLL_Q)
    .aggregate()
    .match({ isLatest: true, usageCount: _.gt(0) })
    .group({
      _id: '$subject',
      totalUsage: _.sum('$usageCount'),
      totalCorrect: _.sum('$correctCount')
    })
    .end();

  stats.subjectAccuracy = (qStats.list || []).map(function(item) {
    var rate = item.totalUsage > 0 ? Math.round(item.totalCorrect / item.totalUsage * 100) : 0;
    return { subject: item._id, accuracy: rate, totalUsage: item.totalUsage };
  });

  // 2. 难度正确率
  var dStats = await db.collection(COLL_Q)
    .aggregate()
    .match({ isLatest: true, usageCount: _.gt(0) })
    .group({
      _id: '$difficulty',
      totalUsage: _.sum('$usageCount'),
      totalCorrect: _.sum('$correctCount')
    })
    .end();

  stats.difficultyAccuracy = (dStats.list || []).map(function(item) {
    var rate = item.totalUsage > 0 ? Math.round(item.totalCorrect / item.totalUsage * 100) : 0;
    return { difficulty: item._id, accuracy: rate };
  });

  // 3. 高频错题 TOP10
  var topMistakes = await db.collection(COLL_Q)
    .aggregate()
    .match({ isLatest: true, usageCount: _.gt(0) })
    .project({
      stem: 1, subject: 1, grade: 1, type: 1,
      usageCount: 1, correctCount: 1,
      errorRate: _.subtract([1, _.divide(['$correctCount', '$usageCount'])])
    })
    .sort({ errorRate: -1 })
    .limit(10)
    .end();

  stats.topMistakes = (topMistakes.list || []).map(function(q) {
    return {
      stem: (q.stem || '').substring(0, 60),
      subject: q.subject,
      grade: q.grade,
      type: q.type,
      usageCount: q.usageCount,
      errorCount: q.usageCount - (q.correctCount || 0),
      errorRate: Math.round((1 - (q.correctCount || 0) / q.usageCount) * 100)
    };
  });

  // 4. 知识点错题分布
  var kpStats = await db.collection(COLL_Q)
    .aggregate()
    .match({ isLatest: true, usageCount: _.gt(0) })
    .unwind('$knowledgePoints')
    .group({
      _id: { subject: '$subject', knowledgePoint: '$knowledgePoints' },
      totalUsage: _.sum('$usageCount'),
      totalCorrect: _.sum('$correctCount')
    })
    .sort({ totalUsage: -1 })
    .limit(30)
    .end();

  var kpMap = {};
  (kpStats.list || []).forEach(function(item) {
    var subj = item._id.subject;
    if (!kpMap[subj]) kpMap[subj] = [];
    var errRate = item.totalUsage > 0 ? Math.round((1 - item.totalCorrect / item.totalUsage) * 100) : 0;
    kpMap[subj].push({
      knowledgePoint: item._id.knowledgePoint,
      errorRate: errRate,
      totalUsage: item.totalUsage
    });
  });
  stats.knowledgePointErrors = kpMap;

  // 5. 题目使用趋势（近30天按 createAt 聚合）
  var thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  var trend = await db.collection(COLL_Q)
    .aggregate()
    .match({ createdAt: _.gte(thirtyDaysAgo), usageCount: _.gt(0) })
    .group({
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+08:00' } },
      count: _.sum(1),
      avgUsage: _.avg('$usageCount')
    })
    .sort({ _id: 1 })
    .end();

  stats.usageTrend = (trend.list || []).map(function(item) {
    return { date: item._id, count: item.count, avgUsage: Math.round(item.avgUsage || 0) };
  });

  return Object.assign(stats, { fromCache: false });
}

// ====== 主入口 ======
exports.main = async function(event) {
  var timeRange = event.timeRange || 'last30days';
  var realtime = event.realtime === true;

  try {
    // 优先读预聚合
    if (!realtime) {
      var cached = await getCachedStats(timeRange);
      if (cached) return { success: true, data: cached };
    }

    // 实时聚合
    var stats = await getRealtimeStats(timeRange);
    return { success: true, data: stats };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
