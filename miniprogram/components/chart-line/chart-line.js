var lineChart = require('../../utils/charts/lineChart');

Component({
  properties: {
    data: {
      type: Object,
      value: { items: [] },
      observer: 'render'
    },
    options: {
      type: Object,
      value: {}
    }
  },

  data: {
    fallback: ''
  },

  ready: function() {
    this.render();
  },

  methods: {
    render: function() {
      var that = this;
      var query = wx.createSelectorQuery().in(this);
      query.select('.chart-canvas').fields({ node: true, size: true }).exec(function(res) {
        if (!res || !res[0] || !res[0].node) {
          that.setData({ fallback: '图表加载失败' });
          return;
        }
        var canvas = res[0].node;
        var ctx = canvas.getContext('2d');
        var sysInfo = wx.getSystemInfoSync();
        var dpr = sysInfo.pixelRatio || 2;
        var width = res[0].width || 300;
        var height = res[0].height || 200;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        var options = that.data.options || {};
        var opt = {
          width: width,
          height: height,
          padding: options.padding,
          lineColor: options.lineColor,
          fillColor: options.fillColor,
          showDots: options.showDots !== false,
          smooth: options.smooth !== false
        };

        lineChart.drawLineChart(canvas, ctx, that.data.data, opt);
        that.setData({ fallback: '' });
      });
    }
  }
});
