# === Etap 1: Budowanie (Builder) ===
# Używamy lekkiego obrazu Node.js do zbudowania naszej aplikacji.
FROM node:20-alpine AS builder

# Ustawiamy katalog roboczy w kontenerze
WORKDIR /app

# Kopiujemy pliki package.json i package-lock.json, aby zoptymalizować cache'owanie warstw
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalujemy wszystkie zależności (włącznie z deweloperskimi, potrzebnymi do budowania)
# Najpierw dla backendu, potem dla roota
RUN npm install --prefix backend
RUN npm install

# Kopiujemy resztę kodu źródłowego
COPY . .

# Uruchamiamy skrypt budujący, który skompiluje frontend i backend
# To jest kluczowy krok, który tworzy brakujący katalog /backend/dist
RUN npm run build

# === Etap 2: Produkcja (Production) ===
# Zaczynamy od świeżego, jeszcze mniejszego obrazu Node.js
FROM node:20-alpine

WORKDIR /app

# Kopiujemy pliki package.json z głównego katalogu i backendu
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalujemy TYLKO zależności produkcyjne, aby zmniejszyć rozmiar finalnego obrazu
RUN npm install --omit=dev --prefix backend
RUN npm install --omit=dev

# Kopiujemy zbudowany backend z etapu "builder"
COPY --from=builder /app/backend/dist ./backend/dist

# Kopiujemy zbudowany frontend z etapu "builder"
COPY --from=builder /app/dist ./dist

# Kopiujemy katalog na uploadowane pliki
COPY ./uploads ./uploads

# Upewniamy się, że uprawnienia do katalogu uploads są poprawne (opcjonalne, ale dobra praktyka)
RUN chown -R node:node /app/uploads

# Zmieniamy użytkownika na mniej uprzywilejowanego dla bezpieczeństwa
USER node

# Ustawiamy port, na którym będzie działać aplikacja
EXPOSE 3001

# Komenda startowa, która uruchomi serwer backendowy
# Używamy skryptu startowego z package.json
CMD ["npm", "start"]
