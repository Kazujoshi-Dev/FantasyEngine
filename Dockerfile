# ---------------------------------------
# Stage 1: Build
# ---------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Kopiujemy definicje zależności
COPY package*.json ./
COPY backend/package*.json ./backend/

# 2. Instalujemy zależności (root + backend)
RUN npm install
WORKDIR /app/backend
RUN npm install
WORKDIR /app

# 3. Kopiujemy resztę kodu źródłowego
COPY . .

# 4. Budujemy Frontend (powstaje folder /app/dist)
RUN npm run build:frontend

# 5. Budujemy Backend (powstaje folder /app/backend/dist)
RUN npm run build:backend

# ---------------------------------------
# Stage 2: Production
# ---------------------------------------
FROM node:20-alpine

WORKDIR /app

# 1. Kopiujemy package.json backendu i instalujemy tylko produkcyjne zależności
COPY --from=builder /app/backend/package*.json ./
RUN npm install --production

# 2. Kopiujemy zbudowany backend do /app/dist
COPY --from=builder /app/backend/dist ./dist

# 3. Kopiujemy zbudowany frontend do katalogu głównego /dist
# W server.ts masz: path.join(__dirname, '../../dist')
# Jeśli server.js jest w /app/dist/server.js, to:
# ../ = /app
# ../../ = /
# Czyli szuka w /dist
COPY --from=builder /app/dist /dist

# 4. Tworzymy katalog na uploady (jeśli jest potrzebny)
RUN mkdir -p /uploads && chown node:node /uploads

# 5. Ustawiamy zmienne środowiskowe i port
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# 6. Uruchamiamy serwer
CMD ["node", "dist/server.js"]