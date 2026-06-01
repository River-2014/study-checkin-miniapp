# CI/CD 流水线说明

## 项目概述

**学习打卡小程序** — 基于微信云开发的打卡学习小程序，包含前端小程序代码、云函数、以及题库爬虫工具。

## 流水线总览

| 流水线 | 文件 | 触发条件 | 用途 |
|--------|------|----------|------|
| CI | `.github/workflows/ci.yml` | push/PR 到 main、develop | 代码质量 + 安全检查 |
| Release Check | `.github/workflows/release.yml` | 推送 `v*` tag | 发布前全面校验 |

## CI 流水线（ci.yml）

### 触发时机
- 推送代码到 `main` 或 `develop` 分支
- 创建 Pull Request 到 `main` 分支

### 包含的 Job

| Job | 说明 | 超时 |
|-----|------|------|
| `crawler-check` | 爬虫脚本语法校验、依赖安全审计 | 5 分钟 |
| `cloud-functions-check` | 云函数 package.json + index.js 校验 | 5 分钟 |
| `security-check` | 敏感信息泄露扫描、配置校验、大文件检查 | 3 分钟 |

### 通过标准
- 所有爬虫核心脚本（crawler.js、seedData.js 等）语法正确
- 所有云函数的 package.json 格式正确、index.js 语法正确
- npm audit 不报告 high 级别以上漏洞
- 未检测到硬编码的 SecretId/SecretKey
- 未检测到 10MB 以上的大文件

## Release 流水线（release.yml）

### 触发时机
推送 tag，格式为 `v1.0.0` 或 `release-20240101`。

### 包含的 Job

| Job | 说明 |
|-----|------|
| `validate` | 爬虫 + 云函数全面检查、小程序页面完整性检查 |
| `release-notes` | 自动创建 GitHub Release（draft 模式，需手动编辑后发布） |

### 注意事项
- 微信小程序本身**不通过 GitHub 发布**，需通过微信开发者工具上传
- 云函数需在微信云开发控制台手动部署
- 此 Release 流水线仅用于**发布前的质量把关**

## 使用方式

### 本地验证（推荐）

在推送代码前，可先本地运行检查：

```bash
# 爬虫语法检查
cd crawler
npm ci
node -c crawler.js && node -c import_to_cloud.js && node -c seedData.js

# 云函数语法检查
for dir in ../miniprogram/cloudfunctions/*/; do
  [ -f "${dir}index.js" ] && node -c "${dir}index.js"
done
```

### GitHub 上操作

1. **日常开发**：正常 push/PR，CI 自动运行
2. **发布前**：打 tag 触发 Release 检查
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. Release 创建后为 draft，需在 GitHub Release 页面编辑补充发布内容后手动发布

## Secrets 配置（按需）

当前项目无需额外配置 Secrets。如果后续需要对接外部服务，在 GitHub 仓库 `Settings > Secrets and variables > Actions` 中添加：

| Secret 名称 | 用途 |
|-------------|------|
| `WECHAT_APPID` | 微信小程序 AppID（CI 中引用） |
| `WECHAT_SECRET` | 微信小程序 Secret |
| `TENCENT_SECRET_ID` | 腾讯云 API 密钥 ID |
| `TENCENT_SECRET_KEY` | 腾讯云 API 密钥 Key |

> **安全提醒**：当前 `project.config.json` 中包含 AppID，属于正常配置项。但 Secret 类密钥切勿提交到仓库。

## 文件排除

流水线检查会跳过以下目录：
- `crawler/node_modules/` — NPM 依赖
- `crawler/output/` — 爬虫输出数据
- `.git/` — Git 内部文件
- `.claude/` — Claude 配置文件
