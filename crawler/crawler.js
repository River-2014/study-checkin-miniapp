/**
 * 小升初打卡小程序 —— 题库生成器 v3.0
 *
 * ===== 数据来源 =====
 *   1. shijuan1.com — 完整管道：列表→详情→RAR下载→DOCX提取→题目解析
 *   2. tiku.cn — 试卷列表元数据
 *   3. 内置种子题库 — 54 道覆盖 1-6 年级语数英
 *   4. 自定义 URL — 通用 HTML 页面爬取
 *
 * ===== 用法 =====
 *   node crawler.js --source=shijuan1 --subject=数学 --grade=六年级 --depth=full
 *   node crawler.js --source=shijuan1 --subject=all --grade=all --maxPapers=20
 *   node crawler.js --source=seed
 *   node crawler.js --source=all
 *   node crawler.js --schedule
 *
 * ===== 模式说明 =====
 *   depth=meta    仅爬取试卷列表元数据（快速，不含题目内容）
 *   depth=full    完整管道：下载RAR→解压→提取DOCX文本→解析题目（慢，有完整题目）
 */

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var OUTPUT_DIR = path.join(__dirname, 'output');
var CACHE_DIR = path.join(__dirname, 'output', 'cache');
var EXTRACT_DIR = path.join(__dirname, 'output', 'extract');

var SUBJECTS = ['数学', '语文', '英语'];
var GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];

// ====== 工具函数 ======

