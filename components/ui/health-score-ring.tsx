/**
 * Health Score Ring Component
 * 
 * Circular progress ring with color coding based on health score
 */

'use client';

import { cn } from '@/lib/utils';

interface HealthScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
}

export function HealthScoreRing({
  score,
  size = 'md',
  showLabel = true,
  className,
}: HealthScoreRingProps) {
  // Clamp score between 0 and 100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStrokeColor = (score: number) => {
    if (score >= 80) return '#22c55e'; // green-500
    if (score >= 50) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'h-16 w-16',
      svg: 64,
      strokeWidth: 6,
      radius: 28,
      fontSize: 'text-lg',
      labelSize: 'text-xs',
    },
    md: {
      container: 'h-24 w-24',
      svg: 96,
      strokeWidth: 8,
      radius: 40,
      fontSize: 'text-2xl',
      labelSize: 'text-sm',
    },
    lg: {
      container: 'h-32 w-32',
      svg: 128,
      strokeWidth: 10,
      radius: 54,
      fontSize: 'text-3xl',
      labelSize: 'text-base',
    },
    xl: {
      container: 'h-48 w-48',
      svg: 192,
      strokeWidth: 12,
      radius: 84,
      fontSize: 'text-5xl',
      labelSize: 'text-lg',
    },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className={cn('relative', config.container)}>
        <svg
          className="transform -rotate-90"
          width={config.svg}
          height={config.svg}
          viewBox={`0 0 ${config.svg} ${config.svg}`}
        >
          {/* Background circle */}
          <circle
            cx={config.svg / 2}
            cy={config.svg / 2}
            r={config.radius}
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            fill="none"
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx={config.svg / 2}
            cy={config.svg / 2}
            r={config.radius}
            stroke={getStrokeColor(clampedScore)}
            strokeWidth={config.strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-in-out"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', config.fontSize, getColor(clampedScore))}>
            {Math.round(clampedScore)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className={cn('font-medium text-muted-foreground', config.labelSize)}>
          Health Score
        </span>
      )}
    </div>
  );
}

interface HealthScoreBadgeProps {
  score: number;
  className?: string;
}

export function HealthScoreBadge({ score, className }: HealthScoreBadgeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  const getColor = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 text-green-700 dark:text-green-400';
    if (score >= 50) return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
    return 'bg-red-500/10 text-red-700 dark:text-red-400';
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
        getColor(clampedScore),
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {Math.round(clampedScore)}
    </div>
  );
}
