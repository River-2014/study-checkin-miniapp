var storage = require('../../utils/storage');
var helper = require('../../utils/practiceHelper');
var dateUtil = require('../../utils/date');

Page({
  data: {
    // ===== 筛选设置 =====
    subjects: helper.SUBJECTS,
    subjectIndex: 1,  // 默认数学
    gradeList: helper.GRADE_LIST,
    gradeIndex: 5,     // 默认六年级
    difficulties: helper.DIFFICULTIES,
    difficultyIndex: 0,
    types: [
      { name: '选择题', active: true },
      { name: '填空题', active: true },
      { name: '判断题', active: true },
      { name: '简答题', active: false }
    ],
    count: 10,
    loading: false,

    // ===== 答题 =====
    phase: 'setting',   // setting | answering | result
    questions: [],
    currentIndex: 0,
    userAnswers: {},
    startTime: 0,

    // ===== 结果 =====
    correctCount: 0,
    showResult: false,
    knowledgeStats: []
  },

  // ===== 筛选交互 =====
  onSubjectChange: function(e) {
    this.setData({ subjectIndex: Number(e.detail.value) });
  },
  onGradeChange: function(e) {
    this.setData({ gradeIndex: Number(e.detail.value) });
  },
  onDifficultyChange: function(e) {
    this.setData({ difficultyIndex: Number(e.detail.value) });
  },
  onTypeToggle: function(e) {
    var idx = Number(e.currentTarget.dataset.index);
    var types = this.data.types;
    types[idx].active = !types[idx].active;
    this.setData({ types: types });
  },
  onCountChange: function(e) {
    this.setData({ count: e.detail.value });
  },

  // ===== 开始练习 =====
  startPractice: function() {
    var that = this;
    var activeTypes = this.data.types.filter(function(t) { return t.active; }).map(function(t) { return t.name; });
    if (activeTypes.length === 0) {
      wx.showToast({ title: '请至少选择一种题型', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '加载题目...' });

    wx.cloud.callFunction({
      name: 'getLocalQuestions',
      data: {
        subject: this.data.subjects[this.data.subjectIndex],
        grade: this.data.gradeList[this.data.gradeIndex],
        types: activeTypes,
        difficulty: this.data.difficulties[this.data.difficultyIndex] || '',
        count: this.data.count
      }
    }).then(function(res) {
      wx.hideLoading();
      that.setData({ loading: false });

      if (!res.result || !res.result.success) {
        wx.showModal({
          title: '加载失败',
          content: res.result ? res.result.error : '网络异常，请重试',
          showCancel: false
        });
        return;
      }

      var questions = res.result.questions || [];
      if (questions.length === 0) {
        wx.showModal({
          title: '暂无题目',
          content: '当前筛选条件无匹配题目，请调整条件或联系管理员补充题库。',
          showCancel: false
        });
        return;
      }

      if (res.result.insufficient) {
        wx.showModal({
          title: '题库不足',
          content: '仅剩 ' + questions.length + ' 道题，已全部加载。',
          showCancel: false,
          success: function() {
            that._beginAnswer(questions);
          }
        });
      } else {
        that._beginAnswer(questions);
      }
    }).catch(function() {
      wx.hideLoading();
      that.setData({ loading: false });
      wx.showModal({
        title: '加载失败',
        content: '网络异常，请检查网络后重试',
        showCancel: false
      });
    });
  },

  _beginAnswer: function(questions) {
    this.setData({
      phase: 'answering',
      questions: questions,
      currentIndex: 0,
      userAnswers: {},
      showResult: false
    });
    this._startTime = Date.now();
  },

  // ===== 答题交互 =====
  onSwiperChange: function(e) {
    this.setData({ currentIndex: e.detail.current });
  },

  prevQuestion: function() {
    if (this.data.currentIndex > 0) {
      this.setData({ currentIndex: this.data.currentIndex - 1 });
    }
  },

  nextQuestion: function() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({ currentIndex: this.data.currentIndex + 1 });
    }
  },

  selectOption: function(e) {
    var qid = e.currentTarget.dataset.qid;
    var label = e.currentTarget.dataset.label;
    if (this.data.showResult) return;
    var answers = this.data.userAnswers;
    answers[qid] = label;
    this.setData({ userAnswers: answers });
  },

  fillBlank: function(e) {
    var qid = e.currentTarget.dataset.qid;
    var answers = this.data.userAnswers;
    answers[qid] = e.detail.value || '';
    this.setData({ userAnswers: answers });
  },

  selectJudge: function(e) {
    var qid = e.currentTarget.dataset.qid;
    var val = e.currentTarget.dataset.val;
    if (this.data.showResult) return;
    var answers = this.data.userAnswers;
    answers[qid] = val;
    this.setData({ userAnswers: answers });
  },

  // ===== 提交判卷 =====
  submitAnswers: function() {
    var that = this;
    var unanswered = 0;
    var questions = this.data.questions;
    var answers = this.data.userAnswers;
    for (var i = 0; i < questions.length; i++) {
      if (!answers[questions[i]._id]) unanswered++;
    }

    var onConfirm = function() {
      that.finishCheck();
    };

    if (unanswered > 0) {
      wx.showModal({
        title: '提示',
        content: '还有 ' + unanswered + ' 题未作答，确定提交吗？',
        success: function(res) { if (res.confirm) onConfirm(); }
      });
    } else {
      onConfirm();
    }
  },

  finishCheck: function() {
    var questions = JSON.parse(JSON.stringify(this.data.questions));
    var correctCount = 0;
    var knowledgeMap = {};
    var appData = storage.getAppData();
    var wrongIds = [];

    // 逐题批改
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var userAns = this.data.userAnswers[q._id] || '';
      var isCorrect = helper.isCorrect(userAns, q);
      q._isCorrect = isCorrect;
      if (isCorrect) correctCount++;

      // 选择题标注正确选项索引
      if (q.options && q.options.length > 0) {
        q._correctOptIdx = helper.resolveCorrectOption(q);
      }

      // 错题写入错题本
      if (!isCorrect) {
        wrongIds.push(q._id);
        storage.addWrongQuestion(appData, {
          content: q.stem,
          type: q.type,
          difficulty: q.difficulty,
          options: q.options || [],
          answer: q.answer,
          analysis: q.explanation || '',
          examPoint: q.examPoint || '',
          subject: this.data.subjects[this.data.subjectIndex],
          knowledge: (q.knowledgePoints || []).join('、')
        });

        // 知识点错误统计
        var kps = q.knowledgePoints || [];
        for (var k = 0; k < kps.length; k++) {
          var kp = kps[k];
          if (!knowledgeMap[kp]) knowledgeMap[kp] = { total: 0, wrong: 0 };
          knowledgeMap[kp].total++;
          knowledgeMap[kp].wrong++;
        }
      }

      // 知识点正确统计
      var allKps = q.knowledgePoints || [];
      for (var j = 0; j < allKps.length; j++) {
        var akp = allKps[j];
        if (!knowledgeMap[akp]) knowledgeMap[akp] = { total: 0, wrong: 0 };
        knowledgeMap[akp].total++;
      }
    }

    storage.saveAppData(appData);

    // 知识点统计
    var knowledgeStats = [];
    for (var key in knowledgeMap) {
      if (knowledgeMap.hasOwnProperty(key)) {
        var item = knowledgeMap[key];
        knowledgeStats.push({
          name: key,
          correctRate: item.total > 0 ? Math.round((item.total - item.wrong) / item.total * 100) : 0
        });
      }
    }

    // 计时
    var duration = Math.round((Date.now() - this._startTime) / 1000);

    // 记录练习（可选：异步调用云函数）
    var that = this;
    var answersForRecord = questions.map(function(q) {
      return {
        questionId: q._id,
        userAnswer: that.data.userAnswers[q._id] || '',
        isCorrect: q._isCorrect
      };
    });
    wx.cloud.callFunction({
      name: 'submitPractice',
      data: {
        mode: 'practice',
        subject: this.data.subjects[this.data.subjectIndex],
        grade: this.data.gradeList[this.data.gradeIndex],
        answers: answersForRecord,
        correctCount: correctCount,
        totalCount: questions.length,
        duration: duration
      }
    });

    // 奖励星星
    var stars = Math.max(1, Math.round(correctCount / questions.length * 5));
    var userData = storage.getAppData();
    userData.user.stars += stars;
    userData.user.totalStarsEarned += stars;
    storage.saveAppData(userData);

    this.setData({
      questions: questions,
      showResult: true,
      correctCount: correctCount,
      knowledgeStats: knowledgeStats
    });
  },

  // ===== 再来一组 =====
  redoQuestions: function() {
    this.setData({
      userAnswers: {},
      showResult: false
    });
    this._startTime = Date.now();
  },

  // ===== 返回筛选 =====
  goToSetting: function() {
    this.setData({
      phase: 'setting',
      questions: [],
      userAnswers: {},
      showResult: false,
      correctCount: 0,
      knowledgeStats: []
    });
  },

  // 跳转错题本
  goToWrongbook: function() {
    wx.navigateTo({ url: '/subpkg-learn/pages/wrongbook/wrongbook' });
  }
});
