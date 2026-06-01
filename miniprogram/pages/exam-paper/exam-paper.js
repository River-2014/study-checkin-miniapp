var storage = require('../../utils/storage');
var helper = require('../../utils/practiceHelper');

Page({
  data: {
    // ===== 考试模式 =====
    examMode: 'simulation',   // 'simulation' | 'real'
    phase: 'setting',         // setting | answering | result

    // ===== 模拟生成筛选 =====
    subjects: helper.SUBJECTS,
    subjectIndex: 1,
    gradeList: helper.GRADE_LIST,
    gradeIndex: 5,
    difficulties: helper.DIFFICULTIES,
    difficultyIndex: 0,
    typeDistribution: {
      '选择题': { count: 5, selected: true },
      '填空题': { count: 3, selected: true },
      '判断题': { count: 3, selected: true },
      '简答题': { count: 2, selected: false }
    },
    duration: 30,
    loading: false,

    // ===== 真卷模式 =====
    paperFilter: { subject: '', grade: '', keyword: '' },
    paperList: [],
    paperListLoading: false,
    paperPage: 1,
    paperTotal: 0,

    // ===== 试卷信息 =====
    paper: null,
    scorePerType: { '选择题': 3, '填空题': 4, '判断题': 2, '简答题': 8 },

    // ===== 答题 =====
    questions: [],
    currentIndex: 0,
    userAnswers: {},
    remainingSeconds: 0,
    remainingStr: '00:00',

    // ===== 结果 =====
    showResult: false,
    correctCount: 0,
    score: 0,
    totalScore: 0,
    typeStats: [],
    knowledgeStats: [],
    wrongIds: [],
    barData: { items: [] },
    barOptions: { padding: 40 },
    radarData: { items: [] },
    radarOptions: { padding: 40 }
  },

  onLoad: function(options) {
    // 从 admin 页面预览试卷
    if (options && options.paperId) {
      this.setData({
        examMode: 'real',
        phase: 'setting'
      });
      var that = this;
      wx.showLoading({ title: '加载试卷...' });
      wx.cloud.callFunction({
        name: 'managePapers',
        data: { action: 'get', paperId: options.paperId }
      }).then(function(res) {
        wx.hideLoading();
        var r = res.result || {};
        if (r.success && r.paper) {
          that.setData({ paper: r.paper, examMode: 'real' });
          that.startRealExam(r.paper);
        } else {
          wx.showToast({ title: '试卷不存在', icon: 'none' });
        }
      }).catch(function() {
        wx.hideLoading();
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
    }
  },

  onUnload: function() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  // ===== 模式切换 =====
  switchExamMode: function(e) {
    var mode = e.currentTarget.dataset.mode;
    this.setData({ examMode: mode });
    if (mode === 'real') {
      this.loadPaperList();
    }
  },

  // ===== 筛选交互（模拟模式）=====
  onSubjectChange: function(e) { this.setData({ subjectIndex: Number(e.detail.value) }); },
  onGradeChange: function(e) { this.setData({ gradeIndex: Number(e.detail.value) }); },
  onDifficultyChange: function(e) { this.setData({ difficultyIndex: Number(e.detail.value) }); },
  onDurationChange: function(e) {
    var vals = [15, 20, 30, 45, 60];
    this.setData({ duration: vals[e.detail.value] });
  },
  onTypeToggle: function(e) {
    var key = e.currentTarget.dataset.key;
    var td = this.data.typeDistribution;
    td[key].selected = !td[key].selected;
    this.setData({ typeDistribution: td });
  },

  // ===== 真卷列表加载 =====
  loadPaperList: function() {
    var that = this;
    this.setData({ paperListLoading: true });
    var filter = this.data.paperFilter;
    wx.cloud.callFunction({
      name: 'managePapers',
      data: {
        action: 'list',
        page: this.data.paperPage,
        pageSize: 20,
        subject: filter.subject,
        grade: filter.grade,
        keyword: filter.keyword,
        status: 'active'   // 只显示可用试卷
      }
    }).then(function(res) {
      var r = res.result || {};
      if (r.success) {
        that.setData({
          paperList: r.list || [],
          paperTotal: (r.pagination && r.pagination.total) || 0,
          paperListLoading: false
        });
      } else {
        that.setData({ paperList: [], paperListLoading: false });
      }
    }).catch(function() {
      that.setData({ paperList: [], paperListLoading: false });
    });
  },

  onPaperFilterChange: function(e) {
    var field = e.currentTarget.dataset.field;
    var filter = this.data.paperFilter;
    filter[field] = e.detail.value;
    this.setData({ paperFilter: filter });
  },
  onPaperSubjectFilter: function(e) {
    var filter = this.data.paperFilter;
    filter.subject = this.data.subjects[Number(e.detail.value)];
    this.setData({ paperFilter: filter, paperPage: 1 });
    this.loadPaperList();
  },
  onPaperGradeFilter: function(e) {
    var filter = this.data.paperFilter;
    filter.grade = this.data.gradeList[Number(e.detail.value)];
    this.setData({ paperFilter: filter, paperPage: 1 });
    this.loadPaperList();
  },

  searchPapers: function() {
    this.setData({ paperPage: 1 });
    this.loadPaperList();
  },

  prevPaperPage: function() {
    if (this.data.paperPage <= 1) return;
    this.setData({ paperPage: this.data.paperPage - 1 });
    this.loadPaperList();
  },
  nextPaperPage: function() {
    if (this.data.paperPage * 20 >= this.data.paperTotal) return;
    this.setData({ paperPage: this.data.paperPage + 1 });
    this.loadPaperList();
  },

  // 选择某份试卷 → 加载详情并开始答题
  selectPaper: function(e) {
    var paperId = e.currentTarget.dataset.id;
    var that = this;

    wx.showLoading({ title: '加载试卷...' });
    wx.cloud.callFunction({
      name: 'managePapers',
      data: { action: 'get', paperId: paperId }
    }).then(function(res) {
      wx.hideLoading();
      var r = res.result || {};
      if (r.success && r.paper) {
        that.startRealExam(r.paper);
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }).catch(function() {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 从试卷详情对象开始答题
  startRealExam: function(paper) {
    // 统一 paperIdentifier（真卷用 _id，模拟卷用 paperId）
    paper.paperIdentifier = paper._id || paper.paperId || '';

    // 将 sections[].questions[] 展平为 questions 数组
    var questions = [];
    var questionNo = 0;
    var totalScore = paper.totalScore || 0;

    // 为计分建立题型→每题分值映射（从 sections 中获取）
    var scorePerType = {};
    var typeCounts = {};

    if (paper.sections && paper.sections.length > 0) {
      for (var si = 0; si < paper.sections.length; si++) {
        var section = paper.sections[si];
        var sType = section.type || '';
        var sScore = section.scorePerQuestion || 0;

        if (sType && !scorePerType[sType]) {
          scorePerType[sType] = sScore > 0 ? sScore : 3;
        }

        if (section.questions && section.questions.length > 0) {
          for (var qi = 0; qi < section.questions.length; qi++) {
            questionNo++;
            var q = section.questions[qi];
            questions.push({
              _id: paper.paperIdentifier + '_q' + questionNo,
              stem: q.stem || '',
              type: sType,
              options: q.options || [],
              answer: q.answer || '',
              explanation: q.explanation || '',
              knowledgePoints: q.knowledgePoints || [],
              difficulty: q.difficulty || '基础巩固',
              position: q.position || questionNo
            });

            typeCounts[sType] = (typeCounts[sType] || 0) + 1;
          }
        }
      }
    }

    // 如果 sections 为空（paper 只有元数据），使用默认值
    if (questions.length === 0) {
      scorePerType = JSON.parse(JSON.stringify(this.data.scorePerType));
    }

    // 如果 totalScore 为 0，按每题分计算
    if (totalScore === 0) {
      for (var s in scorePerType) {
        if (scorePerType.hasOwnProperty(s) && typeCounts[s]) {
          totalScore += scorePerType[s] * typeCounts[s];
        }
      }
    }

    var duration = paper.duration || this.data.duration;

    this.setData({
      paper: paper,
      scorePerType: scorePerType,
      phase: 'answering',
      questions: questions,
      currentIndex: 0,
      userAnswers: {},
      showResult: false,
      remainingSeconds: duration * 60,
      remainingStr: this._formatTime(duration * 60),
      totalScore: totalScore
    });

    this._startTime = Date.now();
    this._startTimer(duration * 60);
  },

  // ===== 模拟模式：开始考试 =====
  startExam: function() {
    var that = this;
    var td = this.data.typeDistribution;
    var dist = {};
    var hasSelected = false;
    for (var key in td) {
      if (td.hasOwnProperty(key) && td[key].selected && td[key].count > 0) {
        dist[key] = td[key].count;
        hasSelected = true;
      }
    }
    if (!hasSelected) {
      wx.showToast({ title: '请至少选择一种题型', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '生成试卷...' });

    wx.cloud.callFunction({
      name: 'generatePaper',
      data: {
        subject: this.data.subjects[this.data.subjectIndex],
        grade: this.data.gradeList[this.data.gradeIndex],
        typeDistribution: dist,
        difficulty: this.data.difficulties[this.data.difficultyIndex] || '',
        duration: this.data.duration
      }
    }).then(function(res) {
      wx.hideLoading();
      that.setData({ loading: false });

      if (!res.result || !res.result.success) {
        wx.showModal({
          title: '生成失败',
          content: res.result ? res.result.error : '网络异常，请重试',
          showCancel: false
        });
        return;
      }

      var paper = res.result.paper;
      that._loadQuestions(paper, dist);
    }).catch(function() {
      wx.hideLoading();
      that.setData({ loading: false });
      wx.showModal({
        title: '生成失败',
        content: '网络异常，请检查网络后重试',
        showCancel: false
      });
    });
  },

  _loadQuestions: function(paper, dist) {
    var that = this;
    wx.showLoading({ title: '加载题目...' });
    var totalCount = 0;
    for (var k in dist) { if (dist.hasOwnProperty(k)) totalCount += dist[k]; }

    wx.cloud.callFunction({
      name: 'getLocalQuestions',
      data: {
        subject: this.data.subjects[this.data.subjectIndex],
        grade: this.data.gradeList[this.data.gradeIndex],
        types: Object.keys(dist),
        difficulty: this.data.difficulties[this.data.difficultyIndex] || '',
        count: totalCount
      }
    }).then(function(res) {
      wx.hideLoading();
      if (!res.result || !res.result.success || (res.result.questions || []).length === 0) {
        wx.showModal({
          title: '加载失败',
          content: '无匹配题目，请调整筛选条件',
          showCancel: false
        });
        return;
      }

      var questions = res.result.questions || [];
      if (res.result.insufficient) {
        wx.showModal({
          title: '题库不足',
          content: '仅剩 ' + questions.length + ' 道题，已全部加载。',
          showCancel: false,
          success: function() { that._beginExam(paper, questions); }
        });
      } else {
        that._beginExam(paper, questions);
      }
    }).catch(function() {
      wx.hideLoading();
      wx.showModal({
        title: '加载失败', content: '网络异常，请重试', showCancel: false
      });
    });
  },

  _beginExam: function(paper, questions) {
    // 统一 paperIdentifier
    paper.paperIdentifier = paper.paperId || 'sim_' + Date.now();
    var totalSeconds = this.data.duration * 60;
    // 计算模拟模式总分
    var totalScore = 0;
    var sp = this.data.scorePerType;
    for (var i = 0; i < questions.length; i++) {
      totalScore += sp[questions[i].type] || 3;
    }

    this.setData({
      phase: 'answering',
      paper: paper,
      questions: questions,
      currentIndex: 0,
      userAnswers: {},
      showResult: false,
      remainingSeconds: totalSeconds,
      remainingStr: this._formatTime(totalSeconds),
      totalScore: totalScore
    });

    this._startTime = Date.now();
    this._startTimer(totalSeconds);
  },

  // 公共倒计时方法
  _startTimer: function(seconds) {
    var that = this;
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(function() {
      var remain = that.data.remainingSeconds - 1;
      if (remain <= 0) {
        clearInterval(that._timer);
        that._timer = null;
        that.setData({ remainingSeconds: 0, remainingStr: '00:00' });
        wx.showToast({ title: '时间到，已自动提交', icon: 'none' });
        that.finishExam();
      } else {
        that.setData({
          remainingSeconds: remain,
          remainingStr: that._formatTime(remain)
        });
      }
    }, 1000);
  },

  _formatTime: function(seconds) {
    var m = Math.floor(seconds / 60);
    var s = seconds % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
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
    if (this.data.showResult) return;
    var answers = this.data.userAnswers;
    answers[e.currentTarget.dataset.qid] = e.currentTarget.dataset.label;
    this.setData({ userAnswers: answers });
  },

  fillBlank: function(e) {
    var answers = this.data.userAnswers;
    answers[e.currentTarget.dataset.qid] = e.detail.value || '';
    this.setData({ userAnswers: answers });
  },

  selectJudge: function(e) {
    if (this.data.showResult) return;
    var answers = this.data.userAnswers;
    answers[e.currentTarget.dataset.qid] = e.currentTarget.dataset.val;
    this.setData({ userAnswers: answers });
  },

  // ===== 提交批改 =====
  submitExam: function() {
    if (this.data.showResult) return;
    var that = this;
    var questions = this.data.questions;
    var answers = this.data.userAnswers;
    var unanswered = 0;
    for (var i = 0; i < questions.length; i++) {
      if (!answers[questions[i]._id]) unanswered++;
    }

    var doFinish = function() {
      if (that._timer) { clearInterval(that._timer); that._timer = null; }
      that.finishExam();
    };

    if (unanswered > 0) {
      wx.showModal({
        title: '提示',
        content: '还有 ' + unanswered + ' 题未作答，确定交卷吗？',
        success: function(res) { if (res.confirm) doFinish(); }
      });
    } else {
      doFinish();
    }
  },

  finishExam: function() {
    var questions = JSON.parse(JSON.stringify(this.data.questions));
    var correctCount = 0;
    var earnedScore = 0;
    var typeStatsMap = {};
    var knowledgeMap = {};
    var appData = storage.getAppData();
    var scorePerType = this.data.scorePerType;

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var userAns = this.data.userAnswers[q._id] || '';
      var isCorrect = helper.isCorrect(userAns, q);
      q._isCorrect = isCorrect;
      if (isCorrect) correctCount++;

      if (q.options && q.options.length > 0) {
        q._correctOptIdx = helper.resolveCorrectOption(q);
      }

      var tp = q.type || '其他';
      if (!typeStatsMap[tp]) typeStatsMap[tp] = { total: 0, correct: 0 };
      typeStatsMap[tp].total++;
      if (isCorrect) typeStatsMap[tp].correct++;

      var pts = scorePerType[tp] || 3;
      if (isCorrect) earnedScore += pts;

      if (!isCorrect) {
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

        var kps = q.knowledgePoints || [];
        for (var k = 0; k < kps.length; k++) {
          var kp = kps[k];
          if (!knowledgeMap[kp]) knowledgeMap[kp] = { total: 0, wrong: 0 };
          knowledgeMap[kp].total++;
          knowledgeMap[kp].wrong++;
        }
      }

      var allKps = q.knowledgePoints || [];
      for (var j = 0; j < allKps.length; j++) {
        var akp = allKps[j];
        if (!knowledgeMap[akp]) knowledgeMap[akp] = { total: 0, wrong: 0 };
        knowledgeMap[akp].total++;
      }
    }

    storage.saveAppData(appData);

    var typeStats = [];
    for (var key in typeStatsMap) {
      if (typeStatsMap.hasOwnProperty(key)) {
        var item = typeStatsMap[key];
        typeStats.push({
          label: key,
          total: item.total,
          correct: item.correct,
          rate: item.total > 0 ? Math.round(item.correct / item.total * 100) : 0
        });
      }
    }

    var knowledgeStats = [];
    for (var kk in knowledgeMap) {
      if (knowledgeMap.hasOwnProperty(kk)) {
        var km = knowledgeMap[kk];
        knowledgeStats.push({
          label: kk,
          value: km.total > 0 ? Math.round((km.total - km.wrong) / km.total * 100) : 0
        });
      }
    }
    knowledgeStats.sort(function(a, b) { return b.value - a.value; });
    knowledgeStats = knowledgeStats.slice(0, 6);

    var duration = Math.round((Date.now() - this._startTime) / 1000);

    // 异步记录
    var that = this;
    var answersForRecord = questions.map(function(q) {
      return { questionId: q._id, userAnswer: that.data.userAnswers[q._id] || '', isCorrect: q._isCorrect };
    });
    wx.cloud.callFunction({
      name: 'submitPractice',
      data: {
        mode: 'paper',
        paperId: this.data.paper ? (this.data.paper.paperIdentifier || this.data.paper.paperId || this.data.paper._id) : null,
        subject: this.data.subjects[this.data.subjectIndex],
        grade: this.data.gradeList[this.data.gradeIndex],
        answers: answersForRecord,
        correctCount: correctCount,
        totalCount: questions.length,
        duration: duration
      }
    });

    // 奖励
    var stars = Math.max(2, Math.round(correctCount / questions.length * 10));
    var userData = storage.getAppData();
    userData.user.stars += stars;
    userData.user.totalStarsEarned += stars;
    storage.saveAppData(userData);

    var barData = { items: typeStats.map(function(s) {
      return { label: s.label, value: s.rate };
    })};
    var barOptions = { padding: 40, barColor: '#FF9F43', labelColor: '#636E72' };
    var radarData = { items: knowledgeStats };
    var radarOptions = { padding: 40 };

    this.setData({
      questions: questions,
      showResult: true,
      correctCount: correctCount,
      score: earnedScore,
      totalScore: this.data.totalScore,
      typeStats: typeStats,
      knowledgeStats: knowledgeStats,
      barData: barData,
      barOptions: barOptions,
      radarData: radarData,
      radarOptions: radarOptions
    });
  },

  // ===== 结果操作 =====
  goToSetting: function() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.setData({
      phase: 'setting',
      questions: [],
      userAnswers: {},
      showResult: false,
      correctCount: 0
    });
  },

  goToWrongbook: function() {
    wx.navigateTo({ url: '/pages/wrongbook/wrongbook' });
  }
});
