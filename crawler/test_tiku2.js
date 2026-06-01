var axios = require('axios');
var cheerio = require('cheerio');
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function get(url, label) {
  try {
    var res = await axios.get(url, {timeout:10000, headers:{'User-Agent':UA}, maxRedirects:5});
    console.log('\n=== ' + label + ' ===');
    console.log('Status: ' + res.status + ' | Chars: ' + res.data.length);
    return cheerio.load(res.data);
  } catch(e) {
    console.log(label + ' FAIL: ' + (e.message||'').substring(0,80));
    return null;
  }
}

async function main() {
  // 1. 试题章节页
  var chap = await get('https://www.tiku.cn/chapterq?cid=4&cno=1', '章节试题页');
  if (chap) {
    console.log('标题: ' + chap('title').text());
    // 提取页面文本看结构
    var body = chap('body').text().substring(0, 500);
    console.log('正文片段: ' + body);
    // 查问题元素
    chap('.question, .ques, .stem, .timu, .q-title, .q-content, .subject, .title').each(function(i) {
      var text = chap(this).text().trim();
      if (text && text.length > 5 && i < 5) {
        console.log('  Q['+i+']: ' + text.substring(0,80));
      }
    });
  }

  // 2. 试卷预览页（含题目）
  var preview = await get('https://www.tiku.cn/paperlist/preview?id=66595', '试卷预览');
  if (preview) {
    console.log('标题: ' + preview('title').text());
    var body = preview('body').text().substring(0, 800);
    console.log('正文片段: ' + body);
    // 打印所有文本元素看结构
    console.log('\n--- 关键元素 ---');
    preview('.question, .ques, .stem, .exam-item, p, .q-body, .quest-content, .timu, h5, h4, h3').each(function(i) {
      var text = preview(this).text().trim();
      if (text && text.length > 10 && i < 10) {
        console.log('  ['+i+'] ' + text.substring(0,100));
      }
    });
  }

  // 3. 试卷详情页
  var detail = await get('https://www.tiku.cn/paper/detail/80010', '试卷详情');
  if (detail) {
    console.log('标题: ' + detail('title').text());
    var body = detail('body').text().substring(0, 500);
    console.log('正文: ' + body);
  }

  // 4. 试试搜索API
  var search = await get('https://www.tiku.cn/search?keyword=' + encodeURIComponent('六年级 数学'), '搜索');
}
main();
