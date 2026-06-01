var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0';

async function main() {
  // 1. 测试小学试卷预览页
  console.log('=== 小学试卷预览 ===');
  // 从首页看到的小学试卷
  var paperIds = [66595, 66597, 64343]; // 小学语文五年级、初中地理、未知
  // 搜更多小学试卷
  var paperUrls = [
    'https://www.tiku.cn/paperlist/word?cid=14&p=1',  // 小学数学
    'https://www.tiku.cn/paperlist/word?cid=21&p=1',  // 小学语文
    'https://www.tiku.cn/paperlist/word?cid=23&p=1',  // 小学英语
  ];

  for (var u = 0; u < paperUrls.length; u++) {
    try {
      var res = await axios.get(paperUrls[u], {
        timeout: 10000,
        headers: { 'User-Agent': UA }
      });
      var $ = cheerio.load(res.data);
      console.log('\n' + paperUrls[u] + ': ' + res.status + ' | ' + res.data.length + ' chars');
      // 找试卷链接
      $('a[href*="preview"], a[href*="detail"]').each(function(i) {
        var href = $(this).attr('href');
        var text = $(this).text().trim();
        if (text && text.length > 3 && i < 10) {
          console.log('  ' + text.substring(0,40) + ' → ' + href);
        }
      });
    } catch(e) {
      console.log(paperUrls[u] + ': FAIL');
    }
  }

  // 2. 深度测试试卷预览 - 找题目文本
  console.log('\n=== 试卷预览 66595 详细分析 ===');
  var r2 = await axios.get('https://www.tiku.cn/paperlist/preview?id=66595', {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });
  var $2 = cheerio.load(r2.data);

  // 搜索题目模式
  var allText = $2('body').text().replace(/\s+/g, ' ').trim();
  // 找数字. 开头的行（典型题目模式）
  var matches = allText.match(/\d+[\.\、\)]\s*[^\d]{5,60}/g) || [];
  console.log('找到 ' + matches.length + ' 个题目模式');
  for (var m = 0; m < Math.min(matches, 5).length; m++) {
    console.log('  ' + matches[m]);
  }

  // 所有img标签
  console.log('\n图片:');
  $2('img').each(function(i) {
    var src = $(this).attr('src') || '';
    if (src && i < 5) console.log('  ' + src);
  });

  // 3. 尝试paperlist页面
  console.log('\n=== paperlist 页面 ===');
  var r3 = await axios.get('https://www.tiku.cn/paperlist?cid=14', {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });
  var $3 = cheerio.load(r3.data);
  console.log('Status: ' + r3.status + ' | Chars: ' + r3.data.length);
  console.log('Title: ' + $3('title').text());
  // 找列表
  $3('a[href*="preview"], a[href*="detail"], a[href*="paper"]').each(function(i) {
    var href = $(this).attr('href');
    var text = $(this).text().trim();
    if (text && text.length > 5 && i < 15) {
      console.log('  ' + text.substring(0,40) + ' → ' + href);
    }
  });
}
main().catch(function(e) { console.log('ERR: ' + e.message); });
