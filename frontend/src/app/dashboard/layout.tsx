import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fund Dashboard | Command Center',
  description:
    'Private hedge fund command center with portfolio overview, market regime, ' +
    'risk management, and signal intelligence.',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
