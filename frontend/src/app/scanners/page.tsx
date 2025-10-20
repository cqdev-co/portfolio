"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
  Activity, 
  TrendingUp, 
  ArrowRight, 
  Zap, 
  Shield, 
  Target,
  DollarSign,
  AlertCircle
} from "lucide-react";

interface Scanner {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  status: 'active' | 'coming-soon';
  tags: string[];
  color: string;
  stats?: {
    label: string;
    value: string;
  }[];
}

const scanners: Scanner[] = [
  {
    id: 'volatility-squeeze',
    name: 'Volatility Squeeze Scanner',
    description: 'Identify stocks with compressed price movement before explosive breakouts using Bollinger Bands and Keltner Channels.',
    icon: <Activity className="h-8 w-8" />,
    path: '/volatility-squeeze-scanner',
    status: 'active',
    tags: ['Technical Analysis', 'Breakouts', 'Momentum'],
    color: 'from-blue-500 to-cyan-500',
    stats: [
      { label: 'Win Rate', value: '68%' },
      { label: 'Avg Return', value: '2.1%' },
      { label: 'Signals', value: 'Daily' }
    ]
  },
  {
    id: 'unusual-options',
    name: 'Unusual Options Scanner',
    description: 'Detect suspicious options activity that might indicate insider information. Find large, concentrated bets before major moves.',
    icon: <Target className="h-8 w-8" />,
    path: '/unusual-options-scanner',
    status: 'active',
    tags: ['Options Flow', 'Insider Detection', 'Smart Money'],
    color: 'from-purple-500 to-pink-500',
    stats: [
      { label: 'Focus', value: 'Insider Plays' },
      { label: 'Data', value: 'Real-time' },
      { label: 'Filters', value: '0DTE Excluded' }
    ]
  },
];

export default function ScannersPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-12 text-center">
        <Badge variant="outline" className="mb-4">
          <Zap className="h-3 w-3 mr-1" />
          Professional Trading Tools
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          Market Scanners
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Advanced algorithmic scanners to identify high-probability trading opportunities across multiple strategies.
        </p>
      </div>

      {/* Scanners Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-12">
        {scanners.map((scanner) => (
          <Card 
            key={scanner.id} 
            className="group relative overflow-hidden hover:shadow-lg transition-all duration-300"
          >
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${scanner.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            
            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${scanner.color} text-white`}>
                  {scanner.icon}
                </div>
                <Badge 
                  variant={scanner.status === 'active' ? 'default' : 'secondary'}
                  className={scanner.status === 'active' ? 'bg-green-500/10 text-green-500 border-green-500/20' : ''}
                >
                  {scanner.status === 'active' ? 'Active' : 'Coming Soon'}
                </Badge>
              </div>

              {/* Content */}
              <h2 className="text-2xl font-bold mb-2">{scanner.name}</h2>
              <p className="text-muted-foreground mb-4 min-h-[3rem]">
                {scanner.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {scanner.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Stats */}
              {scanner.stats && (
                <div className="grid grid-cols-3 gap-4 mb-4 pt-4 border-t">
                  {scanner.stats.map((stat, idx) => (
                    <div key={idx} className="text-center">
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                      <div className="text-lg font-semibold">{stat.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Button */}
              {scanner.status === 'active' ? (
                <Link href={scanner.path}>
                  <Button className="w-full group/btn">
                    Launch Scanner
                    <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              ) : (
                <Button disabled className="w-full">
                  Coming Soon
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Info Section */}
      <Card className="p-6 bg-muted/30">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-2">About These Scanners</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Each scanner uses proprietary algorithms to analyze market data and identify high-conviction trading signals. 
              All scanners feature real-time data, advanced filtering, and actionable recommendations.
            </p>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Risk-Managed Signals</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span>Backtested Strategies</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-500" />
                <span>Free to Use</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

