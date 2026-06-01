/**
 * shijuan1.com 完整爬取脚本
 *
 * 用法：
 *   node run_shijuan1.js                      # 默认：六年级数学，完整管道，10份
 *   node run_shijuan1.js 数学 六年级 20       # 学科 年级 试卷数
 *   node run_shijuan1.js all all 5            # 全部学科年级，每类5份
 *   node run_shijuan1.js 语文 五年级 10 meta  # 仅元数据模式
 */

var shijuan1 = require('./parsers/shijuan1');
var questionParser = require('./parsers/questionParser');
var fs = require('fs');
var path = require('path');

var OUTPUT_DIR = path.join(__dirname, 'output');
var CACHE_DIR = path.join(__dirname, 'output', 'cache');
var EXTRACT_DIR = path.join(__dirname, 'output', 'extract');

// 参数解析
var subject = process.argv[2] || '数学';
var grade = process.argv[3] || '六年级';
var maxPapers = parseInt(process.argv[4]) || 10;
var mode = process.argv[5] || 'full'; // full | meta

var SUBJECTS = ['数学', '语文', '英语'];
var GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
var GRADE_NUM = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

async function main() {
  var startTime = Date.now();

  console.log('========================================');
  console.log('  shijuan1.com 爬取工具 v3.0');
  console.log('========================================');
  console.log('学科: ' + subject + '  年级: ' + grade);
  console.log('模式: ' + mode + '  最多试卷数: ' + maxPapers);
  console.log('');

  ensureDir(OUTPUT_DIR);
  ensureDir(CACHE_DIR);
  ensureDir(EXTRACT_DIR);

  var subjects = subject === 'all' ? SUBJECTS : [subject];
  var grades = grade === 'all' ? GRADES : [grade];
  var allQuestions = [];
  var allMeta = [];

  for (var si = 0; si < subjects.length; si++) {
    for (var gi = 0; gi < grades.length; gi++) {
      var subj = subjects[si];
      var grad = grades[gi];
      var subjKey = '小学' + subj;
      var gradeNum = GRADE_NUM[grad.replace('年级', '')];

      console.log('\n=== ' + subjKey + ' ' + grad + ' ===');

      if (mode === 'meta') {
        // 元数据模式
        var listResult = await shijuan1.crawlGradeList(subjKey, gradeNum, Math.ceil(maxPapers / 25));
        allMeta = allMeta.concat(listResult.papers);
        console.log('  获取: ' + listResult.papers.length + ' 条元数据');
      } else {
        // 完整管道模式
        var result = await shijuan1.crawlGradeFull(subjKey, gradeNum, {
          maxPages: Math.ceil(maxPapers / 25),
          maxPapers: maxPapers,
          cacheDir: CACHE_DIR,
          extractDir: EXTRACT_DIR,
          onProgress: function(info) {
            var status = info.stage === 'done' ? '+' : info.stage === 'error' ? '!' : '.';
            if (info.stage === 'error') {
              console.log('    [' + info.current + '/' + info.total + '] ' + status + ' ' +
                (info.paperTitle || '').substring(0, 35) + ' | ' + (info.error || '').substring(0, 50));
            } else if (info.stage === 'done') {
              console.log('    [' + info.current + '/' + info.total + '] ' + status + ' ' +
                (info.paperTitle || '').substring(0, 35) + ' → ' + (info.questionCount || 0) + ' 题');
            }
          }
        });

        allQuestions = allQuestions.concat(result.questions);

        if (result.successCount > 0) {
          // 分析提取的题目质量
          var stats = questionParser.analyzeQuestions(result.questions);
          console.log('\n  本组统计: ' + result.questions.length + ' 题, 题型: ' +
            JSON.stringify(stats.byType));
        }
      }

      if (si < subjects.length - 1 || gi < grades.length - 1) {
        await sleep(2000);
      }
    }
  }

  // 输出结果
  console.log('\n========================================');
  console.log('  爬取完成');
  console.log('========================================');

  if (mode === 'meta') {
    console.log('元数据总数: ' + allMeta.length + ' 条');
    var fp = path.join(OUTPUT_DIR, 'shijuan1_meta_' + subject + '_' + grade + '.json');
    fs.writeFileSync(fp, JSON.stringify(allMeta, null, 2), 'utf-8');
    console.log('已保存: ' + fp);
  } else {
    // 去重
    var seen = new Set();
    var unique = [];
    for (var i = 0; i < allQuestions.length; i++) {
      var q = allQuestions[i];
      var key = (q.stem || '').substring(0, 100).replace(/\s/g, '');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(q);
      }
    }

    console.log('题目总数: ' + allQuestions.length + ' (去重后: ' + unique.length + ')');

    // 题型分布
    var typeStats = {};
    for (var t = 0; t < unique.length; t++) {
      var tp = unique[t].type;
      typeStats[tp] = (typeStats[tp] || 0) + 1;
    }
    console.log('题型分布:');
    for (var tk in typeStats) {
      if (typeStats.hasOwnProperty(tk)) console.log('  ' + tk + ': ' + typeStats[tk] + ' 道');
    }

    // 输出文件
    var prefix = 'shijuan1_full_' + subject + '_' + grade + '_' + maxPapers;
    prefix = prefix.replace(/[/\\]/g, '_');

    var jsonlPath = path.join(OUTPUT_DIR, prefix + '.jsonl');
    var jsonPath = path.join(OUTPUT_DIR, prefix + '.json');
    var cloudPath = path.join(OUTPUT_DIR, prefix + '.cloud.jsonl');

    // JSON Lines
    var lines = [];
    for (var l = 0; l < unique.length; l++) lines.push(JSON.stringify(unique[l]));
    fs.writeFileSync(jsonlPath, lines.join('\n'), 'utf-8');

    // JSON Array
    fs.writeFileSync(jsonPath, JSON.stringify(unique, null, 2), 'utf-8');

    // 云数据库导入格式（去 createdAt、加 questionId、严格 LF 行尾）
    var crypto = require('crypto');
    var cloudLines = [];
    var seenCloudIds = {};
    for (var c = 0; c < unique.length; c++) {
      var q = unique[c];
      var shortStem = (q.stem || '').replace(/[\s\n\r\t]+/g, '').substring(0, 80);
      var questionId = crypto.createHash('md5').update(shortStem + '|' + (q.subject || '') + '|' + (q.grade || '')).digest('hex');
      if (seenCloudIds[questionId]) continue;
      seenCloudIds[questionId] = true;
      cloudLines.push(JSON.stringify({
        questionId: questionId,
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
        status: 'active'
      }));
    }
    var cloudContent = cloudLines.join('\n') + '\n';
    cloudContent = cloudContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    fs.writeFileSync(cloudPath, cloudContent, 'utf-8');

    // 验证云格式
    var verify = fs.readFileSync(cloudPath, 'utf-8');
    var hasCR = verify.indexOf('\r') >= 0;

    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n耗时: ' + elapsed + ' 秒');
    console.log('输出:');
    console.log('  ' + jsonlPath + ' (' + unique.length + ' 行)');
    console.log('  ' + jsonPath);
    console.log('  ' + cloudPath + ' (' + cloudLines.length + ' 行, ' + (hasCR ? '⚠ CRLF' : '✓ LF') + ') → 可直接导入云数据库');
  }
}

main().catch(function(e) {
  console.error('错误: ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
