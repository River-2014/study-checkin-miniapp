/**
 * 本地题库练习共享工具
 * 提供判卷、正确答案索引解析等共用逻辑
 */
var knowledgeBase = require('./knowledgeBase');

module.exports = {
  /**
   * 判卷：判断用户答案是否正确
   * @param {string} userAnswer 用户答案
   * @param {object} question 题目对象，需包含 answer、options、type
   * @returns {boolean}
   */
  isCorrect: function(userAnswer, question) {
    if (!question || !userAnswer) return false;
    if (typeof userAnswer !== 'string') return false;
    var ua = userAnswer.trim();
    var ca = typeof question.answer === 'string' ? question.answer.trim() : '';

    // 0. 填空题多空支持：answer 用 || 分隔，用户答对任一空即判对
    var type = (question.type || '').toString();
    if (type === '填空题' || type === 'fill') {
      if (!ua) return false;
      var standards = ca.split('||').map(function(s) { return s.trim().toLowerCase(); });
      var user = ua.toLowerCase();
      return standards.some(function(std) { return std === user; });
    }

    // 1. 精确匹配
    if (ua === ca) return true;
    // 忽略大小写
    if (ua.toLowerCase() === ca.toLowerCase()) return true;

    // 2. 选择题：按选项索引匹配
    if (question.options && question.options.length > 0) {
      var labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      var correctIdx = -1;
      for (var ci = 0; ci < question.options.length && ci < labels.length; ci++) {
        var optStr = typeof question.options[ci] === 'string' ? question.options[ci] : '';
        if (ca === labels[ci] || (optStr && ca && optStr.trim().toLowerCase() === ca.trim().toLowerCase())) {
          correctIdx = ci;
          break;
        }
      }
      var userIdx = -1;
      for (var ui = 0; ui < question.options.length && ui < labels.length; ui++) {
        var optStr = typeof question.options[ui] === 'string' ? question.options[ui] : '';
        if (ua === labels[ui] || (optStr && optStr.indexOf(ua) !== -1) || (ua && ua.indexOf(optStr) !== -1)) {
          userIdx = ui;
          break;
        }
      }
      if (correctIdx >= 0 && correctIdx === userIdx) return true;
    }

    // 3. 判断题额外处理（√/× 与 正确/错误 互认）
    if (ca === '√' || ca === '正确') { return ua === '√' || ua === '正确' || ua.toLowerCase() === 'true'; }
    if (ca === '×' || ca === '错误') { return ua === '×' || ua === '错误' || ua.toLowerCase() === 'false'; }

    return false;
  },

  /**
   * 解析正确答案对应的选项索引（用于渲染绿色高亮）
   * @param {object} question 题目对象
   * @returns {number} 正确选项的索引，-1 表示无法确定
   */
  resolveCorrectOption: function(question) {
    if (!question || !question.options || question.options.length === 0) return -1;
    var ca = typeof question.answer === 'string' ? question.answer.trim() : '';
    var labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (var i = 0; i < question.options.length && i < labels.length; i++) {
      var optStr = typeof question.options[i] === 'string' ? question.options[i] : '';
      if (ca === labels[i] || (optStr && optStr.indexOf(ca) !== -1) || (ca && ca.indexOf(optStr) !== -1)) {
        return i;
      }
    }
    return -1;
  },

  /**
   * 根据学科和年级获取可选知识点列表
   */
  getKnowledgePoints: function(subject, grade) {
    var map = knowledgeBase.GRADE_KNOWLEDGE_MAP;
    if (!map || !map[grade] || !map[grade][subject]) return [];
    return map[grade][subject].map(function(kp) { return { key: kp, name: kp }; });
  },

  /**
   * 题目类型列表
   */
  PRACTICE_TYPES: ['选择题', '填空题', '判断题', '简答题'],

  /**
   * 难度列表
   */
  DIFFICULTIES: ['基础巩固', '能力提升', '冲刺拔高'],

  /**
   * 学科列表
   */
  SUBJECTS: ['数学', '语文', '英语'],

  /**
   * 年级列表
   */
  GRADE_LIST: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级']
};
