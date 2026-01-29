/**
 * Paddle API Integration via Motoko Proxy Canister
 * 
 * This module integrates with the RexfillProxy Motoko canister to query Paddle's API.
 * The Motoko canister handles HTTP outcalls, caching, and rate limiting.
 * 
 * Features:
 * - Calls RexfillProxy canister for Paddle API queries
 * - Automatic environment detection via canister configuration
 * - Updates subscription collection when changes detected
 * - Webhook event retrieval from canister
 */

import { call, id } from '@junobuild/functions/ic-cdk';
import {
  encodeDocData,
  decodeDocData,
  setDocStore,
  getDocStore,
  listDocsStore
} from '@junobuild/functions/sdk';
import { IDL } from '@icp-sdk/core/candid';
import { getPlanIdFromPaddlePrice, getSeatsIncluded } from '../config/plans';
import { recordSecurityEvent } from './utils/monitoring';
import { Principal } from '@dfinity/principal';
import type { 
  RexfillProxyActor, 
  PaddleSubscription, 
  PaddleApiResponse,
  PaddleApiListResponse,
  Result 
} from './motoko-proxy-types';

/**
 * Get canister ID for RexfillProxy
 * Retrieves from secrets collection in Juno datastore
 */
export async function getProxyCanisterId(): Promise<string | null> {
  try {
    const secretDoc = await getDocStore({
      caller: id(),
      collection: 'secrets',
      key: 'REXFILL_PROXY_CANISTER_ID',
    });

    if (!secretDoc) {
      console.error('[PADDLE_PROXY] REXFILL_PROXY_CANISTER_ID not found in secrets collection');
      return null;
    }

    const decoded = decodeDocData<{ value: string }>(secretDoc.data);
    console.log(`[PADDLE_PROXY] Get canisterId ${decoded.value} from secrets collection`);
    return decoded.value || null;
  } catch (error) {
    console.error(`[PADDLE_PROXY] Failed to retrieve canister ID:`, error);
    return null;
  }
}

// IDL type definitions for RexfillProxy canister
// Note: Motoko's Result type uses capitalized Ok/Err in Candid
const Environment = IDL.Variant({
  production: IDL.Null,
  sandbox: IDL.Null,
});

const ResultUnit = IDL.Variant({
  Ok: IDL.Null,
  Err: IDL.Text,
});

const ResultText = IDL.Variant({
  Ok: IDL.Text,
  Err: IDL.Text,
});

const HealthResponse = IDL.Record({
  status: IDL.Text,
  environment: Environment,
  hasApiKey: IDL.Bool,
  cacheSize: IDL.Nat,
  webhookEventCount: IDL.Nat,
});

/**
 * Call setConfig method on RexfillProxy canister
 */
export async function setProxyConfig(
  apiKeyProd: string,
  apiKeySandbox: string,
  webhookSecret: string,
  environment: { production: null } | { sandbox: null }
): Promise<{ Ok: null } | { Err: string }> {
  const canisterId = await getProxyCanisterId();
  
  if (!canisterId) {
    throw new Error('RexfillProxy canister ID not configured.');
  }
  
  console.log(`[PADDLE_PROXY] Calling setConfig on canister ${canisterId.substring(0, 10)}...`);
  
  try {
    return await call<{ Ok: null } | { Err: string }>({
      canisterId: Principal.fromText(canisterId).toUint8Array(),
      method: 'setConfig',
      args: [
        [IDL.Text, apiKeyProd],
        [IDL.Text, apiKeySandbox],
        [IDL.Text, webhookSecret],
        [Environment, environment]
      ],
      result: ResultUnit,
    });
  } catch (error: any) {
    console.error('[PADDLE_PROXY] Failed to call setConfig:', error);
    throw new Error(`Canister call failed: ${error.message}`);
  }
}

/**
 * Call health method on RexfillProxy canister
 */
export async function getProxyHealth(): Promise<any> {
  const canisterId = await getProxyCanisterId();
  
  if (!canisterId) {
    throw new Error('RexfillProxy canister ID not configured.');
  }
  
  console.log(`[PADDLE_PROXY] Calling health on canister ${canisterId.substring(0, 10)}...`);
  
  try {
    return await call<any>({
      canisterId: Principal.fromText(canisterId).toUint8Array(),
      method: 'health',
      args: [],
      result: HealthResponse,
    });
  } catch (error: any) {
    console.error('[PADDLE_PROXY] Failed to call health:', error);
    throw new Error(`Canister call failed: ${error.message}`);
  }
}

/**
 * Call querySubscription method on RexfillProxy canister
 */
