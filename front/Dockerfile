FROM node:26.12.1-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:26.12.1-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
# Default to http://api:3000 for internal container networking
ARG BACKEND_URL=http://api:3000
ENV BACKEND_URL=${BACKEND_URL}
RUN npm run build

FROM node:26.12.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
EXPOSE 3000

CMD ["node", "server.js"]