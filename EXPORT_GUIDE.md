# Pelletion Twitch Website - Export Guide

This document explains how to export and deploy your Twitch streaming website to your own hosting plan.

## Project Overview

This is a full-stack JavaScript application with:
- React frontend (using Vite)
- Node.js backend (using Express)
- In-memory storage (can be replaced with a database)
- Twitch API integration
- Email notification system (using Resend)

## Prerequisites for Deployment

1. A hosting service that supports Node.js applications
2. Your Twitch API credentials
3. Your Resend API key for email functionality
4. Basic knowledge of server management and deployment

## Deployment Options

### Option 1: Traditional Web Hosting with Node.js Support

Many hosting providers offer Node.js hosting plans. Examples include:
- [Heroku](https://www.heroku.com/)
- [DigitalOcean](https://www.digitalocean.com/)
- [Render](https://render.com/)
- [Railway](https://railway.app/)
- [Vercel](https://vercel.com/)

### Option 2: VPS (Virtual Private Server)

If you have a VPS with root access, you can deploy manually:
- AWS EC2
- DigitalOcean Droplet
- Linode
- Vultr

## Export and Deployment Steps

### 1. Build the Project

The build has already been created in the `dist` directory with:
```bash
npm run build
```

This creates:
- Frontend files in `dist/public/`
- Backend bundled in `dist/index.js`

### 2. Environment Variables to Configure

Make sure to set these environment variables on your hosting platform:

```
# Required for Twitch integration
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# Required for email notifications
RESEND_API_KEY=your_resend_api_key
ADMIN_EMAIL=your_admin_email

# For security (generate a random string)
SESSION_SECRET=your_random_secret_string
```

### 3. Deployment Steps for Different Platforms

#### Heroku Deployment

1. Install the Heroku CLI
2. Log in to Heroku: `heroku login`
3. Create a new Heroku app: `heroku create pelletion-website`
4. Add a Procfile with: `web: node dist/index.js`
5. Set environment variables: `heroku config:set TWITCH_CLIENT_ID=your_id`
6. Push to Heroku: `git push heroku main`

#### DigitalOcean App Platform

1. Connect your GitHub repository
2. Select the repository
3. Choose Node.js as your runtime
4. Set the build command to `npm run build`
5. Set the run command to `node dist/index.js`
6. Configure environment variables
7. Deploy

#### VPS Manual Deployment

1. Copy the `dist` folder to your server
2. Install Node.js on your server
3. Install PM2: `npm install -g pm2`
4. Set up environment variables
5. Start the server: `pm2 start dist/index.js`
6. Configure Nginx as a reverse proxy (sample config below)

### 4. Nginx Configuration (for VPS)

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Installing Dependencies on Your Server

If deploying manually, install dependencies:

```bash
npm install --production
```

### 6. Using a Package for Easy Deployment

For simplified deployment, you can create a package containing only the necessary files:

1. Create a new directory: `mkdir deploy-package`
2. Copy the build files: `cp -r dist deploy-package/`
3. Copy package.json: `cp package.json deploy-package/`
4. Create a .env file template: `cp .env.example deploy-package/`
5. Copy this guide: `cp EXPORT_GUIDE.md deploy-package/`
6. Create a zip archive: `zip -r pelletion-website.zip deploy-package/`

You can then upload this zip file to your hosting provider.

## Database Consideration

The current implementation uses in-memory storage. If you need persistence:

1. Set up a PostgreSQL database on your hosting provider
2. Update your code to use a database adapter
3. Run migrations to create the necessary tables

## Domain and SSL

After deployment:

1. Configure your custom domain with your hosting provider
2. Set up SSL/TLS certificates (many providers offer Let's Encrypt integration)

## Troubleshooting

- If the site doesn't load, check server logs
- Verify all environment variables are set correctly
- Ensure the Node.js version is compatible (v18+ recommended)
- Check firewall settings if using a VPS

## Need Additional Help?

For hosting-specific questions, refer to your hosting provider's documentation or support.