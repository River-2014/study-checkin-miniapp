var account = require('../../utils/account');
var storage = require('../../utils/storage');

Page({
  data: {
    familyCode: '',
    children: [],
    codeInput: '',
    loading: false
  },

  onShow: function() {
    this.loadFamilyData();
  },

  loadFamilyData: function() {
    var that = this;
    var user = account.getCurrentUser();
    if (!user) return;

    // 加载孩子列表
    account.getChildren([]).then(function(result) {
      that.setData({ children: (result && result.children) || [] });
    }).catch(function() {});

    // 读取本地缓存的邀请码
    var savedCode = storage.getCloudCache('familyCode');
    if (savedCode) {
      that.setData({ familyCode: savedCode });
    }
  },

  onCodeInput: function(e) {
    this.setData({ codeInput: e.detail.value || '' });
  },

  onCreateCode: function() {
    var that = this;
    that.setData({ loading: true });
    account.createFamilyCode().then(function(result) {
      that.setData({ familyCode: result.code, loading: false });
      storage.setCloudCache('familyCode', result.code);
    }).catch(function(err) {
      that.setData({ loading: false });
      wx.showToast({ title: err.message || '生成失败', icon: 'none' });
    });
  },

  onJoinFamily: function() {
    var that = this;
    var code = that.data.codeInput;
    if (code.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '加入家庭',
      content: '请输入孩子的昵称',
      editable: true,
      placeholderText: '如：小明',
      success: function(modalRes) {
        if (modalRes.confirm) {
          var childName = modalRes.content || '孩子';
          that.setData({ loading: true });
          account.joinFamily(code, childName).then(function() {
            that.setData({ loading: false, codeInput: '' });
            wx.showToast({ title: '加入成功！' });
            that.loadFamilyData();
          }).catch(function(err) {
            that.setData({ loading: false });
            var msg = err.message || '加入失败';
            if (err.code === 'CODE_EXPIRED') msg = '邀请码已过期';
            else if (err.code === 'ALREADY_BOUND') msg = '该账号已被其他家庭绑定';
            wx.showModal({ title: '加入失败', content: msg, showCancel: false });
          });
        }
      }
    });
  }
});
