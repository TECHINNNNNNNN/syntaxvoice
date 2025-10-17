# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

# Install system deps for TLS and certs
RUN apt-get update -y && apt-get install -y ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# Copy only package manifests first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY prisma ./prisma
COPY src ./src

# Prisma client generation (safe to run even if generated is present)
RUN npx prisma generate

# Set port
ENV PORT=1234
EXPOSE 1234

# Health-friendly defaults
ENV NODE_OPTIONS=--enable-source-maps

CMD [ "node", "src/server.js" ]