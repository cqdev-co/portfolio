/**
 * Alerts Command
 * View and manage triggered alerts
 */

import chalk from 'chalk';
import {
  getRecentAlerts,
  acknowledgeAlert,
  isConfigured,
  type Alert,
  type AlertType,
} from '../services/supabase.ts';

// ============================================================================
// LIST ALERTS COMMAND
// ============================================================================

export interface ListAlertsOptions {
  limit?: number;
  ticker?: string;
  type?: AlertType;
  unacknowledgedOnly?: boolean;
}

/**
 * Display recent alerts
 */
export async function listAlerts(
  options: ListAlertsOptions = {}
): Promise<void> {
  console.log();
  console.log(chalk.bold.white('  🔔 RECENT ALERTS'));
  console.log(
    chalk.gray(
      '  ────────────────────────────────────────────────────────────────────'
    )
  );
  console.log();

  if (!isConfigured()) {
    console.log(
      chalk.yellow(
        '  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    );
    console.log();
    return;
  }

  const alerts = await getRecentAlerts({
    limit: options.limit ?? 20,
    ticker: options.ticker,
    alertType: options.type,
    unacknowledgedOnly: options.unacknowledgedOnly,
  });

  if (alerts.length === 0) {
    if (options.unacknowledgedOnly) {
      console.log(chalk.gray('  No unacknowledged alerts.'));
    } else {
      console.log(chalk.gray('  No alerts found.'));
    }
    console.log();
    return;
  }

  for (const alert of alerts) {
    displayAlert(alert);
  }

  console.log(chalk.gray(`  Showing ${alerts.length} alert(s)`));
  if (options.unacknowledgedOnly) {
    console.log(
      chalk.gray("  Use 'bun run analyst alerts ack <id>' to acknowledge")
    );
  }
  console.log();
}

/**
 * Display a single alert
 */
function displayAlert(alert: Alert): void {
  const priorityColor =
    alert.priority === 'HIGH'
      ? chalk.red
      : alert.priority === 'MEDIUM'
        ? chalk.yellow
        : chalk.green;

  const priorityIcon =
    alert.priority === 'HIGH'
      ? '🔴'
      : alert.priority === 'MEDIUM'
        ? '🟡'
        : '🟢';

  const typeIcon = getAlertTypeIcon(alert.alertType);
  const ackStatus = alert.acknowledged
    ? chalk.gray('✓ ACK')
    : chalk.cyan('NEW');

  const dateStr = alert.createdAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  console.log(
    chalk.gray('  ') +
      priorityIcon +
      ' ' +
      typeIcon +
      ' ' +
      priorityColor(alert.alertType.padEnd(16)) +
      chalk.cyan(alert.ticker.padEnd(8)) +
      ackStatus
  );

  console.log(chalk.gray('     ' + dateStr));
  console.log(chalk.white('     ' + alert.headline));

  if (alert.aiConviction) {
    console.log(chalk.gray(`     Conviction: ${alert.aiConviction}/10`));
  }

  if (alert.aiReasoning) {
    console.log(chalk.gray(`     ${alert.aiReasoning.substring(0, 80)}...`));
  }

  console.log(chalk.gray(`     ID: ${alert.id.substring(0, 8)}`));
  console.log();
}

/**
 * Get icon for alert type
 */
function getAlertTypeIcon(type: AlertType): string {
  switch (type) {
    case 'ENTRY_SIGNAL':
      return '🎯';
    case 'EXIT_SIGNAL':
      return '🚪';
    case 'POSITION_RISK':
      return '⚠️';
    case 'EARNINGS_WARNING':
      return '📅';
    case 'NEWS_EVENT':
      return '📰';
    case 'MACRO_EVENT':
      return '🏛️';
    default:
      return '📋';
  }
}

// ============================================================================
// ACKNOWLEDGE ALERT COMMAND
// ============================================================================

/**
 * Acknowledge an alert
 */
export async function ackAlert(id: string): Promise<void> {
  console.log();

  if (!isConfigured()) {
    console.log(
      chalk.yellow(
        '  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    );
    console.log();
    return;
  }

  // Allow partial ID matching
  const alerts = await getRecentAlerts({ limit: 100 });
  const matchingAlert = alerts.find((a) => a.id.startsWith(id));

  if (!matchingAlert) {
    console.log(chalk.red(`  ✗ No alert found with ID starting with '${id}'`));
    console.log();
    return;
  }

  if (matchingAlert.acknowledged) {
    console.log(chalk.yellow(`  ⚠️  Alert already acknowledged`));
    console.log();
    return;
  }

  const success = await acknowledgeAlert(matchingAlert.id);

  if (success) {
    console.log(
      chalk.green(
        `  ✓ Alert acknowledged: ${matchingAlert.ticker} - ${matchingAlert.alertType}`
      )
    );
  } else {
    console.log(chalk.red(`  ✗ Failed to acknowledge alert`));
  }
  console.log();
}

// ============================================================================
// VIEW SINGLE ALERT
// ============================================================================

/**
 * View details of a specific alert
 */
export async function viewAlert(id: string): Promise<void> {
  console.log();

  if (!isConfigured()) {
    console.log(
      chalk.yellow(
        '  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    );
    console.log();
    return;
  }

  const alerts = await getRecentAlerts({ limit: 100 });
  const alert = alerts.find((a) => a.id.startsWith(id));

  if (!alert) {
    console.log(chalk.red(`  ✗ No alert found with ID starting with '${id}'`));
    console.log();
    return;
  }

  console.log(chalk.bold.white('  📋 ALERT DETAILS'));
  console.log(
    chalk.gray(
      '  ────────────────────────────────────────────────────────────────────'
    )
  );
  console.log();

  console.log(chalk.white('  ID:          ') + chalk.gray(alert.id));
  console.log(chalk.white('  Ticker:      ') + chalk.cyan(alert.ticker));
  console.log(chalk.white('  Type:        ') + chalk.white(alert.alertType));
  console.log(
    chalk.white('  Priority:    ') + getPriorityBadge(alert.priority)
  );
  console.log(
    chalk.white('  Created:     ') +
      chalk.gray(alert.createdAt.toLocaleString())
  );
  console.log(
    chalk.white('  Acknowledged:') +
      (alert.acknowledged ? chalk.green(' Yes') : chalk.yellow(' No'))
  );

  if (alert.acknowledgedAt) {
    console.log(
      chalk.white('  Ack Time:    ') +
        chalk.gray(alert.acknowledgedAt.toLocaleString())
    );
  }

  console.log();
  console.log(chalk.white('  Headline:'));
  console.log(chalk.gray('  ' + alert.headline));

  if (alert.analysis) {
    console.log();
    console.log(chalk.white('  Analysis:'));
    console.log(chalk.gray('  ' + alert.analysis));
  }

  if (alert.aiConviction) {
    console.log();
    console.log(
      chalk.white('  AI Conviction: ') + chalk.cyan(`${alert.aiConviction}/10`)
    );
  }

  if (alert.aiReasoning) {
    console.log(chalk.white('  AI Reasoning:'));
    console.log(chalk.gray('  ' + alert.aiReasoning));
  }

  if (Object.keys(alert.data).length > 0) {
    console.log();
    console.log(chalk.white('  Data:'));
    console.log(
      chalk.gray(
        '  ' + JSON.stringify(alert.data, null, 2).split('\n').join('\n  ')
      )
    );
  }

  console.log();
}

/**
 * Get colored priority badge
 */
function getPriorityBadge(priority: string): string {
  switch (priority) {
    case 'HIGH':
      return chalk.red('HIGH');
    case 'MEDIUM':
      return chalk.yellow('MEDIUM');
    case 'LOW':
      return chalk.green('LOW');
    default:
      return chalk.gray(priority);
  }
}

// ============================================================================
// SUMMARY COMMAND
// ============================================================================

/**
 * Display alerts summary
 */
export async function alertsSummary(): Promise<void> {
  console.log();
  console.log(chalk.bold.white('  📊 ALERTS SUMMARY'));
  console.log(
    chalk.gray(
      '  ────────────────────────────────────────────────────────────────────'
    )
  );
  console.log();

  if (!isConfigured()) {
    console.log(
      chalk.yellow(
        '  ⚠️  Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY'
      )
    );
    console.log();
    return;
  }

  const alerts = await getRecentAlerts({ limit: 100 });

  if (alerts.length === 0) {
    console.log(chalk.gray('  No alerts in the last 7 days.'));
    console.log();
    return;
  }

  // Count by type
  const byType = new Map<AlertType, number>();
  const byPriority = new Map<string, number>();
  let unacknowledged = 0;

  for (const alert of alerts) {
    byType.set(alert.alertType, (byType.get(alert.alertType) ?? 0) + 1);
    byPriority.set(alert.priority, (byPriority.get(alert.priority) ?? 0) + 1);
    if (!alert.acknowledged) unacknowledged++;
  }

  console.log(
    chalk.white('  Total alerts:        ') +
      chalk.cyan(alerts.length.toString())
  );
  console.log(
    chalk.white('  Unacknowledged:      ') +
      (unacknowledged > 0
        ? chalk.yellow(unacknowledged.toString())
        : chalk.gray('0'))
  );

  console.log();
  console.log(chalk.white('  By Type:'));
  for (const [type, count] of byType) {
    const icon = getAlertTypeIcon(type);
    console.log(chalk.gray(`    ${icon} ${type.padEnd(18)} ${count}`));
  }

  console.log();
  console.log(chalk.white('  By Priority:'));
  for (const priority of ['HIGH', 'MEDIUM', 'LOW']) {
    const count = byPriority.get(priority) ?? 0;
    const badge = getPriorityBadge(priority);
    console.log(chalk.gray(`    ${badge.padEnd(20)} ${count}`));
  }

  console.log();
}
