/**
 * aiAutoTag 云函数
 *
 * 对未打标签的题目自动生成难度和知识点。调用 AI API + antiHallucination 校验。
 *
 * 入参: { subject?, grade?, limit? }  — 筛选待处理题目
 * 环境变量: AI_API_KEY, AI_API_URL, AI_MODEL（复用 ai-report 配置）
 */
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
var db = cloud.database();
var _ = db.command;
var https = require('https');
var http = require('http');
var crypto = require('crypto');

var COLL = 'exam_questions';
var AI_TIMEOUT = 20000;

// 知识点白名单（简短版，完整版在 knowledgeBase.js）
var KNOWLEDGE_WHITELIST = {
  '数学': ['20以内加减法','100以内数的认识','乘法口诀','除法初步','长度单位','混合运算',
    '万以内加减法','多位数乘一位数','分数初步','周长计算','面积计算','体积计算',
    '小数运算','简易方程','多边形面积','因数与倍数','分数乘除法','百分数','圆柱与圆锥','比例',
    '负数','鸡兔同笼','几何图形','认识钟表','位置与顺序','统计','单位换算','行程问题','工程问题'],
  '语文': ['拼音认读','汉字书写','看图说话','朗读训练','部首查字法','日记写作','造句练习',
    '概括段落大意','写景作文','寓言故事','字词辨析','修辞手法','写人记事作文','古诗背诵',
    '阅读理解','说明文阅读','读后感写作','文言文入门','小说阅读','议论文写作','古诗词鉴赏'],
  '英语': ['字母认读','简单单词','日常问候语','颜色词汇','简单句型','简短对话','字母发音',
    '一般现在时','日常交际用语','简单阅读','名词单复数','现在进行时','形容词比较级',
    '一般疑问句','一般过去时','复合句','完形填空','听力理解','书面表达']
};

// ====== AI 调用 ======
function callAI(prompt, apiKey, apiUrl, model) {
  return new Promise(function(resolve, reject) {
    var url = new (require('url')).URL(apiUrl);
    var data = JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300
    });

    var options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: AI_TIMEOUT
    };

    var req = (url.protocol === 'https:' ? https : http).request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var json = JSON.parse(body);
          var content = (json.choices && json.choices[0] && json.choices[0].message.content) || '';
          resolve(content);
        } catch(e) {
          reject(new Error('AI响应解析失败'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('AI请求超时')); });
    req.write(data);
    req.end();
  });
}

// ====== 校验 AI 结果 ======
function validateTagResult(result, subject) {
  try {
    // 解析 JSON
    var jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { valid: false, reason: '未找到JSON' };
    var parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.difficulty) return { valid: false, reason: '缺少 difficulty' };
    if (!parsed.knowledgePoints || !Array.isArray(parsed.knowledgePoints)) {
      return { valid: false, reason: '缺少 knowledgePoints 数组' };
    }

    // 难度校验
    var validDiffs = ['简单', '中等', '困难'];
    if (validDiffs.indexOf(parsed.difficulty) < 0) {
      return { valid: false, reason: '无效难度: ' + parsed.difficulty };
    }

    // 知识点白名单校验
    var whitelist = KNOWLEDGE_WHITELIST[subject] || [];
    var validKps = parsed.knowledgePoints.filter(function(kp) {
      return whitelist.indexOf(kp) >= 0;
    }).slice(0, 3);

    if (validKps.length === 0) {
      return { valid: false, reason: '知识点不在白名单内', raw: parsed };
    }

    return {
      valid: true,
      difficulty: parsed.difficulty,
      knowledgePoints: validKps
    };
  } catch (e) {
    return { valid: false, reason: 'JSON解析错误: ' + e.message };
  }
}

// ====== 主入口 ======
exports.main = async function(event) {
  var start = Date.now();
  var subject = event.subject || '';
  var grade = event.grade || '';
  var limit = Math.min(event.limit || 50, 50);

  // 读取环境变量
  var apiKey = process.env.AI_API_KEY || '';
  var apiUrl = process.env.AI_API_URL || '';
  var aiModel = process.env.AI_MODEL || 'deepseek-chat';

  if (!apiKey || !apiUrl) {
    return { success: false, error: 'AI_API_KEY 或 AI_API_URL 环境变量未配置' };
  }

  try {
    // 查询待标注题目
    var where = { isLatest: true };
    if (subject) where.subject = subject;
    if (grade) where.grade = grade;
    where.knowledgePoints = _.or([_.eq([]), _.exists(false)]);

    var res = await db.collection(COLL)
      .where(where)
      .limit(limit)
      .get();

    var questions = res.data || [];
    if (questions.length === 0) {
      return { success: true, total: 0, tagged: 0, message: '没有需要标注的题目' };
    }

    var tagged = 0;
    var failed = 0;
    var needReview = 0;

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var subj = q.subject || subject;

      // 构建提示词
      var whitelist = (KNOWLEDGE_WHITELIST[subj] || []).join('、');
      var prompt = '你是小升初' + subj + '的题目标注专家。为以下题目给出：\n' +
        '1. 难度：简单/中等/困难\n' +
        '2. 知识点：最多3个（需在白名单内：' + whitelist + '）\n\n' +
        '题目：' + (q.stem || '').substring(0, 300) + '\n' +
        '选项：' + (q.options || []).join(' | ') + '\n' +
        '答案：' + (q.answer || '') + '\n\n' +
        '输出纯JSON（不要markdown代码块）：{"difficulty":"中等","knowledgePoints":["知识点1","知识点2"]}';

      try {
        var aiResult = await callAI(prompt, apiKey, apiUrl, aiModel);
        var validated = validateTagResult(aiResult, subj);

        if (validated.valid) {
          await db.collection(COLL).doc(q._id).update({
            data: {
              difficulty: validated.difficulty,
              knowledgePoints: validated.knowledgePoints,
              updatedAt: db.serverDate()
            }
          });
          tagged++;
        } else {
          await db.collection(COLL).doc(q._id).update({
            data: {
              aiSuggestion: { raw: aiResult, reason: validated.reason, parsed: validated.raw || {} },
              needManualReview: true,
              updatedAt: db.serverDate()
            }
          });
          needReview++;
        }
      } catch (e) {
        failed++;
        // 单条失败不中断
      }
    }

    return {
      success: true,
      total: questions.length,
      tagged: tagged,
      needManualReview: needReview,
      failed: failed,
      elapsedMs: Date.now() - start
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
};
