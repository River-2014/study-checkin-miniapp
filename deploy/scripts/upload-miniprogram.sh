#!/bin/bash
# ============================================================
# 小程序代码上传脚本
# 用法: ./upload-miniprogram.sh [dev|test|prod] [version] [desc]
# ============================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
ENV=${1:-"dev"}
VERSION=${2:-"1.0.0"}
DESC=${3:-"自动上传"}

ENV_FILE="deploy/environments/${ENV}.json"

# 检查环境配置文件
if [ ! -f "$ENV_FILE" ]; then
  print_error "环境配置文件不存在: $ENV_FILE"
  exit 1
fi

print_info "开始上传小程序代码..."
print_info "环境: $ENV"
print_info "版本: $VERSION"
print_info "描述: $DESC"

# 读取环境配置
APPID=$(jq -r '.appId' "$ENV_FILE")
print_info "AppID: $APPID"

# 检查是否安装了 miniprogram-ci
if ! command -v miniprogram-ci &> /dev/null; then
  print_warn "未找到 miniprogram-ci，正在安装..."
  npm install -g miniprogram-ci
fi

# 检查私钥文件
PRIVATE_KEY_PATH="deploy/keys/${ENV}.key"
if [ ! -f "$PRIVATE_KEY_PATH" ]; then
  print_error "私钥文件不存在: $PRIVATE_KEY_PATH"
  print_error "请到微信公众平台下载上传密钥"
  exit 1
fi

# 创建上传脚本
cat > /tmp/upload.js << 'EOF'
const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

const appid = process.env.APPID;
const projectPath = process.env.PROJECT_PATH || 'miniprogram';
const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const version = process.env.VERSION;
const desc = process.env.DESC;

console.log('开始上传小程序代码...');
console.log('AppID:', appid);
console.log('项目路径:', projectPath);
console.log('版本:', version);
console.log('描述:', desc);

const project = new ci.Project({
  appid: appid,
  type: 'miniProgram',
  projectPath: projectPath,
  privateKeyPath: privateKeyPath,
  ignores: ['node_modules/**/*', '.git/**/*'],
});

async function upload() {
  try {
    const uploadResult = await ci.upload({
      project,
      version: version,
      desc: desc,
      setting: {
        es6: true,
        es7: true,
        minify: true,
        codeProtect: false,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true,
        uglifyFileName: false,
      },
    });
    
    console.log('✅ 上传成功！');
    console.log('上传结果:', JSON.stringify(uploadResult, null, 2));
    return uploadResult;
  } catch (error) {
    console.error('❌ 上传失败:', error);
    process.exit(1);
  }
}

upload();
EOF

# 设置环境变量
export APPID=$APPID
export PROJECT_PATH="miniprogram"
export PRIVATE_KEY_PATH=$PRIVATE_KEY_PATH
export VERSION=$VERSION
export DESC=$DESC

# 执行上传
print_info "执行上传..."
node /tmp/upload.js

print_info "✅ 小程序代码上传成功！"
print_info "请到微信公众平台提交审核"
