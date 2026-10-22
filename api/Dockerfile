FROM node:26.12.1-alpine
WORKDIR /api
COPY package*.json ./
RUN npm ci --omit=dev --no-fund --silent
COPY . .
USER node
EXPOSE 3000
CMD ["npm","run","start"]