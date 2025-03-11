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
import { DATA } from "@/data/resume";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = { 
  title: {
    default: "cgq | portfolio",
    template: "%s | cgq",
  },
  description: "Professional portfolio showcasing my work and skills as a Security Engineer specializing in cloud security and DevSecOps",
  metadataBase: new URL(DATA.url || "https://conorq.com"),
  authors: [
    {
      name: "Conor Quinlan",
      url: DATA.url || "https://conorq.com",
    },
  ],
  generator: "Next.js",
  applicationName: "Conor Quinlan Portfolio",
  referrer: "origin-when-cross-origin",
  keywords: ["portfolio", "security engineer", "developer", "cloud security", "DevSecOps"],
  creator: "Conor Quinlan",
  publisher: "Conor Quinlan",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="schema-org-person"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: "Conor Quinlan",
              url: DATA.url || "https://conorq.com",
              jobTitle: "Security Engineer",
              worksFor: {
                "@type": "Organization",
                name: "Cyera",
              },
              description: "Security Engineer specializing in cloud security, DevSecOps, and building secure, resilient systems and infrastructure."
            })
          }}
        />
      </head>
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
