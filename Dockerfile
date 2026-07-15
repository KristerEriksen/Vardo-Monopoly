# ---- Stage 1: bygg React-frontenden ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: kjør backenden (som også serverer frontend/dist) ----
FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
# Ta med den bygde frontenden — server.js serverer ../frontend/dist
COPY --from=frontend /app/frontend/dist /app/frontend/dist
EXPOSE 3000
CMD ["node", "server.js"]
