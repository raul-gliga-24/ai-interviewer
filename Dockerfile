# syntax=docker/dockerfile:1

# Next 16 requires Node >= 20.9.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runtime carries the standalone server only: no dev dependencies, no source.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# node:alpine ships a "node" user; run as that rather than root.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Interviews are written here; the compose file mounts a volume over it.
RUN mkdir -p /app/data/interviews && chown -R node:node /app/data

USER node
EXPOSE 3000
CMD ["node", "server.js"]
