var storage = require('../../utils/storage');

var BADGE_EMOJI_MAP = {
  streak_3: '🔥', streak_7: '🔥', streak_30: '🔥', streak_60: '🔥', streak_100: '🔥', streak_180: '🔥', streak_365: '🔥',
  total_50: '📅', total_100: '📅', total_200: '📅', total_500: '📅',
  stars_100: '⭐', stars_500: '⭐', stars_1000: '⭐', stars_5000: '⭐',
  master_math: '🧮', master_math_60: '🧮', master_chinese: '📖', master_english: '🔤',
  hidden_dawn: '🌅', hidden_speed: '⚡'
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
        tier: b.tier || '🥉',
        level: b.level || 1,
        emoji: BADGE_EMOJI_MAP[b.key] || '🏅',
        earned: earned
      };
    });

    // 按 level 排序
    badges.sort(function(a, b) {
      return b.earned - a.earned || b.level - a.level;
    });

    this.setData({
      badges: badges,
      totalEarned: badges.filter(function(b) { return b.earned; }).length,
      totalCount: badges.length
    });
  }
});
