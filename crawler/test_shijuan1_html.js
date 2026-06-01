var axios = require('axios');
var cheerio = require('cheerio');
var iconv = require('iconv-lite');
var UA = 'Mozilla/5.0';

async function main() {
  // 六年级数学页面完整HTML
  var res = await axios.get('https://www.shijuan1.com/a/sjsx6/', {
    timeout: 10000,
    headers: { 'User-Agent': UA },
    responseType: 'arraybuffer'
  });
  var html = iconv.decode(Buffer.from(res.data), 'gbk');

  // 打印关键片段
  console.log('=== 关键区域 ===');

  // 查找所有div/ul/li
  var ch = cheerio.load(html);

  // 搜索 list, article, item, content
  console.log('\n--- class含 list/article/item 的元素 ---');
  ch('[class*="list"], [class*="article"], [class*="item"], [class*="cont"], [class*="main"]').each(function(i) {
    var cls = ch(this).attr('class') || '';
    var text = ch(this).text().trim().substring(0, 100);
    if (text && i < 15) {
      console.log('  [' + i + '] .' + cls + ': ' + text);
    }
  });

  console.log('\n--- 所有 a 标签(含href有html) ---');
  ch('a[href*=".html"]').each(function(i) {
    var href = ch(this).attr('href') || '';
    var text = ch(this).text().trim();
    if (text && text.length > 3 && i < 15) {
      console.log('  ' + text.substring(0,50) + ' → ' + href);
    }
  });

  // 打印body的原始HTML片段（找列表区域）
  var bodyHtml = html.substring(html.indexOf('<body'), html.indexOf('</body>'));
  // 找可能有列表的区域
  var idx1 = bodyHtml.indexOf('class="list');
  if (idx1 < 0) idx1 = bodyHtml.indexOf('class="main');
  if (idx1 > 0) {
    console.log('\n--- 列表区域原始HTML ---');
    console.log(bodyHtml.substring(idx1, idx1 + 2000));
  } else {
    console.log('\n--- body 前2000字符 ---');
    console.log(bodyHtml.substring(0, 2000));
  }

  // 检查是否有分页或script加载
  console.log('\n--- Script 标签 ---');
  var scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].length > 50 && (scripts[i].includes('ajax') || scripts[i].includes('list') || scripts[i].includes('page') || scripts[i].includes('data') || scripts[i].includes('get'))) {
      console.log('Script #' + i + ': ' + scripts[i].substring(0, 300));
    }
  }
}
main();
