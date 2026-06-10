FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
#RUN npm ci --production
RUN npm install

COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/index.js"]
