# 小升初冲刺打卡小程序 · 上线准备分析报告

**日期**：2026-06-02  
**类型**：上线准备 / 质量审查  
**参与成员**：方向明（主理人）全量代码扫描分析  
**审查范围**：miniprogram/ 目录下所有核心页面及工具文件

---

## 📌 TL;DR（执行摘要）

- **当前状态**：P0 100% + P1 80%完成，P2首批3项交付，整体完成度较高，可进入上线预备阶段
- **核心风险**：3项"立即修复"问题（调试按钮暴露 / `validateStreak` 未接入 / 家长密码重置提示明文）+ 6项上线前建议改进项
- **硬性卡点**：「加星测试（+50⭐）」按钮在正式版 mine.wxml 中对用户可见，**必须在上线前移除**
- **中风险**：PK赛未明确告知"虚拟对手"、积分通胀路径未闭合、周报无触达机制
- **下一步**：按优先级处理下方「行动清单」，预估 1.5-2天完成全部必修项

---

## 🎯 核心结论卡片

| 项目 | 内容 |
|------|------|
| 推荐方案 | 分两批修：P0紧急项（1天内）→ P1完善项（3天内）→ 上线 |
| 优先级 | P0：3项 / P1：5项 / P2：4项建议 |
| 预期影响 | P0修复后可消除明显用户体验缺陷和舆情风险 |
| 资源需求 | 1名前端开发，约1.5天 |
| 风险等级 | 中（无严重安全漏洞，主要是体验与合规层面） |

---

## 🔴 P0：上线必修项（必须修复，否则不建议上线）

### P0-1 「加星测试」调试按钮暴露给用户

**位置**：`miniprogram/pages/mine/mine.wxml` 第193-196行  
**问题**：`⭐ 加星测试（+50⭐）` 按钮完全对普通用户可见，标注"开发模式·仅用于测试"，但没有任何条件控制，任意用户均可点击无限刷积分。  
**影响**：积分体系被破坏，奖励兑换商城丧失意义，家长信任度归零。  
**修复方案**：  
- 方案A（推荐）：直接删除该按钮及其 `<view class="dev-hint">` 文字节点  
- 方案B：改为仅在 `wx.getSystemInfoSync().platform === 'devtools'` 时显示

```diff
- <button ... bindtap="onAddStarsTest">⭐ 加星测试（+50⭐）</button>
- <text class="dev-hint">开发模式 · 仅用于测试</text>
```

---

### P0-2 `validateStreak` 未被首页调用 → 连击天数可能不准确

**位置**：`miniprogram/utils/storage.js` 第421行 已定义，但首页 `home.js`、`app.js` 中均**未调用**  
**问题**：`validateStreak` 负责跨天校验火焰状态（重置断签、触发积分衰减），若不在每次进入首页时调用，用户昨天没打卡但今天连击数不会自动归零，积分衰减也不触发。  
**影响**：数据失真，北极星指标 DECR 计算偏高，用户看到的连续打卡天数可能是错的。  
**修复方案**：在 `home.js` 的 `loadData()` 函数开头添加调用：

```javascript
// home.js loadData() 开头
loadData() {
  storage.validateStreak();  // ← 补充此行
  const data = storage.getAppData();
  // ... 其余逻辑
}
```

---

### P0-3 家长密码重置文案暴露默认值"1234"

**位置**：`miniprogram/subpkg-user/pages/password/password.js` 第67-71行  
**问题**：`onForgot` 函数弹窗内容明确写"重置密码将恢复为默认密码 1234"，且 `changePassword('1234')` 后提示"已重置为 1234"。默认密码以明文形式展示在 UI 上，任何使用该小程序的孩子看到这段文字就能绕过家长锁。  
**影响**：家长控制台形同虚设，安全感归零。  
**修复方案**：  
- 弹窗改为"重置后需要重新设置密码"，不暴露默认值
- 重置后强制跳转到修改密码页而非停留在密码输入页
- 或者去掉"忘记密码"功能，改为"请联系应用开发者重置"

---

## 🟡 P1：上线前完善项（强烈建议修复）

### P1-1 PK赛未告知"虚拟对手"

