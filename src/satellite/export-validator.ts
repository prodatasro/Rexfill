/**
 * Export Validator Serverless Function
 * 
 * Server-side validation for bulk template exports with tier-based limits.
 * Prevents abuse and excessive data extraction.
 * 
 * HTTP Status Codes:
 * - 200: Validation passed, export allowed
 * - 402: Subscription expired/payment required
 * - 403: Quota exceeded or tier limit
 * - 429: Rate limit exceeded
 * - 500: Server error
 */

import {
  isPlatformAdmin,
  getEffectivePlanLimits,
  getSubscriptionStatus,
} from './utils/subscription-validator';
import { checkRateLimit } from './utils/rate-limiter';
import {
  logQuotaViolation,
  logRateLimitHit,
  logSuspiciousExport,
  recordSecurityEvent,
} from './utils/monitoring';
import {
  checkSuspiciousExportThreshold,
  checkRateLimitThreshold,
} from './utils/admin-notifier';
import { getDoc as getDocStore } from '@junobuild/core';

export interface ValidateExportRequest {
  templateIds: string[];
  userId: string;
}

export interface ValidateExportResponse {
  allowed: boolean;
  approvedTemplates?: Array<{ id: string; url: string; name: string }>;
  rejectedTemplates?: Array<{ id: string; reason: string }>;
  error?: {
    code: 'subscription_expired' | 'quota_exceeded' | 'rate_limit' | 'tier_limit';
    message: string;
    retryAfterSeconds?: number;
    limit?: number;
    requested?: number;
  };
}

/**
 * Export tier limits (templates per export)
 */
const EXPORT_TIER_LIMITS: Record<string, number> = {
  free: 5,
  starter: 50,
  professional: 200,
  enterprise: -1, // Unlimited
  team: 100,
  business: 250,
  enterprise_org: -1, // Unlimited
};

/**
 * Validate bulk export request
 */
export async function validateBulkExport(request: Request, caller: Uint8Array): Promise<Response> {
  try {
    const body = await request.json() as ValidateExportRequest;
    const { templateIds, userId } = body;

    if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'tier_limit',
            message: 'Template IDs are required',
          },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'tier_limit',
            message: 'User ID is required',
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
      const templates = await getTemplateDetails(templateIds);
      return new Response(
        JSON.stringify({
          allowed: true,
          approvedTemplates: templates,
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
        endpoint: 'export',
        message: 'Attempted export with expired subscription',
        metadata: {
          templateCount: templateIds.length,
          expiresAt: subscriptionStatus.expiresAt,
        },
        timestamp: Date.now(),
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'subscription_expired',
            message: 'Your subscription has expired. Please renew to continue exporting.',
          },
        }),
        {
          status: 402, // Payment Required
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get effective plan limits
    const limits = await getEffectivePlanLimits(userId);
    const exportLimit = EXPORT_TIER_LIMITS[limits.planId] || EXPORT_TIER_LIMITS.free;

    // Check tier-based export limit
    if (exportLimit !== -1 && templateIds.length > exportLimit) {
      await logQuotaViolation(userId, 'templates', {
        limit: exportLimit,
        current: templateIds.length,
        planId: limits.planId,
      });

      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'tier_limit',
            message: `Export limit exceeded. Your ${limits.planId} plan allows ${exportLimit} templates per export.`,
            limit: exportLimit,
            requested: templateIds.length,
          },
        }),
        {
          status: 403, // Forbidden
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Apply strict rate limiting for exports
    const rateLimitCheck = await checkRateLimit(userId, 'export', caller, limits.planId);
    if (!rateLimitCheck.allowed) {
      await logRateLimitHit(userId, 'export', {
        limit: 2, // From rate-limiter config
        retryAfter: rateLimitCheck.retryAfterSeconds!,
      });
      await checkRateLimitThreshold(userId, 'export');

      return new Response(
        JSON.stringify({
          allowed: false,
          error: {
            code: 'rate_limit',
            message: `Too many export requests. Please try again in ${rateLimitCheck.retryAfterSeconds} seconds.`,
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

    // Get template details and URLs
    const templates = await getTemplateDetails(templateIds);
    
    // Check for suspicious export patterns (large exports from free tier)
    if (limits.planId === 'free' && templateIds.length >= 5) {
      await logSuspiciousExport(userId, {
        templateCount: templateIds.length,
        planId: limits.planId,
        exportCount: 1, // This export
      });
      await checkSuspiciousExportThreshold(userId, limits.planId);
    }

    // Log successful export validation
    await recordSecurityEvent({
      eventType: 'admin_action',
      severity: 'info',
      userId,
      endpoint: 'export',
      message: 'Export validated successfully',
      metadata: {
        templateCount: templateIds.length,
        planId: limits.planId,
        source: limits.source,
        exportLimit,
      },
      timestamp: Date.now(),
    });

    return new Response(
      JSON.stringify({
        allowed: true,
        approvedTemplates: templates,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Export validation error:', error);
    
    return new Response(
      JSON.stringify({
        allowed: false,
        error: {
          code: 'tier_limit',
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
 * Get template details including URLs
 */
async function getTemplateDetails(
  templateIds: string[]
): Promise<Array<{ id: string; url: string; name: string }>> {
  const templates: Array<{ id: string; url: string; name: string }> = [];

  for (const id of templateIds) {
    try {
      const doc = await getDocStore({
        collection: 'templates_meta',
        key: id,
      });

      if (doc && doc.data) {
        templates.push({
          id,
          url: (doc.data as any).url,
          name: (doc.data as any).name,
        });
      }
    } catch (error) {
      console.error(`Failed to get template ${id}:`, error);
      // Skip missing templates
    }
  }

  return templates;
}
