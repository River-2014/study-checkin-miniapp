---
name: cloud-func-helper
description: >
  微信云开发云函数开发辅助。涵盖云函数创建/修改规范、数据库操作模式、
  聚合查询、AI API 调用、环境变量配置、错误处理模式等。
  适用于创建新云函数、修改现有云函数、调试云函数问题。
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# cloud-func-helper - 云函数开发辅助

## 项目背景

此 Skill 为「小升初冲刺打卡」微信小程序定制，项目有 28 个云函数。

- **云环境 ID**: `cloud1-d8geyz0ynb367e0bf`
- **SDK**: `wx-server-sdk`
- **数据库**: 微信云开发文档型数据库（MongoDB 兼容）
- **AI API**: DeepSeek（通过环境变量配置 `AI_API_KEY`）

## 云函数标准模板

创建新云函数时使用以下模板：

```javascript
/**
 * {云函数名称} 云函数
 * {功能描述}
 *
 * 入参: { param1, param2 }
 * 返回: { success: true/false, data/error }
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;  // 如需聚合操作

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  // 1. 参数校验
  if (!event.requiredParam) {
    return { success: false, error: { code: 'MISSING_PARAM', message: '缺少必要参数' } };
  }

  // 2. 业务逻辑
  try {
    // ... 数据库操作 ...

    return { success: true, data: { /* ... */ } };
  } catch (e) {
    return { success: false, error: { code: 'INTERNAL', message: e.message } };
  }
};
```

## 统一返回格式

所有云函数必须遵循统一的返回格式：

```javascript
// 成功
{ success: true, data: { ... } }

// 业务错误（可预期的）
{ success: false, error: { code: 'ERROR_CODE', message: '人类可读的错误描述' } }

// 系统错误（不可预期的）
{ success: false, error: { code: 'INTERNAL', message: e.message } }
```

## 现有错误码规范

| 错误码 | 含义 | 使用场景 |
|--------|------|----------|
| `AUTH_FAIL` | 身份验证失败 | OPENID 为空 |
| `MISSING_PARAM` | 缺少必要参数 | 参数校验失败 |
| `INVALID_CODE` | 邀请码格式不正确 | familyBind |
| `CODE_EXPIRED` | 邀请码已过期 | familyBind |
| `ALREADY_BOUND` | 已绑定其他家庭 | familyBind |
| `NO_API_KEY` | AI API Key 未配置 | ai-report |
| `API_ERROR` | AI 接口返回错误 | ai-report |
| `REQ_ERROR` | 请求异常 | ai-report |
| `DB_ERR` | 数据库操作失败 | userLogin |
| `NOT_FOUND` | 资源不存在 | 通用 |
| `PERMISSION_DENIED` | 权限不足 | authAdmin |
| `INTERNAL` | 内部错误 | 通用 catch |

## 数据库操作模式

### 1. 单文档查询

```javascript
const result = await db.collection('collection_name')
  .where({ field: value })
  .get();

if (result.data && result.data.length > 0) {
  const doc = result.data[0];
  // ...
}
```

### 2. 新增文档

```javascript
const addResult = await db.collection('collection_name').add({
  data: {
    _openid: OPENID,           // 必须设置，用于权限控制
    field1: value1,
    createdAt: db.serverDate()  // 服务端时间
  }
});
// addResult._id 为新文档 ID
```

### 3. 更新文档

```javascript
await db.collection('collection_name').doc(docId).update({
  data: {
    field: newValue,
    updatedAt: db.serverDate()
  }
});
```

### 4. 自增/原子操作

```javascript
// 使用 db.command.inc 进行原子自增
await db.collection('collection_name').doc(docId).update({
  data: {
    count: db.command.inc(1),       // +1
    score: db.command.inc(-5)       // -5
  }
});
```

### 5. 聚合查询

```javascript
const result = await db.collection('collection_name')
  .aggregate()
  .match({ condition: value })       // 过滤
  .group({ _id: '$field', total: _.sum('$count') })  // 分组聚合
  .sort({ total: -1 })               // 排序
  .limit(10)                         // 限制
  .end();

const list = result.list || [];
```

### 6. 分页查询