**位置**：`miniprogram/subpkg-learn/pages/pk/pk.js`  
**问题**：对手分数含随机数生成（`opponentScore += Math.floor(Math.random() * ...)`），但页面 UI 上无任何提示说明这是虚拟对战，用户极易误以为在与真实同学 PK。  
**影响**：口碑风险。一旦用户发现"对手"是假的，负面评价不可控。  
**修复方案**：在 PK 结果页和开始页各加一行小字：「当前为单机练习模式，虚拟对手根据全国同年级平均数据生成」

---

### P1-2 `donateToCharity` 积分不足时直接 return，无提示兜底

**位置**：`miniprogram/utils/storage.js` 第654行  
**问题**：积分不足时返回 `{ success: false, msg: '积分不足' }` 是正确的，但需确认 `rewards.js` 的调用方是否妥善处理了这个返回值并向用户展示提示。  
**建议**：在 rewards 页面的 `donateCharity` 调用处确认有 `wx.showToast` 展示 `msg`。

---

### P1-3 `redeemReward`（直接兑换路径）与 `requestRedeem`（申请制）同时存在，逻辑混乱

**位置**：`miniprogram/utils/storage.js` 第578行（直接兑换）和第593行（申请制）  
**问题**：`redeemReward` 是旧的直接扣分接口，`requestRedeem` 是新的申请制接口。`rewards.js` 目前调用的是哪个？若两个都保留在 `module.exports` 中，不同入口可能走不同路径，导致部分兑换绕过家长审批。  
**修复方案**：确认 rewards 页面只调用 `requestRedeem`，然后将 `redeemReward` 从 `module.exports` 中移除或改为 internal-only。

---

### P1-4 `app.js` 中数据同步 `clientVersion` 传入 `Date.now()` 语义错误

**位置**：`miniprogram/app.js` 第34行  
```javascript
account.syncData(null, localData, Date.now());
```
**问题**：`clientVersion` 语义上应是数据版本号（单调递增整数），传 `Date.now()` 虽然也是递增的，但每次启动都是全新值，云端版本冲突检测逻辑会失效。  
**修复方案**：改为读取 `localData._version || 0` 作为 clientVersion。

---

### P1-5 提醒功能依赖时间窗口（5分钟内），用户必须恰好在设定时间打开小程序

**位置**：`miniprogram/utils/storage.js` 第733行  
```javascript
if (diff >= 0 && diff < 5 * 60 * 1000) { ... }
```
**问题**：提醒窗口仅 5 分钟，若用户在 19:35 打开但设置的是 19:30，提醒不触发。微信小程序无法主动推送，这是平台限制，但 5 分钟太短。  
**建议**：扩大到 60 分钟，或者在页面 `onShow` 时检查"今天是否未打卡"，主动弹出温馨提示而非依赖精确时间匹配。

---

## 🟢 P2：优化建议（上线后迭代）

### P2-1 错题去重逻辑仅按 `content` 字符串精确匹配

**位置**：`storage.js` 第889行 `addWrongQuestion`  
同一道题 AI 可能每次生成的 `content` 措辞略有不同，导致重复添加错题。建议加入 `examPoint + subject` 联合去重，或按题目内容 hash 去重。

---

### P2-2 `aiRecords` 仅保留最近100条，历史数据永久丢失

**位置**：`storage.js` 第925行  
对于坚持使用数个月的用户，自适应难度计算的`getRecentCorrectRate`只取最近10条，保存100条足够；但若用户想回顾完整学习历史，100条上限会让早期数据被截断。建议改为200条，或归档到独立的历史 key。

---

### P2-3 公益捐赠无任何"真实性"背书

**位置**：`rewards.js` 公益区块  
用户捐出积分后，页面只显示一段文案，没有任何凭证或外部链接。建议：完成捐赠后展示一张"爱心证书"图片，并加入说明"积分将由开发者定期批量兑换为真实捐赠"（或说明为虚拟公益，避免误导）。

---

### P2-4 `printQuestions` Canvas高度硬上限4000px，超过10题时内容被截断

**位置**：`ai-exam.js` 第955行  
```javascript
if (canvasH > 4000) canvasH = 4000;
```
如果生成了10+道题，底部题目会被截断但不报错，用户导出的图片不完整。建议分页导出或提示"最多可完整导出X题"。

---

## ✅ 行动清单

