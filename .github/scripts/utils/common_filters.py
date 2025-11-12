#!/usr/bin/env python3
"""
Common Ticker Filtering Utilities

Shared filtering functions used across multiple ticker fetching scripts.
"""


def is_cfd_ticker(symbol: str, name: str, exchange: str = '') -> bool:
    """
    Detect if a ticker is a CFD (Contract for Difference).
    
    This function consolidates CFD detection logic used across multiple
    scripts to ensure consistency and reduce code duplication.
    
    Args:
        symbol: Ticker symbol
        name: Company/instrument name
        exchange: Exchange name
        
    Returns:
        True if the ticker appears to be a CFD, False otherwise
    """
    symbol_lower = symbol.lower()
    name_lower = name.lower() if name else ''
    exchange_lower = exchange.lower() if exchange else ''
    
    # CFD symbol patterns
    cfd_symbol_patterns = [
        '.cfd', '_cfd', 'cfd', '.c', '_c',  # Direct CFD indicators
        '.d', '_d',  # Derivative indicators
        '.x', '_x',  # Some brokers use X suffix for CFDs
    ]
    
    # CFD name patterns - comprehensive list
    cfd_name_patterns = [
        'cfd', 'contract for difference', 'derivative',
        'synthetic', 'swap', 'future', 'forward',
        'etf cfd', 'index cfd', 'commodity cfd',
        'fx cfd', 'crypto cfd', 'currency cfd',
        'spread bet', 'spread betting', 'margin trade',
        'leveraged product', 'structured product',
        'binary option', 'digital option', 'barrier option'
    ]
    
    # CFD exchange patterns (some brokers have dedicated CFD exchanges)
    cfd_exchange_patterns = [
        'cfd', 'derivative', 'synthetic', 'swap'
    ]
    
    # Check symbol patterns
    for pattern in cfd_symbol_patterns:
        if pattern in symbol_lower:
            return True
    
    # Check name patterns
    for pattern in cfd_name_patterns:
        if pattern in name_lower:
            return True
    
    # Check exchange patterns
    for pattern in cfd_exchange_patterns:
        if pattern in exchange_lower:
            return True
    
    # Additional heuristics for CFDs
    # Many CFDs have numeric suffixes or special characters
    if symbol_lower.endswith(('.1', '.2', '.3', '.4', '.5')):
        return True
    
    # Some CFDs have very specific naming patterns
    if any(indicator in name_lower for indicator in [
        'mini', 'micro', 'leveraged', 'inverse',
        '2x', '3x', 'bull', 'bear', 'short',
        'ultra', 'pro', 'daily', 'turbo', 'knock-out'
    ]):
        # These could be leveraged ETFs or CFDs, need more context
        if any(cfd_indicator in name_lower for cfd_indicator in [
            'cfd', 'contract', 'derivative', 'synthetic', 'spread', 'margin'
        ]):
            return True
    
    # Additional CFD patterns based on common broker naming
    if any(pattern in symbol_lower for pattern in [
        'cfd', 'der', 'syn', 'lev', 'spr'
    ]):
        return True
    
    return False
