/**
 * Date utility functions for admin dashboard analytics
 * All dates are stored in UTC in the database (YYYY-MM-DD format)
 * and displayed in user's local timezone
 */

/**
 * Get current date in UTC as YYYY-MM-DD string
 */
export function getCurrentUTCDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get UTC date from N days ago as YYYY-MM-DD string
 */
export function getUTCDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Format UTC date string to localized date string for display
 * @param utcDateString - Date in YYYY-MM-DD format
 * @param locale - User's locale (from i18n)
 */
export function formatDateLocal(utcDateString: string, locale: string): string {
  const date = new Date(utcDateString + 'T00:00:00Z'); // Ensure UTC interpretation
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get date range in UTC for Juno queries
 * Returns timestamps in nanoseconds (bigint) for Juno's createdAt matcher
 */
export function getDateRangeInUTC(days: number): { start: bigint; end: bigint } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Convert to nanoseconds (Juno uses nanosecond precision)
  const startTimestamp = BigInt(startDate.getTime()) * BigInt(1_000_000);
  const endTimestamp = BigInt(endDate.getTime()) * BigInt(1_000_000);
  
  return { start: startTimestamp, end: endTimestamp };
}

/**
 * Generate CSV content from chart data
 */
export function generateChartCSV(
  data: Array<{ date: string; count: number }>,
  _metricName: string, // Prefix with _ to indicate intentionally unused
  translations: { date: string; count: string }
): string {
  const header = `${translations.date},${translations.count}`;
  const rows = data.map(item => `${item.date},${item.count}`);
  return [header, ...rows].join('\n');
}

/**
 * Generate JSON export from chart data
 */
export function generateChartJSON(
  data: Array<{ date: string; count: number }>,
  metricName: string,
  metadata: { exportedAt: string; timeRange: number }
): string {
  const exportData = {
    metricName,
    exportedAt: metadata.exportedAt,
    timeRangeDays: metadata.timeRange,
    dataPoints: data.length,
    data,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Download file to user's computer
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Cache chart data in localStorage with expiration
 */
export function cacheChartData(
  key: string,
  data: any,
  expirationHours: number = 24
): void {
  try {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + expirationHours * 60 * 60 * 1000,
    };
    // Use custom replacer to handle BigInt serialization
    localStorage.setItem(`chart_cache_${key}`, JSON.stringify(cacheEntry, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
  } catch (error) {
    console.warn('Failed to cache chart data:', error);
  }
}

/**
 * Get cached chart data from localStorage
 * Returns null if expired or not found
 */
export function getCachedChartData(key: string): any | null {
  try {
    const cached = localStorage.getItem(`chart_cache_${key}`);
    if (!cached) return null;

    const cacheEntry = JSON.parse(cached);
    if (Date.now() > cacheEntry.expiresAt) {
      localStorage.removeItem(`chart_cache_${key}`);
      return null;
    }

    return cacheEntry.data;
  } catch (error) {
    console.warn('Failed to retrieve cached chart data:', error);
    return null;
  }
}

/**
 * Debounce function for performance optimization on mobile
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Detect anomalies in time series data using standard deviation
 * @param data - Array of data points with count values
 * @param threshold - Number of standard deviations to consider anomalous (default: 2)
 * @returns Array with anomaly flags and reasons
 */
export function detectAnomalies(
  data: Array<{ date: string; count: number }>,
  threshold: number = 2
): Array<{ date: string; count: number; isAnomaly?: boolean; anomalyReason?: string }> {
  if (data.length < 3) return data; // Need at least 3 points for meaningful stats

  // Calculate mean and standard deviation
  const values = data.map(d => d.count);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Mark anomalies
  return data.map(item => {
    const deviation = Math.abs(item.count - mean);
    const isAnomaly = deviation > threshold * stdDev;
    
    if (!isAnomaly) return item;

    const percentDiff = ((item.count - mean) / mean * 100).toFixed(0);
    const anomalyReason = item.count > mean
      ? `Spike: ${percentDiff}% above average`
      : `Drop: ${Math.abs(Number(percentDiff))}% below average`;

    return {
      ...item,
      isAnomaly: true,
      anomalyReason,
    };
  });
}

/**
 * Fill missing dates in data with zero values
 */
export function fillMissingDates(
  startDate: string,
  endDate: string,
  dataMap: Map<string, { documentsProcessed: number; templatesUploaded: number }>
): Array<{ date: string; documentsProcessed: number; templatesUploaded: number }> {
  const result: Array<{ date: string; documentsProcessed: number; templatesUploaded: number }> = [];

  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const data = dataMap.get(dateStr) || { documentsProcessed: 0, templatesUploaded: 0 };
    result.push({
      date: dateStr,
      ...data,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}
