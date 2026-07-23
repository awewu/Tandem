# 瑞美舒适家居系统 V9 - Docker配置
# 多阶段构建优化镜像大小 (Target: < 200MB)

# 阶段1: 依赖安装
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 阶段2: 生产运行
FROM node:18-alpine AS production
WORKDIR /app

# 安装必要工具 + 时区
RUN apk add --no-cache curl tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制依赖
COPY --from=dependencies /app/node_modules ./node_modules

# 复制应用代码
COPY server-production.js ./
COPY package*.json ./
COPY server/ ./server/
COPY public/ ./public/
COPY data/ ./data/

# 创建必要目录
RUN mkdir -p /app/logs /app/uploads /app/exports && \
    chown -R nodejs:nodejs /app

USER nodejs

# 环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 暴露端口
EXPOSE 3000 3001

# 启动命令
CMD ["node", "server-production.js"]
