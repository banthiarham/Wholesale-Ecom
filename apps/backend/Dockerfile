FROM node:20-bookworm-slim AS build

WORKDIR /app

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
