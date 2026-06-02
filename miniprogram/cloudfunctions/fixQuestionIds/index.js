/**
 * fixQuestionIds — 修复缺失 questionId 的题目文档
 *
 * 唯一索引要求所有文档的 questionId 字段非空且唯一。
 * 本函数为缺少 questionId 的文档生成 questionId，并同时填充版本控制字段。
 *
 * 使用: 部署后测试传入 {} 即可
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
  var dryRun = event.dryRun !== false;  // 默认预览
  var coll = db.collection('exam_questions');

  // 查询 questionId 为 null 或不存在 或为空串的文档
  // 云开发数据库: 用 _.or 组合条件
  var res = await coll
    .where(_.or([
      { questionId: _.exists(false) },
      { questionId: null },
      { questionId: '' }
    ]))
    .limit(200)
    .get();

  var docs = res.data || [];
  if (docs.length === 0) {
    return { success: true, fixed: 0, message: '所有文档都有 questionId，无需修复' };
  }

  console.log('找到 ' + docs.length + ' 条缺少 questionId 的文档');

  if (dryRun) {
    console.log('预览模式，不实际修改。传入 { "dryRun": false } 执行修复。');
    var preview = docs.slice(0, 5).map(function(d) {
      return { _id: d._id, stem: (d.stem || '').substring(0, 30) };
    });
    return { success: true, dryRun: true, count: docs.length, preview: preview };
  }

  var fixed = 0;
  var errors = 0;

  for (var i = 0; i < docs.length; i++) {
    var doc = docs[i];
    var stem = (doc.stem || '').trim();
    var subject = doc.subject || '数学';
    var grade = doc.grade || '六年级';

    var shortStem = stem.replace(/[\s\n\r\t]+/g, '').substring(0, 80);
    var questionId = doc.questionId || md5(shortStem + '|' + subject + '|' + grade);

    var contentHash = md5(
      stem.substring(0, 100) + '|' +
      (doc.options || []).join(',') + '|' +
      (doc.answer || '') + '|' +
      (doc.explanation || '')
    );

    try {
      await coll.doc(doc._id).update({
        data: {
          questionId: questionId,
          familyId: doc.familyId || questionId,
          versionNumber: doc.versionNumber || 1,
          isLatest: doc.isLatest !== false,
          contentHash: doc.contentHash || contentHash
        }
      });
      fixed++;
    } catch (e) {
      errors++;
      console.log('  修复失败: ' + doc._id + ' - ' + e.message.substring(0, 60));
    }
  }

  return { success: true, dryRun: false, total: docs.length, fixed: fixed, errors: errors };
};
