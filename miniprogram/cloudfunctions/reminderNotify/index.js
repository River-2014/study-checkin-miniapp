/**
 * reminderNotify 云函数
 * 定时触发器：每天指定时间推送打卡提醒
 *
 * 环境变量：
 *   REMINDER_HOUR   - 提醒小时（默认 19）
 *   REMINDER_MINUTE - 提醒分钟（默认 30）
 *   TEMPLATE_ID     - 微信订阅消息模板 ID
 *
 * 配置：config.json 中设置定时触发器（每天指定时间）
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async function() {
  try {
    var userDataColl = db.collection('user_data');
    var result = await userDataColl.get();
    if (!result.data || result.data.length === 0) {
      return { success: true, notified: 0, message: '无用户数据' };
    }

    var now = new Date();
    var todayStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');

    var templateId = process.env.TEMPLATE_ID || '';
    var notified = 0;

    for (var i = 0; i < result.data.length; i++) {
      try {
        var doc = result.data[i];
        var userData = doc.data;
        if (!userData || !userData.user) continue;

        var reminder = userData.user.reminder;
        if (!reminder || !reminder.enabled) continue;

        // 检查今天是否已提醒过
        if (reminder.lastRemindedDate === todayStr) continue;

        // 检查今天是否已打卡
        var checkins = userData.checkins || {};
        if (checkins[todayStr] && checkins[todayStr].length > 0) continue;

        // 发送模板消息
        if (templateId && doc._openid) {
          try {
            await cloud.openapi.subscribeMessage.send({
              touser: doc._openid,
              templateId: templateId,
              page: 'pages/home/home',
              data: {
                thing1: { value: '今日学习任务未完成' },
                time2: { value: reminder.hour + ':' + String(reminder.minute).padStart(2, '0') },
                thing3: { value: '坚持打卡，积少成多！' }
              }
            });
            notified++;
          } catch (e) {
            // 用户未订阅或模板消息发送失败，静默跳过
          }
        }

        // 更新提醒状态
        userData.user.reminder.lastRemindedDate = todayStr;
        await userDataColl.doc(doc._id).update({
          data: { data: userData, updatedAt: db.serverDate() }
        });

      } catch (e) {
        // 单用户失败不影响其他用户
      }
    }

    return { success: true, notified: notified };
  } catch (e) {
    return { success: false, message: e.message };
  }
};
