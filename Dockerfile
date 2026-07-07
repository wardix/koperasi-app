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
COPY --from=install /app/node_modules node_modules
COPY --from=build /app/dist dist
COPY --from=build /app/server server
COPY package.json .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "start"]
