var storage = require('../../utils/storage');

var BADGE_EMOJI_MAP = {
  streak_3: '🔥', streak_7: '🔥', streak_14: '🔥', streak_30: '🔥',
  total_50: '📅', total_100: '📅',
  stars_100: '⭐', stars_500: '⭐',
  master_math: '🧮', master_chinese: '📖', master_english: '🔤'
};

Page({
  data: {
    badges: [],
    totalEarned: 0,
    totalCount: 0
  },

  onShow: function() {
    var data = storage.getAppData();
    var earnedSet = {};
    (data.user.earnedBadges || []).forEach(function(k) { earnedSet[k] = true; });

    var badges = storage.BADGE_DEFS.map(function(b) {
      var earned = !!earnedSet[b.key];
      return {
        key: b.key,
        name: b.name,
        desc: b.desc,
        emoji: BADGE_EMOJI_MAP[b.key] || '🏅',
        earned: earned
      };
    });

    var totalEarned = badges.filter(function(b) { return b.earned; }).length;

    this.setData({
      badges: badges,
      totalEarned: totalEarned,
      totalCount: badges.length
    });
  }
});
