import type { Metadata } from "next";
import { createMetadata } from "@/lib/utils";

export const metadata: Metadata = createMetadata({
  title: "Odyssey | Trading Dashboard",
  description: 
    "Modern trading dashboard for market overview and opportunity detection",
});

export default function OdysseyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Odyssey</h1>
        <p className="text-sm text-muted-foreground">
          Market overview and opportunity detection dashboard
        </p>
      </div>
      {children}
    </div>
  );
}