function stemHash(s) {
  return crypto.createHash('md5').update((s || '').replace(/[\s\n\r\t]+/g, '')).digest('hex');
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function parseArgs() {
  var args = {};
  process.argv.forEach(function(arg) {
    var m = arg.match(/^--(.+)=(.+)$/);
    if (m) args[m[1]] = m[2];
  });
  return args;
}

// ====== 种子数据 ======

function buildSeedQuestions(subject, grade) {
  var seeds = require('./seedData');
  var list = [];
  var sources = [seeds[subject] || [], seeds['all'] || []];
  for (var si = 0; si < sources.length; si++) {
    for (var i = 0; i < sources[si].length; i++) {
      var q = JSON.parse(JSON.stringify(sources[si][i]));
      if (grade && grade !== 'all' && q.grade !== grade) continue;
      q.paperSource = q.paperSource || 'seed';
      q.createdAt = q.createdAt || new Date().toISOString();
      list.push(q);
    }
  }
  return list;
}

// ====== tiku.cn 爬取 ======

async function crawlTiku(subject, grade) {
  var results = [];
  try {
    var tiku = require('./parsers/tiku');
    var tikuSubject = '小学' + subject;
    var papers = await tiku.crawlSubject(tikuSubject, 3);
    console.log('  tiku.cn: 获取 ' + papers.length + ' 份试卷');

    for (var i = 0; i < papers.length; i++) {
      var p = papers[i];
      var kp = p.title.replace(/^\d+[\._\-\s]*/, '').replace(/[_\-\d]+$/, '').trim();
      if (!kp || kp.length < 2) continue;

      results.push({
        subject: subject, grade: grade,
        type: '填空题',
        difficulty: '基础巩固',
        knowledgePoints: [kp],
        stem: p.title,
        options: [], answer: '', explanation: '',
        examPoint: kp,
        paperSource: 'tiku.cn?id=' + p.id,
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }
  } catch(e) {
    console.log('  tiku.cn 错误: ' + (e.message || '').substring(0, 80));
  }
  return results;
}

// ====== shijuan1 元数据模式 ======

var GRADE_CHINESE_TO_NUM = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6 };

async function crawlShijuan1Meta(subject, grade) {
  var results = [];
  try {
    var shijuan1 = require('./parsers/shijuan1');
    var gradeNum = GRADE_CHINESE_TO_NUM[grade.replace('年级', '')];
    if (!gradeNum || gradeNum < 1 || gradeNum > 6) {
      throw new Error('无法解析年级: ' + grade);
    }

    var subjKey = '小学' + subject;
    var listResult = await shijuan1.crawlGradeList(subjKey, gradeNum, 3);
    var papers = listResult.papers;
    console.log('  shijuan1 meta: ' + subjKey + ' ' + grade + ' → ' + papers.length + ' 条');

    for (var i = 0; i < papers.length; i++) {
      var p = papers[i];
      results.push({
        subject: subject, grade: grade,
        type: '填空题',
        difficulty: '基础巩固',
        knowledgePoints: [p.title],
        stem: p.title,
        options: [], answer: '', explanation: '',
        examPoint: p.title,
        paperSource: 'shijuan1',
        status: 'active',
        createdAt: new Date().toISOString()
      });
    }
  } catch(e) {
    console.log('  shijuan1 meta 错误: ' + (e.message || '').substring(0, 80));
  }
  return results;
}

// ====== shijuan1 完整管道模式 ======

async function crawlShijuan1Full(subject, grade, maxPapers) {
  try {
    var shijuan1 = require('./parsers/shijuan1');
    var gradeNum = GRADE_CHINESE_TO_NUM[grade.replace('年级', '')];
    if (!gradeNum || gradeNum < 1 || gradeNum > 6) {
      throw new Error('无法解析年级: ' + grade);
    }

    var subjKey = '小学' + subject;
    console.log('  shijuan1 full: ' + subjKey + ' ' + grade + ' (maxPapers=' + maxPapers + ')');

    var result = await shijuan1.crawlGradeFull(subjKey, gradeNum, {
      maxPages: Math.ceil(maxPapers / 25),
      maxPapers: maxPapers,
      cacheDir: CACHE_DIR,
      extractDir: EXTRACT_DIR,
      onProgress: function(info) {
        var status = info.stage === 'done' ? '+' : info.stage === 'error' ? 'x' : '.';
        if (info.stage === 'done') {
          console.log('    [' + info.current + '/' + info.total + '] ' + status + ' ' +
            (info.paperTitle || '').substring(0, 40) + ' → ' + (info.questionCount || 0) + ' 题');
        } else if (info.stage === 'error') {
          console.log('    [' + info.current + '/' + info.total + '] ' + status + ' ' +
            (info.paperTitle || '').substring(0, 40) + ' | ' + (info.error || '').substring(0, 60));
        }
      }
    });

    console.log('  shijuan1 full 完成: ' + result.successCount + '/' + result.totalPapers +
      ' 份成功, ' + result.questions.length + ' 道题');

    return result.questions;
  } catch(e) {
    console.log('  shijuan1 full 错误: ' + (e.message || '').substring(0, 120));
    return [];
  }
}

// ====== 自定义 URL ======

async function crawlCustomUrl(url, subject, grade, selector) {
  var all = [];
  try {
    var axios = require('axios');
    var cheerio = require('cheerio');
    selector = selector || '.question, p';

    console.log('  请求: ' + url);
    var html = (await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EduCrawler/3.0)' },
      validateStatus: function(s) { return s < 400; }
    })).data;

    var $ = cheerio.load(html);
    $(selector).each(function() {
      var text = ($(this).text() || '').replace(/[\s\n\r\t]+/g, ' ').trim();
      if (!text || text.length < 8) return;
      var isQ = /^\d+[\.\、\)）]/.test(text) || /[?？]$/.test(text) || /选出|下列|正确的|填空|判断/.test(text);
      if (!isQ) return;
      all.push({
        subject: subject, grade: grade,
        type: '填空题', difficulty: '基础巩固', knowledgePoints: [],
        stem: text.substring(0, 500),
        options: [], answer: '', explanation: '',
        examPoint: '', paperSource: url.substring(0, 100),
        status: 'active', createdAt: new Date().toISOString()
      });
    });
    console.log('  提取: ' + all.length + ' 个片段');
  } catch(e) {
    console.log('  错误: ' + (e.message || '').substring(0, 80));
  }
  return all;
}

// ====== 试卷模式 ======

