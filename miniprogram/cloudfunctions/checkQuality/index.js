/**
 * checkQuality 云函数
 *
 * 每日质量检查：统计新增题目、高频错题、低正确率题目、未审核题目。
 * 输出 Markdown 报告，可通过 GitHub Actions 推送到企业微信。
 *
 * 触发器: 每天 UTC 00:00 通过 GitHub Actions 或云函数定时触发
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;

exports.main = async function(event) {
  var yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  var yesterdayStr = yesterday.toISOString().substring(0, 10);
  var threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000);

  var report = {
    date: yesterdayStr,
    sections: []
  };

  try {
    // 1. 昨日新增题目统计
    var yesterdayStart = new Date(yesterdayStr + 'T00:00:00+08:00');
    var yesterdayEnd = new Date(yesterdayStr + 'T23:59:59+08:00');

    var newQuestions = await db.collection('exam_questions')
      .where({ createdAt: _.gte(yesterdayStart).and(_.lte(yesterdayEnd)), isLatest: true })
      .count();

    var newBySubject = await db.collection('exam_questions')
      .aggregate()
      .match({ createdAt: _.gte(yesterdayStart).and(_.lte(yesterdayEnd)), isLatest: true })
      .group({ _id: { subject: '$subject', status: '$status' }, count: _.sum(1) })
      .end();

    report.sections.push({
      title: '昨日新增题目',
      total: newQuestions.total,
      breakdown: (newBySubject.list || []).map(function(item) {
        return item._id.subject + '/' + (item._id.status || 'active') + ': ' + item.count + ' 道';
      })
    });

    // 2. 高频错题 TOP5
    var topMistakes = await db.collection('exam_questions')
      .aggregate()
      .match({ isLatest: true, usageCount: _.gt(5) })
      .project({
        stem: 1, subject: 1, grade: 1,
        errorCount: _.subtract(['$usageCount', '$correctCount']),
        errorRate: _.subtract([1, _.divide(['$correctCount', '$usageCount'])])
      })
      .sort({ errorCount: -1 })
      .limit(5)
      .end();

    report.sections.push({
      title: '高频错题 TOP5',
      items: (topMistakes.list || []).map(function(q) {
        return {
          stem: (q.stem || '').substring(0, 50),
          subject: q.subject, grade: q.grade,
          errorCount: q.errorCount,
          errorRate: Math.round(q.errorRate * 100) + '%'
        };
      })
    });

    // 3. 低正确率题目
    var lowAccuracy = await db.collection('exam_questions')
      .aggregate()
      .match({ isLatest: true, usageCount: _.gt(5), correctCount: _.lte(_.multiply(['$usageCount', 0.4])) })
      .project({ stem: 1, subject: 1, grade: 1, usageCount: 1, correctCount: 1 })
      .sort({ usageCount: -1 })
      .limit(10)
      .end();

    report.sections.push({
      title: '低正确率题目（<40%）',
      count: (lowAccuracy.list || []).length,
      items: (lowAccuracy.list || []).map(function(q) {
        var rate = q.usageCount > 0 ? Math.round(q.correctCount / q.usageCount * 100) : 0;
        return (q.stem || '').substring(0, 40) + ' [' + q.subject + q.grade + '] 正确率' + rate + '%';
      })
    });

    // 4. 长时间未审核
    var pendingCount = await db.collection('exam_questions')
      .where({ status: 'pending', createdAt: _.lt(threeDaysAgo) })
      .count();

    report.sections.push({
      title: '超过3天未审核题目',
      count: pendingCount.total
    });

    // 5. 题库概览
    var totalApproved = await db.collection('exam_questions')
      .where({ isLatest: true, status: 'approved' }).count();
    var totalPending = await db.collection('exam_questions')
      .where({ isLatest: true, status: 'pending' }).count();

    report.sections.push({
      title: '题库概览',
      approved: totalApproved.total,
      pending: totalPending.total
    });

    // 生成 Markdown
    var md = '# 每日题库质量报告\n';
    md += '> ' + yesterdayStr + '\n\n';

    report.sections.forEach(function(sec) {
      md += '## ' + sec.title + '\n\n';
      if (sec.total !== undefined) md += '**总数**: ' + sec.total + '\n\n';
      if (sec.breakdown) {
        sec.breakdown.forEach(function(b) { md += '- ' + b + '\n'; });
        md += '\n';
      }
      if (sec.items) {
        sec.items.forEach(function(item, idx) {
          if (typeof item === 'string') {
            md += (idx + 1) + '. ' + item + '\n';
          } else {
            md += (idx + 1) + '. ' + (item.stem || item) + '\n';
          }
        });
        md += '\n';
      }
      if (sec.approved !== undefined) {
        md += '- 已审核: ' + sec.approved + ' 道\n';
        md += '- 待审核: ' + sec.pending + ' 道\n\n';
      }
      if (sec.count !== undefined && !sec.items) {
        md += '**数量**: ' + sec.count + '\n\n';
      }
    });

    // 写入 daily_stats 集合（供 getStats 预聚合读取）
    try {
      await db.collection('daily_stats').add({
        data: {
          type: 'stats_summary',
          period: 'last30days',
          date: yesterdayStr,
          data: report,
          createdAt: db.serverDate()
        }
      });
    } catch (e) { /* 写入失败不影响报告生成 */ }

    return {
      success: true,
      report: report,
      markdown: md.substring(0, 4000) // 微信 Markdown 消息长度限制
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
