FROM node:26.11.1-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-fund --silent
COPY . .
USER node
CMD ["node", "recipeSelectorWorker.js"]