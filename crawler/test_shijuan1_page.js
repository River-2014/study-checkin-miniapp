var axios = require('axios');
var iconv = require('iconv-lite');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0';

async function main() {
  var res = await axios.get('https://www.shijuan1.com/a/sjsx6/', {
    timeout: 10000, headers: {'User-Agent': UA}, responseType: 'arraybuffer'
  });
  var html = iconv.decode(Buffer.from(res.data), 'gbk');
  var ch = cheerio.load(html);

  // Pagelist 中的链接
  console.log('=== .pagelist 链接 ===');
  var plHtml = ch('.pagelist').html() || '';
  console.log(plHtml.substring(0, 800));

  // 测试分页格式
  console.log('\n=== 分页格式测试 ===');
  var formats = [
    '/a/sjsx6/index_2.html',
    '/a/sjsx6/list_2.html',
    '/a/sjsx6/2.html',
    '/a/sjsx6/?page=2',
  ];
  for (var f = 0; f < formats.length; f++) {
    try {
      var url = 'https://www.shijuan1.com' + formats[f];
      var r = await axios.get(url, {
        timeout: 6000, headers: {'User-Agent': UA}, responseType: 'arraybuffer',
        validateStatus: function(s) { return true; }
      });
      var h = iconv.decode(Buffer.from(r.data), 'gbk');
      var hasTitle = h.indexOf('class="title"') > 0;
      console.log(url + ': ' + r.status + ' | hasTitle: ' + hasTitle + ' | chars: ' + h.length);
    } catch(e) {
      console.log(url + ': FAIL - ' + e.message.substring(0,60));
    }
  }
}
main();
