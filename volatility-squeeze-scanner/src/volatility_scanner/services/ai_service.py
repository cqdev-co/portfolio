"""AI service for LLM-powered market analysis."""

import json
from datetime import datetime
from typing import Optional, Dict, Any
from loguru import logger

try:
    import openai
except ImportError:
    openai = None

try:
    import anthropic
except ImportError:
    anthropic = None

from volatility_scanner.models.analysis import (
    AnalysisResult,
    AIAnalysis,
    SignalType,
    SqueezeSignal,
)
from volatility_scanner.core.exceptions import ExternalServiceError
from volatility_scanner.config.settings import Settings


class AIService:
    """Service for AI-powered market analysis using LLMs."""
    
    def __init__(self, settings: Settings) -> None:
        """Initialize the AI service."""
        self.settings = settings
        self.openai_client = None
        self.anthropic_client = None
        
        # Initialize clients if API keys are available
        if settings.openai_api_key and openai:
            self.openai_client = openai.OpenAI(
                api_key=settings.openai_api_key
            )
        
        if settings.anthropic_api_key and anthropic:
            self.anthropic_client = anthropic.Anthropic(
                api_key=settings.anthropic_api_key
            )
    
    async def analyze_signal(
        self,
        analysis_result: AnalysisResult
    ) -> AnalysisResult:
        """
        Enhance analysis result with AI-powered insights.
        
        Args:
            analysis_result: Technical analysis result to enhance
            
        Returns:
            Enhanced analysis result with AI analysis
            
        Raises:
            ExternalServiceError: If AI analysis fails
        """
        try:
            # Generate AI analysis
            ai_analysis = await self._generate_ai_analysis(
                analysis_result.squeeze_signal,
                analysis_result.market_conditions
            )
            
            if ai_analysis:
                # Update analysis result
                analysis_result.ai_analysis = ai_analysis
                
                # Recalculate overall score incorporating AI confidence
                technical_score = analysis_result.overall_score
                ai_confidence = ai_analysis.confidence
                
                # Weighted combination: 70% technical, 30% AI
                combined_score = (technical_score * 0.7) + (ai_confidence * 0.3)
                analysis_result.overall_score = combined_score
                
                # Update recommendation if AI provides strong signal
                if ai_confidence >= 0.8:
                    analysis_result.recommendation = self._ai_to_recommendation(
                        ai_analysis.signal_type,
                        ai_confidence
                    )
                
                logger.info(
                    f"AI analysis completed for {analysis_result.symbol}: "
                    f"Type={ai_analysis.signal_type.value}, "
                    f"Confidence={ai_confidence:.2f}"
                )
            
            return analysis_result
            
        except Exception as e:
            error_msg = f"AI analysis failed for {analysis_result.symbol}: {str(e)}"
            logger.error(error_msg)
            # Don't raise exception - return original result without AI analysis
            return analysis_result
    
    async def _generate_ai_analysis(
        self,
        squeeze_signal: SqueezeSignal,
        market_conditions: Dict[str, Any]
    ) -> Optional[AIAnalysis]:
        """Generate AI analysis using the configured LLM provider."""
        
        # Prepare context for AI analysis
        context = self._prepare_analysis_context(squeeze_signal, market_conditions)
        
        # Choose provider
        if self.settings.default_llm_provider == "anthropic" and self.anthropic_client:
            return await self._analyze_with_anthropic(context)
        elif self.settings.default_llm_provider == "openai" and self.openai_client:
            return await self._analyze_with_openai(context)
        else:
            logger.warning("No AI provider available or configured")
            return None
    
    def _prepare_analysis_context(
        self,
        squeeze_signal: SqueezeSignal,
        market_conditions: Dict[str, Any]
    ) -> str:
        """Prepare context string for AI analysis."""
        
        context = f"""
Market Analysis Context for {squeeze_signal.symbol}:

PRICE ACTION:
- Current Price: ${squeeze_signal.close_price:.2f}
- Position vs 20-day High: {squeeze_signal.price_vs_20d_high:.1f}%
- Position vs 20-day Low: {squeeze_signal.price_vs_20d_low:.1f}%

VOLATILITY SQUEEZE METRICS:
- Bollinger Bands Width: {squeeze_signal.bb_width:.4f}
- BB Width Percentile (180-day): {squeeze_signal.bb_width_percentile:.1f}%
- Is Squeeze Active: {squeeze_signal.is_squeeze}
- BB Width Change: {squeeze_signal.bb_width_change:.1f}%
- Is Expansion: {squeeze_signal.is_expansion}

RANGE & VOLATILITY:
- True Range: ${squeeze_signal.true_range:.2f}
- 20-day ATR: ${squeeze_signal.atr_20:.2f}
- Range vs ATR Ratio: {squeeze_signal.range_vs_atr:.2f}x

TREND CONTEXT:
- Trend Direction: {squeeze_signal.trend_direction.value}
- 20-day EMA: ${squeeze_signal.ema_short:.2f}
- 50-day EMA: ${squeeze_signal.ema_long:.2f}

VOLUME:
- Current Volume: {squeeze_signal.volume:,}
- Volume vs Average: {squeeze_signal.volume_ratio:.2f}x

TECHNICAL SIGNAL STRENGTH: {squeeze_signal.signal_strength:.2f}/1.0
"""
        
        # Add market context if available
        if market_conditions.get('symbol_info'):
            info = market_conditions['symbol_info']
            context += f"\nCOMPANY INFO:\n"
            if info.get('name'):
                context += f"- Name: {info['name']}\n"
            if info.get('sector'):
                context += f"- Sector: {info['sector']}\n"
        
        return context.strip()
    
    async def _analyze_with_openai(self, context: str) -> Optional[AIAnalysis]:
        """Analyze using OpenAI GPT."""
        
        try:
            prompt = self._build_analysis_prompt(context)
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert quantitative analyst specializing in volatility squeeze patterns and technical analysis."
                    },
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.3,
                max_tokens=500
            )
            
            return self._parse_ai_response(
                response.choices[0].message.content,
                "gpt-4-turbo-preview"
            )
            
        except Exception as e:
            logger.error(f"OpenAI analysis failed: {e}")
            return None
    
    async def _analyze_with_anthropic(self, context: str) -> Optional[AIAnalysis]:
        """Analyze using Anthropic Claude."""
        
        try:
            prompt = self._build_analysis_prompt(context)
            
            response = self.anthropic_client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=500,
                temperature=0.3,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            return self._parse_ai_response(
                response.content[0].text,
                "claude-3-sonnet"
            )
            
        except Exception as e:
            logger.error(f"Anthropic analysis failed: {e}")
            return None
    
    def _build_analysis_prompt(self, context: str) -> str:
        """Build the analysis prompt for the LLM."""
        
        return f"""
Based on the following volatility squeeze analysis, provide your assessment:

{context}

Please analyze this data and respond with a JSON object containing:

1. "signal_type": One of "continuation", "reversal", or "chop"
2. "confidence": A number between 0.0 and 1.0 representing your confidence
3. "rationale": A 2-sentence explanation of your reasoning
4. "invalidation_level": A price level that would invalidate this signal (optional)
5. "target_level": A potential target price level (optional)
6. "risk_reward_ratio": Estimated risk/reward ratio (optional)

Consider these factors in your analysis:
- Volatility squeeze depth and duration
- Expansion characteristics and volume confirmation
- Trend context and momentum
- Price position within recent range
- Market structure and sector context

Respond only with valid JSON format.
"""
    
    def _parse_ai_response(
        self,
        response_text: str,
        model_name: str
    ) -> Optional[AIAnalysis]:
        """Parse AI response into AIAnalysis object."""
        
        try:
            # Extract JSON from response
            response_text = response_text.strip()
            
            # Handle potential markdown code blocks
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            response_text = response_text.strip()
            
            # Parse JSON
            data = json.loads(response_text)
            
            # Validate required fields
            required_fields = ["signal_type", "confidence", "rationale"]
            for field in required_fields:
                if field not in data:
                    logger.error(f"Missing required field in AI response: {field}")
                    return None
            
            # Validate signal type
            try:
                signal_type = SignalType(data["signal_type"].lower())
            except ValueError:
                logger.error(f"Invalid signal type: {data['signal_type']}")
                return None
            
            # Validate confidence
            confidence = float(data["confidence"])
            if not 0.0 <= confidence <= 1.0:
                logger.error(f"Invalid confidence value: {confidence}")
                return None
            
            # Create AIAnalysis object
            return AIAnalysis(
                signal_type=signal_type,
                confidence=confidence,
                rationale=str(data["rationale"])[:500],  # Truncate if too long
                invalidation_level=data.get("invalidation_level"),
                target_level=data.get("target_level"),
                risk_reward_ratio=data.get("risk_reward_ratio"),
                model_used=model_name,
                analysis_timestamp=datetime.now(),
                prompt_version="v1.0"
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            logger.debug(f"Response text: {response_text}")
            return None
        except Exception as e:
            logger.error(f"Error parsing AI response: {e}")
            return None
    
    def _ai_to_recommendation(
        self,
        signal_type: SignalType,
        confidence: float
    ) -> str:
        """Convert AI signal type to trading recommendation."""
        
        if confidence < 0.6:
            return "HOLD"
        
        if signal_type == SignalType.CONTINUATION:
            return "BUY" if confidence >= 0.8 else "WATCH"
        elif signal_type == SignalType.REVERSAL:
            return "SELL" if confidence >= 0.8 else "WATCH"
        else:  # CHOP
            return "HOLD"
    
    def is_available(self) -> bool:
        """Check if AI service is available."""
        return (
            (self.openai_client is not None) or 
            (self.anthropic_client is not None)
        )
    
    def get_available_providers(self) -> list[str]:
        """Get list of available AI providers."""
        providers = []
        if self.openai_client:
            providers.append("openai")
        if self.anthropic_client:
            providers.append("anthropic")
        return providers
