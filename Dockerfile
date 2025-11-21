# Etap 1: Budowanie frontendu
FROM node:18-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:frontend

# Etap 2: Budowanie backendu
FROM node:18-alpine AS backend-builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend
COPY backend/. ./backend/
RUN npm run build --prefix backend

# Etap 3: Finalny obraz produkcyjny
FROM node:18-alpine AS runner
WORKDIR /app

# Kopiowanie zależności produkcyjnych backendu
COPY --from=backend-builder /app/backend/package.json ./backend/package.json
COPY --from=backend-builder /app/backend/package-lock.json ./backend/package-lock.json
RUN npm ci --prefix backend --omit=dev

# Kopiowanie zbudowanego kodu
COPY --from=frontend-builder /app/dist ./dist
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Ustawienie zmiennej środowiskowej i komendy startowej
ENV NODE_ENV=production
CMD ["npm", "start", "--prefix", "backend"]
