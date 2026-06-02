/**
 * manageQuestions 云函数 — 题库管理 API
 *
 * action:
 *   search          - 多条件筛选 + 游标分页查询
 *   batchUpdate     - 批量更新题目字段
 *   export          - 按筛选条件导出为云存储 JSONL
 *   knowledgeCompletions - 返回已有知识点列表（自动补全用）
 *
 * 安全：每个写操作内部调用 authAdmin 鉴权
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;

var COLL = 'exam_questions';
var DEFAULT_PAGE_SIZE = 20;

// ====== 内部鉴权 ======
async function requireAdmin(minRole) {
  var openid = cloud.getWXContext().OPENID;
  try {
    var doc = await db.collection('admins').doc(openid).get();
    if (!doc.data) throw new Error('非管理员');
    if (minRole === 'superadmin' && doc.data.role !== 'superadmin') {
      throw new Error('仅超级管理员可执行此操作');
    }
    return { openid: openid, role: doc.data.role, name: doc.data.name || '' };
  } catch (e) {
    throw new Error('权限不足: ' + (e.message || '非管理员'));
  }
}

// ====== 构建筛选条件 ======
function buildWhere(event) {
  var where = {};
  if (event.subject) where.subject = event.subject;
  if (event.grade) where.grade = event.grade;
  if (event.type) where.type = event.type;
  if (event.difficulty) where.difficulty = event.difficulty;
  if (event.status) where.status = event.status;

  // 知识点评分搜索
  if (event.knowledgePoint) {
    where.knowledgePoints = _.in([event.knowledgePoint]);
  }

  // 题干关键词搜索
  if (event.keyword) {
    where.stem = db.RegExp({ regexp: event.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' });
  }

  // 默认排除归档
  if (!event.status) {
    where.status = _.neq('archived');
  }

  // 只查最新版本
  where.isLatest = true;

  return where;
}

// ====== action: search ======
async function doSearch(event) {
  var pageSize = Math.min(event.pageSize || DEFAULT_PAGE_SIZE, 50);
  var where = buildWhere(event);

  var query = db.collection(COLL)
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(pageSize + 1);

  // startAfter 游标分页
  if (event.cursor) {
    var cursorObj = {};
    try { cursorObj = JSON.parse(event.cursor); } catch (e) {}
    if (cursorObj._id) query = query.where(Object.assign({}, where, { _id: _.lt(cursorObj._id) }));
  }

  var res = await query.get();
  var hasMore = res.data.length > pageSize;
  var list = hasMore ? res.data.slice(0, pageSize) : res.data;

  // 精简返回字段
  list = list.map(function(q) {
    return {
      _id: q._id,
      questionId: q.questionId,
      subject: q.subject,
      grade: q.grade,
      type: q.type,
      difficulty: q.difficulty,
      status: q.status || 'active',
      stem: (q.stem || '').substring(0, 100),
      knowledgePoints: (q.knowledgePoints || []).slice(0, 5),
      usageCount: q.usageCount || 0,
      correctCount: q.correctCount || 0,
      createdAt: q.createdAt,
      versionNumber: q.versionNumber || 1
    };
  });

  // 总数统计（仅第一页查询，昂贵操作）
  var total = -1;
  if (!event.cursor) {
    try {
      var countRes = await db.collection(COLL).where(where).count();
      total = countRes.total;
    } catch (e) { /* 忽略计数错误 */ }
  }

  return {
    success: true,
    list: list,
    total: total,
    hasMore: hasMore,
    nextCursor: hasMore ? JSON.stringify({ _id: list[list.length - 1]._id }) : null
  };
}

