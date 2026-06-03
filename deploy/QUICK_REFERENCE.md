# CI/CD 快速参考指南

## 🚀 常用命令

### 查看流水线状态
```bash
# 本地查看最近一次运行
gh run list

# 查看特定流水线
gh run list --workflow=deploy.yml
```

### 手动触发部署
```bash
# 部署到测试环境
gh workflow run deploy.yml -f environment=test

# 部署到生产环境
gh workflow run deploy.yml -f environment=prod
```

### 查看部署日志
```bash
# 查看最近一次运行
gh run watch

# 查看特定运行
gh run view <run-id> --log
```

---

## 📝 配置文件位置

```
deploy/
├── environments/           # 环境配置
│   ├── dev.json          # 开发环境
│   ├── test.json         # 测试环境
│   └── prod.json         # 生产环境
├── scripts/              # 部署脚本
│   ├── deploy-cloud-functions.sh   # 云函数部署
│   └── upload-miniprogram.sh       # 小程序上传
└── keys/                 # 私钥文件（勿提交到 Git）
    ├── dev.key
    ├── test.key
    └── prod.key

.github/
└── workflows/            # GitHub Actions 流水线
    ├── ci.yml           # CI 检查
    ├── deploy.yml       # 完整部署
    ├── cd-pipeline.yml  # 集成版 CI/CD
    └── release.yml      # 发布校验
```

---

## 🔧 故障排查速查表

| 问题 | 检查项 | 解决方法 |
|------|--------|----------|
| 云函数部署失败 | Secrets 配置、环境 ID、语法错误 | 查看[故障排查](#故障排查) |
| 小程序上传失败 | 私钥文件、AppID、miniprogram-ci | 本地测试上传 |
| 流水线超时 | 超时设置、网络、依赖安装 | 增加超时时间、使用缓存 |
| 通知未发送 | Webhook URL、网络 | 测试 Webhook |

---

## 📊 部署流程图

```
代码提交
   │
   ▼
代码质量检查 ───▶ 失败 → 终止
   │
   ▼
自动化测试 ─────▶ 失败 → 终止
   │
   ▼
构建 ──────────▶ 失败 → 终止
   │
   ▼
部署云函数 ─────▶ 失败 → 自动回滚
   │
   ▼
上传小程序 ─────▶ 失败 → 自动回滚
   │
   ▼
部署验证 ───────▶ 失败 → 告警
   │
   ▼
发送通知 ───────▶ 完成
```

---

## 🔐 安全注意事项

1. **不要将私钥文件提交到 Git**
   ```bash
   # 添加到 .gitignore
   echo "deploy/keys/*.key" >> .gitignore
   echo "*.key" >> .gitignore
   ```

2. **不要在代码中硬编码密钥**
   - 使用 GitHub Secrets
   - 使用环境变量

3. **定期轮换密钥**
   - 每 3-6 个月轮换一次
   - 立即轮换泄露的密钥

---

## 📚 相关文档

- [部署指南](./README.md)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [CloudBase 文档](https://docs.cloudbase.net/)
- [微信小程序文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)

---

**快速问题？** 查看 [部署指南](./README.md) 或提交 Issue。
