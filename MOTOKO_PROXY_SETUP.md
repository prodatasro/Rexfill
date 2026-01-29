# RexfillProxy_backend Motoko Canister Integration Setup

## 1. Deploy Your Motoko Canister

First, deploy your RexfillProxy_backend Motoko canister:

```bash
cd ~/RexfillProxy_backend
dfx deploy --network ic
```

Save the canister ID output from deployment. It will look like: `xxxxx-xxxxx-xxxxx-xxxxx-cai`

## 2. Configure Canister ID in Juno

Add the canister ID to your Juno satellite's secrets collection:

### Via Juno Console UI:
1. Go to https://console.juno.build
2. Open your satellite
3. Navigate to **Datastore** → **secrets** collection
4. Click **Add Document**
5. Key: `RexfillProxy_backend_CANISTER_ID`
6. Data: `{ "value": "your-canister-id-here" }`

### Via Juno CLI (Alternative):
```bash
juno config set RexfillProxy_backend_CANISTER_ID=your-canister-id-here
```

## 3. Initialize Motoko Canister

### Get Your Identity Principal
```bash
dfx identity get-principal
```

### Add Yourself as Admin
```bash
dfx canister --network ic call RexfillProxy_backend addAdmin '(principal "YOUR_PRINCIPAL_HERE")'
```

### Get Your Juno Satellite Principal

Your Juno satellite canister ID can be found in:
- Juno Console dashboard
- Or run: `juno status`

The principal will be something like: `xxxxx-xxxxx-xxxxx-xxxxx-cai`

### Whitelist Your Juno Satellite

```bash
dfx canister --network ic call RexfillProxy_backend addWhitelistedCaller '(principal "YOUR_JUNO_SATELLITE_ID")'
```

### Set Paddle API Configuration

```bash
dfx canister --network ic call RexfillProxy_backend setConfig '(
  "paddle_live_YOUR_PRODUCTION_KEY",
  "paddle_test_YOUR_SANDBOX_KEY", 
  "pdl_ntfset_YOUR_WEBHOOK_SECRET",
  variant { sandbox }
)'
```

**Parameters:**
- `apiKeyProd`: Your Paddle production API key (starts with `paddle_live_`)
- `apiKeyDev`: Your Paddle sandbox API key (starts with `paddle_test_`)  
- `webhookSecret`: Your Paddle webhook secret (starts with `pdl_ntfset_`)
- `env`: Either `variant { sandbox }` or `variant { production }`

## 4. Update Paddle Webhook URL

In your Paddle dashboard, update the webhook endpoint URL to:

```
https://YOUR_CANISTER_ID.raw.icp0.io/webhook
```

Replace `YOUR_CANISTER_ID` with your RexfillProxy_backend canister ID.

## 5. Fund Canister with Cycles

HTTP outcalls cost cycles (~2 billion per request). Fund your canister:

```bash
# Check balance
dfx canister --network ic status RexfillProxy_backend

# Top up (adjust amount as needed)
dfx ledger --network ic top-up RexfillProxy_backend --amount 1.0
```

Or use the NNS dapp: https://nns.ic0.app/

## 6. Verify Setup

### Test Health Check
```bash
dfx canister --network ic call RexfillProxy_backend health
```

Expected output:
```
(
  record {
    status = "healthy";
    environment = variant { sandbox };
    hasApiKey = true;
    cacheSize = 0 : nat;
    webhookEventCount = 0 : nat;
  }
)
```

### Test Subscription Query (Optional)
If you have a test subscription ID:

```bash
dfx canister --network ic call RexfillProxy_backend querySubscription '(
  "sub_01abc123",
  "test_user_id",
  false,
  false
)'
```

## 7. Deploy Rexfill App

```bash
cd c:\Vlcak\Projects\Rexfill
juno deploy
```

## 8. Test End-to-End Flow

1. **Trigger a sync** from your Rexfill app:
   - User completes Paddle checkout
   - App should call `refreshSubscription()` in SubscriptionContext
   - This creates a document in `paddle_sync_triggers` collection
   - Satellite hook fires and calls Motoko canister
   - Motoko canister queries Paddle API
   - Subscription data updated in Juno datastore

2. **Check logs**:
   ```bash
   # Motoko canister logs
   dfx canister --network ic logs RexfillProxy_backend
   
   # Juno satellite logs (in Console UI)
   ```

3. **Verify webhook reception**:
   - Make a test purchase in Paddle
   - Webhook sent to canister
   - Check webhook events:
   ```bash
   dfx canister --network ic call RexfillProxy_backend getWebhookEvents '(10 : nat)'
   ```

## Troubleshooting

### "Unauthorized: Caller not whitelisted"
- Verify Juno satellite principal is whitelisted
- Check: `dfx canister --network ic call RexfillProxy_backend getWhitelistedCallers`

### "Canister ID not configured"
- Ensure `RexfillProxy_backend_CANISTER_ID` is set in Juno secrets collection
- Verify via Juno Console UI → Datastore → secrets

### "Out of cycles"
- Top up canister with more cycles
- Monitor: `dfx canister --network ic status RexfillProxy_backend`

### Paddle API errors
- Verify API keys are correct
- Check environment (sandbox vs production)
- Ensure webhook secret matches Paddle dashboard

## Environment Variables Summary

### Required in Juno Secrets:
- `RexfillProxy_backend_CANISTER_ID`: Your Motoko canister ID

### Required in Motoko Canister:
- Set via `setConfig()` method:
  - Paddle API key (production)
  - Paddle API key (sandbox)
  - Paddle webhook secret
  - Environment (production/sandbox)
