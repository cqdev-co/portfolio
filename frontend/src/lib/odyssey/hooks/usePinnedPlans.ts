import { useState, useEffect, useCallback } from "react";
import { PinnedPlan } from "../strategies/types";
import {
  DEFAULT_ENTRY_RULES,
  DEFAULT_EXIT_RULES,
} from "../strategies/HPFIndexCreditSpreadStrategy";

const STORAGE_KEY = "odyssey-pinned-plans";

// Default HPF-ICS plan
const DEFAULT_HPF_PLAN: PinnedPlan = {
  id: "hpf-ics-default",
  name: "HPF Index Credit Spread",
  description:
    "High-probability filtered bull put spreads on SPX. " +
    "Requires uptrend + momentum + IV conditions before entry.",
  strategy: "HPF-ICS",
  entryRules: DEFAULT_ENTRY_RULES,
  exitRules: DEFAULT_EXIT_RULES,
  notes: [
    "Only bull put spreads in uptrend",
    "Target 45 DTE, 16-25 delta short puts",
    "Min credit: 33% of spread width",
    "Close at 50% profit OR 21 DTE",
    "Stop at 2× loss or 40 delta",
    "Check FOMC/CPI calendar weekly",
  ],
  createdAt: new Date(),
  isPinned: true,
};

interface UsePinnedPlansResult {
  plans: PinnedPlan[];
  pinnedPlan: PinnedPlan | null;
  addPlan: (plan: Omit<PinnedPlan, "id" | "createdAt">) => void;
  removePlan: (id: string) => void;
  pinPlan: (id: string) => void;
  unpinPlan: (id: string) => void;
  updatePlan: (id: string, updates: Partial<PinnedPlan>) => void;
}

/**
 * Hook to manage pinned trading plans
 * Persists to localStorage for cross-session access
 */
export function usePinnedPlans(): UsePinnedPlansResult {
  const [plans, setPlans] = useState<PinnedPlan[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Rehydrate dates
        const rehydrated = parsed.map((p: PinnedPlan) => ({
          ...p,
          createdAt: new Date(p.createdAt),
        }));
        setPlans(rehydrated);
      } else {
        // Initialize with default plan
        setPlans([DEFAULT_HPF_PLAN]);
      }
    } catch (err) {
      console.error("Error loading pinned plans:", err);
      setPlans([DEFAULT_HPF_PLAN]);
    }
    setIsInitialized(true);
  }, []);

  // Persist to localStorage when plans change
  useEffect(() => {
    if (!isInitialized || typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans, isInitialized]);

  const addPlan = useCallback(
    (plan: Omit<PinnedPlan, "id" | "createdAt">) => {
      const newPlan: PinnedPlan = {
        ...plan,
        id: `plan-${Date.now()}`,
        createdAt: new Date(),
      };
      setPlans((prev) => [...prev, newPlan]);
    },
    []
  );

  const removePlan = useCallback((id: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const pinPlan = useCallback((id: string) => {
    setPlans((prev) =>
      prev.map((p) => ({
        ...p,
        isPinned: p.id === id ? true : false,
      }))
    );
  }, []);

  const unpinPlan = useCallback((id: string) => {
    setPlans((prev) =>
      prev.map((p) => ({
        ...p,
        isPinned: p.id === id ? false : p.isPinned,
      }))
    );
  }, []);

  const updatePlan = useCallback(
    (id: string, updates: Partial<PinnedPlan>) => {
      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
    },
    []
  );

  const pinnedPlan = plans.find((p) => p.isPinned) || null;

  return {
    plans,
    pinnedPlan,
    addPlan,
    removePlan,
    pinPlan,
    unpinPlan,
    updatePlan,
  };
}

