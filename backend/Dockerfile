FROM node:20-alpine AS runner

WORKDIR /app

# Install dependencies needed for sharp prebuilds if required
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY .env.example ./.env

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "src/server.js"]
