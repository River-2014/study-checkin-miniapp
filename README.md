# 📚 学习打卡小程序

一个功能完整的微信学习打卡小程序，帮助记录每日学习、培养好习惯。

## 项目结构

```
学习打卡小程序/
├── server.js                    # 后端服务器 (Node.js + Express)
├── package.json                 # 后端依赖配置
├── project.config.json          # 微信小程序项目配置
├── miniprogram/                 # 小程序前端代码
│   ├── app.js                   # 全局逻辑
│   ├── app.json                 # 全局配置
│   ├── app.wxss                 # 全局样式
│   ├── sitemap.json
│   ├── images/                  # Tab 栏图标
│   ├── pages/
│   │   ├── index/               # 打卡首页
│   │   │   ├── index.js
│   │   │   ├── index.json
│   │   │   ├── index.wxml
│   │   │   └── index.wxss
│   │   ├── stats/               # 统计页
│   │   │   ├── stats.js
│   │   │   ├── stats.json
│   │   │   ├── stats.wxml
│   │   │   └── stats.wxss
│   │   └── profile/             # 个人页
│   │       ├── profile.js
│   │       ├── profile.json
│   │       ├── profile.wxml
│   │       └── profile.wxss
│   └── utils/
│       └── util.js              # 工具函数
└── data/                        # 服务器数据存储（自动生成）
```

## 快速开始

### 1. 启动后端服务器

```bash
cd "学习打卡小程序"
npm install
node server.js
```

服务器将在 **http://localhost:3000** 运行。

### 2. 打开微信开发者工具

1. 打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 点击 **导入项目**
3. 选择本项目根目录（`学习打卡小程序` 文件夹）
4. **重要**: 在详情设置中勾选「**不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**」
5. 点击编译运行

> **注意**: 本地开发时，小程序 `app.js` 中的 `baseUrl` 设为 `http://localhost:3000`。
> 部署上线前，需改为正式服务器地址，并配置小程序合法域名白名单。

## 功能特性

| 功能 | 说明 |
|------|------|
| 🔐 **用户系统** | 自动弹窗登录，新用户一键注册 |
| 📝 **每日打卡** | 点击打卡，记录每日学习 |
| ⏱ **专注计时** | 开始/停止计时，自动累加学习时长 |
| 🔥 **连续打卡** | 显示当前连续天数和最长连续 |
| 📊 **学习统计** | 总天数、总时长、月度进度 |
| 📅 **打卡日历** | 按月查看打卡记录，已打卡高亮 |
| 🎯 **目标设置** | 自定义每日学习时长目标 |
| 🏆 **成就系统** | 9 个成就徽章，逐步解锁 |
| 📤 **分享功能** | 一键复制打卡信息分享 |
| 👤 **个人中心** | 个人信息、设置、退出登录 |

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 用户注册 |
| POST | `/api/login` | 用户登录 |
| GET | `/api/user/:username` | 获取用户信息 |
| PUT | `/api/user/:username` | 更新用户设置 |
| GET | `/api/checkin/:username/today` | 今日打卡状态 |
| POST | `/api/checkin` | 打卡 |
| GET | `/api/checkin/:username/history` | 打卡历史 |
| GET | `/api/checkin/:username/month/:year/:month` | 月打卡记录 |
| POST | `/api/timer/start` | 开始计时 |
| POST | `/api/timer/stop` | 结束计时 |
| GET | `/api/timer/:username/status` | 计时状态 |
| GET | `/api/stats/:username` | 统计信息 |
| GET | `/api/share/:username` | 分享数据 |

## 数据存储

所有数据存储在 `data/` 目录下的 JSON 文件：
- `users.json` - 用户信息
- `checkins.json` - 打卡记录
- `sessions.json` - 计时记录

## 部署上线

1. 将后端部署到云服务器（如 腾讯云、阿里云）
2. 修改 `miniprogram/app.js` 中的 `baseUrl` 为正式服务器地址
3. 在微信小程序后台配置合法域名白名单
4. 使用微信开发者工具上传代码并提交审核

## 技术栈

- **后端**: Node.js + Express
- **前端**: 微信小程序原生框架（WXML + WXSS + JS）
- **存储**: JSON 文件（开发简单，无需数据库）
