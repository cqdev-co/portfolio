"""Signal Q&A Engine - Answer questions about unusual options signals."""

from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
import re
from loguru import logger

from ..models.signal import EnrichedSignal
from ..models.analysis import TechnicalIndicators
from ..models.strategy import StrategyComparison, RecommendationTier, StrategyRecommendation


@dataclass
class QAResponse:
    """Response to a user question about signals."""
    question: str
    answer: str
    relevant_signals: List[Tuple[StrategyComparison, EnrichedSignal, TechnicalIndicators]]
    confidence: float  # 0-1, how confident we are in the answer


class SignalQAEngine:
    """
    Answer questions about unusual options signals.
    
    Uses pattern matching and templates for common questions,
    with optional OpenAI integration for complex queries.
    """
    
    def __init__(self, use_ai: bool = False, openai_api_key: Optional[str] = None):
        """
        Initialize the Q&A engine.
        
        Args:
            use_ai: Whether to use AI (OpenAI) for complex questions
            openai_api_key: OpenAI API key (required if use_ai=True)
        """
        self.use_ai = use_ai
        self.openai_api_key = openai_api_key
        
        # Question patterns
        self.patterns = {
            'why_trade': r'why (should i )?(trade|buy|consider) (\w+)',
            'risks': r'(what are |what\'s )?(the )?risk(s)? (for|of) (\w+)',
            'compare': r'compare (\w+) (and|vs|versus) (\w+)',
            'best': r'(what\'s |what is )?(the )?best (signal|trade|opportunity)',
            'strategy': r'(what )?(strategy|approach) (for|should i use for) (\w+)',
        }
    
    def ask(
        self,
        question: str,
        signals_data: List[Tuple[StrategyComparison, EnrichedSignal, TechnicalIndicators]]
    ) -> QAResponse:
        """
        Answer a question about signals.
        
        Args:
            question: User's question
            signals_data: All available signal data
            
        Returns:
            QAResponse with answer and relevant signals
        """
        question_lower = question.lower().strip()
        
        # Try pattern matching first
        for pattern_name, pattern in self.patterns.items():
            match = re.search(pattern, question_lower)
            if match:
                handler_name = f'_handle_{pattern_name}'
                if hasattr(self, handler_name):
                    handler = getattr(self, handler_name)
                    return handler(match, signals_data)
        
        # Fallback: General summary
        return self._handle_general_question(question, signals_data)
    
    def _handle_why_trade(
        self, 
        match: re.Match, 
        signals_data: List[Tuple[StrategyComparison, EnrichedSignal, TechnicalIndicators]]
    ) -> QAResponse:
        """Handle 'Why should I trade X?' questions."""
        ticker = match.group(3).upper()
        
        # Find the signal for this ticker
        relevant = [
            (comp, sig, tech) for comp, sig, tech in signals_data
            if sig.ticker.upper() == ticker
        ]
        
        if not relevant:
            return QAResponse(
                question=match.group(0),
                answer=f"No signals found for {ticker} in the current analysis.",
                relevant_signals=[],
                confidence=1.0
            )
        
        # Get the best (highest scoring) signal for this ticker
        relevant.sort(key=lambda x: x[0].composite_score, reverse=True)
        comp, sig, tech = relevant[0]
        
        # Build answer based on recommendation
        if comp.recommendation_tier in [RecommendationTier.STRONG_BUY, RecommendationTier.BUY]:
            answer_parts = [
                f"✅ {ticker} is worth considering! Here's why:",
                f"",
                f"📊 Signal Quality:",
                f"  • Grade: {sig.grade}",
                f"  • Score: {comp.composite_score:.0f}/100 ({comp.recommendation_tier.value})",
                f"  • Premium Flow: ${sig.premium_flow:,.0f}",
                f"",
                f"🎯 Strategy: {comp.recommended_strategy.value}",
            ]
            
            if comp.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD and comp.spread:
                answer_parts.extend([
                    f"  • Cost: ${comp.spread.cost_per_contract:.0f}/contract",
                    f"  • Max Profit: ${comp.spread.profit_per_contract:.0f}/contract",
                    f"  • Risk/Reward: 1:{comp.spread.risk_reward_ratio:.1f}",
                    f"  • Probability: {comp.spread.probability_profit:.0f}%",
                ])
            elif comp.recommended_strategy == StrategyRecommendation.NAKED_OPTION and comp.naked:
                answer_parts.extend([
                    f"  • Cost: ${comp.naked.cost_per_contract:.0f}/contract",
                    f"  • Potential: Unlimited upside",
                    f"  • Risk/Reward: 1:{comp.naked.risk_reward_ratio:.1f}",
                    f"  • Probability: {comp.naked.probability_profit:.0f}%",
                ])
            
            answer_parts.extend([
                f"",
                f"💡 Why it's good: {comp.recommendation_reason}",
            ])
            
            if sig.days_to_earnings:
                answer_parts.append(f"⏰ Catalyst: Earnings in {sig.days_to_earnings} days")
            
            confidence = 0.9 if comp.composite_score >= 85 else 0.75
        
        elif comp.recommendation_tier == RecommendationTier.CONSIDER:
            answer_parts = [
                f"⚠️  {ticker} is marginal - proceed with caution.",
                f"",
                f"📊 Signal Quality:",
                f"  • Grade: {sig.grade}",
                f"  • Score: {comp.composite_score:.0f}/100 ({comp.recommendation_tier.value})",
                f"",
                f"⚠️  Why it's risky: {comp.recommendation_reason}",
                f"",
                f"💡 Recommendation: Only trade if you have strong conviction from other research.",
            ]
            confidence = 0.6
        
        else:  # SKIP
            answer_parts = [
                f"❌ {ticker} should be SKIPPED.",
                f"",
                f"📊 Signal Quality:",
                f"  • Grade: {sig.grade}",
                f"  • Score: {comp.composite_score:.0f}/100 ({comp.recommendation_tier.value})",
                f"",
                f"🚫 Why to skip: {comp.recommendation_reason}",
            ]
            
            if comp.skip_reasons:
                answer_parts.append(f"")
                answer_parts.append(f"Specific issues:")
                for reason in comp.skip_reasons[:3]:  # Show top 3 reasons
                    answer_parts.append(f"  • {reason}")
            
            answer_parts.extend([
                f"",
                f"💡 Better to wait for higher-quality setups.",
            ])
            confidence = 0.95
        
        return QAResponse(
            question=match.group(0),
            answer="\n".join(answer_parts),
            relevant_signals=relevant,
            confidence=confidence
        )
    
    def _handle_risks(
        self,
        match: re.Match,
        signals_data: List[Tuple[StrategyComparison, EnrichedSignal, TechnicalIndicators]]
    ) -> QAResponse:
        """Handle 'What are the risks for X?' questions."""
        ticker = match.group(5).upper()
        
        # Find the signal for this ticker
        relevant = [
            (comp, sig, tech) for comp, sig, tech in signals_data
            if sig.ticker.upper() == ticker
        ]
        
        if not relevant:
            return QAResponse(
                question=match.group(0),
                answer=f"No signals found for {ticker}.",
                relevant_signals=[],
                confidence=1.0
            )
        
        relevant.sort(key=lambda x: x[0].composite_score, reverse=True)
        comp, sig, tech = relevant[0]
        
        # Build risk analysis
        answer_parts = [
            f"⚠️  Risk Analysis for {ticker}:",
            f"",
        ]
        
        # General risks
        if comp.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD and comp.spread:
            answer_parts.extend([
                f"📉 Maximum Loss: ${comp.spread.max_loss * 100:.0f}/contract (Defined)",
                f"💰 Capital at Risk: ${comp.suggested_capital:.0f} ({comp.suggested_contracts} contracts)",
                f"📊 Probability of Loss: {100 - comp.spread.probability_profit:.0f}%",
                f"⏱  Theta Decay: Moderate (spread mitigates)",
                f"",
                f"⚠️  Key Risks:",
                f"  • Stock must move {abs(comp.spread.breakeven_pct):.1f}% to break even",
                f"  • Profit capped at ${comp.spread.profit_per_contract:.0f}/contract",
                f"  • {sig.days_to_expiry} days until expiration",
            ])
        elif comp.recommended_strategy == StrategyRecommendation.NAKED_OPTION and comp.naked:
            answer_parts.extend([
                f"📉 Maximum Loss: ${comp.naked.max_loss * 100:.0f}/contract (100% of premium)",
                f"💰 Capital at Risk: ${comp.suggested_capital:.0f} ({comp.suggested_contracts} contracts)",
                f"📊 Probability of Loss: {100 - comp.naked.probability_profit:.0f}%",
                f"⏱  Theta Decay: High (${comp.naked.theta:.2f}/day)" if comp.naked.theta else "⏱  Theta Decay: High",
                f"",
                f"⚠️  Key Risks:",
                f"  • Can lose 100% of premium if wrong",
                f"  • Theta decay accelerates near expiration",
                f"  • Need {abs(comp.naked.breakeven_pct):.1f}% move to break even",
                f"  • {sig.days_to_expiry} days until expiration",
            ])
        
        # Add signal-specific warnings
        if comp.skip_reasons:
            answer_parts.append(f"")
            answer_parts.append(f"⚠️  Additional Concerns:")
            for reason in comp.skip_reasons:
                answer_parts.append(f"  • {reason}")
        
        # Technical risks
        answer_parts.extend([
            f"",
            f"📊 Technical Context:",
            f"  • Current Price: ${tech.price:.2f}",
            f"  • RSI: {tech.rsi:.0f} ({'Overbought' if tech.rsi > 70 else 'Oversold' if tech.rsi < 30 else 'Neutral'})",
            f"  • Trend: {'Uptrend' if tech.price > tech.ma_50 else 'Downtrend'}",
        ])
        
        if sig.days_to_earnings and sig.days_to_earnings < 14:
            answer_parts.extend([
                f"",
                f"🚨 EARNINGS RISK: Earnings in {sig.days_to_earnings} days",
                f"  • IV crush after earnings can wipe out value",
                f"  • Consider exiting before earnings if playing short-term",
            ])
        
        return QAResponse(
            question=match.group(0),
            answer="\n".join(answer_parts),
            relevant_signals=relevant,
            confidence=0.9
        )
    
    def _handle_compare(
        self,
        match: re.Match,
        signals_data: List[Tuple[StrategyComparison, EnrichedSignal, TechnicalIndicators]]
    ) -> QAResponse:
        """Handle 'Compare X vs Y' questions."""
        ticker1 = match.group(1).upper()
        ticker2 = match.group(3).upper()
        
        # Find both signals
        signals1 = [
            (comp, sig, tech) for comp, sig, tech in signals_data
            if sig.ticker.upper() == ticker1
        ]
        signals2 = [
            (comp, sig, tech) for comp, sig, tech in signals_data
            if sig.ticker.upper() == ticker2
        ]
        
        if not signals1 or not signals2:
            missing = []
            if not signals1:
                missing.append(ticker1)
            if not signals2:
                missing.append(ticker2)
            return QAResponse(
                question=match.group(0),
                answer=f"No signals found for: {', '.join(missing)}",
                relevant_signals=[],
                confidence=1.0
            )
        
        # Get best signal for each
        signals1.sort(key=lambda x: x[0].composite_score, reverse=True)
        signals2.sort(key=lambda x: x[0].composite_score, reverse=True)
        
        comp1, sig1, tech1 = signals1[0]
        comp2, sig2, tech2 = signals2[0]
        
        # Compare
        answer_parts = [
            f"📊 Comparison: {ticker1} vs {ticker2}",
            f"",
            f"{'='*50}",
            f"{ticker1:^25} | {ticker2:^25}",
            f"{'='*50}",
            f"",
            f"🏆 Overall:",
            f"  Score: {comp1.composite_score:^16.0f} | {comp2.composite_score:^16.0f}",
            f"  Tier:  {comp1.recommendation_tier.value:^16} | {comp2.recommendation_tier.value:^16}",
            f"  Grade: {sig1.grade:^16} | {sig2.grade:^16}",
            f"",
            f"💰 Cost:",
        ]
        
        cost1 = comp1.spread.cost_per_contract if comp1.spread else comp1.naked.cost_per_contract if comp1.naked else 0
        cost2 = comp2.spread.cost_per_contract if comp2.spread else comp2.naked.cost_per_contract if comp2.naked else 0
        
        answer_parts.extend([
            f"  {f'${cost1:.0f}':^16} | {f'${cost2:.0f}':^16}",
            f"",
            f"📈 Probability of Profit:",
        ])
        
        prob1 = comp1.spread.probability_profit if comp1.spread else comp1.naked.probability_profit if comp1.naked else 0
        prob2 = comp2.spread.probability_profit if comp2.spread else comp2.naked.probability_profit if comp2.naked else 0
        
        answer_parts.extend([
            f"  {f'{prob1:.0f}%':^16} | {f'{prob2:.0f}%':^16}",
            f"",
            f"⚖️  Risk/Reward:",
        ])
        
        rr1 = comp1.spread.risk_reward_ratio if comp1.spread else comp1.naked.risk_reward_ratio if comp1.naked else 0
        rr2 = comp2.spread.risk_reward_ratio if comp2.spread else comp2.naked.risk_reward_ratio if comp2.naked else 0
        
        answer_parts.extend([
            f"  {f'1:{rr1:.1f}':^16} | {f'1:{rr2:.1f}':^16}",
            f"",
            f"{'='*50}",
            f"",
        ])
        
        # Determine winner
        if comp1.composite_score > comp2.composite_score:
            winner = ticker1
            answer_parts.append(f"🏆 Winner: {winner}")
            answer_parts.append(f"  {ticker1} has a higher overall score ({comp1.composite_score:.0f} vs {comp2.composite_score:.0f})")
            if comp1.recommendation_tier in [RecommendationTier.STRONG_BUY, RecommendationTier.BUY]:
                answer_parts.append(f"  ✅ {ticker1} is worth trading")
            confidence = 0.85
        elif comp2.composite_score > comp1.composite_score:
            winner = ticker2
            answer_parts.append(f"🏆 Winner: {winner}")
            answer_parts.append(f"  {ticker2} has a higher overall score ({comp2.composite_score:.0f} vs {comp1.composite_score:.0f})")
            if comp2.recommendation_tier in [RecommendationTier.STRONG_BUY, RecommendationTier.BUY]:
                answer_parts.append(f"  ✅ {ticker2} is worth trading")
            confidence = 0.85
        else:
            answer_parts.append(f"🤝 Tie: Both signals are equally strong")
            answer_parts.append(f"  Consider diversifying with both if capital allows")
            confidence = 0.7
        
        return QAResponse(
            question=match.group(0),
            answer="\n".join(answer_parts),
            relevant_signals=signals1 + signals2,
            confidence=confidence
        )
    
    def _handle_best(
        self,
        match: re.Match,
        signals_data: List[Tuple[StrategyComparison, EnrichedSignal, TechnicalIndicators]]
    ) -> QAResponse:
        """Handle 'What's the best signal?' questions."""
        # Filter to only tradeable signals
        tradeable = [
            (comp, sig, tech) for comp, sig, tech in signals_data
            if comp.recommendation_tier in [RecommendationTier.STRONG_BUY, RecommendationTier.BUY]
        ]
        
        if not tradeable:
            return QAResponse(
                question=match.group(0),
                answer="No high-quality trade signals found in the current analysis. All signals are either marginal or should be skipped.",
                relevant_signals=[],
                confidence=1.0
            )
        
        # Sort by score
        tradeable.sort(key=lambda x: x[0].composite_score, reverse=True)
        
        # Get top 3
        top3 = tradeable[:min(3, len(tradeable))]
        
        answer_parts = [
            f"🏆 Best Trading Opportunities:",
            f"",
        ]
        
        for i, (comp, sig, tech) in enumerate(top3, 1):
            emoji = "🥇" if i == 1 else "🥈" if i == 2 else "🥉"
            answer_parts.extend([
                f"{emoji} #{i}: {sig.ticker} (Score: {comp.composite_score:.0f}/100)",
                f"  • Grade: {sig.grade} | {comp.recommendation_tier.value}",
                f"  • Strategy: {comp.recommended_strategy.value}",
            ])
            
            if comp.recommended_strategy == StrategyRecommendation.VERTICAL_SPREAD and comp.spread:
                answer_parts.append(f"  • Cost: ${comp.spread.cost_per_contract:.0f} | R:R 1:{comp.spread.risk_reward_ratio:.1f} | P(Win): {comp.spread.probability_profit:.0f}%")
            elif comp.recommended_strategy == StrategyRecommendation.NAKED_OPTION and comp.naked:
                answer_parts.append(f"  • Cost: ${comp.naked.cost_per_contract:.0f} | R:R 1:{comp.naked.risk_reward_ratio:.1f} | P(Win): {comp.naked.probability_profit:.0f}%")
            
            answer_parts.append(f"  • Why: {comp.recommendation_reason}")
            answer_parts.append(f"")
        
        answer_parts.extend([
            f"💡 Recommendation: Focus on the top 1-2 signals to avoid overexposure.",
            f"   Total tradeable signals: {len(tradeable)}",
        ])
        
        return QAResponse(
            question=match.group(0),
            answer="\n".join(answer_parts),
            relevant_signals=top3,
            confidence=0.9
        )
    
    def _handle_general_question(
        self,
        question: str,
        signals_data: List[Tuple[StrategyComparison, EnrichedSignal, TechnicalIndicators]]
    ) -> QAResponse:
        """Handle general questions with summary info."""
        # Categorize signals
        by_tier = {
            RecommendationTier.STRONG_BUY: [],
            RecommendationTier.BUY: [],
            RecommendationTier.CONSIDER: [],
            RecommendationTier.SKIP: []
        }
        
        for comp, sig, tech in signals_data:
            tier = comp.recommendation_tier or RecommendationTier.SKIP
            by_tier[tier].append((comp, sig, tech))
        
        answer_parts = [
            f"📊 Signal Overview:",
            f"",
            f"  • Total Signals: {len(signals_data)}",
            f"  • 🚀 STRONG BUY: {len(by_tier[RecommendationTier.STRONG_BUY])}",
            f"  • ✅ BUY: {len(by_tier[RecommendationTier.BUY])}",
            f"  • ⚠️  CONSIDER: {len(by_tier[RecommendationTier.CONSIDER])}",
            f"  • ❌ SKIP: {len(by_tier[RecommendationTier.SKIP])}",
            f"",
            f"💡 Try asking:",
            f"  • 'Why should I trade [TICKER]?'",
            f"  • 'What are the risks for [TICKER]?'",
            f"  • 'Compare [TICKER1] vs [TICKER2]'",
            f"  • 'What's the best signal?'",
        ]
        
        return QAResponse(
            question=question,
            answer="\n".join(answer_parts),
            relevant_signals=[],
            confidence=0.5
        )

