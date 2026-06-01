/**
 * Canvas 图表通用配置与工具
 * 统一 Canvas 上下文获取、DPR 处理、默认样式
 */

// 默认配色方案
var DEFAULT_COLORS = {
  primary: '#FF9F43',
  primaryLight: '#FFB976',
  primaryDark: '#E08500',
  text: '#666666',
  grid: '#EEEEEE',
  label: '#999999',
  white: '#FFFFFF',
  gradientStart: 'rgba(255, 159, 67, 0.8)',
  gradientEnd: 'rgba(255, 159, 67, 0.1)',
  dataPoint: '#FF9F43',
  dataPointBorder: '#FFFFFF',
  radarFill: 'rgba(255, 159, 67, 0.3)',
  radarStroke: '#FF9F43',
  radarGrid: '#E8E8E8'
};

// 默认字体配置（单位：逻辑像素 px）
var DEFAULT_FONTS = {
  title: 14,
  label: 11,
  value: 10,
  axis: 10,
  legend: 10
};

// 默认间距
var DEFAULT_PADDING = {
  top: 20,
  right: 15,
  bottom: 25,
  left: 35
};

/**
 * 统一获取 Canvas 2D 节点和上下文
 * @param {string} selector - Canvas 组件的 id 选择器，如 '#chartCanvas'
 * @param {Object} scope - 调用者 this（Page 或 Component 实例）
 * @returns {Object} { canvas, ctx, dpr, width, height } 或 { error: true, message: string }
 */
function getCanvasContext(selector, scope) {
  try {
    var sysInfo = wx.getSystemInfoSync();
    var dpr = sysInfo.pixelRatio || 2;

    // 使用 chooseNode 方式获取（适用于 type="2d"）
    var query = scope ? wx.createSelectorQuery().in(scope) : wx.createSelectorQuery();
    var nodeRef = query.select(selector);

    if (!nodeRef) {
      return { error: true, message: 'Canvas 节点未找到: ' + selector };
    }

    // 由于 SelectorQuery.exec 是异步的，此处返回 Promise 风格对象
    // 调用方必须在 exec 回调中使用返回的 canvas/ctx
    return {
      getNode: function(callback) {
        nodeRef.fields({ node: true, size: true }).exec(function(res) {
          if (!res || !res[0] || !res[0].node) {
            if (callback) callback({ error: true, message: 'Canvas 节点获取失败' });
            return;
          }
          var canvas = res[0].node;
          var ctx = canvas.getContext('2d');
          var width = res[0].width || 300;
          var height = res[0].height || 200;

          // 设置 Canvas 实际像素尺寸（解决模糊）
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          if (callback) callback({ canvas: canvas, ctx: ctx, dpr: dpr, width: width, height: height, error: false });
        });
      },
      error: false
    };
  } catch (e) {
    return { error: true, message: e.message || 'Canvas 获取异常' };
  }
}

/**
 * 清除画布
 */
function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * 绘制圆角矩形路径
 */
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

module.exports = {
  DEFAULT_COLORS: DEFAULT_COLORS,
  DEFAULT_FONTS: DEFAULT_FONTS,
  DEFAULT_PADDING: DEFAULT_PADDING,
  getCanvasContext: getCanvasContext,
  clearCanvas: clearCanvas,
  roundRect: roundRect
};
