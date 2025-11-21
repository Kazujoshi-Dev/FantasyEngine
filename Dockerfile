# Etap 1: Instalacja zależności (dla lepszego cache'owania)
FROM node:18-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci
RUN npm ci --prefix backend

# Etap 2: Budowanie aplikacji (frontend i backend)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY . .
# Ta komenda buduje zarówno frontend (Vite), jak i kompiluje backend (TypeScript)
RUN npm run build

# Etap 3: Stworzenie finalnego, lekkiego obrazu produkcyjnego
FROM base as runner
WORKDIR /app

# Kopiujemy tylko niezbędne, zbudowane pliki
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/package-lock.json ./backend/package-lock.json

# Instalujemy tylko zależności produkcyjne dla backendu
RUN npm ci --prefix backend --omit=dev

# Ustawiamy komendę startową dla serwera backendowego
CMD ["npm", "start", "--prefix", "backend"]
