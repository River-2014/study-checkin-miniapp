/**
 * 折线图绘制模块
 * 带填充区域、数据点、网格线的趋势图
 */
var config = require('./config');

/**
 * 绘制折线图
 * @param {Object} canvasNode - Canvas 节点
 * @param {CanvasRenderingContext2D} ctx - 2D 上下文
 * @param {Object} data - 数据 { items: [{ label, value }] }
 * @param {Object} options - 配置 { width, height, padding, lineColor, fillColor, showDots, smooth }
 */
function drawLineChart(canvasNode, ctx, data, options) {
  try {
    var items = data && data.items ? data.items : [];
    if (items.length === 0) {
      drawEmpty(ctx, options.width, options.height);
      return;
    }

    var opt = options || {};
    var w = opt.width || 300;
    var h = opt.height || 200;
    var pad = opt.padding || config.DEFAULT_PADDING;
    var lineColor = opt.lineColor || config.DEFAULT_COLORS.primary;
    var fillColor = opt.fillColor || config.DEFAULT_COLORS.gradientEnd;
    var showDots = opt.showDots !== false;
    var smooth = opt.smooth !== false;

    config.clearCanvas(ctx, w, h);

    var chartTop = pad.top;
    var chartBottom = h - pad.bottom;
    var chartLeft = pad.left;
    var chartRight = w - pad.right;
    var chartWidth = chartRight - chartLeft;
    var chartHeight = chartBottom - chartTop;

    // 找最大值/最小值
    var maxVal = -Infinity;
    var minVal = Infinity;
    for (var i = 0; i < items.length; i++) {
      if (items[i].value > maxVal) maxVal = items[i].value;
      if (items[i].value < minVal) minVal = items[i].value;
    }
    if (maxVal === minVal) {
      maxVal = maxVal + 10;
      minVal = Math.max(0, minVal - 10);
    }
    // 扩展范围，让折线更美观
    var range = maxVal - minVal;
    maxVal = maxVal + range * 0.1;
    minVal = Math.max(0, minVal - range * 0.1);
    if (maxVal === minVal) maxVal = minVal + 10;

    // 计算数据点坐标
    var points = [];
    var stepX = items.length > 1 ? chartWidth / (items.length - 1) : chartWidth / 2;

    for (var i = 0; i < items.length; i++) {
      var x = chartLeft + i * stepX;
      var y = chartBottom - ((items[i].value - minVal) / (maxVal - minVal)) * chartHeight;
      points.push({ x: x, y: y, label: items[i].label, value: items[i].value });
    }

    // 绘制网格线（4 等分）
    ctx.strokeStyle = config.DEFAULT_COLORS.grid;
    ctx.lineWidth = 0.5;
    for (var g = 1; g <= 4; g++) {
      var gy = chartBottom - (chartHeight / 4) * g;
      ctx.beginPath();
      ctx.moveTo(chartLeft, gy);
      ctx.lineTo(chartRight, gy);
      ctx.stroke();
      // Y 轴刻度
      ctx.fillStyle = config.DEFAULT_COLORS.axis;
      ctx.font = config.DEFAULT_FONTS.axis + 'px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      var tickVal = Math.round(minVal + (maxVal - minVal) / 4 * g);
      ctx.fillText(tickVal + '%', chartLeft - 5, gy);
    }

    // 绘制填充区域
    ctx.beginPath();
    if (smooth && points.length >= 3) {
      ctx.moveTo(points[0].x, points[0].y);
      for (var i = 1; i < points.length - 1; i++) {
        var cx = (points[i].x + points[i + 1].x) / 2;
        var cy = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, cx, cy);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    } else {
      for (var i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].x, points[i].y);
        else ctx.lineTo(points[i].x, points[i].y);
      }
    }
    ctx.lineTo(points[points.length - 1].x, chartBottom);
    ctx.lineTo(points[0].x, chartBottom);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // 绘制折线
    ctx.beginPath();
    if (smooth && points.length >= 3) {
      ctx.moveTo(points[0].x, points[0].y);
      for (var i = 1; i < points.length - 1; i++) {
        var cx = (points[i].x + points[i + 1].x) / 2;
        var cy = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, cx, cy);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    } else {
      for (var i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].x, points[i].y);
        else ctx.lineTo(points[i].x, points[i].y);
      }
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制数据点
    if (showDots) {
      for (var i = 0; i < points.length; i++) {
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
        ctx.fillStyle = config.DEFAULT_COLORS.white;
        ctx.fill();
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 数据点数值
    for (var i = 0; i < points.length; i++) {
      ctx.fillStyle = config.DEFAULT_COLORS.text;
      ctx.font = config.DEFAULT_FONTS.value + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(points[i].value + '%', points[i].x, points[i].y - 8);
    }

    // X 轴标签（间隔显示避免重叠）
    var labelStep = items.length > 8 ? Math.ceil(items.length / 6) : 1;
    for (var i = 0; i < points.length; i += labelStep) {
      ctx.fillStyle = config.DEFAULT_COLORS.label;
      ctx.font = config.DEFAULT_FONTS.label + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var label = points[i].label || '';
      if (label.length > 5) label = label.substring(0, 5) + '..';
      ctx.fillText(label, points[i].x, chartBottom + 5);
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
  drawLineChart: drawLineChart
};
