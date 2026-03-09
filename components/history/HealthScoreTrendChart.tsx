/**
 * Health Score Trend Chart Component
 * 
 * Displays a line chart showing health score over time
 */

'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

interface HealthScoreTrend {
  run_id: string;
  created_at: string;
  health_score: number;
  total_findings: number;
}

interface HealthScoreTrendChartProps {
  projectId: string;
  limit?: number;
}

export function HealthScoreTrendChart({ projectId, limit = 10 }: HealthScoreTrendChartProps) {
  const [trend, setTrend] = useState<HealthScoreTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrend() {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/history?action=trend&limit=${limit}`
        );
        const data = await response.json();

        if (data.success) {
          setTrend(data.data);
        } else {
          setError('Failed to load trend data');
        }
      } catch (err) {
        setError('Error loading trend data');
      } finally {
        setLoading(false);
      }
    }

    fetchTrend();
  }, [projectId, limit]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-500">{error}</p>
      </Card>
    );
  }

  if (trend.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-gray-500">No historical data available</p>
      </Card>
    );
  }

  // Calculate chart dimensions
  const maxScore = 100;
  const minScore = 0;
  const chartHeight = 256;
  const chartWidth = 600;
  const padding = 40;

  // Calculate points for the line chart
  const points = trend.map((point, index) => {
    const x = padding + (index / (trend.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - ((point.health_score - minScore) / (maxScore - minScore)) * (chartHeight - 2 * padding);
    return { x, y, ...point };
  });

  // Create SVG path
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // green
    if (score >= 50) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Health Score Trend</h3>
      
      <svg width={chartWidth} height={chartHeight} className="w-full">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((value) => {
          const y = chartHeight - padding - ((value - minScore) / (maxScore - minScore)) * (chartHeight - 2 * padding);
          return (
            <g key={value}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x={padding - 10} y={y + 4} fontSize="12" fill="#6b7280" textAnchor="end">
                {value}
              </text>
            </g>
          );
        })}

        {/* Line chart */}
        <path
          d={pathData}
          fill="none"
          stroke={getScoreColor(points[points.length - 1].health_score)}
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <g key={point.run_id}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill={getScoreColor(point.health_score)}
            />
            <title>
              {new Date(point.created_at).toLocaleDateString()}: {point.health_score.toFixed(1)}
            </title>
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((point, index) => {
          if (index % Math.ceil(points.length / 5) === 0 || index === points.length - 1) {
            return (
              <text
                key={`label-${index}`}
                x={point.x}
                y={chartHeight - padding + 20}
                fontSize="10"
                fill="#6b7280"
                textAnchor="middle"
              >
                {new Date(point.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </text>
            );
          }
          return null;
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <div>
          Latest: <span className="font-semibold">{points[points.length - 1].health_score.toFixed(1)}</span>
        </div>
        <div>
          Total Runs: <span className="font-semibold">{trend.length}</span>
        </div>
      </div>
    </Card>
  );
}
