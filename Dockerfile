# Stage 1: Install dependencies for both frontend and backend
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package.json files
COPY package.json ./
COPY backend/package.json ./backend/

# Install all dependencies (including dev dependencies needed for building)
RUN npm install
RUN npm install --prefix backend

# Stage 2: Build the frontend
FROM deps AS build-frontend
# Copy all source files
COPY . .
# Run the frontend build script
RUN npm run build:frontend

# Stage 3: Build the backend
FROM deps AS build-backend
# Copy all source files
COPY . .
# Run the backend build script
RUN npm run build:backend

# Stage 4: Final production image
FROM node:20-alpine
WORKDIR /app

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3001

# Copy backend's package.json and install only production dependencies
COPY backend/package.json ./backend/
RUN npm install --prefix backend --omit=dev

# Copy the built backend application from the build-backend stage
COPY --from=build-backend /app/backend/dist ./backend/dist

# Copy the built frontend application from the build-frontend stage
COPY --from=build-frontend /app/dist ./dist

# Expose the port the backend server will run on
EXPOSE 3001

# The start command is based on the scripts in package.json
# It runs the server from the project root directory
CMD ["node", "backend/dist/backend/src/server.js"]

