/**
 * importQuestions 云函数 v4.0 — 性能优化版
 *
 * 策略：接受小批量 data 数组，客户端用 importHelper 自动分片调用。
 * v4 改进: 批大小 10→15, 内存 256→512MB, 细粒度计时, contentHash 预埋
 *
 * ===== 入参 =====
 *   { data: [...] }   题目数组，建议每批 50 条（客户端自动分片）
 *   { dryRun: true }  仅统计不写入
 *
 * ===== 返回 =====
 *   { success, total, inserted, updated, skipped, errors[], timing }
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;
var crypto = require('crypto');

var COLLECTION = 'exam_questions';
var BATCH = 15; // 每批并行 DB 操作数（512MB 内存下可安全提升）

// ====== 工具 ======

function md5(s) {
  return crypto.createHash('md5').update(String(s)).digest('hex');
}

var GRADE_MAP = {
  '1': '一年级', '2': '二年级', '3': '三年级',
  '4': '四年级', '5': '五年级', '6': '六年级'
};
var VALID_TYPES = [
  '填空题', '选择题', '判断题', '计算题', '简答题',
  '应用题', '作图题', '操作题', '阅读理解', '完形填空',
  '写作题', '翻译题', '连线题', '其他题'
];
var VALID_SUBJECTS = ['数学', '语文', '英语'];
var VALID_GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
var VALID_DIFF = ['基础巩固', '能力提升', '冲刺拔高'];

// ====== 规范化 ======

function normalize(raw) {
  var stem = (raw.stem || '').trim();
  if (!stem || stem.length < 3) return null;

  var subject = (raw.subject || '').replace('小学', '').trim();
  if (VALID_SUBJECTS.indexOf(subject) < 0) {
    for (var i = 0; i < VALID_SUBJECTS.length; i++) {
      if (subject.indexOf(VALID_SUBJECTS[i]) >= 0) { subject = VALID_SUBJECTS[i]; break; }
    }
    if (VALID_SUBJECTS.indexOf(subject) < 0) subject = '数学';
  }

  var grade = raw.grade || '';
  if (VALID_GRADES.indexOf(grade) < 0) {
    grade = GRADE_MAP[String(grade).replace(/[^0-9]/g, '')] || grade || '六年级';
  }

  var type = raw.type || '填空题';
  if (VALID_TYPES.indexOf(type) < 0) type = '填空题';

  var diff = raw.difficulty || '基础巩固';
  if (VALID_DIFF.indexOf(diff) < 0) diff = '基础巩固';

  var shortStem = stem.replace(/[\s\n\r\t]+/g, '').substring(0, 80);
  var questionId = raw.questionId || md5(shortStem + '|' + subject + '|' + grade);

  // contentHash: stem + options + answer + explanation 的联合哈希（用于版本控制）
  var contentHash = md5(
    stem.substring(0, 100) + '|' +
    (raw.options || []).join(',') + '|' +
    (raw.answer || '') + '|' +
    (raw.explanation || '')
  );

  return {
    questionId: questionId,
    subject: subject,
    grade: grade,
    type: type,
    difficulty: diff,
    knowledgePoints: (raw.knowledgePoints || []).slice(0, 10),
    stem: stem.substring(0, 500),
    options: (raw.options || []).slice(0, 8),
    answer: String(raw.answer || '').trim().substring(0, 500),
    explanation: String(raw.explanation || '').trim().substring(0, 1000),
    examPoint: String(raw.examPoint || '').trim().substring(0, 100),
    paperSource: String(raw.paperSource || '').substring(0, 100),
    status: 'active',
    usageCount: 0,
    correctCount: 0,
    contentHash: contentHash,
    versionNumber: 1,
    isLatest: true,
    familyId: raw.familyId || questionId
  };
}

// ====== 核心：小批量极速 upsert（含 contentHash 比对） ======

async function fastUpsert(questions, dryRun) {
  if (questions.length === 0) return { inserted: 0, updated: 0, skipped: 0, errors: [], queryMs: 0, writeMs: 0 };
  if (dryRun) return { inserted: questions.length, updated: 0, skipped: 0, errors: [], queryMs: 0, writeMs: 0 };

  var coll = db.collection(COLLECTION);
  var ids = questions.map(function(q) { return q.questionId; });
  var queryStart = Date.now();

  // Step 1: 批量查询已存在的 questionId（同时获取 contentHash 用于版本比对）
  var existingDocs = {};
  for (var i = 0; i < ids.length; i += 80) {
    var chunk = ids.slice(i, i + 80);
    var res = await coll.where({ questionId: _.in(chunk) })
      .field({ questionId: true, _id: true, contentHash: true, versionNumber: true, familyId: true })
      .limit(80)
      .get();
    if (res.data) {
      res.data.forEach(function(doc) { existingDocs[doc.questionId] = doc; });
    }
  }

  var queryMs = Date.now() - queryStart;

  // Step 2: 分成新增、更新（contentHash相同）、版本升级（contentHash不同）三组
  var inserts = [];
  var updates = [];    // contentHash 相同 → 轻量更新
  var versions = [];   // contentHash 不同 → 版本升级
  for (var j = 0; j < questions.length; j++) {
    var q = questions[j];
    var existing = existingDocs[q.questionId];
    if (!existing) {
      inserts.push(q);
    } else if (existing.contentHash === q.contentHash) {
      // 内容未变，仅更新元数据（不改变版本）
      updates.push({ _id: existing._id, data: q });
    } else {
      // 内容变化，创建新版本
      versions.push({
        oldDoc: existing,
        newData: q
      });
    }
  }

  var inserted = 0;
  var updated = 0;
  var skipped = 0;
  var errors = [];
  var writeStart = Date.now();

  // Step 3: 并行新增
  for (var k = 0; k < inserts.length; k += BATCH) {
    var batch = inserts.slice(k, k + BATCH);
    var tasks = batch.map(function(q) {
      return coll.add({ data: q }).then(
        function() { inserted++; },
        function(e) { errors.push({ stem: q.stem.substring(0, 30), error: e.message }); skipped++; }
      );
    });
    await Promise.all(tasks);
  }

  // Step 4: 并行更新（contentHash 相同，只更新非敏感字段）
  for (var u = 0; u < updates.length; u += BATCH) {
    var uBatch = updates.slice(u, u + BATCH);
    var uTasks = uBatch.map(function(item) {
      return coll.doc(item._id).update({ data: {
        type: item.data.type,
        difficulty: item.data.difficulty,
        knowledgePoints: item.data.knowledgePoints,
        stem: item.data.stem,
        options: item.data.options,
        answer: item.data.answer,
        explanation: item.data.explanation,
        examPoint: item.data.examPoint,
        paperSource: item.data.paperSource
      }}).then(
        function() { updated++; },
        function(e) { errors.push({ error: e.message }); skipped++; }
      );
    });
    await Promise.all(uTasks);
  }

  // Step 5: 版本升级（contentHash 变化 → isLatest 切旧 + 插新）
  for (var v = 0; v < versions.length; v += BATCH) {
    var vBatch = versions.slice(v, v + BATCH);
    var vTasks = vBatch.map(function(ver) {
      var newDoc = ver.newData;
      newDoc.versionNumber = (ver.oldDoc.versionNumber || 1) + 1;
      newDoc.isLatest = true;
      newDoc.familyId = ver.oldDoc.familyId || ver.oldDoc.questionId;
      newDoc._id = undefined; // 让系统生成新 _id

      // 先插新版本，再置旧版本 isLatest=false
      return coll.add({ data: newDoc }).then(function() {
        inserted++;
        return coll.doc(ver.oldDoc._id).update({ data: { isLatest: false } });
      }).catch(function(e) {
        errors.push({ stem: newDoc.stem.substring(0, 30), error: 'version: ' + (e.message || '').substring(0, 60) });
        skipped++;
      });
    });
    await Promise.all(vTasks);
  }

  var writeMs = Date.now() - writeStart;

  return {
    inserted: inserted, updated: updated, skipped: skipped,
    errors: errors,
    queryMs: queryMs, writeMs: writeMs
  };
}

// ====== 主入口 ======

exports.main = async function(event) {
  var start = Date.now();

  // 解析输入
  var raw = event.data;
  if (!Array.isArray(raw) || raw.length === 0) {
    // 也兼容 fileID 方式
    if (event.fileID) {
      try {
        var dl = await cloud.downloadFile({ fileID: event.fileID });
        var text = dl.fileContent.toString('utf-8');
        // 尝试 JSON 数组
        try { var arr = JSON.parse(text); if (Array.isArray(arr)) raw = arr; } catch(e) {}
        // 尝试 JSONL
        if (!Array.isArray(raw)) {
          raw = [];
          text.split(/\r?\n/).filter(function(l) { return l.trim(); }).forEach(function(line) {
            try { var o = JSON.parse(line); if (o && o.stem) raw.push(o); } catch(e) {}
          });
        }
      } catch(e) {
        return { success: false, error: 'fileID 下载失败: ' + (e.message || '').substring(0, 80) };
      }
    } else {
      return { success: false, error: '请传入 data 数组或 fileID' };
    }
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    return { success: false, error: '未解析到有效数据' };
  }

  // 规范化
  var questions = [];
  for (var i = 0; i < raw.length; i++) {
    var q = normalize(raw[i]);
    if (q) questions.push(q);
  }

  // 统计
  var stats = { total: questions.length, bySubject: {}, byType: {} };
  questions.forEach(function(q) {
    stats.bySubject[q.subject] = (stats.bySubject[q.subject] || 0) + 1;
    stats.byType[q.type] = (stats.byType[q.type] || 0) + 1;
  });

  // 写入
  var result = await fastUpsert(questions, event.dryRun === true);

  return {
    success: true,
    dryRun: !!event.dryRun,
    total: questions.length,
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    stats: stats,
    errors: result.errors.slice(0, 10),
    elapsedMs: Date.now() - start,
    timing: {
      total: Date.now() - start,
      query: result.queryMs || 0,
      write: result.writeMs || 0
    }
  };
};
