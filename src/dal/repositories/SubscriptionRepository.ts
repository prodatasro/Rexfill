import { BaseRepository } from '../core/BaseRepository';
import type { SubscriptionData, UsageData } from '../../types/subscription';
import type { Doc } from '@junobuild/core';

// Simple usage wrapper class for usage collection
class UsageRepository extends BaseRepository<UsageData> {
  constructor() {
    super('usage');
  }
}

export class SubscriptionRepository extends BaseRepository<SubscriptionData> {
  private usageRepository: UsageRepository;

  constructor() {
    super('subscriptions');
    this.usageRepository = new UsageRepository();
  }

  /**
   * Get subscription by user principal
   */
  async getByPrincipal(principal: string): Promise<Doc<SubscriptionData> | undefined> {
    return this.get(principal);
  }

  /**
   * Get subscription by organization ID
   */
  async getByOrganization(orgId: string): Promise<Doc<SubscriptionData> | undefined> {
    const subscriptions = await this.list();
    return subscriptions.find(s => s.data.organizationId === orgId);
  }

  /**
   * Get all active subscriptions
   */
  async getActive(): Promise<Array<Doc<SubscriptionData>>> {
    const subscriptions = await this.list();
    return subscriptions.filter(s => s.data.status === 'active');
  }

  /**
   * Get subscriptions by plan type
   */
  async getByPlan(planId: string): Promise<Array<Doc<SubscriptionData>>> {
    const subscriptions = await this.list();
    return subscriptions.filter(s => s.data.planId === planId);
  }

  /**
   * Check if subscription is active
   */
  async isActive(principal: string): Promise<boolean> {
    const subscription = await this.get(principal);
    return subscription?.data.status === 'active';
  }

  /**
   * Update subscription status
   */
  async updateStatus(
    principal: string,
    status: SubscriptionData['status']
  ): Promise<Doc<SubscriptionData>> {
    const subscription = await this.getOrThrow(principal);
    return this.update(principal, {
      ...subscription.data,
      status,
      updatedAt: Date.now()
    }, subscription.version);
  }

  /**
   * Update subscription plan
   */
  async updatePlan(
    principal: string,
    planId: string
  ): Promise<Doc<SubscriptionData>> {
    const subscription = await this.getOrThrow(principal);
    return this.update(principal, {
      ...subscription.data,
      planId: planId as SubscriptionData['planId'],
      updatedAt: Date.now()
    }, subscription.version);
  }

  /**
   * Cancel subscription
   */
  async cancel(principal: string): Promise<Doc<SubscriptionData>> {
    const subscription = await this.getOrThrow(principal);
    return this.update(principal, {
      ...subscription.data,
      status: 'cancelled',
      cancelAtPeriodEnd: true,
      updatedAt: Date.now()
    }, subscription.version);
  }

  // Usage tracking methods

  /**
   * Get usage record for a user
   */
  async getUsage(principal: string): Promise<Doc<UsageData> | undefined> {
    return this.usageRepository.get(principal);
  }

  /**
   * Update usage data
   */
  async updateUsage(
    principal: string,
    data: UsageData
  ): Promise<Doc<UsageData>> {
    const existing = await this.usageRepository.get(principal);

    if (existing) {
      return this.usageRepository.update(principal, data, existing.version);
    }

    return this.usageRepository.create(principal, data, principal);
  }

  /**
   * Increment template upload count
   */
  async incrementTemplateUsage(principal: string): Promise<void> {
    const usage = await this.getUsage(principal);
    const today = new Date().toISOString().split('T')[0];

    if (usage) {
      const count = usage.data.date === today 
        ? usage.data.templatesUploaded + 1 
        : 1;

      await this.updateUsage(principal, {
        date: today,
        documentsProcessed: usage.data.date === today ? usage.data.documentsProcessed : 0,
        templatesUploaded: count
      });
    } else {
      await this.updateUsage(principal, {
        date: today,
        documentsProcessed: 0,
        templatesUploaded: 1
      });
    }
  }

  /**
   * Increment document processing count
   */
  async incrementDocumentUsage(principal: string): Promise<void> {
    const usage = await this.getUsage(principal);
    const today = new Date().toISOString().split('T')[0];

    if (usage) {
      const count = usage.data.date === today 
        ? usage.data.documentsProcessed + 1 
        : 1;

      await this.updateUsage(principal, {
        date: today,
        documentsProcessed: count,
        templatesUploaded: usage.data.date === today ? usage.data.templatesUploaded : 0
      });
    } else {
      await this.updateUsage(principal, {
        date: today,
        documentsProcessed: 1,
        templatesUploaded: 0
      });
    }
  }
}
