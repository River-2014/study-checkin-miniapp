// 各年级各学科的核心知识点白名单
var GRADE_KNOWLEDGE_MAP = {
  '一年级': {
    '数学': ['20以内加减法', '100以内数的认识', '认识图形', '认识钟表', '位置与顺序'],
    '语文': ['拼音认读', '简单汉字书写', '看图说话', '朗读训练'],
    '英语': []
  },
  '二年级': {
    '数学': ['乘法口诀', '除法初步', '长度单位', '角的初步认识', '混合运算'],
    '语文': ['部首查字法', '简单的阅读', '日记写作', '造句练习'],
    '英语': ['字母认读', '简单单词', '日常问候语', '颜色词汇']
  },
  '三年级': {
    '数学': ['万以内加减法', '多位数乘一位数', '分数初步', '周长计算', '年月日'],
    '语文': ['概括段落大意', '写景作文', '寓言故事', '字词辨析'],
    '英语': ['简单句型', '颜色/数字/动物词汇', '简短对话', '字母发音']
  },
  '四年级': {
    '数学': ['大数的认识', '公顷和平方千米', '角的度量', '平行四边形和梯形', '三位数乘两位数'],
    '语文': ['修辞手法', '写人记事作文', '古诗背诵', '阅读理解'],
    '英语': ['一般现在时', '日常交际用语', '简单阅读', '名词单复数']
  },
  '五年级': {
    '数学': ['小数乘除法', '简易方程', '多边形面积', '因数与倍数', '长方体与正方体'],
    '语文': ['说明文阅读', '读后感写作', '文言文入门', '概括中心思想'],
    '英语': ['现在进行时', '形容词比较级', '小短文阅读', '一般疑问句']
  },
  '六年级': {
    '数学': ['分数乘除法', '百分数', '圆柱与圆锥', '比例', '负数', '鸡兔同笼'],
    '语文': ['小说阅读', '议论文写作', '综合复习', '古诗词鉴赏', '文言文阅读'],
    '英语': ['一般过去时', '复合句', '完形填空', '听力理解', '书面表达']
  }
};

var GRADE_LIST = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];

// 校验知识点是否在白名单中
function isKnowledgeValid(grade, subject, knowledgePoint) {
  var gradeKnowledge = GRADE_KNOWLEDGE_MAP[grade];
  if (!gradeKnowledge) return false;
  var allowed = gradeKnowledge[subject] || [];
  if (allowed.length === 0) return true;
  // 精确匹配，避免"分数"误匹配"百分数"
  for (var i = 0; i < allowed.length; i++) {
    if (knowledgePoint === allowed[i]) return true;
    // 允许知识点包含白名单项作为子串（如"小学-分数"包含"分数"），但不是反向
  }
  return false;
}

// 各年级超纲词汇过滤表
var FORBIDDEN_WORDS = {
  '一年级': ['方程', '小数', '分数', '负数', '百分数', '比例', '圆柱', '圆锥', '体积'],
  '二年级': ['分数', '小数', '百分数', '比例', '圆柱', '圆锥', '方程', '负数'],
  '三年级': ['小数乘法', '简易方程', '百分数', '比例', '圆柱', '勾股定理', '概率'],
  '四年级': ['分数乘除法', '百分数', '比例', '圆柱', '圆锥', '负数', '方程'],
  '五年级': ['百分数', '比例', '圆柱', '圆锥', '负数', '三角函数'],
  '六年级': ['三角函数', '勾股定理', '向量', '概率树', '二次方程']
};

function getForbiddenWords(grade) {
  return FORBIDDEN_WORDS[grade] || [];
}

// 各学科题型格式约束配置
function getSubjectFormats(subject) {
  var formats = {
    '数学': {
      minOptions: 4,           // 选择题最少选项数
      requireExplanation: true, // 应用题需解析
      answerType: 'numeric',   // 答案类型偏好
      maxAnswerLen: 50         // 答案最大字符数
    },
    '语文': {
      minOptions: 4,
      requireExplanation: false,
      answerType: 'text',
      maxAnswerLen: 200
    },
    '英语': {
      minOptions: 4,
      requireExplanation: false,
      answerType: 'text',
      maxAnswerLen: 100
    }
  };
  return formats[subject] || { minOptions: 4, requireExplanation: false, answerType: 'text', maxAnswerLen: 100 };
}

