var axios = require('axios');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function test() {
  // 尝试获取题目详情的API模式
  var apis = [
    'https://www.tiku.cn/getpage',
    'https://www.tiku.cn/getquestion',
    'https://www.tiku.cn/question/get',
    'https://www.tiku.cn/q/600047',
    'https://www.tiku.cn/ques/detail?id=600047',
    'https://www.tiku.cn/quest/600047',
    'https://www.tiku.cn/view/600047',
    'https://www.tiku.cn/getq',
  ];

  console.log('=== GET 请求 ===');
  for (var a = 0; a < apis.length; a++) {
    try {
      var r = await axios.get(apis[a], {
        timeout: 6000,
        headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' }
      });
      console.log(apis[a] + ': ' + r.status + ' | ' + (typeof r.data === 'string' ? r.data.substring(0, 150) : JSON.stringify(r.data).substring(0, 150)));
    } catch(e) {
      console.log(apis[a] + ': FAIL');
    }
  }

  // 尝试POST /getpage (从script中发现的)
  console.log('\n=== POST /getpage ===');
  try {
    var r2 = await axios.post('https://www.tiku.cn/getpage', {
      total: '5',
      baseurl: '/chapterq?cid=4&cno=1'
    }, {
      timeout: 8000,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }
    });
    console.log('Status: ' + r2.status + ' | Chars: ' + r2.data.length);
    console.log(r2.data.substring(0, 1000));
  } catch(e) {
    console.log('FAIL: ' + (e.message||'').substring(0, 100));
    // 试试form格式
    try {
      var params = new URLSearchParams();
      params.append('total', '5');
      params.append('baseurl', '/chapterq?cid=4&cno=1');
      var r3 = await axios.post('https://www.tiku.cn/getpage', params, {
        timeout: 8000,
        headers: { 'User-Agent': UA }
      });
      console.log('Form POST Status: ' + r3.status + ' | Chars: ' + r3.data.length);
      console.log(r3.data.substring(0, 500));
    } catch(e2) {
      console.log('Form FAIL: ' + (e2.message||'').substring(0, 100));
    }
  }

  // 读取 tk.js 看问题详情接口
  console.log('\n=== tk.js 源码 ===');
  try {
    var r4 = await axios.get('https://www.tiku.cn/static/js/tk.js', {
      timeout: 8000,
      headers: { 'User-Agent': UA }
    });
    console.log('Status: ' + r4.status + ' | Chars: ' + r4.data.length);
    console.log(r4.data.substring(0, 3000));
  } catch(e) {
    console.log('FAIL: ' + (e.message||'').substring(0, 100));
  }
}
test().catch(function(e) { console.log('ERR: ' + e.message); });
