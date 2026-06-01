var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function get(url, label) {
  try {
    var res = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': UA },
      maxRedirects: 5
    });
    var ch = cheerio.load(res.data);
    console.log('\n=== ' + label + ' ===');
    console.log('URL: ' + url);
    console.log('Status: ' + res.status + ' | Chars: ' + res.data.length);
    return ch;
  } catch(e) {
    console.log(label + ' FAIL: ' + (e.message||'').substring(0, 80));
    return null;
  }
}

async function main() {
  // 1. 首页所有链接
  var home = await get('https://www.tiku.cn/', '首页');
  if (!home) return;

  console.log('\n--- 导航链接 ---');
  home('a[href]').each(function(i) {
    var href = home(this).attr('href');
    var text = home(this).text().trim();
    if (text && text.length > 1 && i < 40) {
      console.log('  ' + text.substring(0,30) + ' → ' + href);
    }
  });

  // 2. 尝试学科页面
  await get('https://www.tiku.cn/shuxue', '数学页');
  await get('https://www.tiku.cn/yuwen', '语文页');
  await get('https://www.tiku.cn/yingyu', '英语页');
  await get('https://www.tiku.cn/math', 'math页');

  // 3. 尝试搜索
  var search = await get('https://www.tiku.cn/search?q=' + encodeURIComponent('六年级 数学'), '搜索页');
  if (search) {
    console.log('\n--- 搜索结果 ---');
    search('a[href]').each(function(i) {
      var href = search(this).attr('href');
      var text = search(this).text().trim();
      if (text && text.length > 3 && i < 15) {
        console.log('  ' + text.substring(0,40) + ' → ' + href);
      }
    });
  }

  // 4. 尝试获取题目详情页
  await get('https://www.tiku.cn/question/1', '题目1');
  await get('https://www.tiku.cn/ques/1', 'ques1');
  await get('https://www.tiku.cn/article/1', 'article1');
}
main();
