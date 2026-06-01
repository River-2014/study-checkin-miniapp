// cloudfunctions/migrateExamQuestions/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 年级映射：中文 -> 数字
const gradeMap = {
  '一年级': 1, '二年级': 2, '三年级': 3,
  '四年级': 4, '五年级': 5, '六年级': 6
};

// 题型映射：中文 -> 英文
const typeMap = {
  '选择题': 'choice', '填空题': 'fill', '判断题': 'judge',
  '简答题': 'essay', '应用题': 'essay'
};

// 难度映射：中文 -> 数字 (1~5)
const difficultyMap = {
  '简单': 1, '中等': 2, '能力提升': 3, '困难': 4, '挑战': 5
};

exports.main = async (event, context) => {
  const collection = db.collection('exam_questions');
  const MAX_LIMIT = 100;   // 每次最多取100条

  // 1. 先获取总条数
  const countRes = await collection.count();
  const total = countRes.total;
  console.log(`共有 ${total} 条题目需要迁移`);

  let successCount = 0;
  let failCount = 0;

  // 2. 分批处理
  for (let skip = 0; skip < total; skip += MAX_LIMIT) {
    const batch = await collection.skip(skip).limit(MAX_LIMIT).get();
    for (let doc of batch.data) {
      try {
        const updateData = {};

        // 年级转换
        if (doc.grade && typeof doc.grade === 'string' && gradeMap[doc.grade]) {
          updateData.grade = gradeMap[doc.grade];
        } else if (doc.grade && typeof doc.grade === 'string' && !gradeMap[doc.grade]) {
          console.warn(`未知年级值: ${doc.grade}, 题目ID: ${doc._id}`);
        }

        // 题型转换
        if (doc.type && typeMap[doc.type]) {
          updateData.type = typeMap[doc.type];
        } else if (doc.type && typeof doc.type === 'string' && !typeMap[doc.type]) {
          console.warn(`未知题型: ${doc.type}, 题目ID: ${doc._id}`);
        }

        // 难度转换
        if (doc.difficulty && difficultyMap[doc.difficulty]) {
          updateData.difficulty = difficultyMap[doc.difficulty];
        } else if (doc.difficulty && typeof doc.difficulty === 'string' && !difficultyMap[doc.difficulty]) {
          // 如果是未知难度字符串，默认设为3（中等）
          updateData.difficulty = 3;
          console.warn(`未知难度: ${doc.difficulty}, 默认设为3, 题目ID: ${doc._id}`);
        } else if (typeof doc.difficulty === 'number') {
          // 已经是数字，但可能超出1-5范围，限制一下
          let d = Math.min(5, Math.max(1, doc.difficulty));
          if (d !== doc.difficulty) updateData.difficulty = d;
        }

        // 如果有字段需要更新，执行 update
        if (Object.keys(updateData).length > 0) {
          await collection.doc(doc._id).update({ data: updateData });
          successCount++;
        }
      } catch (err) {
        console.error(`更新失败 ${doc._id}:`, err);
        failCount++;
      }
    }
  }

  return {
    success: true,
    total,
    successCount,
    failCount,
    message: `迁移完成，成功转换 ${successCount} 条，失败 ${failCount} 条`
  };
};