"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Pin,
  Clock,
  Target,
  Shield,
  TrendingUp,
} from "lucide-react";
import { HPFChecklistResult, ChecklistCondition } from 
  "@/lib/odyssey/strategies/types";
import { 
  HPFEntryRules, 
  HPFExitRules 
} from "@/lib/odyssey/strategies/HPFIndexCreditSpreadStrategy";
import { formatTime } from "@/lib/odyssey/utils/formatters";

interface StrategyChecklistProps {
  checklist: HPFChecklistResult | null;
  entryRules: HPFEntryRules;
  exitRules: HPFExitRules;
  isLoading?: boolean;
  onPin?: () => void;
  isPinned?: boolean;
}

function ConditionRow({ condition }: { condition: ChecklistCondition }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div 
      className={`border-b border-border/30 last:border-b-0 ${
        condition.passed ? "" : "bg-red-50/50 dark:bg-red-900/10"
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 py-2.5 px-2 
          hover:bg-muted/30 transition-colors text-left"
      >
        {/* Status icon */}
        {condition.passed ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 
            dark:text-green-400 flex-shrink-0" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600 
            dark:text-red-400 flex-shrink-0" />
        )}

        {/* Condition name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${
              condition.passed 
                ? "text-foreground" 
                : "text-red-700 dark:text-red-400"
            }`}>
              {condition.name}
            </span>
            {condition.importance === "critical" && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                Critical
              </Badge>
            )}
          </div>
        </div>

        {/* Value */}
        <span className="text-xs text-muted-foreground">
          {condition.value}
        </span>

        {/* Expand icon */}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-9 pb-2.5 text-xs text-muted-foreground">
          <p>{condition.description}</p>
          {condition.threshold && (
            <p className="mt-1">
              <span className="font-medium">Threshold:</span>{" "}
              {condition.threshold}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RulesSection({ 
  title, 
  icon, 
  children 
}: { 
  title: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-t border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 py-2 px-1 
          text-sm font-medium text-muted-foreground 
          hover:text-foreground transition-colors"
      >
        {icon}
        <span>{title}</span>
        <div className="flex-1" />
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>
      {expanded && (
        <div className="pb-3 px-1 text-xs space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

export function StrategyChecklist({
  checklist,
  entryRules,
  exitRules,
  isLoading = false,
  onPin,
  isPinned = false,
}: StrategyChecklistProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-muted/50 animate-pulse rounded"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!checklist) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            HPF-ICS Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Run analysis to see checklist results
          </p>
        </CardContent>
      </Card>
    );
  }

  const passedCount = checklist.conditions.filter((c) => c.passed).length;
  const totalCount = checklist.conditions.length;

  return (
    <Card className={`${
      checklist.recommendation === "GO" 
        ? "border-green-500/30 bg-gradient-to-br from-background " +
          "to-green-500/5"
        : checklist.recommendation === "CAUTION"
        ? "border-amber-500/30 bg-gradient-to-br from-background " +
          "to-amber-500/5"
        : "border-red-500/30 bg-gradient-to-br from-background " +
          "to-red-500/5"
    }`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            HPF-ICS Checklist
          </CardTitle>
          <div className="flex items-center gap-2">
            {onPin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPin}
                className={`h-7 w-7 p-0 ${
                  isPinned ? "text-amber-500" : ""
                }`}
              >
                <Pin className={`h-3.5 w-3.5 ${
                  isPinned ? "fill-current" : ""
                }`} />
              </Button>
            )}
            <Badge
              variant={
                checklist.recommendation === "GO"
                  ? "default"
                  : checklist.recommendation === "CAUTION"
                  ? "secondary"
                  : "destructive"
              }
              className={
                checklist.recommendation === "GO"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              {checklist.recommendation}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTime(checklist.timestamp)}
          <span className="mx-1">•</span>
          {passedCount}/{totalCount} conditions met
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Summary */}
        <div className={`p-2.5 rounded-md mb-3 flex items-start gap-2 ${
          checklist.recommendation === "GO"
            ? "bg-green-100/50 dark:bg-green-900/20"
            : checklist.recommendation === "CAUTION"
            ? "bg-amber-100/50 dark:bg-amber-900/20"
            : "bg-red-100/50 dark:bg-red-900/20"
        }`}>
          {checklist.recommendation === "GO" ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 
              dark:text-green-400 mt-0.5 flex-shrink-0" />
          ) : checklist.recommendation === "CAUTION" ? (
            <AlertTriangle className="h-4 w-4 text-amber-600 
              dark:text-amber-400 mt-0.5 flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600 
              dark:text-red-400 mt-0.5 flex-shrink-0" />
          )}
          <p className="text-sm">{checklist.summary}</p>
        </div>

        {/* Conditions */}
        <div className="border rounded-md overflow-hidden">
          {checklist.conditions.map((condition) => (
            <ConditionRow key={condition.id} condition={condition} />
          ))}
        </div>

        {/* Rules sections */}
        <div className="mt-4 space-y-0">
          <RulesSection 
            title="Entry Rules" 
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 
              text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">DTE:</span>{" "}
                {entryRules.targetDte.min}-{entryRules.targetDte.max} days
              </div>
              <div>
                <span className="font-medium text-foreground">Target:</span>{" "}
                {entryRules.targetDte.target} DTE
              </div>
              <div>
                <span className="font-medium text-foreground">Delta:</span>{" "}
                {entryRules.shortDelta.min * 100}-
                {entryRules.shortDelta.max * 100}Δ
              </div>
              <div>
                <span className="font-medium text-foreground">Width:</span>{" "}
                ${entryRules.spreadWidth.join(" or $")}
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Min Credit:
                </span>{" "}
                {(entryRules.minCreditPercent * 100).toFixed(0)}% of width
              </div>
              <div>
                <span className="font-medium text-foreground">
                  Max Risk:
                </span>{" "}
                {(entryRules.maxRiskPercent * 100).toFixed(1)}% portfolio
              </div>
            </div>
          </RulesSection>

          <RulesSection 
            title="Exit Rules" 
            icon={<Shield className="h-3.5 w-3.5" />}
          >
            <div className="space-y-1 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs w-6 
                  justify-center">A</Badge>
                <span>
                  <span className="font-medium text-foreground">
                    Profit Target:
                  </span>{" "}
                  Close at {(exitRules.profitTarget * 100).toFixed(0)}% profit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs w-6 
                  justify-center">B</Badge>
                <span>
                  <span className="font-medium text-foreground">
                    Time Exit:
                  </span>{" "}
                  Close at {exitRules.maxDteToClose} DTE remaining
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs w-6 
                  justify-center">C</Badge>
                <span>
                  <span className="font-medium text-foreground">
                    Stop Loss:
                  </span>{" "}
                  Close at {exitRules.maxLossMultiple}× initial credit
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs w-6 
                  justify-center">D</Badge>
                <span>
                  <span className="font-medium text-foreground">
                    Delta Defense:
                  </span>{" "}
                  Close if delta reaches{" "}
                  {(exitRules.deltaDefense * 100).toFixed(0)}Δ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs w-6 
                  justify-center">E</Badge>
                <span>
                  <span className="font-medium text-foreground">
                    VIX Panic:
                  </span>{" "}
                  Close all if VIX &gt; {exitRules.vixPanicLevel}
                </span>
              </div>
            </div>
          </RulesSection>
        </div>
      </CardContent>
    </Card>
  );
}

