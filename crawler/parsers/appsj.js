/**
 * 小学试卷网 appsj.szxuexiao.com 爬取解析器
 *
 * 数据管道：
 *   列表页(元数据) → 详情页(HTML中含试卷全文) → 题目解析
 *
 * 与 shijuan1 的关键区别：
 *   - 网页正文(.entry-content)直接包含试卷全文，无需下载 DOCX/RAR
 *   - 下载链接指向百度网盘（含提取码）
 *   - UTF-8 编码（不需要 GBK 转换）
 *
 * URL 结构：
 *   年级列表:  /{yinianji|ernianji|...}/index.html  （分页 index_2.html）
 *   学科列表:  /{yuwen|shuxue|yingyu|kexue}/index.html
 *   年级+学科: /{yinianji_s|ernianji_s|...}/index.html （_s=数学）
 *   详情页:    /html/{id}.html
 *
 * 用法：
 *   const appsj = require('./parsers/appsj');
 *   const result = await appsj.crawlGradeFull('yinianji', { maxPapers: 10 });
 *   const detail = await appsj.crawlDetail('/html/7012.html');
 */

var axios = require('axios');
var cheerio = require('cheerio');
var fs = require('fs');
var path = require('path');

var UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];

var BASE = 'https://appsj.szxuexiao.com';

// ====== URL 映射 ======

var GRADE_MAP = {
  'yinianji':  { num: 1,  zh: '一年级' },
  'ernianji':  { num: 2,  zh: '二年级' },
  'sannianji': { num: 3,  zh: '三年级' },
  'sinianji':  { num: 4,  zh: '四年级' },
  'wunianji':  { num: 5,  zh: '五年级' },
  'liunianji': { num: 6,  zh: '六年级' }
};

// 年级拼音 → 数字
var PINYIN_TO_NUM = {};
for (var k in GRADE_MAP) {
  if (GRADE_MAP.hasOwnProperty(k)) PINYIN_TO_NUM[k] = GRADE_MAP[k].num;
}

// 年级+学科后缀映射（大部分是 _s=数学，有些用 _x=下学期 等）
var SUBJ_SUFFIX_MAP = {
  '_s': '数学',
  '_y': '英语',
  '_k': '科学',
  '_x': '语文'  // 下学期多为语文
};

var SUBJECT_KEY_MAP = {
  'yuwen': '语文',
  'shuxue': '数学',
  'yingyu': '英语',
  'kexue': '科学'
};

var SUBJECT_LIST = ['语文', '数学', '英语', '科学'];
var GRADE_LIST = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];

// ====== 工具函数 ======

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randomUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ====== HTTP 请求 ======

/**
 * UTF-8 编码页面请求（带指数退避重试）
 */
