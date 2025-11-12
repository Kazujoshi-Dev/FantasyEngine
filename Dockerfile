# Etap 1: Budowanie aplikacji (frontend i backend)
FROM node:20-alpine AS build

# Ustawienie katalogu roboczego w kontenerze
WORKDIR /app

# Kopiowanie plików package.json, aby zoptymalizować warstwy cache'owania
# Najpierw kopiujemy pliki zależności, aby uniknąć ponownej instalacji przy każdej zmianie kodu
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalacja wszystkich zależności (dla roota i dla backendu)
RUN npm install
RUN npm install --prefix backend

# Kopiowanie reszty plików źródłowych aplikacji
COPY . .

# Uruchomienie skryptu budującego całą aplikację (frontend i backend)
# Ten skrypt powinien być zdefiniowany w głównym package.json
RUN npm run build

# Etap 2: Tworzenie lekkiego obrazu produkcyjnego
FROM node:20-alpine AS production

WORKDIR /app

# Kopiowanie tylko niezbędnych, zbudowanych plików z etapu 'build'
COPY --from=build /app/dist ./dist
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/package.json ./

# Instalacja tylko zależności produkcyjnych dla backendu
RUN npm install --prefix backend --only=production

# Ustawienie zmiennej środowiskowej na 'production'
ENV NODE_ENV=production

# Port, na którym będzie działał serwer (opcjonalne, ale dobra praktyka)
EXPOSE 3001

# Komenda uruchamiająca serwer backendowy, który serwuje również frontend
CMD ["npm", "start", "--prefix", "backend"]
