import type { Metadata } from "next";
import { createMetadata } from "@/lib/utils";

export const metadata: Metadata = createMetadata({
  title: "Unusual Options Scanner - Detect Insider Trading Activity",
  description: "Advanced unusual options activity scanner identifying suspicious trades that might indicate insider information. Real-time detection of large bets, short-dated urgency, and smart money positioning. Professional trading tool with 0DTE filtering and earnings calendar integration.",
  pageUrl: "/unusual-options-scanner",
  type: "website",
  imagePath: "/unusual-options-scanner/opengraph-image.png",
  imageAlt: "Unusual Options Scanner - Detect Insider Trading Activity",
  keywords: [
    "unusual options activity",
    "options flow scanner",
    "insider trading detection",
    "smart money tracker",
    "options scanner",
    "trading tools",
    "options flow",
    "large block trades",
    "sweep orders",
    "premium flow",
    "options volume",
    "insider plays",
    "unusual options",
    "stock market analysis",
    "trading signals",
    "market intelligence",
    "professional trading",
    "algorithmic trading",
    "options analysis",
    "informed trading"
  ],
});

export default function UnusualOptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

