import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get health score color based on score value
 * @param score - Health score from 0 to 100
 * @returns Color string: 'green', 'yellow', or 'red'
 */
export function getHealthScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) {
    return 'green';
  } else if (score >= 50) {
    return 'yellow';
  } else {
    return 'red';
  }
}

/**
 * Get Tailwind CSS color classes for health score
 * @param score - Health score from 0 to 100
 * @returns Tailwind CSS class string for text and background colors
 */
export function getHealthScoreColorClass(score: number): string {
  const color = getHealthScoreColor(score);
  
  switch (color) {
    case 'green':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'yellow':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'red':
      return 'text-red-600 bg-red-50 border-red-200';
  }
}
