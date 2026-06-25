FROM node:22-alpine AS build

RUN apk add --no-cache g++ make python3
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json biome.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/auth/package.json apps/auth/package.json
COPY apps/cli/package.json apps/cli/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/bootstrap-admin/package.json packages/bootstrap-admin/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/web-core/package.json packages/web-core/package.json
COPY packages/zero-schema/package.json packages/zero-schema/package.json

RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_ZERO_CACHE_URL=https://zero.contextbase.localhost
ARG VITE_CONTEXTBASE_AUTH_BASE_URL=https://auth.contextbase.localhost
ENV VITE_ZERO_CACHE_URL=$VITE_ZERO_CACHE_URL
ENV VITE_CONTEXTBASE_AUTH_BASE_URL=$VITE_CONTEXTBASE_AUTH_BASE_URL
RUN pnpm --filter '!@contextbase/desktop' -r build
RUN node scripts/fix-esm-imports.mjs apps/api/dist

FROM node:22-alpine AS runtime

RUN apk add --no-cache g++ make python3
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts

CMD ["node", "apps/api/dist/server.js"]
