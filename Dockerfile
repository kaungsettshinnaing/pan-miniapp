FROM node:22-alpine AS base
WORKDIR /app

# ── Stage 1: all deps + Prisma client generation ──────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma/ ./prisma/
RUN npm ci
# Generate Prisma 7 TypeScript client before the build step needs it
RUN npx prisma generate

# ── Stage 2: Next.js build ────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/app/generated ./app/generated
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: prod-only node_modules (smaller runtime image) ──────────────────
FROM base AS prod-deps
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 4: runtime image ────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/app/generated ./app/generated
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
