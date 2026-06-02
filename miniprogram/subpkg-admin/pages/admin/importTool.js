/**
 * 题库导入工具 — 挂载到 admin 页面
 *
 * 在 admin.js 中引入：
 *   var importTool = require('./importTool');
 *   Page({
 *     onLoad: function() { importTool.attach(this); }
 *   });
 *
 * 在 admin.wxml 中添加按钮：
 *   <button bindtap="importFromFile">从云存储导入</button>
 *   <button bindtap="importPreview">预览</button>
 */

var helper = require('../../utils/importHelper');

function attach(page) {
  page._importToolData = {
    importing: false,
    progress: '',
    result: null
  };

  function setData(obj) {
    page.setData(Object.assign({ _importToolData: page._importToolData }, obj));
  }

  /**
   * 从云存储 fileID 导入
   * 使用方式：修改下面的 FILE_ID 为实际云存储路径
   */
  page.importFromFile = function() {
    var that = this;
    var fileID = 'cloud://cloud1-d8geyz0ynb367e0bf.636c-cloud1-d8geyz0ynb367e0bf-1309189854/import.cloud.jsonl';

    wx.showModal({
      title: '确认导入',
      content: '将从云存储导入题库数据，确认继续？\n\n文件: ' + fileID,
      success: async function(modalRes) {
        if (!modalRes.confirm) return;

        that.setData({ importing: true, importProgress: '导入中...' });

        try {
          var result = await helper.importFromFile(fileID, {
            onProgress: function(info) {
              that.setData({
                importProgress: '[' + info.round + '/' + info.total + '] ' +
                  (info.inserted || 0) + '新增 ' + (info.updated || 0) + '更新'
              });
            }
          });

          that.setData({
            importing: false,
            importProgress: '完成',
            importResult: result
          });

          wx.showToast({
            title: '导入完成: ' + (result.inserted || 0) + '条新增',
            icon: 'success',
            duration: 3000
          });

        } catch(e) {
          that.setData({ importing: false, importProgress: '失败' });
          wx.showModal({
            title: '导入失败',
            content: e.message || '未知错误',
            showCancel: false
          });
        }
      }
    });
  };

  /**
   * 预览（dryRun）
   */
  page.importPreview = async function() {
    var sample = [
      { subject: '数学', grade: '六年级', type: '填空题', stem: '测试题目：1+1=?', answer: '2' }
    ];

    wx.showLoading({ title: '预览中...' });
    try {
      var result = await helper.preview(sample);
      wx.hideLoading();

      wx.showModal({
        title: '预览结果',
        content: JSON.stringify(result, null, 2).substring(0, 500),
        showCancel: false
      });
    } catch(e) {
      wx.hideLoading();
      wx.showToast({ title: '预览失败', icon: 'none' });
    }
  };

  /**
   * 手动输入 JSONL 数据导入（调试用）
   */
  page.importFromText = function() {
    wx.showModal({
      title: '手动导入',
      content: '请确保已在控制台设置好 jsonlText 变量',
      showCancel: false
    });
  };
}

module.exports = { attach: attach };
