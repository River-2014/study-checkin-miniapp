var storage = require('../../utils/storage');

Page({
  data: {
    myStreak: 0, myStars: 0, myCheckins: 0,
    opponent: null,
    challengeActive: false,
    challengeResult: null,
    history: []
  },

  onShow: function() {
    var data = storage.getAppData();
    this.setData({
      myStreak: data.user.streak || 0,
      myStars: data.user.totalStarsEarned || 0,
      myCheckins: data.user.totalCheckins || 0,
      history: data.pkHistory || []
    });
  },

  /** 发起挑战（随机匹配） */
  startChallenge: function() {
    var that = this;
    // 模拟对手（用本地数据生成一个难度适中的虚拟对手）
    var data = storage.getAppData();
    var myStreak = data.user.streak || 0;
    var oppStreak = Math.max(1, myStreak + Math.floor(Math.random() * 7) - 3);
    var oppStars = Math.max(50, (data.user.totalStarsEarned || 100) + Math.floor(Math.random() * 200) - 100);

    this.setData({
      opponent: { name: '挑战者' + String(Math.floor(Math.random()*9000)+1000), streak: oppStreak, stars: oppStars },
      challengeActive: true, challengeResult: null
    });

    // 24小时后自动结算（模拟）
    wx.showToast({ title: '挑战已发起！24小时后结算 🔥', icon: 'success' });
  },

  /** 结算挑战 */
  settleChallenge: function() {
    var o = this.data.opponent;
    var myScore = this.data.myStreak * 10 + this.data.myCheckins;
    var oppScore = o.streak * 10 + Math.floor(Math.random() * 20);

    var won = myScore >= oppScore;
    var result = {
      won: won,
      myScore: myScore, oppScore: oppScore,
      date: new Date().toISOString().substring(0, 10),
      msg: won ? '🎉 挑战成功！你的自律战胜了对手！' : '💪 惜败！下次一定赢回来！'
    };

    // 记录历史
    var data = storage.getAppData();
    data.pkHistory = data.pkHistory || [];
    data.pkHistory.push({
      opponent: o.name,
      result: won ? 'win' : 'lose',
      myScore: myScore, oppScore: oppScore,
      date: result.date
    });
    storage.saveAppData(data);

    this.setData({
      challengeResult: result,
      challengeActive: false,
      history: data.pkHistory.slice(-10)
    });
  },

  /** 放弃挑战 */
  cancelChallenge: function() {
    this.setData({ challengeActive: false, opponent: null });
    wx.showToast({ title: '已取消挑战', icon: 'none' });
  }
});
