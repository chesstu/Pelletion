#!/bin/bash

# Simple setup script for Pelletion Twitch Website
# This script helps set up the environment on a fresh deployment

# Make script exit if a command fails
set -e

echo "Setting up Pelletion Twitch Website..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please edit the .env file with your credentials before continuing"
    echo "Run: nano .env"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Set permissions
echo "Setting permissions..."
chmod +x dist/index.js

echo "Setup complete!"
echo "You can now start the server with: node dist/index.js"
echo ""
echo "For production use, we recommend using PM2:"
echo "npm install -g pm2"
echo "pm2 start dist/index.js --name pelletion-website"