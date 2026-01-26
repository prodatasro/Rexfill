# Paddle Webhook Setup with LocalTunnel

## Overview
This guide explains how to expose your local development server to Paddle for webhook testing using LocalTunnel.

## Setup Steps

### 1. Start Your Development Server
In one terminal window, run:
```powershell
npm run dev
```

This starts your Vite development server on `http://localhost:5173`

### 2. Start LocalTunnel
In a **second terminal window**, run:
```powershell
npm run tunnel
```

This will:
- Expose your local port 5173 to the internet
- Use the subdomain `rexfill-paddle-webhook`
- Display a public URL that looks like: `https://rexfill-paddle-webhook.loca.lt`

**Important**: The first time you visit a localtunnel URL in your browser, you'll see a warning page. Click "Continue" to proceed.

### 3. Configure Paddle Webhook URL

Use this **EXACT URL** in your Paddle Dashboard:

```
https://rexfill-paddle-webhook.loca.lt/paddle-webhook
```

**Breakdown:**
- `https://rexfill-paddle-webhook.loca.lt` - Your public tunnel URL
- `/paddle-webhook` - The function path configured in juno.config.ts

### 4. Register in Paddle Dashboard

1. Go to [Paddle Dashboard](https://sandbox-vendors.paddle.com) (Sandbox)
2. Navigate to **Developer Tools** → **Notifications**
3. Click **Add Notification Destination**
4. Enter the webhook URL: `https://rexfill-paddle-webhook.loca.lt/paddle-webhook`
5. Select these events:
   - `subscription.created`
   - `subscription.updated`
   - `subscription.activated`
   - `subscription.canceled`
   - `subscription.past_due`
   - `subscription.paused`
6. Save the configuration
7. Use "Send Test Event" to verify the webhook is working

### 5. Monitor Webhook Calls

Watch your development server console for webhook events:
```
Paddle webhook received: subscription.created abc123
Subscription subscription.created for user_xyz
```

## Important Notes

### Subdomain Consistency
The `--subdomain rexfill-paddle-webhook` flag ensures you get the same URL each time. Without it, localtunnel generates random URLs.

### Keep Both Terminals Running
- Terminal 1: `npm run dev` (Vite server)
- Terminal 2: `npm run tunnel` (LocalTunnel)

Both must be running for webhooks to work.

### Webhook Secret
Your webhook secret is configured in `.env`:
```
PADDLE_WEBHOOK_SECRET=ntfset_01kfrsb12zmvqzz792m7jv2dc4
```

This secret is used to verify webhook signatures and ensure requests come from Paddle.

### Limitations
- LocalTunnel connections can be unstable for long sessions
- Free tier has rate limits
- Not suitable for production (use deployed Juno satellite URL for production)

## Testing Webhooks

### Manual Test
1. Make a test purchase in Paddle sandbox checkout
2. Watch the console for webhook events
3. Check that subscription data is saved in Juno datastore

### Paddle Test Events
Use Paddle's "Send Test Event" feature in the dashboard to send sample webhook payloads without making actual purchases.

## Production Webhook URL

For production, use your deployed Juno satellite URL:
```
https://ufqml-byaaa-aaaas-amtia-cai.icp0.io/paddle-webhook
```

Register this in Paddle's production dashboard when you're ready to go live.

## Troubleshooting

### Webhook not receiving events
1. Verify both terminals are running
2. Check the tunnel URL is accessible: `curl https://rexfill-paddle-webhook.loca.lt`
3. Ensure `/paddle-webhook` is appended to the URL
4. Check Paddle dashboard notification logs for errors

### Signature verification failed
1. Verify `PADDLE_WEBHOOK_SECRET` in `.env` matches Paddle dashboard
2. Check webhook secret hasn't been regenerated in Paddle

### Tunnel disconnected
Restart the tunnel:
```powershell
npm run tunnel
```

The subdomain will remain the same, so you don't need to update Paddle.
