/**
 * importHelper v3 — 客户端分片导入工具
 *
 * 自动将大数据集分片（每片 20 条），逐片调用 importQuestions 云函数。
 * 每片保证在 3 秒内完成，总进度实时回调。
 *
 * 用法：
 *   var helper = require('../../utils/importHelper');
 *
 *   // 从云存储文件读取后分片导入
 *   var result = await helper.importFromFile('cloud://xxx/import.cloud.jsonl');
 *
 *   // 从 JSON 数组分片导入
 *   var result = await helper.importArray(questions);
 *
 *   // 带进度回调
 *   var result = await helper.importArray(questions, {
 *     onProgress: function(p) { console.log(p.round, p.inserted); }
 *   });
 */

var CHUNK_SIZE = 50;     // 每片 50 条（云函数内存升至 512MB）
var DELAY_MS = 300;      // 片间延迟

function sleep(ms) {
  return new Promise(function(r) { setTimeout(r, ms); });
}

/**
 * 分片导入 JSON 数组
 */
async function importArray(questions, opts) {
  opts = opts || {};
  var chunkSize = opts.chunkSize || CHUNK_SIZE;
  var onProgress = opts.onProgress || function() {};

  if (!Array.isArray(questions) || questions.length === 0) {
    return { success: false, error: '题目数组为空' };
  }

  // 分片
  var chunks = [];
  for (var i = 0; i < questions.length; i += chunkSize) {
    chunks.push(questions.slice(i, i + chunkSize));
  }

  var total = { success: true, totalQ: 0, inserted: 0, updated: 0, skipped: 0, errors: [], rounds: [] };

  for (var c = 0; c < chunks.length; c++) {
    var chunkData = chunks[c];

    onProgress({ round: c + 1, totalRounds: chunks.length, items: chunkData.length, stage: 'sending' });

    try {
      var res = await wx.cloud.callFunction({
        name: 'importQuestions',
        data: { data: chunkData }
      });

      var r = res.result || {};
      total.totalQ += r.total || 0;
      total.inserted += r.inserted || 0;
      total.updated += r.updated || 0;
      total.skipped += r.skipped || 0;
      if (r.errors) total.errors = total.errors.concat(r.errors);

      total.rounds.push({
        round: c + 1,
        total: r.total, inserted: r.inserted,
        updated: r.updated, skipped: r.skipped,
        elapsedMs: r.elapsedMs
      });

      onProgress({
        round: c + 1, totalRounds: chunks.length,
        stage: 'done',
        items: chunkData.length,
        inserted: r.inserted, updated: r.updated,
        elapsedMs: r.elapsedMs
      });

    } catch(e) {
      var errMsg = (e.message || '调用失败').substring(0, 100);
      total.success = false;
      total.errors.push({ round: c + 1, error: errMsg });

      onProgress({ round: c + 1, totalRounds: chunks.length, stage: 'error', error: errMsg });

      // 超时则尝试减半重试
      if (errMsg.indexOf('timeout') >= 0 || errMsg.indexOf('TIME_LIMIT') >= 0) {
        if (chunkData.length > 5) {
          var halfSize = Math.floor(chunkData.length / 2);
          console.log('  片' + (c + 1) + '超时，减半重试(' + halfSize + '条)...');
          var half1 = chunkData.slice(0, halfSize);
          var half2 = chunkData.slice(halfSize);

          for (var h = 0; h < 2; h++) {
            var halfData = h === 0 ? half1 : half2;
            try {
              var hRes = await wx.cloud.callFunction({
                name: 'importQuestions',
                data: { data: halfData }
              });
              var hr = hRes.result || {};
              total.inserted += hr.inserted || 0;
              total.updated += hr.updated || 0;
              total.skipped += hr.skipped || 0;
            } catch(e2) {
              total.errors.push({ round: c + 1, half: h + 1, error: e2.message });
            }
            await sleep(DELAY_MS);
          }
        }
      }
    }

    // 片间延迟
    if (c < chunks.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  return total;
}

/**
 * 从云存储文件读取并分片导入
 */
async function importFromFile(fileID, opts) {
  opts = opts || {};

  if (!fileID) return { success: false, error: '请提供 fileID' };

  console.log('下载文件: ' + fileID);
  var dl = await wx.cloud.downloadFile({ fileID: fileID });
  if (!dl.tempFilePath) return { success: false, error: '文件下载失败' };

  var fs = wx.getFileSystemManager();
  var content = fs.readFileSync(dl.tempFilePath, 'utf-8');

  // 尝试 JSON 数组
  var questions = [];
  try {
    var arr = JSON.parse(content);
    if (Array.isArray(arr)) questions = arr;
  } catch(e) {
    // 尝试 JSONL
    content.split(/\r?\n/).filter(function(l) { return l.trim(); }).forEach(function(line) {
      try { var o = JSON.parse(line); if (o && o.stem) questions.push(o); } catch(e2) {}
    });
  }

  if (questions.length === 0) {
    return { success: false, error: '文件内容不是有效的 JSON/JSONL 格式' };
  }

  console.log('解析: ' + questions.length + ' 条, 分片导入...');
  return importArray(questions, opts);
}

/**
 * dryRun 预览
 */
async function preview(questions) {
  if (!Array.isArray(questions)) questions = [questions];
  try {
    var res = await wx.cloud.callFunction({
      name: 'importQuestions',
      data: { data: questions.slice(0, 50), dryRun: true }
    });
    return res.result;
  } catch(e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  importArray: importArray,
  importFromFile: importFromFile,
  preview: preview
};
