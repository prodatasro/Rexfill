// Paddle.js integration for subscription management
// Documentation: https://developer.paddle.com/paddlejs/overview

declare global {
  interface Window {
    Paddle?: {
      Initialize: (options: PaddleInitOptions) => void;
      Checkout: {
        open: (options: PaddleCheckoutOptions) => void;
      };
      Environment: {
        set: (env: 'sandbox' | 'production') => void;
      };
    };
  }
}

interface PaddleInitOptions {
  token: string;
  eventCallback?: (event: PaddleEvent) => void;
}

interface PaddleCheckoutOptions {
  items: Array<{ priceId: string; quantity: number }>;
  customData?: Record<string, string>;
  customer?: {
    email?: string;
  };
  settings?: {
    displayMode?: 'overlay' | 'inline';
    theme?: 'light' | 'dark';
    locale?: string;
    successUrl?: string;
    allowLogout?: boolean;
  };
}

interface PaddleEvent {
  name: string;
  data?: Record<string, unknown>;
}

// Environment variables for Paddle configuration
const PADDLE_CLIENT_TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN || '';
const PADDLE_ENVIRONMENT = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'production';

// Price IDs for each plan (configure in .env)
export const PADDLE_PRICES = {
  starter: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_STARTER_MONTHLY || '',
    annual: import.meta.env.VITE_PADDLE_PRICE_STARTER_ANNUAL || '',
  },
  professional: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_PROFESSIONAL_MONTHLY || '',
    annual: import.meta.env.VITE_PADDLE_PRICE_PROFESSIONAL_ANNUAL || '',
  },
  enterprise: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_MONTHLY || '',
    annual: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_ANNUAL || '',
  },
  team: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_TEAM_MONTHLY || '',
    annual: import.meta.env.VITE_PADDLE_PRICE_TEAM_ANNUAL || '',
  },
  business: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_BUSINESS_MONTHLY || '',
    annual: import.meta.env.VITE_PADDLE_PRICE_BUSINESS_ANNUAL || '',
  },
  enterprise_org: {
    monthly: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_ORG_MONTHLY || '',
    annual: import.meta.env.VITE_PADDLE_PRICE_ENTERPRISE_ORG_ANNUAL || '',
  },
};

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize Paddle.js
 * This loads the Paddle script and initializes it with your client token
 */
export const initPaddle = (): Promise<void> => {
  // Return existing promise if already initializing
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return immediately if already initialized
  if (isInitialized && window.Paddle) {
    return Promise.resolve();
  }

  initializationPromise = new Promise((resolve, reject) => {
    // Check if Paddle is configured
    if (!PADDLE_CLIENT_TOKEN) {
      console.warn('Paddle client token not configured. Subscription features will be limited.');
      resolve();
      return;
    }

    // Check if script already loaded
    if (window.Paddle) {
      try {
        window.Paddle.Initialize({
          token: PADDLE_CLIENT_TOKEN,
          eventCallback: handlePaddleEvent,
        });
        
        // Set environment (sandbox or production)
        if (PADDLE_ENVIRONMENT === 'sandbox') {
          window.Paddle.Environment.set('sandbox');
        }
        
        isInitialized = true;
        console.log('Paddle initialized successfully');
        resolve();
      } catch (error) {
        reject(error);
      }
      return;
    }

    // Load Paddle script
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;

    script.onload = () => {
      if (window.Paddle) {
        try {
          window.Paddle.Initialize({
            token: PADDLE_CLIENT_TOKEN,
            eventCallback: handlePaddleEvent,
          });
          
          // Set environment (sandbox or production)
          if (PADDLE_ENVIRONMENT === 'sandbox') {
            window.Paddle.Environment.set('sandbox');
          }
          
          isInitialized = true;
          console.log('Paddle initialized successfully');
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Paddle failed to initialize'));
      }
    };

    script.onerror = () => {
      reject(new Error('Failed to load Paddle script'));
    };

    document.body.appendChild(script);
  });

  return initializationPromise;
};

/**
 * Handle Paddle events
 */
const handlePaddleEvent = (event: PaddleEvent) => {
  console.log('Paddle event:', event.name, event.data);

  switch (event.name) {
    case 'checkout.completed':
      // Subscription was successfully created
      console.log('✅ Checkout completed:', event.data);
      
      // Store subscription ID in localStorage for the redirect
      const subscriptionId = (event.data as any)?.subscription?.id;
      const transactionId = (event.data as any)?.transaction_id;
      
      console.log('Subscription ID:', subscriptionId);
      console.log('Transaction ID:', transactionId);
      
      if (subscriptionId) {
        localStorage.setItem('paddle_checkout_subscription_id', subscriptionId);
        localStorage.setItem('paddle_checkout_timestamp', Date.now().toString());
      }
      
      // Trigger a refresh of subscription data
      window.dispatchEvent(new CustomEvent('paddle:checkout-completed', { detail: event.data }));
      break;

    case 'checkout.closed':
      // User closed the checkout without completing
      console.log('Checkout closed');
      break;

    case 'checkout.error':
      // An error occurred during checkout
      console.error('Checkout error:', event.data);
      break;

    default:
      break;
  }
};

/**
 * Open Paddle checkout for a subscription
 */
export const openCheckout = async (
  planId: 'starter' | 'professional' | 'enterprise' | 'team' | 'business' | 'enterprise_org',
  billingCycle: 'monthly' | 'annual',
  options?: {
    email?: string;
    customData?: Record<string, string>;
    theme?: 'light' | 'dark';
    locale?: string;
    organizationName?: string; // For organization plan checkouts
  }
): Promise<void> => {
  // Ensure Paddle is initialized
  await initPaddle();

  if (!window.Paddle) {
    throw new Error('Paddle is not available. Please check your configuration.');
  }

  const priceId = PADDLE_PRICES[planId]?.[billingCycle];

  if (!priceId) {
    throw new Error(`Price ID not configured for ${planId} ${billingCycle}`);
  }

  // Check if this is an organization plan
  const isOrgPlan = ['team', 'business', 'enterprise_org'].includes(planId);

  try {
    const customData = {
      ...options?.customData,
      ...(isOrgPlan && options?.organizationName && { 
        organizationName: options.organizationName,
        isOrganizationPlan: 'true'
      }),
    };

    console.log('[PADDLE] Opening checkout with customData:', customData);

    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(Object.keys(customData).length > 0 && { customData }),
      ...(options?.email && { customer: { email: options.email } }),
      settings: {
        displayMode: 'overlay',
        theme: options?.theme || 'light',
        locale: options?.locale || 'en',
        allowLogout: false,
        // Paddle will append ?_ptxn={transaction_id} automatically
        // We need to use checkout.completed event instead for subscription_id
        successUrl: `${window.location.origin}/app/profile?success=true`,
      },
    });
  } catch (error) {
    console.error('Failed to open Paddle checkout:', error);
    throw error;
  }
};

/**
 * Check if Paddle is configured and available
 */
export const isPaddleConfigured = (): boolean => {
  return Boolean(PADDLE_CLIENT_TOKEN);
};
