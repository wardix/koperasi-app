FROM oven/bun:1.0 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Build frontend
FROM install AS build
COPY . .
RUN bun run build

# Release image
FROM base AS release

# Ensure /app is owned by bun before copying
RUN chown -R bun:bun /app

COPY --chown=bun:bun --from=install /app/node_modules node_modules
COPY --chown=bun:bun --from=build /app/dist dist
COPY --chown=bun:bun --from=build /app/server server
COPY --chown=bun:bun --from=build /app/shared shared
COPY --chown=bun:bun package.json .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Create data directory and set ownership to bun user
RUN mkdir -p /app/data && chown -R bun:bun /app/data

USER bun

CMD ["bun", "run", "start"]
