var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function test() {
  // 菁优网
  console.log('=== 菁优网测试 ===');
  try {
    var res = await axios.get('https://www.jyeoo.com/math/ques/search?f=0&q=' + encodeURIComponent('六年级'), {
      timeout: 10000,
      headers: { 'User-Agent': UA }
    });
    var ch = cheerio.load(res.data);
    console.log('标题: ' + ch('title').text());
    console.log('长度: ' + res.data.length);
    ch('.ques-item, .field, .ques-title, h3, .title, a').each(function(i) {
      var text = ch(this).text().trim();
      if (text && text.length > 10 && i < 10) {
        console.log('  [' + i + '] ' + text.substring(0, 100));
      }
    });
  } catch(e) { console.log('ERROR: ' + e.message); }

  // 搜狗微信
  console.log('\n=== 搜狗微信测试 ===');
  try {
    var res2 = await axios.get('https://weixin.sogou.com/weixin?type=2&query=' + encodeURIComponent('小学 六年级 数学 期末 真题'), {
      timeout: 10000,
      headers: { 'User-Agent': UA }
    });
    var ch2 = cheerio.load(res2.data);
    console.log('标题: ' + ch2('title').text());
    console.log('长度: ' + res2.data.length);
    ch2('.txt-box, .news-item, h3, .tit, a, .s-p').each(function(i) {
      var text = ch2(this).text().trim();
      if (text && text.length > 10 && i < 10) {
        console.log('  [' + i + '] ' + text.substring(0, 100));
      }
    });
  } catch(e) { console.log('ERROR: ' + e.message); }

  // 百度文库
  console.log('\n=== 百度文库测试 ===');
  try {
    var res3 = await axios.get('https://wenku.baidu.com/search?word=' + encodeURIComponent('小学六年级数学期末试题') + '&lm=0&od=0&fr=top_home', {
      timeout: 10000,
      headers: { 'User-Agent': UA }
    });
    var ch3 = cheerio.load(res3.data);
    console.log('长度: ' + res3.data.length);
    ch3('.doc-title, .title, h3, a').each(function(i) {
      var text = ch3(this).text().trim();
      if (text && text.length > 5 && i < 10) {
        var href = ch3(this).attr('href') || '';
        console.log('  [' + i + '] ' + text.substring(0, 80) + ' | ' + href.substring(0, 60));
      }
    });
  } catch(e) { console.log('ERROR: ' + e.message); }
}

test();
