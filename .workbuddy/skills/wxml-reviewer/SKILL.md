---
name: wxml-reviewer
description: >
  微信小程序原生代码审查（WXML/WXSS/JS）。针对学习打卡小程序项目特点，
  检查组件嵌套、数据绑定、事件处理、云开发调用、性能优化、无障碍等常见问题。
  适用于 WXML/WXSS/JS 代码审查、bug 排查、性能优化建议。
allowed-tools: Read, Grep, Glob, Bash
---

# wxml-reviewer - 微信小程序代码审查

## 项目背景

此 Skill 为「小升初冲刺打卡」微信小程序定制，项目特征：

- **框架**: 原生微信小程序（WXML + WXSS + JS），非 uni-app/ Taro
- **基础库**: 3.6.0
- **云开发**: 微信云开发（wx.cloud），28 个云函数
- **目标用户**: 11-12 岁小学生 + 家长
- **核心页面**: home(打卡), calendar(日历), rewards(商城), mistakes/wrongbook(错题本), ai-exam(AI出题), practice(题库练习), exam-paper(模拟考试), badges(徽章), family(家庭绑定), admin(管理后台)
- **组件**: chart-bar, chart-line, chart-radar（自定义图表组件）
- **工具模块**: utils/storage.js, utils/account.js, utils/share.js

## 审查流程

当用户请求审查某个页面或组件时，按以下步骤执行：

### 1. 读取文件

同时读取目标页面的 `.wxml`、`.wxss`、`.js`、`.json` 四个文件。

### 2. 检查清单

按以下维度逐项审查，发现问题后给出**文件路径 + 行号 + 问题描述 + 修复建议**：

#### WXML 检查项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | 数据绑定安全性 | `{{}}` 中避免复杂表达式，三元运算不超过一层 |
| 2 | wx:for 必须有 wx:key | 优先用唯一字段，避免用 `*this` 除非是字符串数组 |
| 3 | wx:if vs hidden | 频繁切换用 `hidden`，条件渲染用 `wx:if` |
| 4 | 事件绑定方式 | 阻止冒泡用 `catchtap`，普通绑定用 `bindtap` |
| 5 | 图片懒加载 | 长列表中的 `<image>` 加 `lazy-load` |
| 6 | 组件属性传递 | 自定义组件 props 命名用小驼峰 |
| 7 | 可访问性 | 可交互元素添加 `aria-label` 或 `role` 属性 |
| 8 | Canvas 使用 | Canvas 2D 模式下使用 `type="2d"`，注意层级问题 |
| 9 | scroll-view 性能 | 长列表使用 `wx:for` + `scroll-view` 组合，设置 `show-scrollbar="{{false}}"` |

#### WXSS 检查项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | 尺寸单位 | 优先用 `rpx`，字体大小可用 `px` |
| 2 | 选择器层级 | 不超过 3 层嵌套，避免标签选择器 |
| 3 | 全局样式污染 | 检查是否有未加 page 级作用域的全局样式 |
| 4 | 颜色一致性 | 主色 `#FF9F43`（橙色），背景 `#FFF8E7`（暖黄），文字 `#2D3436`/`#636E72` |
| 5 | 安全区适配 | 底部 fixed 元素需要 `padding-bottom: constant(safe-area-inset-bottom)` |

#### JS 检查项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | Page/Component 生命周期 | onLoad → onShow → onReady，注意首次加载跳过逻辑 |
| 2 | setData 性能 | 避免频繁 setData，合并更新，避免传输大量数据 |
| 3 | 数据缓存策略 | storage 工具类的读写是否合理，有无过期机制 |
| 4 | 云函数调用 | 异常处理完整（try-catch + fail 回调），超时设置 |
| 5 | 内存泄漏 | onUnload 中清理定时器、事件监听 |
| 6 | 微信 API 兼容 | 使用 `wx.canIUse` 检查 API 可用性，低版本降级 |
| 7 | 用户授权流程 | 相册/位置等权限的引导和拒绝处理 |
| 8 | 错误上报 | 关键操作失败后是否有 toast 提示 |

#### 云函数调用检查项

| # | 检查项 | 说明 |
|---|--------|------|
| 1 | 初始化方式 | `wx.cloud.init({ env: 'cloud1-d8geyz0ynb367e0bf' })` |
| 2 | 调用模式 | `wx.cloud.callFunction({ name, data, success, fail })` |
| 3 | 错误处理 | 网络异常、云函数异常、业务错误三层处理 |

### 3. 输出格式

```markdown
## 审查结果：`pages/xxx/xxx`

### 问题汇总

| 严重度 | 数量 |
|--------|------|
| 🔴 严重 | N |
| 🟡 建议 | N |
| 🟢 优化 | N |

### 🔴 严重问题

**文件**: `xxx.wxml:行号`
**问题**: ...
**建议**: ...

### 🟡 建议改进

...

### 🟢 优化建议

...
```

## 项目特定规则

### 颜色系统

```css
/* 主色调 - 活力橙 */
--primary: #FF9F43;
--primary-light: #FFB773;
--primary-dark: #E8892E;

/* 背景 */
--bg-warm: #FFF8E7;
--bg-card: #FFFFFF;

/* 文字 */
--text-primary: #2D3436;
--text-secondary: #636E72;
--text-hint: #B2BEC3;

/* 功能色 */
--success: #00B894;
--danger: #FF6B6B;
--info: #74B9FF;
```

### 页面列表（共 17 个页面）

home, calendar, rewards, mine, mistakes, pointslog, detail, password,
ai-exam, role, wrongbook, login, family, badges, practice, exam-paper, admin

### 云函数列表（共 28 个）

userLogin, getOpenid, getStats, getChildData, submitPractice, ai-report,
aiAutoTag, generatePaper, managePapers, manageQuestions, importQuestions,
crawlQuestions, autoCrawl, getLocalQuestions, getQuestionVersion,
checkQuality, createIndexes, dataSync, backup, familyBind,
reminderNotify, speech-eval, tts, authAdmin, queryAdminLogs, writeAdminLog,
migrateDataV3, migrateExamQuestions

### 组件列表

chart-bar, chart-line, chart-radar（自定义 Canvas 图表组件）

### 常见反模式（需特别关注）

1. **setData 传大数据**: 避免把整个 `storage.getAppData()` 直接 setData
2. **WXML 中复杂逻辑**: 三元运算嵌套不超过 1 层，复杂判断在 JS 中预计算
3. **云函数无超时处理**: 所有 `wx.cloud.callFunction` 应有 fail 回调
4. **Canvas 未清理**: Canvas 使用完毕后需调用 `canvasContext.draw(false)` 避免内存泄漏
5. **页面间数据传递**: 优先用 `storage` 工具类而非 URL 参数传递大量数据
