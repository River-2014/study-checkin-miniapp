/**
 * crawlQuestions 云函数 v2
 * 支持自定义URL爬取 + 直接入库
 *
 * 入参：{ customUrl, selector, subject, grade }
 * 部署：上传并部署 + 超时时间建议设为 60s
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const TIMEOUT = 8000;
const UA = 'Mozilla/5.0 (compatible; EduCrawler/2.1)';

// ========== 工具 ==========

function stemHash(s) {
  return crypto.createHash('md5').update((s || '').replace(/[\s\n\r\t]+/g, '')).digest('hex');
}
function cleanText(s) {
  return (s || '').replace(/[\s\n\r\t]+/g, ' ').replace(/[　\u00A0]/g, '').trim();
}
function httpGet(url) {
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    var req = mod.get(url, {
      timeout: TIMEOUT,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' }
    }, function(res) {
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks).toString('utf-8')); });
    });
    req.on('error', function(e) { reject(e); });
  });
}

/** 从 HTML 中提取可能的题目文本 */
function extractQuestions(html, subject, grade, selector) {
  var results = [];
  // 简单正则提取：匹配被指定选择器包裹的文本块
  var patterns = [
    /<[^>]*class="[^"]*(?:question|ques|exam|test|stem)[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/[^>]+>/gi,
    /<p[^>]*>\s*(\d+[\.\、\)）][\s\S]*?)\s*<\/p>/gi,
    /<li[^>]*>\s*(\d+[\.\、\)）][\s\S]*?)\s*<\/li>/gi,
    /<div[^>]*>\s*(\d+[\.\、\)）][^<]{10,}?(?:[?？]|$))\s*<\/div>/gi
  ];

  for (var p = 0; p < patterns.length; p++) {
    var matches = html.match(patterns[p]) || [];
    for (var m = 0; m < matches.length; m++) {
      var text = cleanText(matches[m].replace(/<[^>]+>/g, ''));
      if (!text || text.length < 8) continue;
      // 只保留看起来像题目的文本
      if (/^\d+[\.\、]/.test(text) || /[?？]$/.test(text) || /选出|下列|正确的|填空|判断|计算/.test(text)) {
        results.push({
          subject: subject, grade: grade,
          type: '填空题',
          difficulty: '基础巩固',
          knowledgePoints: [],
          stem: text.substring(0, 500),
          options: [], answer: '', explanation: '',
          examPoint: '', paperSource: 'crawl-url',
          status: 'active',
          usageCount: 0, correctCount: 0,
          createdAt: db.serverDate()
        });
      }
    }
    if (results.length > 0) break; // 一个模式匹配到就停止
  }
  return results;
}

// ========== 入库（带去重） ==========

async function insertQuestions(questions) {
  if (questions.length === 0) return 0;
  var coll = db.collection('exam_questions');
  var inserted = 0;

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    if (!q.stem || q.stem.length < 3) continue;
    try {
      var prefix = q.stem.substring(0, 15);
      var existing = await coll.where({
        stem: db.RegExp({ regexp: prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
      }).count();
      if (existing.total > 0) continue;
      await coll.add({ data: q });
      inserted++;
    } catch (e) {
      // 跳过
    }
  }
  return inserted;
}

// ========== 主入口 ==========

exports.main = async function(event) {
  // 管理员鉴权
  var { OPENID } = cloud.getWXContext();
  var adminDoc = await db.collection('admins').where({ _openid: OPENID }).get();
  if (!adminDoc.data || adminDoc.data.length === 0) {
    return { success: false, error: '无权限' };
  }

  var subject = event.subject || '数学';
  var grade = event.grade || '六年级';
  var customUrl = event.customUrl || '';
  var selector = event.selector || '.question';

  var startTime = Date.now();
  var allQuestions = [];

  if (customUrl) {
    // SSRF防护：校验URL仅允许公网域名
    var urlCheck;
    try { urlCheck = new (require('url').URL)(customUrl); } catch(e) { return { success: false, error: 'URL格式无效' }; }
    var hostname = urlCheck.hostname;
    var blocked = ['127.0.0.1','localhost','169.254.169.254','metadata.google.internal','0.0.0.0','[::1]'];
    if (blocked.indexOf(hostname) !== -1 || hostname.match(/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/)) {
      return { success: false, error: '不允许访问内网地址' };
    }
    if (urlCheck.protocol !== 'http:' && urlCheck.protocol !== 'https:') {
      return { success: false, error: '仅支持http/https协议' };
    }
    try {
      var html = await httpGet(customUrl);
      allQuestions = extractQuestions(html, subject, grade, selector);
    } catch (e) {
      return { success: false, error: 'URL请求失败: ' + (e.message || '').substring(0, 100), crawled: 0, inserted: 0 };
    }
  } else {
    return { success: false, error: '请提供 customUrl 参数', crawled: 0, inserted: 0 };
  }

  var inserted = 0;
  try {
    inserted = await insertQuestions(allQuestions);
  } catch (e) {
    return { success: false, error: '入库失败: ' + e.message, crawled: allQuestions.length, inserted: 0 };
  }

  return {
    success: true,
    crawled: allQuestions.length,
    inserted: inserted,
    skipped: allQuestions.length - inserted,
    elapsedSeconds: Math.round((Date.now() - startTime) / 1000)
  };
};
