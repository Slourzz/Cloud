FROM node:22-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY cloud-ttml-bot/package.json cloud-ttml-bot/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY cloud-ttml-bot/tsconfig.json ./
COPY cloud-ttml-bot/src ./src

RUN pnpm run build
RUN pnpm prune --prod

FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

CMD ["node", "dist/index.js"]
