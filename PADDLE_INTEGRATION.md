# Paddle Integration via Motoko Proxy Canister

## Architecture Overview

```
┌─────────────┐
│   Paddle    │ Sends webhooks & API responses
└──────┬──────┘
       │
       │ HTTPS Webhook
       ▼
┌──────────────────────────────┐
│  RexfillProxy_backend (Motoko)       │
│  - Receives webhooks         │
│  - HTTP outcalls to Paddle   │
│  - Caching (5-min TTL)       │
│  - Rate limiting (10 req/min)│
│  - HMAC signature verify     │
└──────────────┬───────────────┘
               │
               │ Inter-canister calls
               ▼
┌──────────────────────────────┐
│  Juno Satellite (TypeScript) │
│  - paddle_sync_triggers hook │
│  - Calls Motoko canister     │
│  - Updates subscriptions     │
└──────────────┬───────────────┘
               │
               │ Updates
               ▼
┌──────────────────────────────┐
│  Juno Datastore              │
│  - subscriptions collection  │
│  - user data                 │
└──────────────────────────────┘
```

## Components

### 1. RexfillProxy_backend Motoko Canister
**Location:** Separate project (`~/RexfillProxy_backend`)
**Language:** Motoko
**Purpose:** Handle HTTP outcalls to Paddle API (TypeScript satellites can't do this)

**Key Features:**
- ✅ HTTP webhook receiver endpoint: `/webhook`
- ✅ HMAC SHA256 signature verification
- ✅ Paddle API HTTP outcalls (`GET /subscriptions/*`)
- ✅ Response caching (5-minute TTL, survives upgrades)
- ✅ Rate limiting (10 requests/minute per user)
- ✅ Access control (whitelisted callers only)
- ✅ Webhook event storage (last 100 events)

**Endpoints:**
- `querySubscription(subscriptionId, userId, bypassCache, bypassRateLimit)` → Paddle subscription JSON
- `querySubscriptionByUserId(userId, bypassCache, bypassRateLimit)` → Paddle subscriptions list
- `getWebhookEvents(limit)` → Recent webhook events
- `markWebhookProcessed(eventId)` → Mark webhook as processed
- `health()` → Canister health check

### 2. Rexfill Satellite Integration
**Location:** `src/satellite/`
**Language:** TypeScript

**Modified Files:**
- ✅ `src/satellite/paddle-poller.ts` - Calls Motoko canister instead of HTTP directly
- ✅ `src/satellite/motoko-proxy-types.ts` - TypeScript types matching Candid interface
- ✅ `src/satellite/index.ts` - Hook for `paddle_sync_triggers` (already set up)

**Flow:**
1. User completes Paddle checkout → redirected with `?success=true`
2. Frontend calls `refreshSubscription()` in `SubscriptionContext`
3. Creates trigger document in `paddle_sync_triggers` collection
4. Satellite `onSetDoc` hook fires
5. Calls `fetchPaddleSubscriptionByUserId()` → Calls Motoko canister
6. Motoko canister queries Paddle API
7. Returns subscription data → Updates `subscriptions` collection

### 3. Webhook Flow
**URL:** `https://<MOTOKO_CANISTER_ID>.raw.icp0.io/webhook`

1. Paddle sends webhook to Motoko canister
2. Canister verifies HMAC signature
3. Stores event in stable storage
4. Juno satellite can poll `getWebhookEvents()` for processing
5. Mark events as processed via `markWebhookProcessed()`

## Setup Instructions

See [MOTOKO_PROXY_SETUP.md](MOTOKO_PROXY_SETUP.md) for detailed setup steps.

**Quick Start:**
1. Deploy Motoko canister: `dfx deploy --network ic`
2. Add yourself as admin: `dfx canister call RexfillProxy_backend addAdmin '(principal "...")'`
3. Configure Paddle keys: `dfx canister call RexfillProxy_backend setConfig '(...)'`
4. Whitelist Juno satellite: `dfx canister call RexfillProxy_backend addWhitelistedCaller '(...)'`
5. Add canister ID to Juno secrets: `RexfillProxy_backend_CANISTER_ID`
6. Update Paddle webhook URL
7. Deploy Rexfill app: `juno deploy`

## Configuration

### Juno Secrets Required
```
RexfillProxy_backend_CANISTER_ID: "xxxxx-xxxxx-xxxxx-xxxxx-cai"
```

### Motoko Canister Configuration
Set via `setConfig()` canister call:
- Paddle API key (production)
- Paddle API key (sandbox)  
- Paddle webhook secret
- Environment (sandbox/production)

## Security

### Access Control
- **Admins**: Can configure canister, manage whitelist
- **Whitelisted callers**: Can query Paddle API (Juno satellite)
- **Rate limiting**: 10 requests/minute per user (bypassed for satellite calls)
- **Webhook verification**: HMAC SHA256 signature check

### Secrets Management
- API keys stored in Motoko canister stable storage
- Not exposed to frontend or satellite functions
- Canister ID stored in Juno secrets (read-only for satellite)

## Monitoring

### Motoko Canister Logs
```bash
dfx canister --network ic logs RexfillProxy_backend
```

Look for:
- `🔔 [WEBHOOK]` - Webhook received
- `🔵 [HTTP]` - Paddle API call
- `✅` - Success
- `❌` - Errors

### Juno Satellite Logs
Check Juno Console UI → Logs

Look for:
- `🟣 [PADDLE_SYNC_TRIGGER]` - Trigger received
- `[PADDLE_PROXY]` - Canister interaction

### Health Check
```bash
dfx canister --network ic call RexfillProxy_backend health
```

## Cost Considerations

### HTTP Outcalls
- ~2 billion cycles per request
- Estimate: ~$0.01 per 10,000 requests
- Monitor: `dfx canister status RexfillProxy_backend`

### Storage
- Cached responses: ~1KB per subscription
- Webhook events: ~2KB per event (max 100 stored)
- Total: <1MB stable storage

## Troubleshooting

### Common Issues

**"Unauthorized: Caller not whitelisted"**
```bash
# Check whitelist
dfx canister --network ic call RexfillProxy_backend getWhitelistedCallers

# Add Juno satellite
dfx canister --network ic call RexfillProxy_backend addWhitelistedCaller '(principal "YOUR_SATELLITE_ID")'
```

**"Canister ID not configured"**
- Add `RexfillProxy_backend_CANISTER_ID` to Juno secrets collection
- Verify in Juno Console → Datastore → secrets

**"Out of cycles"**
```bash
# Check balance
dfx canister --network ic status RexfillProxy_backend

# Top up
dfx ledger --network ic top-up RexfillProxy_backend --amount 1.0
```

**Paddle API errors**
- Check API keys in canister config
- Verify environment (sandbox vs production)
- Check cycles balance

## Migration Notes

### What Changed
- ❌ Removed: Direct HTTP calls from TypeScript satellite (not supported)
- ❌ Removed: `pollPaddleSubscription()` function (HTTP endpoint approach)
- ✅ Added: Motoko canister for HTTP outcalls
- ✅ Added: Webhook receiver in Motoko
- ✅ Kept: Trigger pattern (`paddle_sync_triggers`)
- ✅ Kept: Event-driven architecture

### Secrets Migration
Move from Juno secrets to Motoko canister:
- ~~`PADDLE_API_KEY_PROD`~~ → Motoko `setConfig()`
- ~~`PADDLE_API_KEY_DEV`~~ → Motoko `setConfig()`
- ~~`PADDLE_WEBHOOK_SECRET`~~ → Motoko `setConfig()`
- ✅ Keep: `RexfillProxy_backend_CANISTER_ID` (new)

## Testing

### Manual Test Flow
1. Trigger subscription sync from app
2. Check satellite logs for `[PADDLE_SYNC_TRIGGER]`
3. Check Motoko logs for `[HTTP]` and `✅`
4. Verify subscription updated in Juno datastore

### Webhook Test
1. Use Paddle's webhook testing tool
2. Send test event
3. Check: `dfx canister call RexfillProxy_backend getWebhookEvents '(10 : nat)'`
4. Verify event stored with correct signature

## Future Enhancements

- [ ] Automatic webhook event processing (polling job)
- [ ] Admin UI to manage canister config
- [ ] Metrics dashboard (API calls, cache hit rate)
- [ ] Multiple environment support per canister
- [ ] Batch subscription queries
- [ ] Webhook retry logic
