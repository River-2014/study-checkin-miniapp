var axios = require('axios');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var UA = 'Mozilla/5.0';

async function getDetail(url) {
  var res = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': UA },
    responseType: 'arraybuffer'
  });
  var html = iconv.decode(Buffer.from(res.data), 'gbk');
  var ch = cheerio.load(html);

  console.log('URL: ' + url);
  console.log('Title: ' + ch('title').text());

  // 找下载链接
  console.log('\n--- 下载链接 ---');
  ch('a[href*="down"], a[href*="upload"], a[href*="file"]').each(function(i) {
    var href = ch(this).attr('href') || '';
    var text = ch(this).text().trim();
    if (i < 5) console.log('  ' + text + ' → ' + href);
  });

  // 找内容区域
  console.log('\n--- 正文内容 ---');
  ch('.content, .article, .info, .intro, .detail').each(function(i) {
    var text = ch(this).text().trim();
    if (text && text.length > 20 && i < 3) {
      console.log('  [' + i + '] ' + text.substring(0, 300));
    }
  });

  // 所有文本看有没有题目
  var bodyText = ch('body').text().replace(/\s+/g, ' ').trim();
  var qPatterns = bodyText.match(/\d+[\.\、\)）]\s*[^\d]{5,60}/g) || [];
  console.log('\n题目模式匹配: ' + qPatterns.length + ' 个');
  for (var i = 0; i < Math.min(qPatterns, 3); i++) {
    console.log('  ' + qPatterns[i]);
  }
}

async function main() {
  // 1. 试卷详情页
  await getDetail('https://www.shijuan1.com/a/sjsx6/334388.html');

  // 2. 试试第2页
  console.log('\n\n=== 第2页 ===');
  var res = await axios.get('https://www.shijuan1.com/a/sjsx6/list_2.html', {
    timeout: 10000,
    headers: { 'User-Agent': UA },
    responseType: 'arraybuffer'
  });
  var html = iconv.decode(Buffer.from(res.data), 'gbk');
  var ch = cheerio.load(html);
  console.log('Title: ' + ch('title').text());
  ch('a[href*=".html"].title').each(function(i) {
    var href = ch(this).attr('href') || '';
    var text = ch(this).text().trim();
    if (text && i < 5) console.log('  ' + text + ' → ' + href);
  });
}
main().catch(function(e) { console.log('ERR: ' + e.message); });
