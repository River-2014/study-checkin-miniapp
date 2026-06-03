var account = require('../../utils/account');
var storage = require('../../utils/storage');

Page({
  data: {
    familyCode: '',
    children: [],
    codeInput: '',
    loading: false,
    isParent: false,
    contracts: [],
    pendingRedeems: [],
    templates: storage.CONTRACT_TEMPLATES || [],
    tabIndex: 0,
    familyTabs: [{ label: '👨‍👩‍👧 家庭管理' }, { label: '📜 亲子契约' }]
  },

  onShow: function() {
    this.setData({ isParent: storage.isParentMode() });
    this.loadFamilyData();
    this.loadContracts();
  },

  onTabChange: function(e) {
    this.setData({ tabIndex: e.detail.index });
  },

  /** 加载契约列表 */
  loadContracts: function() {
    var data = storage.getAppData();
    this.setData({
      contracts: data.contracts || [],
      pendingRedeems: (data.pendingRedeems || []).filter(function(r) { return r.status === 'pending'; })
    });
  },

  /** 家长确认兑现 */
  onApproveRedeem: function(e) {
    var rid = e.currentTarget.dataset.id;
    storage.approveRedeem(rid);
    wx.showToast({ title: '已确认兑现！', icon: 'success' });
    this.loadContracts();
  },

  /** 家长拒绝兑现 */
  onRejectRedeem: function(e) {
    var rid = e.currentTarget.dataset.id;
    storage.rejectRedeem(rid);
    wx.showToast({ title: '已拒绝，积分退回', icon: 'none' });
    this.loadContracts();
  },

  /** 家长创建契约 */
  onCreateContract: function(e) {
    var that = this;
    var tplId = e.currentTarget.dataset.tpl;
    wx.showModal({
      title: '设置奖励',
      content: '达成后将获得什么奖励？',
      editable: true,
      placeholderText: '如：周末多玩30分钟',
      success: function(res) {
        if (res.confirm) {
          var result = storage.addContract(tplId, res.content || '自定义奖励');
          if (result.success) {
            wx.showToast({ title: '契约已创建', icon: 'success' });
            that.loadContracts();
          } else {
            wx.showToast({ title: result.msg, icon: 'none' });
          }
        }
      }
    });
  },

  /** 孩子签署契约 */
  onSignContract: function(e) {
    var that = this;
    var cid = e.currentTarget.dataset.id;
    wx.showModal({
      title: '签署契约',
      content: '确定签署这份契约吗？达成条件后你将获得奖励！',
      success: function(res) {
        if (res.confirm) {
          var result = storage.signContract(cid);
          if (result.success) {
            wx.showToast({ title: '契约已生效！📜', icon: 'success' });
            that.loadContracts();
          } else {
            wx.showToast({ title: result.msg, icon: 'none' });
          }
        }
      }
    });
  },

  /** 孩子拒绝契约 */
  onRejectContract: function(e) {
    var that = this;
    var cid = e.currentTarget.dataset.id;
    var result = storage.rejectContract(cid);
    that.loadContracts();
    wx.showToast({ title: '已拒绝', icon: 'none' });
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
