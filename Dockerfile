# LearnOS application image. SQLite comes with Node (node:sqlite), so nothing
# is compiled. python3 is here so Python labs and lesson examples can run when
# Judge0 is not configured; with Judge0 (docker-compose.yml) code runs there.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-numpy ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so the layer caches across code changes.
COPY package*.json ./
RUN npm ci

# Build the SPA into dist/.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
# Listen on all interfaces inside the container; the host decides what to publish.
ENV HOST=0.0.0.0
EXPOSE 3001

# The DB lives under /app/db; mount a volume there to persist it (compose does).
CMD ["node", "server.js"]
