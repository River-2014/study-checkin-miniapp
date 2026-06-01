var axios = require('axios');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var UA = 'Mozilla/5.0';

async function getGBK(url, label) {
  console.log('\n=== ' + label + ' ===');
  try {
    var res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': UA },
      responseType: 'arraybuffer',
      maxRedirects: 5
    });
    var html = iconv.decode(Buffer.from(res.data), 'gbk');
    var ch = cheerio.load(html);
    console.log('URL: ' + url);
    console.log('Title: ' + ch('title').text());
    console.log('Chars: ' + html.length);
    return ch;
  } catch(e) {
    console.log('FAIL: ' + (e.message||'').substring(0,80));
    return null;
  }
}

async function main() {
  // 1. 首页看完整导航
  var home = await getGBK('https://www.shijuan1.com/', '首页');
  if (home) {
    console.log('\n--- 完整导航 ---');
    home('a[href]').each(function(i) {
      var href = home(this).attr('href') || '';
      var text = home(this).text().trim();
      if (text && text.length > 2 && !text.startsWith('http') && i < 60) {
        console.log('  ' + text + ' → ' + href);
      }
    });
  }

  // 2. 六年级数学试卷列表
  var sx6 = await getGBK('https://www.shijuan1.com/a/sjsx6/', '六年级数学');
  if (sx6) {
    console.log('\n--- 试卷列表 ---');
    sx6('a[href]').each(function(i) {
      var href = sx6(this).attr('href') || '';
      var text = sx6(this).text().trim();
      if (text && text.length > 5 && i < 15) {
        console.log('  ' + text.substring(0,50) + ' → ' + href);
      }
    });
  }

  // 3. 六年级语文
  var yw6 = await getGBK('https://www.shijuan1.com/a/sjyw6/', '六年级语文');
  if (yw6) {
    yw6('a[href]').each(function(i) {
      var href = yw6(this).attr('href') || '';
      var text = yw6(this).text().trim();
      if (text && text.length > 5 && i < 10) {
        console.log('  ' + text.substring(0,50) + ' → ' + href);
      }
    });
  }

  // 4. 尝试打开一篇文章，看题目内容
  var detail = await getGBK('https://www.shijuan1.com/a/sjsx6/12345.html', '文章测试');
}
main().catch(function(e) { console.log('ERR: ' + e.message); });
