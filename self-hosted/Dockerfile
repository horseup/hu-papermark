FROM node:24.22.1-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app/self-hosted
COPY self-hosted/package.json self-hosted/package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma/schema /app/prisma/schema
COPY lib/horseup /app/lib/horseup
COPY self-hosted ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN node scripts/prepare-prisma.mjs && node node_modules/prisma/build/index.js generate && node scripts/prepare-pdf.mjs
RUN node node_modules/next/dist/bin/next build --webpack

FROM node:24.22.1-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/self-hosted/.next/standalone ./
COPY --from=build --chown=node:node /app/self-hosted/.next/static ./self-hosted/.next/static
COPY --from=build --chown=node:node /app/self-hosted/public ./self-hosted/public
COPY --from=build --chown=node:node /app/self-hosted/.generated/prisma ./self-hosted/.generated/prisma
COPY --from=build --chown=node:node /app/self-hosted/node_modules/prisma ./self-hosted/node_modules/prisma
COPY --from=build --chown=node:node /app/self-hosted/node_modules/@prisma ./self-hosted/node_modules/@prisma
COPY --from=build --chown=node:node /app/self-hosted/scripts/start.mjs ./self-hosted/start.mjs
USER node
WORKDIR /app/self-hosted
EXPOSE 3000
CMD ["node", "start.mjs"]
