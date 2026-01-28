/**
 * Paddle Webhook Handler for Juno Satellite
 * 
 * This function receives webhook events from Paddle when subscription changes occur.
 * It verifies the webhook signature and updates subscription data in Juno datastore.
 * 
 * Webhook events handled:
 * - subscription.created - New subscription created
 * - subscription.updated - Subscription modified (plan change, etc.)
 * - subscription.canceled - Subscription canceled (IMMEDIATE cutoff)
 * - subscription.past_due - Payment failed (24h grace)
 * - subscription.paused - Subscription paused (IMMEDIATE cutoff)
 * - subscription.resumed - Subscription resumed
 * - payment.failed - Payment failure (48h grace)
 */

import { id } from '@junobuild/functions/ic-cdk';
import {
  encodeDocData,
  decodeDocData,
  setDocStore,
  getDocStore,
} from '@junobuild/functions/sdk';
import { getPlanIdFromPaddlePrice, getSeatsIncluded, getPlan } from '../config/plans';
import { recordSecurityEvent } from './utils/monitoring';
import {
  notifySubscriptionCanceled,
  notifyWebhookFailure,
  createAdminNotification,
} from './utils/admin-notifier';

/**
 * Retry a database operation with exponential backoff
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`Operation failed (attempt ${attempt}/${maxAttempts}):`, error);
      
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Paddle webhook event types
interface PaddleWebhookEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id: string; // Paddle subscription ID
    customer_id: string;
    status: 'active' | 'canceled' | 'past_due' | 'paused' | 'trialing';
    custom_data?: {
      userId?: string;
      organizationId?: string;
      organizationName?: string;
      isOrganizationPlan?: string;
    };
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
    cancel_at?: string | null;
  };
}

// Helper functions now imported from centralized plans.ts config

/**
 * Verify Paddle webhook signature using Web Crypto API
 * Paddle signs webhooks with HMAC SHA256
 */
async function verifyPaddleSignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Paddle signature format: "ts=timestamp;h1=signature"
    const parts = signature.split(';');
    const timestamp = parts.find(p => p.startsWith('ts='))?.split('=')[1];
    const h1Signature = parts.find(p => p.startsWith('h1='))?.split('=')[1];

    if (!timestamp || !h1Signature) {
      console.error('Invalid signature format');
      return false;
    }

    // Create signature payload: timestamp + : + raw body
    const payload = `${timestamp}:${rawBody}`;

    // Convert secret and payload to Uint8Array
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);

    // Import the secret key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Compute HMAC SHA256
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    
    // Convert to hex string
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const computedSignature = signatureArray
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures
    return computedSignature === h1Signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Handle Paddle webhook events
 */
