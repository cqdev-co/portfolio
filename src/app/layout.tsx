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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = { 
  title: "cgq | portfolio",
  description: "Professional portfolio showcasing my work and skills",
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
          "min-h-screen flex flex-col antialiased"
        )}
      >
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
