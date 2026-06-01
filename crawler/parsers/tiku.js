/**
 * 题库网 www.tiku.cn 爬取解析器
 *
 * 可爬取内容：
 *   1. 试卷列表（paperlist）：按学科(cid)分页，含试卷标题和ID
 *   2. 试卷预览（preview）：试卷首页图片 URL（OSS 存储的 JPG）
 *   3. 章节导航（chapterq）：学科章节结构，需登录才能看到题目
 *
 * 限制：
 *   - 题目内容以图片形式存储，需要 OCR 才能提取文本
 *   - 试题列表（chapterq）需登录才能查看题目
 *   - 下载试卷需要金币
 *
 * cid 映射（已验证）：
 *   小学数学: 14  小学语文: 21  小学英语: 23
 *   初中数学: 10  初中语文: 20  初中英语: 24
 *   高中数学: 4   高中语文: 19  高中英语: 22
 */

const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const BASE = 'https://www.tiku.cn';

// 学科 → cid 映射
const CID_MAP = {
  '小学数学': 14, '小学语文': 21, '小学英语': 23,
  '初中数学': 10, '初中语文': 20, '初中英语': 24,
  '高中数学': 4,  '高中语文': 19, '高中英语': 22,
};

/**
 * 爬取试卷列表
 * @param {number} cid - 学科ID
 * @param {number} page - 页码（从1开始）
 * @returns {Array<{id, title, previewUrl}>}
 */
async function crawlPaperList(cid, page) {
  page = page || 1;
  var url = BASE + '/paperlist/word?cid=' + cid + '&p=' + page;
  console.log('  [paperlist] cid=' + cid + ' p=' + page);

  var res = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });

  var $ = cheerio.load(res.data);
  var papers = [];

  $('a[href*="preview?id="]').each(function() {
    var href = $(this).attr('href') || '';
    var text = $(this).text().trim();
    var idMatch = href.match(/preview\?id=(\d+)/);
    if (idMatch && text && text.length > 2) {
      papers.push({
        id: parseInt(idMatch[1]),
        title: text,
        previewUrl: BASE + href
      });
    }
  });

  return papers;
}

/**
 * 获取试卷预览图片 URL
 * @param {number} paperId
 * @returns {{title, imageUrl, paperId}}
 */
async function getPaperPreview(paperId) {
  var url = BASE + '/paperlist/preview?id=' + paperId;
  console.log('  [preview] id=' + paperId);

  var res = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });

  var imageUrl = '';
  var imgMatch = res.data.match(/https:\/\/tikuimgs\.oss-cn-qingdao\.aliyuncs\.com\/[^"'\s]+\.jpg/i);
  if (imgMatch) {
    imageUrl = imgMatch[0];
  }

  return {
    paperId: paperId,
    imageUrl: imageUrl,
  };
}

/**
 * 爬取学科的所有试卷（多页）
 * @param {string} subject - 如 '小学数学'
 * @param {number} maxPages - 最大页数
 * @returns {Array}
 */
async function crawlSubject(subject, maxPages) {
  var cid = CID_MAP[subject];
  if (!cid) {
    console.log('未知学科: ' + subject);
    return [];
  }

  maxPages = Math.min(maxPages || 5, 10);
  var allPapers = [];

  for (var p = 1; p <= maxPages; p++) {
    try {
      var papers = await crawlPaperList(cid, p);
      if (papers.length === 0) break;
      allPapers = allPapers.concat(papers);
      console.log('    第' + p + '页: ' + papers.length + ' 份试卷');
    } catch (e) {
      console.log('    第' + p + '页错误: ' + (e.message || '').substring(0, 80));
      break;
    }
    await new Promise(function(r) { setTimeout(r, 2000 + Math.random() * 2000); });
  }

  return allPapers;
}

module.exports = {
  CID_MAP: CID_MAP,
  crawlPaperList: crawlPaperList,
  getPaperPreview: getPaperPreview,
  crawlSubject: crawlSubject,
  BASE: BASE
};
