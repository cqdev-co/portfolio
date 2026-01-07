import { PositionsPageClient } from '@/components/positions/positions-page-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Positions | Portfolio Tracker',
  description:
    'Track and manage your stock and options positions with ' +
    'live market data and AI-powered analysis.',
};

export default function PositionsPage() {
  return <PositionsPageClient />;
}
