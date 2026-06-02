/**
 * 题目文本解析器 v1.0
 *
 * 从 DOCX 提取的纯文本中智能解析题目结构：
 *   - 识别题型（填空/选择/判断/计算/应用/作图）
 *   - 拆分题号、题干、选项、答案
 *   - 提取知识点标签
 *   - 去噪（过滤非题目内容）
 */

// 题型关键词映射
var TYPE_KEYWORDS = {
  '填空': '填空题',
  '选择': '选择题',
  '判断': '判断题',
  '计算': '计算题',
  '简答': '简答题',
  '应用': '应用题',
  '作图': '作图题',
  '操作': '操作题',
  '解决': '应用题',
  '解答': '应用题',
  '实际问': '应用题',
  '直接': '计算题',
  '能简': '计算题',
  '脱式': '计算题',
  '列式': '应用题',
  '解方': '计算题',
  '求阴': '计算题',
  '看': '其他题',
  '听': '其他题',
  '阅读': '阅读理解',
  '完形': '完形填空',
  '作文': '写作题',
  '翻译': '翻译题',
  '连线': '连线题'
};

// 非题目标题行关键词（需跳过）
var SKIP_PATTERNS = [
  /^考试时间/, /^测试内容/, /^满分/, /^姓名/, /^班级/,
  /^座位/, /^装.*订/, /^…/, /^\.{3,}/, /^得分/,
  /^注意/, /^答题/, /^说[:：]明/, /^题[:：]号/,
  /^\s*$/
];

// 知识点提取映射（关键词 → 知识点标签）
var KNOWLEDGE_TAGS = {
  '数学': {
    '加减': '加减法', '乘除': '乘除法', '分数': '分数运算',
    '小数': '小数运算', '百分': '百分数', '比例': '比例',
    '方程': '方程', '几何': '几何图形', '面积': '面积计算',
    '体积': '体积计算', '周长': '周长计算', '角度': '角度',
    '统计': '统计', '概率': '概率', '时间': '时间计算',
    '单位': '单位换算', '行程': '行程问题', '工程': '工程问题',
    '植树': '植树问题', '鸡兔': '鸡兔同笼', '盈亏': '盈亏问题',
    '质数': '质数与合数', '因数': '因数倍数', '倍数': '因数倍数'
  },
  '语文': {
    '拼音': '拼音', '汉字': '汉字书写', '词语': '词语理解',
    '成语': '成语积累', '古诗': '古诗文', '阅读': '阅读理解',
    '作文': '写作', '修辞': '修辞手法', '标点': '标点符号',
    '病句': '病句修改', '默写': '古诗默写', '文言': '文言文'
  },
  '英语': {
    '单词': '词汇', '语法': '语法', '阅读': '阅读理解',
    '听力': '听力', '作文': '写作', '翻译': '翻译',
    '时态': '时态', '语态': '语态', '介词': '介词',
    '连词': '连词', '代词': '代词', '冠词': '冠词'
  }
};

/**
 * 检测文本中的题型
 */
function detectQuestionType(line, subject) {
  if (!line || line.length > 30) return '';

  for (var key in TYPE_KEYWORDS) {
    if (TYPE_KEYWORDS.hasOwnProperty(key) && line.indexOf(key) >= 0) {
      return TYPE_KEYWORDS[key];
    }
  }
  return '';
}

/**
 * 是否为非题目行
 */
function isSkipLine(line) {
  if (!line || line.trim().length < 3) return true;
  for (var i = 0; i < SKIP_PATTERNS.length; i++) {
    if (SKIP_PATTERNS[i].test(line)) return true;
  }
  return false;
}

/**
 * 提取知识点标签
 */
function extractKnowledgePoints(text, subject) {
  var tags = [];
  var subjTags = KNOWLEDGE_TAGS[subject] || {};
  for (var key in subjTags) {
    if (subjTags.hasOwnProperty(key) && text.indexOf(key) >= 0) {
      if (tags.indexOf(subjTags[key]) < 0) {
        tags.push(subjTags[key]);
      }
    }
  }
  return tags.slice(0, 5);
}

