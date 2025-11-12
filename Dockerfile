# === ETAP 1: Budowanie aplikacji ===
# Używamy pełnego obrazu Node.js do zbudowania naszej aplikacji TypeScript.
# 'builder' to nazwa tego etapu, której użyjemy później.
FROM node:20-alpine AS builder

# Ustawiamy katalog roboczy wewnątrz kontenera
WORKDIR /app

# Kopiujemy pliki package.json i package-lock.json z folderu backend
# Kopiujemy je najpierw, aby wykorzystać cache'owanie warstw Dockera.
# Instalacja zależności uruchomi się ponownie tylko, gdy te pliki się zmienią.
COPY backend/package*.json ./

# Instalujemy wszystkie zależności, włącznie z deweloperskimi (np. typescript)
RUN npm install

# Kopiujemy resztę kodu źródłowego z folderu backend
COPY backend/ ./

# Uruchamiamy skrypt budujący, który kompiluje TypeScript do JavaScript
# i umieszcza go w folderze /app/dist
RUN npm run build

# === ETAP 2: Tworzenie finalnego obrazu produkcyjnego ===
# Zaczynamy od nowa, używając lekkiego obrazu Node.js.
FROM node:20-alpine

# Ustawiamy katalog roboczy
WORKDIR /app

# Kopiujemy pliki package.json i package-lock.json z folderu backend
COPY backend/package*.json ./

# Instalujemy TYLKO zależności produkcyjne. To znacznie zmniejsza rozmiar finalnego obrazu.
RUN npm install --omit=dev

# Kopiujemy skompilowany kod z etapu 'builder' do naszego finalnego obrazu.
# To jest kluczowy krok - nie kopiujemy kodu źródłowego, tylko gotowy build.
COPY --from=builder /app/dist ./dist

# Ustawiamy port, na którym nasza aplikacja będzie nasłuchiwać
EXPOSE 3001

# Definiujemy komendę, która uruchomi serwer po starcie kontenera
# Odpowiada to skryptowi "start" w package.json: "node dist/server.js"
CMD [ "node", "dist/server.js" ]
