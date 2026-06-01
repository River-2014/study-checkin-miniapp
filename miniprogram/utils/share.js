/**
 * 分享卡片生成工具
 * 使用 Canvas 2D 绘制鼓励卡，导出为图片
 */
var chartConfig = require('./charts/config');

var ENCOURAGE = [
  '坚持就是胜利💪', '你是最棒的🏆', '每天进步一点点🌱',
  '小升初必胜🔥', '爸爸妈妈为你骄傲❤️', '学习使我快乐😊'
];

/**
 * 生成鼓励卡并返回临时路径
 * @param {Number} streak  连续打卡天数
 * @param {Number} stars   星星总数
 * @param {String} name    孩子昵称（可选）
 * @returns {Promise<String>} 图片临时路径
 */
function generateShareCard(streak, stars, name, extra) {
  extra = extra || {};
  return new Promise(function(resolve, reject) {
    var query = wx.createSelectorQuery();
    query.select('#shareCanvas').node(function(res) {
      try {
        if (!res || !res.node) { reject(new Error('Canvas not found')); return; }
        var canvas = res.node;
        var ctx = canvas.getContext('2d');
        var dpr = wx.getSystemInfoSync().pixelRatio || 2;
        var W = 560, H = 540;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        // 背景渐变
        var grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#FF9F43');
        grad.addColorStop(0.5, '#FDCB6E');
        grad.addColorStop(1, '#FFEAA7');
        ctx.fillStyle = grad;
        ctx.beginPath();
        chartConfig.roundRect(ctx, 20, 20, W - 40, H - 40, 24);
        ctx.fill();

        // 装饰圆点
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (var i = 0; i < 8; i++) {
          ctx.beginPath();
          ctx.arc(60 + i * 65, 50 + Math.sin(i) * 15, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        // 标题
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎉 小升初冲刺 🎉', W / 2, 90);

        // 昵称
        ctx.font = '28px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText((name || '小勇士') + ' 的学习成绩单', W / 2, 135);

        // 火焰 + 天数
        ctx.font = '64px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('🔥 ' + streak + ' 天', W / 2, 215);

        // 星星
        ctx.font = '36px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText('⭐ ' + stars + ' 颗星星', W / 2, 265);

        // 分隔线
        var lineY = 295;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(100, lineY);
        ctx.lineTo(W - 100, lineY);
        ctx.stroke();

        // 额外数据行
        var dataY = 335;
        ctx.font = '26px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        if (extra.monthCheckins !== undefined) {
          ctx.fillText('📅 本月已打卡 ' + extra.monthCheckins + ' 天', W / 2, dataY);
          dataY += 40;
        }
        if (extra.totalCheckins !== undefined) {
          ctx.fillText('🎯 累计打卡 ' + extra.totalCheckins + ' 次', W / 2, dataY);
          dataY += 40;
        }
        if (extra.latestBadge) {
          ctx.fillText('🏆 最新成就：' + extra.latestBadge, W / 2, dataY);
          dataY += 40;
        }

        // 鼓励语
        var msg = ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
        ctx.font = '28px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('「' + msg + '」', W / 2, dataY + 15);

        // 底部
        ctx.font = '22px sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('—— 小升初打卡小程序', W / 2, dataY + 55);

        // 导出图片
        wx.canvasToTempFilePath({
          canvas: canvas, fileType: 'jpg', quality: 0.9,
          success: function(res) { resolve(res.tempFilePath); },
          fail: function(err) { reject(err); }
        });
      } catch (e) {
        reject(new Error('卡片生成失败: ' + e.message));
      }
    }).exec();
  });
}

module.exports = { generateShareCard: generateShareCard };
