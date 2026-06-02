/**
 * 第一试卷网 www.shijuan1.com 爬取解析器 v3.0
 *
 * 完整管道：
 *   列表页(元数据) → 详情页(下载链接) → RAR下载 → DOCX文本提取 → 题目解析
 *
 * URL 结构：
 *   列表页: /a/sjsx{1-6}/     （数学 1-6 年级）
 *          /a/sjyw{1-6}/     （语文 1-6 年级）
 *          /a/sjyy{1-6}/     （英语 1-6 年级）
 *   分页:   list_{catId}_{page}.html
 *   详情:   /a/sjsx{grade}/{id}.html
 *   下载:   /uploads/soft/sj{year}/{subject}/{grade}/{file}.rar
 *
 * 特性：
 *   - GBK 编码，iconv-lite 解码
 *   - RAR 内包含 .docx 文件，mammoth 提取文本
 *   - 支持断点续传（progress.json）
 *   - 指数退避重试
 *   - 请求间隔控制
 */

var axios = require('axios');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
];

function randomUA() {
  return UA_LIST[Math.floor(Math.random() * UA_LIST.length)];
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}
var BASE = 'https://www.shijuan1.com';

// 学科+年级 → URL 路径
var PATH_MAP = {
  '小学数学': { path: '/a/sjsx', grades: [1,2,3,4,5,6] },
  '小学语文': { path: '/a/sjyw', grades: [1,2,3,4,5,6] },
  '小学英语': { path: '/a/sjyy', grades: [1,2,3,4,5,6] }
};

// ====== 工具函数 ======

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ====== HTTP 请求 ======

/**
 * GBK 编码页面请求（带重试）
 */
async function fetchGBK(url, retries) {
  retries = retries || 5;
  var lastErr = null;

  for (var i = 0; i < retries; i++) {
    try {
      var res = await axios.get(url, {
        timeout: 20000,
        headers: { 'User-Agent': randomUA(), 'Referer': BASE + '/' },
        responseType: 'arraybuffer',
        maxRedirects: 5,
        validateStatus: function(s) { return s < 400; }
      });
      var html = iconv.decode(Buffer.from(res.data), 'gbk');
      return { html: html, $: cheerio.load(html), status: res.status };
    } catch(e) {
      lastErr = e;
      if (i < retries - 1) {
        await sleep(1000 * Math.pow(2, i) + rand(0, 800));
      }
    }
  }
  throw lastErr;
}

// ====== 列表页爬取 ======

/**
 * 爬取单个年级的一页试卷列表
 */
async function crawlListPage(subjectKey, grade, pageNum) {
  var info = PATH_MAP[subjectKey];
  if (!info) throw new Error('未知学科: ' + subjectKey);

  var baseUrl = BASE + info.path + grade + '/';
  var url = pageNum > 1 ? baseUrl + 'list_' + 0 + '_' + pageNum + '.html' : baseUrl;

  var result = await fetchGBK(url);
  var $ = result.$;
  var papers = [];

  $('table tr').each(function() {
    var titleEl = $(this).find('a.title');
    if (titleEl.length === 0) return;

    var href = titleEl.attr('href') || '';
    var title = titleEl.text().trim();
    var tds = $(this).find('td');
    if (tds.length < 5 || !title) return;

    var idMatch = href.match(/(\d+)\.html/);
    papers.push({
      id: idMatch ? parseInt(idMatch[1]) : 0,
      title: title,
      url: href.startsWith('http') ? href : BASE + href,
      fileType: (tds.eq(1).text() || '').trim(),
      category: (tds.eq(2).text() || '').trim(),
      version: (tds.eq(3).text() || '').trim(),
      size: (tds.eq(4).text() || '').trim(),
      date: (tds.eq(5).text() || '').trim(),
      subject: subjectKey,
      grade: grade + '年级'
    });
  });

  // 解析分页信息
  var totalPages = 1;
  var totalCount = papers.length;
  var catId = 0;

  var pageInfo = $('.pagelist .pageinfo').text().trim();
  var tpMatch = pageInfo.match(/共\s*(\d+)\s*页(\d+)\s*条/);
  if (tpMatch) {
    totalPages = parseInt(tpMatch[1]);
    totalCount = parseInt(tpMatch[2]);
  }

  // 获取 catId（第一页才有）
  if (pageNum === 1) {
    var pageLink = $('.pagelist a[href*="list_"]').first().attr('href') || '';
    var catMatch = pageLink.match(/list_(\d+)_(\d+)\.html/);
    if (catMatch) catId = parseInt(catMatch[1]);
  }

  return {
    papers: papers,
    totalCount: totalCount,
    totalPages: totalPages,
    catId: catId,
    baseUrl: baseUrl
  };
}

/**
 * 爬取整个年级的多页试卷列表
 */
