/**
 * appsj.szxuexiao.com 小学试卷网完整爬取脚本
 *
 * 特点：直接从网页正文提取题目，无需下载 RAR/DOCX
 *
 * 用法：
 *   node run_appsj.js                           # 默认：全部学科年级，每类5份
 *   node run_appsj.js 数学 六年级 10            # 学科 年级 试卷数
 *   node run_appsj.js all all 20                # 全部学科年级，每类20份
 *   node run_appsj.js 数学 六年级 5 meta        # 仅元数据模式
 */

var appsj = require('./parsers/appsj');
var questionParser = require('./parsers/questionParser');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var OUTPUT_DIR = path.join(__dirname, 'output');

// 参数解析
var subject = process.argv[2] || 'all';
var grade = process.argv[3] || 'all';
var maxPapers = parseInt(process.argv[4]) || 5;
var mode = process.argv[5] || 'full'; // full | meta

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

// 学科关键词→拼音路径 映射
var SUBJ_PINYIN = {
  '语文': 'yuwen',
  '数学': 'shuxue',
  '英语': 'yingyu',
  '科学': 'kexue'
};

// 年级中文→拼音路径 映射
var GRADE_PINYIN = {
  '一年级': 'yinianji',
  '二年级': 'ernianji',
  '三年级': 'sannianji',
  '四年级': 'sinianji',
  '五年级': 'wunianji',
  '六年级': 'liunianji'
};

