/** 我的页面 - 统计与管理 */
const storage = require('../../utils/storage');
const account = require('../../utils/account');

const EMOJI_LIST = ['📖', '🧮', '🔤', '📚', '📐', '🎧', '📜', '📝', '🏃', '😴', '🎨', '🔬', '🌍', '💻', '🎵', '✏️', '📏', '🗺️', '🧪', '🎭'];
const CATEGORIES = ['语文', '数学', '英语', '综合', '运动', '生活'];

function formatGrowthArchive(archive) {
  if (!archive) return {};
  archive.milestones = archive.milestones.map(function(m) {
    var d = new Date(m.date);
    m.dateStr = d.getFullYear() + '/' + (d.getMonth() + 1);
    return m;
  });
  return archive;
}

Page({
  data: {
    loaded: false,
    totalCheckins: 0,
    longestStreak: 0,
    totalStars: 0,
    earnedBadges: [],
    badgeCount: 0,
    badgeEmojiMap: [],
    showTaskModal: false,
    taskForm: { name: '', points: '10', icon: '📖', category: '综合', taskType: 'practice', linkSubject: '数学' },
    taskTypes: [
      { value: 'practice', label: '练习', icon: '✏️' },
      { value: 'reading', label: '阅读', icon: '📖' },
      { value: 'dictation', label: '听写', icon: '✍️' }
    ],
    categories: CATEGORIES,
    emojiList: EMOJI_LIST,
    // 提醒设置
    reminderEnabled: false,
    reminderHour: 19,
    reminderMinute: 30,
    reminderTimeStr: '19:30',
    reminderSubscribed: false,
    isLoggedIn: false,
    isUnlocked: false,
    settingsExpanded: false,
    userMode: 'student',
    isParent: false,
    childrenList: [],
    currentChildId: 'default',
    currentChildName: '孩子'
  },

  onShow() {
    var data = storage.getAppData();
    var mode = data.userMode || 'student';
    var grade = (data.user && data.user.currentGrade) || 6;
    var stage = (data.user && data.user.stage) || 'primary-high';
    var stageLabel = stage === 'primary-low' ? '小学低段' : stage === 'primary-high' ? '小学高段' : stage === 'middle' ? '初中' : '高中';
    this.setData({
      userMode: mode,
      isParent: mode === 'parent',
      isLoggedIn: account.isLoggedIn(),
      currentGradeLabel: storage.getGradeLabel(grade),
      currentStageLabel: stageLabel,
      currentStage: stage,
      currentTrack: (data.user && data.user.track) || null,
      growthArchive: formatGrowthArchive(storage.getGrowthArchive(data))
    });

    // 加载孩子列表
    this.loadChildrenData();

    // 学生模式不需要密码解锁，直接加载数据
    if (mode === 'student') {
      this.setData({ isUnlocked: true });
      this.loadData();
      this.loadReminder();
      return;
    }

    // 家长模式需要密码验证
    if (!data.user.isParentUnlocked) {
      wx.navigateTo({ url: '/subpkg-user/pages/password/password' });
      return;
    }
    this.setData({ isUnlocked: true });
    this.loadData();
    this.loadReminder();
  },

  loadData() {
    const data = storage.getAppData();
    const badges = storage.getEarnedBadges();
    const badgeEmojiMap = badges.map(b => {
      const map = {
        streak_3: '🔥', streak_7: '🔥', streak_14: '🔥', streak_30: '🔥',
        total_50: '📅', total_100: '📅',
        stars_100: '⭐', stars_500: '⭐',
        master_math: '🧮', master_chinese: '📖', master_english: '🔤'
      };
      return map[b.key] || '🏅';
    });

    this.setData({
      loaded: true,
      totalCheckins: data.user.totalCheckins,
      longestStreak: data.user.longestStreak,
      totalStars: data.user.totalStarsEarned,
      earnedBadges: badges,
      badgeCount: badges.length,
      badgeEmojiMap,
      userMode: data.userMode || 'student',
      isParent: (data.userMode || 'student') === 'parent'
    });
  },

  loadChildrenData() {
    var list = storage.getChildrenList();
    var currentId = storage.getCurrentChildId();
    var currentName = '孩子';
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === currentId) { currentName = list[i].name; break; }
    }
    this.setData({
      childrenList: list,
      currentChildId: currentId,
      currentChildName: currentName
    });
  },

  loadReminder() {
    const r = storage.getReminder();
    const subscribed = wx.getStorageSync('reminder_subscribed') || false;
    this.setData({
      reminderEnabled: r.enabled,
      reminderHour: r.hour,
      reminderMinute: r.minute,
      reminderTimeStr: String(r.hour).padStart(2, '0') + ':' + String(r.minute).padStart(2, '0'),
      reminderSubscribed: subscribed
    });
  },

  // ===== 密码锁 =====
  onLock() {
    storage.setParentUnlocked(false);
    this.setData({ isUnlocked: false });
    wx.showToast({ title: '已锁定', icon: 'success' });
    setTimeout(() => {
      wx.navigateTo({ url: '/subpkg-user/pages/password/password' });
    }, 500);
  },

  onChangePassword() {
    wx.showModal({
      title: '修改密码',
      content: '请输入新密码（4位数字）',
      editable: true,
      placeholderText: '输入4位数字',
      success: (res) => {
        if (res.confirm && res.content) {
          const pwd = res.content.trim();
          if (!/^\d{4}$/.test(pwd)) {
            wx.showToast({ title: '请输入4位数字', icon: 'none' });
            return;
          }
          storage.changePassword(pwd);
          wx.showToast({ title: '密码已修改', icon: 'success' });
        }
      }
    });
  },

  // ===== 提醒设置 =====
  onReminderSwitch(e) {
    const enabled = e.detail.value;
    const r = storage.getReminder();
    r.enabled = enabled;
    if (enabled) {
      r.lastRemindedDate = null;
    }
    storage.saveReminder(r);
    this.setData({ reminderEnabled: enabled });
    if (enabled) {
      wx.showToast({ title: '提醒已开启', icon: 'success' });
    }
  },

  onReminderTimeChange(e) {
    const time = e.detail.value; // "HH:mm"
    const [hour, minute] = time.split(':').map(Number);
    const r = storage.getReminder();
    r.hour = hour;
    r.minute = minute;
    storage.saveReminder(r);
    this.setData({
      reminderHour: hour,
      reminderMinute: minute,
      reminderTimeStr: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0')
    });
    wx.showToast({ title: '提醒时间设为 ' + hour + ':' + String(minute).padStart(2, '0'), icon: 'none' });
  },

  // 请求微信订阅消息授权
  onSubscribeReminder: function() {
    var that = this;
    // 模板 ID 需要在微信公众平台「订阅消息」中申请后替换
    var tmplId = 'YOUR_TEMPLATE_ID';
    if (tmplId === 'YOUR_TEMPLATE_ID') {
      wx.showToast({ title: '提醒模板未配置，请先在微信公众平台申请订阅消息模板', icon: 'none', duration: 3000 });
      return;
    }
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: function(res) {
        if (res[tmplId] === 'accept') {
          that.setData({ reminderSubscribed: true });
          wx.setStorageSync('reminder_subscribed', true);
          wx.showToast({ title: '订阅成功，每天会提醒你', icon: 'success' });
        } else {
          wx.showToast({ title: '已拒绝，可稍后再试', icon: 'none' });
        }
      },
      fail: function() {
        wx.showToast({ title: '订阅失败，请稍后重试', icon: 'none' });
      }
    });
  },

  // ===== 自定义任务弹窗 =====
  onAddTask() {
    this.setData({
      showTaskModal: true,
      taskForm: { name: '', points: '10', icon: '📖', category: '综合', taskType: 'practice', linkSubject: '数学' }
    });
  },

  onSelectTaskType(e) {
    this.setData({ 'taskForm.taskType': e.currentTarget.dataset.type });
  },

  onSelectLinkSubject(e) {
    const sub = e.currentTarget.dataset.sub;
    this.setData({ 'taskForm.linkSubject': sub, 'taskForm.category': sub });
  },

  closeTaskModal() {
    this.setData({ showTaskModal: false });
  },

  stopPropagation() {},

  onNameInput(e) {
    this.setData({ 'taskForm.name': e.detail.value });
  },

  onPointsInput(e) {
    this.setData({ 'taskForm.points': e.detail.value });
  },

  onSelectCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ 'taskForm.category': cat });
  },

  onSelectEmoji(e) {
    const emoji = e.currentTarget.dataset.emoji;
    this.setData({ 'taskForm.icon': emoji });
  },

  confirmAddTask() {
    const form = this.data.taskForm;
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入任务名称', icon: 'none' });
      return;
    }
    const pts = parseInt(form.points) || 10;
    storage.addCustomTask(form.name.trim(), form.icon, pts, form.category, form.taskType, form.linkSubject);
    wx.showToast({ title: '添加成功！', icon: 'success' });
    this.closeTaskModal();
  },

  // ===== 恢复默认任务 =====
  onResetTasks() {
    wx.showModal({
      title: '恢复默认任务',
      content: '将重置任务列表为默认的10项，自定义任务将被清除。确定吗？',
      success: (res) => {
        if (res.confirm) {
          storage.resetTasks();
          wx.showToast({ title: '已恢复默认任务', icon: 'success' });
        }
      }
    });
  },

  // ===== 重置全部数据 =====
  onResetAll() {
    wx.showModal({
      title: '重置全部数据',
      content: '⚠️ 此操作将清除所有打卡记录、积分和徽章！确定吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showModal({
            title: '再次确认',
            content: '⚠️ 所有数据将被永久删除，不可恢复！确认重置？',
            success: (res2) => {
              if (res2.confirm) {
                storage.resetAllData();
                this.loadData();
                wx.showToast({ title: '已重置所有数据', icon: 'success', duration: 2000 });
              }
            }
          });
        }
      }
    });
  },

  // ===== 奖励管理 =====
  onShowRewardModal() {
    this.setData({
      showRewardModal: true,
      rewardForm: { name: '', cost: '50', icon: '🎁', imageBase64: '', imagePreview: '' }
    });
  },

  closeRewardModal() {
    this.setData({ showRewardModal: false });
  },

  onRewardNameInput(e) {
    this.setData({ 'rewardForm.name': e.detail.value });
  },

  onRewardCostInput(e) {
    this.setData({ 'rewardForm.cost': e.detail.value });
  },

  onSelectRewardEmoji(e) {
    const emoji = e.currentTarget.dataset.rewardemoji;
    this.setData({ 'rewardForm.icon': emoji });
  },

  /** 选择奖励图片 */
  chooseRewardImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        // 转 base64
        wx.getFileSystemManager().readFile({
          filePath: tempPath,
          encoding: 'base64',
          success: (base64Res) => {
            const base64 = base64Res.data;
            // 检查大小（base64 约比原始大 33%）
            if (base64.length > 200 * 1024) {
              wx.showToast({ title: '图片过大，请选择小于150KB的图片', icon: 'none' });
              return;
            }
            this.setData({
              'rewardForm.imageBase64': base64,
              'rewardForm.imagePreview': 'data:image/jpeg;base64,' + base64
            });
          }
        });
      }
    });
  },

  /** 确认添加奖励 */
  confirmAddReward() {
    const form = this.data.rewardForm;
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入奖励名称', icon: 'none' });
      return;
    }
    const cost = parseInt(form.cost) || 50;
    storage.addRewardWithImage(form.name.trim(), form.icon, cost, form.imageBase64);
    wx.showToast({ title: '奖励添加成功！', icon: 'success' });
    this.closeRewardModal();
  },

  onResetRewards() {
    wx.showModal({
      title: '恢复默认奖励',
      content: '将重置奖励列表为默认的6项，自定义奖励将被清除。确定吗？',
      success: (res) => {
        if (res.confirm) {
          storage.resetRewards();
          wx.showToast({ title: '已恢复默认奖励', icon: 'success' });
        }
      }
    });
  },

  toggleSettings: function() {
    this.setData({ settingsExpanded: !this.data.settingsExpanded });
  },

  // ===== 账号管理 =====
  onSetTrack: function(e) {
    var track = e.currentTarget.dataset.track;
    var appData = storage.getAppData();
    storage.setUserGrade(appData, appData.user.currentGrade); // 触发 subject 刷新
    appData.user.track = track;
    storage.saveAppData(appData);
    this.setData({ currentTrack: track });
    wx.showToast({ title: track === 'science' ? '已切换理科' : '已切换文科', icon: 'success' });
  },

  onGoToLogin: function() {
    wx.navigateTo({ url: '/subpkg-user/pages/login/login' });
  },

  onGoToRole: function() {
    wx.navigateTo({ url: '/subpkg-user/pages/role/role' });
  },

  onLogout: function() {
    var that = this;
    wx.showModal({
      title: '退出登录',
      content: '退出后数据仍在本地保存，不会丢失。',
      success: function(res) {
        if (res.confirm) {
          try { wx.removeStorageSync('loginUser'); } catch (e) {}
          that.setData({ isLoggedIn: false });
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  },

  onSwitchRole() {
    var that = this;
    wx.showActionSheet({
      itemList: ['学生模式', '家长模式'],
      success: function(res) {
        var mode = res.tapIndex === 0 ? 'student' : 'parent';
        var appData = storage.getAppData();
        appData.userMode = mode;
        storage.saveAppData(appData);
        that.setData({
          userMode: mode,
          isParent: mode === 'parent'
        });
        wx.showToast({ title: mode === 'parent' ? '已切换到家长模式' : '已切换到学生模式', icon: 'success' });
      }
    });
  },

  // ===== 家庭管理 =====
  onGoToFamily: function() {
    wx.navigateTo({ url: '/subpkg-user/pages/family/family' });
  },

  onGoToAdmin: function() {
    wx.navigateTo({ url: '/subpkg-admin/pages/admin/admin' });
  },

  // ===== 积分明细 =====
  goToDetail() { wx.navigateTo({ url: '/subpkg-user/pages/detail/detail' }); },
  onOpenPointsLog() {
    wx.navigateTo({ url: '/subpkg-user/pages/pointslog/pointslog' });
  },

  // ===== 云同步 =====
  cloudBackup: function() {
    wx.showLoading({ title: '同步中...' });
    var childId = storage.getCurrentChildId() || 'default';
    account.uploadData(storage.getAppData(), childId, Date.now()).then(function() {
      wx.hideLoading();
      wx.showToast({ title: '同步成功', icon: 'success' });
    }).catch(function() {
      wx.hideLoading();
      wx.showToast({ title: '同步失败', icon: 'error' });
    });
  },

  cloudRestore: function() {
    var that = this;
    wx.showModal({
      title: '确认恢复',
      content: '云端数据将与本地数据合并（云端版本优先），确定吗？',
      success: function(res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '恢复中...' });
        account.downloadData('default').then(function(result) {
          wx.hideLoading();
          if (result && result.data) {
            var local = storage.getAppData();
            // 云版本更旧则保护新数据
            var cloudVersion = result.version || 0;
            var localVersion = local._version || 0;
            if (localVersion > cloudVersion) {
              wx.showModal({
                title: '数据较新',
                content: '本地数据（版本' + localVersion + '）比云端（版本' + cloudVersion + '）更新，确定覆盖？',
                success: function(r2) {
                  if (r2.confirm) {
                    result.data._version = localVersion;
                    storage.saveAppData(result.data);
                    wx.showToast({ title: '已恢复云端数据', icon: 'success' });
                  }
                }
              });
            } else {
              result.data._version = cloudVersion;
              storage.saveAppData(result.data);
              wx.showToast({ title: '恢复成功', icon: 'success' });
            }
          } else {
            wx.showToast({ title: '没有可恢复的数据', icon: 'none' });
          }
        }).catch(function() {
          wx.hideLoading();
          wx.showToast({ title: '恢复失败', icon: 'error' });
        });
      }
    });
  },

  // ===== 多孩账号管理 =====
  addChild: function() {
    var that = this;
    wx.showModal({
      title: '添加孩子',
      editable: true,
      placeholderText: '输入昵称',
      success: function(res) {
        if (res.confirm && res.content) {
          var list = storage.getChildrenList();
          list.push({ id: 'child_' + Date.now(), name: res.content.trim() });
          storage.saveChildrenList(list);
          that.loadChildrenData();
        }
      }
    });
  },

  switchToChild: function(e) {
    var childId = e.currentTarget.dataset.id;
    storage.switchChild(childId);
    this.loadChildrenData();
    wx.switchTab({ url: '/pages/home/home' });
  }
});