// 根据学科校验答案合理性
function validateAnswerBySubject(subject, content, answer) {
  // 非数学学科不做答案内容校验（语文/英语答案形式多样）
  if (subject !== '数学') return { valid: true, reason: 'OK' };
  if (answer === undefined || answer === null) return { valid: true, reason: 'OK' };
  var answerStr = typeof answer === 'string' ? answer : String(answer);
  answerStr = answerStr.trim();
  if (answerStr.length === 0) return { valid: true, reason: 'OK' };
  if (answerStr.length > 200) return { valid: false, reason: '答案过长' };
  var numAnswer = parseFloat(answerStr);
  if (!isNaN(numAnswer)) {
    if (numAnswer < -99999 || numAnswer > 99999) return { valid: false, reason: '数学答案数值超出合理范围' };
  }
  // 若题干含等式，检测答案是否匹配（简单代入验算）
  if (content && (content.indexOf('=') !== -1 || content.indexOf('?') !== -1)) {
      var parts = content.split(/[=？?]/);
      if (parts.length >= 2 && !isNaN(numAnswer)) {
        try {
          var match = content.match(/[\d\+\-\*\/\(\)]+/);
          if (match) {
            var expr = match[0].replace(/[?？]/g, answer);
            var result = safeEval(expr);
            var expected = parseFloat(answer);
            if (!isNaN(result) && !isNaN(expected) && Math.abs(result - expected) > 0.01) {
              return { valid: false, reason: '答案验算不通过' };
            }
          }
        } catch (e) {
          // 验算失败不阻断，仅做辅助判断
        }
      }
    }
  return { valid: true, reason: 'OK' };
}

/**
 * 安全数学表达式求值（替代 eval，仅支持 + - * / 和括号）
 * @param {string} expr - 数学表达式
 * @returns {number|null} 计算结果
 */
function safeEval(expr) {
  // 白名单校验：只允许数字、运算符、括号、空格和小数点
  if (/[^0-9+\-*/().\s]/.test(expr)) return null;
  // 移除空白
  expr = expr.replace(/\s+/g, '');
  if (!expr) return null;
  // 递归下降求值
  var pos = 0;

  function parseExpression() {
    var left = parseTerm();
    while (pos < expr.length) {
      var ch = expr[pos];
      if (ch === '+') {
        pos++;
        left += parseTerm();
      } else if (ch === '-') {
        pos++;
        left -= parseTerm();
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm() {
    var left = parseFactor();
    while (pos < expr.length) {
      var ch = expr[pos];
      if (ch === '*') {
        pos++;
        left *= parseFactor();
      } else if (ch === '/') {
        pos++;
        var divisor = parseFactor();
        if (divisor === 0) return NaN;
        left /= divisor;
      } else {
        break;
      }
    }
    return left;
  }

  function parseFactor() {
    if (pos >= expr.length) return 0;
    var ch = expr[pos];
    if (ch === '(') {
      pos++;
      var val = parseExpression();
      if (pos < expr.length && expr[pos] === ')') pos++;
      return val;
    }
    if (ch === '-') {
      pos++;
      return -parseFactor();
    }
    // 解析数字
    var start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) {
      pos++;
    }
    var numStr = expr.slice(start, pos);
    if (numStr === '') return 0;
    var num = parseFloat(numStr);
    return isNaN(num) ? 0 : num;
  }

  var result = parseExpression();
  return isNaN(result) || !isFinite(result) ? null : result;
}

module.exports = {
  GRADE_LIST: GRADE_LIST,
  GRADE_KNOWLEDGE_MAP: GRADE_KNOWLEDGE_MAP,
  isKnowledgeValid: isKnowledgeValid,
  getForbiddenWords: getForbiddenWords,
  getSubjectFormats: getSubjectFormats,
  validateAnswerBySubject: validateAnswerBySubject
};
