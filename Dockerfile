# LearnOS application image.
# better-sqlite3 is a native addon, so the build needs python3 + a C/C++
# toolchain. The app itself does NOT need language compilers for labs when it
# runs against Judge0 (see docker-compose.yml); code execution happens in the
# Judge0 sandbox, not in this container.
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first so the layer caches across code changes.
COPY package*.json ./
RUN npm ci

# Build the SPA into dist/.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# The DB lives under /app/db; mount a volume there to persist it (compose does).
CMD ["node", "server.js"]
