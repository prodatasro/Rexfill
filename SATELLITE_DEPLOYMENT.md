# Satellite Deployment Guide

This guide explains how to deploy the Rexfill satellite with serverless functions and assertion hooks.

## Current Status

⚠️ **The satellite with serverless validation functions is NOT yet deployed.**

The app currently uses **client-side fallback validation** until the satellite is deployed. This means:
- Downloads work using client-side quota checks
- Exports work using client-side quota checks
- Server-side validation, rate limiting, and security monitoring are not active yet

## Prerequisites

1. **Juno CLI installed**:
   ```powershell
   npm install -g @junobuild/cli
   ```

2. **Authenticated with Juno**:
   ```powershell
   juno login
   ```

3. **Satellite initialized** (already done - check `juno.config.ts`)

## Deployment Steps

### 1. Build the Satellite

The satellite code is in `src/satellite/` and includes:
- **Serverless Functions**: `validateDownload`, `validateBulkExport`, `paddleWebhook`
- **Assertion Hooks**: `assertSetDoc`, `assertUploadAsset`, `assertDeleteAsset`
- **Utility Modules**: subscription validation, rate limiting, monitoring, admin notifications

Build the satellite:

```powershell
cd C:\Vlcak\Projects\Rexfill
npm run build
```

This compiles the TypeScript satellite code to JavaScript in the `dist/` folder.

### 2. Deploy the Satellite

Deploy to Juno:

```powershell
juno deploy
```

This will:
- Upload the compiled satellite code to your Juno satellite canister
- Register serverless functions (auto-discovered from `src/satellite/index.ts` exports)
- Activate assertion hooks for datastore and storage operations
- Apply collection permissions from `juno.config.ts`

### 3. Get Satellite URL

After deployment, note your satellite URL. It will be something like:
```
https://<satellite-id>.icp0.io
```

You can find it in:
- Juno console: https://console.juno.build
- Or in the deployment output

### 4. Update Frontend URLs

Once deployed, update the serverless function URLs in the frontend code:

**FileList.tsx** (line ~102):
```typescript
// Change from:
// const canDownload = canProcessDocument(); // Fallback

// To:
const validationResponse = await fetch('https://<satellite-id>.icp0.io/validateDownload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: template.key,
    userId: user.key,
  }),
});

const validation = await validationResponse.json();

// Handle validation response...
```

**ExportDialog.tsx** (line ~104):
```typescript
// Change from:
// const canExport = canProcessDocument(); // Fallback

// To:
const validationResponse = await fetch('https://<satellite-id>.icp0.io/validateBulkExport', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateIds: selectedTemplates.map(t => t.key),
    userId: user?.key,
  }),
});

const validation = await validationResponse.json();

// Handle validation response...
```

### 5. Configure Paddle Webhook

In your Paddle dashboard, configure the webhook URL to point to your satellite:

```
https://<satellite-id>.icp0.io/paddleWebhook
```

Enable these events:
- `subscription.activated`
- `subscription.updated`
- `subscription.canceled`
- `subscription.paused`
- `subscription.past_due`
- `transaction.completed`
- `transaction.payment_failed`

### 6. Add Platform Admins

Add yourself (and other admins) to the `platform_admins` collection using the Juno console:

1. Go to https://console.juno.build
2. Navigate to your satellite → Datastore → `platform_admins` collection
3. Create a new document:
   - **Key**: Your user ID
   - **Data**: `{ "isAdmin": true, "addedAt": <timestamp> }`

Platform admins are exempt from all rate limits and quota checks.

### 7. Test the Deployment

After deployment and configuration:

1. **Test Downloads**:
   - Try downloading a template
   - Check browser DevTools Network tab for the `/validateDownload` request
   - Verify it returns 200 OK with `{ "allowed": true, "url": "..." }`

2. **Test Exports**:
   - Try exporting multiple templates
   - Check for `/validateBulkExport` request
   - Verify validation response

3. **Test Rate Limiting**:
   - Try rapid downloads/uploads
   - Verify 429 responses after exceeding limits

4. **Test Security Monitoring**:
   - Go to Admin → Security page
   - Verify events are being logged
   - Check notifications inbox

5. **Test Quota Enforcement**:
   - Use up your daily quota
   - Verify 403 responses with quota_exceeded error
   - Verify upgrade prompts appear

## Serverless Function URLs

After deployment, these functions will be available:

| Function | URL | Method | Purpose |
|----------|-----|--------|---------|
| `validateDownload` | `https://<satellite-id>.icp0.io/validateDownload` | POST | Validates file download requests |
| `validateBulkExport` | `https://<satellite-id>.icp0.io/validateBulkExport` | POST | Validates bulk export requests |
| `paddleWebhook` | `https://<satellite-id>.icp0.io/paddleWebhook` | POST | Handles Paddle subscription webhooks |

## Assertion Hooks

These run automatically on every datastore/storage operation:

| Hook | Trigger | Purpose |
|------|---------|---------|
| `assertSetDoc` | Before any document write | Protects restricted collections, validates usage updates |
| `assertUploadAsset` | Before file upload | Validates file size, template count, rate limits |
| `assertDeleteAsset` | Before file delete | Enforces rate limits on deletions |

## Collections Created

The satellite uses these datastore collections:

| Collection | Write Access | Purpose |
|------------|--------------|---------|
| `subscriptions` | Restricted | Stores user subscription data from Paddle |
| `usage` | Restricted | Tracks daily/monthly usage quotas |
| `subscription_overrides` | Restricted | Admin-set quota/limit overrides |
| `rate_limits` | Restricted | Rate limit tracking (60s sliding windows) |
| `security_events` | Restricted | Security event logs |
| `admin_notifications` | Restricted | Admin notification queue |
| `webhook_history` | Restricted | Paddle webhook event history |
| `platform_admins` | Restricted | Platform administrator list |

All restricted collections can only be written by:
1. Satellite code (serverless functions, assertion hooks)
2. Juno console admins

## Rollback Plan

If you need to disable server-side validation:

1. The app already has fallback logic in place
2. Simply skip updating the frontend URLs (step 4)
3. The app will continue using client-side validation

## Monitoring

After deployment, monitor:

1. **Juno Console Logs**:
   - Check satellite logs for errors
   - Monitor function invocations

2. **Security Page** (in app):
   - Real-time security events
   - Quota violations
   - Rate limit hits

3. **Admin Notifications**:
   - High-frequency violations trigger notifications
   - Check the bell icon in admin header

## Troubleshooting

### Functions Not Found (404)

- Verify satellite is deployed: `juno status`
- Check function exports in `src/satellite/index.ts`
- Rebuild and redeploy: `npm run build && juno deploy`

### Collection Write Errors

- Ensure collections exist in `juno.config.ts`
- Verify collection permissions are set to `restricted`
- Check assertion hooks aren't blocking legitimate operations

### Rate Limits Too Strict

- Adjust limits in `src/config/plans.ts`
- Rebuild and redeploy satellite
- Or add your user to `platform_admins` for exemption

### Webhook Failures

- Verify Paddle signature validation
- Check webhook URL in Paddle dashboard
- Review webhook_history collection for error details

## Security Notes

⚠️ **Important**:
- Never disable assertion hooks in production
- Keep `platform_admins` collection restricted
- Regularly review security events
- Monitor for bypass attempts
- Use Paddle webhook signature validation

## Next Steps

After successful deployment:

1. Remove TODO comments in FileList.tsx and ExportDialog.tsx
2. Remove fallback validation code
3. Add monitoring alerts
4. Set up automated backups
5. Document operational procedures
