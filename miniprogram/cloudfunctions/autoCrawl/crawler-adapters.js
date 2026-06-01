/**
 * crawler-adapters.js — 网站爬虫适配器集合
 * 每个适配器接收 (html, url, options) 返回 { questions: [], paper: null }
 * 公共工具：detectSite、stemHash、cleanText、genericExtract
 */

var crypto = require('crypto');

var UA = 'Mozilla/5.0 (compatible; EduCrawler/2.3)';

function stemHash(s) {
  return crypto.createHash('md5').update((s || '').replace(/[\s\n\r\t]+/g, '')).digest('hex');
}

function cleanText(s) {
  return (s || '').replace(/[\s\n\r\t]+/g, ' ').replace(/[　\u00A0]/g, '').trim();
}

function estimatedDifficulty(text) {
  // 根据题干长度和关键词判断难度
  if (!text) return '基础巩固';
  if (text.length > 80) return '冲刺拔高';
  if (text.length > 40) return '能力提升';
  return '基础巩固';
}

/**
 * 检测网站类型
 * @param {string} url
 * @returns {{ name: string, type: string } | null}
 */
function detectSite(url) {
  if (!url) return null;
  try {
    var host = new URL(url).hostname.toLowerCase();
  } catch (e) {
    return null;
  }
  if (host.indexOf('shijuan1.com') !== -1)    return { name: 'shijuan1', type: 'paper_list' };
  if (host.indexOf('tiku.cn') !== -1)         return { name: 'tiku', type: 'paper_list' };
  if (host.indexOf('51jiaoxi.com') !== -1)    return { name: '51jiaoxi', type: 'question_page' };
  if (host.indexOf('5ykj.com') !== -1)        return { name: '5ykj', type: 'question_page' };
  if (host.indexOf('zujuan.com') !== -1)      return { name: 'zujuan', type: 'paper_page' };
  // 通用兜底——任何包含题目标记的页面
  return { name: 'generic', type: 'question_page' };
}

/**
 * 通用HTML题目提取器（适用于任何含题目文本的静态页面）
 * @param {string} html
 * @param {{ subject: string, grade: string, selector: string }} options
 * @returns {{ questions: Array }}
 */
function genericExtract(html, options) {
  options = options || {};
  var subject = options.subject || '数学';
  var grade = options.grade || '六年级';
  var selector = options.selector || '';
  var results = [];

  // 如果指定了选择器，优先精确提取
  if (selector) {
    // 简单的方法：切出选择器包裹的内容
    var selRegex = new RegExp('<[^>]*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^>]*>\\s*([\\s\\S]*?)\\s*<\\/[^>]+>', 'gi');
    var selMatches = html.match(selRegex) || [];
    for (var s = 0; s < selMatches.length; s++) {
      var selText = cleanText(selMatches[s].replace(/<[^>]+>/g, ''));
      if (selText && selText.length >= 6) {
        results.push(makeQuestion(selText, subject, grade, 'crawl-url'));
      }
    }
    if (results.length > 0) return { questions: results };
  }

  // 通用提取：匹配看起来像题目的文本块
  var patterns = [
    // 带题型标记的块
    /<[^>]*class="[^"]*(?:question|ques|exam|test|stem|timu)[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/gi,
    // 编号开头的段落
    /<(?:p|div|li)[^>]*>\s*(\d+[\.\、\)）]\s*[\s\S]*?)\s*<\/(?:p|div|li)>/gi,
    // 包含解答/答案标记
    /<(?:p|div|span)[^>]*>\s*([\s\S]{15,200}?[?？]\s*)\s*<\/(?:p|div|span)>/gi,
    // 选项块（ABCD）
    /<(?:p|div)[^>]*>\s*[A-E][\.\、\s]+[^\n<]{2,50}\s*<\/(?:p|div)>/gi
  ];

  for (var p = 0; p < patterns.length; p++) {
    var matches = html.match(patterns[p]) || [];
    for (var m = 0; m < matches.length; m++) {
      var text = cleanText(matches[m].replace(/<[^>]+>/g, ''));
      if (!text || text.length < 8) continue;
      // 过滤非题目内容
      var likelyQuestion = (
        /^\d+[\.\、]/.test(text) ||
        /[?？]$/.test(text) ||
        /选出|下列|正确的|错误|填空|判断|计算|解答|选择/.test(text) ||
        /^[A-E][\.\、\s]/.test(text)
      );
      if (likelyQuestion) {
        results.push(makeQuestion(text.substring(0, 500), subject, grade, 'crawl-url'));
      }
    }
    if (results.length > 0) break;
  }

  return { questions: results };
}

