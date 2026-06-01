/**
 * 模拟 importQuestions 云函数本地执行
 * 用本地 JSON 文件模拟 exam_questions 集合的 upsert 行为
 *
 * 用法：
 *   node simulate_import.js <输入.cloud.jsonl> [--rounds=2]
 *
 * 第一次运行：全量 insert
 * 第二次运行：部分 updated（模拟重复导入）
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// ====== 复制自云函数的逻辑 ======

function md5(s) {
  return crypto.createHash('md5').update(String(s)).digest('hex');
}

var KNOWN_TYPES = ['填空题', '选择题', '判断题', '计算题', '简答题', '应用题', '作图题', '操作题', '阅读理解', '完形填空', '写作题', '翻译题', '连线题', '其他题'];
var VALID_SUBJECTS = ['数学', '语文', '英语'];
var VALID_GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];

function stemKey(stem, subject, grade) {
  var short = (stem || '').replace(/[\s\n\r\t]+/g, '').substring(0, 80);
  return md5(short + '|' + (subject || '') + '|' + (grade || ''));
}

function normalizeQuestion(raw, defaults) {
  var subject = raw.subject || defaults.subject || '';
  var grade = raw.grade || defaults.grade || '';

  subject = subject.replace('小学', '').trim();
  if (VALID_SUBJECTS.indexOf(subject) < 0) {
    for (var i = 0; i < VALID_SUBJECTS.length; i++) {
      if (subject.indexOf(VALID_SUBJECTS[i]) >= 0) { subject = VALID_SUBJECTS[i]; break; }
    }
  }

  if (VALID_GRADES.indexOf(grade) < 0) {
    var gradeNum = String(grade).replace(/[^0-9]/g, '');
    var gradeMap = {'1':'一年级','2':'二年级','3':'三年级','4':'四年级','5':'五年级','6':'六年级'};
    grade = gradeMap[gradeNum] || grade;
  }

  var type = raw.type || '填空题';
  if (KNOWN_TYPES.indexOf(type) < 0) type = '填空题';

  var difficulty = raw.difficulty || '基础巩固';
  if (['基础巩固','能力提升','冲刺拔高'].indexOf(difficulty) < 0) difficulty = '基础巩固';

  var stem = (raw.stem || '').trim().substring(0, 500);
  if (!stem) return null;

  return {
    questionId: raw.questionId || stemKey(stem, subject, grade),
    subject: subject, grade: grade, type: type, difficulty: difficulty,
    knowledgePoints: (raw.knowledgePoints || []).slice(0, 10),
    stem: stem,
    options: (raw.options || []).slice(0, 8),
    answer: String(raw.answer || '').trim().substring(0, 500),
    explanation: String(raw.explanation || '').trim().substring(0, 1000),
    examPoint: String(raw.examPoint || '').trim().substring(0, 100),
    paperSource: String(raw.paperSource || '').substring(0, 100),
    status: 'active',
    usageCount: 0,
    correctCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ====== 模拟数据库 ======

var DB_FILE = path.join(__dirname, 'output', 'test_e2e', '_mock_db.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { collection: 'exam_questions', records: {}, byQuestionId: {} };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function upsertToMockDB(question) {
  var db = loadDB();
  var existing = db.byQuestionId[question.questionId];

  if (existing) {
    // 更新
    db.records[existing._id] = Object.assign({}, db.records[existing._id], {
      type: question.type,
      difficulty: question.difficulty,
      knowledgePoints: question.knowledgePoints,
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      examPoint: question.examPoint,
      paperSource: question.paperSource,
      updatedAt: question.updatedAt
    });
    saveDB(db);
    return 'updated';
  } else {
    // 新增
    var _id = 'mock_' + question.questionId.substring(0, 16);
    var record = Object.assign({}, question, { _id: _id });
    db.records[_id] = record;
    db.byQuestionId[question.questionId] = _id;
    saveDB(db);
    return 'inserted';
  }
}

// ====== 主流程 ======

function parseInput(filePath) {
  var content = fs.readFileSync(filePath, 'utf-8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.substring(1);

  var questions = [];
  var lines = content.split(/\r?\n/).filter(function(l) { return l.trim(); });
  for (var i = 0; i < lines.length; i++) {
    try {
      var obj = JSON.parse(lines[i]);
      if (obj && obj.stem) questions.push(obj);
    } catch(e) {}
  }

  // 也尝试 JSON 数组
  if (questions.length === 0) {
    try {
      var parsed = JSON.parse(content);
      if (Array.isArray(parsed)) questions = parsed;
    } catch(e) {}
  }

  return questions;
}

function analyze(questions) {
  var stats = { total: questions.length, bySubject: {}, byGrade: {}, byType: {}, byDifficulty: {} };
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    if (!q) continue;
    stats.bySubject[q.subject] = (stats.bySubject[q.subject] || 0) + 1;
    stats.byGrade[q.grade] = (stats.byGrade[q.grade] || 0) + 1;
    stats.byType[q.type] = (stats.byType[q.type] || 0) + 1;
    stats.byDifficulty[q.difficulty] = (stats.byDifficulty[q.difficulty] || 0) + 1;
  }
  return stats;
}

function main() {
  var args = process.argv.slice(2);
  var inputPath = args[0] || path.join('output', 'test_e2e', 'import.cloud.jsonl');
  var rounds = parseInt(args[1]) || 1;

  if (!fs.existsSync(inputPath)) {
    console.error('文件不存在: ' + inputPath);
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   模拟 importQuestions 云函数执行       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('模拟数据库: ' + DB_FILE);
  console.log('输入文件: ' + inputPath);
  console.log('模拟轮数: ' + rounds);
  console.log('');

  // 清空模拟数据库
  if (args.indexOf('--reset') >= 0) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ collection: 'exam_questions', records: {}, byQuestionId: {} }), 'utf-8');
    console.log('已重置模拟数据库');
    console.log('');
  }

  var rawQuestions = parseInput(inputPath);
  console.log('解析输入: ' + rawQuestions.length + ' 条原始记录');

  for (var round = 1; round <= rounds; round++) {
    var startTime = Date.now();
    console.log('');
    console.log('───────── 第 ' + round + ' 轮 ─────────');

    // Step 1: 规范化
    var questions = [];
    for (var i = 0; i < rawQuestions.length; i++) {
      var q = normalizeQuestion(rawQuestions[i], {});
      if (q) questions.push(q);
    }
    console.log('规范化: ' + rawQuestions.length + ' → ' + questions.length + ' 条有效');

    // Step 2: 统计
    var stats = analyze(questions);
    console.log('学科: ' + JSON.stringify(stats.bySubject));
    console.log('年级: ' + JSON.stringify(stats.byGrade));
    console.log('题型: ' + JSON.stringify(stats.byType));
    console.log('难度: ' + JSON.stringify(stats.byDifficulty));

    // Step 3: 去重（questionId）
    var uniqueMap = {};
    var dupCount = 0;
    for (var j = 0; j < questions.length; j++) {
      var id = questions[j].questionId;
      if (uniqueMap[id]) { dupCount++; continue; }
      uniqueMap[id] = questions[j];
    }
    console.log('去重: ' + questions.length + ' → ' + Object.keys(uniqueMap).length + ' 条唯一 (' + dupCount + ' 重复)');

    // Step 4: 模拟 upsert
    var inserted = 0, updated = 0, skipped = 0;
    var sampleInserts = [];
    var sampleUpdates = [];

    var ids = Object.keys(uniqueMap);
    for (var k = 0; k < ids.length; k++) {
      var q = uniqueMap[ids[k]];
      try {
        var result = upsertToMockDB(q);
        if (result === 'inserted') {
          inserted++;
          if (sampleInserts.length < 3) sampleInserts.push(q);
        } else if (result === 'updated') {
          updated++;
          if (sampleUpdates.length < 3) sampleUpdates.push(q);
        }
      } catch(e) {
        skipped++;
      }
    }

    var elapsed = Date.now() - startTime;

    console.log('');
    console.log('写入结果:');
    console.log('  新增 (inserted): ' + inserted + ' 条');
    console.log('  更新 (updated):  ' + updated + ' 条');
    console.log('  跳过 (skipped):  ' + skipped + ' 条');
    console.log('  耗时: ' + elapsed + 'ms');

    if (sampleInserts.length > 0) {
      console.log('');
      console.log('─ 新增样本 ─');
      for (var si = 0; si < sampleInserts.length; si++) {
        console.log('  + [' + sampleInserts[si].type + '] ' + sampleInserts[si].stem.substring(0, 80) + '...');
      }
    }

    if (sampleUpdates.length > 0) {
      console.log('');
      console.log('─ 更新样本 ─');
      for (var ui = 0; ui < sampleUpdates.length; ui++) {
        console.log('  ~ [' + sampleUpdates[ui].type + '] ' + sampleUpdates[ui].stem.substring(0, 80) + '...');
      }
    }

    if (round === 1 && rounds === 1) {
      console.log('');
      console.log('💡 提示: 用 --rounds=2 模拟重复导入场景（第二轮会触发 updated）');
    }
  }

  // 最终数据库统计
  var db = loadDB();
  var totalRecords = Object.keys(db.records).length;
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('模拟数据库最终状态:');
  console.log('  exam_questions 集合: ' + totalRecords + ' 条记录');

  // 按学科统计
  var dbStats = { bySubject: {}, byType: {} };
  var recIds = Object.keys(db.records);
  for (var r = 0; r < recIds.length; r++) {
    var rec = db.records[recIds[r]];
    dbStats.bySubject[rec.subject] = (dbStats.bySubject[rec.subject] || 0) + 1;
    dbStats.byType[rec.type] = (dbStats.byType[rec.type] || 0) + 1;
  }
  console.log('  学科: ' + JSON.stringify(dbStats.bySubject));
  console.log('  题型: ' + JSON.stringify(dbStats.byType));

  // 验证几个关键数据点
  console.log('');
  console.log('数据完整性验证:');
  var sample = db.records[Object.keys(db.records)[0]];
  console.log('  字段齐全: ' + (sample && sample.questionId && sample.stem && sample.subject ? '✓' : '✗'));
  console.log('  questionId 唯一: ' + (Object.keys(db.byQuestionId).length === totalRecords ? '✓' : '✗'));

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('✅ 模拟完成');
  console.log('');
  console.log('要将此数据实际写入云数据库，请:');
  console.log('  1. 将 ' + path.basename(inputPath) + ' 上传到微信云存储');
  console.log('  2. 部署 importQuestions 云函数');
  console.log('  3. 调用: wx.cloud.callFunction({ name: "importQuestions", data: { fileID: "cloud://..." } })');
}

main();
