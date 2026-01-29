/**
 * TypeScript types for RexfillProxy Motoko canister integration
 * 
 * These types match the Candid interface of the Motoko canister
 * deployed at the canister ID configured in environment variables.
 */

import { Principal } from '@dfinity/principal';

/**
 * Environment type matching Motoko variant
 */
export type Environment = { production: null } | { sandbox: null };

/**
 * Result type matching Motoko Result<T, E>
 */
export type Result<T, E = string> = { ok: T } | { err: E };

/**
 * Webhook event stored in the Motoko canister
 */
export interface WebhookEvent {
  id: string;
  eventType: string;
  payload: string;
  signature: string;
  receivedAt: bigint;
  processed: boolean;
  error: string | null;
}

/**
 * Health check response from canister
 */
export interface HealthResponse {
  status: string;
  environment: Environment;
  hasApiKey: boolean;
  cacheSize: bigint;
  webhookEventCount: bigint;
}

/**
 * Cache statistics response
 */
export interface CacheStats {
  size: bigint;
  ttlSeconds: bigint;
}

/**
 * Motoko canister actor interface
 * This matches the public methods exposed by the RexfillProxy canister
 */
export interface RexfillProxyActor {
  // ============================================================================
  // ADMIN FUNCTIONS
  // ============================================================================
  
  /**
   * Set Paddle API configuration
   * @requires Admin principal
   */
  setConfig: (
    apiKeyProd: string,
    apiKeyDev: string,
    webhookSecret: string,
    env: Environment
  ) => Promise<Result<null>>;
  
  /**
   * Add a new admin principal
   * @requires Admin principal
   */
  addAdmin: (principal: Principal) => Promise<Result<null>>;
  
  /**
   * Remove an admin principal
   * @requires Admin principal
   */
  removeAdmin: (principal: Principal) => Promise<Result<null>>;
  
  /**
   * Add a whitelisted caller (e.g., Juno satellite canister)
   * @requires Admin principal
   */
  addWhitelistedCaller: (principal: Principal) => Promise<Result<null>>;
  
  /**
   * Remove a whitelisted caller
   * @requires Admin principal
   */
  removeWhitelistedCaller: (principal: Principal) => Promise<Result<null>>;
  
  /**
   * Get list of admin principals (query)
   */
  getAdmins: () => Promise<Principal[]>;
  
  /**
   * Get list of whitelisted callers (query)
   */
  getWhitelistedCallers: () => Promise<Principal[]>;
  
  /**
   * Get current environment (query)
   */
  getCurrentEnvironment: () => Promise<Environment>;
  
  // ============================================================================
  // WEBHOOK EVENT MANAGEMENT
  // ============================================================================
  
  /**
   * Get webhook events (most recent first)
   * @requires Whitelisted caller or admin
   */
  getWebhookEvents: (limit: bigint) => Promise<Result<WebhookEvent[]>>;
  
  /**
   * Mark a webhook event as processed
   * @requires Whitelisted caller or admin
   */
  markWebhookProcessed: (eventId: string) => Promise<Result<null>>;
  
  /**
   * Clear all webhook events
   * @requires Admin principal
   */
  clearWebhookEvents: () => Promise<Result<null>>;
  
  // ============================================================================
  // PADDLE API FUNCTIONS
  // ============================================================================
  
  /**
   * Query a specific Paddle subscription by ID
   * @requires Whitelisted caller or admin
   * @param subscriptionId Paddle subscription ID
   * @param userId User ID for rate limiting
   * @param bypassCache Skip cache lookup
   * @param bypassRateLimit Skip rate limit check
   */
  querySubscription: (
    subscriptionId: string,
    userId: string,
    bypassCache: boolean,
    bypassRateLimit: boolean
  ) => Promise<Result<string>>;
  
  /**
   * Query Paddle subscriptions by user ID
   * Returns all subscriptions, client must filter by custom_data.userId
   * @requires Whitelisted caller or admin
   * @param userId User ID to search for (and for rate limiting)
   * @param bypassCache Skip cache lookup
   * @param bypassRateLimit Skip rate limit check
   */
  querySubscriptionByUserId: (
    userId: string,
    bypassCache: boolean,
    bypassRateLimit: boolean
  ) => Promise<Result<string>>;
  
  // ============================================================================
  // DIAGNOSTICS
  // ============================================================================
  
  /**
   * Health check (query)
   */
  health: () => Promise<HealthResponse>;
  
  /**
   * Clear API response cache
   * @requires Admin principal
   */
  clearCache: () => Promise<Result<null>>;
  
  /**
   * Get cache statistics (query)
   */
  getCacheStats: () => Promise<CacheStats>;
}

/**
 * Paddle subscription response from Motoko canister
 * The canister returns raw JSON from Paddle API
 */
export interface PaddleSubscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing';
  customer_id: string;
  items: Array<{
    price: {
      id: string;
      product_id: string;
    };
    quantity: number;
  }>;
  current_billing_period?: {
    starts_at: string;
    ends_at: string;
  };
  scheduled_change?: {
    action: string;
    effective_at: string;
  } | null;
  custom_data?: {
    userId?: string;
    organizationId?: string;
  };
}

/**
 * Paddle API response wrapper
 */
export interface PaddleApiResponse {
  data: PaddleSubscription;
}

/**
 * Paddle API list response wrapper
 */
export interface PaddleApiListResponse {
  data: PaddleSubscription[];
  meta: {
    pagination: {
      per_page: number;
      next: string | null;
      has_more: boolean;
      estimated_total: number;
    };
  };
}
