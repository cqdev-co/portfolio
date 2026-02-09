import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/schema';

export const metadata: Metadata = {
  title: 'Stock Scanners | Trading Tools',
  description:
    'Professional trading scanners for identifying market opportunities. ' +
    'Includes penny stock explosion detection and unusual options activity scanning.',
  keywords: [
    'stock scanner',
    'trading tools',
    'penny stocks',
    'options scanner',
    'unusual options',
    'breakout scanner',
    'market scanner',
    'day trading',
    'swing trading',
  ],
  openGraph: {
    title: 'Stock Scanners | Trading Tools',
    description:
      'Professional trading scanners for identifying penny stock breakouts and unusual options activity.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stock Scanners | Trading Tools',
    description: 'Professional trading scanners for penny stocks and options.',
  },
};

export default function ScannersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: 'https://conorq.com' },
          { name: 'Scanners', url: 'https://conorq.com/scanners' },
        ]}
      />
      {children}
    </>
  );
}
