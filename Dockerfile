# Use Node.js 18 as the base image
FROM node:18

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY server/package*.json ./

# Install server dependencies
RUN npm install

# Copy the entire server code into the container
COPY server/ ./

# Expose port 8000 (or the port your server is using)
EXPOSE 8000

# Run the server start command when the container starts
CMD ["npm", "start"]