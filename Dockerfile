# --- ETAP 1: Budowanie aplikacji (Builder) ---
# Używamy oficjalnego obrazu Node.js w wersji 20 z Alpine Linux jako lekkiej bazy.
# Nazwaliśmy ten etap "builder", aby móc się do niego odwołać później.
FROM node:20-alpine AS builder

# Ustawiamy katalog roboczy wewnątrz kontenera na /app
WORKDIR /app

# Kopiujemy pliki package.json z głównego katalogu i z backendu.
# Robimy to jako osobny krok, aby wykorzystać buforowanie warstw Dockera.
# Jeśli te pliki się nie zmienią, Docker nie będzie ponownie instalował zależności.
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalujemy wszystkie zależności (w tym deweloperskie, potrzebne do budowania)
RUN npm install
RUN npm install --prefix backend

# Kopiujemy resztę kodu źródłowego aplikacji
COPY . .

# Uruchamiamy skrypt budujący, który tworzy frontend i backend
RUN npm run build


# --- ETAP 2: Obraz produkcyjny (Finalny) ---
# Zaczynamy od nowa z czystym, lekkim obrazem Node.js
FROM node:20-alpine

# Ustawiamy katalog roboczy
WORKDIR /app

# Kopiujemy pliki package.json z backendu, aby zainstalować tylko zależności produkcyjne
COPY backend/package*.json ./backend/

# Instalujemy TYLKO zależności produkcyjne dla backendu
RUN npm install --prefix backend --omit=dev

# Kopiujemy zbudowane pliki z etapu "builder"
# Kopiujemy zbudowany frontend (katalog /dist)
COPY --from=builder /app/dist ./dist
# Kopiujemy zbudowany backend (katalog /backend/dist)
COPY --from=builder /app/backend/dist ./backend/dist

# Ustawiamy zmienną środowiskową dla portu, na którym nasłuchuje aplikacja
ENV PORT=3001

# Odsłaniamy port, aby można było się połączyć z aplikacją z zewnątrz kontenera
EXPOSE 3001

# Definiujemy domyślną komendę, która zostanie uruchomiona po starcie kontenera
# Uruchamia ona serwer Node.js
CMD ["node", "backend/dist/server.js"]