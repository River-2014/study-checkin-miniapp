/**
 * dedupQuestions — 修复重复 questionId
 *
 * 查找 questionId 重复的文档，保留内容最完整的一条，
 * 其余重复文档重新生成唯一 questionId。
 *
 * 使用: 部署后传入 {} 预览，传入 { "dryRun": false } 执行修复
 */

var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;
var crypto = require('crypto');

function md5(s) {
  return crypto.createHash('md5').update(String(s)).digest('hex');
}

exports.main = async function(event) {
  var dryRun = event.dryRun !== false;
  var coll = db.collection('exam_questions');
  var dupGroups = [];

  console.log('扫描重复 questionId...\n');

  // 用聚合管道找出重复的 questionId
  try {
    var aggRes = await coll
      .aggregate()
      .group({ _id: '$questionId', count: { $sum: 1 }, ids: { $addToSet: '$_id' } })
      .match({ count: { $gt: 1 } })
      .sort({ count: -1 })
      .limit(100)
      .end();

    dupGroups = aggRes.list || [];
  } catch (e) {
    // 聚合不可用则用分页扫描
    return { success: false, error: '聚合查询失败: ' + e.message.substring(0, 80) };
  }

  if (dupGroups.length === 0) {
    return { success: true, fixed: 0, message: '无重复 questionId，可以直接创建唯一索引' };
  }

  console.log('发现 ' + dupGroups.length + ' 组重复 questionId\n');

  var totalDups = 0;
  var fixed = 0;
  var errors = [];

  for (var g = 0; g < dupGroups.length; g++) {
    var group = dupGroups[g];
    var qid = group._id;
    var ids = group.ids;
    totalDups += Math.max(0, ids.length - 1);

    // 读取这些文档的完整内容
    var docs = [];
    try {
      for (var i = 0; i < ids.length; i++) {
        var docRes = await coll.doc(ids[i]).get();
        if (docRes.data) docs.push(docRes.data);
      }
    } catch (e) {
      errors.push({ qid: qid, error: '读取失败' });
      continue;
    }

    if (docs.length <= 1) continue;

    // 按内容完整度排序：保留最完整的一条（stem最长 + answer非空优先）
    docs.sort(function(a, b) {
      var scoreA = (a.stem ? a.stem.length : 0) + (a.answer ? 100 : 0) + (a.explanation ? 50 : 0);
      var scoreB = (b.stem ? b.stem.length : 0) + (b.answer ? 100 : 0) + (b.explanation ? 50 : 0);
      return scoreB - scoreA;
    });

    // 第一条保留，其余重新生成 questionId
    for (var j = 1; j < docs.length; j++) {
      var doc = docs[j];
      var newQid = md5(
        (doc.stem || '').replace(/[\s\n\r\t]+/g, '').substring(0, 80) +
        '|' + (doc.subject || '') +
        '|' + (doc.grade || '') +
        '|' + doc._id  // 加上 _id 保证唯一
      );

      console.log('  ' + qid.substring(0, 12) + '... → ' + newQid.substring(0, 12) + '... | stem:' + (doc.stem || '').substring(0, 20));

      if (!dryRun) {
        try {
          await coll.doc(doc._id).update({
            data: {
              questionId: newQid,
              familyId: newQid,
              updatedAt: db.serverDate()
            }
          });
          fixed++;
        } catch (e) {
          errors.push({ qid: qid, docId: doc._id, error: e.message.substring(0, 60) });
        }
      } else {
        fixed++;
      }
    }
  }

  var result = {
    success: true,
    dryRun: dryRun,
    duplicateGroups: dupGroups.length,
    totalDuplicateDocs: totalDups,
    fixed: fixed,
    errors: errors.slice(0, 10)
  };

  if (dryRun) {
    result.message = '预览完成。传入 { "dryRun": false } 执行修复。';
  }

  return result;
};