async function crawlGradeList(subjectKey, grade, maxPages) {
  maxPages = Math.min(maxPages || 3, 30);
  var allPapers = [];
  var catId = 0;
  var baseUrl = '';

  // 第1页（获取 catId、总页数）
  var first = await crawlListPage(subjectKey, grade, 1);
  allPapers = allPapers.concat(first.papers);
  catId = first.catId;
  baseUrl = first.baseUrl;

  // 后续页（自适应终止：连续空页即停止）
  if (catId > 0 && first.totalPages > 1) {
    var pages = Math.min(first.totalPages, maxPages);
    var emptyCount = 0;
    for (var p = 2; p <= pages; p++) {
      try {
        var url = baseUrl + 'list_' + catId + '_' + p + '.html';
        var result = await fetchGBK(url);
        var $ = result.$;
        var pagePapers = 0;
        $('table tr').each(function() {
          var titleEl = $(this).find('a.title');
          if (titleEl.length === 0) return;
          var href = titleEl.attr('href') || '';
          var title = titleEl.text().trim();
          var tds = $(this).find('td');
          if (tds.length < 5 || !title) return;
          var idMatch = href.match(/(\d+)\.html/);
          allPapers.push({
            id: idMatch ? parseInt(idMatch[1]) : 0,
            title: title,
            url: href.startsWith('http') ? href : BASE + href,
            fileType: (tds.eq(1).text() || '').trim(),
            category: (tds.eq(2).text() || '').trim(),
            version: (tds.eq(3).text() || '').trim(),
            size: (tds.eq(4).text() || '').trim(),
            date: (tds.eq(5).text() || '').trim(),
            subject: subjectKey,
            grade: grade + '年级'
          });
          pagePapers++;
        });

        if (pagePapers === 0) {
          emptyCount++;
          if (emptyCount >= 2) break; // 连续2页为空，自适应终止
        } else {
          emptyCount = 0;
        }
      } catch(e) {
        // 某页出错不中断，但累计空页
        emptyCount++;
        if (emptyCount >= 2) break;
      }
      await sleep(rand(500, 2000));
    }
  }

  return {
    papers: allPapers,
    totalCount: first.totalCount,
    totalPages: first.totalPages
  };
}

// ====== 详情页爬取 ======

/**
 * 爬取试卷详情页，提取下载链接和相关信息
 */
async function crawlDetail(paperUrl) {
  var result = await fetchGBK(paperUrl);
  var $ = result.$;

  var downloadUrl = '';
  $('.downurllist a[href]').each(function() {
    var href = $(this).attr('href') || '';
    if (href && !downloadUrl) {
      downloadUrl = href.startsWith('http') ? href : BASE + href;
    }
  });

  // 相关试卷
  var related = [];
  $('a[href*=".html"]').each(function() {
    var href = $(this).attr('href') || '';
    var text = $(this).text().trim();
    if (href.indexOf('/a/sj') === 0 && text.length > 5) {
      var idMatch = href.match(/(\d+)\.html/);
      if (idMatch && parseInt(idMatch[1]) > 1000) {
        related.push({
          id: parseInt(idMatch[1]),
          title: text,
          url: BASE + href
        });
      }
    }
  });

  // 内容描述
  var description = ($('.content').text() || '').trim();
  var intro = ($('.intro').text() || '').trim();

  return {
    downloadUrl: downloadUrl,
    relatedPapers: related.slice(0, 20), // 最多20个相关
    description: description,
    intro: intro
  };
}

// ====== RAR 下载与解压 ======

/**
 * 下载 RAR 文件（带缓存）
 */
async function downloadRar(url, cacheDir) {
  ensureDir(cacheDir);

  var urlHash = md5(url);
  var rarPath = path.join(cacheDir, urlHash + '.rar');
  var metaPath = path.join(cacheDir, urlHash + '.meta.json');

  // 检查缓存
  if (fs.existsSync(rarPath) && fs.existsSync(metaPath)) {
    var meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return { rarPath: rarPath, cached: true, size: meta.size };
  }

  var res = await axios.get(url, {
    timeout: 120000,
    headers: { 'User-Agent': randomUA(), 'Referer': BASE + '/' },
    responseType: 'arraybuffer',
    maxRedirects: 5,
    validateStatus: function(s) { return s < 400; }
  });

  fs.writeFileSync(rarPath, Buffer.from(res.data));
  fs.writeFileSync(metaPath, JSON.stringify({
    url: url, size: res.data.length, downloadedAt: new Date().toISOString()
  }));

  return { rarPath: rarPath, cached: false, size: res.data.length };
}

/**
 * 解压 RAR 并提取 DOCX 文本
 */
