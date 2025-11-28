"use client";

import { 
  Opportunity, 
  CreditSpreadDetails 
} from "@/lib/odyssey/strategies/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  formatCurrency,
  formatRiskReward,
  formatConfidence,
  formatDTE,
  formatExpirationDate,
  getConfidenceColor,
} from "@/lib/odyssey/utils/formatters";
import { TrendingUp, TrendingDown, Target, Shield } from "lucide-react";

interface OpportunityDetailsProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OpportunityDetails({
  opportunity,
  isOpen,
  onClose,
}: OpportunityDetailsProps) {
  if (!opportunity) return null;

  const isCreditSpread = 
    opportunity.opportunityType === "credit_spread";
  const details = isCreditSpread
    ? (opportunity.details as CreditSpreadDetails)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="font-mono text-base">
              {opportunity.symbol}
            </Badge>
            <Badge className={getConfidenceColor(opportunity.confidence)}>
              {formatConfidence(opportunity.confidence)} Confidence
            </Badge>
          </div>
          <DialogTitle className="text-xl">
            {opportunity.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {opportunity.description}
          </p>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Key Metrics */}
          {details && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Key Metrics
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard
                  label="Max Profit"
                  value={formatCurrency(details.maxProfit)}
                  icon={<TrendingUp className="h-4 w-4 text-green-500" />}
                  valueColor="text-green-600 dark:text-green-400"
                />
                <MetricCard
                  label="Max Risk"
                  value={formatCurrency(details.maxRisk)}
                  icon={<Shield className="h-4 w-4 text-red-500" />}
                  valueColor="text-red-600 dark:text-red-400"
                />
                <MetricCard
                  label="Risk/Reward"
                  value={formatRiskReward(opportunity.riskReward)}
                />
                <MetricCard
                  label="Days to Expiration"
                  value={formatDTE(details.dte)}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Position Details */}
          {details && (
            <div>
              <h3 className="font-semibold mb-3">Position Details</h3>
              <div className="grid gap-3 text-sm">
                <DetailRow
                  label="Direction"
                  value={
                    <Badge variant="secondary">
                      {details.direction === "bull_put" ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {details.direction.replace("_", " ").toUpperCase()}
                    </Badge>
                  }
                />
                <DetailRow
                  label="Short Strike"
                  value={`${formatCurrency(details.shortStrike)} @ ${formatCurrency(details.shortPrice)}`}
                />
                <DetailRow
                  label="Long Strike"
                  value={`${formatCurrency(details.longStrike)} @ ${formatCurrency(details.longPrice)}`}
                />
                <DetailRow
                  label="Spread Width"
                  value={formatCurrency(details.spreadWidth)}
                />
                <DetailRow
                  label="Net Premium"
                  value={formatCurrency(details.premium)}
                />
                <DetailRow
                  label="Break Even"
                  value={formatCurrency(details.breakEven)}
                />
                <DetailRow
                  label="Expiration"
                  value={formatExpirationDate(details.expiration)}
                />
                {details.probabilityOfProfit && (
                  <DetailRow
                    label="Probability of Profit"
                    value={`${details.probabilityOfProfit}%`}
                  />
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Trade Checklist */}
          <div>
            <h3 className="font-semibold mb-3">Trade Checklist</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  Verify current market price and ensure strikes are
                  appropriate
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Check options liquidity and bid-ask spread</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  Review upcoming events (earnings, ex-dividend dates)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  Calculate position size based on account risk
                  tolerance
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>
                  Set profit target and stop loss levels before entry
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Document trade thesis and exit plan</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`text-lg font-bold ${valueColor || ""}`}>
        {value}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

