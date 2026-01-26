/**
 * Paddle Webhook Handler for Juno Satellite
 * 
 * This function receives webhook events from Paddle when subscription changes occur.
 * It verifies the webhook signature and updates subscription data in Juno datastore.
 * 
 * Webhook events handled:
 * - subscription.created - New subscription created
 * - subscription.updated - Subscription modified (plan change, etc.)
 * - subscription.canceled - Subscription canceled
 * - subscription.past_due - Payment failed
 * - subscription.paused - Subscription paused
 * - subscription.resumed - Subscription resumed
 */

import { id } from '@junobuild/functions/ic-cdk';
import {
  encodeDocData,
  decodeDocData,
  setDocStore,
  getDocStore,
} from '@junobuild/functions/sdk';

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

/**
 * Map Paddle price ID to our plan ID
 * This should match the price IDs configured in your Paddle dashboard
 */
function getPlanIdFromPriceId(priceId: string): string {
  const priceMapping: Record<string, string> = {
    // Individual plans
    [process.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || '']: 'starter',
    [process.env.VITE_PADDLE_PRICE_STARTER_ANNUAL || '']: 'starter',
    [process.env.VITE_PADDLE_PRICE_PROFESSIONAL_MONTHLY || '']: 'professional',
    [process.env.VITE_PADDLE_PRICE_PROFESSIONAL_ANNUAL || '']: 'professional',
    [process.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY || '']: 'enterprise',
    [process.env.VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL || '']: 'enterprise',
    
    // Organization plans
    [process.env.VITE_PADDLE_PRICE_TEAM_MONTHLY || '']: 'team',
    [process.env.VITE_PADDLE_PRICE_TEAM_ANNUAL || '']: 'team',
    [process.env.VITE_PADDLE_PRICE_BUSINESS_MONTHLY || '']: 'business',
    [process.env.VITE_PADDLE_PRICE_BUSINESS_ANNUAL || '']: 'business',
    [process.env.VITE_PADDLE_PRICE_ENTERPRISE_ORG_MONTHLY || '']: 'enterprise_org',
    [process.env.VITE_PADDLE_PRICE_ENTERPRISE_ORG_ANNUAL || '']: 'enterprise_org',
  };

  return priceMapping[priceId] || 'free';
}

/**
 * Determine subscription type (individual vs organization) from plan ID
 */
function getSubscriptionType(planId: string): 'individual' | 'organization' {
  const orgPlans = ['team', 'business', 'enterprise_org'];
  return orgPlans.includes(planId) ? 'organization' : 'individual';
}

/**
 * Get seat count for organization plans
 */
function getSeatsIncluded(planId: string): number | undefined {
  const seatsMapping: Record<string, number> = {
    'team': 5,
    'business': 15,
    'enterprise_org': 50,
  };
  return seatsMapping[planId];
}

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

    const planId = getPlanIdFromPriceId(priceId);
    const subscriptionType = getSubscriptionType(planId);
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

        // Determine which key to use (organization or user)
        const key = finalOrganizationId || userId!;
        
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
        break;
      }

      case 'subscription.canceled':
      case 'subscription.past_due':
      case 'subscription.paused': {
        // Update subscription status
        const key = organizationId || userId!;
        
        const existingDoc = await getDocStore({
          caller: id(),
          collection: 'subscriptions',
          key,
        });

        if (existingDoc) {
          const decodedData = decodeDocData<{ type?: string; [key: string]: unknown }>(existingDoc.data);
          const isOrgSubscription = decodedData.type === 'organization';
          
          // For organization subscriptions that are canceled, set grace period (7 days)
          const gracePeriodEndsAt = isOrgSubscription && event.event_type === 'subscription.canceled'
            ? Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
            : undefined;

          const updatedData = {
            ...decodedData,
            status: event.data.status,
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

          console.log(`Subscription ${event.event_type} for ${key}${gracePeriodEndsAt ? ' with grace period' : ''}`);

          // If grace period started, create notifications for all organization members
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

      default:
        console.log('Unhandled webhook event type:', event.event_type);
    }

    // Return success response
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
