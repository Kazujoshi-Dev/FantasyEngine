FROM node:20-alpine

WORKDIR /app

# 1. Kopiowanie plików definicji pakietów (dla root i backendu)
COPY package*.json ./
COPY backend/package*.json ./backend/

# 2. Instalacja zależności
RUN npm install
RUN cd backend && npm install

# 3. Kopiowanie całego kodu źródłowego
COPY . .

# 4. Budowanie aplikacji
# To jest kluczowy moment: budujemy frontend (Vite -> dist) oraz backend (TSC -> backend/dist)
RUN npm run build:frontend
RUN npm run build:backend

# 5. Konfiguracja środowiska
ENV NODE_ENV=production
ENV PORT=3001

# 6. Otwarcie portu
EXPOSE 3001

# 7. Uruchomienie serwera
CMD ["npm", "start"]