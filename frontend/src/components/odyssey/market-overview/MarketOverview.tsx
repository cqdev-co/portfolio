"use client";

import { MarketData, SectorData } from "@/lib/odyssey/strategies/types";
import { IndexCards } from "./IndexCards";
import { VIXIndicator } from "./VIXIndicator";
import { SectorPerformance } from "./SectorPerformance";
import { BarChart3, Activity, PieChart } from "lucide-react";

interface MarketOverviewProps {
  marketData: MarketData[];
  sectorData: SectorData[];
  isLoading?: boolean;
}

function SectionHeader({ 
  icon, 
  title 
}: { 
  icon: React.ReactNode; 
  title: string 
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-slate-500">{icon}</span>
      <h3 className="text-sm font-semibold text-slate-300 uppercase 
        tracking-wider">
        {title}
      </h3>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {/* Index Cards Skeleton */}
      <div>
        <div className="h-4 w-32 bg-slate-800 rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl bg-slate-800/50 animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>

      {/* VIX Skeleton */}
      <div>
        <div className="h-4 w-36 bg-slate-800 rounded mb-4 animate-pulse" />
        <div className="h-48 rounded-2xl bg-slate-800/50 animate-pulse" />
      </div>

      {/* Sectors Skeleton */}
      <div>
        <div className="h-4 w-40 bg-slate-800 rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(11)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-slate-800/50 animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarketOverview({
  marketData,
  sectorData,
  isLoading = false,
}: MarketOverviewProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const vixData = marketData.find((d) => d.symbol === "^VIX");
  const indexData = marketData.filter((d) => d.symbol !== "^VIX");

  return (
    <div className="space-y-8">
      {/* Major Indices Section */}
      <section>
        <SectionHeader 
          icon={<BarChart3 className="h-4 w-4" />}
          title="Major Indices"
        />
        <IndexCards indices={indexData} />
      </section>

      {/* VIX Section */}
      {vixData && (
        <section>
          <SectionHeader 
            icon={<Activity className="h-4 w-4" />}
            title="Volatility Index"
          />
          <VIXIndicator vix={vixData} />
        </section>
      )}

      {/* Sector Performance Section */}
      <section>
        <SectionHeader 
          icon={<PieChart className="h-4 w-4" />}
          title="Sector Performance"
        />
        <SectorPerformance sectors={sectorData} />
      </section>
    </div>
  );
}