export async function paddleWebhook(request: Request): Promise<Response> {
  try {
    // Get the raw request body
    const rawBody = await request.text();
    
    // Get Paddle signature from headers
    const signature = request.headers.get('paddle-signature');
    
    if (!signature) {
      console.error('Missing Paddle signature header');
      return new Response('Unauthorized', { status: 401 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      console.error('PADDLE_WEBHOOK_SECRET not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    const isValid = await verifyPaddleSignature(rawBody, signature, webhookSecret);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }

    // Parse webhook event
    const event: PaddleWebhookEvent = JSON.parse(rawBody);
    
    console.log('Paddle webhook received:', event.event_type, event.event_id);

    // Extract user ID from custom data
    const userId = event.data.custom_data?.userId;
    const organizationId = event.data.custom_data?.organizationId;
    const organizationName = event.data.custom_data?.organizationName;
    const isOrganizationPlan = event.data.custom_data?.isOrganizationPlan === 'true';

    if (!userId && !organizationId) {
      console.error('No userId or organizationId in webhook data');
      return new Response('Bad Request: Missing user identifier', { status: 400 });
    }

    // Determine plan from price ID
    const priceId = event.data.items[0]?.price?.id;
    if (!priceId) {
      console.error('No price ID in webhook data');
      return new Response('Bad Request: Missing price ID', { status: 400 });
    }

    const planId = getPlanIdFromPaddlePrice(priceId, process.env as Record<string, string>);
    const subscriptionType = getPlan(planId).type;
    const seatsIncluded = getSeatsIncluded(planId);

    // Handle different event types
    switch (event.event_type) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.resumed': {
        let finalOrganizationId = organizationId;

        // If this is a new organization subscription, create the organization
        if (event.event_type === 'subscription.created' && isOrganizationPlan && !organizationId && userId && organizationName) {
          const newOrgId = `org_${Date.now()}_${userId}`;
          
          const organizationData = {
            name: organizationName,
            ownerId: userId,
            seatsUsed: 1, // Owner takes one seat
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          const encodedOrgData = encodeDocData(organizationData);

          await retryOperation(async () =>
            await setDocStore({
              caller: id(),
              collection: 'organizations',
              key: newOrgId,
              doc: {
                data: encodedOrgData,
              },
            })
          );

          // Create organization member entry for the owner
          const memberData = {
            organizationId: newOrgId,
            userId,
            role: 'owner',
            joinedAt: Date.now(),
          };

          const encodedMemberData = encodeDocData(memberData);
          const memberKey = `${newOrgId}_${userId}`;

          await retryOperation(async () =>
            await setDocStore({
              caller: id(),
              collection: 'organization_members',
              key: memberKey,
              doc: {
                data: encodedMemberData,
              },
            })
          );

          // If user has an individual subscription, mark it for cancellation at period end
          try {
            const individualSub = await getDocStore({
              caller: id(),
              collection: 'subscriptions',
              key: userId,
            });

            if (individualSub) {
              const decodedData = decodeDocData<{ type?: string; [key: string]: unknown }>(individualSub.data);
              
              if (decodedData.type === 'individual') {
                const updatedIndividualData = {
                  ...decodedData,
                  cancelAtPeriodEnd: true,
                  updatedAt: Date.now(),
                };

                const encodedIndividualData = encodeDocData(updatedIndividualData);

                await retryOperation(async () =>
                  await setDocStore({
                    caller: id(),
                    collection: 'subscriptions',
                    key: userId,
                    doc: {
                      data: encodedIndividualData,
                      version: individualSub.version,
                    },
                  })
                );

                console.log(`Marked individual subscription for ${userId} to cancel at period end`);
              }
            }
          } catch (error) {
            console.error('Error updating individual subscription:', error);
            // Don't fail the webhook if individual subscription update fails
          }

          finalOrganizationId = newOrgId;
          console.log(`Created organization ${newOrgId} for subscription`);
        }

        // Detect suspicious downgrades (enterprise -> free)
        const key = finalOrganizationId || userId!;
        let oldPlanId: string | undefined;
        
        if (event.event_type === 'subscription.updated') {
          try {
            const existingDoc = await getDocStore({
              caller: id(),
              collection: 'subscriptions',
              key,
            });

            if (existingDoc) {
              const decodedData = decodeDocData<{ planId?: string; [key: string]: unknown }>(existingDoc.data);
              oldPlanId = String(decodedData.planId);

              // Detect suspicious downgrades
              const premiumPlans = ['enterprise', 'professional', 'business', 'enterprise_org'];
              if (premiumPlans.includes(oldPlanId) && (planId === 'free' || planId === 'starter')) {
                await recordSecurityEvent({
                  eventType: 'admin_action',
                  severity: 'warning',
                  userId: userId || key,
                  endpoint: 'webhook',
                  message: 'Suspicious subscription downgrade detected',
                  metadata: {
                    oldPlanId,
                    newPlanId: planId,
                    paddleSubscriptionId: event.data.id,
                    eventType: event.event_type,
                  },
                  timestamp: Date.now(),
                });

                await createAdminNotification({
                  title: 'Suspicious Subscription Downgrade',
                  message: `Suspicious downgrade: ${oldPlanId} → ${planId}`,
                  severity: 'warning',
                  userId: userId || key,
                  metadata: {
                    action: 'suspicious_downgrade',
                    oldPlanId,
                    newPlanId: planId,
                    paddleSubscriptionId: event.data.id,
                  },
                });
              }
            }
          } catch (error) {
            console.error('Error checking existing subscription:', error);
          }
        }

        // Create or update subscription
        const subscriptionData = {
          planId,
          status: event.data.status,
          type: subscriptionType,
          paddleSubscriptionId: event.data.id,
          paddleCustomerId: event.data.customer_id,
          currentPeriodStart: new Date(event.data.current_billing_period?.starts_at || Date.now()).getTime(),
          currentPeriodEnd: new Date(event.data.current_billing_period?.ends_at || Date.now()).getTime(),
          cancelAtPeriodEnd: Boolean(event.data.cancel_at),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          ...(finalOrganizationId && { organizationId: finalOrganizationId }),
          ...(seatsIncluded && {
            seatsIncluded,
            seatsUsed: event.data.items[0]?.quantity || 1,
          }),
        };
        
        // Encode the data for storage
        const encodedData = encodeDocData(subscriptionData);

        await retryOperation(async () =>
          await setDocStore({
            caller: id(),
            collection: 'subscriptions',
            key,
            doc: {
              data: encodedData,
            },
          })
        );

        console.log(`Subscription ${event.event_type} for ${key}`);

        // Log security event for audit trail
        await recordSecurityEvent({
          eventType: 'admin_action',
          severity: 'info',
          userId: userId || key,
          endpoint: 'webhook',
          message: `Subscription ${event.event_type}`,
          metadata: {
            key,
            eventType: event.event_type,
            planId,
            oldPlanId,
            paddleSubscriptionId: event.data.id,
          },
          timestamp: Date.now(),
        });

        break;
      }

      case 'subscription.canceled':
      case 'subscription.past_due':
      case 'subscription.paused': {
        // IMMEDIATE cutoff for canceled/paused, short grace for past_due
        const key = organizationId || userId!;
        
        const existingDoc = await getDocStore({
          caller: id(),
          collection: 'subscriptions',
          key,
        });

        if (existingDoc) {
          const decodedData = decodeDocData<{ type?: string; planId?: string; [key: string]: unknown }>(existingDoc.data);
          const isOrgSubscription = decodedData.type === 'organization';
          
          // Grace period logic:
          // - subscription.canceled: IMMEDIATE cutoff (no grace)
          // - subscription.paused: IMMEDIATE cutoff (no grace)
          // - subscription.past_due: 24h grace period
          let gracePeriodEndsAt: number | undefined;
          if (event.event_type === 'subscription.past_due') {
            gracePeriodEndsAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
          }

          const updatedData = {
            ...decodedData,
            status: event.event_type === 'subscription.canceled' || event.event_type === 'subscription.paused' 
              ? 'canceled' 
              : event.data.status,
            updatedAt: Date.now(),
            ...(event.data.cancel_at && {
              cancelAtPeriodEnd: true,
            }),
            ...(gracePeriodEndsAt && { gracePeriodEndsAt }),
          };
          
          // Encode the updated data
          const encodedData = encodeDocData(updatedData);

          await retryOperation(async () =>
            await setDocStore({
              caller: id(),
              collection: 'subscriptions',
              key,
              doc: {
                data: encodedData,
                version: existingDoc.version,
              },
            })
          );

          console.log(`Subscription ${event.event_type} for ${key}${gracePeriodEndsAt ? ' with grace period' : ' (immediate cutoff)'}`);

          // Log security event
          await recordSecurityEvent({
            eventType: event.event_type === 'subscription.canceled' ? 'subscription_canceled' : 'admin_action',
            severity: event.event_type === 'subscription.canceled' ? 'critical' : 'warning',
            userId: userId || key,
            endpoint: 'webhook',
            message: `Subscription ${event.event_type}`,
            metadata: {
              key,
              eventType: event.event_type,
              paddleSubscriptionId: event.data.id,
              planId: decodedData.planId,
              gracePeriodEndsAt: gracePeriodEndsAt?.toString(),
            },
            timestamp: Date.now(),
          });

          // Notify admin for canceled subscriptions
          if (event.event_type === 'subscription.canceled') {
            await notifySubscriptionCanceled(
              userId || key,
              {
                planId: String(decodedData.planId),
                organizationId,
                paddleSubscriptionId: event.data.id,
              }
            );
          }

          // Clear user sessions for immediate cutoff
          if (event.event_type === 'subscription.canceled' || event.event_type === 'subscription.paused') {
            // Note: Sessions are managed externally - log this for reference
            console.log(`Session clearance needed for ${key} due to immediate cutoff`);
            
            await createAdminNotification({
              title: 'Subscription Cutoff',
              message: `Subscription ${event.event_type} - immediate cutoff enforced`,
              severity: 'warning',
              userId: userId || key,
              metadata: {
                action: 'subscription_cutoff',
                eventType: event.event_type,
                paddleSubscriptionId: event.data.id,
                requiresSessionClear: true,
              },
            });
          }

          // If grace period started, create notifications
          if (gracePeriodEndsAt && isOrgSubscription && organizationId) {
            try {
              // Get organization to find owner
              const orgDoc = await getDocStore({
                caller: id(),
                collection: 'organizations',
                key: organizationId,
              });

              if (orgDoc) {
                const orgData = decodeDocData<{ ownerId?: string; name?: string; [key: string]: unknown }>(orgDoc.data);
                
                if (orgData.ownerId) {
                  // Create notification for owner about grace period
                  const notificationData = {
                    userId: orgData.ownerId,
                    type: 'grace_period_started',
                    read: false,
                    metadata: {
                      organizationId,
                      organizationName: orgData.name || 'Your organization',
                      gracePeriodEndsAt: gracePeriodEndsAt.toString(),
                    },
                    createdAt: Date.now(),
                  };

                  const notificationKey = `notif_${Date.now()}_${orgData.ownerId}`;
                  const encodedNotificationData = encodeDocData(notificationData);

                  await retryOperation(async () =>
                    await setDocStore({
                      caller: id(),
                      collection: 'notifications',
                      key: notificationKey,
                      doc: {
                        data: encodedNotificationData,
                      },
                    })
                  );

                  console.log(`Created grace period notification for owner ${orgData.ownerId}`);
                }
              }
            } catch (error) {
              console.error('Error creating grace period notification:', error);
              // Don't fail the webhook if notification creation fails
            }
          }
        }
        break;
      }

      case 'payment.failed': {
        // 48h grace period for payment failures
        const key = organizationId || userId!;
        
        const existingDoc = await getDocStore({
          caller: id(),
          collection: 'subscriptions',
          key,
        });

        if (existingDoc) {
          const decodedData = decodeDocData<{ planId?: string; [key: string]: unknown }>(existingDoc.data);
          const gracePeriodEndsAt = Date.now() + (48 * 60 * 60 * 1000); // 48 hours

          const updatedData = {
            ...decodedData,
            paymentFailed: true,
            gracePeriodEndsAt,
            updatedAt: Date.now(),
          };
          
          const encodedData = encodeDocData(updatedData);

          await retryOperation(async () =>
            await setDocStore({
              caller: id(),
              collection: 'subscriptions',
              key,
              doc: {
                data: encodedData,
                version: existingDoc.version,
              },
            })
          );

          console.log(`Payment failed for ${key} - 48h grace period set`);

          // Log security event
          await recordSecurityEvent({
            eventType: 'payment_failed',
            severity: 'warning',
            userId: userId || key,
            endpoint: 'webhook',
            message: 'Payment failed - 48h grace period',
            metadata: {
              key,
              eventType: event.event_type,
              planId: decodedData.planId,
              gracePeriodEndsAt: gracePeriodEndsAt.toString(),
            },
            timestamp: Date.now(),
          });

          // Notify admin
          await createAdminNotification({
            title: 'Payment Failed',
            message: `Payment failed for subscription - 48h grace period`,
            severity: 'warning',
            userId: userId || key,
            metadata: {
              action: 'payment_failed',
              eventType: event.event_type,
              gracePeriodEndsAt: gracePeriodEndsAt.toString(),
            },
          });
        }
        break;
      }

      default:
        console.log('Unhandled webhook event type:', event.event_type);
        
        // Log unhandled webhook for admin review
        await recordSecurityEvent({
          eventType: 'admin_action',
          severity: 'info',
          userId: userId || organizationId || 'system',
          endpoint: 'webhook',
          message: `Unhandled webhook event: ${event.event_type}`,
          metadata: {
            eventType: event.event_type,
            eventId: event.event_id,
            paddleSubscriptionId: event.data.id,
          },
          timestamp: Date.now(),
        });
    }

    // Store webhook history for debugging
    try {
      const webhookHistoryData = {
        eventId: event.event_id,
        eventType: event.event_type,
        userId: userId || organizationId || 'unknown',
        status: 'processed',
        processedAt: Date.now(),
      };

      const webhookKey = `${Date.now()}_${event.event_id}`;
      const encodedWebhookData = encodeDocData(webhookHistoryData);

      await retryOperation(async () =>
        await setDocStore({
          caller: id(),
          collection: 'webhook_history',
          key: webhookKey,
          doc: {
            data: encodedWebhookData,
          },
        })
      );
    } catch (error) {
      console.error('Error storing webhook history:', error);
      // Don't fail webhook if history storage fails
    }

    // Return success response
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Notify admin of webhook failure
    try {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await notifyWebhookFailure('paddle', errorMessage);
      
      await recordSecurityEvent({
        eventType: 'admin_action',
        severity: 'critical',
        userId: 'system',
        endpoint: 'webhook',
        message: `Webhook processing failed: ${errorMessage}`,
        metadata: {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
        },
        timestamp: Date.now(),
      });
    } catch (notifyError) {
      console.error('Failed to notify webhook failure:', notifyError);
    }
    
    return new Response('Internal Server Error', { status: 500 });
  }
}
