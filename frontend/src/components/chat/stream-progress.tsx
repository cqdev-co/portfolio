'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StreamProgressProps {
  isActive: boolean;
  className?: string;
  size?: number;
}

/**
 * Circular progress indicator for streaming state.
 * Shows an indeterminate spinning progress ring.
 */
export function StreamProgress({
  isActive,
  className,
  size = 16,
}: StreamProgressProps) {
  if (!isActive) return null;

  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
    >
      {/* Background ring */}
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
      </svg>

      {/* Animated progress arc */}
      <motion.svg
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{
          repeat: Infinity,
          duration: 1.2,
          ease: 'linear',
        }}
      >
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-primary"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference * 0.75 }}
          animate={{
            strokeDashoffset: [
              circumference * 0.75,
              circumference * 0.25,
              circumference * 0.75,
            ],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
            ease: 'easeInOut',
          }}
          style={{
            transformOrigin: 'center',
          }}
        />
      </motion.svg>

      {/* Center dot pulse */}
      <motion.div
        className={cn('absolute inset-0 flex items-center justify-center')}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'easeInOut',
        }}
      >
        <div
          className="rounded-full bg-primary"
          style={{ width: size * 0.15, height: size * 0.15 }}
        />
      </motion.div>
    </div>
  );
}

/**
 * Linear progress bar for streaming state.
 * Alternative to circular progress.
 */
export function StreamProgressBar({
  isActive,
  className,
}: {
  isActive: boolean;
  className?: string;
}) {
  if (!isActive) return null;

  return (
    <div
      className={cn(
        'h-0.5 w-full overflow-hidden rounded-full bg-muted/30',
        className
      )}
    >
      <motion.div
        className="h-full bg-primary rounded-full"
        initial={{ x: '-100%', width: '30%' }}
        animate={{ x: '400%' }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}
