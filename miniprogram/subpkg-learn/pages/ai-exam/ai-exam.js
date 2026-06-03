const storage = require('../../utils/storage');
const dateUtil = require('../../utils/date');
const knowledgeBase = require('../../utils/knowledgeBase');
const antiHallucination = require('../../utils/antiHallucination');

// ===== 学段差异化出题配置 =====
var STAGE_PROMPT_CONFIG = {
  'primary-low': {
    role: '小学低年级老师',
    book: '小学教材和练习册',
    constraints: '题目字数≤50字，尽量使用图片辅助理解。参考答案需简单明了。',
    imageRate: 0.5, maxQuestions: 5, temperature: 0.8
  },
  'primary-high': {
    role: '小学高年级老师',
    book: '小升初考试大纲和小学教材',
    constraints: '题目应符合小学高年级认知水平，不得超纲。选择题选项不超过4个。',
    imageRate: 0.3, maxQuestions: 8, temperature: 0.7
  },
  'middle': {
    role: '初中学科老师',
    book: '中考考试大纲和初中教材',
    constraints: '题目应符合中考命题规范。理科题需包含解题步骤。选择题选项为4个。',
    imageRate: 0.15, maxQuestions: 10, temperature: 0.6
  },
  'high': {
    role: '高中学科老师',
    book: '高考考试大纲和高中教材',
    constraints: '题目应模拟高考题型风格。理科题需完整的公式推导。选择题选项为4个。',
    imageRate: 0.05, maxQuestions: 12, temperature: 0.5
  }
};

function getStagePromptConfig(grade) {
  var stage = storage.getStage(grade);
  return STAGE_PROMPT_CONFIG[stage] || STAGE_PROMPT_CONFIG['primary-high'];
}

function getStageSubjects(grade) {
  var appData = storage.getAppData();
  var track = (appData.user && appData.user.track) || null;
  return storage.getSubjectsForGrade(grade, track);
}

// API Key 在 ai-report 云函数环境变量中配置，前端不暴露

