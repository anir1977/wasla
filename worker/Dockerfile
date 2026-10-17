FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
RUN mkdir /state && chown node:node /state
USER node
ENV NODE_ENV=production
CMD ["node","server.mjs"]
