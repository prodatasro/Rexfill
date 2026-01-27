import { FC, useState, useMemo, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, AlertTriangle, ChevronDown } from 'lucide-react';
import { formatDateLocal, debounce } from '../../utils/dateUtils';

export interface ChartDataPoint {
  date: string;
  count: number;
  isAnomaly?: boolean;
  anomalyReason?: string;
}

interface UsageChartProps {
  data: ChartDataPoint[];
  timeRange: 7 | 14 | 30;
  onTimeRangeChange: (range: 7 | 14 | 30) => void;
  title: string;
  color: string;
  metricKey: string;
  onExport: (format: 'csv' | 'json') => void;
  onDateClick?: (date: string, isAnomaly?: boolean, anomalyReason?: string) => void;
  showUpdateIndicator?: boolean;
  lastUpdated?: number;
  comparisonMode?: boolean;
  comparisonData?: ChartDataPoint[];
  comparisonColor?: string;
  comparisonMetricKey?: string;
}

const UsageChart: FC<UsageChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  title,
  color,
  metricKey,
  onExport,
  onDateClick,
  showUpdateIndicator,
  comparisonMode = false,
  comparisonData,
  comparisonColor,
  comparisonMetricKey,
}) => {
  const { t, i18n } = useTranslation();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const chartRef = useRef<SVGSVGElement>(null);
  const exportButtonRef = useRef<HTMLDivElement>(null);

  // Chart dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: comparisonMode ? 60 : 40, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const { xScale, yScale, yScaleComparison } = useMemo(() => {
    if (data.length === 0) {
      return { xScale: () => 0, yScale: () => 0, yScaleComparison: () => 0 };
    }

    const maxValue = Math.max(...data.map(d => d.count), 1);
    const maxComparison = comparisonData ? Math.max(...comparisonData.map(d => d.count), 1) : 0;

    const xScale = (index: number) => (index / (data.length - 1 || 1)) * chartWidth;
    const yScale = (value: number) => chartHeight - (value / maxValue) * chartHeight;
    const yScaleComparison = (value: number) => chartHeight - (value / maxComparison) * chartHeight;

    return { xScale, yScale, yScaleComparison };
  }, [data, comparisonData, chartWidth, chartHeight]);

  // Generate path for line chart
  const linePath = useMemo(() => {
    if (data.length === 0) return '';
    
    return data
      .map((point, i) => {
        const x = xScale(i);
        const y = yScale(point.count);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [data, xScale, yScale]);

  // Generate path for comparison line
  const comparisonPath = useMemo(() => {
    if (!comparisonMode || !comparisonData || comparisonData.length === 0) return '';
    
    return comparisonData
      .map((point, i) => {
        const x = xScale(i);
        const y = yScaleComparison(point.count);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [comparisonMode, comparisonData, xScale, yScaleComparison]);

  // Generate area gradient path
  const areaPath = useMemo(() => {
    if (data.length === 0) return '';
    
    const path = data.map((point, i) => {
      const x = xScale(i);
      const y = yScale(point.count);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return `${path} L ${xScale(data.length - 1)} ${chartHeight} L ${xScale(0)} ${chartHeight} Z`;
  }, [data, xScale, yScale, chartHeight]);

  // Debounced hover handler for mobile performance
  const debouncedSetHovered = useCallback(
    debounce((index: number | null) => setHoveredIndex(index), 50),
    []
  );

  const handlePointClick = useCallback((index: number) => {
    const point = data[index];
    if (onDateClick && point) {
      onDateClick(point.date, point.isAnomaly, point.anomalyReason);
    }
  }, [data, onDateClick]);

  const handleKeyDown = useCallback((e: KeyboardEvent<SVGCircleElement>, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handlePointClick(index);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      setFocusedIndex(index - 1);
      const circles = chartRef.current?.querySelectorAll('circle[tabindex="0"]');
      (circles?.[index - 1] as HTMLElement)?.focus();
    } else if (e.key === 'ArrowRight' && index < data.length - 1) {
      e.preventDefault();
      setFocusedIndex(index + 1);
      const circles = chartRef.current?.querySelectorAll('circle[tabindex="0"]');
      (circles?.[index + 1] as HTMLElement)?.focus();
    }
  }, [data.length, handlePointClick]);

  // Count anomalies
  const anomalyCount = useMemo(() => {
    return data.filter(d => d.isAnomaly).length;
  }, [data]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuOpen && exportButtonRef.current && !exportButtonRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
          {t('admin.dashboard.chart.noData', 'No data available')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          {showUpdateIndicator && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded animate-fade-in">
              <span className="w-1.5 h-1.5 bg-green-600 dark:bg-green-400 rounded-full animate-pulse"></span>
              {t('admin.dashboard.chart.updated', 'Updated')}
            </span>
          )}
          {anomalyCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-medium rounded">
              <AlertTriangle className="w-3 h-3" />
              {t('admin.dashboard.chart.anomalyCount', '{{count}} anomaly', { count: anomalyCount })}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export button with dropdown */}
          <div className="relative" ref={exportButtonRef}>
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('admin.dashboard.chart.export', 'Export')}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
                <button
                  onClick={() => { onExport('csv'); setExportMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-t-lg"
                >
                  {t('admin.dashboard.chart.exportCSV', 'Export CSV')}
                </button>
                <button
                  onClick={() => { onExport('json'); setExportMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-b-lg"
                >
                  {t('admin.dashboard.chart.exportJSON', 'Export JSON')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-2 mb-4">
        {([7, 14, 30] as const).map(range => (
          <button
            key={range}
            onClick={() => onTimeRangeChange(range)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              timeRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {t(`admin.dashboard.timeRange.days${range}`, `${range} days`)}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto -mx-2 px-2">
        <svg
          ref={chartRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          role="img"
          aria-label={`${title}${anomalyCount > 0 ? `, ${anomalyCount} anomalies detected` : ''}`}
        >
          <defs>
            <linearGradient id={`gradient-${metricKey}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
            {comparisonMode && comparisonColor && (
              <linearGradient id={`gradient-${comparisonMetricKey}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={comparisonColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={comparisonColor} stopOpacity="0.05" />
              </linearGradient>
            )}
          </defs>

          <g transform={`translate(${padding.left}, ${padding.top})`}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
              <line
                key={ratio}
                x1={0}
                y1={chartHeight * ratio}
                x2={chartWidth}
                y2={chartHeight * ratio}
                stroke="currentColor"
                strokeWidth="1"
                className="text-slate-200 dark:text-slate-700"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area gradient */}
            <path
              d={areaPath}
              fill={`url(#gradient-${metricKey})`}
            />

            {/* Main line */}
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Comparison line */}
            {comparisonMode && comparisonPath && comparisonColor && (
              <path
                d={comparisonPath}
                fill="none"
                stroke={comparisonColor}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 4"
              />
            )}

            {/* Data points */}
            {data.map((point, i) => {
              const x = xScale(i);
              const y = yScale(point.count);
              const isHovered = hoveredIndex === i || focusedIndex === i;

              return (
                <g key={point.date}>
                  {/* Anomaly indicator */}
                  {point.isAnomaly && (
                    <circle
                      cx={x}
                      cy={y}
                      r="10"
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2"
                      className="opacity-50"
                    />
                  )}
                  
                  {/* Data point circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 6 : 4}
                    fill={point.isAnomaly ? '#f97316' : color}
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer transition-all"
                    style={{ filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none' }}
                    onMouseEnter={() => debouncedSetHovered(i)}
                    onMouseLeave={() => debouncedSetHovered(null)}
                    onClick={() => handlePointClick(i)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${formatDateLocal(point.date, i18n.language)}: ${point.count} ${point.isAnomaly ? `, ${point.anomalyReason}` : ''}`}
                  />
                </g>
              );
            })}

            {/* X-axis labels */}
            {data.map((point, i) => {
              // Show every nth label based on data length to avoid crowding
              const showLabel = data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
              if (!showLabel) return null;

              const x = xScale(i);
              return (
                <text
                  key={`label-${point.date}`}
                  x={x}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="text-xs fill-slate-600 dark:fill-slate-400"
                >
                  {formatDateLocal(point.date, i18n.language).split(',')[0]}
                </text>
              );
            })}

            {/* Y-axis labels */}
            {[0, 0.5, 1].map(ratio => {
              const maxValue = Math.max(...data.map(d => d.count), 1);
              const value = Math.round(maxValue * (1 - ratio));
              return (
                <text
                  key={ratio}
                  x={-10}
                  y={chartHeight * ratio + 5}
                  textAnchor="end"
                  className="text-xs fill-slate-600 dark:fill-slate-400"
                >
                  {value}
                </text>
              );
            })}

            {/* Comparison Y-axis labels (right side) */}
            {comparisonMode && comparisonData && (
              [0, 0.5, 1].map(ratio => {
                const maxValue = Math.max(...comparisonData.map(d => d.count), 1);
                const value = Math.round(maxValue * (1 - ratio));
                return (
                  <text
                    key={`comp-${ratio}`}
                    x={chartWidth + 10}
                    y={chartHeight * ratio + 5}
                    textAnchor="start"
                    className="text-xs fill-slate-600 dark:fill-slate-400"
                  >
                    {value}
                  </text>
                );
              })
            )}

            {/* Tooltip */}
            {hoveredIndex !== null && data[hoveredIndex] && (
              <g>
                <rect
                  x={xScale(hoveredIndex) - 60}
                  y={yScale(data[hoveredIndex].count) - 60}
                  width="120"
                  height={comparisonMode && comparisonData?.[hoveredIndex] ? '65' : data[hoveredIndex].isAnomaly ? '65' : '45'}
                  fill="currentColor"
                  className="text-slate-900 dark:text-slate-800"
                  rx="6"
                  opacity="0.95"
                />
                <text
                  x={xScale(hoveredIndex)}
                  y={yScale(data[hoveredIndex].count) - 40}
                  textAnchor="middle"
                  className="text-xs fill-white font-medium"
                >
                  {formatDateLocal(data[hoveredIndex].date, i18n.language)}
                </text>
                <text
                  x={xScale(hoveredIndex)}
                  y={yScale(data[hoveredIndex].count) - 25}
                  textAnchor="middle"
                  className="text-sm fill-white font-bold"
                >
                  {data[hoveredIndex].count}
                </text>
                {comparisonMode && comparisonData?.[hoveredIndex] && (
                  <text
                    x={xScale(hoveredIndex)}
                    y={yScale(data[hoveredIndex].count) - 10}
                    textAnchor="middle"
                    className="text-xs fill-white opacity-75"
                  >
                    vs {comparisonData[hoveredIndex].count}
                  </text>
                )}
                {data[hoveredIndex].isAnomaly && (
                  <text
                    x={xScale(hoveredIndex)}
                    y={yScale(data[hoveredIndex].count) - 10}
                    textAnchor="middle"
                    className="text-xs fill-orange-400 font-medium"
                  >
                    ⚠ {data[hoveredIndex].anomalyReason?.split(':')[0]}
                  </text>
                )}
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Keyboard hint */}
      {onDateClick && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
          {t('admin.dashboard.chart.clickForDetails', 'Click on a data point for details')}
        </p>
      )}
    </div>
  );
};

export default UsageChart;
