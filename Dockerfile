# Stage 1: Build the React frontend
FROM node:20-alpine AS build-frontend
WORKDIR /usr/src/app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup the backend and serve
FROM node:20-alpine
WORKDIR /usr/src/app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from Stage 1 into backend/public
COPY --from=build-frontend /usr/src/app/frontend/dist ./backend/public

# Set working directory to backend where server.js lives
WORKDIR /usr/src/app/backend

# Expose the API and Web port
EXPOSE 3012

# Start the server
CMD ["node", "server.js"]
