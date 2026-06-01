/**
 * 雷达图绘制模块
 * 六边形多层网格 + 数据填充区域
 */
var config = require('./config');

/**
 * 绘制雷达图
 * @param {Object} canvasNode - Canvas 节点
 * @param {CanvasRenderingContext2D} ctx - 2D 上下文
 * @param {Object} data - 数据 { items: [{ label, value }] }，value 范围 0-100
 * @param {Object} options - 配置 { width, height, padding, levels, fillColor, strokeColor }
 */
function drawRadarChart(canvasNode, ctx, data, options) {
  try {
    var items = data && data.items ? data.items : [];
    if (items.length === 0) {
      drawEmpty(ctx, options.width, options.height);
      return;
    }

    var opt = options || {};
    var w = opt.width || 300;
    var h = opt.height || 200;
    var pad = opt.padding || { top: 25, right: 25, bottom: 25, left: 25 };
    var levels = opt.levels || 4;
    var fillColor = opt.fillColor || config.DEFAULT_COLORS.radarFill;
    var strokeColor = opt.strokeColor || config.DEFAULT_COLORS.radarStroke;

    config.clearCanvas(ctx, w, h);

    var count = items.length;
    if (count < 3) {
      drawEmpty(ctx, w, h);
      return;
    }

    var cx = w / 2;
    var cy = h / 2;
    var radius = Math.min(w - pad.left - pad.right, h - pad.top - pad.bottom) / 2;

    var angleStep = (Math.PI * 2) / count;

    // 绘制多层网格
    for (var level = 1; level <= levels; level++) {
      var r = (radius / levels) * level;
      ctx.beginPath();
      for (var i = 0; i < count; i++) {
        var angle = -Math.PI / 2 + i * angleStep;
        var x = cx + r * Math.cos(angle);
        var y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = config.DEFAULT_COLORS.radarGrid;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // 绘制轴线
    for (var i = 0; i < count; i++) {
      var angle = -Math.PI / 2 + i * angleStep;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      ctx.strokeStyle = config.DEFAULT_COLORS.radarGrid;
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // 绘制数据多边形
    ctx.beginPath();
    for (var i = 0; i < count; i++) {
      var item = items[i];
      var val = Math.max(0, Math.min(100, item.value || 0));
      var r = (val / 100) * radius;
      var angle = -Math.PI / 2 + i * angleStep;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制数据点
    for (var i = 0; i < count; i++) {
      var item = items[i];
      var val = Math.max(0, Math.min(100, item.value || 0));
      var r = (val / 100) * radius;
      var angle = -Math.PI / 2 + i * angleStep;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = config.DEFAULT_COLORS.white;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 标签（轴末端）
    ctx.fillStyle = config.DEFAULT_COLORS.text;
    ctx.font = config.DEFAULT_FONTS.label + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < count; i++) {
      var angle = -Math.PI / 2 + i * angleStep;
      var labelR = radius + 20;
      var lx = cx + labelR * Math.cos(angle);
      var ly = cy + labelR * Math.sin(angle);
      var label = items[i].label || '';
      if (label.length > 4) label = label.substring(0, 4);
      ctx.fillText(label, lx, ly);
    }

    // 数值标签（数据点位置）
    ctx.fillStyle = config.DEFAULT_COLORS.primary;
    ctx.font = config.DEFAULT_FONTS.value + 'px sans-serif';
    for (var i = 0; i < count; i++) {
      var item = items[i];
      var val = Math.max(0, Math.min(100, item.value || 0));
      var r = (val / 100) * radius;
      var angle = -Math.PI / 2 + i * angleStep;
      var x = cx + r * Math.cos(angle);
      var y = cy + r * Math.sin(angle);

      var offsetX = 0;
      var offsetY = -10;
      if (angle > -0.3 && angle < 0.3) offsetX = 10;
      else if (angle > Math.PI - 0.3 || angle < -Math.PI + 0.3) offsetX = -10;
      ctx.fillText(val + '%', x + offsetX, y + offsetY);
    }
  } catch (e) {
    drawError(ctx, options ? options.width : 300, options ? options.height : 200, '图表加载失败');
  }
}

function drawEmpty(ctx, w, h) {
  ctx.fillStyle = config.DEFAULT_COLORS.label;
  ctx.font = config.DEFAULT_FONTS.label + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暂无数据', w / 2, h / 2);
}

function drawError(ctx, w, h, msg) {
  ctx.fillStyle = '#FF6B6B';
  ctx.font = config.DEFAULT_FONTS.label + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg || '数据加载失败', w / 2, h / 2);
}

module.exports = {
  drawRadarChart: drawRadarChart
};
