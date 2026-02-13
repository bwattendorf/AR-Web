FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATA_PATH=/app/data

EXPOSE ${PORT:-3000}

CMD ["node", "server.js"]
