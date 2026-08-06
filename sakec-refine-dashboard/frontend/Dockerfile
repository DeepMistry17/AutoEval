# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# 1. Lock in the cache: Copy packages and install FIRST
COPY package*.json ./
RUN npm install --legacy-peer-deps

# 2. Inject Variables AFTER the install so they don't break the cache
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_AZURE_REDIRECT_URI

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# 3. Copy the rest of the code and build
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing: redirect all paths to index.html
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]