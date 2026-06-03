#!/bin/bash
# ============================================================
# 云函数部署脚本
# 用法: ./deploy-cloud-functions.sh [dev|test|prod]
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
if [ -z "$1" ]; then
  print_error "请指定环境: dev, test, 或 prod"
  echo "用法: $0 [dev|test|prod]"
  exit 1
fi

ENV=$1
ENV_FILE="deploy/environments/${ENV}.json"

# 检查环境配置文件
if [ ! -f "$ENV_FILE" ]; then
  print_error "环境配置文件不存在: $ENV_FILE"
  exit 1
fi

print_info "开始部署云函数到 ${ENV} 环境..."

# 读取环境配置
ENV_ID=$(jq -r '.envId' "$ENV_FILE")
print_info "环境 ID: $ENV_ID"

# 检查是否安装了 tcb CLI
if ! command -v tcb &> /dev/null; then
  print_warn "未找到 tcb CLI，正在安装..."
  npm install -g @cloudbase/cli
fi

# 检查登录状态
print_info "检查 CloudBase 登录状态..."
if ! tcb user:info &> /dev/null; then
  print_error "未登录 CloudBase，请先登录:"
  echo "  tcb login --key <secretId> <secretKey>"
  exit 1
fi

# 云函数根目录
CLOUD_FUNCTIONS_ROOT="miniprogram/cloudfunctions"

# 统计变量
SUCCESS=0
FAILED=0
FAILED_FUNCS=()

print_info "开始部署云函数..."

# 遍历所有云函数
for func_dir in "$CLOUD_FUNCTIONS_ROOT"/*/; do
  func_name=$(basename "$func_dir")
  
  echo ""
  print_info "--- 部署云函数: $func_name ---"
  
  # 检查必要文件
  if [ ! -f "${func_dir}index.js" ]; then
    print_warn "$func_name 缺少 index.js，跳过"
    continue
  fi
  
  # 进入云函数目录
  cd "$func_dir"
  
  # 安装依赖
  if [ -f "package.json" ]; then
    print_info "安装依赖..."
    npm ci --production 2>&1 | grep -v "npm WARN" || true
  fi
  
  # 返回项目根目录
  cd - > /dev/null
  
  # 部署云函数
  print_info "上传云函数..."
  if tcb fn deploy "$func_name" -e "$ENV_ID" 2>&1 | tee /tmp/tcb-deploy.log; then
    print_info "✓ $func_name 部署成功"
    ((SUCCESS++))
  else
    print_error "✗ $func_name 部署失败"
    ((FAILED++))
    FAILED_FUNCS+=("$func_name")
  fi
done

echo ""
print_info "=========================================="
print_info "部署完成！"
print_info "成功: $SUCCESS 个"
if [ $FAILED -gt 0 ]; then
  print_error "失败: $FAILED 个"
  print_error "失败的云函数:"
  for func in "${FAILED_FUNCS[@]}"; do
    print_error "  - $func"
  done
  exit 1
fi

print_info "=========================================="

# 列出所有云函数
print_info "当前环境的云函数列表:"
tcb fn list -e "$ENV_ID"

print_info "✅ 所有云函数部署成功！"