async function fetchUTF8(url, retries) {
  retries = retries || 5;
  var lastErr = null;

  for (var i = 0; i < retries; i++) {
    try {
      var res = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': randomUA(), 'Referer': BASE + '/' },
        maxRedirects: 5,
        validateStatus: function(s) { return s < 400; }
      });
      var $ = cheerio.load(res.data);
      return { html: res.data, $: $, status: res.status };
    } catch(e) {
      lastErr = e;
      if (i < retries - 1) {
        var wait = 1000 * Math.pow(2, i) + rand(0, 500);
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

// ====== 标题解析 ======

/**
 * 从试卷标题中智能提取学科、年级、学期、版本信息
 * 示例标题: "人教版2026一年级数学下册期末模拟试卷及答案（附答案）"
 */
function parsePaperTitle(title) {
  if (!title) return {};

  var info = {};

  // 提取学科
  var subjPatterns = [
    { re: /语文/, subj: '语文' },
    { re: /数学/, subj: '数学' },
    { re: /英语/, subj: '英语' },
    { re: /科学/, subj: '科学' }
  ];
  for (var s = 0; s < subjPatterns.length; s++) {
    if (subjPatterns[s].re.test(title)) {
      info.subject = subjPatterns[s].subj;
      break;
    }
  }

  // 提取年级
  var gradePatterns = [
    { re: /一[年]/, grade: '一年级' },
    { re: /二[年]/, grade: '二年级' },
    { re: /三[年]/, grade: '三年级' },
    { re: /四[年]/, grade: '四年级' },
    { re: /五[年]/, grade: '五年级' },
    { re: /六[年]/, grade: '六年级' }
  ];
  for (var g = 0; g < gradePatterns.length; g++) {
    if (gradePatterns[g].re.test(title)) {
      info.grade = gradePatterns[g].grade;
      break;
    }
  }

  // 提取学期
  if (/下册|下学期|第二学期|春季/.test(title)) {
    info.term = '下学期';
  } else if (/上册|上学期|第一学期|秋季/.test(title)) {
    info.term = '上学期';
  }

  // 提取版本
  var verPatterns = [
    { re: /人教版|人教/, ver: '人教版' },
    { re: /苏教版|苏教/, ver: '苏教版' },
    { re: /北师大/, ver: '北师大版' },
    { re: /教科版|教科/, ver: '教科版' },
    { re: /统编版|统编/, ver: '统编版' },
    { re: /部编版|部编/, ver: '部编版' }
  ];
  for (var v = 0; v < verPatterns.length; v++) {
    if (verPatterns[v].re.test(title)) {
      info.version = verPatterns[v].ver;
      break;
    }
  }

  // 提取年份
  var yearMatch = title.match(/(\d{4})/);
  if (yearMatch) info.year = yearMatch[1];

  return info;
}

// ====== 列表页爬取 ======

/**
 * 爬取单页试卷列表
 * @param {string} url - 列表页完整 URL
 * @returns {{papers: Array, totalPages: number, currentPage: number}}
 */
async function crawlListPage(url) {
  var result = await fetchUTF8(url);
  var $ = result.$;
  var papers = [];

  // 试卷列表在 .col-lg-8 区域内的链接
  // 链接格式: /html/{id}.html
  $('.col-lg-8 a[href*="/html/"]').each(function() {
    var href = $(this).attr('href') || '';
    var text = $(this).text().trim();
    var idMatch = href.match(/\/html\/(\d+)\.html/);
    if (!idMatch || text.length < 8) return;

    papers.push({
      id: parseInt(idMatch[1]),
      title: text,
      url: BASE + href
    });
  });

  // 解析分页信息
  var totalPages = 1;
  var maxPageNum = 0;
  $('.pagination .page-link[href*="index_"]').each(function() {
    var pHref = $(this).attr('href') || '';
    var pMatch = pHref.match(/index_(\d+)\.html/);
    if (pMatch) {
      var p = parseInt(pMatch[1]);
      if (p > maxPageNum) maxPageNum = p;
    }
  });

  // 检查是否有"尾页"链接
  var lastPageLink = $('.pagination .page-link').last().attr('href') || '';
  var lastMatch = lastPageLink.match(/index_(\d+)\.html/);
  if (lastMatch) {
    var lp = parseInt(lastMatch[1]);
    if (lp > maxPageNum) maxPageNum = lp;
  }

  if (maxPageNum > 0) totalPages = maxPageNum;

  return {
    papers: papers,
    totalPages: totalPages
  };
}

/**
 * 爬取分类的多页试卷列表
 * @param {string} basePath - 基础路径，如 '/yinianji'
 * @param {number} maxPages - 最大页数
 */
async function crawlList(basePath, maxPages) {
  maxPages = Math.min(maxPages || 5, 20);
  var allPapers = [];

  // 第1页（index.html）
  var firstUrl = BASE + basePath + '/index.html';
  try {
    var first = await crawlListPage(firstUrl);
    allPapers = allPapers.concat(first.papers);

    // 后续页
    for (var p = 2; p <= Math.min(first.totalPages, maxPages); p++) {
      var pageUrl = BASE + basePath + '/index_' + p + '.html';
      try {
        var page = await crawlListPage(pageUrl);
        if (page.papers.length === 0) break; // 自适应终止
        allPapers = allPapers.concat(page.papers);
      } catch(e) {
        // 某页失败不中断整体流程
        break;
      }
      await sleep(rand(600, 1500));
    }
  } catch(e) {
    // 首页失败
  }

  // 去重（按 id）
  var seen = {};
  var unique = [];
  for (var i = 0; i < allPapers.length; i++) {
    var p = allPapers[i];
    if (!seen[p.id]) {
      seen[p.id] = true;
      unique.push(p);
    }
  }

  return unique;
}

// ====== 详情页爬取 ======

/**
 * 爬取试卷详情页
 * 提取：正文内容（试卷全文）、百度网盘链接、元数据
 */
async function crawlDetail(paperUrl) {
  var result = await fetchUTF8(paperUrl);
  var $ = result.$;

  // 标题
  var title = ($('h1').first().text() || $('title').text() || '').trim();

  // 正文内容（.entry-content 中包含试卷全文）
  // 使用 .html() 获取原始 HTML，转换块级元素为换行，保留内联内容连续
  var entryHtml = ($('.entry-content').html() || '').trim();
  var entryText = entryHtml
    // 将块级标签替换为换行
    .replace(/<\/?(?:p|div|h[1-6]|li|tr|br)[^>]*>/gi, '\n')
    // 移除剩余 HTML 标签
    .replace(/<[^>]+>/g, '')
    // HTML 实体解码
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&middot;/g, '·')
    .replace(/&times;/g, '×')
    .replace(/&divide;/g, '÷')
    // 将全角空格替换为半角空格（保留填空题空格作为内容一部分）
    .replace(/[　]/g, ' ')
    .replace(/\r/g, '')
    // 合并多余空行
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/ {3,}/g, '  ')
    .trim();

  // 百度网盘链接
  var baiduUrl = '';
  var baiduCode = '';
  var baiduMatch = entryText.match(/https?:\/\/pan\.baidu\.com\/s\/[^\s\n]+/);
  if (baiduMatch) {
    baiduUrl = baiduMatch[0];
    var codeMatch = entryText.match(/提取码[：:\s]*(\w{4})/i);
    if (codeMatch) baiduCode = codeMatch[1];
  }

  // 下载区块单独提取
  var downloadText = ($('.download-section').text() || '').trim();
  if (!baiduUrl) {
    var dMatch = downloadText.match(/https?:\/\/pan\.baidu\.com\/s\/[^\s]+/);
    if (dMatch) {
      baiduUrl = dMatch[0];
      var cMatch = downloadText.match(/提取码[：:\s]*(\w{4})/i);
      if (cMatch) baiduCode = cMatch[1];
    }
  }

  // 标签
  var tags = [];
  $('.post-tags a, .tags a').each(function() {
    var t = $(this).text().trim();
    if (t) tags.push(t);
  });

  return {
    title: title,
    contentText: entryText,
    baiduUrl: baiduUrl,
    baiduCode: baiduCode,
    downloadText: downloadText,
    tags: tags,
    url: paperUrl
  };
}

