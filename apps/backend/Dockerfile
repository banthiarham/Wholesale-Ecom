FROM node:20-bookworm-slim AS build

WORKDIR /app

# Prisma's query/schema engines link against libssl and pick which build to
# download by probing the openssl binary. The slim image ships neither, so
# without this Prisma falls back to an openssl-1.1 engine that cannot load on
# bookworm and migrate deploy fails at startup.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY nest-cli.json tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS production

ENV NODE_ENV=production
WORKDIR /app

# Same reason as the build stage: the runtime engine needs libssl too.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# The banners and bulk-orders upload handlers hand multer a destination without
# creating it first (unlike products/settings, which mkdir on demand), so those
# uploads fail on a fresh volume unless the directories already exist. Docker
# seeds an empty named volume from the image, so creating them here is enough.
RUN mkdir -p uploads/products uploads/settings uploads/banners uploads/bulk-orders

EXPOSE 3000

# Apply committed schema changes before starting the single Render API service.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
