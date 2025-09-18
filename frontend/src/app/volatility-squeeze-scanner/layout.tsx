import type { Metadata } from "next";
import { createMetadata } from "@/lib/utils";

export const metadata: Metadata = createMetadata({
  title: "Volatility Squeeze Scanner",
  description: "The volatility squeeze strategy identifies stocks experiencing unusually low price movement, which often precedes explosive breakouts. Deploy when markets are calm and consolidating. These compressed periods historically deliver 1.2-3.3% moves with high accuracy.",
});

export default function VolatilitySqueezeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
