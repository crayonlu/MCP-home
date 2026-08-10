FROM node:24-alpine AS web-build

WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build:server

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV MCP_HOME_HOST=0.0.0.0
ENV MCP_HOME_PORT=3344
ENV MCP_HOME_DATA_DIR=/data
ENV MCP_HOME_WEB_DIR=/app/web-dist

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=web-build /web/dist ./web-dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3344
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3344/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/server/main.js"]
