FROM node:22-bookworm-slim

WORKDIR /app

# Chromium is required for the existing automated application workflow.
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=8621
ENV HOST=0.0.0.0
ENV PUBLIC_MODE=1
ENV APPLY_HEADLESS=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8621
CMD ["npm", "start"]