// ====== action: batchUpdate ======
async function doBatchUpdate(event) {
  await requireAdmin('operator');

  var questionIds = event.questionIds || [];
  var updates = event.updates || {};
  if (!questionIds.length || !Object.keys(updates).length) {
    return { success: false, error: 'questionIds 和 updates 为必填项' };
  }

  var allowedFields = ['status', 'difficulty', 'type', 'knowledgePoints'];
  var safeUpdates = {};
  for (var k in updates) {
    if (updates.hasOwnProperty(k) && allowedFields.indexOf(k) >= 0) {
      safeUpdates[k] = updates[k];
    }
  }
  safeUpdates.updatedAt = db.serverDate();

  var coll = db.collection(COLL);
  var updated = 0;
  var errors = [];

  for (var i = 0; i < questionIds.length; i += 50) {
    var batch = questionIds.slice(i, i + 50);
    var tasks = batch.map(function(id) {
      return coll.doc(id).update({ data: safeUpdates }).then(
        function() { updated++; },
        function(e) { errors.push({ id: id, error: e.message }); }
      );
    });
    await Promise.all(tasks);
  }

  // 写操作日志
  try {
    await db.collection('admin_logs').add({
      data: {
        operatorOpenId: cloud.getWXContext().OPENID,
        action: 'batchUpdate',
        targetType: 'question',
        targetIds: questionIds.slice(0, 100),
        details: safeUpdates,
        timestamp: db.serverDate()
      }
    });
  } catch (e) { /* 日志写入失败不阻塞主流程 */ }

  return { success: true, updated: updated, errors: errors.slice(0, 10) };
}

// ====== action: export ======
async function doExport(event) {
  await requireAdmin('operator');

  var where = buildWhere(event);
  var maxCount = Math.min(event.maxCount || 500, 1000);
  var all = [];

  // 分批读取
  var cursor = null;
  while (all.length < maxCount) {
    var q = db.collection(COLL).where(where).orderBy('_id', 'asc').limit(100);
    if (cursor) q = q.where(Object.assign({}, where, { _id: _.gt(cursor) }));
    var res = await q.get();
    if (!res.data || res.data.length === 0) break;
    all = all.concat(res.data);
    cursor = res.data[res.data.length - 1]._id;
    if (res.data.length < 100) break;
  }

  // 写入云存储
  var jsonlContent = all.map(function(q) {
    return JSON.stringify({
      questionId: q.questionId,
      subject: q.subject,
      grade: q.grade,
      type: q.type,
      difficulty: q.difficulty,
      knowledgePoints: q.knowledgePoints,
      stem: q.stem,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      examPoint: q.examPoint,
      paperSource: q.paperSource,
      status: q.status
    });
  }).join('\n') + '\n';

  var fileName = 'export_' + (event.subject || 'all') + '_' + (event.grade || 'all') + '_' + Date.now() + '.jsonl';
  var uploadRes = await cloud.uploadFile({
    cloudPath: 'exports/' + fileName,
    fileContent: jsonlContent
  });

  // 写操作日志
  try {
    await db.collection('admin_logs').add({
      data: {
        operatorOpenId: cloud.getWXContext().OPENID,
        action: 'export',
        targetType: 'question',
        targetIds: [],
        details: { count: all.length, fileID: uploadRes.fileID },
        timestamp: db.serverDate()
      }
    });
  } catch (e) { /* */ }

  return { success: true, count: all.length, fileID: uploadRes.fileID, fileName: fileName };
}

// ====== action: knowledgeCompletions ======
async function doKnowledgeCompletions(event) {
  var where = buildWhere(event);
  // 聚合获取所有现有知识点
  var res = await db.collection(COLL)
    .aggregate()
    .match(where)
    .unwind('$knowledgePoints')
    .group({ _id: '$knowledgePoints', count: _.sum(1) })
    .sort({ count: -1 })
    .limit(50)
    .end();

  var completions = (res.list || []).map(function(item) {
    return { name: item._id, count: item.count };
  });

  return { success: true, completions: completions };
}

// ====== 主入口 ======
exports.main = async function(event) {
  var action = event.action || 'search';

  try {
    switch (action) {
      case 'search':
        return await doSearch(event);
      case 'batchUpdate':
        return await doBatchUpdate(event);
      case 'export':
        return await doExport(event);
      case 'knowledgeCompletions':
        return await doKnowledgeCompletions(event);
      default:
        return { success: false, error: '未知 action: ' + action };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
};
