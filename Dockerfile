FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM node:20-slim AS release
WORKDIR /app
RUN addgroup -S nxm && adduser -S nxm -G nxm
COPY --from=build /app/node_modules ./node_modules
COPY . .
USER nxm
ENV NODE_ENV=production
CMD ["node", "index.js"]