async function extractRarAndText(rarPath, extractDir) {
  ensureDir(extractDir);

  var unrar = require('node-unrar-js');
  var extractor = await unrar.createExtractorFromFile({
    filepath: rarPath,
    targetPath: extractDir
  });

  // 获取文件列表
  var list = extractor.getFileList();
  var headers = [];
  for (var fh of list.fileHeaders) {
    headers.push(fh);
  }

  // 找到 DOCX 文件并解压
  var docxHeaders = headers.filter(function(h) {
    return h.name.toLowerCase().endsWith('.docx');
  });

  if (docxHeaders.length === 0) {
    return { extractedFiles: headers.map(function(h) { return h.name; }), text: '' };
  }

  // 解压（只提取 DOCX）
  var docxName = docxHeaders[0].name;
  var result = extractor.extract({
    files: function(fh) { return fh.name === docxName; }
  });

  // 消费 generator
  for (var file of result.files) {
    // 解压完成
  }

  var docxPath = path.join(extractDir, docxName);
  if (!fs.existsSync(docxPath)) {
    return { extractedFiles: headers.map(function(h) { return h.name; }), text: '' };
  }

  // mammoth 提取文本
  var mammoth = require('mammoth');
  var mResult = await mammoth.extractRawText({ path: docxPath });

  return {
    extractedFiles: headers.map(function(h) { return h.name; }),
    docxPath: docxPath,
    text: mResult.value || ''
  };
}

// ====== 题目解析（使用 questionParser 模块）=====

/**
 * 格式化年级：将 "6年级" 转成 "六年级"
 */
var GRADE_NUM_TO_CHINESE = {
  '1': '一年级', '2': '二年级', '3': '三年级',
  '4': '四年级', '5': '五年级', '6': '六年级'
};

function formatGrade(grade) {
  if (!grade) return '';
  // 如果已经是中文格式，直接返回
  if (/^[一二三四五六]年级$/.test(grade)) return grade;
  // "6年级" → "六年级"
  var num = String(grade).replace(/[^0-9]/g, '');
  return GRADE_NUM_TO_CHINESE[num] || grade;
}

/**
 * 从 "小学数学" 中提取 "数学"
 */
function formatSubject(subjectKey) {
  if (!subjectKey) return '';
  return subjectKey.replace('小学', '');
}

/**
 * 过滤噪音行（section 描述、指令等非题目内容）
 */
var NOISE_PATTERNS = [
  /^考试时间/, /^测试内容/, /^满分/, /^姓名/, /^班级/,
  /^座位/, /^装.*订/, /^…/, /^\.{3,}/, /^得分/,
  /^注意/, /^答题/, /^说[:：]明/,
  /^题[:：]号/, /^题号/,
  /^一[、.].*题/, /^二[、.].*题/, /^三[、.].*题/,
  /^四[、.].*题/, /^五[、.].*题/, /^六[、.].*题/,
  /^[一二三四五六七八九十]+[、.]?\s*(?:填空|选择|判断|计算|简答|应用|作图|操作|解决|直接|能简)/
];

// 额外过滤：纯指令行（长度<12字且是操作指令）
var SHORT_INSTRUCTIONS = [
  '按要求画面', '按要求填填', '按要求填空', '按要求连线',
  '按要求画一画', '按要求填一填'
];

function isNoiseLine(line) {
  if (!line || line.length < 3) return true;
  for (var i = 0; i < NOISE_PATTERNS.length; i++) {
    if (NOISE_PATTERNS[i].test(line)) return true;
  }
  // 检查短指令
  for (var j = 0; j < SHORT_INSTRUCTIONS.length; j++) {
    if (line.indexOf(SHORT_INSTRUCTIONS[j]) === 0 && line.length < 15) return true;
  }
  return false;
}

function parseQuestionsFromText(text, meta) {
  if (!text || text.length < 20) return [];

  // 使用 questionParser 做核心解析
  var questionParser = require('./questionParser');
  var formattedMeta = {
    subject: formatSubject(meta.subject),
    grade: formatGrade(meta.grade),
    paperId: meta.paperId,
    paperTitle: meta.paperTitle,
    paperUrl: meta.paperUrl
  };

  var questions = questionParser.parseQuestions(text, formattedMeta);

  // 补充 paper 元数据
  for (var i = 0; i < questions.length; i++) {
    questions[i].paperSource = 'shijuan1:' + (meta.paperId || '');
    questions[i].sourceTitle = meta.paperTitle || '';
    questions[i].sourceUrl = meta.paperUrl || '';

    // 过滤噪音
    if (isNoiseLine(questions[i].stem)) {
      questions[i]._skip = true;
    }
  }

  // 过滤掉噪音行
  questions = questions.filter(function(q) { return !q._skip; });

  return questions;
}

// ====== 进度管理 ======

var PROGRESS_FILE = '';

function setProgressFile(filePath) {
  PROGRESS_FILE = filePath;
}

