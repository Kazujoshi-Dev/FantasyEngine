# Use Node.js as the base image for building
FROM node:20 AS builder

# Set the working directory for the build
WORKDIR /app

# Copy the package.json and package-lock.json from the root (frontend)
COPY package*.json ./

# Install dependencies for frontend
# Use --legacy-peer-deps to avoid potential conflicts with older packages if needed,
# though React 19 is quite new so standard install is usually fine.
# For this environment, we'll stick to ci for cleaner installs.
RUN npm ci

# Copy the frontend source code
# Since we are in the root of the project conceptually for the user,
# we copy everything excluding what's in .dockerignore (like node_modules, backend)
COPY . .

# Build the frontend application using Vite
RUN npm run build:frontend

# --- Backend Stage ---
FROM node:20

# Set working directory for the backend
WORKDIR /app/backend

# Copy the backend package files
# Assuming the user provided backend/package.json exists
COPY backend/package*.json ./

# Install backend dependencies
RUN npm ci

# Copy the rest of the backend source code
COPY backend/ ./

# Copy the built frontend static files to the backend's distribution folder
# The backend is configured to serve static files from ../dist (relative to its own execution context usually)
# or we can put it inside backend/dist if we adjust server.ts
# Let's align with server.ts: app.use(express.static(path.join(__dirname, '../../dist')));
# This means if server is running from /app/backend/dist/server.js, it looks for /app/dist.
# So we should copy the build output to /app/dist in the final image.

# Let's set up the final structure:
# /app/dist (Frontend static files)
# /app/backend (Backend code)

WORKDIR /app

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy backend source (already installed) from the previous step context?
# Actually, it's cleaner to just rebuild backend here or copy from a backend-builder stage.
# But for simplicity, let's just finish setting up the backend here.

WORKDIR /app/backend
# Re-copy backend files because we switched context
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./

# Build the backend TypeScript code
RUN npm run build

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
# We run the compiled JS from the backend dist folder
CMD ["node", "dist/server.js"]