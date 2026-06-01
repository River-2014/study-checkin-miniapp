var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0';

async function main() {
  // 1. 从首页找到的小学章节链接 - 用不同的cid
  // 首页上是 /chapterq?cid=4, 19, 22, 11, 16, 13, 9, 17, 8, 10, 20, 24, 12, 15, 7, 5, 18, 6, 14, 21, 23
  // 试试这些不同的cid看哪些有小学内容

  var cids = [4, 19, 22, 11, 16, 13, 9, 17, 8, 10, 20, 24, 12, 15, 7, 5, 18, 6, 14, 21, 23];

  console.log('=== 测试不同 cid (只看前5个) ===');
  for (var i = 0; i < 5; i++) {
    var cid = cids[i];
    try {
      var res = await axios.get('https://www.tiku.cn/chapterq?cid=' + cid + '&cno=1', {
        timeout: 8000,
        headers: { 'User-Agent': UA }
      });
      var $ = cheerio.load(res.data);
      var title = $('title').text();

      // 检查是否有题目计数
      var hasQuestions = false;
      $('.question-num').each(function() {
        var text = $(this).text().trim();
        if (text && !text.includes('0道')) hasQuestions = true;
      });

      // tk.qtp 数组
      var qtpMatch = res.data.match(/tk\.qtp\s*=\s*\[([\s\S]*?)\]/);
      var qtpCount = qtpMatch ? (qtpMatch[1].match(/\d+/g) || []).length : 0;

      console.log('cid=' + cid + ': ' + title + ' | questions: ' + hasQuestions + ' | tk.qtp: ' + qtpCount);
    } catch(e) {
      console.log('cid=' + cid + ': FAIL');
    }
  }

  // 2. 测试一个试卷预览页（之前发现是有问题的）
  console.log('\n=== 试卷预览页 full text ===');
  var res2 = await axios.get('https://www.tiku.cn/paperlist/preview?id=66597', {
    timeout: 10000,
    headers: { 'User-Agent': UA }
  });
  var $ = cheerio.load(res2.data);
  // 所有文本
  var allText = $('body').text();
  // 去掉多余空白
  allText = allText.replace(/\s+/g, ' ').trim();
  console.log(allText.substring(0, 2000));

  // 3. 测试不同格式的题目请求
  console.log('\n=== 各种题目API测试 ===');
  var apis = [
    { method: 'GET', url: 'https://www.tiku.cn/question/600047' },
    { method: 'GET', url: 'https://www.tiku.cn/ques/600047.html' },
    { method: 'GET', url: 'https://www.tiku.cn/workbook?qtp=600047,600048' },
    { method: 'POST', url: 'https://www.tiku.cn/api/question/list', data: {ids: [600047, 600048]} },
    { method: 'POST', url: 'https://www.tiku.cn/ques/list', data: {ids: '600047,600048'} },
  ];

  for (var a = 0; a < apis.length; a++) {
    var api = apis[a];
    try {
      var opts = {
        timeout: 8000,
        headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' }
      };
      var r;
      if (api.method === 'POST') {
        r = await axios.post(api.url, api.data, opts);
      } else {
        r = await axios.get(api.url, opts);
      }
      console.log(api.method + ' ' + api.url + ': ' + r.status + ' | ' + (typeof r.data === 'string' ? r.data.substring(0, 200) : JSON.stringify(r.data).substring(0, 200)));
    } catch(e) {
      console.log(api.method + ' ' + api.url + ': FAIL');
    }
  }
}
main().catch(function(e) { console.log('ERR: ' + e.message); });
