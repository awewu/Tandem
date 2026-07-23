#!/bin/bash

# 瑞美6大系统一键计算平台 - 生产部署脚本
# 150人团队极速部署

set -e

echo "🚀 瑞美6大系统一键计算平台 - 生产部署"
echo "=============================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查环境
if [ -f .env ]; then
    echo -e "${GREEN}✓ 环境变量文件存在${NC}"
else
    echo -e "${RED}✗ 缺少 .env 文件${NC}"
    echo "请创建 .env 文件:"
    echo "  cp .env.example .env"
    exit 1
fi

# 加载环境变量
export $(cat .env | grep -v '#' | awk '/=/ {print $1}')

echo ""
echo "📋 部署信息:"
echo "  版本: $VERSION"
echo "  环境: $NODE_ENV"
echo "  端口: $PORT"
echo ""

# 步骤1: 拉取最新代码
echo -e "${YELLOW}步骤1/7: 拉取最新代码...${NC}"
git pull origin main
echo -e "${GREEN}✓ 代码更新完成${NC}"

# 步骤2: 安装依赖
echo -e "${YELLOW}步骤2/7: 安装依赖...${NC}"
npm ci --production
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 步骤3: 运行测试
echo -e "${YELLOW}步骤3/7: 运行测试...${NC}"
npm test
echo -e "${GREEN}✓ 测试通过${NC}"

# 步骤4: 构建前端
echo -e "${YELLOW}步骤4/7: 构建前端...${NC}"
npm run build
echo -e "${GREEN}✓ 前端构建完成${NC}"

# 步骤5: 构建Docker镜像
echo -e "${YELLOW}步骤5/7: 构建Docker镜像...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache
echo -e "${GREEN}✓ Docker镜像构建完成${NC}"

# 步骤6: 启动服务
echo -e "${YELLOW}步骤6/7: 启动生产服务...${NC}"
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
echo -e "${GREEN}✓ 服务启动完成${NC}"

# 步骤7: 健康检查
echo -e "${YELLOW}步骤7/7: 健康检查...${NC}"
sleep 5

# 检查API状态
if curl -s http://localhost:5000/api/oneclick/status | grep -q "success"; then
    echo -e "${GREEN}✓ API服务正常运行${NC}"
else
    echo -e "${RED}✗ API服务检查失败${NC}"
    exit 1
fi

# 检查MongoDB
if docker exec rheem-mongo mongosh --eval "db.adminCommand('ping')" | grep -q "ok"; then
    echo -e "${GREEN}✓ MongoDB正常运行${NC}"
else
    echo -e "${RED}✗ MongoDB检查失败${NC}"
fi

# 检查Redis
if docker exec rheem-redis redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}✓ Redis正常运行${NC}"
else
    echo -e "${RED}✗ Redis检查失败${NC}"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}🎉 部署成功!${NC}"
echo "=============================================="
echo ""
echo "访问地址:"
echo "  主站:    http://localhost"
echo "  API:     http://localhost:5000"
echo "  监控:    http://localhost:3000 (Grafana)"
echo ""
echo "一键计算API:"
echo "  POST http://localhost/api/oneclick/calculate"
echo ""
echo "查看日志:"
echo "  docker-compose -f docker-compose.prod.yml logs -f api"
echo ""
