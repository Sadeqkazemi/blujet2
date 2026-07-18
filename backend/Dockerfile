FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx typeorm generate
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
# Full node_modules (not --omit=dev): the `typeorm` CLI is a devDependency
# and is needed at container start to run `typeorm migrate deploy`.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/typeorm ./typeorm
# `dist/generated/typeorm` (compiled) covers the running app, but
# `typeorm/seed.ts` is executed directly via tsx (not through dist) and
# imports the generator's raw output at ../generated/typeorm relative to
# itself — without this, `npx tsx typeorm/seed.ts` fails at container start
# with "Cannot find module '../generated/typeorm/client'".
COPY --from=build /app/generated ./generated
COPY --from=build /app/typeorm.config.ts ./typeorm.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
