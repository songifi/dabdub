FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/config/chains', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["npm", "run", "start:prod"]
