var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function test() {
  // 1. 查看章节列表页的完整 HTML，找API或内嵌数据
  var res = await axios.get('https://www.tiku.cn/chapterq?cid=4&cno=1', {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });
  var html = res.data;

  // 查找内嵌的 JSON 数据或 API 调用
  var scriptMatches = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  console.log('Script 标签数: ' + scriptMatches.length);
  for (var i = 0; i < scriptMatches.length; i++) {
    var s = scriptMatches[i];
    if (s.includes('var ') || s.includes('data') || s.includes('fetch') || s.includes('ajax') || s.includes('api') || s.includes('json')) {
      console.log('\n--- Script #' + i + ' ---');
      console.log(s.substring(0, 500));
    }
    if (i < 3) {
      console.log('\n--- Script #' + i + ' (first 200) ---');
      console.log(s.substring(0, 200));
    }
  }

  // 2. 尝试常见的 API 路径
  var apis = [
    'https://www.tiku.cn/api/chapterq?cid=4&cno=1',
    'https://www.tiku.cn/api/questions?cid=4',
    'https://www.tiku.cn/ajax/chapterq?cid=4&cno=1',
    'https://www.tiku.cn/chapterq/data?cid=4&cno=1',
    'https://www.tiku.cn/paperlist/preview/data?id=66595',
    'https://www.tiku.cn/api/paper/66595',
    'https://www.tiku.cn/paper/66595/json'
  ];

  console.log('\n=== API 测试 ===');
  for (var a = 0; a < apis.length; a++) {
    try {
      var r = await axios.get(apis[a], {
        timeout: 8000,
        headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' }
      });
      console.log(apis[a] + ': ' + r.status + ' | ' + r.data.length + ' chars');
      var preview = typeof r.data === 'string' ? r.data.substring(0, 200) : JSON.stringify(r.data).substring(0, 200);
      console.log('  ' + preview);
    } catch(e) {
      console.log(apis[a] + ': FAIL');
    }
  }

  // 3. 看试卷详情页的script
  console.log('\n=== 试卷详情页 Scripts ===');
  var res2 = await axios.get('https://www.tiku.cn/paper/detail/80010', {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });
  var sm2 = res2.data.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (var j = 0; j < sm2.length; j++) {
    var sj = sm2[j];
    if (sj.includes('data') || sj.includes('question') || sj.includes('json') || sj.includes('api') || sj.includes('array') || sj.includes('[')) {
      console.log('--- Script #' + j + ' ---');
      console.log(sj.substring(0, 600));
    }
  }
}
test().catch(function(e) { console.log('ERR: ' + e.message); });
