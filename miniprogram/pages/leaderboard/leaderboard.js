var storage = require('../../utils/storage');

Page({
  data: {
    tab: 0,  // 0=连续打卡, 1=周积分
    streakList: [],
    starsList: [],
    myRank: null,
    optedIn: false
  },

  onShow: function() {
    this.checkOptIn();
    this.loadRankings();
  },

  checkOptIn: function() {
    var data = storage.getAppData();
    this.setData({ optedIn: !!data.user.leaderboardOptIn });
  },

  /** 加入排行榜 */
  optIn: function() {
    var data = storage.getAppData();
    data.user.leaderboardOptIn = true;
    storage.saveAppData(data);
    this.setData({ optedIn: true });
    this.syncMyData();
    this.loadRankings();
  },

  /** 退出排行榜 */
  optOut: function() {
    wx.showModal({
      title: '退出排行榜',
      content: '退出后你的数据将从排行榜中移除',
      success: function(res) {
        if (res.confirm) {
          var data = storage.getAppData();
          data.user.leaderboardOptIn = false;
          storage.saveAppData(data);
          wx.getStorageSync('appData');
          this.setData({ optedIn: false });
          this.loadRankings();
        }
      }.bind(this)
    });
  },

  /** 同步我的数据到排行榜 */
  syncMyData: function() {
    var data = storage.getAppData();
    if (!data.user.leaderboardOptIn) return;
    wx.cloud.callFunction({
      name: 'dataSync',
      data: {
        action: 'leaderboard',
        streak: data.user.streak || 0,
        stars: data.user.totalStarsEarned || 0,
        longestStreak: data.user.longestStreak || 0
      }
    });
  },

  /** 加载排行榜数据 */
  loadRankings: function() {
    var that = this;
    wx.cloud.callFunction({
      name: 'dataSync',
      data: { action: 'getLeaderboard' }
    }).then(function(res) {
      var r = res.result || {};
      if (r.success) {
        that.setData({
          streakList: (r.streakRank || []).map(that._formatItem),
          starsList: (r.starsRank || []).map(that._formatItem),
          myRank: r.myRank || null
        });
      }
    }).catch(function() {
      // 离线模式：从本地数据生成简单排行
      var data = storage.getAppData();
      var me = { nickname: '我', streak: data.user.streak || 0, stars: data.user.totalStarsEarned || 0, longestStreak: data.user.longestStreak || 0 };
      that.setData({
        streakList: [that._formatItem(me, 0)],
        starsList: [that._formatItem(me, 0)]
      });
    });
  },

  _formatItem: function(item, idx) {
    var rank = item.rank || (idx !== undefined ? idx + 1 : '?');
    var medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    return {
      rank: rank,
      medal: medals[rank] || rank,
      nickname: item.nickname || '匿名用户',
      streak: item.streak || 0,
      stars: item.stars || 0,
      longestStreak: item.longestStreak || 0
    };
  },

  switchTab: function(e) {
    this.setData({ tab: Number(e.currentTarget.dataset.index) });
  }
});
