# 自动化 CI/CD 部署指南

## 📋 目录

1. [概述](#概述)
2. [架构设计](#架构设计)
3. [快速开始](#快速开始)
4. [配置文件说明](#配置文件说明)
5. [GitHub Secrets 配置](#github-secrets-配置)
6. [使用方式](#使用方式)
7. [流水线说明](#流水线说明)
8. [故障排查](#故障排查)
9. [最佳实践](#最佳实践)

---

## 概述

本 CI/CD 系统为「学习打卡小程序」提供完整的自动化部署能力，包括：

✅ **代码质量检查** - ESLint、语法检查、安全扫描  
✅ **自动化测试** - 单元测试、集成测试、功能验证  
✅ **自动构建** - 代码压缩、优化、打包  
✅ **云函数部署** - 自动部署所有云函数到 CloudBase  
✅ **小程序上传** - 使用 miniprogram-ci 自动上传代码  
✅ **部署验证** - 健康检查、冒烟测试  
✅ **自动回滚** - 部署失败时自动回滚  
✅ **通知提醒** - Slack/企业微信/邮件通知  

---

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                       GitHub Actions                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Push/PR ──▶ 代码检查 ──▶ 自动化测试 ──▶ 构建          │
│                    │                                      │
│                    ▼                                      │
│              部署云函数 ──▶ 上传小程序 ──▶ 部署验证       │
│                    │                                      │
│                    ▼                                      │
│              通知 + 报告 + (失败回滚)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 流水线文件

| 文件 | 用途 | 触发条件 |
|------|------|----------|
| `.github/workflows/ci.yml` | 代码质量检查 | push/PR 到 main/develop |
| `.github/workflows/deploy.yml` | 完整部署流程 | push 到 main/develop |
| `.github/workflows/cd-pipeline.yml` | 集成版 CI/CD | push/PR 到任意分支 |
| `.github/workflows/release.yml` | 发布前校验 | 推送 v* tag |

---

## 快速开始

### 1. 配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

```bash
# 进入仓库 → Settings → Secrets and variables → Actions → New repository secret

WX_APPID              # 微信小程序 AppID
WX_CI_KEY             # 微信小程序上传密钥（从公众平台下载）
TCB_SECRET_ID         # 腾讯云 SecretId
TCB_SECRET_KEY        # 腾讯云 SecretKey
TCB_ENV_ID            # CloudBase 环境 ID（生产）
TCB_ENV_ID_TEST       # CloudBase 环境 ID（测试）
SLACK_WEBHOOK_URL    # Slack Webhook URL（可选）
```

### 2. 配置环境文件

编辑 `deploy/environments/` 下的配置文件：

```bash
# 开发环境
deploy/environments/dev.json

# 测试环境
deploy/environments/test.json

# 生产环境
deploy/environments/prod.json
```

**修改 `envId` 为你的实际环境 ID**

### 3. 下载微信小程序上传密钥

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **开发 → 开发管理 → 开发设置 → 小程序代码上传密钥**
3. 生成密钥并下载（得到 `private.key` 文件）
4. 将密钥内容添加到 GitHub Secrets 的 `WX_CI_KEY`

### 4. 推送代码触发部署

```bash
# 推送到 develop 分支 → 自动部署到测试环境
git push origin develop

# 推送到 main 分支 → 自动部署到生产环境
git push origin main

# 手动触发部署
# 进入 GitHub → Actions → Deploy → Run workflow
```

---

## 配置文件说明

### 1. 环境配置文件

**路径**: `deploy/environments/{env}.json`

```json
{
  "name": "环境名称",
  "envId": "CloudBase 环境 ID",
  "appId": "微信小程序 AppID",
  "description": "环境描述",
  "cloudbase": {
    "envId": "环境 ID",
    "region": "地域（ap-shanghai/ap-guangzhou）"
  },
  "miniprogram": {
    "appId": "小程序 AppID",
    "es6": true,
    "es7": true,
    "minify": true,
    "urlCheck": true
  },
  "features": {
    "enableDebug": false,
    "enableLog": true,
    "mockData": false
  }
}
```

### 2. 部署脚本

**云函数部署**: `deploy/scripts/deploy-cloud-functions.sh`

```bash
# 用法
./deploy/scripts/deploy-cloud-functions.sh [dev|test|prod]
```

**小程序上传**: `deploy/scripts/upload-miniprogram.sh`

```bash
# 用法
./deploy/scripts/upload-miniprogram.sh [dev|test|prod] [version] [desc]
```

---

## GitHub Secrets 配置

### 必需配置

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|----------|
| `WX_APPID` | 微信小程序 AppID | 微信公众平台 → 开发 → 开发管理 → 开发设置 |
| `WX_CI_KEY` | 小程序上传密钥 | 微信公众平台 → 开发 → 开发管理 → 开发设置 → 小程序代码上传密钥 |
| `TCB_SECRET_ID` | 腾讯云 SecretId | [访问管理控制台](https://console.cloud.tencent.com/cam/capi) |
| `TCB_SECRET_KEY` | 腾讯云 SecretKey | 同上 |
| `TCB_ENV_ID` | CloudBase 生产环境 ID | [CloudBase 控制台](https://console.cloud.tencent.com/tcb) |
| `TCB_ENV_ID_TEST` | CloudBase 测试环境 ID | 同上 |

### 可选配置

| Secret 名称 | 说明 |
|-------------|------|
| `SLACK_WEBHOOK_URL` | Slack 通知 Webhook |
| `DINGTALK_WEBHOOK` | 钉钉通知 Webhook |
| `WECOM_WEBHOOK` | 企业微信通知 Webhook |

### 配置步骤

1. **进入 GitHub 仓库**
2. **点击 Settings → Secrets and variables → Actions**
3. **点击 New repository secret**
4. **输入 Name 和 Value**
5. **点击 Add secret**

---

## 使用方式

### 1. 自动触发

```bash
# 推送到 develop 分支 → 自动部署测试环境
git add .
git commit -m "feat: 新增功能"
git push origin develop

# 推送到 main 分支 → 自动部署生产环境
git add .
git commit -m "release: v1.0.0"
git push origin main
```

### 2. 手动触发

1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Deploy** 流水线
4. 点击 **Run workflow**
5. 选择环境（test/prod）
6. 点击 **Run workflow** 确认

### 3. 本地部署

```bash
# 部署云函数
./deploy/scripts/deploy-cloud-functions.sh test

# 上传小程序代码
./deploy/scripts/upload-miniprogram.sh test 1.0.0 "测试部署"
```

---

## 流水线说明

### 1. 代码质量检查（lint-and-validate）

**耗时**: ~10 分钟  
**内容**:
- 爬虫代码语法检查
- 云函数语法检查
- 配置文件格式校验
- 敏感信息泄露扫描
- 大文件检查

**失败处理**: 立即终止流水线

### 2. 自动化测试（test）

**耗时**: ~15 分钟  
**内容**:
- 运行单元测试（`npm test`）
- 爬虫功能验证
- 云函数测试

**失败处理**: 终止流水线（可通过 `skip_tests` 跳过）

### 3. 构建（build）

**耗时**: ~15 分钟  
**内容**:
- 安装依赖
- 代码优化（压缩、混淆）
- 生成版本信息
- 上传构建产物

**输出**: 构建产物（artifact）

### 4. 部署云函数（deploy-cloud-functions）

**耗时**: ~20 分钟  
**内容**:
- 安装 CloudBase CLI
- 登录 CloudBase
- 遍历部署所有云函数
- 验证部署

**失败处理**: 触发自动回滚

### 5. 部署小程序（deploy-miniprogram）

**耗时**: ~30 分钟  
**内容**:
- 下载构建产物
- 安装 miniprogram-ci
- 上传小程序代码

**注意**: 上传后需到微信公众平台提交审核

### 6. 部署后验证（post-deploy-check）

**耗时**: ~10 分钟  
**内容**:
- 云函数健康检查
- 冒烟测试

### 7. 通知（notify）

**内容**:
- 发送部署成功/失败通知
- 支持 Slack、企业微信、钉钉

---

## 故障排查

### 1. 云函数部署失败

**可能原因**:
- CloudBase 登录失败 → 检查 `TCB_SECRET_ID` 和 `TCB_SECRET_KEY`
- 环境 ID 错误 → 检查 `TCB_ENV_ID`
- 云函数语法错误 → 查看日志，修复语法错误
- 依赖安装失败 → 检查 `package.json`

**解决方法**:
```bash
# 本地测试部署
tcb login --key <secretId> <secretKey>
tcb fn deploy <function-name> -e <env-id>
```

### 2. 小程序上传失败

**可能原因**:
- 私钥文件路径错误 → 检查 `WX_CI_KEY`
- AppID 不匹配 → 检查 `WX_APPID`
- miniprogram-ci 版本问题 → 更新到最新版本

**解决方法**:
```bash
# 本地测试上传
npm install -g miniprogram-ci
node upload.js
```

### 3. 流水线超时

**可能原因**:
- 网络问题
- 依赖安装过慢
- 云函数部署超时

**解决方法**:
- 增加超时时间（`timeout-minutes`）
- 使用缓存加速依赖安装
- 分批部署云函数

### 4. 通知未发送

**可能原因**:
- Webhook URL 错误
- 网络问题

**解决方法**:
- 检查 `SLACK_WEBHOOK_URL` 等配置
- 使用 `curl` 测试 Webhook

---

## 最佳实践

### 1. 分支管理

```
main        # 生产环境，保护分支，需 PR 审核
develop     # 测试环境，自动部署
feature/*   # 功能分支，CI 检查
bugfix/*    # 修复分支
```

### 2. 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: 新增用户登录功能
fix: 修复云函数部署失败问题
docs: 更新部署文档
refactor: 重构云函数代码
test: 添加单元测试
chore: 更新依赖
```

### 3. 版本号管理

使用语义化版本号：

```
主版本.次版本.修订号
1. 0.0 → 首次发布
1. 1.0 → 新增功能
1. 1.1 → 修复 Bug
2. 0.0 → 不兼容的改动
```

### 4. 环境隔离

- **开发环境（dev）**: 开发者本地调试
- **测试环境（test）**: 预发布验证
- **生产环境（prod）**: 正式对外发布

### 5. 回滚策略

- **自动回滚**: 部署失败时自动触发
- **手动回滚**: 发现问题后手动回滚到上一个版本

```bash
# 查看部署历史
git log --oneline

# 回滚到指定版本
git revert <commit-hash>
git push origin main
```

### 6. 监控和告警

- 部署失败时立即通知
- 定期检查云函数运行状态
- 监控小程序访问量、错误率

---

## 📞 支持

如有问题，请：
1. 查看 [GitHub Actions 文档](https://docs.github.com/en/actions)
2. 查看 [CloudBase 文档](https://docs.cloudbase.net/)
3. 查看 [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
4. 提交 Issue

---

**祝部署顺利！** 🚀
