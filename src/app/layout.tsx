import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import Navbar from "@/components/navbar";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Particles } from "@/components/magicui/particles";
import { Analytics } from "@vercel/analytics/react"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = { 
  title: "portfolio",
  description: "Professional portfolio showcasing my work and skills",
  keywords: ["portfolio", "web development", "developer", "projects"],
  authors: [{ name: "Conor Quinlan" }],
  creator: "Conor Quinlan",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://conorq.com",
    title: "My Portfolio",
    description: "Professional portfolio showcasing my work and skills",
    siteName: "Conor Quinlan's Portfolio",
    images: [{
      url: "https://conorq.com/og-image.jpg", // Replace with an actual OG image path
      width: 1200,
      height: 630,
      alt: "Conor Quinlan - Portfolio"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Portfolio",
    description: "Professional portfolio showcasing my work and skills",
    creator: "@realconorcodes", // Replace with your Twitter handle if applicable
    images: ["https://conorq.com/og-image.jpg"], // Same as OG image
  },
  robots: {
    index: true,
    follow: true,
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "min-h-screen flex flex-col antialiased bg-white dark:bg-gray-950"
        )}
      >
        <Analytics />
        {/* Particles background */}
        <Particles 
          className="fixed inset-0 -z-10" 
          quantity={80}
          color="#8b5cf6" // Blue color, but you can customize
          ease={80}
          size={0.6}
          staticity={50}
        />
        
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <Header />
            <main className="flex-1 pt-6 pb-28 px-4 sm:px-6 md:px-8 max-w-4xl mx-auto w-full text-sm sm:text-base">
              {children}
            </main>
            <Navbar />
            <Footer />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
