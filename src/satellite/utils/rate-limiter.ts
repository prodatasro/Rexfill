/**
 * Rate Limiter Utility
 * 
 * Server-side rate limiting using sliding window algorithm.
 * Prevents abuse and ensures fair resource distribution.
 * 
 * Key Features:
 * - Sliding window rate limiting (last N seconds)
 * - Platform admin exemption
 * - Per-user, per-endpoint tracking
 * - Configurable burst allowance
 * - Efficient timestamp-based cleanup
 */

import { getDocStore, setDocStore } from '@junobuild/functions/sdk';
import { id } from '@junobuild/functions/ic-cdk';
import { decodeDocData, encodeDocData } from '@junobuild/functions/sdk';
import { isPlatformAdmin } from './subscription-validator';

export interface RateLimitConfig {
  windowSizeMs: number; // Time window in milliseconds (default: 60000 = 1 minute)
  maxRequests: number; // Maximum requests allowed in window
  burstAllowance: number; // Allow N rapid requests before enforcing limit
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Timestamp when limit resets
  retryAfterSeconds?: number;
}

/**
 * Default rate limit configurations per endpoint
 */
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  download: {
    windowSizeMs: 60000, // 1 minute
    maxRequests: 10,
    burstAllowance: 3,
  },
  upload: {
    windowSizeMs: 60000,
    maxRequests: 5,
    burstAllowance: 2,
  },
  export: {
    windowSizeMs: 60000,
    maxRequests: 2,
    burstAllowance: 1,
  },
  processing: {
    windowSizeMs: 60000,
    maxRequests: 10,
    burstAllowance: 3,
  },
};

/**
 * Get rate limit configuration for endpoint and plan tier
 */
function getRateLimitConfig(endpoint: string, _planId: string): RateLimitConfig {
  const baseConfig = DEFAULT_CONFIGS[endpoint] || DEFAULT_CONFIGS.download;
  
  // TODO: Adjust limits based on plan tier when rate limits are fully configured
  // For now, use default configuration
  // In future: merge with PLAN_RATE_LIMITS from plans.ts
  
  return baseConfig;
}

/**
 * Check if request is allowed under rate limit
 * Platform admins are always exempt from rate limiting
 */
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  caller: Uint8Array,
  planId: string = 'free'
): Promise<RateLimitResult> {
  // Platform admins are exempt from rate limiting
  if (await isPlatformAdmin(userId)) {
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: Date.now() + 60000,
    };
  }

  const config = getRateLimitConfig(endpoint, planId);
  const now = Date.now();
  const windowStart = now - config.windowSizeMs;
  
  // Composite key: userId_endpoint
  const key = `${userId}_${endpoint}`;
  
  try {
    // Get current rate limit record
    const doc = await getDocStore({
      caller: caller,
      collection: 'rate_limits',
      key,
    });

    let timestamps: number[] = [];
    let version: bigint | undefined;

    if (doc) {
      const data = decodeDocData(doc.data) as any;
      timestamps = data?.timestamps || [];
      version = doc.version;
      
      // Filter out timestamps outside the sliding window
      timestamps = timestamps.filter(ts => ts > windowStart);
    }

    // Check if limit exceeded
    const requestCount = timestamps.length;
    
    if (requestCount >= config.maxRequests) {
      // Check burst allowance
      const recentRequests = timestamps.filter(ts => ts > (now - 1000)); // Last 1 second
      
      if (recentRequests.length < config.burstAllowance) {
        // Burst allowed, proceed
      } else {
        // Rate limit exceeded
        const oldestTimestamp = Math.min(...timestamps);
        const resetAt = oldestTimestamp + config.windowSizeMs;
        const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);
        
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          retryAfterSeconds,
        };
      }
    }

    // Add current request timestamp
    timestamps.push(now);

    // Update rate limit record
    await setDocStore({
      caller: caller,
      collection: 'rate_limits',
      key,
      doc: {
        data: encodeDocData({
          userId,
          endpoint,
          timestamps,
          lastUpdated: now,
        }),
        version,
      },
    });

    const remaining = Math.max(0, config.maxRequests - timestamps.length);
    const resetAt = now + config.windowSizeMs;

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    
    // Fail open on errors (allow request but log)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowSizeMs,
    };
  }
}

/**
 * Increment rate limit counter (for successful operations)
 * Separate from checkRateLimit to allow pre-validation without incrementing
 */
export async function incrementRateLimit(
  userId: string,
  endpoint: string,
  caller: Uint8Array
): Promise<void> {
  // Platform admins don't have rate limits
  if (await isPlatformAdmin(userId)) {
    return;
  }

  const key = `${userId}_${endpoint}`;
  const now = Date.now();
  const config = getRateLimitConfig(endpoint, 'free');
  const windowStart = now - config.windowSizeMs;

  try {
    const doc = await getDocStore({
      caller: caller,
      collection: 'rate_limits',
      key,
    });

    let timestamps: number[] = [];
    let version: bigint | undefined;

    if (doc) {
      const data = decodeDocData(doc.data) as any;
      timestamps = data?.timestamps || [];
      version = doc.version;
      timestamps = timestamps.filter(ts => ts > windowStart);
    }

    timestamps.push(now);

    await setDocStore({
      caller: caller,
      collection: 'rate_limits',
      key,
      doc: {
        data: encodeDocData({
          userId,
          endpoint,
          timestamps,
          lastUpdated: now,
        }),
        version,
      },
    });
  } catch (error) {
    console.error('Failed to increment rate limit:', error);
    // Don't throw - this is tracking only
  }
}

/**
 * Get remaining requests for user/endpoint
 */
export async function getRemainingRequests(
  userId: string,
  endpoint: string,
  caller: Uint8Array,
  planId: string = 'free'
): Promise<number> {
  if (await isPlatformAdmin(userId)) {
    return Infinity;
  }

  const config = getRateLimitConfig(endpoint, planId);
  const now = Date.now();
  const windowStart = now - config.windowSizeMs;
  const key = `${userId}_${endpoint}`;

  try {
    const doc = await getDocStore({
      caller: caller,
      collection: 'rate_limits',
      key,
    });

    if (!doc) {
      return config.maxRequests;
    }

    const data = decodeDocData(doc.data) as any;
    let timestamps: number[] = data?.timestamps || [];
    timestamps = timestamps.filter(ts => ts > windowStart);

    return Math.max(0, config.maxRequests - timestamps.length);
  } catch (error) {
    console.error('Failed to get remaining requests:', error);
    return config.maxRequests;
  }
}

/**
 * Reset rate limit for user/endpoint (admin action)
 */
export async function resetRateLimit(
  userId: string,
  endpoint: string
): Promise<void> {
  const key = `${userId}_${endpoint}`;

  try {
    await setDocStore({
      caller: id(),
      collection: 'rate_limits',
      key,
      doc: {
        data: encodeDocData({
          userId,
          endpoint,
          timestamps: [],
          lastUpdated: Date.now(),
          resetBy: 'admin',
        }),
        version: undefined,
      },
    });
  } catch (error) {
    console.error('Failed to reset rate limit:', error);
    throw error;
  }
}
