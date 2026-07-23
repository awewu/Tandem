#!/bin/bash
# Terminal-Script: 启动服务器

echo "[Terminal] 检查环境..."
npm install --silent

echo "[Terminal] 查找可用端口..."
PORT=5000
while netstat -ano | grep -q ":$PORT"; do
  PORT=$((PORT + 1))
done
echo "[Terminal] 使用端口: $PORT"

echo "[Terminal] 启动服务器..."
PORT=$PORT node server-production.js