export async function queryProxySubscription(
  subscriptionId: string,
  userId: string,
  bypassCache: boolean,
  bypassRateLimit: boolean
): Promise<{ Ok: string } | { Err: string }> {
  const canisterId = await getProxyCanisterId();
  
  if (!canisterId) {
    throw new Error('RexfillProxy canister ID not configured.');
  }
  
  console.log(`[PADDLE_PROXY] Calling querySubscription on canister ${canisterId.substring(0, 10)}...`);
  
  try {
    return await call<{ Ok: string } | { Err: string }>({
      canisterId: Principal.fromText(canisterId).toUint8Array(),
      method: 'querySubscription',
      args: [
        [IDL.Text, subscriptionId],
        [IDL.Text, userId],
        [IDL.Bool, bypassCache],
        [IDL.Bool, bypassRateLimit]
      ],
      result: ResultText,
    });
  } catch (error: any) {
    console.error('[PADDLE_PROXY] Failed to call querySubscription:', error);
    throw new Error(`Canister call failed: ${error.message}`);
  }
}

/**
 * Call querySubscriptionByUserId method on RexfillProxy canister
 */
export async function queryProxySubscriptionByUserId(
  userId: string,
  bypassCache: boolean,
  bypassRateLimit: boolean
): Promise<{ Ok: string } | { Err: string }> {
  const canisterId = await getProxyCanisterId();
  
  if (!canisterId) {
    throw new Error('RexfillProxy canister ID not configured.');
  }
  
  console.log(`[PADDLE_PROXY] Calling querySubscriptionByUserId on canister ${canisterId.substring(0, 10)}...`);
  
  try {
    return await call<{ Ok: string } | { Err: string }>({
      canisterId: Principal.fromText(canisterId).toUint8Array(),
      method: 'querySubscriptionByUserId',
      args: [
        [IDL.Text, userId],
        [IDL.Bool, bypassCache],
        [IDL.Bool, bypassRateLimit]
      ],
      result: ResultText,
    });
  } catch (error: any) {
    console.error('[PADDLE_PROXY] Failed to call querySubscriptionByUserId:', error);
    throw new Error(`Canister call failed: ${error.message}`);
  }
}

/**
 * Get Paddle API configuration
 * Now just returns status - actual config is managed in Motoko canister
 */
export async function getPaddleConfig(): Promise<{
  environment: 'development' | 'production';
} | null> {
  console.log('[PADDLE_PROXY] Checking Motoko canister health...');
  
  try {
    const health = await getProxyHealth();
    
    console.log(`[PADDLE_PROXY] Canister healthy - Environment: ${JSON.stringify(health.environment)}`);
    
    // Convert Motoko environment variant to string
    const environment = health.environment.production !== undefined ? 'production' : 'development';
    
    return { environment };
  } catch (error: any) {
    console.error('[PADDLE_PROXY] Failed to get canister health:', error);
    return null;
  }
}


/**
 * Fetch subscription by user ID from Paddle API via Motoko canister
 * Queries Paddle for active subscriptions by custom_data.userId
 */
export async function fetchPaddleSubscriptionByUserId(
  userId: string,
  config: { environment: string }
): Promise<PaddleSubscription | null> {
  console.log(`[PADDLE_PROXY] Querying subscription by userId: ${userId}`);
  
  try {
    // Call Motoko canister to query Paddle API
    const result = await queryProxySubscriptionByUserId(
      userId,        // userId
      false,         // bypassCache
      true,          // bypassRateLimit (we're calling from satellite, not end user)
    );
    
    if ('Err' in result) {
      console.error(`[PADDLE_PROXY] Error from canister: ${result.Err}`);
      return null;
    }
    
    // Parse JSON response from Paddle API
    const response: PaddleApiListResponse = JSON.parse(result.Ok);
    console.log(`[PADDLE_PROXY] Found ${response.data?.length || 0} total subscriptions`);
    
    // Filter for subscription with matching userId in custom_data
    const subscription = response.data?.find((sub: PaddleSubscription) => 
      sub.custom_data?.userId === userId
    );
    
    if (subscription) {
      console.log(`[PADDLE_PROXY] ✅ Found subscription for userId ${userId}: ${subscription.id}`);
      return subscription;
    } else {
      console.log(`[PADDLE_PROXY] ⚠️ No subscription found for userId ${userId}`);
      return null;
    }
  } catch (error: any) {
    console.error(`[PADDLE_PROXY] Error fetching subscription by userId:`, error);
    return null;
  }
}

/**
 * Fetch subscription from Paddle API via Motoko canister
 */
export async function fetchPaddleSubscription(
  subscriptionId: string,
  config: { environment: string }
): Promise<PaddleSubscription | null> {
  console.log(`[PADDLE_PROXY] Querying subscription: ${subscriptionId}`);
  
  try {
    // Infer userId for rate limiting (use subscription ID as fallback)
    const userId = subscriptionId;
    
    // Call Motoko canister to query Paddle API
    const result = await queryProxySubscription(
      subscriptionId, // subscriptionId
      userId,         // userId (for rate limiting)
      false,          // bypassCache
      true,           // bypassRateLimit (we're calling from satellite)
    );
    
    if ('Err' in result) {
      console.error(`[PADDLE_PROXY] Error from canister: ${result.Err}`);
      
      // Check if it's a 404 (subscription not found)
      if (result.Err.includes('404') || result.Err.includes('not found')) {
        console.log(`[PADDLE_PROXY] Subscription ${subscriptionId} not found (404)`);
        return null;
      }
      
      throw new Error(result.Err);
    }
    
    // Parse JSON response from Paddle API
    const response: PaddleApiResponse = JSON.parse(result.Ok);
    console.log(`[PADDLE_PROXY] Successfully fetched subscription: ${subscriptionId}, Status: ${response.data.status}`);
    
    return response.data;
  } catch (error: any) {
    console.error('[PADDLE_PROXY] Failed to fetch subscription:', error);
    throw error;
  }
}


