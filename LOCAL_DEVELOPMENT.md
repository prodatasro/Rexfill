# 🧪 Local Development - Paddle Motoko Integration

Complete guide for testing the Paddle integration locally with Juno emulator and local dfx replica.

## Prerequisites

- ✅ Docker/Podman running (for Juno emulator)
- ✅ dfx installed and configured
- ✅ Node.js and npm/pnpm installed
- ✅ Both projects cloned:
  - `~/RexfillProxy_backend` (Motoko canister)
  - `c:\Vlcak\Projects\Rexfill` (Juno app)

---

## 🚀 Quick Start

### 1. Start Local dfx Replica

Open a terminal in your RexfillProxy_backend directory:

```bash
cd ~/RexfillProxy_backend
dfx start --clean --background
```

This starts the Internet Computer replica locally on `http://localhost:4943`

### 2. Deploy RexfillProxy_backend Locally

```bash
dfx deploy
```

**📝 Save the canister ID from output!**

Example output:
```
Deployed canisters.
URLs:
  Backend canister via Candid interface:
    RexfillProxy_backend: http://127.0.0.1:4943/?canisterId=bd3sg-teaaa-aaaaa-qaaba-cai&id=rrkah-fqaaa-aaaaa-aaaaq-cai
```

The canister ID is: `rrkah-fqaaa-aaaaa-aaaaq-cai`

### 3. Initialize Local Canister

```bash
# Get your local principal
dfx identity get-principal

# Add yourself as admin (replace with your principal)
dfx canister call RexfillProxy_backend addAdmin '(principal "YOUR_PRINCIPAL_HERE")'

# Set Paddle configuration (use your sandbox keys for local testing)
dfx canister call RexfillProxy_backend setConfig '(
  "paddle_live_YOUR_PROD_KEY",
  "paddle_test_YOUR_SANDBOX_KEY", 
  "pdl_ntfset_YOUR_WEBHOOK_SECRET",
  variant { sandbox }
)'

# Whitelist the default Juno emulator satellite canister
dfx canister call RexfillProxy_backend addWhitelistedCaller '(principal "jx5yt-yyaaa-aaaal-abzbq-cai")'
```

**Important:** The default Juno satellite ID in the emulator is always: `jx5yt-yyaaa-aaaal-abzbq-cai`

### 4. Verify Canister Setup

```bash
# Check health
dfx canister call RexfillProxy_backend health

# Should return:
# (
#   record {
#     status = "healthy";
#     environment = variant { sandbox };
#     hasApiKey = true;
#     cacheSize = 0 : nat;
#     webhookEventCount = 0 : nat;
#   }
# )

# Check admins
dfx canister call RexfillProxy_backend getAdmins

# Check whitelisted callers (should include jx5yt-yyaaa-aaaal-abzbq-cai)
dfx canister call RexfillProxy_backend getWhitelistedCallers
```

---

## 🛰️ Start Juno Emulator

In a new terminal, navigate to your Rexfill project:

```bash
cd c:\Vlcak\Projects\Rexfill
juno emulator start
```

Wait for the emulator to start. You should see:
- Console UI available at: `http://localhost:5866`
- Internet Identity at: `http://localhost:5987`

---

## ⚙️ Configure Secrets in Juno

You have two options for adding the canister ID to your local secrets:

### Option A: Via Juno Console UI (Recommended)

