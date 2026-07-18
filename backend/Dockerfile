FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
# Full node_modules (not --omit=dev): the `prisma` CLI is a devDependency
# and is needed at container start to run `prisma migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# `dist/generated/prisma` (compiled) covers the running app, but
# `prisma/seed.ts` is executed directly via tsx (not through dist) and
# imports the generator's raw output at ../generated/prisma relative to
# itself — without this, `npx tsx prisma/seed.ts` fails at container start
# with "Cannot find module '../generated/prisma/client'".
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
