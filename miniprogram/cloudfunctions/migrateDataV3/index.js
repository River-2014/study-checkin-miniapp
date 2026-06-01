const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

/**
 * 数据迁移 V3：清洗 exam_questions，建立 examination_papers 试卷库
 *
 * 入参：
 *   action: 'stats' | 'preview' | 'migrate'
 *   dryRun: boolean（默认 true，预览模式）
 *   limit: number（可选，限制处理数量）
 *
 * 逻辑：
 *   1. paperSource === 'shijuan1' 或以 'tiku.cn' 开头 → 写入 examination_papers（metadata_only），从 exam_questions 删除
 *   2. paperSource === 'seed' | 'manual' | 'crawl' → 保留在 exam_questions
 */

exports.main = async (event, context) => {
  const { action = 'preview', dryRun = true, limit = 0 } = event;

  // ===== 统计当前数据 =====
  if (action === 'stats') {
    try {
      const qTotal = await db.collection('exam_questions').count();
      const pTotal = await db.collection('examination_papers').count();
      return { success: true, exam_questions: qTotal.total, examination_papers: pTotal.total };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ===== 预览 / 迁移 =====
  const BATCH_SIZE = 100;
  let total = 0, moved = 0, kept = 0, deleted = 0, errors = [];
  const previewSamples = []; // dryRun 时收集前 5 条样本

  try {
    // 先获取总数
    const countResult = await db.collection('exam_questions').count();
    total = countResult.total;
    console.log('exam_questions 总数: ' + total);

    let offset = 0;
    let processed = 0;
    const maxProcess = limit > 0 ? Math.min(limit, total) : total;

    while (offset < total && processed < maxProcess) {
      const batch = await db.collection('exam_questions')
        .skip(offset)
        .limit(Math.min(BATCH_SIZE, maxProcess - processed))
        .get();

      for (let i = 0; i < batch.data.length; i++) {
        const doc = batch.data[i];
        const source = (doc.paperSource || '').toString();
        const isMetadata = source === 'shijuan1' || source.indexOf('tiku.cn') === 0;

        if (isMetadata) {
          if (!dryRun) {
            try {
              // 使用 doc.set 覆盖写入（若 _id 冲突则覆盖，防止重复记录）
              await db.collection('examination_papers').doc(doc._id).set({
                data: {
                  title: (doc.stem || '').substring(0, 200),
                  subject: doc.subject || '',
                  grade: doc.grade || '',
                  year: '',
                  term: '',
                  version: '',
                  sections: [],
                  totalScore: null,
                  duration: null,
                  questionCount: 0,
                  paperSource: source,
                  sourceUrl: doc.paperSource || '',
                  status: 'metadata_only',
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              });

              // 从 exam_questions 删除
              await db.collection('exam_questions').doc(doc._id).remove();
              deleted++;
            } catch (err) {
              // doc.set 对新集合可能失败（_id 已存在），此时用 add + 新 _id
              if (err.errCode === -1) throw err;
              try {
                await db.collection('examination_papers').add({
                  data: {
                    title: (doc.stem || '').substring(0, 200),
                    subject: doc.subject || '',
                    grade: doc.grade || '',
                    year: '',
                    term: '',
                    version: '',
                    sections: [],
                    totalScore: null,
                    duration: null,
                    questionCount: 0,
                    paperSource: source,
                    sourceUrl: doc.paperSource || '',
                    status: 'metadata_only',
                    createdAt: new Date(),
                    updatedAt: new Date()
                  }
                });
                await db.collection('exam_questions').doc(doc._id).remove();
                deleted++;
              } catch (err2) {
                errors.push({ _id: doc._id, stem: (doc.stem || '').substring(0, 40), error: err2.message });
                continue;
              }
            }
          }

          moved++;
          // 前 5 条记录样本
          if (previewSamples.length < 5) {
            previewSamples.push({
              _id: doc._id,
              stem: (doc.stem || '').substring(0, 60),
              paperSource: source,
              subject: doc.subject,
              grade: doc.grade,
              action: '→ examination_papers (metadata_only)'
            });
          }
        } else {
          kept++;
        }
        processed++;
      }

      offset += BATCH_SIZE;
      console.log('已处理: ' + Math.min(offset, total) + '/' + total);
    }

    // 最终统计
    let finalQ = 0, finalP = 0;
    try {
      finalQ = (await db.collection('exam_questions').count()).total;
      finalP = (await db.collection('examination_papers').count()).total;
    } catch (_) {}

    return {
      success: true,
      dryRun,
      summary: {
        totalScanned: total,
        processLimit: limit,
        recordsMoved: moved,
        recordsKept: kept,
        recordsDeleted: deleted,
        errors: errors.length
      },
      preview: previewSamples,
      after: {
        exam_questions: finalQ,
        examination_papers: finalP
      }
    };

  } catch (e) {
    console.error('迁移失败:', e);
    return {
      success: false,
      error: e.message,
      partial: { total, moved, kept, deleted, errors: errors.length }
    };
  }
};