```javascript
const page = event.page || 1;
const pageSize = event.pageSize || 20;
const skip = (page - 1) * pageSize;

const result = await db.collection('collection_name')
  .where({ condition: value })
  .skip(skip)
  .limit(pageSize)
  .orderBy('createdAt', 'desc')
  .get();

return {
  success: true,
  data: {
    list: result.data,
    page: page,
    pageSize: pageSize,
    hasMore: result.data.length === pageSize
  }
};
```

## AI API 调用模式（ai-report）

ai-report 云函数支持两种模式：

### advice 模式 - AI 学习建议

```javascript
// 前端调用
wx.cloud.callFunction({
  name: 'ai-report',
  data: {
    mode: 'advice',  // 默认模式，可省略
    dailyRates: [80, 60, 100, ...],  // 近7天完成率数组
    subjects: '数学、英语',
    streak: 7,
    stars: 150
  }
});
```

### chat 模式 - AI 对话代理

```javascript
// 前端调用（用于 ai-exam 页面 AI 出题）
wx.cloud.callFunction({
  name: 'ai-report',
  data: {
    mode: 'chat',
    messages: [
      { role: 'system', content: '你是一位小学数学老师...' },
      { role: 'user', content: '请出5道小数乘除法题目' }
    ],
    temperature: 0.7,
    max_tokens: 2000
  }
});
```

### 添加新的 AI 模型支持

在 ai-report 的 `main` 函数中，响应解析部分已兼容：
- OpenAI 格式: `response.choices[0].message.content`
- 文心一言格式: `response.result`
- 通用格式: `response.output.text`

添加新模型时，在此处追加对应格式即可。

## 数据库集合清单

| 集合名 | 说明 | 关键字段 |
|--------|------|----------|
| `users` | 用户表 | _openid, role(parent/child), nickname, children[], parentOpenid |
| `invitations` | 邀请码表 | code, parentOpenid, expireTime, isUsed |
| `exam_questions` | 题库表 | stem, subject, grade, type, difficulty, answer, isLatest |
| `exam_practice_records` | 练习记录 | _openid, mode, subject, answers[], correctCount, totalCount |
| `exam_papers` | 试卷表 | subject, grade, questions[], totalScore |
| `daily_stats` | 预聚合统计 | type, period, date, data |
| `admin_logs` | 管理员操作日志 | action, operator, target, timestamp |
| `mistakes` | 错题本 | _openid, questionId, subject, userAnswer, imageBase64 |

## 环境变量配置

需要在云函数「版本与配置 → 环境变量」中设置：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `AI_API_KEY` | AI API 密钥 | `sk-xxxxxxxx` |
| `AI_API_URL` | AI API 端点 | `https://api.deepseek.com/chat/completions` |
| `AI_MODEL` | AI 模型名称 | `deepseek-chat` |

## 常见开发任务

### 创建新云函数

1. 在 `miniprogram/cloudfunctions/` 下创建目录
2. 创建 `index.js`（使用标准模板）
3. 创建 `package.json`（如需 npm 依赖）
4. 在微信开发者工具中右键云函数 → 上传并部署

### 调试云函数

1. 在云函数中添加 `console.log()` 打印关键变量
2. 在微信开发者工具「云开发控制台 → 云函数 → 日志」查看
3. 使用云函数本地调试功能（Node.js 环境）

### 添加 npm 依赖

```json
// package.json
{
  "name": "cloudFunctionName",
  "version": "1.0.0",
  "dependencies": {
    "wx-server-sdk": "latest"
  }
}
```

然后在云函数目录执行 `npm install`，再上传部署。

## 注意事项

1. **权限控制**: 所有涉及用户数据的操作都要通过 `_openid` 过滤，确保用户只能操作自己的数据
2. **集合权限**: 云开发控制台中，集合权限默认「仅创建者可读写」，需要根据业务调整
3. **超时设置**: 云函数默认超时 3 秒，涉及 AI 调用需在云函数配置中调大到 20 秒
4. **冷启动**: 云函数首次调用有冷启动延迟，高频调用的函数建议设置最小实例数
5. **错误日志**: catch 中应 `console.error(e)` 以便在日志中追踪
6. **数据校验**: 永远不要信任前端传来的数据，必须在云函数中二次校验
