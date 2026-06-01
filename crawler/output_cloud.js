/**
 * 爬虫 JSON → 云数据库 JSON Lines 格式转换器
 *
 * 微信云数据库导入要求的 JSON Lines 格式：
 *   - 每行一个 JSON 对象（不能有数组包裹）
 *   - 行尾符必须为 LF (\n)，不能是 CRLF
 *   - 文件编码为 UTF-8 无 BOM
 *   - 每条记录最多 50 个字段
 *   - 不建议包含 _id（让数据库自动生成）
 *   - 日期字段建议使用云数据库可识别的格式或留空
 *
 * 用法：
 *   node output_cloud.js <输入.json或.jsonl> [--out=输出文件.cloud.jsonl]
 *   node output_cloud.js output/shijuan1_full_数学_六年级_1.json --out=cloud_import.jsonl
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

function md5(s) {
  return crypto.createHash('md5').update(String(s)).digest('hex');
}

function parseInput(filePath) {
  var content = fs.readFileSync(filePath, 'utf-8');
  // 移除 BOM
  if (content.charCodeAt(0) === 0xFEFF) content = content.substring(1);

  var questions = [];

  // 尝试 JSON 数组
  try {
    var parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      questions = parsed;
      return questions;
    }
  } catch(e) {
    // 继续尝试 JSONL
  }

  // JSON Lines
  var lines = content.split(/\r?\n/).filter(function(l) { return l.trim(); });
  for (var i = 0; i < lines.length; i++) {
    try {
      var obj = JSON.parse(lines[i]);
      if (obj && obj.stem) questions.push(obj);
    } catch(e) {}
  }

  return questions;
}

/**
 * 将爬虫输出转为云数据库可导入的格式
 */
function toCloudRecord(raw) {
  var stem = (raw.stem || '').trim();
  if (!stem || stem.length < 3) return null;

  var subject = (raw.subject || '').replace('小学', '').trim();
  var grade = (raw.grade || '').replace(/^(\d)年级$/, function(_, n) {
    var map = { '1': '一年级', '2': '二年级', '3': '三年级', '4': '四年级', '5': '五年级', '6': '六年级' };
    return map[n] || _;
  }).trim();

  // 生成唯一 questionId
  var shortStem = stem.replace(/[\s\n\r\t]+/g, '').substring(0, 80);
  var questionId = md5(shortStem + '|' + subject + '|' + grade);

  // 只保留云数据库 exam_questions 集合需要的字段
  // 注意：不含 _id（让数据库自动生成），不含 createdAt（避免日期格式问题）
  return {
    questionId: questionId,
    subject: subject,
    grade: grade,
    type: raw.type || '填空题',
    difficulty: raw.difficulty || '基础巩固',
    knowledgePoints: (raw.knowledgePoints || []).slice(0, 10),
    stem: stem.substring(0, 500),
    options: (raw.options || []).slice(0, 8),
    answer: String(raw.answer || '').trim().substring(0, 500),
    explanation: String(raw.explanation || '').trim().substring(0, 1000),
    examPoint: String(raw.examPoint || '').trim().substring(0, 100),
    paperSource: String(raw.paperSource || '').substring(0, 100),
    status: 'active'
  };
}

function main() {
  var args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('用法: node output_cloud.js <输入.json/.jsonl> [--out=输出文件]');
    console.log('');
    console.log('示例:');
    console.log('  node output_cloud.js output/shijuan1_full_数学_六年级_3.json');
    console.log('  node output_cloud.js output/shijuan1_full_数学_六年级_3.json --out=import.cloud.jsonl');
    return;
  }

  var inputPath = args[0];
  var outputPath = '';

  for (var i = 0; i < args.length; i++) {
    var m = args[i].match(/^--out=(.+)$/);
    if (m) outputPath = m[1];
  }

  if (!fs.existsSync(inputPath)) {
    console.error('文件不存在: ' + inputPath);
    process.exit(1);
  }

  if (!outputPath) {
    var dir = path.dirname(inputPath);
    var name = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(dir, name + '.cloud.jsonl');
  }

  var rawQuestions = parseInput(inputPath);
  console.log('读取: ' + rawQuestions.length + ' 条原始记录');

  // 转换为云数据库格式
  var records = [];
  var seenIds = new Set();

  for (var i = 0; i < rawQuestions.length; i++) {
    var record = toCloudRecord(rawQuestions[i]);
    if (!record) continue;

    // 去重
    if (seenIds.has(record.questionId)) continue;
    seenIds.add(record.questionId);

    records.push(record);
  }

  // 输出 JSON Lines（严格 LF 行尾，无 BOM）
  var lines = [];
  for (var j = 0; j < records.length; j++) {
    lines.push(JSON.stringify(records[j]));
  }
  var content = lines.join('\n') + '\n';

  // 确保 LF 行尾（Windows 上 fs.writeFileSync 可能转 CRLF）
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  fs.writeFileSync(outputPath, content, { encoding: 'utf-8' });

  // 验证：重新读回检查
  var verify = fs.readFileSync(outputPath, 'utf-8');
  var verifyLines = verify.split('\n').filter(function(l) { return l.trim(); });
  var hasCR = verify.indexOf('\r') >= 0;

  console.log('输出: ' + outputPath);
  console.log('有效记录: ' + records.length + ' 条');
  console.log('去重去除: ' + (rawQuestions.length - records.length) + ' 条');
  console.log('行尾符: ' + (hasCR ? '⚠ CRLF (需要修复)' : '✓ LF'));
  console.log('编码: UTF-8 无 BOM ✓');
  console.log('');

  // 统计
  var stats = { bySubject: {}, byGrade: {}, byType: {} };
  for (var k = 0; k < records.length; k++) {
    var r = records[k];
    stats.bySubject[r.subject] = (stats.bySubject[r.subject] || 0) + 1;
    stats.byGrade[r.grade] = (stats.byGrade[r.grade] || 0) + 1;
    stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
  }

  console.log('学科: ' + JSON.stringify(stats.bySubject));
  console.log('年级: ' + JSON.stringify(stats.byGrade));
  console.log('题型: ' + JSON.stringify(stats.byType));
  console.log('');

  console.log('===== 导入步骤 =====');
  console.log('1. 打开微信开发者工具');
  console.log('2. 云开发 → 数据库 → exam_questions');
  console.log('3. 点击「导入」按钮');
  console.log('4. 选择文件: ' + outputPath);
  console.log('5. 导入模式选择「JSON Lines」');
  console.log('6. 确认导入');

  if (records.length > 500) {
    console.log('');
    console.log('⚠ 数据集较大 (' + records.length + ' 条)，建议分批导入或使用 importQuestions 云函数');
  }
}

main();
