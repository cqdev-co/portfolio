/**
 * Signal Continuity Badges Component
 *
 * Displays badges for signal continuity tracking from hourly cron jobs:
 * - NEW badge for first-time detections
 * - Detection count badge for continuing signals
 * - Active/Inactive status badge
 * - Time since last detection
 */

import { Badge } from '@/components/ui/badge';
import type { UnusualOptionsSignal } from '@/lib/types/unusual-options';
import {
  getTimeSinceDetection,
  getActiveStatusColor,
  formatDetectionCount,
} from '@/lib/types/unusual-options';

interface SignalContinuityBadgesProps {
  signal: UnusualOptionsSignal;
  showNewBadge?: boolean;
  showDetectionCount?: boolean;
  showActiveStatus?: boolean;
  showTimestamp?: boolean;
}

export function SignalContinuityBadges({
  signal,
  showNewBadge = true,
  showDetectionCount = true,
  showActiveStatus = true,
  showTimestamp = true,
}: SignalContinuityBadgesProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* NEW badge for first-time detections */}
      {showNewBadge && signal.is_new_signal && (
        <Badge
          className="bg-green-500/10 text-green-500 border-green-500/20"
          variant="outline"
        >
          ✨ NEW
        </Badge>
      )}

      {/* Detection count for continuing signals */}
      {showDetectionCount && signal.detection_count > 1 && (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-500 border-blue-500/20"
        >
          🔄 {formatDetectionCount(signal.detection_count)}
        </Badge>
      )}

      {/* Active/Inactive status */}
      {showActiveStatus && (
        <Badge
          variant="outline"
          className={getActiveStatusColor(signal.is_active)}
        >
          {signal.is_active ? '🟢 Active' : '⚪ Inactive'}
        </Badge>
      )}

      {/* Time since last detection */}
      {showTimestamp && signal.last_detected_at && (
        <span className="text-xs text-muted-foreground">
          Last seen: {getTimeSinceDetection(signal.last_detected_at)}
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for table cells
 */
export function CompactContinuityBadge({
  signal,
}: {
  signal: UnusualOptionsSignal;
}) {
  // Show most important badge only
  if (signal.is_new_signal) {
    return (
      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
        NEW
      </Badge>
    );
  }

  if (signal.detection_count > 2) {
    return (
      <Badge variant="outline" className="text-xs">
        {signal.detection_count}x
      </Badge>
    );
  }

  if (!signal.is_active) {
    return (
      <Badge variant="outline" className="bg-gray-500/10 text-gray-500">
        Inactive
      </Badge>
    );
  }

  return null;
}

/**
 * Detailed view for signal detail pages
 */
export function DetailedContinuityInfo({
  signal,
}: {
  signal: UnusualOptionsSignal;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <SignalContinuityBadges signal={signal} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">First Detected:</span>
          <p className="font-medium">
            {signal.first_detected_at
              ? new Date(signal.first_detected_at).toLocaleString()
              : 'Unknown'}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">Last Detected:</span>
          <p className="font-medium">
            {signal.last_detected_at
              ? new Date(signal.last_detected_at).toLocaleString()
              : 'Unknown'}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">Detection Count:</span>
          <p className="font-medium">{signal.detection_count}x</p>
        </div>

        <div>
          <span className="text-muted-foreground">Status:</span>
          <p className="font-medium">
            {signal.is_active ? '🟢 Active' : '⚪ Inactive'}
          </p>
        </div>
      </div>
    </div>
  );
}
