import type { Metadata } from 'next';
import { BreadcrumbSchema } from '@/components/schema';

export const metadata: Metadata = {
  title: 'Penny Stock Scanner | Explosion Setup Detection | ' + 'Conor Quinlan',
  description:
    'Professional penny stock scanner identifying explosive ' +
    'breakout opportunities under $5. Volume-driven analysis ' +
    '(50% weight), consolidation detection, and breakout ' +
    'confirmation for 50-200%+ moves.',
  keywords: [
    'penny stocks',
    'stock scanner',
    'breakout scanner',
    'volume analysis',
    'consolidation patterns',
    'explosion setups',
    'low-priced stocks',
    'day trading',
    'swing trading',
    'stock screening',
  ],
  openGraph: {
    title: 'Professional Penny Stock Scanner',
    description:
      'Find penny stocks before they explode. Volume-driven ' +
      'analysis, consolidation detection, and breakout confirmation.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Professional Penny Stock Scanner',
    description:
      'Find penny stocks before they explode. Volume-driven ' +
      'analysis and pattern detection.',
  },
};

export default function PennyStockScannerLayout({
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
          {
            name: 'Penny Stock Scanner',
            url: 'https://conorq.com/penny-stock-scanner',
          },
        ]}
      />
      {children}
    </>
  );
}
