FROM node:24 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --frozen-lockfile

COPY . .

RUN npx prisma generate

RUN npm run build

FROM node:24-slim