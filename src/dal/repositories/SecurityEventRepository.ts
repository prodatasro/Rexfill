import { BaseRepository } from '../core/BaseRepository';

export type SecuritySeverity = 'critical' | 'warning' | 'info';

export interface SecurityEventData {
  description: string; // Format: "severity:{severity};message:{message}"
  endpoint?: string;
  metadata?: Record<string, any>;
}

export interface ParsedSecurityEvent {
  eventType: string;
  severity: SecuritySeverity;
  userId: string;
  endpoint: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

/**
 * Repository for managing security events
 * Key format: {timestamp}_{userId}_{eventType}
 */
export class SecurityEventRepository extends BaseRepository<SecurityEventData> {
  constructor() {
    super('security_events');
  }

  /**
   * Parse a security event document into a structured format
   */
  private parseEvent(doc: { key: string; data: SecurityEventData }): ParsedSecurityEvent {
    const parts = doc.key.split('_');
    const timestamp = parseInt(parts[0]);
    const userId = parts[1];
    const eventType = parts.slice(2).join('_'); // Event type might contain underscores
    
    // Parse description for severity and message
    const description = doc.data.description || '';
    const severityMatch = description.match(/severity:(critical|warning|info);/);
    const severity = (severityMatch ? severityMatch[1] : 'info') as SecuritySeverity;
    const messageMatch = description.match(/message:([^;]+)/);
    const message = messageMatch ? messageMatch[1] : '';
    
    return {
      eventType,
      severity,
      userId,
      endpoint: doc.data.endpoint || '',
      message,
      metadata: doc.data.metadata,
      timestamp,
    };
  }

  /**
   * List all security events and parse them
   */
  async listAllParsed(): Promise<ParsedSecurityEvent[]> {
    const docs = await this.list();
    return docs
      .map(doc => this.parseEvent(doc))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get security events within a time range
   */
  async getByTimeRange(startTime: number, endTime?: number): Promise<ParsedSecurityEvent[]> {
    const allEvents = await this.listAllParsed();
    return allEvents.filter(event => {
      if (event.timestamp < startTime) return false;
      if (endTime && event.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Get security events by severity
   */
  async getBySeverity(severity: SecuritySeverity): Promise<ParsedSecurityEvent[]> {
    const allEvents = await this.listAllParsed();
    return allEvents.filter(event => event.severity === severity);
  }

  /**
   * Get security events by user
   */
  async getByUser(userId: string): Promise<ParsedSecurityEvent[]> {
    const allEvents = await this.listAllParsed();
    return allEvents.filter(event => event.userId === userId);
  }

  /**
   * Create a security event
   */
  async createEvent(
    userId: string,
    eventType: string,
    severity: SecuritySeverity,
    message: string,
    endpoint?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const timestamp = Date.now();
    const key = `${timestamp}_${userId}_${eventType}`;
    const description = `severity:${severity};message:${message}`;
    
    await this.create(key, {
      description,
      endpoint,
      metadata,
    }, userId);
  }
}
