# OneMail IMAP 网关：没有第三方依赖，只用 Node 自带模块
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production
EXPOSE 993 143
# 以 root 运行：Caddy 存的证书私钥只有 root 能读
CMD ["node", "src/server.js"]
