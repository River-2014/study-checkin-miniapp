const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 每条记录 500 条，云开发单次查询上限
const MAX_LIMIT = 100;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.main = async (event, context) => {
  const {
    action = 'list',
    // list 参数
    page = 1,
    pageSize = 20,
    subject = '',
    grade = '',
    status = '',
    keyword = '',
    // get 参数
    paperId = '',
    // create 参数
    paper = null,
    // delete 参数
    paperIds = []  // 单个 string 或数组
  } = event;

  // ==========================================
  // action: stats — 统计
  // ==========================================
  if (action === 'stats') {
    try {
      const total = await db.collection('examination_papers').count();
      // 按状态分组统计
      let active = 0, draft = 0, metadata = 0;
      try {
        active = (await db.collection('examination_papers').where({ status: 'active' }).count()).total;
      } catch (_) {}
      try {
        metadata = (await db.collection('examination_papers').where({ status: 'metadata_only' }).count()).total;
      } catch (_) {}
      return {
        success: true,
        stats: {
          total: total.total,
          active,
          metadata_only: metadata,
          other: total.total - active - metadata
        }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // action: list — 分页查询试卷列表
  // ==========================================
  if (action === 'list') {
    try {
      const skip = (page - 1) * pageSize;
      const where = {};

      if (subject) where.subject = subject;
      if (grade) where.grade = grade;
      if (status) where.status = status;
      if (keyword) {
        where.title = db.RegExp({ regexp: escapeRegex(keyword), options: 'i' });
      }

      const result = await db.collection('examination_papers')
        .where(where)
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(Math.min(pageSize, MAX_LIMIT))
        .field({
          // 只返回列表需要的字段，不返回 sections（体积大）
          title: true, subject: true, grade: true,
          year: true, term: true, version: true,
          totalScore: true, duration: true, questionCount: true,
          paperSource: true, status: true, createdAt: true
        })
        .get();

      // 总数
      let total = 0;
      try {
        total = (await db.collection('examination_papers').where(where).count()).total;
      } catch (_) {}

      return {
        success: true,
        list: result.data,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // action: get — 获取单份试卷完整内容
  // ==========================================
  if (action === 'get') {
    if (!paperId) return { success: false, error: 'paperId 不能为空' };
    try {
      const result = await db.collection('examination_papers').doc(paperId).get();
      if (!result.data) return { success: false, error: '试卷不存在' };
      return { success: true, paper: result.data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // action: create — 创建试卷
  // ==========================================
  if (action === 'create') {
    if (!paper || !paper.title) return { success: false, error: '试卷标题不能为空' };

    try {
      // 标题去重
      const exist = await db.collection('examination_papers')
        .where({ title: paper.title })
        .count();
      if (exist.total > 0) {
        return { success: false, error: '已存在同名试卷"' + paper.title + '"' };
      }

      // 计算汇总字段
      let questionCount = 0;
      if (paper.sections && paper.sections.length > 0) {
        paper.sections.forEach(function(s) {
          if (s.questions && s.questions.length > 0) {
            questionCount += s.questions.length;
          }
          // 补全每题内的位置编号
          if (s.questions) {
            s.questions.forEach(function(q, i) {
              q.position = q.position || (i + 1);
              if (!q.difficulty) q.difficulty = '基础巩固';
              if (!q.knowledgePoints) q.knowledgePoints = [];
            });
          }
          if (!s.scorePerQuestion) s.scorePerQuestion = 0;
        });
      }

      const now = new Date();
      const doc = {
        title: paper.title,
        subject: paper.subject || '',
        grade: paper.grade || '',
        year: paper.year || '',
        term: paper.term || '',
        version: paper.version || '',
        sections: paper.sections || [],
        totalScore: paper.totalScore || 0,
        duration: paper.duration || 60,
        questionCount: questionCount,
        paperSource: paper.paperSource || 'manual',
        sourceUrl: paper.sourceUrl || '',
        status: paper.status || 'active',
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('examination_papers').add({ data: doc });
      return {
        success: true,
        paperId: result._id,
        questionCount: questionCount
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // action: delete — 删除试卷（单个/批量）
  // ==========================================
  if (action === 'delete') {
    const ids = Array.isArray(paperIds) ? paperIds : [paperIds];
    if (ids.length === 0) return { success: false, error: 'paperIds 不能为空' };

    try {
      let deleted = 0;
      for (let i = 0; i < ids.length; i++) {
        if (!ids[i]) continue;
        try {
          await db.collection('examination_papers').doc(ids[i]).remove();
          deleted++;
        } catch (err) {
          if (err.errCode === -1) throw err; // 系统错误上抛
          // 记录不存在时跳过
          console.warn('删除失败: ' + ids[i] + ' ' + err.message);
        }
      }
      return { success: true, deleted };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // action: batchDeleteMetadata — 批量删除 metadata_only 试卷
  // ==========================================
  if (action === 'batchDeleteMetadata') {
    try {
      // 先查总数
      const countResult = await db.collection('examination_papers')
        .where({ status: 'metadata_only' })
        .count();
      const total = countResult.total;

      if (total === 0) {
        return { success: true, deleted: 0, message: '没有 metadata_only 记录' };
      }

      // 分批删除（每批 50 条，避免超时）
      let deleted = 0;
      const BATCH = 50;
      while (deleted < total) {
        const batch = await db.collection('examination_papers')
          .where({ status: 'metadata_only' })
          .limit(BATCH)
          .get();

        if (batch.data.length === 0) break;

        for (let i = 0; i < batch.data.length; i++) {
          try {
            await db.collection('examination_papers').doc(batch.data[i]._id).remove();
            deleted++;
          } catch (e) {
            console.warn('删除失败: ' + batch.data[i]._id);
          }
        }
      }

      return { success: true, deleted, total };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // ==========================================
  // action: update — 更新试卷
  // ==========================================
  if (action === 'update') {
    if (!paperId || !paper) return { success: false, error: 'paperId 和 paper 不能为空' };

    try {
      // 重新计算 questionCount
      let questionCount = 0;
      if (paper.sections) {
        paper.sections.forEach(function(s) {
          if (s.questions) questionCount += s.questions.length;
        });
      }
      paper.questionCount = questionCount;
      paper.updatedAt = new Date();

      await db.collection('examination_papers')
        .doc(paperId)
        .update({ data: paper });

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // 未知 action
  return { success: false, error: '未知 action: ' + action };
};
