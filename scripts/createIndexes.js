/**
 * 数据库索引创建指南
 *
 * 经验证，@cloudbase/node-sdk 和 wx-server-sdk 均不支持 createIndex API。
 * 索引只能在云开发控制台手动创建。运行本脚本获取逐条创建指引。
 *
 *   node scripts/createIndexes.js
 */

var INDEXES = [
  // === exam_questions（12 个） ===
  { collection: 'exam_questions', field: 'questionId',      dir: '升序', unique: '是', desc: '题目唯一标识' },
  { collection: 'exam_questions', field: 'subject',          dir: '升序', unique: '否', desc: '按学科筛选' },
  { collection: 'exam_questions', field: 'grade',            dir: '升序', unique: '否', desc: '按年级筛选' },
  { collection: 'exam_questions', field: 'type',             dir: '升序', unique: '否', desc: '按题型筛选' },
  { collection: 'exam_questions', field: 'status',           dir: '升序', unique: '否', desc: '按状态筛选' },
  { collection: 'exam_questions', field: 'difficulty',       dir: '升序', unique: '否', desc: '按难度筛选' },
  { collection: 'exam_questions', field: 'subject, grade',   dir: '升序', unique: '否', desc: '学科+年级组合查询' },
  { collection: 'exam_questions', field: 'subject, grade, type', dir: '升序', unique: '否', desc: '学科+年级+题型（最常用）' },
  { collection: 'exam_questions', field: 'status, createdAt', dir: '升序, 降序', unique: '否', desc: '审核队列按时间排序' },
  { collection: 'exam_questions', field: 'subject, grade, difficulty', dir: '升序', unique: '否', desc: '学科+年级+难度组合' },
  { collection: 'exam_questions', field: 'familyId, versionNumber', dir: '升序, 降序', unique: '否', desc: '题目版本族查询' },
  { collection: 'exam_questions', field: 'familyId, isLatest', dir: '升序', unique: '否', desc: '查询最新版本' },
  // === admins（1 个） ===
  { collection: 'admins', field: 'role', dir: '升序', unique: '否', desc: '管理员角色查询' },
  // === admin_logs（2 个） ===
  { collection: 'admin_logs', field: 'operatorOpenId, timestamp', dir: '升序, 降序', unique: '否', desc: '按操作人+时间查询日志' },
  { collection: 'admin_logs', field: 'action, timestamp', dir: '升序, 降序', unique: '否', desc: '按操作类型+时间查询日志' }
];

function main() {
  console.log('========================================');
  console.log('数据库索引创建指南  (共 ' + INDEXES.length + ' 个)');
  console.log('========================================\n');

  console.log('操作路径:');
  console.log('  微信开发者工具 → 云开发控制台 → 数据库');
  console.log('  → 选择集合 → 索引管理 → 新建索引\n');

  var currentColl = '';
  INDEXES.forEach(function(idx, i) {
    if (idx.collection !== currentColl) {
      currentColl = idx.collection;
      console.log('─────────────────────────────────────────');
      console.log('【集合: ' + currentColl + '】');
      console.log('');
    }
    var num = String(i + 1).padStart(2, ' ');
    console.log(num + '. 字段: ' + idx.field);
    console.log('   方向: ' + idx.dir + '    唯一: ' + idx.unique);
    console.log('   用途: ' + idx.desc);
    console.log('');
  });

  console.log('========================================');
  console.log('提示: 索引创建后立即可用，无需重启或重新部署。');
  console.log('========================================');
}

main();