| # | 行动 | 文件路径 | 优先级 | 时间窗 |
|---|------|----------|--------|--------|
| 1 | 删除「加星测试」调试按钮 | `pages/mine/mine.wxml` + `mine.js` 第439-441行 | **P0** | 今天 |
| 2 | 在 `home.js loadData()` 开头补调 `storage.validateStreak()` | `pages/home/home.js` | **P0** | 今天 |
| 3 | 修改"忘记密码"弹窗，不暴露默认值"1234" | `subpkg-user/pages/password/password.js` | **P0** | 今天 |
| 4 | PK赛开始/结果页加"虚拟对手"说明文字 | `subpkg-learn/pages/pk/pk.wxml` | P1 | 明天 |
| 5 | 确认 `rewards.js` 只调用 `requestRedeem`，移除 `redeemReward` 导出 | `utils/storage.js` + `pages/rewards/rewards.js` | P1 | 明天 |
| 6 | 修复 `app.js` syncData clientVersion 语义 | `app.js` 第34行 | P1 | 明天 |
| 7 | 打卡提醒窗口从5分钟扩展为60分钟 | `utils/storage.js` 第734行 | P1 | 明天 |
| 8 | 公益捐赠完成后加"爱心证书"展示或加真实性说明 | `pages/rewards/` | P2 | 上线后 |
| 9 | `printQuestions` Canvas分页或提示截断 | `subpkg-learn/pages/ai-exam/ai-exam.js` | P2 | 上线后 |

---

## ⚠️ 待确认 / 假设 / Non-goals

**待确认**：
1. `ai-report` 云函数中 DeepSeek API Key 是否已配置（上线前必须验证，否则 AI 出题全流程挂掉）
2. `tts` 云函数腾讯云语音服务是否已开通并充值（英语听力题依赖此服务）
3. `speech-eval` 云函数（口语评分）是否已部署并测试通过
4. 微信小程序后台隐私政策是否已填写（`__usePrivacyCheck__: true` 已配置但privacy页面内容为空）
5. 云开发 env ID `cloud1-d8geyz0ynb367e0bf` 是否为正式环境（非测试环境）

**Non-goals（本次不修）**：
- P1-03 组队打卡（已知未完成，不影响上线）
- P1-08 角色绑定（已知未完成，不影响上线）
- B端机构后台（P2-01，已评估为暂缓）

---

## 📊 整体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | ⭐⭐⭐⭐ 8/10 | P0 全完成，P1 缺2项（组队/角色绑定）|
| 数据安全 | ⭐⭐⭐ 6/10 | 调试按钮暴露是明显短板，修复后升至8分 |
| 用户体验 | ⭐⭐⭐⭐ 7/10 | 核心流程顺畅，细节打磨空间较多 |
| 合规就绪 | ⭐⭐⭐ 6/10 | 隐私政策页内容为空，需补充 |
| 运营稳定性 | ⭐⭐⭐⭐ 7/10 | validateStreak 未接入是潜在数据问题 |

---

## 📚 数据来源 & 成员产出索引

本报告基于以下文件的全量代码审查：

| 文件 | 审查重点 |
|------|---------|
| `miniprogram/app.js` | 启动流程、云同步、DECR埋点 |
| `miniprogram/app.json` | 路由配置、分包、隐私设置 |
| `miniprogram/pages/home/home.js` | 核心打卡逻辑、AI建议、火焰状态 |
| `miniprogram/pages/rewards/rewards.js` | 积分兑换、公益捐赠流程 |
| `miniprogram/pages/mine/mine.js` + `mine.wxml` | 调试按钮暴露、重置功能 |
| `miniprogram/utils/storage.js`（完整1068行） | 数据层全量审查 |
| `miniprogram/utils/account.js` | 登录、同步、家庭绑定 |
| `miniprogram/subpkg-learn/pages/pk/pk.js` | PK赛虚拟对手机制 |
| `miniprogram/subpkg-learn/pages/weekly-report/weekly-report.js` | 周报本地计算逻辑 |
| `miniprogram/subpkg-learn/pages/ai-exam/ai-exam.js`（完整1033行） | AI出题全流程、自检机制 |
| `miniprogram/subpkg-user/pages/login/login.js` | 登录跳转逻辑 |
| `miniprogram/subpkg-user/pages/family/family.js` | 契约、兑换审批流程 |
| `miniprogram/subpkg-user/pages/password/password.js` | 家长密码安全性 |
| `miniprogram/subpkg-user/pages/privacy/privacy.js` | 隐私政策内容 |

---

> 本报告由产品战略团队 AI 协作生成，重要决策请由产品负责人审定。
