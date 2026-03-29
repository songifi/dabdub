FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json ./
RUN pnpm install --no-frozen-lockfile

# Keep GeoIP data fresh at build time for country checks.
RUN node ./node_modules/geoip-lite/scripts/updatedb.js

COPY . .
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY package.json ./
RUN pnpm install --prod --no-frozen-lockfile

COPY --from=builder /app/node_modules/geoip-lite/data ./node_modules/geoip-lite/data
COPY --from=builder /app/dist ./dist

CMD ["node", "dist/main.js"]
