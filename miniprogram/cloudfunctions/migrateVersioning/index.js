/**
 * migrateVersioning 云函数（一次性使用）
 *
 * 为 exam_questions 中所有现有题目添加版本控制字段：
 *   familyId, versionNumber, isLatest, contentHash
 *
 * 跳过已有这些字段的题目（幂等，可多次安全执行）。
 *
 * 使用方式：
 *   1. 部署此云函数
 *   2. 云开发控制台 → 云函数 → migrateVersioning → 测试
 *   3. 传入 { dryRun: true } 先预览，传入 {} 实际执行
 *   4. 完成后可删除此云函数
 */

var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;
var crypto = require('crypto');

function md5(s) {
  return crypto.createHash('md5').update(String(s)).digest('hex');
}

function computeContentHash(q) {
  return md5(
    (q.stem || '').substring(0, 100) + '|' +
    (q.options || []).join(',') + '|' +
    (q.answer || '') + '|' +
    (q.explanation || '')
  );
}

exports.main = async function(event) {
  var dryRun = event.dryRun === true;
  var coll = db.collection('exam_questions');
  var batchSize = 100;
  var updateBatchSize = 50;

  console.log('模式: ' + (dryRun ? '预览 (dryRun)' : '实际写入'));
  console.log('');

  var totalProcessed = 0;
  var totalUpdated = 0;
  var totalSkipped = 0;
  var cursor = null;

  while (true) {
    // 游标分页读取
    var query = coll
      .field({
        _id: true, questionId: true, stem: true, options: true,
        answer: true, explanation: true,
        familyId: true, versionNumber: true, isLatest: true, contentHash: true
      })
      .orderBy('_id', 'asc')
      .limit(batchSize);

    if (cursor) {
      query = query.where({ _id: _.gt(cursor) });
    }

    var res = await query.get();
    if (!res.data || res.data.length === 0) break;

    var toUpdate = [];

    for (var i = 0; i < res.data.length; i++) {
      var doc = res.data[i];
      cursor = doc._id;

      // 已有版本字段则跳过
      if (doc.familyId && doc.versionNumber) {
        totalSkipped++;
        continue;
      }

      var hash = computeContentHash(doc);
      toUpdate.push({
        _id: doc._id,
        familyId: doc.questionId || doc._id,       // 家族 ID = 原始 questionId
        versionNumber: 1,
        isLatest: true,
        contentHash: hash
      });
    }

    if (!dryRun && toUpdate.length > 0) {
      // 批量更新
      for (var j = 0; j < toUpdate.length; j += updateBatchSize) {
        var batch = toUpdate.slice(j, j + updateBatchSize);
        var tasks = batch.map(function(item) {
          return coll.doc(item._id).update({
            data: {
              familyId: item.familyId,
              versionNumber: item.versionNumber,
              isLatest: item.isLatest,
              contentHash: item.contentHash
            }
          }).catch(function(e) {
            return { error: (e.message || '').substring(0, 60) };
          });
        });
        await Promise.all(tasks);
      }
    }

    totalUpdated += toUpdate.length;
    totalProcessed += res.data.length;

    console.log('  已扫描 ' + totalProcessed + ' 条, 需迁移 ' + toUpdate.length + ' 条' +
      (dryRun ? ' (预览)' : ' (已写入)'));

    if (res.data.length < batchSize) break;
  }

  return {
    success: true,
    dryRun: dryRun,
    totalProcessed: totalProcessed,
    totalUpdated: totalUpdated,
    totalSkipped: totalSkipped
  };
};
