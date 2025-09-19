/**
 * Structured Data Schema for Volatility Squeeze Scanner
 * Provides rich snippets and better search engine understanding
 */

export function VolatilityScannerSchema() {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Volatility Squeeze Scanner",
    "description": "Advanced volatility squeeze scanner identifying stocks with compressed price movement before explosive breakouts. Professional trading tool with real-time signals, technical analysis, and 1.2-3.3% historical accuracy.",
    "url": "https://conorq.com/volatility-squeeze-scanner",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "creator": {
      "@type": "Person",
      "name": "Conor Quinlan",
      "url": "https://conorq.com"
    },
    "publisher": {
      "@type": "Person",
      "name": "Conor Quinlan",
      "url": "https://conorq.com"
    },
    "featureList": [
      "Real-time volatility squeeze detection",
      "Technical analysis with Bollinger Bands and Keltner Channels",
      "Professional trading signals",
      "Risk management calculations",
      "Market trend analysis",
      "Stock screening and filtering",
      "Historical performance tracking",
      "Professional-grade accuracy (1.2-3.3% returns)"
    ],
    "screenshot": "https://conorq.com/volatility-squeeze-scanner/opengraph-image.png",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "1",
      "bestRating": "5",
      "worstRating": "1"
    },
    "softwareVersion": "1.0",
    "datePublished": "2024-01-15",
    "dateModified": new Date().toISOString().split('T')[0],
    "keywords": [
      "volatility squeeze",
      "stock scanner",
      "trading tools",
      "technical analysis",
      "market analysis",
      "bollinger bands",
      "keltner channels",
      "breakout stocks",
      "day trading",
      "swing trading"
    ],
    "mainEntity": {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is a volatility squeeze?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "A volatility squeeze occurs when Bollinger Bands contract inside Keltner Channels, indicating extremely low price movement that often precedes explosive breakouts in either direction."
          }
        },
        {
          "@type": "Question", 
          "name": "How accurate is the volatility squeeze strategy?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Historical backtesting shows the volatility squeeze strategy delivers 1.2-3.3% returns with high accuracy, particularly effective in low-volatility market conditions."
          }
        },
        {
          "@type": "Question",
          "name": "Is the volatility squeeze scanner free to use?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes, the volatility squeeze scanner is completely free to use. Sign in to access advanced features and detailed technical analysis."
          }
        }
      ]
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schemaData),
      }}
    />
  );
}

/**
 * Financial Service Schema for the Scanner
 */
export function FinancialServiceSchema() {
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "Professional Stock Market Analysis Service",
    "description": "Advanced stock market analysis tools including volatility squeeze scanning, technical indicators, and professional trading signals.",
    "url": "https://conorq.com/volatility-squeeze-scanner",
    "provider": {
      "@type": "Person",
      "name": "Conor Quinlan",
      "url": "https://conorq.com"
    },
    "serviceType": "Stock Market Analysis",
    "areaServed": "Worldwide",
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Trading Tools",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "name": "Volatility Squeeze Scanner",
            "description": "Real-time volatility squeeze detection and analysis"
          },
          "price": "0",
          "priceCurrency": "USD"
        }
      ]
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schemaData),
      }}
    />
  );
}
