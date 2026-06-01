var tiku = require('./parsers/tiku');
var fs = require('fs');
var path = require('path');

async function main() {
  var subjects = ['小学数学', '小学语文', '小学英语'];

  for (var s = 0; s < subjects.length; s++) {
    console.log('\n=== ' + subjects[s] + ' ===');
    try {
      var papers = await tiku.crawlSubject(subjects[s], 3);
      console.log('总计: ' + papers.length + ' 份试卷');

      // 输出元数据到文件
      var key = subjects[s].replace('小学', '').toLowerCase();
      var filePath = path.join(__dirname, 'output', 'tiku_' + key + '.json');
      fs.writeFileSync(filePath, JSON.stringify(papers, null, 2), 'utf-8');
      console.log('已保存: ' + filePath);
    } catch(e) {
      console.log('ERROR: ' + e.message);
    }
  }
}
main().catch(function(e) { console.log('ERR: ' + e.message); });
