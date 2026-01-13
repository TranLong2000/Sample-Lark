# Lark Bot Webhook for Railway

## Endpoint

POST /lark/webhook

## Feature

- Handles Lark URL verification (challenge)
- Works on Railway
- Supports event subscription

## Deploy

1. Push repo to GitHub
2. Create new project in Railway → Deploy from GitHub
3. Expose port automatically by Railway
4. Get public domain URL
5. Paste URL into:

Lark Developer → Event Subscription → Request URL
