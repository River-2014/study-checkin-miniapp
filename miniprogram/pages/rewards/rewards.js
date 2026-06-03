var storage = require('../../utils/storage');

Page({
  data: { loaded: false, stars: 0, rewards: [], donations: [] },

  onShow() { this.loadData(); },

  loadData() {
    var data = storage.getAppData();
    this.setData({
      loaded: true,
      stars: data.user.stars,
      rewards: data.rewards,
      donations: data.charityDonations || []
    });
  },

  onRedeem(e) {
    var id = e.currentTarget.dataset.id;
    var data = storage.getAppData();
    var reward = data.rewards.find(function(r) { return r.id === id; });
    if (!reward) return;
    if (data.user.stars < reward.cost) {
      wx.showToast({ title: '积分不足，还差 ' + (reward.cost - data.user.stars) + ' ⭐', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认兑换',
      content: '确定要用 ' + reward.cost + ' ⭐ 兑换「' + reward.icon + ' ' + reward.name + '」吗？\n\n提交后将由家长确认兑现',
      success: function(res) {
        if (res.confirm) {
          var result = storage.requestRedeem(id);
          if (result.success) {
            wx.showToast({ title: result.msg, icon: 'success', duration: 2000 });
            this.loadData();
          } else {
            wx.showToast({ title: result.msg, icon: 'none' });
          }
        }
      }.bind(this)
    });
  },

  /** 公益捐赠 */
  donate(e) {
    var type = e.currentTarget.dataset.type;
    var that = this;
    wx.showModal({
      title: '确认捐赠',
      content: '积分将用于公益项目，捐赠后不可撤回',
      success: function(res) {
        if (res.confirm) {
          var result = storage.donateToCharity(type);
          if (result.success) {
            wx.showToast({ title: result.msg, icon: 'success', duration: 2000 });
            that.loadData();
          } else {
            wx.showToast({ title: result.msg, icon: 'none' });
          }
        }
      }
    });
  }
});
