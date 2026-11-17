FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
COPY pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY server ./server
COPY drizzle ./drizzle
COPY shared ./shared
COPY tsconfig.json ./
RUN pnpm build:server
ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
USER node
CMD ["pnpm", "start:server"]
