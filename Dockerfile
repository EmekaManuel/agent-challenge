# Use lightweight Node.js image instead of Ollama
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY .env.docker package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy the rest of the application
COPY . .

# Build the project
RUN pnpm run build

# Expose the port
EXPOSE 8080

# Start the application directly (no Ollama needed)
CMD ["node", ".mastra/output/index.mjs"]