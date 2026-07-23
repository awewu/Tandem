FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 复制源代码
COPY . .

# 编译TypeScript
RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]
