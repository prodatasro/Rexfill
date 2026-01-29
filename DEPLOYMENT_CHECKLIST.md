# 🚀 Deployment Checklist - Paddle Motoko Integration

## ✅ Completed - Code Changes

- [x] Created Motoko canister types (`src/satellite/motoko-proxy-types.ts`)
- [x] Refactored `paddle-poller.ts` to use Motoko canister instead of HTTP
- [x] Removed failed HTTP outcall code
- [x] Updated `index.ts` to use new integration  
- [x] Added canister ID configuration via secrets
- [x] Fixed TypeScript errors
- [x] Created documentation files

## 📋 Next Steps - Deployment

### 1. Deploy Motoko Canister (RexfillProxy_backend)

```bash
cd ~/RexfillProxy_backend
dfx deploy --network ic RexfillProxy_backend
```

**Save the canister ID from output!**

### 2. Initialize Motoko Canister

```bash
# Get your principal
dfx identity get-principal

# Add yourself as admin
dfx canister --network ic call RexfillProxy_backend addAdmin '(principal "YOUR_PRINCIPAL")'

# Set Paddle configuration
dfx canister --network ic call RexfillProxy_backend setConfig '(
  "paddle_live_YOUR_PROD_KEY",
  "paddle_test_YOUR_SANDBOX_KEY",
  "pdl_ntfset_YOUR_WEBHOOK_SECRET",
  variant { sandbox }
)'
```

### 3. Whitelist Juno Satellite

```bash
# Get your Juno satellite canister ID from console.juno.build
# Then whitelist it:
dfx canister --network ic call RexfillProxy_backend addWhitelistedCaller '(principal "YOUR_JUNO_SATELLITE_ID")'
```

### 4. Configure Juno Secrets

In Juno Console (https://console.juno.build):

1. Navigate to your satellite → **Datastore** → **secrets** collection
2. Add new document:
   - **Key**: `RexfillProxy_backend_CANISTER_ID`
   - **Data**: `{ "value": "your-motoko-canister-id-here" }`

### 5. Update Paddle Webhook URL

In Paddle Dashboard:

1. Go to **Developer Tools** → **Notifications**
2. Update webhook endpoint to:
   ```
   https://YOUR_MOTOKO_CANISTER_ID.raw.icp0.io/webhook
   ```

### 6. Fund Canister with Cycles

```bash
# Check current balance
dfx canister --network ic status RexfillProxy_backend

# Top up with 1 ICP worth of cycles
dfx ledger --network ic top-up RexfillProxy_backend --amount 1.0
```

### 7. Deploy Rexfill App

```bash
cd c:\Vlcak\Projects\Rexfill
juno deploy
```

### 8. Verify Setup

```bash
# Test canister health
dfx canister --network ic call RexfillProxy_backend health

# Expected output:
# (
#   record {
#     status = "healthy";
#     environment = variant { sandbox };
#     hasApiKey = true;
#     cacheSize = 0 : nat;
#     webhookEventCount = 0 : nat;
#   }
# )

# Check webhook events (should be empty initially)
dfx canister --network ic call RexfillProxy_backend getWebhookEvents '(10 : nat)'

# Check canister configuration
dfx canister --network ic call RexfillProxy_backend getAdmins
dfx canister --network ic call RexfillProxy_backend getWhitelistedCallers
```

## 🧪 Testing

### Test Subscription Sync

1. Go to your Rexfill app
2. Navigate to Profile page
3. Click "Refresh Subscription" button
4. Check satellite logs in Juno Console for:
   - `🟣 [PADDLE_SYNC_TRIGGER]` messages
   - `[PADDLE_PROXY]` canister calls
5. Verify subscription data updated in Datastore

### Test Webhook (Optional)

1. Use Paddle's webhook testing tool
2. Send a test event
3. Check webhook received:
   ```bash
   dfx canister --network ic call RexfillProxy_backend getWebhookEvents '(10 : nat)'
   ```

### Monitor Logs

```bash
# Motoko canister logs
dfx canister --network ic logs RexfillProxy_backend

# Watch in real-time
watch -n 5 'dfx canister --network ic logs RexfillProxy_backend | tail -20'
```

## 📊 Monitoring

### Check Cycles Balance Regularly

```bash
dfx canister --network ic status RexfillProxy_backend
```

**Set up alerts when balance < 1T cycles**

### Cache Statistics

```bash
dfx canister --network ic call RexfillProxy_backend getCacheStats
```

### Health Checks

Add to your monitoring:
```bash
curl https://YOUR_MOTOKO_CANISTER_ID.raw.icp0.io/health
```

## 🐛 Troubleshooting

### Issue: "Canister ID not configured"

**Solution:** Add `RexfillProxy_backend_CANISTER_ID` to Juno secrets collection

### Issue: "Unauthorized: Caller not whitelisted"

**Solution:** 
```bash
dfx canister --network ic call RexfillProxy_backend addWhitelistedCaller '(principal "YOUR_JUNO_SATELLITE_ID")'
```

### Issue: "Out of cycles"

**Solution:**
```bash
dfx ledger --network ic top-up RexfillProxy_backend --amount 1.0
```

### Issue: Paddle API errors

**Check:**
1. API keys are correct in canister config
2. Environment matches (sandbox vs production)
3. Webhook secret matches Paddle dashboard

## 📚 Documentation

- [PADDLE_INTEGRATION.md](PADDLE_INTEGRATION.md) - Architecture overview
- [MOTOKO_PROXY_SETUP.md](MOTOKO_PROXY_SETUP.md) - Detailed setup guide
- [PADDLE_WEBHOOK_SETUP.md](PADDLE_WEBHOOK_SETUP.md) - Original webhook docs

## ✅ Final Verification

- [ ] Motoko canister deployed and healthy
- [ ] Canister ID added to Juno secrets
- [ ] Admin added to canister
- [ ] Juno satellite whitelisted
- [ ] Paddle configuration set in canister
- [ ] Webhook URL updated in Paddle
- [ ] Canister funded with cycles
- [ ] Rexfill app deployed
- [ ] Test subscription sync works
- [ ] Webhook test successful
- [ ] Monitoring set up

## 🎉 Success Criteria

✅ User can complete Paddle checkout
✅ Subscription syncs automatically after checkout  
✅ Paddle webhooks received and stored
✅ No TypeScript errors
✅ Satellite logs show successful API calls
✅ Canister has sufficient cycles

---

**Need help?** Check [PADDLE_INTEGRATION.md](PADDLE_INTEGRATION.md) for detailed architecture and troubleshooting.
