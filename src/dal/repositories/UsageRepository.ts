import { BaseRepository } from '../core/BaseRepository';
import type { UsageData } from '../../types/subscription';
import type { Doc } from '@junobuild/core';

export class UsageRepository extends BaseRepository<UsageData> {
  constructor() {
    super('usage');
  }

  /**
   * Get usage for a specific user and date
   */
  async getByUserAndDate(userId: string, date: string): Promise<Doc<UsageData> | undefined> {
    const key = `${userId}_${date}`;
    return this.get(key);
  }

  /**
   * Get all usage records for a specific date
   */
  async getByDate(date: string): Promise<Array<Doc<UsageData>>> {
    const allUsage = await this.list();
    return allUsage.filter(doc => doc.key.endsWith(`_${date}`));
  }

  /**
   * Get usage records for a specific user
   */
  async getByUser(userId: string): Promise<Array<Doc<UsageData>>> {
    const allUsage = await this.list();
    return allUsage.filter(doc => doc.key.startsWith(`${userId}_`));
  }

  /**
   * Get usage records for a user within a date range
   */
  async getByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<Doc<UsageData>>> {
    const userUsage = await this.getByUser(userId);
    return userUsage.filter(doc => {
      const date = doc.key.split('_').pop();
      return date && date >= startDate && date <= endDate;
    });
  }

  /**
   * Record or update usage for a user on a specific date
   */
  async recordUsage(
    userId: string,
    date: string,
    documentsProcessed: number,
    templatesUploaded: number
  ): Promise<Doc<UsageData>> {
    const key = `${userId}_${date}`;
    const existing = await this.get(key);

    const usageData: UsageData = {
      date,
      documentsProcessed,
      templatesUploaded
    };

    if (existing) {
      return this.update(key, usageData, existing.version);
    }

    return this.create(key, usageData, userId);
  }

  /**
   * Increment usage counters for a user on a specific date
   */
  async incrementUsage(
    userId: string,
    date: string,
    documentsProcessed: number = 0,
    templatesUploaded: number = 0
  ): Promise<Doc<UsageData>> {
    const key = `${userId}_${date}`;
    const existing = await this.get(key);

    if (existing) {
      const updatedData: UsageData = {
        date,
        documentsProcessed: existing.data.documentsProcessed + documentsProcessed,
        templatesUploaded: existing.data.templatesUploaded + templatesUploaded
      };
      return this.update(key, updatedData, existing.version);
    }

    const newData: UsageData = {
      date,
      documentsProcessed,
      templatesUploaded
    };
    return this.create(key, newData, userId);
  }

  /**
   * Get total usage across all users for a specific date
   */
  async getTotalUsageForDate(date: string): Promise<{
    documentsProcessed: number;
    templatesUploaded: number;
    userCount: number;
  }> {
    const dateUsage = await this.getByDate(date);
    
    return dateUsage.reduce(
      (acc, doc) => ({
        documentsProcessed: acc.documentsProcessed + doc.data.documentsProcessed,
        templatesUploaded: acc.templatesUploaded + doc.data.templatesUploaded,
        userCount: acc.userCount + 1
      }),
      { documentsProcessed: 0, templatesUploaded: 0, userCount: 0 }
    );
  }

  /**
   * Get usage summary for a user in a specific month
   */
  async getMonthlyUsage(userId: string, yearMonth: string): Promise<{
    documentsProcessed: number;
    templatesUploaded: number;
  }> {
    const userUsage = await this.getByUser(userId);
    const monthlyUsage = userUsage.filter(doc => {
      const date = doc.key.split('_').pop();
      return date && date.startsWith(yearMonth);
    });

    return monthlyUsage.reduce(
      (acc, doc) => ({
        documentsProcessed: acc.documentsProcessed + doc.data.documentsProcessed,
        templatesUploaded: acc.templatesUploaded + doc.data.templatesUploaded
      }),
      { documentsProcessed: 0, templatesUploaded: 0 }
    );
  }
}
