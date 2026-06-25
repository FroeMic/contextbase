FROM node:22-alpine

RUN apk add --no-cache g++ make python3
RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile && pnpm --filter @contextbase/web build

ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=4017

EXPOSE 4017

CMD ["pnpm", "--filter", "@contextbase/web", "start"]
