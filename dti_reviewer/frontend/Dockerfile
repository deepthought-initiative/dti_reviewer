FROM node:18-alpine AS builder
WORKDIR /app

# 1) Install dependencies
COPY package*.json ./
RUN npm ci

# 2) Copy source and build
COPY . .
RUN npm run build    # outputs to /app/dist

# ─── Stage 2: Serve with Nginx ─────────────────────────────────
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# 3) Clear default content
RUN rm -rf ./*

# 4) Copy custom Nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# 5) Copy built static files
COPY --from=builder /app/dist .

# 6) Expose HTTP port
EXPOSE 80

# 7) Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