// ====== 题目解析集成 ======

/**
 * 从详情页内容中解析题目
 */
function parseQuestionsFromDetail(detailResult, meta) {
  if (!detailResult.contentText || detailResult.contentText.length < 30) return [];

  var questionParser = require('./questionParser');
  return questionParser.parseQuestions(detailResult.contentText, meta);
}

// ====== 完整管道 ======

/**
 * 按分类完整爬取（含题目解析）
 * @param {string} categoryPath - URL 路径前缀，如 '/yinianji'
 * @param {object} opts - { maxPages, maxPapers, onProgress, fullText }
 */
async function crawlCategoryFull(categoryPath, opts) {
  opts = opts || {};
  var maxPages = opts.maxPages || 2;
  var maxPapers = opts.maxPapers || 10;
  var onProgress = opts.onProgress || function() {};

  // Step 1: 获取试卷列表
  var papers = await crawlList(categoryPath, maxPages);
  papers = papers.slice(0, maxPapers);

  // Step 2: 逐份处理
  var allQuestions = [];
  var successCount = 0;
  var total = papers.length;

  for (var i = 0; i < papers.length; i++) {
    var paper = papers[i];
    var info = parsePaperTitle(paper.title);

    onProgress({
      current: i + 1,
      total: total,
      paperTitle: paper.title,
      stage: 'processing'
    });

    try {
      var detail = await crawlDetail(paper.url);

      var meta = {
        subject: info.subject || opts.defaultSubject || '',
        grade: info.grade || opts.defaultGrade || '',
        version: info.version || '',
        term: info.term || '',
        year: info.year || '',
        paperId: paper.id,
        paperTitle: paper.title,
        paperUrl: paper.url
      };

      // 解析题目
      var questions = parseQuestionsFromDetail(detail, meta);

      // 添加来源标记
      for (var q = 0; q < questions.length; q++) {
        questions[q].paperSource = 'appsj:' + paper.id;
        questions[q].sourceTitle = paper.title;
        questions[q].sourceUrl = paper.url;
        questions[q].baiduUrl = detail.baiduUrl;
        questions[q].baiduCode = detail.baiduCode;
      }

      allQuestions = allQuestions.concat(questions);
      successCount++;

      onProgress({
        current: i + 1,
        total: total,
        paperTitle: paper.title,
        stage: 'done',
        questionCount: questions.length
      });
    } catch(e) {
      onProgress({
        current: i + 1,
        total: total,
        paperTitle: paper.title,
        stage: 'error',
        error: (e.message || '').substring(0, 100)
      });
    }

    // 请求间隔
    if (i < papers.length - 1) {
      await sleep(rand(800, 2000));
    }
  }

  return {
    totalPapers: total,
    successCount: successCount,
    failCount: total - successCount,
    questions: allQuestions,
    papers: papers
  };
}

