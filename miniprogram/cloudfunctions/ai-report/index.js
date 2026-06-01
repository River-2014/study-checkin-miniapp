/**
 * AI 学习建议云函数
 * 直接通过 https 调用 OpenAI 兼容接口（文心一言/DeepSeek/通义千问等）
 *
 * 环境变量配置（云函数→版本与配置→环境变量）：
 *   AI_API_KEY  - API 密钥
 *   AI_API_URL  - API 端点（默认 OpenAI 官方）
 *   AI_MODEL    - 模型名称（默认 gpt-3.5-turbo）
 */
const cloud = require('wx-server-sdk');
cloud.init();
const https = require('https');
const http = require('http');
const { URL } = require('url');

// AI API 配置（通过云函数环境变量注入）
const API_KEY = process.env.AI_API_KEY || '';
const API_URL = process.env.AI_API_URL || 'https://api.deepseek.com/chat/completions';
const API_MODEL = process.env.AI_MODEL || 'deepseek-chat';

/**
 * 发送 HTTPS/HTTP 请求
 */
function request(url, options, payload) {
  return new Promise(function (resolve, reject) {
    var parsedUrl = new URL(url);
    var mod = parsedUrl.protocol === 'https:' ? https : http;
    var reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'POST',
      headers: options.headers || {},
      timeout: 30000
    };

    var req = mod.request(reqOptions, function (res) {
      var body = '';
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject({ message: '响应解析失败', raw: body.slice(0, 500) });
        }
      });
    });

    req.on('error', function (err) {
      reject({ message: '请求失败: ' + err.message });
    });
    req.on('timeout', function () {
      req.destroy();
      reject({ message: '请求超时' });
    });

    if (payload) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

exports.main = async (event) => {
  // ===== chat 模式：AI 出题/通用对话代理（供 ai-exam 页面使用） =====
  if (event.mode === 'chat') {
    if (!API_KEY) {
      return { success: false, error: { code: 'NO_API_KEY', message: 'AI 未配置，请在云函数环境变量中设置 AI_API_KEY' } };
    }
    try {
      var targetUrl = event.url || API_URL;
      var response = await request(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + API_KEY
        }
      }, {
        model: event.model || API_MODEL,
        messages: event.messages || [],
        temperature: event.temperature || 0.7,
        max_tokens: event.max_tokens || 2000,
        stream: false
      });

      if (response.error) {
        return {
          success: false,
          error: { code: 'API_ERROR', message: response.error.message || 'AI 接口返回错误' }
        };
      }

      return { success: true, data: response };
    } catch (e) {
      return { success: false, error: { code: 'REQ_ERROR', message: e.message || '请求异常' } };
    }
  }

  // ===== advice 模式（默认）：AI 学习建议 =====
  const { dailyRates, subjects, streak, stars } = event;

  if (!API_KEY) {
    return {
      success: false,
      msg: 'AI 未配置：请在云函数环境变量中设置 AI_API_KEY',
      fallback: getFallbackAdvice(subjects, streak)
    };
  }

  const prompt = '你是一位资深小学教师，正在辅导一名即将小升初的学生。请根据以下数据，用亲切鼓励的语气给出学习建议（100字以内）。\n' +
    '数据：近7天打卡完成率为 ' + JSON.stringify(dailyRates) + '，错题集中在 ' + (subjects || '无') + '，连续打卡 ' + (streak || 0) + ' 天，获得星星 ' + (stars || 0) + ' 颗。\n' +
    '建议方向：指出做得好的地方，并针对薄弱学科提出具体改进方法。';

  try {
    var response = await request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      }
    }, {
      model: API_MODEL,
      messages: [
        { role: 'system', content: '你是一位资深小学教师，请用亲切鼓励的语气回答，控制在100字以内。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.8
    });

    // 兼容 OpenAI 格式和部分国产模型格式
    var content = '';
    if (response.choices && response.choices[0]) {
      content = response.choices[0].message.content || '';
    } else if (response.result) {
      // 文心一言格式
      content = response.result;
    } else if (response.output && response.output.text) {
      // 部分国产模型格式
      content = response.output.text;
    }

    if (content && content.trim()) {
      return { success: true, advice: content.trim() };
    }

    return {
      success: false,
      msg: 'AI 返回内容为空',
      fallback: getFallbackAdvice(subjects, streak)
    };
  } catch (e) {
    return {
      success: false,
      msg: e.message || 'AI 请求失败',
      fallback: getFallbackAdvice(subjects, streak)
    };
  }
};

/** 离线兜底建议 */
function getFallbackAdvice(subjects, streak) {
  var tips = [
    '坚持就是胜利！每天进步一点点，小升初必胜！',
    '你已经连续打卡 ' + (streak || 0) + ' 天，太棒了！继续保持哦！',
    '学习是一个积累的过程，今天的努力会在明天开花结果。',
    subjects ? '建议多花时间在 ' + subjects + ' 上，查漏补缺会进步更快。' : '',
    '你已经做得很好了！记得劳逸结合，保持好状态。'
  ];
  return tips.filter(Boolean).join(' ');
}
