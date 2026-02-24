FROM node:20-bullseye

WORKDIR /app

# Install server dependencies first (layer caching)
COPY package*.json ./
RUN npm install

# Install and build client
COPY client/package*.json ./client/
RUN npm install --prefix client

COPY . .
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 3001
ENV NODE_ENV=production

CMD ["npm", "start"]
