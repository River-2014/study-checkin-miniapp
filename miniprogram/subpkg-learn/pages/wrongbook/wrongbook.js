const storage = require('../../utils/storage');

Page({
  data: {
    wrongList: []
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    var appData = storage.getAppData();
    var list = (appData.wrongBook || []).map(function(item) {
      return Object.assign({}, item, { showAnswer: false });
    });
    // 按时间倒序
    list.sort(function(a, b) { return new Date(b.addedTime) - new Date(a.addedTime); });
    this.setData({ wrongList: list });
  },

  toggleAnswer(e) {
    var id = e.currentTarget.dataset.id;
    var list = this.data.wrongList.map(function(item) {
      if (item.id === id) {
        item.showAnswer = !item.showAnswer;
      }
      return item;
    });
    this.setData({ wrongList: list });
  },

  removeWrong(e) {
    var id = e.currentTarget.dataset.id;
    var appData = storage.getAppData();
    storage.removeWrongQuestion(appData, id);
    storage.saveAppData(appData);
    this.loadData();
    wx.showToast({ title: '已移除', icon: 'success' });
  },

  /** 导出错题为图片 */
  exportWrongBook: function() {
    wx.showLoading({ title: '生成中...' });
    var list = this.data.wrongList;
    var canvasW = 750;
    var canvasH = 100 + list.length * 140;
    if (canvasH > 3000) canvasH = 3000;

    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#exportCanvas').fields({ node: true, size: true }).exec(function(res) {
      if (!res[0]) {
        wx.hideLoading();
        wx.showToast({ title: '请先渲染导出画板', icon: 'none' });
        return;
      }
      var canvas = res[0].node;
      var ctx = canvas.getContext('2d');
      var dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = canvasW * dpr;
      canvas.height = canvasH * dpr;
      ctx.scale(dpr, dpr);

      // 白底
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // 标题
      ctx.fillStyle = '#2D3436';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('小升初冲刺 - 错题本', canvasW / 2, 50);

      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#B2BEC3';
      ctx.fillText(new Date().toLocaleDateString(), canvasW / 2, 80);

      // 题目
      var y = 120;
      for (var i = 0; i < list.length && i < 20; i++) {
        var q = list[i];
        ctx.fillStyle = '#FF6B35';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'left';
        var label = (i + 1) + '. [' + (q.subject || '') + '] ' + (q.difficulty || '');
        ctx.fillText(label, 30, y);
        y += 36;

        ctx.fillStyle = '#2D3436';
        ctx.font = '24px sans-serif';
        // 自动换行显示题目内容
        var content = q.content || '';
        var maxW = canvasW - 60;
        while (content.length > 0) {
          for (var ci = content.length; ci > 0; ci--) {
            if (ctx.measureText(content.slice(0, ci)).width <= maxW) {
              ctx.fillText(content.slice(0, ci), 30, y);
              content = content.slice(ci);
              y += 32;
              break;
            }
          }
        }
        y += 20;
      }

      wx.canvasToTempFilePath({
        canvas: canvas,
        success: function(res) {
          wx.hideLoading();
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: function() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
            fail: function() { wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' }); }
          });
        },
        fail: function() {
          wx.hideLoading();
          wx.showToast({ title: '导出失败', icon: 'error' });
        }
      });
    });
  },

  /** 同类题再练 — 跳转到 AI 出题，携带错题信息 */
  retrySimilar: function(e) {
    var item = e.currentTarget.dataset.item;
    if (!item) return;
    wx.navigateTo({
      url: '/subpkg-learn/pages/ai-exam/ai-exam?fromWrongBook=1&subject=' + encodeURIComponent(item.subject || '数学')
        + '&knowledge=' + encodeURIComponent(item.knowledge || '')
        + '&difficulty=' + encodeURIComponent(item.difficulty || '能力提升')
    });
  }
});
