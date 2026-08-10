FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV MCP_HOME_HOST=0.0.0.0
ENV MCP_HOME_PORT=3344
ENV MCP_HOME_DATA_DIR=/data
ENV MCP_HOME_WEB_DIR=/app/web-dist

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
RUN npm install -g resend-mcp@latest @hexsleeves/tailscale-mcp-server@latest
COPY dist ./dist
COPY web/dist ./web-dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3344
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3344/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/server/main.js"]
