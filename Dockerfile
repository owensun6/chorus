# Author: be-domain-modeler
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/

RUN npx tsc

# --- Production stage ---
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist/ dist/
COPY skill/ skill/

# SQLite data directory — mount a Fly volume here
RUN mkdir -p /data
ENV CHORUS_DB_PATH=/data/chorus.db
VOLUME /data

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
