/**
 * Download Validator Serverless Function
 * 
 * Server-side validation for file downloads with quota and rate limit enforcement.
 * Returns direct storage URL if validation passes.
 * 
 * HTTP Status Codes:
 * - 200: Validation passed, download allowed
 * - 402: Subscription expired/payment required
 * - 403: Quota exceeded
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

import {
  isPlatformAdmin,
  getEffectivePlanLimits,
  getSubscriptionStatus,
  validateDailyQuota,
} from './utils/subscription-validator';
import { checkRateLimit } from './utils/rate-limiter';
import {
  logQuotaViolation,
  logRateLimitHit,
  recordSecurityEvent,
} from './utils/monitoring';
import {
  checkQuotaViolationThreshold,
  checkRateLimitThreshold,
} from './utils/admin-notifier';
import { setDoc as setDocStore, getDoc as getDocStore } from '@junobuild/core';

export interface ValidateDownloadRequest {
  templateId: string;
  userId: string;
}

export interface ValidateDownloadResponse {
  allowed: boolean;
  url?: string;
  error?: {
    code: 'subscription_expired' | 'quota_exceeded' | 'rate_limit' | 'template_not_found';
    message: string;
    retryAfterSeconds?: number;
    limit?: number;
    used?: number;
  };
}

/**
 * Validate download request and return storage URL if allowed
 */
export async function validateDownload(request: Request): Promise<Response> {
  try {
    const body = await request.json() as ValidateDownloadRequest;
    const { templateId, userId } = body;

    if (!templateId || !userId) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'template_not_found',
            message: 'Template ID and User ID are required',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Platform admins are exempt from all limits
    const isAdmin = await isPlatformAdmin(userId);
    if (isAdmin) {
      const template = await getTemplateUrl(templateId);
      if (!template) {
        return notFoundResponse();
      }

      return new Response(
        JSON.stringify({
          allowed: true,
          url: template.url,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check subscription status (immediate cutoff for expired)
    const subscriptionStatus = await getSubscriptionStatus(userId);
    if (!subscriptionStatus.isActive) {
      await recordSecurityEvent({
        eventType: 'unauthorized_access',
        severity: 'warning',
        userId,
        endpoint: 'download',
        message: 'Attempted download with expired subscription',
        metadata: {
          templateId,
          expiresAt: subscriptionStatus.expiresAt,
        },
        timestamp: Date.now(),
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'subscription_expired',
            message: 'Your subscription has expired. Please renew to continue downloading.',
          },
        }),
        {
          status: 402, // Payment Required
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate daily download quota
    const limits = await getEffectivePlanLimits(userId);
    const dailyQuotaCheck = await validateDailyQuota(userId);
    if (!dailyQuotaCheck.valid) {
      await logQuotaViolation(userId, 'daily', {
        limit: dailyQuotaCheck.limit!,
        current: dailyQuotaCheck.used!,
        planId: limits.planId,
      });
      await checkQuotaViolationThreshold(userId, limits.planId);

      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'quota_exceeded',
            message: dailyQuotaCheck.message || 'Daily download limit exceeded',
            limit: dailyQuotaCheck.limit,
            used: dailyQuotaCheck.used,
          },
        }),
        {
          status: 403, // Forbidden
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Apply rate limiting
    const rateLimitCheck = await checkRateLimit(userId, 'download', limits.planId);
    if (!rateLimitCheck.allowed) {
      await logRateLimitHit(userId, 'download', {
        limit: 10, // From rate-limiter config
        retryAfter: rateLimitCheck.retryAfterSeconds!,
      });
      await checkRateLimitThreshold(userId, 'download');

      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'rate_limit',
            message: `Too many requests. Please try again in ${rateLimitCheck.retryAfterSeconds} seconds.`,
            retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
          },
        }),
        {
          status: 429, // Too Many Requests
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitCheck.retryAfterSeconds),
          },
        }
      );
    }

    // Get template URL
    const template = await getTemplateUrl(templateId);
    if (!template) {
      return notFoundResponse();
    }

    // Increment usage counter atomically (server-side)
    await incrementUsageCounter(userId);

    // Log successful download validation
    await recordSecurityEvent({
      eventType: 'admin_action',
      severity: 'info',
      userId,
      endpoint: 'download',
      message: 'Download validated successfully',
      metadata: {
        templateId,
        planId: limits.planId,
        source: limits.source,
      },
      timestamp: Date.now(),
    });

    return new Response(
      JSON.stringify({
        allowed: true,
        url: template.url,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Download validation error:', error);
    
    return new Response(
      JSON.stringify({
        allowed: false,
        error: {
          code: 'template_not_found',
          message: 'An error occurred during validation',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Get template storage URL from metadata
 */
async function getTemplateUrl(templateId: string): Promise<{ url: string } | null> {
  try {
    const doc = await getDocStore({
      collection: 'templates_meta',
      key: templateId,
    });

    if (!doc || !doc.data) {
      return null;
    }

    return {
      url: (doc.data as any).url,
    };
  } catch (error) {
    console.error('Failed to get template URL:', error);
    return null;
  }
}

/**
 * Increment usage counter atomically on server-side
 */
async function incrementUsageCounter(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `${userId}_${today}`;

  try {
    const doc = await getDocStore({
      collection: 'usage',
      key,
    });

    const currentCount = doc ? ((doc.data as any)?.documentsProcessed || 0) : 0;
    const version = doc?.version;

    await setDocStore({
      collection: 'usage',
      doc: {
        key,
        data: {
          documentsProcessed: currentCount + 1,
          lastUpdated: Date.now(),
        },
        ...(version && { version }),
      },
    });
  } catch (error) {
    console.error('Failed to increment usage counter:', error);
    // Don't throw - tracking failure should not block download
  }
}

/**
 * Helper for not found response
 */
function notFoundResponse(): Response {
  return new Response(
    JSON.stringify({
      allowed: false,
      error: {
        code: 'template_not_found',
        message: 'Template not found',
      },
    }),
    {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
