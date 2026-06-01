/**
 * 爬虫输出 → 云数据库 导入助手 v1.0
 *
 * 用法：
 *   node import_to_cloud.js <json文件路径> [--dryRun]
 *
 * 此脚本将读取爬虫输出的 JSON/JSONL 文件，
 * 生成可直接用于小程序的导入代码片段。
 *
 * 导入方式（任选其一）：
 *   1. 云函数 fileID 方式（推荐大文件）：
 *      将 JSON 文件上传到云存储 → 调用 importQuestions({ fileID: "cloud://..." })
 *   2. 直接 data 方式（< 200 条）：
 *      在小程序中调用 importQuestions({ data: [...] })
 *   3. 云开发控制台手动导入：
 *      Database → exam_questions → Import → 选择 JSON 文件
 */
var fs = require('fs');
var path = require('path');

function main() {
  var args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('用法: node import_to_cloud.js <json文件路径> [--dryRun] [--chunkSize=50]');
    console.log('');
    console.log('示例:');
    console.log('  node import_to_cloud.js output/shijuan1_full_数学_六年级_3.json');
    console.log('  node import_to_cloud.js output/shijuan1_full_数学_六年级_3.json --dryRun');
    console.log('  node import_to_cloud.js output/shijuan1_full_数学_六年级_3.json --chunkSize=30');
    return;
  }

  var filePath = args[0];
  var dryRun = args.indexOf('--dryRun') >= 0;
  var chunkSize = 50;
  for (var i = 0; i < args.length; i++) {
    var m = args[i].match(/--chunkSize=(\d+)/);
    if (m) chunkSize = parseInt(m[1]);
  }

  if (!fs.existsSync(filePath)) {
    console.error('文件不存在: ' + filePath);
    process.exit(1);
  }

  console.log('========================================');
  console.log('  导入助手 v1.0');
  console.log('========================================');
  console.log('文件: ' + filePath);

  var content = fs.readFileSync(filePath, 'utf-8');
  var questions = [];

  // 尝试 JSON 数组
  try {
    var parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      questions = parsed;
    }
  } catch(e) {
    // 尝试 JSONL
    var lines = content.split(/\r?\n/).filter(function(l) { return l.trim(); });
    for (var i = 0; i < lines.length; i++) {
      try {
        var obj = JSON.parse(lines[i]);
        if (obj && obj.stem) questions.push(obj);
      } catch(e2) {}
    }
  }

  if (questions.length === 0) {
    console.error('未能从文件中解析出有效题目');
    process.exit(1);
  }

  // 统计
  var stats = { bySubject: {}, byGrade: {}, byType: {} };
  for (var j = 0; j < questions.length; j++) {
    var q = questions[j];
    stats.bySubject[q.subject] = (stats.bySubject[q.subject] || 0) + 1;
    stats.byGrade[q.grade] = (stats.byGrade[q.grade] || 0) + 1;
    stats.byType[q.type] = (stats.byType[q.type] || 0) + 1;
  }

  console.log('');
  console.log('题目总数: ' + questions.length);
  console.log('学科: ' + JSON.stringify(stats.bySubject));
  console.log('年级: ' + JSON.stringify(stats.byGrade));
  console.log('题型: ' + JSON.stringify(stats.byType));
  console.log('');

  if (dryRun) {
    console.log('[dryRun 模式] 不做实际输出');
    return;
  }

  var outputDir = path.join(__dirname, 'output');
  var baseName = path.basename(filePath, path.extname(filePath));

  // 生成分块文件（每块不超过 chunkSize 条，适合直接 data 传参）
  var chunks = Math.ceil(questions.length / chunkSize);
  var chunkFiles = [];

  for (var c = 0; c < chunks; c++) {
    var chunk = questions.slice(c * chunkSize, (c + 1) * chunkSize);
    var chunkPath = path.join(outputDir, baseName + '_chunk' + (c + 1) + 'of' + chunks + '.json');
    fs.writeFileSync(chunkPath, JSON.stringify(chunk, null, 2), 'utf-8');
    chunkFiles.push(chunkPath);
  }

  // 生成云函数调用代码模板
  var codeTemplate = [
    '// ===== 小程序端调用示例 =====',
    '// 复制以下代码到小程序页面或云函数中',
    '',
    '// 方式1：直接传 data（小批量，每批不超过 ' + chunkSize + ' 条）',
  ];

  for (var c2 = 0; c2 < chunks; c2++) {
    var chunkData = questions.slice(c2 * chunkSize, (c2 + 1) * chunkSize);
    var jsonStr = JSON.stringify(chunkData);
    codeTemplate.push('');
    codeTemplate.push('// --- 第 ' + (c2 + 1) + '/' + chunks + ' 批 (' + chunkData.length + ' 条) ---');
    codeTemplate.push('wx.cloud.callFunction({');
    codeTemplate.push('  name: \'importQuestions\',');
    codeTemplate.push('  data: {');
    codeTemplate.push('    data: ' + jsonStr.substring(0, 200) + '... // (完整数据见文件)');
    codeTemplate.push('  }');
    codeTemplate.push('}).then(function(res) {');
    codeTemplate.push('  console.log(\'导入结果:\', res.result);');
    codeTemplate.push('});');
  }

  codeTemplate.push('');
  codeTemplate.push('// 方式2：上传到云存储后通过 fileID 导入（推荐大批量）');
  codeTemplate.push('// 1) 将 ' + baseName + '.json 上传到微信云存储');
  codeTemplate.push('// 2) 获取 fileID（如 cloud://xxx.xxx/path/to/file.json）');
  codeTemplate.push('// 3) 调用：');
  codeTemplate.push('wx.cloud.callFunction({');
  codeTemplate.push('  name: \'importQuestions\',');
  codeTemplate.push('  data: { fileID: \'cloud://your-env-id.xxx/path/to/file.json\' }');
  codeTemplate.push('}).then(function(res) {');
  codeTemplate.push('  console.log(\'导入结果:\', res.result);');
  codeTemplate.push('});');

  codeTemplate.push('');
  codeTemplate.push('// 方式3：仅预览不写入（dryRun）');
  codeTemplate.push('wx.cloud.callFunction({');
  codeTemplate.push('  name: \'importQuestions\',');
  codeTemplate.push('  data: { data: [...], dryRun: true }');
  codeTemplate.push('}).then(function(res) {');
  codeTemplate.push('  console.log(\'预览统计:\', res.result.stats);');
  codeTemplate.push('});');

  var codePath = path.join(outputDir, baseName + '_import_code.js');
  fs.writeFileSync(codePath, codeTemplate.join('\n'), 'utf-8');

  console.log('生成文件:');
  if (chunks > 1) {
    console.log('  分块文件 (' + chunks + ' 个):');
    for (var cf = 0; cf < chunkFiles.length; cf++) {
      console.log('    ' + chunkFiles[cf]);
    }
  }
  console.log('  调用代码模板: ' + codePath);
  console.log('');
  console.log('===== 导入步骤 =====');
  console.log('');
  console.log('【小批量（<' + chunkSize + '条）】');
  console.log('  1. 打开分块 JSON 文件，复制内容');
  console.log('  2. 在小程序中调用 cloud function:');
  console.log('     wx.cloud.callFunction({ name: "importQuestions", data: { data: [...] } })');
  console.log('');
  console.log('【大批量（>' + chunkSize + '条）】');
  console.log('  1. 在微信开发者工具 → 云开发 → 存储 → 上传 ' + baseName + '.json');
  console.log('  2. 复制文件的 fileID');
  console.log('  3. 调用: wx.cloud.callFunction({ name: "importQuestions", data: { fileID: "cloud://..." } })');
  console.log('');
  console.log('【手动导入】');
  console.log('  微信开发者工具 → 云开发 → 数据库 → exam_questions → 导入 → 选择 JSON 文件');
  console.log('  注意：手动导入不执行去重，可能产生重复数据');
}

main();
