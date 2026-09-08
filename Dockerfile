FROM node:22-bookworm-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# System dependencies required by Chrome/Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Install Node dependencies
COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# Download the Chrome version required by Puppeteer
RUN npx puppeteer browsers install chrome

# Copy application
COPY --chown=node:node . .

# Don't run the API as root
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s \
    --timeout=5s \
    --start-period=10s \
    --retries=3 \
    CMD wget --no-verbose --tries=1 --spider \
        http://localhost:${PORT}/health || exit 1

CMD ["node", "server.js"]