/**
 * 根据文本内容推断题目类型
 */
function inferType(text) {
  if (!text) return '填空题';
  var t = text.toLowerCase();
  if (/^[a-e][\.\、\s]/.test(t) || /选项|选出|选择/.test(t)) return '选择题';
  if (/判断|正确|错误|√|×|✓|✗/.test(t)) return '判断题';
  if (/填空|______|____|（\s*）/.test(t)) return '填空题';
  if (/计算|解答|简答|证明|应用/.test(t)) return '简答题';
  return '填空题';
}

/**
 * 构造标准题目对象
 */
function makeQuestion(stem, subject, grade, source) {
  return {
    subject: subject,
    grade: grade,
    type: inferType(stem),
    difficulty: estimatedDifficulty(stem),
    knowledgePoints: [],
    stem: stem,
    options: [],
    answer: '',
    explanation: '',
    examPoint: '',
    paperSource: source || 'crawl-url',
    status: 'active',
    sourceUrl: '',
    createdAt: new Date()
  };
}

/**
 * 从试卷标题中提取年级信息
 */
function extractGradeFromTitle(title) {
  if (!title) return '六年级';
  if (/一[年级]/.test(title)) return '一年级';
  if (/二[年级]/.test(title)) return '二年级';
  if (/三[年级]/.test(title)) return '三年级';
  if (/四[年级]/.test(title)) return '四年级';
  if (/五[年级]/.test(title)) return '五年级';
  if (/六[年级]/.test(title)) return '六年级';
  if (/小升初|升学/.test(title)) return '六年级';
  return '六年级';
}

/**
 * 从试卷标题中提取学科
 */
function extractSubjectFromTitle(title) {
  if (!title) return '数学';
  if (/数学|算术/.test(title)) return '数学';
  if (/语文|汉字|拼音|阅读|作文/.test(title)) return '语文';
  if (/英语|英文|单词|语法/.test(title)) return '英语';
  return '数学';
}

// ===== 已知站点适配器 =====

/**
 * shijuan1.com 试卷列表页解析
 */
function adaptShijuan1(html, url) {
  var papers = [];
  // 从列表页提取试卷链接和标题
  var linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  var match;
  while ((match = linkPattern.exec(html)) !== null) {
    var href = match[1];
    var text = cleanText(match[2]);
    if (!text || text.length < 4) continue;
    // 过滤导航链接
    if (/首页|下一页|末页|上一页/.test(text)) continue;
    if ((/^\d/.test(text) || /试卷|测试|期中|期末|单元/.test(text)) && text.length >= 6) {
      papers.push({
        title: text.substring(0, 200),
        subject: extractSubjectFromTitle(text),
        grade: extractGradeFromTitle(text),
        url: href.startsWith('http') ? href : ('https://www.shijuan1.com' + (href.startsWith('/') ? '' : '/') + href),
        year: '',
        term: '',
        version: '',
        sections: [],
        totalScore: null,
        duration: null,
        questionCount: 0,
        paperSource: 'shijuan1',
        status: 'metadata_only',
        createdAt: new Date()
      });
    }
  }
  return { questions: [], papers: papers };
}

/**
 * tiku.cn 试卷列表页解析（图片型题目，只能获取元数据）
 */
function adaptTiku(html, url) {
  var papers = [];
  var linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  var match;
  while ((match = linkPattern.exec(html)) !== null) {
    var href = match[1];
    var text = cleanText(match[2]);
    if (!text || text.length < 4) continue;
    if ((/试卷|测试|期中|期末|单元|模拟/.test(text)) && text.length >= 8) {
      papers.push({
        title: text.substring(0, 200),
        subject: extractSubjectFromTitle(text),
        grade: extractGradeFromTitle(text),
        url: href.startsWith('http') ? href : ('https://www.tiku.cn' + (href.startsWith('/') ? '' : '/') + href),
        year: '',
        term: '',
        version: '',
        sections: [],
        totalScore: null,
        duration: null,
        questionCount: 0,
        paperSource: 'tiku.cn',
        status: 'metadata_only',
        createdAt: new Date()
      });
    }
  }
  return { questions: [], papers: papers };
}

module.exports = {
  // 公共工具
  stemHash: stemHash,
  cleanText: cleanText,
  detectSite: detectSite,
  genericExtract: genericExtract,
  inferType: inferType,
  makeQuestion: makeQuestion,
  // 已知站点适配器
  adaptShijuan1: adaptShijuan1,
  adaptTiku: adaptTiku,
  // 常量
  UA: UA
};
