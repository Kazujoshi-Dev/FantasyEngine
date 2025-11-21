# ===================================================================================
# ETAP 1: "Builder" - Budowanie aplikacji w czystym środowisku
# ===================================================================================
# Używamy lekkiego obrazu Node.js jako tymczasowego środowiska do budowania.
# Nazywamy ten etap "builder", aby móc się do niego później odwołać.
FROM node:20-alpine AS builder

# Ustawiamy katalog roboczy wewnątrz kontenera.
WORKDIR /app

# Kopiujemy pliki package.json i package-lock.json (jeśli istnieje) z głównego folderu i z folderu backend.
# Robimy to jako pierwszy krok, aby wykorzystać cache'owanie warstw Dockera.
# Instalacja zależności zostanie pominięta, jeśli te pliki się nie zmienią.
COPY package*.json ./
COPY backend/package*.json backend/

# Instalujemy wszystkie zależności (włącznie z devDependencies) potrzebne do budowania.
RUN npm install
RUN npm install --prefix backend

# Kopiujemy resztę kodu źródłowego aplikacji.
COPY . .

# Uruchamiamy skrypt budowania, który kompiluje frontend (do /dist) i backend (do /backend/dist).
# Ten krok tworzy brakujący plik server.js.
RUN npm run build

# ===================================================================================
# ETAP 2: "Runtime" - Tworzenie finalnego, lekkiego obrazu produkcyjnego
# ===================================================================================
# Zaczynamy od nowa, z tego samego lekkiego obrazu Node.js.
FROM node:20-alpine

WORKDIR /app

# Kopiujemy tylko pliki package.json z backendu.
COPY backend/package*.json backend/

# Instalujemy WYŁĄCZNIE produkcyjne zależności dla backendu.
# To sprawia, że finalny obraz jest znacznie mniejszy i bezpieczniejszy.
RUN npm install --prefix backend --omit=dev

# Kopiujemy skompilowany kod backendu z etapu "builder".
# To jest kluczowy krok, który umieszcza gotowy plik server.js w finalnym obrazie.
COPY --from=builder /app/backend/dist ./backend/dist

# Kopiujemy zbudowane pliki statyczne frontendu z etapu "builder".
COPY --from=builder /app/dist ./dist

# Tworzymy folder na wgrane pliki, aby istniał, nawet jeśli wolumen nie jest jeszcze podpięty.
COPY --from=builder /app/uploads ./uploads

# Ustawiamy zmienną środowiskową, aby Node.js działał w trybie produkcyjnym.
ENV NODE_ENV=production

# Otwieramy port, na którym nasłuchuje nasza aplikacja.
EXPOSE 3001

# Definiujemy domyślną komendę, która uruchomi serwer po starcie kontenera.
CMD ["npm", "start", "--prefix", "backend"]