Page({
  data: {
    subjects: getStageSubjects(storage.getAppData().user.currentGrade || 6),
    subjectIndex: 0,
    gradeList: knowledgeBase.GRADE_LIST,
    gradeIndex: 5,
    knowledgePoints: knowledgeBase.GRADE_KNOWLEDGE_MAP['六年级']['数学'] || ['综合'],
    kpIndex: 0,
    difficulties: ['基础巩固', '能力提升', '冲刺拔高'],
    diffIndex: 0,
    questionTypes: ['选择题', '填空题', '应用题', '听力填空', '朗读题', '作文题'],
    typeIndex: 0,
    textbooks: ['通用', '人教版', '北师大版', '苏教版', '沪教版'],
    textbookIndex: 0,
    preferences: ['常规练习', '易错题专项', '小升初真题模拟', '薄弱点强化'],
    prefIndex: 0,
    count: 5,
    generating: false,
    streamCount: 0,
    autoDifficulty: true,
    useWrongBook: false,

    showQuestions: false,
    questions: [],
    currentIndex: 0,
    userAnswers: {},
    showResult: false,
    listeningOpen: {},  // 记录每道听力题的原文展开状态
    recording: false,
    audioFilePath: '',
    speakScore: null,
    speakSuggestion: ''
  },

  // ====== 生命周期 ======
  onLoad: function(options) {
    // 初始化默认年级的知识点
    var initGrade = this.data.gradeList[this.data.gradeIndex];
    var initSubject = this.data.subjects[this.data.subjectIndex];
    var initAllowed = (knowledgeBase.GRADE_KNOWLEDGE_MAP[initGrade] && knowledgeBase.GRADE_KNOWLEDGE_MAP[initGrade][initSubject]) || [];
    if (initAllowed.length > 0) {
      this.setData({ knowledgePoints: initAllowed, kpIndex: 0 });
    }

    if (!options) return;

    // 1. 任务跳转（home 页 "练习" 按钮）
    if (options.sourceTask) {
      try {
        var task = JSON.parse(decodeURIComponent(options.sourceTask));
        var subjectMap = { 'math': '数学', 'chinese': '语文', 'english': '英语' };
        var subjectName = subjectMap[task.subject] || null;
        if (subjectName) {
          var idx = this.data.subjects.indexOf(subjectName);
          if (idx !== -1) {
            var grade = this.data.gradeList[this.data.gradeIndex];
var allowed = (knowledgeBase.GRADE_KNOWLEDGE_MAP[grade] && knowledgeBase.GRADE_KNOWLEDGE_MAP[grade][subjectName]) || [];
var kps = allowed.length > 0 ? allowed : ['通用'];
            this.setData({
              subjectIndex: idx,
              knowledgePoints: kps,
              kpIndex: 0
            });
          }
        }
        this._sourceTask = task;
      } catch (e) {
        console.error('parse sourceTask error:', e);
      }
      return;
    }

    // 2. 错题本跳转或每日计划跳转（携带学科/知识点/难度等参数）
    if (options.fromWrongBook === '1') {
      this.setData({
        useWrongBook: true,
        count: 3,
        prefIndex: this.data.preferences.indexOf('易错题专项') >= 0
          ? this.data.preferences.indexOf('易错题专项') : 0
      });
    }
    if (options.subject) {
      var subIdx = this.data.subjects.indexOf(options.subject);
      if (subIdx !== -1) {
        var grade = this.data.gradeList[this.data.gradeIndex];
var allowed = (knowledgeBase.GRADE_KNOWLEDGE_MAP[grade] && knowledgeBase.GRADE_KNOWLEDGE_MAP[grade][options.subject]) || [];
var kps = allowed.length > 0 ? allowed : ['通用'];
        this.setData({
          subjectIndex: subIdx,
          knowledgePoints: kps,
          kpIndex: 0
        });
      }
    }
    if (options.knowledge) {
      var targetKp = decodeURIComponent(options.knowledge);
      var kpIdx = this.data.knowledgePoints.indexOf(targetKp);
      if (kpIdx === -1) {
        // 如果不在当前列表中，替换整个列表
        this.setData({ knowledgePoints: [targetKp], kpIndex: 0 });
      } else {
        this.setData({ kpIndex: kpIdx });
      }
    }
    if (options.difficulty) {
      var diffIdx = this.data.difficulties.indexOf(options.difficulty);
      if (diffIdx !== -1) this.setData({ diffIndex: diffIdx });
    }
    if (options.count) {
      this.setData({ count: parseInt(options.count) || 5 });
    }
    if (options.autoDifficulty === '1') {
      this.setData({ autoDifficulty: true });
    }
  },

  // ====== 设置事件 ======
  onSubjectChange: function(e) {
    var idx = parseInt(e.detail.value);
    var subject = this.data.subjects[idx];
    var grade = this.data.gradeList[this.data.gradeIndex];
    var allowed = (knowledgeBase.GRADE_KNOWLEDGE_MAP[grade] && knowledgeBase.GRADE_KNOWLEDGE_MAP[grade][subject]) || [];
    this.setData({
      subjectIndex: idx,
      knowledgePoints: allowed.length > 0 ? allowed : ['综合'],
      kpIndex: 0
    });
  },
  onKPChange: function(e) { this.setData({ kpIndex: parseInt(e.detail.value) }); },
  onDiffChange: function(e) { this.setData({ diffIndex: parseInt(e.detail.value) }); },
  onTypeChange: function(e) { this.setData({ typeIndex: parseInt(e.detail.value) }); },
  onTextbookChange: function(e) { this.setData({ textbookIndex: parseInt(e.detail.value) }); },
  onGradeChange: function(e) {
    var idx = parseInt(e.detail.value);
    var grade = this.data.gradeList[idx];
    var subject = this.data.subjects[this.data.subjectIndex];
    var allowed = (knowledgeBase.GRADE_KNOWLEDGE_MAP[grade] && knowledgeBase.GRADE_KNOWLEDGE_MAP[grade][subject]) || [];
    this.setData({
      gradeIndex: idx,
      knowledgePoints: allowed.length > 0 ? allowed : ['综合'],
      kpIndex: 0
    });
  },
  onPrefChange: function(e) { this.setData({ prefIndex: parseInt(e.detail.value) }); },
  onCountChange: function(e) { this.setData({ count: e.detail.value }); },
  onAutoDiffChange: function(e) { this.setData({ autoDifficulty: e.detail.value }); },
  onWrongBookChange: function(e) { this.setData({ useWrongBook: e.detail.value }); },

  // ====== 核心：调用 DeepSeek 生成题目（流式 + 自适应 + 错题强化） ======
  generateQuestions: function() {
    // API Key 已在云函数环境变量中配置
    var subject = this.data.subjects[this.data.subjectIndex];
    var kp = this.data.knowledgePoints[this.data.kpIndex];
    var type = this.data.questionTypes[this.data.typeIndex];
    var textbook = this.data.textbooks[this.data.textbookIndex];
    var pref = this.data.preferences[this.data.prefIndex];

    // === 自适应难度 ===
    var diff = this.data.difficulties[this.data.diffIndex];
    if (this.data.autoDifficulty) {
      var historyRate = this.getRecentCorrectRate();
      if (historyRate !== null) {
        if (historyRate < 0.4) diff = '基础巩固';
        else if (historyRate < 0.7) diff = '能力提升';
        else diff = '冲刺拔高';
        this.setData({ diffIndex: this.data.difficulties.indexOf(diff) });
      }
    }

    // === 错题强化模式 ===
    var actualCount = this.data.count;
    if (this.data.useWrongBook) {
      var wrongKps = this.getWrongKnowledgePoints();
      if (wrongKps.length > 0) {
        kp = wrongKps.join('、');
        pref = '错题同类强化'; // 错题同类强化
        actualCount = Math.min(wrongKps.length * 2, 5);
        this.setData({ count: actualCount });
      } else {
        wx.showToast({ title: '错题本为空，已切换为常规模式', icon: 'none' });
        this.setData({ useWrongBook: false });
      }
    }

    // 重置状态

    this.setData({
      generating: true,
      streamCount: 0,
      questions: [],
      showQuestions: false,
      showResult: false,
      userAnswers: {},
      listeningOpen: {}
    });

    var grade = this.data.gradeList[this.data.gradeIndex];
    this._retryCount = 0;  // 重置自检重试计数

    // ====== 前置校验：校验 prompt 配置是否完备 ======
    var promptCheck = antiHallucination.validatePrompt({
      grade: grade,
      subject: subject,
      knowledgePoints: [kp],
      questionTypes: [type],
      difficulty: diff
    });
    if (!promptCheck.valid) {
      wx.showModal({ title: '配置校验失败', content: promptCheck.reason + '，请调整后重试' });
      this.setData({ generating: false });
      return;
    }

    var promptCfg = getStagePromptConfig(grade);
    var prompt = '你是一位资深的' + promptCfg.role + subject + '老师，正在帮助一名' + grade + '学生备战考试。\n'
      + '学生使用' + textbook + '教材，目前需要「' + pref + '」。\n'
      + '【严格约束】\n'
      + '1. 请基于中国' + promptCfg.book + '出题，不得编造超纲知识点。\n'
      + '2. 知识点必须在以下范围内选取：' + kp + '。\n'
      + '3. 难度「' + diff + '」必须与' + grade + '认知水平匹配。\n'
      + '4. ' + promptCfg.constraints + '\n'
      + '5. 【自检】生成后请逐条验算：将答案代回题目，确认完全满足题设条件才可输出。\n'
      + '请生成' + actualCount + '道' + type + '。\n';

    if (type === '听力填空') {
      prompt += '每道题都需要包含一段听力短文(listeningScript)，学生听后填写空白处的答案。\n';
    }

    prompt += '严格输出JSON格式，不要其他内容：\n'
      + '{\n'
      + '  "questions": [\n';

    if (type === '听力填空') {
      prompt += '    {\n'
        + '      "id": 1,\n'
        + '      "type": "听力填空",\n'
        + '      "difficulty": "' + diff + '",\n'
        + '      "content": "根据听到的短文，填写空白处的单词",\n'
        + '      "listeningScript": "一段英文听力短文，包含1-2个空白需要填写",\n'
        + '      "answer": "正确答案",\n'
        + '      "analysis": "解题步骤和知识点讲解",\n'
        + '      "examPoint": "考察的能力点"\n'
        + '    }\n';
    } else if (type === '朗读题') {
      prompt += '每道题给出一个适合朗读的英文句子或短文，附中文翻译。\n';
      prompt += '    {\n'
        + '      "id": 1,\n'
        + '      "type": "朗读题",\n'
        + '      "difficulty": "' + diff + '",\n'
        + '      "content": "适合朗读的英文句子",\n'
        + '      "translation": "中文翻译",\n'
        + '      "answer": "无固定答案，根据发音评分",\n'
        + '      "analysis": "朗读技巧提示",\n'
        + '      "examPoint": "考察发音和流利度"\n'
        + '    }\n';
    } else if (type === '作文题') {
      prompt += '每道题给出一个作文题目和写作要求。\n';
      prompt += '    {\n'
        + '      "id": 1,\n'
        + '      "type": "作文题",\n'
        + '      "difficulty": "' + diff + '",\n'
        + '      "content": "作文题目和写作要求",\n'
        + '      "answer": "无固定答案",\n'
        + '      "analysis": "写作思路指导",\n'
        + '      "examPoint": "考察写作能力"\n'
        + '    }\n';
    } else {
      prompt += '    {\n'
        + '      "id": 1,\n'
        + '      "type": "' + type + '",\n'
        + '      "difficulty": "' + diff + '",\n'
        + '      "content": "题目内容",\n'
        + '      "options": ["选项A", "选项B", "选项C", "选项D"],\n'
        + '      "answer": "B",\n'
        + '      "analysis": "解题步骤和知识点讲解",\n'
        + '      "examPoint": "考察的能力点"\n'
        + '    }\n';
    }

    prompt += '  ]\n'
      + '}';

    var that = this;

    // 通过 ai-report 云函数调用（API Key 在云函数环境变量中）
    wx.showLoading({ title: 'AI 出题中...' });
    wx.cloud.callFunction({
      name: 'ai-report',
      data: {
        mode: 'chat',
        url: 'https://api.deepseek.com/chat/completions',
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个出题助手，只输出要求的JSON格式，不要任何解释。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      success: function(res) {
        wx.hideLoading();
        if (!res.result || !res.result.success) {
          var errMsg = (res.result && res.result.error && res.result.error.message) || 'AI 接口调用失败';
          if (res.result && res.result.error && res.result.error.code === 'NO_API_KEY') {
            errMsg = 'AI 未配置：请管理员在云函数环境变量中设置 AI_API_KEY';
          }
          wx.showModal({ title: '出题失败', content: errMsg });
          that.setData({ generating: false });
          return;
        }
        try {
          var response = res.result.data;
          if (!response) throw new Error('AI 返回为空');
          var content = '';
          if (response.choices && response.choices[0]) {
            content = response.choices[0].message.content || '';
          } else if (response.result) {
            content = response.result;
          } else if (response.output && response.output.text) {
            content = response.output.text;
          }
          if (!content) throw new Error('AI 返回为空');
          var jsonStr = content;
          var jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) jsonStr = jsonMatch[1];
          var data = JSON.parse(jsonStr);
          if (!data.questions || data.questions.length === 0) throw new Error('无题目');
          var validQs = antiHallucination.filterValidQuestions(
            data.questions,
            that.data.gradeList[that.data.gradeIndex],
            that.data.subjects[that.data.subjectIndex]
          );
          if (validQs.length === 0) {
            wx.showModal({ title: '题目不符合年级要求', content: 'AI生成的题目与当前年级不匹配，请重试' });
            that.setData({ generating: false });
            return;
          }

          // ====== 自检：数学题反向计算验证答案 ======
          if (subject === '数学') {
            that._selfCheckAnswers(validQs, subject, grade, function(corrected, needsRegen) {
              if (needsRegen) {
                // 超过半数错误 → 自动重新生成（最多重试 2 次）
                that._retryCount = (that._retryCount || 0) + 1;
                if (that._retryCount <= 2) {
                  wx.showToast({ title: '答案自检未通过，重新生成中（' + that._retryCount + '/2）', icon: 'loading', duration: 1500 });
                  that.setData({ generating: false });
                  setTimeout(function() { that.generateQuestions(); }, 500);
                  return;
                }
                // 重试次数用完，使用原始结果
                wx.showToast({ title: '自检重试已用完，使用当前结果', icon: 'none', duration: 2000 });
              }
              that._showQuestions(corrected);
            });
          } else {
            that._showQuestions(validQs);
          }
        } catch (e) {
          wx.showModal({ title: '解析失败', content: 'AI返回格式异常，请重试' });
          that.setData({ generating: false });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        var msg = '云函数调用失败';
        if (err.errCode === -404) msg = 'ai-report 云函数未部署，请上传部署';
        else if (err.errMsg && err.errMsg.indexOf('env') !== -1) msg = '请检查 app.js 中的云环境 ID';
        wx.showToast({ title: msg, icon: 'none' });
        that.setData({ generating: false });
      }
    });
  },

  // ====== 自检：数学题反向计算验证答案 ======
  _selfCheckAnswers: function(questions, subject, grade, callback) {
    var that = this;
    var mathQuestions = [];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      if (q.type === '听力填空' || q.type === '听力题' || q.type === '朗读题' || q.type === '作文题') continue;
      mathQuestions.push(q);
    }
    // 非计算类题目无需自检
    if (mathQuestions.length === 0) { callback(questions, false); return; }

    wx.showToast({ title: '答案自检中...', icon: 'loading', duration: 800 });

    // 构造简洁自检 prompt
    var checkItems = mathQuestions.map(function(q, i) {
      var stem = (q.content || q.stem || '').substring(0, 80);
      var answer = q.answer || '';
      return (i + 1) + '. 题目：' + stem + '\n   给出的答案：' + answer;
    }).join('\n\n');

    var checkPrompt = '你是' + grade + subject + '出题校验员。请用反向计算验证以下每道题的答案是否正确。\n' +
      '规则：将答案代入题目反向验证，判断答案是否成立。\n\n' +
      checkItems + '\n\n' +
      '只返回JSON数组（不要解释），格式：[{"index":题号(1开始), "isCorrect":true/false, "correctAnswer":"正确时留空，错误时填正确答案"}]';

    wx.cloud.callFunction({
      name: 'ai-report',
      data: {
        mode: 'chat',
        messages: [
          { role: 'system', content: '你是数学题校验员。只输出JSON数组，不要任何解释。' },
          { role: 'user', content: checkPrompt }
        ],
        temperature: 0.1,
        max_tokens: 800
      },
      success: function(res) {
        var corrections = {};
        try {
          var content = '';
          var response = (res.result && res.result.data) ? res.result.data : null;
          if (!response) throw new Error('校验返回为空');
          if (response.choices && response.choices[0]) content = response.choices[0].message.content || '';
          else if (response.result) content = response.result;
          content = content.replace(/```json\s*|\s*```/g, '').trim();
          var checkResults = JSON.parse(content);
          if (!Array.isArray(checkResults)) throw new Error('校验结果非数组');

          for (var i = 0; i < checkResults.length; i++) {
            var r = checkResults[i];
            if (r && !r.isCorrect && r.correctAnswer) {
              corrections[r.index] = r.correctAnswer;
            }
          }
        } catch (e) {
          // 校验解析失败，不阻塞流程
          console.warn('自检解析失败，跳过:', e.message);
          callback(questions, false);
          return;
        }

        // 应用修正
        var errorCount = Object.keys(corrections).length;
        var corrected = questions.map(function(q, qi) {
          var idx = qi + 1;
          if (corrections[idx]) {
            q._oldAnswer = q.answer;   // 保留原答案供调试
            q._selfChecked = true;
            q.answer = corrections[idx];
          }
          return q;
        });

        // 超过半数错误 → 需要重新生成
        var needsRegen = mathQuestions.length > 0 && errorCount > mathQuestions.length / 2;
        if (errorCount > 0 && !needsRegen) {
          wx.showToast({ title: '已修正 ' + errorCount + ' 道题答案', icon: 'success', duration: 2000 });
        }
        callback(corrected, needsRegen);
      },
      fail: function() {
        // 自检失败不阻塞流程
        console.warn('自检调用失败，使用原始结果');
        callback(questions, false);
      }
    });
  },

  // 显示题目（从自检回调或直接调用）
  _showQuestions: function(questions) {
    this.setData({
      showQuestions: true,
      questions: questions.map(function(q, i) {
        var qid = String(i + 1);  // 统一使用字符串键，避免 dataset 类型不一致
        return Object.assign({}, q, { id: qid });
      }),
      currentIndex: 0,
      userAnswers: {},
      showResult: false,
      generating: false,
      streamCount: questions.length
    });
    this.preCacheListeningAudio();
  },


  // ====== 自适应难度辅助 ======
  getRecentCorrectRate: function() {
    var appData = storage.getAppData();
    var records = appData.aiRecords || [];
    // 取最近10次
    var recent = records.slice(-10);
    if (recent.length === 0) return null;
    var totalCorrect = 0;
    var totalQuestions = 0;
    for (var i = 0; i < recent.length; i++) {
      totalCorrect += recent[i].correctCount || 0;
      totalQuestions += recent[i].totalCount || 0;
    }
    return totalQuestions > 0 ? totalCorrect / totalQuestions : null;
  },

  getWrongKnowledgePoints: function() {
    var appData = storage.getAppData();
    var wrongBook = appData.wrongBook || [];
    var kpCount = {};
    for (var i = 0; i < wrongBook.length; i++) {
      var kp = wrongBook[i].knowledge || '未知';
      if (kpCount[kp]) { kpCount[kp]++; }
      else { kpCount[kp] = 1; }
    }
    // 按频次降序排序，取前3个
    var sorted = Object.keys(kpCount).sort(function(a, b) {
      return kpCount[b] - kpCount[a];
    });
    return sorted.slice(0, 3);
  },

  // ====== 答题交互 ======
  selectOption: function(e) {
    if (this.data.showResult) return;
    var questionId = String(e.currentTarget.dataset.questionId || '');
    var option = e.currentTarget.dataset.option;
    var newAnswers = {};
    for (var key in this.data.userAnswers) {
      if (this.data.userAnswers.hasOwnProperty(key)) {
        newAnswers[key] = this.data.userAnswers[key];
      }
    }
    newAnswers[questionId] = option;
    this.setData({ userAnswers: newAnswers });
  },
  fillBlank: function(e) {
    var questionId = String(e.currentTarget.dataset.questionId || '');
    var newAnswers = {};
    for (var key in this.data.userAnswers) {
      if (this.data.userAnswers.hasOwnProperty(key)) {
        newAnswers[key] = this.data.userAnswers[key];
      }
    }
    newAnswers[questionId] = e.detail.value;
    this.setData({ userAnswers: newAnswers });
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
  onSwiperChange: function(e) {
    this.setData({ currentIndex: e.detail.current });
  },

  // ====== 听力播放（调用云函数 TTS 合成语音） ======
  playListening: function(e) {
    var questionId = e.currentTarget.dataset.questionId;
    var questions = this.data.questions;
    var q = null;
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === questionId) { q = questions[i]; break; }
    }
    if (!q || !q.listeningScript) return;

    // 切换展开/折叠听力原文
    var newOpen = {};
    for (var k in this.data.listeningOpen) {
      newOpen[k] = this.data.listeningOpen[k];
    }
    var willOpen = !newOpen[questionId];
    newOpen[questionId] = willOpen;
    this.setData({ listeningOpen: newOpen });

    if (willOpen) {
      // 优先使用预缓存音频
      if (this.audioCache && this.audioCache[q.id]) {
        if (this._audioCtx) { this._audioCtx.destroy(); this._audioCtx = null; }
        this._audioCtx = wx.createInnerAudioContext();
        this._audioCtx.src = this.audioCache[q.id];
        this._audioCtx.play();
      } else {
        // 无缓存则实时合成
        this.speakTTS(q.listeningScript);
      }
    } else {
      // 收起时停止播放
      if (this._audioCtx) {
        this._audioCtx.stop();
        this._audioCtx.destroy();
        this._audioCtx = null;
      }
    }
  },

  /** 调用云函数 TTS 合成并播放语音 */
  speakTTS: function(text) {
    var that = this;
    wx.showLoading({ title: '正在生成语音...' });

    wx.cloud.callFunction({
      name: 'tts',
      data: {
        text: text,
        voiceType: 101001,
        speed: -0.5,
        volume: 3,
        codec: 'mp3'
      },
      success: function(res) {
        wx.hideLoading();
        if (!res.result || !res.result.success) {
          var code = res.result && res.result.code || '';
          var tip = '';
          if (code === 'UnsupportedOperation.PkgExhausted') {
            tip = '腾讯云 TTS 免费额度已用完，请到控制台购买资源包';
          } else if (code === 'AuthFailure.SignatureFailure') {
            tip = 'SecretId/SecretKey 配置有误，请检查';
          } else if (code === 'FailedOperation.ServiceNotOpened') {
            tip = '尚未开通 TTS 服务，请到腾讯云控制台开通';
          } else {
            tip = '请检查腾讯云 TTS 服务状态';
          }
          var detail = tip + '\n\n[' + code + '] ' + (res.result && res.result.message || '');
          console.error('TTS错误详情:', res.result);
          wx.showModal({
            title: '语音合成失败',
            content: detail
          });
          return;
        }

        var fs = wx.getFileSystemManager();
        var filePath = wx.env.USER_DATA_PATH + '/tts_' + Date.now() + '.mp3';

        fs.writeFile({
          filePath: filePath,
          data: res.result.audio,
          encoding: 'base64',
          success: function() {
            if (that._audioCtx) that._audioCtx.destroy();
            that._audioCtx = wx.createInnerAudioContext();
            that._audioCtx.src = filePath;
            that._audioCtx.play();

            that._audioCtx.onEnded(function() {
              try { fs.unlinkSync(filePath); } catch (e) {}
            });
            that._audioCtx.onError(function(err) {
              wx.showToast({ title: '播放失败', icon: 'error' });
              console.error(err);
              try { fs.unlinkSync(filePath); } catch (e) {}
            });
          },
          fail: function(err) {
            wx.showToast({ title: '音频写入失败', icon: 'error' });
            console.error(err);
          }
        });
      },
      fail: function(err) {
        wx.hideLoading();
        var msg = '云函数调用失败';
        if (err.errCode === -404) msg = '云函数未部署，请在开发者工具中上传 tts 云函数';
        else if (err.errCode === -501) msg = '云环境未开通或 env 配置错误';
        else if (err.errMsg && err.errMsg.indexOf('env') !== -1) msg = '请将 app.js 中的 env 替换为你的云环境 ID';
        wx.showModal({
          title: '网络请求失败',
          content: msg + '\n\n听力原文已展开，家长可先朗读给孩子听'
        });
        console.error('cloud callFunction fail:', err);
      }
    });
  },

  // ====== 听力预缓存 ======
  preCacheListeningAudio: function() {
    var questions = this.data.questions;
    var that = this;
    this.audioCache = {};

    for (var ci = 0; ci < questions.length; ci++) {
      var q = questions[ci];
      if (q.type !== '听力填空' || !q.listeningScript) continue;

      this._preCacheOne(q, that);
    }
  },

  _preCacheOne: function(q, that) {
    wx.cloud.callFunction({
      name: 'tts',
      data: {
        text: q.listeningScript,
        voiceType: 101001,
        speed: -0.5,
        volume: 3,
        codec: 'mp3'
      },
      success: function(res) {
        if (!res.result || !res.result.success) return;
        try {
          var fs = wx.getFileSystemManager();
          var fp = wx.env.USER_DATA_PATH + '/tts_cache_' + q.id + '.mp3';
          fs.writeFileSync(fp, res.result.audio, 'base64');
          that.audioCache[q.id] = fp;
        } catch (e) {
          console.error('cache write error:', e);
        }
      },
      fail: function(err) {
        console.error('preCache failed for q' + q.id + ':', err);
      }
    });
  },

  // ====== 提交批改 ======
  submitAnswers: function() {
    var questions = this.data.questions;
    var userAnswers = this.data.userAnswers;
    var that = this;
    var unanswered = false;
    for (var i = 0; i < questions.length; i++) {
      if (!userAnswers[questions[i].id]) {
        unanswered = true;
        break;
      }
    }
    if (unanswered) {
      wx.showModal({
        title: '提示',
        content: '还有题目没做完，确定要提交吗？',
        success: function(res) {
          if (res.confirm) that.finishCheck();
        }
      });
    } else {
      try {
        this.finishCheck();
      } catch (e) {
        console.error('submitAnswers error:', e);
        this.setData({ generating: false });
        wx.showToast({ title: '提交异常，请重试', icon: 'none' });
      }
    }
  },

  finishCheck: function() {
    try {
      var appData = storage.getAppData();
      var oldQuestions = this.data.questions;
      var userAnswers = this.data.userAnswers;
      var labels = ['A', 'B', 'C', 'D', 'E', 'F'];

      // 构建新数组（深拷贝避免引用残留）
      var questions = [];
      var correctCount = 0;

      for (var i = 0; i < oldQuestions.length; i++) {
        var q = JSON.parse(JSON.stringify(oldQuestions[i]));
        q._isCorrect = this.isCorrect(q);
        q._correctOptIdx = -1;
        // 记录用户填入的文本（供 WXML 答案对比展示，键统一为字符串）
        q._userText = this.data.userAnswers[String(q.id)] || '';

        // 选择题：找到正确答案选项索引（匹配字母或文本包含）
        if (q.options && q.options.length > 0 && q.answer) {
          var ans = typeof q.answer === 'string' ? q.answer.trim() : (q.answer + '').trim();
          if (ans) {
            for (var oi = 0; oi < q.options.length && oi < labels.length; oi++) {
              var optText = typeof q.options[oi] === 'string' ? q.options[oi] : String(q.options[oi] || '');
              if (!optText) continue;
              if (ans === labels[oi] || optText.indexOf(ans) !== -1 || ans.indexOf(optText) !== -1) {
                q._correctOptIdx = oi;
                break;
              }
            }
          }
        }

        if (q._isCorrect) {
          correctCount++;
        } else {
          storage.addWrongQuestion(appData, {
            content: q.content,
            type: q.type,
            difficulty: q.difficulty,
            options: q.options || [],
            answer: q.answer,
            analysis: q.analysis,
            examPoint: q.examPoint,
            subject: this.data.subjects[this.data.subjectIndex],
            knowledge: this.data.useWrongBook ? '错题强化' : this.data.knowledgePoints[this.data.kpIndex]
          });
        }
        questions.push(q);
      }

      // 一次性通过 setData 把预计算好的数据发到渲染线程
      this.setData({ showResult: true, questions: questions });

      // 添加AI练习记录
      storage.addAIRecord(appData, {
        subject: this.data.subjects[this.data.subjectIndex],
        knowledge: this.data.useWrongBook ? '错题强化' : this.data.knowledgePoints[this.data.kpIndex],
        difficulty: this.data.difficulties[this.data.diffIndex],
        type: this.data.questionTypes[this.data.typeIndex],
        textbook: this.data.textbooks[this.data.textbookIndex],
        preference: this.data.preferences[this.data.prefIndex],
        totalCount: questions.length,
        correctCount: correctCount
      });

      // 奖励星星
      var rewardPoints = 20;
      appData.user.stars += rewardPoints;
      storage.addLog(appData.logs, 'ai_practice', '完成AI出题练习', rewardPoints);
      storage.saveAppData(appData);

      wx.showToast({ title: '+' + rewardPoints + '星，正确' + correctCount + '/' + questions.length, icon: 'none' });

    // 从首页任务跳转过来时，自动完成对应任务的打卡
    if (this._sourceTask && this._sourceTask.taskId) {
      var pages = getCurrentPages();
      var prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.autoCompleteTask) {
        prevPage.autoCompleteTask(this._sourceTask.taskId);
      }
    }
    } catch (e) {
      console.error('finishCheck error:', e);
      this.setData({ showResult: true, generating: false });
      wx.showToast({ title: '批改异常，已恢复', icon: 'none' });
    }
  },

  isCorrect: function(item) {
    if (!item) return false;
    var userAns = this.data.userAnswers[String(item.id)];
    if (!userAns) return false;
    if (typeof userAns !== 'string') return false;
    var ua = userAns.trim();
    var ca = typeof item.answer === 'string' ? item.answer.trim() : '';

    // 1. 精确匹配（适用于填空、应用）
    if (ua === ca) return true;

    // 2. 选择题：按索引匹配（不管 answer 是字母还是文本）
    if (item.options && item.options.length > 0 && ca) {
      var labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      // 找到正确答案对应的选项索引
      var correctIdx = -1;
      for (var ci = 0; ci < item.options.length && ci < labels.length; ci++) {
        var optStr = typeof item.options[ci] === 'string' ? item.options[ci] : '';
        if (!optStr) continue;
        if (ca === labels[ci] || (optStr.indexOf(ca) !== -1) || (ca.indexOf(optStr) !== -1)) {
          correctIdx = ci;
          break;
        }
      }
      // 找到学生答案对应的选项索引
      var userIdx = -1;
      for (var ui = 0; ui < item.options.length && ui < labels.length; ui++) {
        var optStr = typeof item.options[ui] === 'string' ? item.options[ui] : '';
        if (ua === labels[ui] || (optStr && optStr.indexOf(ua) !== -1) || (ua && ua.indexOf(optStr) !== -1)) {
          userIdx = ui;
          break;
        }
      }
      // 索引相同即正确
      if (correctIdx >= 0 && correctIdx === userIdx) return true;
    }

    return false;
  },

  // ====== 口语朗读 ======
  startRecord: function() {
    var that = this;
    var rm = wx.getRecorderManager();
    rm.start({ duration: 15000, sampleRate: 16000, format: 'mp3' });
    this.setData({ recording: true, speakScore: null, speakSuggestion: '' });
    rm.onStop(function(res) {
      that.setData({ audioFilePath: res.tempFilePath, recording: false });
    });
  },

  stopRecord: function() {
    wx.getRecorderManager().stop();
  },

  playRecord: function() {
    if (!this.data.audioFilePath) return;
    var audio = wx.createInnerAudioContext();
    audio.src = this.data.audioFilePath;
    audio.play();
  },

  submitSpeak: function() {
    var that = this;
    wx.showLoading({ title: '评分中...' });
    wx.cloud.callFunction({
      name: 'speech-eval',
      data: {
        audioPath: that.data.audioFilePath,
        referenceText: that.data.questions[that.data.currentIndex].content
      },
      success: function(res) {
        wx.hideLoading();
        if (res.result && res.result.success) {
          that.setData({
            speakScore: res.result.score,
            speakSuggestion: res.result.suggestion
          });
        } else {
          wx.showToast({ title: '评分失败', icon: 'error' });
        }
      },
      fail: function() {
        wx.hideLoading();
        wx.showToast({ title: '请求失败', icon: 'error' });
      }
    });
  },

  // ====== 作文输入 ======
  onEssayInput: function(e) {
    var qid = e.currentTarget.dataset.id;
    var val = e.detail.value;
    var newAnswers = {};
    for (var k in this.data.userAnswers) { newAnswers[k] = this.data.userAnswers[k]; }
    newAnswers[qid] = val;
    this.setData({ userAnswers: newAnswers });
  },

  redoQuestions: function() {
    this.setData({
      userAnswers: {},
      showResult: false,
      currentIndex: 0,
      listeningOpen: {}
    });
  },

  // ====== 打印导出 ======
  printQuestions: function() {
    var qs = this.data.questions;
    wx.showLoading({ title: '生成中...' });
    var canvasW = 750;
    var maxH = 6000;
    var maxQs = Math.floor((maxH - 100) / 160);
    if (qs.length > maxQs) {
      wx.showToast({ title: '题目过多，仅导出前' + maxQs + '题', icon: 'none', duration: 2500 });
      qs = qs.slice(0, maxQs);
    }
    var canvasH = 100 + qs.length * 160;

    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#printCanvas').fields({ node: true, size: true }).exec(function(res) {
      if (!res[0]) { wx.hideLoading(); return; }
      var canvas = res[0].node;
      var ctx = canvas.getContext('2d');
      var dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = canvasW * dpr;
      canvas.height = canvasH * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasW, canvasH);

      ctx.fillStyle = '#2D3436';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('成长刻度 · 练习卷', canvasW / 2, 50);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#B2BEC3';
      ctx.fillText(new Date().toLocaleDateString() + ' · 共' + qs.length + '题', canvasW / 2, 80);

      var y = 120;
      for (var i = 0; i < qs.length; i++) {
        var q = qs[i];
        ctx.fillStyle = '#FF6B35';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText((i + 1) + '. (' + q.difficulty + ') ' + (q.type || ''), 30, y);
        y += 36;

        ctx.fillStyle = '#2D3436';
        ctx.font = '24px sans-serif';
        var content = q.content || '';
        var maxW = canvasW - 60;
        while (content.length > 0) {
          var sliceLen = content.length;
          for (var ci = content.length; ci > 0; ci--) {
            if (ctx.measureText(content.slice(0, ci)).width <= maxW) { sliceLen = ci; break; }
          }
          ctx.fillText(content.slice(0, sliceLen), 30, y);
          content = content.slice(sliceLen);
          y += 32;
        }

        if (q.options && q.options.length > 0) {
          for (var oi = 0; oi < q.options.length; oi++) {
            y += 28;
            ctx.fillText('  ' + String.fromCharCode(65 + oi) + '. ' + q.options[oi], 40, y);
          }
        } else if (q.type !== '朗读题' && q.type !== '作文题') {
          y += 28;
          ctx.fillText('  ___________________________', 40, y);
        }
        y += 30;
      }

      wx.canvasToTempFilePath({
        canvas: canvas,
        success: function(res) {
          wx.hideLoading();
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: function() { wx.showToast({ title: '已保存到相册', icon: 'success' }); },
            fail: function() { wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' }); }
          });
        },
        fail: function() { wx.hideLoading(); wx.showToast({ title: '导出失败', icon: 'error' }); }
      });
    });
  },

  backToSettings: function() {
    this.setData({ showQuestions: false });
  }
});
