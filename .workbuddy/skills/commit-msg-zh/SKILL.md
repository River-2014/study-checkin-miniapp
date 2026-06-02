---
name: commit-msg-zh
description: >
  中文 Git 提交信息规范。为学习打卡小程序项目定制，支持 emoji + 中文描述格式，
  自动关联 GitHub Actions CI/CD 流水线状态。适用于编写 commit message、
  审查提交历史、生成 CHANGELOG。
allowed-tools: Read, Bash, Grep
---

# commit-msg-zh - 中文提交信息规范

## 项目背景

此 Skill 为「小升初冲刺打卡」微信小程序定制。

- **仓库**: `River-2014/study-checkin-miniapp`
- **CI/CD**: GitHub Actions（ci.yml + release.yml + quality-report.yml）
- **分支策略**: main（生产）、develop（开发）
- **目标**: 统一团队提交风格，便于生成 CHANGELOG 和代码审查

## 提交信息格式

```
<emoji> <类型>: <简短描述>

<详细说明（可选）>

<关联信息（可选）>
```

### 类型与 Emoji 对照表

| 类型 | Emoji | 说明 | 示例 |
|------|-------|------|------|
| `feat` | ✨ | 新功能 | `✨ feat: 新增错题本拍照录入功能` |
| `fix` | 🐛 | Bug 修复 | `🐛 fix: 修复打卡日历跨月数据显示错误` |
| `perf` | ⚡ | 性能优化 | `⚡ perf: 优化首页 setData 调用频率` |
| `refactor` | ♻️ | 代码重构 | `♻️ refactor: 抽取通用存储工具类` |
| `style` | 🎨 | UI/样式调整 | `🎨 style: 统一按钮圆角和阴影样式` |
| `docs` | 📝 | 文档更新 | `📝 docs: 更新 README 部署说明` |
| `test` | ✅ | 测试相关 | `✅ test: 添加云函数单元测试` |
| `chore` | 🔧 | 构建/工具配置 | `🔧 chore: 更新 GitHub Actions 超时配置` |
| `ci` | 🚀 | CI/CD 流水线 | `🚀 ci: 添加云函数自动部署流水线` |
| `db` | 🗄️ | 数据库/集合变更 | `🗄️ db: 新增 daily_stats 预聚合集合` |
| `cloud` | ☁️ | 云函数变更 | `☁️ cloud: 新增 ai-report 云函数` |
| `crawler` | 🕷️ | 爬虫相关 | `🕷️ crawler: 新增试卷网解析器` |
| `security` | 🔒 | 安全相关 | `🔒 security: 移除硬编码密钥` |
| `revert` | ⏪ | 回滚 | `⏪ revert: 回滚题库导入逻辑` |

### 作用域（可选）

在类型后加括号标注作用域：

```
✨ feat(home): 首页新增 AI 每日推荐练习模块
🐛 fix(calendar): 修复跨月打卡数据显示错误
☁️ cloud(ai-report): 支持 DeepSeek chat 模式
🕷️ crawler(shijuan1): 修复 GBK 编码解析乱码
```

## 完整示例

### 简单提交

```
🐛 fix: 修复家长中心积分流水翻页错误
```

### 带详细说明

```
✨ feat: 新增语音评测功能

- 接入微信同声传译插件
- 支持英语单词发音评测
- 成绩自动同步到云数据库

Closes #42
```

### 带关联信息

```
🐛 fix(wrongbook): 修复错题本图片上传失败问题

原因：wx.chooseMedia 返回的 tempFilePath 需要先保存到云存储

解决：使用 wx.cloud.uploadFile 上传后再存储 fileID

Reviewed-by: @teammate
Closes #58
```

## 项目特定规范

### 页面变更

修改小程序页面时，优先使用作用域标注页面名：

```
✨ feat(practice): 题库练习页新增分类筛选
🐛 fix(home): 修复打卡撒花动画层级遮挡
🎨 style(ai-exam): 统一 AI 出题页答题卡片样式
```

### 云函数变更

使用 `☁️ cloud` 类型：

```
☁️ cloud(getStats): 新增学科正确率聚合查询
☁️ cloud(ai-report): 支持文心一言响应格式
```

### 爬虫变更

使用 `🕷️ crawler` 类型：

```
🕷️ crawler: 新增 appsj.com 题目解析器
🕷️ crawler(shijuan1): 修复分页参数编码问题
```

### 数据变更

使用 `🗄️ db` 类型：

```
🗄️ db: 新增 mistakes 集合及索引
🗄️ db: 为 exam_questions 添加 isLatest 字段
```

## GitHub Actions 联动

### 提交即触发 CI

- 推送到 `main` / `develop` → 自动触发 CI（爬虫检查 + 云函数检查 + 安全检查）
- 创建 PR 到 `main` → 自动触发 CI

### Release 提交规范

发布版本时使用：

```
🚀 release: v1.2.0

## 新增
- ✨ 语音评测功能
- ✨ 错题本拍照录入

## 修复
- 🐛 修复日历跨月显示错误
- 🐛 修复家长中心翻页问题

## 优化
- ⚡ 优化首页加载速度
```

### 自动化质量报告

`quality-report.yml` 每周自动生成代码质量报告并提交 Issue，报告内容基于最近一周的 commit 类型统计。

## 注意事项

1. **第一行不超过 50 字**（中文约 25 个汉字）
2. **类型用小写英文**（feat, fix, perf...），描述用中文
3. **一个 commit 只做一件事**，避免混合不同类型的改动
4. **不要提交调试代码**（console.log、临时注释等）
5. **敏感信息绝不提交**（API Key、密钥、Token 等通过 GitHub Secrets 管理）
6. **提交前先 git pull --rebase**，避免产生不必要的 merge commit
