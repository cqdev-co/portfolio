import type { Metadata } from "next";
import { createMetadata } from "@/lib/utils";

export const metadata: Metadata = createMetadata({
  title: "Volatility Squeeze Scanner",
  description: "Real-time analysis of volatility squeeze signals across market instruments. Identify potential breakout opportunities with technical indicators and AI-powered insights.",
});

export default function VolatilitySqueezeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
