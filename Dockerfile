FROM node:24 AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --frozen-lockfile

COPY . .

# Hook up to the database
RUN npx prisma generate
RUN npm run build

FROM node:24-slim

WORKDIR /app

COPY --from=builder /app .

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +X /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]
