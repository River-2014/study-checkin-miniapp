var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function get(url, label) {
  try {
    var res = await axios.get(url, {timeout:10000, headers:{'User-Agent':UA}, maxRedirects:5});
    var $ = cheerio.load(res.data);
    console.log('\n=== ' + label + ' ===');
    console.log('URL: ' + url);
    console.log('Status: ' + res.status + ' | Chars: ' + res.data.length);
    console.log('Title: ' + $('title').text());
    return $;
  } catch(e) {
    console.log(label + ' FAIL: ' + (e.message||'').substring(0,80));
    return null;
  }
}

async function main() {
  // 1. 首页
  var home = await get('https://www.shijuan1.com/', '首页');
  if (home) {
    console.log('\n--- 导航链接 ---');
    home('a[href]').each(function(i) {
      var href = home(this).attr('href') || '';
      var text = home(this).text().trim();
      if (text && text.length > 2 && i < 50) {
        console.log('  ' + text.substring(0,30) + ' → ' + href.substring(0,60));
      }
    });
  }

  // 2. 尝试学科/年级页面
  await get('https://www.shijuan1.com/xiaoxue/', '小学');
  await get('https://www.shijuan1.com/list-1.html', 'list1');
  await get('https://www.shijuan1.com/a/xiaoxue/', 'a/xiaoxue');
  await get('https://www.shijuan1.com/shuxue/', '数学');
  await get('https://www.shijuan1.com/yuwen/', '语文');

  // 3. 尝试分类
  var cats = await get('https://www.shijuan1.com/list/1.html', '分类1');
  if (cats) {
    cats('a[href]').each(function(i) {
      var href = cats(this).attr('href') || '';
      var text = cats(this).text().trim();
      if (text && text.length > 3 && i < 20) {
        console.log('  ' + text.substring(0,30) + ' → ' + href.substring(0,60));
      }
    });
  }
}
main().catch(function(e) { console.log('ERR: ' + e.message); });