1. Open browser to `http://localhost:5866`
2. Sign in with Internet Identity (create one if needed)
3. Navigate to your satellite → **Datastore**
4. Create **secrets** collection (if it doesn't exist):
   - Click "Add Collection"
   - Collection name: `secrets`
   - Memory: Heap
   - Read/Write permissions: Controllers
5. Add new document to secrets collection:
   - Click "Add Document"
   - **Key**: `REXFILL_PROXY_CANISTER_ID`
   - **Data** (JSON):
     ```json
     {
       "value": "rrkah-fqaaa-aaaaa-aaaaq-cai",
       "description": "Local RexfillProxy_backend canister ID for testing",
       "createdAt": 1738195200000,
       "createdBy": "your-principal"
     }
     ```
   - Click "Save"

### Option B: Via Admin Dashboard in Your App

1. Start your local dev server (see next section)
2. Navigate to `http://localhost:5173` (or your dev server URL)
3. Sign in as admin
4. Go to **Admin** → **Dashboard**
5. In "API Credentials" section, click **"Add Secret"**
6. Select `REXFILL_PROXY_CANISTER_ID` from dropdown
7. Enter your local canister ID: `rrkah-fqaaa-aaaaa-aaaaq-cai`
8. Add description: "Local RexfillProxy_backend canister ID"
9. Click **"Save Secret"**

---

## 🔧 Start Local Development Server

In a new terminal:

```bash
cd c:\Vlcak\Projects\Rexfill
npm run dev
# or
pnpm dev
```

Your app should now be running at `http://localhost:5173`

---

## ✅ Test the Integration

### 1. Basic Connection Test

1. Open browser to `http://localhost:5173`
2. Sign in with Internet Identity
3. Open browser DevTools → Console
4. Look for initialization messages (should be no errors about canister ID)

### 2. Test Subscription Sync

1. Navigate to **Profile** page
2. Click **"Refresh Subscription"** button
3. Watch browser console for:
   ```
   🟣 [PADDLE_SYNC_TRIGGER] Created trigger document
   🟣 [PADDLE_SYNC_TRIGGER] Hook executing for user: xxx
   [PADDLE_PROXY] Calling canister: rrkah-fqaaa-aaaaa-aaaaq-cai
   ```

4. Check dfx logs in your RexfillProxy_backend terminal:
   ```bash
   dfx canister logs RexfillProxy_backend
   ```

**Note:** Actual Paddle API calls will fail locally since HTTP outcalls require mainnet. That's expected! You're testing the integration flow.

### 3. Mock Webhook Events (Optional)

You can manually add webhook events to test the webhook flow:

```bash
dfx canister call RexfillProxy_backend storeWebhookEvent '(
  "test-evt-001",
  "subscription.updated",
  record {
    customerId = "ctm_test123";
    subscriptionId = "sub_test456";
    status = "active";
    currentBillingPeriod = null;
    scheduledChange = null;
  },
  "{\"data\":{\"id\":\"sub_test456\"}}"
)'

# Verify it was stored
dfx canister call RexfillProxy_backend getWebhookEvents '(10 : nat)'
```

### 4. Check Satellite Logs

In Juno Console (`http://localhost:5866`):
1. Go to **Monitoring** → **Logs**
2. Look for satellite function execution logs
3. Verify paddle-poller functions are being called

---

## 🐛 Troubleshooting

### "Canister ID not configured"

**Cause:** Secret not added to Juno datastore

**Solution:** 
- Check secrets collection exists in Juno Console
- Verify document key is exactly: `REXFILL_PROXY_CANISTER_ID`
- Verify value field contains correct canister ID
- Restart dev server after adding secret

### "Unauthorized: Caller not whitelisted"

**Cause:** Juno satellite not whitelisted in canister

**Solution:**
```bash
dfx canister call RexfillProxy_backend addWhitelistedCaller '(principal "jx5yt-yyaaa-aaaal-abzbq-cai")'
```

### "Cannot find canister"

**Cause:** dfx replica not running or canister not deployed

**Solution:**
```bash
# Check dfx is running
dfx ping

# Redeploy if needed
dfx deploy
```

### Paddle API calls failing

**This is expected locally!** HTTP outcalls only work on IC mainnet. You're testing the integration layer, not actual Paddle connectivity.

### Changes not reflecting

**Solution:**
```bash
# Restart dev server
# Ctrl+C then npm run dev

# If still issues, clear and restart emulator
juno emulator stop
juno emulator start --clean
```

---

## 📊 Monitoring Local Setup

### View Canister Logs

```bash
# Continuous logs
dfx canister logs RexfillProxy_backend

# Watch in real-time
watch -n 2 'dfx canister logs RexfillProxy_backend | tail -30'
```

### Check Cache Stats

```bash
dfx canister call RexfillProxy_backend getCacheStats
```

### Check Canister Status

```bash
dfx canister status RexfillProxy_backend
```

---

## 🔄 Workflow Summary

**Terminal 1:** dfx replica
```bash
cd ~/RexfillProxy_backend
dfx start --background
dfx deploy
dfx canister logs RexfillProxy_backend  # Keep this running
```

**Terminal 2:** Juno emulator
```bash
cd c:\Vlcak\Projects\Rexfill
juno emulator start
```

**Terminal 3:** Dev server
```bash
cd c:\Vlcak\Projects\Rexfill
npm run dev
```

**Browser:** 
- App: `http://localhost:5173`
- Juno Console: `http://localhost:5866`
- Candid UI: `http://127.0.0.1:4943/?canisterId=bd3sg-teaaa-aaaaa-qaaba-cai&id=YOUR_CANISTER_ID`

---

## 🧹 Cleanup

### Stop All Services

```bash
# Stop dev server: Ctrl+C in terminal 3

# Stop Juno emulator
juno emulator stop

# Stop dfx replica
cd ~/RexfillProxy_backend
dfx stop
```

### Clean Reset

```bash
# Clean dfx state
dfx start --clean --background
dfx deploy

# Clean Juno emulator
juno emulator start --clean
```

---

## 📝 Key Differences: Local vs Production

| Aspect | Local | Production |
|--------|-------|------------|
| Canister ID | `rrkah-fqaaa-aaaaa-aaaaq-cai` (example) | `xxxxx-xxxxx-xxxxx-xxxxx-cai` |
| Satellite ID | `jx5yt-yyaaa-aaaal-abzbq-cai` (default) | Your production satellite ID |
| HTTP Outcalls | ❌ Won't work | ✅ Works |
| Paddle API | ❌ Fails (expected) | ✅ Works |
| Webhook URL | N/A | https://canister.raw.icp0.io/webhook |
| Cycles | Unlimited (local) | Must be funded |
| Console URL | http://localhost:5866 | https://console.juno.build |

---

## 🎯 What You CAN Test Locally

✅ Canister integration (calling methods)  
✅ Type safety and TypeScript compilation  
✅ Error handling and edge cases  
✅ UI flows (buttons, forms, state)  
✅ Satellite function execution  
✅ Secrets configuration  
✅ Mock webhook event storage  
✅ Cache behavior  
✅ Authorization (whitelisting)

## ❌ What You CANNOT Test Locally

❌ Actual Paddle API calls (no HTTP outcalls)  
❌ Real webhook delivery from Paddle  
❌ Cycles consumption  
❌ Cross-subnet calls  
❌ Production performance  

---

## 🚀 Ready for Production?

Once local testing is complete, see [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for production deployment steps.

---

## 📚 Additional Resources

- [Juno Local Development](https://juno.build/docs/guides/local-development)
- [dfx CLI Reference](https://internetcomputer.org/docs/current/references/cli-reference/)
- [PADDLE_INTEGRATION.md](PADDLE_INTEGRATION.md) - Architecture overview
- [MOTOKO_PROXY_SETUP.md](MOTOKO_PROXY_SETUP.md) - Canister setup guide
