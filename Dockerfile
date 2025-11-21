# Etap 1: Budowanie aplikacji (Build stage)
FROM node:20-alpine AS builder

WORKDIR /app

# Kopiowanie plików package.json
COPY package.json ./
COPY backend/package.json ./backend/

# Instalacja zależności (w tym esbuild i typescript)
RUN npm install
RUN cd backend && npm install

# Kopiowanie kodu źródłowego
COPY . .

# Budowanie frontendu (do /dist) i backendu (do /backend/dist)
RUN npm run build

# Etap 2: Obraz produkcyjny (Production stage)
FROM node:20-alpine

WORKDIR /app

# Kopiowanie package.json backendu
COPY backend/package.json ./backend/

# Instalacja tylko produkcyjnych zależności dla backendu
RUN cd backend && npm install --omit=dev

# Kopiowanie zbudowanych plików z etapu 1
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend/dist ./backend/dist

# Utworzenie katalogu na uploady
RUN mkdir -p uploads

# Ustawienie zmiennych środowiskowych
ENV NODE_ENV=production
ENV PORT=3001

# Eksponowanie portu
EXPOSE 3001

# Uruchomienie serwera
CMD ["node", "backend/dist/server.js"]
