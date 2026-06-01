/**
 * 腾讯云 TTS 语音合成云函数
 * 使用原生 https 请求 + TC3-HMAC-SHA256 签名
 *
 * 环境变量配置（云函数→版本与配置→环境变量）：
 *   TENCENT_SECRET_ID  - 腾讯云 SecretId
 *   TENCENT_SECRET_KEY - 腾讯云 SecretKey
 */

const SECRET_ID = (process.env.TENCENT_SECRET_ID || '').trim();
const SECRET_KEY = (process.env.TENCENT_SECRET_KEY || '').trim();

const crypto = require('crypto');
const https = require('https');

/**
 * TC3-HMAC-SHA256 签名
 */
function sign(secretKey, date, timestamp, serviceName, signedHeaders, canonicalRequest) {
  var algorithm = 'TC3-HMAC-SHA256';
  var credentialScope = date + '/' + serviceName + '/tc3_request';
  var hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  var stringToSign = algorithm + '\n' + timestamp + '\n' + credentialScope + '\n' + hashedCanonicalRequest;

  var secretDate = crypto.createHmac('sha256', 'TC3' + secretKey).update(date).digest();
  var secretService = crypto.createHmac('sha256', secretDate).update(serviceName).digest();
  var secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  var signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return algorithm + ' Credential=' + SECRET_ID + '/' + credentialScope
    + ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
}

exports.main = async (event) => {
  var text = event.text || '';

  if (!text) {
    return { success: false, message: '缺少文本参数' };
  }

  // 密钥未配置时直接返回友好提示
  if (!SECRET_ID || !SECRET_KEY) {
    return {
      success: false,
      message: 'TTS 未配置：请在云函数环境变量中设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY',
      code: 'NO_CREDENTIALS'
    };
  }

  var voiceType = event.voiceType || 101001;
  var speed = event.speed !== undefined ? event.speed : 0;
  var volume = event.volume !== undefined ? event.volume : 2;
  var codec = event.codec || 'mp3';

  // 截断前 500 字符
  text = text.slice(0, 500);

  var serviceName = 'tts';
  var action = 'TextToVoice';
  var version = '2019-08-23';
  var region = 'ap-guangzhou';
  var timestamp = Math.floor(Date.now() / 1000);
  var date = new Date(timestamp * 1000).toISOString().slice(0, 10); // YYYY-MM-DD

  var payload = JSON.stringify({
    Text: text,
    SessionId: timestamp + '_' + Math.random().toString(36).slice(2, 8),
    VoiceType: voiceType,
    Speed: speed,
    Volume: volume,
    Codec: codec,
    SampleRate: 16000
  });

  var headers = {
    'Content-Type': 'application/json',
    'Host': 'tts.tencentcloudapi.com',
    'X-TC-Action': action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': version,
    'X-TC-Region': region,
  };

  // 构建 canonical request
  var signedHeaders = 'content-type;host';
  var canonicalRequest = 'POST\n/\n\n'
    + 'content-type:' + headers['Content-Type'] + '\n'
    + 'host:' + headers['Host'] + '\n\n'
    + signedHeaders + '\n'
    + crypto.createHash('sha256').update(payload).digest('hex');

  var authorization = sign(SECRET_KEY, date, timestamp, serviceName, signedHeaders, canonicalRequest);
  headers['Authorization'] = authorization;

  console.log('Timestamp:', timestamp, 'Date:', date);
  console.log('Payload:', payload);
  console.log('CanonicalRequest:', canonicalRequest.replace(/\n/g, '\\n'));
  console.log('Authorization:', authorization);

  return new Promise(function(resolve) {
    var options = {
      hostname: 'tts.tencentcloudapi.com',
      port: 443,
      path: '/',
      method: 'POST',
      headers: headers
    };

    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var result = JSON.parse(body);
          if (result.Response && result.Response.Audio) {
            resolve({
              success: true,
              audio: result.Response.Audio,
              sessionId: result.Response.SessionId
            });
          } else if (result.Response && result.Response.Error) {
            resolve({
              success: false,
              message: '[' + result.Response.Error.Code + '] ' + result.Response.Error.Message,
              code: result.Response.Error.Code,
              raw: body.slice(0, 500)
            });
          } else {
            resolve({
              success: false,
              message: '腾讯云返回格式异常',
              raw: body.slice(0, 500)
            });
          }
        } catch (e) {
          resolve({
            success: false,
            message: '返回数据解析失败',
            raw: body.slice(0, 500)
          });
        }
      });
    });

    req.on('error', function(err) {
      resolve({ success: false, message: '请求异常: ' + err.message });
    });

    req.write(payload);
    req.end();
  });
};