function loadProgress() {
  if (!PROGRESS_FILE || !fs.existsSync(PROGRESS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch(e) {
    return {};
  }
}

function saveProgress(data) {
  if (!PROGRESS_FILE) return;
  ensureDir(path.dirname(PROGRESS_FILE));
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ====== 完整管道 ======

/**
 * 爬取并提取单个试卷的题目
 * 完整管道：详情页 → 下载 → 解压 → 文本提取 → 题目解析
 */
async function crawlAndExtractPaper(paperMeta, cacheDir, extractDir) {
  var paperId = paperMeta.id;
  var result = {
    paperId: paperId,
    paperTitle: paperMeta.title,
    paperUrl: paperMeta.url,
    downloadUrl: '',
    extractedText: '',
    questions: [],
    error: null,
    stage: 'init'
  };

  try {
    // Stage 1: 详情页 → 下载链接
    result.stage = 'detail';
    var detail = await crawlDetail(paperMeta.url);
    result.downloadUrl = detail.downloadUrl;

    if (!detail.downloadUrl) {
      result.error = '无下载链接（可能为非DOC/RAR资源）';
      return result;
    }

    // Stage 2: 下载 RAR
    result.stage = 'download';
    await sleep(rand(500, 2000));
    var dlResult = await downloadRar(detail.downloadUrl, cacheDir);

    // Stage 3: 解压 + 提取文本
    result.stage = 'extract';
    var extractResult = await extractRarAndText(dlResult.rarPath, extractDir);
    result.extractedText = extractResult.text;

    if (!extractResult.text || extractResult.text.length < 20) {
      result.error = '文本提取为空（可能文件格式不支持）';
      return result;
    }

    // Stage 4: 解析题目
    result.stage = 'parse';
    var meta = {
      subject: paperMeta.subject,
      grade: paperMeta.grade,
      paperId: paperId,
      paperTitle: paperMeta.title,
      paperUrl: paperMeta.url
    };
    result.questions = parseQuestionsFromText(extractResult.text, meta);

  } catch(e) {
    result.error = '[' + result.stage + '] ' + (e.message || '').substring(0, 150);
  }

  return result;
}

/**
 * 批量爬取年级试卷（含完整管道）
 * @param {string} subjectKey - '小学数学' / '小学语文' / '小学英语'
 * @param {number} grade - 1-6
 * @param {object} opts - { maxPages, maxPapers, cacheDir, extractDir, onProgress }
 */
async function crawlGradeFull(subjectKey, grade, opts) {
  opts = opts || {};
  var maxPages = opts.maxPages || 3;
  var maxPapers = opts.maxPapers || 10;
  var cacheDir = opts.cacheDir || path.join(__dirname, '..', 'output', 'cache');
  var extractDir = opts.extractDir || path.join(__dirname, '..', 'output', 'extract');
  var onProgress = opts.onProgress || function() {};

  ensureDir(cacheDir);
  ensureDir(extractDir);

  // Step 1: 获取试卷列表
  var listResult = await crawlGradeList(subjectKey, grade, maxPages);
  var papers = listResult.papers.slice(0, maxPapers);

  // Step 2: 逐份处理试卷
  var allQuestions = [];
  var successCount = 0;
  var failCount = 0;

  for (var i = 0; i < papers.length; i++) {
    var paper = papers[i];
    onProgress({
      current: i + 1,
      total: papers.length,
      paperTitle: paper.title,
      stage: 'processing'
    });

    var result = await crawlAndExtractPaper(paper, cacheDir, extractDir);

    if (result.error) {
      failCount++;
      onProgress({
        current: i + 1,
        total: papers.length,
        paperTitle: paper.title,
        stage: 'error',
        error: result.error
      });
    } else {
      successCount++;
      allQuestions = allQuestions.concat(result.questions);
      onProgress({
        current: i + 1,
        total: papers.length,
        paperTitle: paper.title,
        stage: 'done',
        questionCount: result.questions.length
      });
    }
  }

  return {
    subject: subjectKey,
    grade: grade,
    totalPapers: papers.length,
    successCount: successCount,
    failCount: failCount,
    questions: allQuestions
  };
}

// ====== 导出 ======

module.exports = {
  PATH_MAP: PATH_MAP,
  BASE: BASE,

  // 核心 API
  fetchGBK: fetchGBK,
  crawlListPage: crawlListPage,
  crawlGradeList: crawlGradeList,
  crawlDetail: crawlDetail,
  downloadRar: downloadRar,
  extractRarAndText: extractRarAndText,
  parseQuestionsFromText: parseQuestionsFromText,
  crawlAndExtractPaper: crawlAndExtractPaper,
  crawlGradeFull: crawlGradeFull,

  // 进度管理
  setProgressFile: setProgressFile,
  loadProgress: loadProgress,
  saveProgress: saveProgress
};
