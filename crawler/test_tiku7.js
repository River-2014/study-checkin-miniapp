var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0';

async function main() {
  // 1. 尝试小学导航页面
  var urls = [
    'https://www.tiku.cn/index/xiaoxue',
    'https://www.tiku.cn/xiaoxue',
    'https://www.tiku.cn/primary',
    'https://www.tiku.cn/index?level=xiaoxue',
    'https://www.tiku.cn/?level=1',
    'https://www.tiku.cn/chapterq?cid=100&cno=1',
    'https://www.tiku.cn/chapterq?cid=1&cno=1',
    'https://www.tiku.cn/chapterq?cid=2&cno=1',
    'https://www.tiku.cn/chapterq?cid=3&cno=1',
  ];

  for (var u = 0; u < urls.length; u++) {
    try {
      var res = await axios.get(urls[u], {
        timeout: 8000,
        headers: { 'User-Agent': UA },
        maxRedirects: 5,
        validateStatus: function(s) { return s < 500; }
      });
      var title = (res.data.match(/<title>([^<]*)<\/title>/) || ['',''])[1];
      var qtpMatch = res.data.match(/tk\.qtp\s*=\s*\[([\s\S]*?)\]/);
      var qtpCount = qtpMatch ? (qtpMatch[1].match(/\d+/g) || []).length : 0;
      var courseIdMatch = res.data.match(/tk\.courseid\s*=\s*(\d+)/);
      var cid = courseIdMatch ? courseIdMatch[1] : '?';
      console.log(urls[u] + ': ' + res.status + ' | cid=' + cid + ' | qtps=' + qtpCount + ' | ' + title);
    } catch(e) {
      console.log(urls[u] + ': FAIL - ' + (e.message||'').substring(0, 60));
    }
  }

  // 2. 尝试直接从首页找小学cid
  console.log('\n=== 首页所有链接 (找小学相关) ===');
  var home = await axios.get('https://www.tiku.cn/', {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });
  var $ = cheerio.load(home.data);
  $('a[href*="chapterq"]').each(function(i) {
    var href = $(this).attr('href');
    var text = $(this).text().trim();
    var parentText = $(this).parent().parent().text().trim().substring(0, 30);
    if (text || parentText) {
      console.log('  [' + i + '] ' + parentText + ' | ' + text + ' → ' + href);
    }
  });

  // 3. 找小学导航
  console.log('\n=== 导航中"小学"附近的所有链接 ===');
  var $body = $('body');
  var navTexts = [];
  $('a, span, div, li').each(function() {
    var text = $(this).text().trim();
    if (text && (text.includes('小学') || text.includes('年级'))) {
      var href = $(this).find('a').attr('href') || $(this).attr('href') || '';
      console.log('  ' + text.substring(0, 30) + ' → ' + href.substring(0, 60));
    }
  });
}
main().catch(function(e) { console.log('ERR: ' + e.message); });
