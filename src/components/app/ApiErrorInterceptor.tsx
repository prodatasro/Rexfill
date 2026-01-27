/**
 * Global API Error Interceptor
 * 
 * Intercepts fetch responses and handles subscription/quota/rate-limit errors globally
 * Shows appropriate modals with upgrade prompts based on plan tier
 */

import { FC, useEffect } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { showErrorToast } from '../../utils/toast';
import { useTranslation } from 'react-i18next';

export const ApiErrorInterceptor: FC = () => {
  const { t } = useTranslation();
  const { plan, showUpgradePrompt } = useSubscription();

  useEffect(() => {
    // Store original fetch
    const originalFetch = window.fetch;

    // Override global fetch
    window.fetch = async (...args): Promise<Response> => {
      const response = await originalFetch(...args);

      // Clone response for error handling (can only read body once)
      const clonedResponse = response.clone();

      // Check for subscription/quota/rate-limit errors
      if (!response.ok) {
        try {
          const errorData = await clonedResponse.json();

          // Handle 402 Payment Required - Subscription Expired
          if (response.status === 402 && errorData.error?.code === 'subscription_expired') {
            showErrorToast(t('subscription.expired'));
            showUpgradePrompt();
            return response;
          }

          // Handle 403 Forbidden - Quota Exceeded
          if (response.status === 403 && errorData.error?.code === 'quota_exceeded') {
            const message = errorData.error?.message || t('subscription.quotaExceeded');
            showErrorToast(message);
            showUpgradePrompt();
            return response;
          }

          // Handle 403 Forbidden - Tier Limit
          if (response.status === 403 && errorData.error?.code === 'tier_limit') {
            const message = errorData.error?.message || t('subscription.tierLimitExceeded');
            showErrorToast(message);
            showUpgradePrompt();
            return response;
          }

          // Handle 429 Too Many Requests - Rate Limit
          if (response.status === 429 && errorData.error?.code === 'rate_limit') {
            const retryAfter = errorData.error?.retryAfterSeconds || 60;
            showErrorToast(
              t('subscription.rateLimitExceeded', { seconds: retryAfter })
            );
            return response;
          }
        } catch (parseError) {
          // Not JSON or other parsing error - let caller handle
          console.error('Error parsing response:', parseError);
        }
      }

      return response;
    };

    // Cleanup: restore original fetch on unmount
    return () => {
      window.fetch = originalFetch;
    };
  }, [t, plan, showUpgradePrompt]);

  return null; // This component renders nothing
};

export default ApiErrorInterceptor;