async function main() {
  var startTime = Date.now();

  console.log('========================================');
  console.log('  appsj.szxuexiao.com 爬取工具');
  console.log('  小学试卷网 — 直接从网页提取题目');
  console.log('========================================');
  console.log('学科: ' + subject + '  年级: ' + grade);
  console.log('模式: ' + mode + '  每类最多试卷数: ' + maxPapers);
  console.log('');

  ensureDir(OUTPUT_DIR);

  var subjects = subject === 'all' ? appsj.SUBJECT_LIST : [subject];
  var grades = grade === 'all' ? appsj.GRADE_LIST : [grade];
  var allQuestions = [];
  var allMeta = [];

  for (var si = 0; si < subjects.length; si++) {
    for (var gi = 0; gi < grades.length; gi++) {
      var subj = subjects[si];
      var grad = grades[gi];

      // 构建 学科+年级 组合 URL（优先）
      var subjPY = SUBJ_PINYIN[subj];
      var gradePY = GRADE_PINYIN[grad];
      var combinedPath;

      if (subj === '数学') {
        combinedPath = '/' + gradePY + '_s';  // yinianji_s
      } else if (subj === '英语') {
        combinedPath = '/' + gradePY + '_y';
      } else if (subj === '语文') {
        combinedPath = '/' + gradePY;          // 直接用年级路径（包含语文为主）
      } else {
        combinedPath = '/' + gradePY;
      }

      // 也尝试学科路径
      var subjectPath = '/' + subjPY;

      console.log('\n=== ' + subj + ' ' + grad + ' ===');
      console.log('  年级+学科路径: ' + combinedPath);

      if (mode === 'meta') {
        // 元数据模式：爬列表
        try {
          var list = await appsj.crawlList(combinedPath, Math.ceil(maxPapers / 15));
          allMeta = allMeta.concat(list);
          console.log('  获取: ' + list.length + ' 条元数据');
        } catch(e) {
          console.log('  年级路径失败: ' + (e.message || '').substring(0, 60));
          // 回退到学科路径
          try {
            var list2 = await appsj.crawlList(subjectPath, Math.ceil(maxPapers / 15));
            allMeta = allMeta.concat(list2);
            console.log('  学科路径获取: ' + list2.length + ' 条元数据');
          } catch(e2) {
            console.log('  学科路径也失败: ' + (e2.message || '').substring(0, 60));
          }
        }
      } else {
        // 完整管道模式：列表→详情→正文提取→题目解析
        var result;
        try {
          result = await appsj.crawlCategoryFull(combinedPath, {
            maxPages: Math.ceil(maxPapers / 15),
            maxPapers: maxPapers,
            defaultSubject: subj,
            defaultGrade: grad,
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
        } catch(e) {
          console.log('  年级路径失败: ' + (e.message || '').substring(0, 60));
          // 回退到学科路径
          try {
            result = await appsj.crawlCategoryFull(subjectPath, {
              maxPages: Math.ceil(maxPapers / 15),
              maxPapers: maxPapers,
              defaultSubject: subj,
              defaultGrade: grad,
              onProgress: function(info) {
                if (info.stage === 'done' || info.stage === 'error') {
                  console.log('    [' + info.current + '/' + info.total + '] ' +
                    (info.stage === 'done' ? '+' : '!') + ' ' +
                    (info.paperTitle || '').substring(0, 35));
                }
              }
            });
          } catch(e2) {
            console.log('  学科路径也失败: ' + (e2.message || '').substring(0, 60));
            result = { questions: [], papers: [], successCount: 0, failCount: 0 };
          }
        }

        allQuestions = allQuestions.concat(result.questions);

        if (result.successCount > 0) {
          var stats = questionParser.analyzeQuestions(result.questions);
          console.log('\n  本组统计: ' + result.questions.length + ' 题, 题型: ' +
            JSON.stringify(stats.byType));
          console.log('  成功: ' + result.successCount + ' 份, 失败: ' + result.failCount + ' 份');
        }
      }

      if (si < subjects.length - 1 || gi < grades.length - 1) {
        await sleep(2000);
      }
    }
  }

  // ====== 输出结果 ======
  console.log('\n========================================');
  console.log('  爬取完成');
  console.log('========================================');

  if (mode === 'meta') {
    console.log('元数据总数: ' + allMeta.length + ' 条');

    // 按学科年级统计
    var metaStats = {};
    for (var i = 0; i < allMeta.length; i++) {
      var info = appsj.parsePaperTitle(allMeta[i].title);
      var key = (info.subject || '未知') + ' ' + (info.grade || '未知');
      metaStats[key] = (metaStats[key] || 0) + 1;
    }
    console.log('分类统计:');
    for (var k in metaStats) {
      if (metaStats.hasOwnProperty(k)) console.log('  ' + k + ': ' + metaStats[k] + ' 份');
    }

    var fp = path.join(OUTPUT_DIR, 'appsj_meta_' + subject + '_' + grade + '.json');
    fs.writeFileSync(fp, JSON.stringify(allMeta, null, 2), 'utf-8');
    console.log('已保存: ' + fp);
  } else {
    // 去重
    var seen = new Set();
    var unique = [];
    for (var j = 0; j < allQuestions.length; j++) {
      var q = allQuestions[j];
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
    var prefix = 'appsj_full_' + subject + '_' + grade + '_' + maxPapers;
    prefix = prefix.replace(/[/\\]/g, '_');

    var jsonPath = path.join(OUTPUT_DIR, prefix + '.json');
    fs.writeFileSync(jsonPath, JSON.stringify(unique, null, 2), 'utf-8');

    // 云数据库导入格式
    var cloudLines = [];
    var seenCloud = {};
    for (var c = 0; c < unique.length; c++) {
      var qr = unique[c];
      var shortStem = (qr.stem || '').replace(/[\s\n\r\t]+/g, '').substring(0, 80);
      var questionId = crypto.createHash('md5')
        .update(shortStem + '|' + (qr.subject || '') + '|' + (qr.grade || ''))
        .digest('hex');
      if (seenCloud[questionId]) continue;
      seenCloud[questionId] = true;
      cloudLines.push(JSON.stringify({
        questionId: questionId,
        subject: qr.subject,
        grade: qr.grade,
        type: qr.type,
        difficulty: qr.difficulty,
        knowledgePoints: qr.knowledgePoints,
        stem: qr.stem,
        options: qr.options,
        answer: qr.answer,
        explanation: qr.explanation,
        examPoint: qr.examPoint,
        paperSource: qr.paperSource,
        status: 'active'
      }));
    }
    var cloudPath = path.join(OUTPUT_DIR, prefix + '.cloud.jsonl');
    var cloudContent = cloudLines.join('\n') + '\n';
    cloudContent = cloudContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    fs.writeFileSync(cloudPath, cloudContent, 'utf-8');

    var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n耗时: ' + elapsed + ' 秒');
    console.log('输出:');
    console.log('  ' + jsonPath);
    console.log('  ' + cloudPath + ' (' + cloudLines.length + ' 行) → 可直接导入云数据库');
  }
}

main().catch(function(e) {
  console.error('错误: ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