/**
 * Update subscription in datastore
 */
export async function updateSubscription(
  caller: string,
  userId: string,
  paddleData: PaddleSubscription
): Promise<void> {
  console.log(`[PADDLE_PROXY] Updating subscription in datastore for user: ${userId.substring(0, 8)}...`);
  
  try {
    // Extract plan info from Paddle data
    const priceId = paddleData.items[0]?.price?.id || '';
    console.log(`[PADDLE_PROXY] Paddle price ID: ${priceId}`);
    
    const planId = getPlanIdFromPaddlePrice(priceId);
    console.log(`[PADDLE_PROXY] Mapped to plan ID: ${planId}`);
    
    const quantity = paddleData.items[0]?.quantity || 1;
    const seatsIncluded = getSeatsIncluded(planId);

    // Determine subscription type
    const isOrgPlan = ['team', 'business', 'enterprise_org'].includes(planId);
    const subscriptionType = isOrgPlan ? 'organization' : 'individual';
    console.log(`[PADDLE_PROXY] Subscription type: ${subscriptionType}, Quantity: ${quantity}`);

    // Build subscription data
    const subscriptionData = {
      planId,
      status: paddleData.status,
      type: subscriptionType,
      paddleSubscriptionId: paddleData.id,
      paddleCustomerId: paddleData.customer_id,
      currentPeriodStart: paddleData.current_billing_period
        ? new Date(paddleData.current_billing_period.starts_at).getTime()
        : Date.now(),
      currentPeriodEnd: paddleData.current_billing_period
        ? new Date(paddleData.current_billing_period.ends_at).getTime()
        : Date.now() + 30 * 24 * 60 * 60 * 1000, // Default 30 days
      cancelAtPeriodEnd: paddleData.scheduled_change?.action === 'cancel' || false,
      ...(isOrgPlan && {
        organizationId: paddleData.custom_data?.organizationId,
        seatsIncluded: (seatsIncluded ?? 1) * quantity,
        seatsUsed: 0, // Will be calculated separately
      }),
      lastUpdated: Date.now(),
      lastSyncedViaCanister: true, // Flag to indicate this was synced via Motoko canister
    };

    console.log(`[PADDLE_PROXY] Writing to datastore - Collection: subscriptions, Key: ${userId.substring(0, 8)}...`);
    
    // Update datastore
    await setDocStore({
      caller: Principal.fromText(caller).toUint8Array(),
      collection: 'subscriptions',
      key: userId,
      doc: {        
        data: encodeDocData(subscriptionData),
      },
    });

    console.log(`[PADDLE_PROXY] ✅ Successfully updated subscription for user ${userId.substring(0, 8)}...: ${planId} (${paddleData.status})`);
  } catch (error) {
    console.error('[PADDLE_PROXY] ❌ Failed to update subscription:', error);
    throw error;
  }
}

// /**
//  * Get unprocessed webhook events from Motoko canister
//  * This can be called periodically to process webhook events
//  */
// export async function getUnprocessedWebhookEvents(limit: number = 10): Promise<any[]> {
//   console.log(`[PADDLE_PROXY] Fetching unprocessed webhook events (limit: ${limit})`);
  
//   try {
//     const result = await callProxyCanister<Result<any[]>>('getWebhookEvents', [
//       BigInt(limit),
//     ]);
    
//     if ('err' in result) {
//       console.error(`[PADDLE_PROXY] Error fetching webhook events: ${result.err}`);
//       return [];
//     }
    
//     // Filter for unprocessed events
//     const unprocessed = result.ok.filter((evt: any) => !evt.processed);
//     console.log(`[PADDLE_PROXY] Found ${unprocessed.length} unprocessed events`);
    
//     return unprocessed;
//   } catch (error: any) {
//     console.error('[PADDLE_PROXY] Failed to fetch webhook events:', error);
//     return [];
//   }
// }

// /**
//  * Mark webhook event as processed in Motoko canister
//  */
// export async function markWebhookProcessed(eventId: string): Promise<boolean> {
//   console.log(`[PADDLE_PROXY] Marking event as processed: ${eventId}`);
  
//   try {
//     const result = await callProxyCanister<Result<null>>('markWebhookProcessed', [eventId]);
    
//     if ('err' in result) {
//       console.error(`[PADDLE_PROXY] Error marking event: ${result.err}`);
//       return false;
//     }
    
//     console.log(`[PADDLE_PROXY] ✅ Event marked as processed: ${eventId}`);
//     return true;
//   } catch (error: any) {
//     console.error('[PADDLE_PROXY] Failed to mark event:', error);
//     return false;
//   }
// }
