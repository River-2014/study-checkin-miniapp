var helper = require('../../utils/practiceHelper');

Page({
  data: {
    tabIndex: 0,
    adminTabs: [{ label: '📋 题库管理' }, { label: '📝 试卷管理' }],

    // 题库管理
    subjects: helper.SUBJECTS,
    subjectIndex: 1,
    gradeList: helper.GRADE_LIST,
    gradeIndex: 5,
    types: helper.PRACTICE_TYPES,
    typeIndex: 0,
    difficulties: helper.DIFFICULTIES,
    difficultyIndex: 1,

    // 手动录题表单
    showAddForm: false,
    form: { stem: '', options: '', answer: '', explanation: '', examPoint: '', knowledgePoints: '' },
    formSubmitting: false,

    // 手动爬取
    crawlUrl: '',
    crawlMode: 'questions',  // 'questions' | 'papers'
    crawlSelector: '',

    // 状态
    crawling: false,
    crawlResult: null,
    stats: null,
    statsLoading: false,

    // ===== 试卷管理 =====
    paperFilter: { subject: '', grade: '', keyword: '' },
    paperStats: null,
    paperStatsLoading: false,
    paperList: [],
    paperListLoading: false,
    paperPage: 1,
    paperTotal: 0,

    // 手动创建试卷
    showPaperForm: false,
    paperForm: {
      title: '', subject: '数学', grade: '六年级',
      year: '', term: '', version: '',
      totalScore: 100, duration: 60
    },
    paperSubmitting: false,

    // 删除确认
    deletingPaperId: '',
    batchDeleting: false
  },

  onShow: function() {
    if (this.data.tabIndex === 0) {
      this.loadStats();
    } else {
      this.loadPaperStats();
      this.loadPaperList();
    }
  },

  // ===== 新页面入口 =====
  goQuestionManage: function() { wx.navigateTo({ url: '/subpkg-admin/pages/questionManage/questionManage' }); },
  goStats: function() { wx.navigateTo({ url: '/subpkg-admin/pages/stats/stats' }); },
  goReviewQueue: function() { wx.navigateTo({ url: '/subpkg-admin/pages/reviewQueue/reviewQueue' }); },

  onTabChange: function(e) {
    var idx = e.detail.index;
    this.setData({ tabIndex: idx });
    if (idx === 0) {
      this.loadStats();
    } else {
      this.loadPaperStats();
      this.loadPaperList();
    }
  },

  // ===== 题库统计 =====
  loadStats: function() {
    var that = this;
    this.setData({ statsLoading: true });
    var db = wx.cloud.database();
    db.collection('exam_questions').count().then(function(res) {
      that.setData({ stats: { totalQuestions: res.total }, statsLoading: false });
    }).catch(function() {
      that.setData({ stats: { totalQuestions: '(集合未初始化)' }, statsLoading: false });
    });
  },

  // ===== 筛选 =====
  onSubjectChange: function(e) { this.setData({ subjectIndex: Number(e.detail.value) }); },
  onGradeChange: function(e) { this.setData({ gradeIndex: Number(e.detail.value) }); },
  onTypeChange: function(e) { this.setData({ typeIndex: Number(e.detail.value) }); },
  onDifficultyChange: function(e) { this.setData({ difficultyIndex: Number(e.detail.value) }); },

  // ===== 手动录题 =====
  toggleAddForm: function() {
    this.setData({ showAddForm: !this.data.showAddForm });
  },

  onFormFieldChange: function(e) {
    var field = e.currentTarget.dataset.field;
    // 处理自定义URL输入（顶层data字段）
    if (field === 'customUrl' || field === 'customSelector') {
      var upd = {};
      upd[field] = e.detail.value;
      this.setData(upd);
      return;
    }
    // 处理题目表单字段
    var form = this.data.form;
    form[field] = e.detail.value;
    this.setData({ form: form });
  },

  submitQuestion: function() {
    var that = this;
    var form = this.data.form;
    if (!form.stem || form.stem.length < 3) {
      wx.showToast({ title: '题干不能为空', icon: 'none' });
      return;
    }

    this.setData({ formSubmitting: true });

    var options = form.options ? form.options.split('\n').filter(function(s) { return s.trim(); }) : [];
    var q = {
      subject: this.data.subjects[this.data.subjectIndex],
      grade: this.data.gradeList[this.data.gradeIndex],
      type: this.data.types[this.data.typeIndex],
      difficulty: this.data.difficulties[this.data.difficultyIndex],
      knowledgePoints: form.knowledgePoints ? form.knowledgePoints.split(/[,，、]/).filter(function(s) { return s.trim(); }) : [],
      stem: form.stem,
      options: options,
      answer: form.answer || '',
      explanation: form.explanation || '',
      examPoint: form.examPoint || '',
      paperSource: 'manual',
      status: 'active'
    };

    var db = wx.cloud.database();
    db.collection('exam_questions').add({ data: q }).then(function() {
      wx.showToast({ title: '题目已添加', icon: 'success' });
      that.setData({
        showAddForm: false,
        formSubmitting: false,
        form: { stem: '', options: '', answer: '', explanation: '', examPoint: '', knowledgePoints: '' }
      });
      that.loadStats();
    }).catch(function(e) {
      wx.showToast({ title: '添加失败: ' + e.message, icon: 'none' });
      that.setData({ formSubmitting: false });
    });
  },

  // ===== 手动爬取（自动识别网站） =====
  onCrawlUrlInput: function(e) { this.setData({ crawlUrl: e.detail.value }); },
  onCrawlModeChange: function(e) { this.setData({ crawlMode: e.detail.value }); },
  onCrawlSelectorInput: function(e) { this.setData({ crawlSelector: e.detail.value }); },

  startAutoCrawl: function() {
    var that = this;
    var url = this.data.crawlUrl;
    if (!url) {
      wx.showToast({ title: '请输入网址', icon: 'none' });
      return;
    }

    this.setData({ crawling: true, crawlResult: null });
    wx.showLoading({ title: '爬取中...' });

    wx.cloud.callFunction({
      name: 'autoCrawl',
      data: {
        url: url,
        mode: this.data.crawlMode,
        subject: this.data.subjects[this.data.subjectIndex],
        grade: this.data.gradeList[this.data.gradeIndex],
        selector: this.data.crawlSelector || undefined
      }
    }).then(function(res) {
      wx.hideLoading();
      that.setData({ crawling: false });
      var r = res.result || {};

      if (r.success) {
        that.setData({ crawlResult: r });
        var desc = r.inserted > 0
          ? '爬取 ' + r.crawled + ' 条，入库 ' + r.inserted + ' 条'
          : '未发现新内容（' + r.crawled + ' 条均已存在）';
        wx.showToast({ title: desc, icon: 'success', duration: 2500 });
      } else {
        that.setData({
          crawlResult: {
            success: false,
            error: r.error || '未知错误',
            crawled: 0, inserted: 0
          }
        });
        wx.showToast({ title: r.error || '爬取失败', icon: 'none', duration: 3000 });
      }

      // 刷新统计/列表
      if (that.data.tabIndex === 0) {
        that.loadStats();
      } else {
        that.loadPaperStats();
        that.loadPaperList();
      }
    }).catch(function(e) {
      wx.hideLoading();
      that.setData({
        crawling: false,
        crawlResult: { success: false, error: '网络异常，请确认云函数已部署', crawled: 0, inserted: 0 }
      });
      wx.showToast({ title: '网络异常', icon: 'none' });
    });
  },

  // ==========================================
  // 试卷管理方法
  // ==========================================

  // 试卷搜索字段变更
  onPaperFilterChange: function(e) {
    var field = e.currentTarget.dataset.field;
    var filter = this.data.paperFilter;
    filter[field] = e.detail.value;
    this.setData({ paperFilter: filter });
  },

  // 加载试卷统计
  loadPaperStats: function() {
    var that = this;
    this.setData({ paperStatsLoading: true });
    wx.cloud.callFunction({
      name: 'managePapers',
      data: { action: 'stats' }
    }).then(function(res) {
      var r = res.result || {};
      if (r.success) {
        that.setData({ paperStats: r.stats, paperStatsLoading: false });
      } else {
        that.setData({ paperStats: { total: 0, active: 0, metadata_only: 0 }, paperStatsLoading: false });
      }
    }).catch(function() {
      that.setData({ paperStats: { total: 0, active: 0, metadata_only: 0 }, paperStatsLoading: false });
    });
  },

  // 加载试卷列表
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
        keyword: filter.keyword
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
        wx.showToast({ title: r.error || '加载失败', icon: 'none' });
      }
    }).catch(function() {
      that.setData({ paperList: [], paperListLoading: false });
    });
  },

  // 搜索试卷
  searchPapers: function() {
    this.setData({ paperPage: 1 });
    this.loadPaperList();
  },

  // 上一页/下一页
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

  // 试卷筛选
  onPaperSubjectChange: function(e) {
    var filter = this.data.paperFilter;
    filter.subject = this.data.subjects[Number(e.detail.value)];
    this.setData({ paperFilter: filter });
    this.searchPapers();
  },
  onPaperGradeChange: function(e) {
    var filter = this.data.paperFilter;
    filter.grade = this.data.gradeList[Number(e.detail.value)];
    this.setData({ paperFilter: filter });
    this.searchPapers();
  },

  // 手动创建试卷
  togglePaperForm: function() {
    this.setData({ showPaperForm: !this.data.showPaperForm });
  },

  onPaperFormFieldChange: function(e) {
    var field = e.currentTarget.dataset.field;
    var form = this.data.paperForm;
    form[field] = e.detail.value;
    this.setData({ paperForm: form });
  },
  onPaperFormNumChange: function(e) {
    var field = e.currentTarget.dataset.field;
    var form = this.data.paperForm;
    form[field] = Number(e.detail.value) || 0;
    this.setData({ paperForm: form });
  },
  onPaperFormSubjectChange: function(e) {
    var form = this.data.paperForm;
    form.subject = this.data.subjects[Number(e.detail.value)];
    this.setData({ paperForm: form });
  },
  onPaperFormGradeChange: function(e) {
    var form = this.data.paperForm;
    form.grade = this.data.gradeList[Number(e.detail.value)];
    this.setData({ paperForm: form });
  },

  submitPaper: function() {
    var that = this;
    var form = this.data.paperForm;
    if (!form.title || form.title.length < 3) {
      wx.showToast({ title: '试卷标题不能为空', icon: 'none' });
      return;
    }

    this.setData({ paperSubmitting: true });
    wx.cloud.callFunction({
      name: 'managePapers',
      data: {
        action: 'create',
        paper: {
          title: form.title,
          subject: form.subject,
          grade: form.grade,
          year: form.year,
          term: form.term,
          version: form.version,
          totalScore: form.totalScore,
          duration: form.duration,
          sections: [],
          paperSource: 'manual',
          status: 'active'
        }
      }
    }).then(function(res) {
      var r = res.result || {};
      if (r.success) {
        wx.showToast({ title: '试卷已创建', icon: 'success' });
        that.setData({
          showPaperForm: false,
          paperSubmitting: false,
          paperForm: {
            title: '', subject: '数学', grade: '六年级',
            year: '', term: '', version: '',
            totalScore: 100, duration: 60
          }
        });
        that.loadPaperStats();
        that.loadPaperList();
      } else {
        wx.showToast({ title: r.error || '创建失败', icon: 'none' });
        that.setData({ paperSubmitting: false });
      }
    }).catch(function(e) {
      wx.showToast({ title: '创建失败: ' + e.message, icon: 'none' });
      that.setData({ paperSubmitting: false });
    });
  },

  // 删除单个试卷
  deletePaper: function(e) {
    var id = e.currentTarget.dataset.id;
    var that = this;
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，确定删除该试卷？',
      success: function(modal) {
        if (!modal.confirm) return;
        wx.showLoading({ title: '删除中...' });
        wx.cloud.callFunction({
          name: 'managePapers',
          data: { action: 'delete', paperIds: [id] }
        }).then(function(res) {
          wx.hideLoading();
          var r = res.result || {};
          if (r.success) {
            wx.showToast({ title: '已删除', icon: 'success' });
            that.loadPaperList();
            that.loadPaperStats();
          } else {
            wx.showToast({ title: r.error || '删除失败', icon: 'none' });
          }
        }).catch(function() {
          wx.hideLoading();
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  },

  // 批量删除 metadata_only 试卷
  batchDeleteMetadataPapers: function() {
    var that = this;
    wx.showModal({
      title: '批量清理',
      content: '将删除所有"仅元数据"状态的试卷（来自 shijuan1 爬取的试卷标题，不含实际题目内容）。确定删除？',
      success: function(modal) {
        if (!modal.confirm) return;
        that.setData({ batchDeleting: true });
        wx.showLoading({ title: '批量删除中...' });
        wx.cloud.callFunction({
          name: 'managePapers',
          data: { action: 'batchDeleteMetadata' }
        }).then(function(res) {
          wx.hideLoading();
          that.setData({ batchDeleting: false });
          var r = res.result || {};
          if (r.success) {
            wx.showToast({
              title: '已删除 ' + r.deleted + ' 份',
              icon: 'success'
            });
            that.loadPaperList();
            that.loadPaperStats();
          } else {
            wx.showToast({ title: r.error || '删除失败', icon: 'none' });
          }
        }).catch(function() {
          wx.hideLoading();
          that.setData({ batchDeleting: false });
          wx.showToast({ title: '删除失败', icon: 'none' });
        });
      }
    });
  },

  // 查看试卷详情（跳转到 exam-paper 预览模式）
  viewPaperDetail: function(e) {
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/subpkg-learn/pages/exam-paper/exam-paper?paperId=' + id + '&mode=real' });
  }
});
