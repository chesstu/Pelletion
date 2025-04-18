# Pelletion Twitch Website

This is the deployment package for the Pelletion Twitch website.

## Quick Start

1. Install dependencies:
   ```
   npm install --production
   ```

2. Copy `.env.example` to `.env` and update the values with your actual credentials:
   ```
   cp .env.example .env
   nano .env  # Edit with your actual values
   ```

3. Start the application:
   ```
   node dist/index.js
   ```

4. For production use, consider using a process manager like PM2:
   ```
   npm install -g pm2
   pm2 start dist/index.js --name pelletion-website
   ```

## Features

- Live stream status display with Twitch integration
- Battle request system with time slot selection
- Email notifications for battle requests
- Admin approval/rejection of battle requests
- Twitch clips showcase

## Required Environment Variables

- `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`: Get from [Twitch Developer Console](https://dev.twitch.tv/console/apps)
- `RESEND_API_KEY`: Get from [Resend](https://resend.com)
- `ADMIN_EMAIL`: Your email address for admin notifications
- `SESSION_SECRET`: Any random string for session security

## Detailed Deployment Guide

For more detailed deployment instructions, see the included `EXPORT_GUIDE.md` file.