var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0';

async function main() {
  var res = await axios.get('https://www.tiku.cn/chapterq?cid=4&cno=1', {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });
  var $ = cheerio.load(res.data);

  // 打印所有包含题目ID的元素
  console.log('=== tk.qtp 题目ID ===');
  var match = res.data.match(/tk\.qtp\s*=\s*\[([\s\S]*?)\]/);
  if (match) {
    var ids = match[1].match(/\d+/g) || [];
    console.log('共 ' + ids.length + ' 个ID: ' + ids.join(', '));
  }

  // 搜索页面中所有可能的题目文本
  console.log('\n=== 所有 <a> 标签 ===');
  $('a').each(function(i) {
    var text = $(this).text().trim();
    var href = $(this).attr('href') || '';
    if (text && text.length > 5 && i < 40) {
      console.log('  ' + text.substring(0,40) + ' → ' + href.substring(0,60));
    }
  });

  // 搜索题干
  console.log('\n=== 页面中所有 class 含 ques/timu/stem 的元素 ===');
  $('[class*="ques"], [class*="timu"], [class*="stem"], [class*="subject"], [class*="quest"]').each(function(i) {
    var cls = $(this).attr('class');
    var text = $(this).text().trim();
    if (text && text.length > 5 && i < 15) {
      console.log('  .' + cls + ': ' + text.substring(0,80));
    }
  });

  // 打印所有 span 文本（有可能题目嵌在 span 中）
  console.log('\n=== 所有 span 文本 ===');
  $('span').each(function(i) {
    var text = $(this).text().trim();
    if (text && text.length > 20 && i < 10) {
      console.log('  [' + i + '] ' + text.substring(0,80));
    }
  });

  // 按question ID直接搜页面中的数字
  console.log('\n=== 搜索 600047 附近文本 ===');
  var idx = res.data.indexOf('600047');
  if (idx > 0) {
    console.log(res.data.substring(idx - 100, idx + 300));
  }
}
main();
