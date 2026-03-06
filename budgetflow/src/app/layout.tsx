import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { DbInitProvider } from '@/components/providers/db-init-provider';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AiChatSidebar } from '@/components/ai/ai-chat-sidebar';
import { cn } from '@/lib/utils';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'BudgetFlow',
    template: '%s | BudgetFlow',
  },
  description:
    'Personal local finance dashboard for budgeting and spending visualization.',
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
          'min-h-screen antialiased'
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <DbInitProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  <main className="flex-1 p-6">{children}</main>
                </SidebarInset>
                <AiChatSidebar />
              </SidebarProvider>
            </DbInitProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