async function crawlShijuan1Papers(subject, grade) {
  var papers = [];
  try {
    var shijuan1 = require('./parsers/shijuan1');
    var gradeNum = GRADE_CHINESE_TO_NUM[grade.replace('年级', '')];
    if (!gradeNum || gradeNum < 1 || gradeNum > 6) {
      throw new Error('无法解析年级: ' + grade);
    }

    var subjKey = '小学' + subject;
    var listResult = await shijuan1.crawlGradeList(subjKey, gradeNum, 3);
    var rawPapers = listResult.papers;
    console.log('  shijuan1 papers: ' + subjKey + ' ' + grade + ' → ' + rawPapers.length + ' 条');

    for (var i = 0; i < rawPapers.length; i++) {
      var p = rawPapers[i];
      papers.push({
        title: p.title || '',
        subject: subject,
        grade: grade,
        year: p.date ? p.date.substring(0, 4) : '',
        term: '',
        version: p.version || '',
        sections: [],
        totalScore: null,
        duration: null,
        questionCount: 0,
        paperSource: 'shijuan1',
        sourceUrl: p.url || '',
        fileType: p.fileType || '',
        fileSize: p.size || '',
        status: 'metadata_only',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  } catch(e) {
    console.log('  shijuan1 papers 错误: ' + (e.message || '').substring(0, 80));
  }
  return papers;
}

async function mainPapers(args) {
  var subject = args.subject || 'all';
  var grade = args.grade || 'all';

  console.log('=== 试卷库生成器 v3.0 ===');
  console.log('学科: ' + subject + '  年级: ' + grade + '  来源: shijuan1');
  console.log('');

  ensureDir(OUTPUT_DIR);

  var subjects = subject === 'all' ? SUBJECTS : [subject];
  var grades = grade === 'all' ? GRADES : [grade];
  var allPapers = [];

  console.log('=== shijuan1 试卷元数据 ===');
  for (var si = 0; si < subjects.length; si++) {
    for (var gi = 0; gi < grades.length; gi++) {
      var data = await crawlShijuan1Papers(subjects[si], grades[gi]);
      allPapers = allPapers.concat(data);
      if (si < subjects.length - 1 || gi < grades.length - 1) await sleep(1000);
    }
  }

  // 去重
  var seenTitles = new Set();
  var final = [];
  for (var i = 0; i < allPapers.length; i++) {
    var p = allPapers[i];
    if (!p.title || p.title.length < 3) continue;
    if (!seenTitles.has(p.title)) {
      seenTitles.add(p.title);
      final.push(p);
    }
  }

  console.log('\n=== 汇总 ===');
  console.log('试卷总数: ' + final.length);
  var stats = {};
  for (var j = 0; j < final.length; j++) {
    var key = final[j].subject + ' ' + final[j].grade;
    stats[key] = (stats[key] || 0) + 1;
  }
  for (var k in stats) {
    if (stats.hasOwnProperty(k)) console.log('  ' + k + ': ' + stats[k] + ' 份');
  }

  // 输出
  var filename = 'papers_' + subject + '_' + grade + '.json';
  filename = filename.replace(/[/\\]/g, '_');
  var filePath = path.join(OUTPUT_DIR, filename);
  var lines = [];
  for (var l = 0; l < final.length; l++) lines.push(JSON.stringify(final[l]));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');

  console.log('\n已保存: ' + filePath);
}

// ====== 主入口 ======

async function main() {
  var args = parseArgs();
  var subject = args.subject || '数学';
  var grade = args.grade || '六年级';
  var source = args.source || 'shijuan1';
  var depth = args.depth || 'full';
  var maxPapers = parseInt(args.maxPapers) || 10;
  var mode = args.mode || 'questions';

  // 确保目录存在
  ensureDir(OUTPUT_DIR);
  ensureDir(CACHE_DIR);
  ensureDir(EXTRACT_DIR);

  // 定时模式
  if (args.schedule === 'true') {
    runScheduled();
    return;
  }

  // 试卷模式
  if (mode === 'papers') {
    await mainPapers(args);
    return;
  }

  console.log('========================================');
  console.log('  小升初题库生成器 v3.0');
  console.log('========================================');
  console.log('学科: ' + subject + '  年级: ' + grade);
  console.log('来源: ' + source + '  深度: ' + depth);
  console.log('最大试卷数: ' + maxPapers);
  console.log('');

  var subjects = subject === 'all' ? SUBJECTS : [subject];
  var grades = grade === 'all' ? GRADES : [grade];
  var allResults = [];

  for (var si = 0; si < subjects.length; si++) {
    for (var gi = 0; gi < grades.length; gi++) {
      var subj = subjects[si];
      var grad = grades[gi];

      console.log('--- ' + subj + ' ' + grad + ' ---');

      // shijuan1 完整管道
      if (source === 'all' || source === 'shijuan1') {
        if (depth === 'full') {
          var questions = await crawlShijuan1Full(subj, grad, maxPapers);
          allResults = allResults.concat(questions);
        } else {
          var metaResults = await crawlShijuan1Meta(subj, grad);
          allResults = allResults.concat(metaResults);
        }
      }

      // tiku.cn
      if (source === 'all' || source === 'tiku') {
        var tikuData = await crawlTiku(subj, grad);
        allResults = allResults.concat(tikuData);
      }

      // 种子数据
      if (source === 'all' || source === 'seed') {
        var seeds = buildSeedQuestions(subj, grad);
        allResults = allResults.concat(seeds);
        console.log('  seed: ' + seeds.length + ' 道');
      }

      if (si < subjects.length - 1 || gi < grades.length - 1) {
        await sleep(1500);
      }
    }
  }

  // 去重
  var seenAll = new Set();
  var final = [];
  for (var i = 0; i < allResults.length; i++) {
    var q = allResults[i];
    if (!q.stem || q.stem.length < 3) continue;
    var h = stemHash(q.stem);
    if (!seenAll.has(h)) {
      seenAll.add(h);
      final.push(q);
    }
  }

  // 统计
  console.log('\n========================================');
  console.log('  汇总统计');
  console.log('========================================');
  console.log('总计: ' + final.length + ' 道题目');
  console.log('');

  var stats = {};
  for (var j = 0; j < final.length; j++) {
    var q = final[j];
    var key = q.subject + ' ' + q.grade;
    stats[key] = (stats[key] || 0) + 1;
  }
  for (var k in stats) {
    if (stats.hasOwnProperty(k)) console.log('  ' + k + ': ' + stats[k] + ' 道');
  }

  // 按题型统计
  var typeStats = {};
  for (var t = 0; t < final.length; t++) {
    var tp = final[t].type;
    typeStats[tp] = (typeStats[tp] || 0) + 1;
  }
  console.log('\n题型分布:');
  for (var tk in typeStats) {
    if (typeStats.hasOwnProperty(tk)) console.log('  ' + tk + ': ' + typeStats[tk] + ' 道');
  }

  // 输出 JSON Lines
  var filename = 'questions_' + source + '_' + depth + '_' + subject + '_' + grade + '.jsonl';
  filename = filename.replace(/[/\\]/g, '_').replace('all', 'all');
  var filePath = path.join(OUTPUT_DIR, filename);

  // 同时输出 JSON 数组（便于直接导入）
  var jsonPath = filePath.replace('.jsonl', '.json');

  var lines = [];
  for (var l = 0; l < final.length; l++) lines.push(JSON.stringify(final[l]));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(final, null, 2), 'utf-8');

  console.log('\n输出文件:');
  console.log('  JSON Lines: ' + filePath + ' (' + final.length + ' 行)');
  console.log('  JSON Array: ' + jsonPath);
  console.log('\n导入方式: 云开发 → 数据库 → exam_questions → 导入 ' + jsonPath);
}

// ====== 定时任务 ======

function runScheduled() {
  try {
    var cron = require('node-cron');
    cron.schedule('0 3 * * 1', function() {
      console.log('[' + new Date().toISOString() + '] 定时生成...');
      // 定时任务只生成种子数据
      var all = [];
      for (var si = 0; si < SUBJECTS.length; si++) {
        for (var gi = 0; gi < GRADES.length; gi++) {
          all = all.concat(buildSeedQuestions(SUBJECTS[si], GRADES[gi]));
        }
      }
      var filePath = path.join(OUTPUT_DIR, 'scheduled_' + Date.now() + '.json');
      fs.writeFileSync(filePath, JSON.stringify(all, null, 2), 'utf-8');
      console.log('[' + new Date().toISOString() + '] 完成: ' + all.length + ' 道');
    });
    console.log('定时任务已注册: 每周一 03:00');
  } catch(e) {
    console.log('node-cron 未安装: npm install node-cron');
  }
}

main().catch(function(e) {
  console.error('错误: ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
