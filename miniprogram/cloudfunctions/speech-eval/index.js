/**
 * 口语评测云函数
 * 接收录音临时文件路径 + 参考文本
 * 实际使用需对接腾讯云 ASR 语音识别服务
 * 当前返回模拟评分结果，方便前端联调
 */
const cloud = require('wx-server-sdk');
cloud.init();

exports.main = async (event) => {
  var audioPath = event.audioPath;
  var referenceText = event.referenceText || '';

  if (!referenceText) {
    return { success: false, message: '缺少参考文本' };
  }

  // 模拟评分结果（实际应调用 ASR + 评分算法）
  // 接入真实 ASR 后替换此段逻辑
  var wordCount = referenceText.replace(/\s/g, '').length;
  var baseScore = Math.min(Math.max(75 + Math.floor(Math.random() * 20), 60), 98);
  var suggestions = [];

  if (baseScore >= 90) {
    suggestions = ['发音非常清晰', '语速适中', '继续保持！'];
  } else if (baseScore >= 75) {
    suggestions = ['部分发音可更清晰', '注意连读和重音', '建议多听原声模仿'];
  } else {
    suggestions = ['发音需加强练习', '建议逐句跟读', '注意元音的发音位置'];
  }

  return {
    success: true,
    score: baseScore,
    suggestion: suggestions.join('；'),
    detail: {
      accuracy: Math.max(50, baseScore - 10 + Math.floor(Math.random() * 10)),
      fluency: Math.max(50, baseScore - 5 + Math.floor(Math.random() * 10)),
      pronunciation: Math.max(50, baseScore + Math.floor(Math.random() * 10 - 5))
    },
    recognizedText: referenceText // 实际应返回 ASR 识别结果
  };
};