/**
 * 标准化题目数据
 */
function normalizeQuestion(raw) {
  return {
    subject: raw.subject || '',
    grade: raw.grade || '',
    type: raw.type || '填空题',
    difficulty: raw.difficulty || '基础巩固',
    knowledgePoints: extractKnowledgePoints(raw.stem || '', raw.subject),
    stem: (raw.stem || '').trim().substring(0, 500),
    options: (raw.options || []).map(function(o) { return o.trim().substring(0, 200); }),
    answer: (raw.answer || '').trim(),
    explanation: (raw.explanation || '').trim(),
    examPoint: (raw.examPoint || '').trim(),
    paperSource: raw.paperSource || '',
    sourceTitle: raw.sourceTitle || '',
    sourceUrl: raw.sourceUrl || '',
    status: 'active',
    createdAt: raw.createdAt || new Date().toISOString()
  };
}

/**
 * 解析文本中的题目
 * @param {string} text - DOCX 提取的纯文本
 * @param {object} meta - { subject, grade, paperId, paperTitle, paperUrl }
 * @returns {Array} 题目对象数组
 */
function parseQuestions(text, meta) {
  if (!text || text.length < 20) return [];

  var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
  var questions = [];
  var currentSection = '填空题'; // 默认题型
  var sectionPattern = /^[一二三四五六七八九十]+[、.]?\s*(.+?)(?:题)?\s*(?:（[^）]*）)?$/;
  var questionPatterns = [
    // 中文题号：1．/ 12、/ 3）
    { re: /^(\d{1,3})\s*[\.\、．\)）]\s*(.+)/, idx: 2 },
    // 括号题号：(1) / （12）
    { re: /^[（(](\d{1,3})[）)]\s*(.+)/, idx: 2 }
  ];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();

    // 跳过非内容行
    if (isSkipLine(line)) continue;

    // 检测题型标记
    var secMatch = line.match(sectionPattern);
    if (secMatch && line.length < 30) {
      var detected = detectQuestionType(line, meta.subject);
      if (detected) currentSection = detected;
      continue;
    }

    // 匹配题号
    var matched = false;
    var qNum = '';
    var stem = '';

    for (var p = 0; p < questionPatterns.length; p++) {
      var qMatch = line.match(questionPatterns[p].re);
      if (qMatch && qMatch[questionPatterns[p].idx] && qMatch[questionPatterns[p].idx].length > 3) {
        qNum = qMatch[1];
        stem = qMatch[questionPatterns[p].idx].trim();
        matched = true;
        break;
      }
    }

    if (!matched) continue;

    var options = [];
    var answer = '';

    // 收集选项（A．/ B．/ C．/ D． 开头，支持同行多选项）
    // 如 "A．50－22＋27  B．50－（22＋27）  C．22＋27"
    var nextIdx = i + 1;
    while (nextIdx < lines.length) {
      var nextLine = lines[nextIdx].trim();
      var optMatch = nextLine.match(/^([A-D])[\.\、．\)）]\s*(.+)/);
      if (optMatch) {
        var remainText = optMatch[2];
        nextIdx++;

        // 拆分行内多选项（按 2+个空格后跟 [A-D]． 分割）
        var inlineParts = remainText.split(/\s{2,}(?=[A-D][\.\、．\)）])/);
        // 第一个部分可能有前缀标识需要去除
        if (inlineParts.length > 1) {
          // 同行多选项：第一个部分是纯文本，后续是 "B．xxx" 格式
          options.push(inlineParts[0].trim());
          for (var ip = 1; ip < inlineParts.length; ip++) {
            var ipMatch = inlineParts[ip].match(/^[A-D][\.\、．\)）]\s*(.+)/);
            if (ipMatch) options.push(ipMatch[1].trim());
          }
          break; // 同行多选项已收齐，不再扫后续行
        } else {
          // 单选项，继续检查下一行
          options.push(remainText.trim());
        }
      } else {
        break;
      }
    }

    // 判断题特殊处理（√ / × 在行尾）
    if (currentSection === '判断题') {
      if (stem.indexOf('（√）') >= 0 || stem.indexOf('(√)') >= 0 ||
          stem.indexOf('（×）') >= 0 || stem.indexOf('(×)') >= 0) {
        // 题干中包含答案标记，通常这是题目描述
      }
      // 尝试在括号中找答案
      var tfMatch = stem.match(/[（(]\s*([√×✓✗])\s*[）)]/);
      if (tfMatch) {
        answer = tfMatch[1] === '√' || tfMatch[1] === '✓' ? '√' : '×';
        stem = stem.replace(/[（(]\s*[√×✓✗]\s*[）)]/, '').trim();
      }
      if (!answer) answer = '√'; // 默认
    }

    // 选择题答案（行尾括号）
    if (options.length > 0 && !answer) {
      var ansMatch = stem.match(/[（(]\s*([A-D])\s*[）)]/);
      if (ansMatch) {
        answer = ansMatch[1];
        stem = stem.replace(/[（(]\s*[A-D]\s*[）)]/, '').trim();
      }
    }

    // 填空题答案
    if (currentSection === '填空题' && !answer) {
      var blankMatch = stem.match(/[（(]\s*([^）)]{1,30})\s*[）)]/g);
      if (blankMatch && blankMatch.length === 1) {
        var ans = blankMatch[0].replace(/[（(]\s*/, '').replace(/\s*[）)]/, '').trim();
        if (ans && ans.length < 20 && !/^[一二三四五六七八九十]+$/.test(ans)) {
          answer = ans;
        }
      }
    }

    var question = normalizeQuestion({
      subject: meta.subject || '',
      grade: meta.grade || '',
      type: currentSection,
      difficulty: '基础巩固',
      stem: stem,
      options: options,
      answer: answer,
      paperSource: 'shijuan1:' + (meta.paperId || ''),
      sourceTitle: meta.paperTitle || '',
      sourceUrl: meta.paperUrl || ''
    });

    questions.push(question);
    i = nextIdx - 1;
  }

  return questions;
}

