/**
 * 柱状图绘制模块
 * 接收数据数组，在 Canvas 上绘制柱状图
 */
var config = require('./config');

/**
 * 绘制柱状图
 * @param {Object} canvasNode - Canvas 节点（用于动画）
 * @param {CanvasRenderingContext2D} ctx - 2D 渲染上下文
 * @param {Object} data - 数据 { items: [{ label, value }] }
 * @param {Object} options - 配置 { width, height, padding, barColor, labelColor, animated }
 */
function drawBarChart(canvasNode, ctx, data, options) {
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
    var barColor = opt.barColor || config.DEFAULT_COLORS.primary;
    var labelColor = opt.labelColor || config.DEFAULT_COLORS.label;
    var animated = opt.animated !== false;

    config.clearCanvas(ctx, w, h);

    // 计算绘图区域
    var chartTop = pad.top;
    var chartBottom = h - pad.bottom;
    var chartLeft = pad.left;
    var chartRight = w - pad.right;
    var chartWidth = chartRight - chartLeft;
    var chartHeight = chartBottom - chartTop;

    // 找最大值
    var maxVal = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].value > maxVal) maxVal = items[i].value;
    }
    if (maxVal === 0) maxVal = 1;

    // 柱宽和间距
    var barGap = chartWidth * 0.1 / (items.length + 1);
    var barWidth = (chartWidth - barGap * (items.length + 1)) / items.length;
    if (barWidth < 8) barWidth = 8;

    // 绘制 Y 轴参考线（4 等分）
    ctx.strokeStyle = config.DEFAULT_COLORS.grid;
    ctx.lineWidth = 0.5;
    for (var g = 1; g <= 4; g++) {
      var y = chartBottom - (chartHeight / 4) * g;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(chartRight, y);
      ctx.stroke();
      // Y 轴刻度标签
      ctx.fillStyle = config.DEFAULT_COLORS.axis;
      ctx.font = config.DEFAULT_FONTS.axis + 'px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round((maxVal / 4) * g), chartLeft - 5, y);
    }

    // 绘制柱子
    var animateProgress = 1;
    if (animated && canvasNode) {
      animateProgress = 0;
      // 简单的逐帧动画
      var startTime = Date.now();
      var duration = 400;
      function animate() {
        var elapsed = Date.now() - startTime;
        animateProgress = Math.min(elapsed / duration, 1);
        drawBars(animateProgress);
        if (animateProgress < 1) {
          canvasNode.requestAnimationFrame(animate);
        }
      }
      canvasNode.requestAnimationFrame(animate);
    } else {
      drawBars(1);
    }

    function drawBars(progress) {
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var x = chartLeft + barGap + i * (barWidth + barGap);
        var targetH = (item.value / maxVal) * chartHeight;
        var barH = targetH * progress;
        var y = chartBottom - barH;

        // 渐变填充
        var gradient = ctx.createLinearGradient(x, chartBottom, x, chartBottom - barH);
        gradient.addColorStop(0, config.DEFAULT_COLORS.gradientEnd);
        gradient.addColorStop(1, barColor);
        ctx.fillStyle = gradient;

        config.roundRect(ctx, x, y, barWidth, barH, 3);
        ctx.fill();

        // 柱顶数值
        if (item.value > 0) {
          ctx.fillStyle = config.DEFAULT_COLORS.text;
          ctx.font = config.DEFAULT_FONTS.value + 'px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(item.value + '%', x + barWidth / 2, y - 3);
        }

        // 底部标签
        ctx.fillStyle = labelColor;
        ctx.font = config.DEFAULT_FONTS.label + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        var label = item.label || '';
        if (label.length > 5) label = label.substring(0, 5) + '..';
        ctx.fillText(label, x + barWidth / 2, chartBottom + 5);
      }
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
  drawBarChart: drawBarChart
};
