# Stage 1: Build Frontend
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
# Używamy npm install zamiast npm ci, aby wygenerować lockfile jeśli go brakuje
RUN npm install
COPY . .
RUN npm run build:frontend

# Stage 2: Setup Backend and Run
FROM node:20
WORKDIR /app

# Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./
# FIXED: Zmiana z 'npm ci' na 'npm install' naprawia błąd brakującego package-lock.json
RUN npm install
COPY backend/ ./
RUN npm run build

# Setup Frontend Static Files
WORKDIR /app
COPY --from=builder /app/dist ./dist

# Expose and Run
EXPOSE 3001
# Uruchamiamy serwer z poziomu katalogu /app, wskazując na skompilowany plik
CMD ["node", "backend/dist/server.js"]