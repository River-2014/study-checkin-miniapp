# 微信小程序 CI/CD 配置示例

## miniprogram-ci 配置

### 安装
```bash
npm install -g miniprogram-ci
```

### 基本用法
```javascript
const ci = require('miniprogram-ci');

// 创建项目实例
const project = new ci.Project({
  appid: 'wx8d568fc6b9fbad1f',
  type: 'miniProgram',
  projectPath: '/path/to/miniprogram',
  privateKeyPath: '/path/to/private.key',
  ignores: ['node_modules/**/*'],
});

// 上传代码
async function upload() {
  const uploadResult = await ci.upload({
    project,
    version: '1.0.0',
    desc: '自动部署',
    setting: {
      es6: true,
      es7: true,
      minify: true,
    },
  });
  console.log('上传成功:', uploadResult);
}

upload();
```

### 预览代码
```javascript
const previewResult = await ci.preview({
  project,
  desc: '预览',
  setting: {
    es6: true,
  },
  qrcodeOutputDest: '/path/to/qrcode.jpg',
});
```

### 获取最近上传记录
```javascript
const uploadList = await ci.getUploadHistory({
  project,
  offset: 0,
  limit: 10,
});
```

---

## CloudBase CLI 配置

### 安装
```bash
npm install -g @cloudbase/cli
```

### 登录
```bash
# 使用密钥登录
tcb login --key <secretId> <secretKey>

# 使用交互式登录
tcb login
```

### 部署云函数
```bash
# 部署单个云函数
tcb fn deploy <function-name> -e <env-id>

# 部署所有云函数
for dir in miniprogram/cloudfunctions/*/; do
  func_name=$(basename "$dir")
  tcb fn deploy $func_name -e <env-id>
done
```

### 查看云函数列表
```bash
tcb fn list -e <env-id>
```

### 查看云函数日志
```bash
tcb fn log <function-name> -e <env-id>
```

### 回滚云函数
```bash
tcb fn rollback <function-name> -e <env-id>
```

---

## GitHub Actions 配置技巧

### 1. 缓存依赖加速
```yaml
- name: 缓存依赖
  uses: actions/cache@v4
  with:
    path: |
      **/node_modules
      ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

### 2. 并行执行 Jobs
```yaml
jobs:
  job1:
    # ...
  
  job2:
    # ...
  
  job3:
    needs: [job1, job2]  # 等待 job1 和 job2 完成
```

### 3. 条件执行
```yaml
jobs:
  deploy:
    if: ${{ github.ref == 'refs/heads/main' }}
    # 只在 main 分支执行
```

### 4. 手动触发
```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: '部署环境'
        required: true
        default: 'test'
        type: choice
        options:
          - test
          - prod
```

### 5. 环境变量
```yaml
env:
  NODE_VERSION: '20'

jobs:
  build:
    env:
      CUSTOM_VAR: 'value'
    steps:
      - name: 使用环境变量
        run: echo ${{ env.CUSTOM_VAR }}
```

### 6. Artifacts（构建产物）
```yaml
# 上传
- name: 上传构建产物
  uses: actions/upload-artifact@v4
  with:
    name: build-artifact
    path: build/

# 下载
- name: 下载构建产物
  uses: actions/download-artifact@v4
  with:
    name: build-artifact
    path: build/
```

---

## 常见问题

### 1. miniprogram-ci 上传失败

**错误**: `invalid private key`

**解决**: 确保私钥文件格式正确，没有多余的空格或换行

```javascript
// 正确方式
const project = new ci.Project({
  privateKeyPath: '/path/to/private.key',
});

// 或者直接使用私钥内容
const project = new ci.Project({
  privateKey: process.env.WX_CI_KEY,
});
```

### 2. CloudBase CLI 登录失败

**错误**: `login failed`

**解决**: 检查 SecretId 和 SecretKey 是否正确，确保有足够的权限

```bash
# 测试登录
tcb login --key <secretId> <secretKey>
```

### 3. GitHub Actions 超时

**错误**: `The job has timed out`

**解决**: 增加超时时间

```yaml
jobs:
  deploy:
    timeout-minutes: 30  # 默认 360 分钟
```

---

## 📚 参考文档

- [miniprogram-ci 文档](https://www.npmjs.com/package/miniprogram-ci)
- [CloudBase CLI 文档](https://docs.cloudbase.net/cli-v1/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
