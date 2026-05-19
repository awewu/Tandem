# Docker PostgreSQL 快速启动指南

## 前提

安装 Docker Desktop：<https://www.docker.com/products/docker-desktop/>

## 启动数据库

```powershell
cd e:\Hermes
docker compose -f docker-compose.db.yml up -d
```

## 验证

```powershell
docker exec -it tandem-postgres pg_isready -U tandem
# 应显示: localhost:5432 - accepting connections
```

## 配置 Tandem

.env 文件已有:

```
DATABASE_URL=postgresql://tandem:tandem@localhost:5432/tandem
```

## Prisma 初始化

```powershell
cd e:\Hermes
npx prisma migrate dev --name init
npx prisma generate
```

## 启动 Next.js

```powershell
npm run dev
```

## 停止数据库

```powershell
docker compose -f docker-compose.db.yml down
```

## 数据持久化

数据库数据保存在 Docker volume `tandem_pg_data` 中。
即使删除容器，数据也不会丢失。
