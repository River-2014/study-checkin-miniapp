/**
 * autoCrawl 云函数 v1
 * 根据输入 URL 自动识别网站类型并爬取，支持题库模式和试卷模式
 *
 * 入参：{ url, mode, subject?, grade?, selector? }
 *   mode: 'questions' | 'papers'
 *
 * 限制：单次最多 20 页 / 50 道，超时 60s，每用户每分钟最多 3 次
 */

var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var https = require('https');
var http = require('http');

var adapters = require('./crawler-adapters');
var detectSite = adapters.detectSite;
var genericExtract = adapters.genericExtract;
var stemHash = adapters.stemHash;

var TIMEOUT = 15000;
var MAX_QUESTIONS = 50;
var RATE_LIMIT_WINDOW = 60;     // 秒
var RATE_LIMIT_MAX = 3;         // 每窗口最多调用次数

// ========== HTTP 请求 ==========

function httpGet(url) {
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    var timer = setTimeout(function() {
      req.destroy();
      reject(new Error('请求超时'));
    }, TIMEOUT);
    var req = mod.get(url, {
      headers: { 'User-Agent': adapters.UA, 'Accept': 'text/html,application/xhtml+xml' }
    }, function(res) {
      clearTimeout(timer);
      var chunks = [];
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location.startsWith('http') ? res.headers.location : url).then(resolve).catch(reject);
        return;
      }
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf-8')); });
    });
    req.on('error', function(e) {
      clearTimeout(timer);
      reject(e);
    });
  });
}

// ========== URL 合法性校验 ==========

function validateUrl(url) {
  if (!url || typeof url !== 'string') return { valid: false, error: '请输入网址' };
  var urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return { valid: false, error: '网址格式不正确' };
  }
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    return { valid: false, error: '仅支持 http/https 协议' };
  }
  // 禁止内网IP
  var hostname = urlObj.hostname || '';
  var parts = hostname.split('.');
  if (/^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname)) {
    return { valid: false, error: '不支持内网地址' };
  }
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return { valid: false, error: '不支持本机地址' };
  }
  return { valid: true, url: url, hostname: hostname };
}

// ========== 频率限制 ==========

async function checkRateLimit(openid) {
  if (!openid) return true; // 无 openid 时放行（开发环境）
  var now = Date.now();
  var windowStart = now - RATE_LIMIT_WINDOW * 1000;
  try {
    var coll = db.collection('crawl_rate_limits');
    var result = await coll
      .where({ openid: openid, timestamp: db.command.gte(windowStart) })
      .count();
    if (result.total >= RATE_LIMIT_MAX) {
      return false;
    }
    // 记录本次调用
    await coll.add({ data: { openid: openid, timestamp: now } });
    // 清理过期记录
    try {
      var oldRecords = await coll
        .where({ timestamp: db.command.lt(windowStart) })
        .limit(50)
        .get();
      for (var i = 0; i < oldRecords.data.length; i++) {
        await coll.doc(oldRecords.data[i]._id).remove();
      }
    } catch (_) {}
    return true;
  } catch (e) {
    // 限制集合不存在时放行
    if (e.errCode === -502005) return true;
    return true;
  }
}

// ========== 去重 + 入库 ==========

async function saveQuestions(questions) {
  if (!questions || questions.length === 0) return 0;
  var coll = db.collection('exam_questions');
  var inserted = 0;
  for (var i = 0; i < Math.min(questions.length, MAX_QUESTIONS); i++) {
    var q = questions[i];
    if (!q.stem || q.stem.length < 3) continue;
    try {
      // MD5 去重
      var sh = stemHash(q.stem);
      var exist = await coll.where({ stemHash: sh }).count();
      if (exist.total > 0) continue;
      q.stemHash = sh;
      q.createdAt = db.serverDate();
      await coll.add({ data: q });
      inserted++;
    } catch (e) {
      // 跳过入库失败的单条
    }
  }
  return inserted;
}

async function savePapers(papers) {
  if (!papers || papers.length === 0) return 0;
  var coll = db.collection('examination_papers');
  var inserted = 0;
  for (var i = 0; i < Math.min(papers.length, MAX_QUESTIONS); i++) {
    var p = papers[i];
    if (!p.title || p.title.length < 3) continue;
    try {
      // 标题+来源URL 去重
      var exist = await coll.where({ title: p.title, paperSource: p.paperSource }).count();
      if (exist.total > 0) continue;
      p.createdAt = db.serverDate();
      p.updatedAt = db.serverDate();
      await coll.add({ data: p });
      inserted++;
    } catch (e) {
      // 跳过
    }
  }
  return inserted;
}

// ========== 主入口 ==========

exports.main = async function(event, context) {
  var url = event.url || '';
  var mode = event.mode || 'questions';  // 'questions' | 'papers'
  var subject = event.subject || '数学';
  var grade = event.grade || '六年级';
  var selector = event.selector || '';

  var startTime = Date.now();

  // 1. URL 校验
  var urlCheck = validateUrl(url);
  if (!urlCheck.valid) {
    return { success: false, error: urlCheck.error, crawled: 0, inserted: 0 };
  }

  // 2. 频率限制
  var openid = cloud.getWXContext().OPENID || '';
  var allowed = await checkRateLimit(openid);
  if (!allowed) {
    return {
      success: false,
      error: '操作太频繁，请 ' + RATE_LIMIT_WINDOW + ' 秒后再试（每分钟最多 ' + RATE_LIMIT_MAX + ' 次）',
      crawled: 0, inserted: 0
    };
  }

  // 3. 检测网站类型
  var site = detectSite(url);
  if (!site) {
    return { success: false, error: '无法识别该网站', crawled: 0, inserted: 0 };
  }

  // 4. 请求页面
  var html;
  try {
    html = await httpGet(url);
  } catch (e) {
    return {
      success: false,
      error: '请求页面失败: ' + (e.message || '').substring(0, 100),
      crawled: 0, inserted: 0
    };
  }

  if (!html || html.length < 100) {
    return { success: false, error: '页面内容为空或太短（可能需 JavaScript 渲染）', crawled: 0, inserted: 0 };
  }

  // 5. 内容提取
  var result = { questions: [], papers: [] };

  switch (site.name) {
    case 'shijuan1':
      result = adapters.adaptShijuan1(html, url);
      break;
    case 'tiku':
      result = adapters.adaptTiku(html, url);
      break;
    case '51jiaoxi':
    case '5ykj':
    case 'zujuan':
    default:
      // 通用提取
      result = genericExtract(html, { subject: subject, grade: grade, selector: selector });
      break;
  }

  var totalCrawled = result.questions.length + result.papers.length;

  // 6. 入库
  var inserted = 0;

  if (mode === 'questions') {
    inserted = await saveQuestions(result.questions);
  } else if (mode === 'papers') {
    inserted = await savePapers(result.papers);
    // 试卷模式下也尝试把题目入库
    if (result.questions.length > 0) {
      var qInserted = await saveQuestions(result.questions);
      inserted += qInserted;
    }
  }

  var elapsed = Math.round((Date.now() - startTime) / 1000);

  return {
    success: true,
    site: site.name,
    mode: mode,
    crawled: totalCrawled,
    questionsCount: result.questions.length,
    papersCount: result.papers.length,
    inserted: inserted,
    skipped: totalCrawled - inserted,
    elapsedSeconds: elapsed
  };
};
