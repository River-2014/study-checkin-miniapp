/** 奖励商城页 */
const storage = require('../../utils/storage');

Page({
  data: {
    stars: 0,
    rewards: []
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const data = storage.getAppData();
    this.setData({
      stars: data.user.stars,
      rewards: data.rewards
    });
  },

  /** 点击兑换 */
  onRedeem(e) {
    const id = e.currentTarget.dataset.id;
    const data = storage.getAppData();
    const reward = data.rewards.find(r => r.id === id);
    if (!reward) return;

    if (data.user.stars < reward.cost) {
      wx.showToast({ title: `积分不足，还差 ${reward.cost - data.user.stars} ⭐`, icon: 'none' });
      return;
    }

    // 二次确认
    wx.showModal({
      title: '确认兑换',
      content: `确定要用 ${reward.cost} ⭐ 兑换「${reward.icon} ${reward.name}」吗？\n\n提交后将由家长确认兑现`,
      success: (res) => {
        if (res.confirm) {
          var result = storage.requestRedeem(id);
          if (result.success) {
            wx.showToast({ title: result.msg, icon: 'success', duration: 2000 });
            this.loadData();
          } else {
            wx.showToast({ title: result.msg, icon: 'none' });
          }
        }
      }
    });
  }
});
