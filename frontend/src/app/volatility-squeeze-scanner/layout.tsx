import type { Metadata } from "next";
import { createMetadata } from "@/lib/utils";
import { VolatilityScannerSchema, FinancialServiceSchema } from "@/components/schema/volatility-scanner-schema";

export const metadata: Metadata = createMetadata({
  title: "Volatility Squeeze Scanner - Professional Stock Market Analysis Tool",
  description: "Advanced volatility squeeze scanner identifying stocks with compressed price movement before explosive breakouts. Professional trading tool with real-time signals, technical analysis, and 1.2-3.3% historical accuracy. Free stock market scanner for day traders and swing traders.",
  pageUrl: "/volatility-squeeze-scanner",
  type: "website",
  imagePath: "/volatility-squeeze-scanner/opengraph-image.png",
  imageAlt: "Volatility Squeeze Scanner - Professional Stock Market Analysis Tool",
  keywords: [
    "volatility squeeze scanner",
    "stock market analysis",
    "trading tools",
    "technical analysis",
    "bollinger bands",
    "keltner channels",
    "stock scanner",
    "day trading",
    "swing trading",
    "market volatility",
    "breakout stocks",
    "squeeze strategy",
    "financial analysis",
    "stock signals",
    "trading signals",
    "market scanner",
    "professional trading",
    "stock screening",
    "momentum trading",
    "volatility analysis"
  ],
});

export default function VolatilitySqueezeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <VolatilityScannerSchema />
      <FinancialServiceSchema />
      {children}
    </>
  );
}
