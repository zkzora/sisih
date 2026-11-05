# Sisih API server (Hono + SQLite + agent runner + demo x402 merchants).
# Built from the repo root so the pnpm workspace lockfile and policies apply.
FROM node:24-slim

# better-sqlite3 compiles natively if no prebuilt binary matches
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.13.0

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --filter @sisih/server

COPY server ./server

WORKDIR /app/server
ENV NODE_ENV=production HOST=0.0.0.0 DATABASE_URL=file:/data/sisih.db
EXPOSE 8787
CMD ["npx", "tsx", "src/index.ts"]
