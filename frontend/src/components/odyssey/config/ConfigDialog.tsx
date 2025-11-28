"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  StrategyConfig, 
  OptionsStrategyParameters 
} from "@/lib/odyssey/strategies/types";

interface ConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  config: StrategyConfig;
  onUpdateParams: (
    strategyId: string, 
    params: OptionsStrategyParameters
  ) => void;
}

export function ConfigDialog({
  isOpen,
  onClose,
  config,
  onUpdateParams,
}: ConfigDialogProps) {
  const creditSpreadParams = config.strategies[
    "credit-spread"
  ] as OptionsStrategyParameters;

  const [localParams, setLocalParams] = useState(creditSpreadParams);

  const handleSave = () => {
    onUpdateParams("credit-spread", localParams);
    onClose();
  };

  const handleCancel = () => {
    setLocalParams(creditSpreadParams);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Strategy Configuration</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="credit-spread" className="mt-4">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="credit-spread">
              Credit Spread Strategy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="credit-spread" className="space-y-4">
            {/* Enabled Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enable Strategy</Label>
              <input
                id="enabled"
                type="checkbox"
                checked={localParams.enabled}
                onChange={(e) =>
                  setLocalParams({
                    ...localParams,
                    enabled: e.target.checked,
                  })
                }
                className="h-4 w-4"
              />
            </div>

            {/* DTE Range */}
            <div className="space-y-2">
              <Label>Days to Expiration Range</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minDte" className="text-xs">
                    Min DTE
                  </Label>
                  <Input
                    id="minDte"
                    type="number"
                    value={localParams.minDte}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        minDte: parseInt(e.target.value) || 0,
                      })
                    }
                    min={1}
                  />
                </div>
                <div>
                  <Label htmlFor="maxDte" className="text-xs">
                    Max DTE
                  </Label>
                  <Input
                    id="maxDte"
                    type="number"
                    value={localParams.maxDte}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        maxDte: parseInt(e.target.value) || 0,
                      })
                    }
                    min={1}
                  />
                </div>
              </div>
            </div>

            {/* Risk/Reward Threshold */}
            <div className="space-y-2">
              <Label htmlFor="minRiskReward">
                Minimum Risk/Reward Ratio
              </Label>
              <Input
                id="minRiskReward"
                type="number"
                step="0.1"
                value={localParams.minRiskReward}
                onChange={(e) =>
                  setLocalParams({
                    ...localParams,
                    minRiskReward: parseFloat(e.target.value) || 0,
                  })
                }
                min={0.5}
              />
              <p className="text-xs text-muted-foreground">
                Higher ratios mean lower risk relative to potential
                profit
              </p>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <Label htmlFor="minConfidence">
                Minimum Confidence Score (%)
              </Label>
              <Input
                id="minConfidence"
                type="number"
                value={localParams.minConfidence}
                onChange={(e) =>
                  setLocalParams({
                    ...localParams,
                    minConfidence: parseInt(e.target.value) || 0,
                  })
                }
                min={0}
                max={100}
              />
            </div>

            {/* Max Results */}
            <div className="space-y-2">
              <Label htmlFor="maxResults">Maximum Results</Label>
              <Input
                id="maxResults"
                type="number"
                value={localParams.maxResults}
                onChange={(e) =>
                  setLocalParams({
                    ...localParams,
                    maxResults: parseInt(e.target.value) || 0,
                  })
                }
                min={1}
                max={100}
              />
            </div>

            {/* IV Percentile Range */}
            <div className="space-y-2">
              <Label>IV Percentile Range (Optional)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minIV" className="text-xs">
                    Min IV %
                  </Label>
                  <Input
                    id="minIV"
                    type="number"
                    value={localParams.minIVPercentile || ""}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        minIVPercentile: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    min={0}
                    max={100}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="maxIV" className="text-xs">
                    Max IV %
                  </Label>
                  <Input
                    id="maxIV"
                    type="number"
                    value={localParams.maxIVPercentile || ""}
                    onChange={(e) =>
                      setLocalParams({
                        ...localParams,
                        maxIVPercentile: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    min={0}
                    max={100}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