/**
 * 按年级爬取
 * @param {string} gradeName - '一年级' 或拼音 'yinianji'
 */
async function crawlByGrade(gradeName, opts) {
  var pinyin = gradeName;
  var gradeZh = GRADE_MAP[gradeName] ? GRADE_MAP[gradeName].zh : gradeName;

  // 如果传入的是中文名，反查拼音
  if (!GRADE_MAP[gradeName]) {
    for (var k in GRADE_MAP) {
      if (GRADE_MAP.hasOwnProperty(k) && GRADE_MAP[k].zh === gradeName) {
        pinyin = k;
        break;
      }
    }
  }

  return await crawlCategoryFull('/' + pinyin, Object.assign({}, opts, {
    defaultGrade: gradeZh
  }));
}

/**
 * 按学科爬取
 * @param {string} subjectKey - 'shuxue' 或 '数学'
 */
async function crawlBySubject(subjectKey, opts) {
  var pinyin = subjectKey;
  var subjectZh = SUBJECT_KEY_MAP[subjectKey] || subjectKey;

  // 反查
  if (!SUBJECT_KEY_MAP[subjectKey]) {
    for (var k in SUBJECT_KEY_MAP) {
      if (SUBJECT_KEY_MAP.hasOwnProperty(k) && SUBJECT_KEY_MAP[k] === subjectKey) {
        pinyin = k;
        break;
      }
    }
  }

  return await crawlCategoryFull('/' + pinyin, Object.assign({}, opts, {
    defaultSubject: subjectZh
  }));
}

// ====== 导出 ======

module.exports = {
  BASE: BASE,
  GRADE_MAP: GRADE_MAP,
  SUBJECT_KEY_MAP: SUBJECT_KEY_MAP,
  SUBJECT_LIST: SUBJECT_LIST,
  GRADE_LIST: GRADE_LIST,

  // 核心 API
  fetchUTF8: fetchUTF8,
  crawlListPage: crawlListPage,
  crawlList: crawlList,
  crawlDetail: crawlDetail,
  parsePaperTitle: parsePaperTitle,
  parseQuestionsFromDetail: parseQuestionsFromDetail,
  crawlCategoryFull: crawlCategoryFull,
  crawlByGrade: crawlByGrade,
  crawlBySubject: crawlBySubject
};