/**
 * 批量解析并去重
 */
function parseAndDedup(texts, meta) {
  var allQuestions = [];
  var seen = {};

  // texts 可以是单个字符串或数组
  var textList = Array.isArray(texts) ? texts : [texts];

  for (var t = 0; t < textList.length; t++) {
    var questions = parseQuestions(textList[t], meta);
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      // 用题干前100字符做去重
      var key = q.stem.substring(0, 100).replace(/\s/g, '');
      if (!seen[key]) {
        seen[key] = true;
        allQuestions.push(q);
      }
    }
  }

  return allQuestions;
}

/**
 * 统计分析
 */
function analyzeQuestions(questions) {
  var stats = { total: questions.length, byType: {}, byGrade: {}, bySubject: {} };

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    stats.byType[q.type] = (stats.byType[q.type] || 0) + 1;
    stats.byGrade[q.grade] = (stats.byGrade[q.grade] || 0) + 1;
    stats.bySubject[q.subject] = (stats.bySubject[q.subject] || 0) + 1;
  }

  return stats;
}

module.exports = {
  TYPE_KEYWORDS: TYPE_KEYWORDS,
  KNOWLEDGE_TAGS: KNOWLEDGE_TAGS,
  detectQuestionType: detectQuestionType,
  isSkipLine: isSkipLine,
  extractKnowledgePoints: extractKnowledgePoints,
  normalizeQuestion: normalizeQuestion,
  parseQuestions: parseQuestions,
  parseAndDedup: parseAndDedup,
  analyzeQuestions: analyzeQuestions
};
