FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/uploads /app/data

ENV NODE_ENV=production
ENV UPLOADS_PATH=/app/uploads
ENV DB_PATH=/app/data

EXPOSE ${PORT:-3000}

CMD ["node", "server.js"]
