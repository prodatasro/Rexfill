# Paddle API Configuration

This document describes how to configure Paddle API credentials for subscription polling.

## Overview

Rexfill uses Paddle's REST API to poll subscription status instead of webhooks. This requires:
- Paddle API keys stored in Juno's `secrets` datastore collection
- Admin UI for managing credentials
- Serverless poller function that calls Paddle API

## Initial Setup

### 1. Get Paddle API Keys

1. Go to [Paddle Vendor Dashboard](https://vendors.paddle.com)
2. Navigate to **Developer Tools → Authentication**
3. Create or copy your API keys:
   - **Sandbox API Key** (for development/testing)
   - **Production API Key** (for live environment)

### 2. Configure Secrets in Admin Dashboard

1. **Login as Platform Admin**
   - Only users in the `platform_admins` collection can configure secrets
   
2. **Navigate to Admin Dashboard**
   - Go to `/admin/dashboard` in your Rexfill app
   - Look for the **API Credentials** section

3. **Add Paddle API Keys**
   
   Click **Add Secret** and configure:
   
   **For Development:**
   - **Key:** `PADDLE_API_KEY_DEV`
   - **Value:** Your Paddle Sandbox API key (from vendors.paddle.com)
   - **Description:** "Paddle Sandbox API key for development"
   
   **For Production:**
   - **Key:** `PADDLE_API_KEY_PROD`
   - **Value:** Your Paddle Production API key
   - **Description:** "Paddle Production API key"

### 3. Verify Configuration

After adding secrets:
- The poller function will auto-detect environment based on available keys
- If `PADDLE_API_KEY_PROD` exists, it uses production API
- If only `PADDLE_API_KEY_DEV` exists, it uses sandbox API
- Missing both keys will return error `MISSING_API_KEY`

## How It Works

### Polling Flow

1. **User completes checkout** → Paddle fires `paddle:checkout-completed` event
2. **Frontend calls poller** → POST `/api/poll-subscription` with subscription ID
3. **Poller retrieves API key** → Fetches from `secrets` collection
4. **Poller calls Paddle API** → GET `/subscriptions/{id}` with auth header
5. **Updates datastore** → Stores subscription in `subscriptions` collection
6. **Broadcasts update** → Multi-tab sync via localStorage

### Retry Logic

**Immediate Polling (Post-Checkout):**
- 10 retry attempts with exponential backoff (1s, 2s, 4s, 8s, 16s...)
- Handles "subscription not found" (expected right after payment)
- Shows user feedback: "Payment confirmed, updating subscription..."

**Background Polling (Fallback):**
- If immediate polling fails, polls every 30 seconds
- Continues for max 30 minutes or until success
- User sees: "Subscription will update shortly"
- After 30 minutes: Shows manual refresh button

### Rate Limiting

- **Normal requests:** 10 calls per user per minute
- **Post-checkout requests:** Exempt from rate limiting
- **Admin refresh:** Subject to rate limits
- Exceeded limit returns: `429 Too Many Requests`

### Caching

- 5-minute in-memory cache per subscription
- `forceRefresh: true` bypasses cache
- Cache shared across same satellite instance
- Reduces Paddle API calls and stays under rate limits

## Environment Detection

The poller automatically determines environment:

```typescript
// Priority: Production key > Development key
if (PADDLE_API_KEY_PROD exists) {
  environment = 'production'
  baseUrl = 'https://api.paddle.com/v1'
} else if (PADDLE_API_KEY_DEV exists) {
  environment = 'development'
  baseUrl = 'https://sandbox-api.paddle.com/v1'
} else {
  error = 'MISSING_API_KEY'
}
```

## Security

### Storage
- Secrets stored in Juno `secrets` collection
- Collection permissions: `read: 'managed'`, `write: 'managed'`
- Only satellite and platform admins can access
- Values encrypted at rest by Internet Computer

### Access Logging
- All API key access logged to `security_events` collection
- Includes timestamp, caller, environment, action
- Suspicious access triggers admin notifications

### Best Practices
- **Never commit API keys to git**
- **Use different keys for dev/prod**
- **Rotate keys periodically**
- **Monitor `security_events` for unauthorized access**

## Manual Refresh

### For Users (Profile/Billing Page)
```typescript
import { useSubscription } from '../contexts/SubscriptionContext';

const { refreshSubscription } = useSubscription();

// Call on button click
await refreshSubscription();
```

### For Admins (Users Page)
- Click refresh icon next to user's plan badge
- Manually poll Paddle API for that user's subscription
- Useful for troubleshooting or immediate sync

## API Endpoints

### Poll Subscription
```
POST /api/poll-subscription

Request Body:
{
  "subscriptionId": "sub_01h...",
  "forceRefresh": true,        // Optional, bypasses cache
  "isPostCheckout": true       // Optional, exempts from rate limit
}

Success Response (200):
{
  "data": { ...paddleSubscription },
  "updated": true,
  "environment": "production"
}

Error Responses:
- 400: Missing subscriptionId
- 404: Subscription not found in Paddle
- 429: Rate limit exceeded
- 500: Missing API key or API error
```

## Troubleshooting

### Error: "MISSING_API_KEY"
**Cause:** No Paddle API key configured in secrets
**Fix:** Add `PADDLE_API_KEY_DEV` or `PADDLE_API_KEY_PROD` in Admin Dashboard

### Error: "SUBSCRIPTION_NOT_FOUND"
**Cause:** Subscription doesn't exist in Paddle yet (common right after checkout)
**Fix:** Wait a few seconds, automatic retry will handle it

### Error: "RATE_LIMIT_EXCEEDED"
**Cause:** Too many refresh attempts in 1 minute
**Fix:** Wait 60 seconds before trying again

### Subscription not updating after payment
1. Check `secrets` collection has valid API key
2. Check `security_events` for API errors
3. Try manual refresh button
4. Verify Paddle subscription exists in vendor dashboard
5. Check browser console for polling errors

## Migration from Webhooks

If migrating from the old webhook system:

1. **Keep webhook secrets** (optional, for backwards compatibility):
   - `PADDLE_WEBHOOK_SECRET_DEV`
   - `PADDLE_WEBHOOK_SECRET_PROD`

2. **Deploy updated satellite:**
   ```bash
   npm run build
   juno deploy
   ```

3. **Add API credentials** via Admin Dashboard

4. **Test checkout flow** in sandbox environment

5. **Monitor `security_events`** for any issues

6. **Remove webhook configuration** from Paddle dashboard once stable

## Support

For issues or questions:
- Check `security_events` collection for error details
- Review browser console during checkout
- Contact support with subscription ID and timestamp
