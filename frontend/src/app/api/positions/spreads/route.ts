import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  CreateSpreadRequest,
  Spread,
  SpreadType,
} from '@/../../../lib/types/positions';

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabaseClient(authHeader?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const options = authHeader
    ? { global: { headers: { Authorization: authHeader } } }
    : {};

  return createClient(supabaseUrl, supabaseKey, options);
}

// ============================================================================
// Spread Leg Generation
// ============================================================================

interface SpreadLeg {
  option_type: 'call' | 'put';
  strike_price: number;
  quantity: number; // Positive = long, Negative = short
  leg_label: string;
}

/**
 * Generate legs for a vertical spread based on spread type
 */
function generateSpreadLegs(
  spreadType: SpreadType,
  lowerStrike: number,
  upperStrike: number,
  quantity: number
): SpreadLeg[] {
  switch (spreadType) {
    case 'call_debit_spread':
      // Buy lower call, sell higher call
      return [
        {
          option_type: 'call',
          strike_price: lowerStrike,
          quantity: quantity,
          leg_label: 'long_call',
        },
        {
          option_type: 'call',
          strike_price: upperStrike,
          quantity: -quantity,
          leg_label: 'short_call',
        },
      ];

    case 'call_credit_spread':
      // Sell lower call, buy higher call
      return [
        {
          option_type: 'call',
          strike_price: lowerStrike,
          quantity: -quantity,
          leg_label: 'short_call',
        },
        {
          option_type: 'call',
          strike_price: upperStrike,
          quantity: quantity,
          leg_label: 'long_call',
        },
      ];

    case 'put_debit_spread':
      // Buy higher put, sell lower put
      return [
        {
          option_type: 'put',
          strike_price: upperStrike,
          quantity: quantity,
          leg_label: 'long_put',
        },
        {
          option_type: 'put',
          strike_price: lowerStrike,
          quantity: -quantity,
          leg_label: 'short_put',
        },
      ];

    case 'put_credit_spread':
      // Sell higher put, buy lower put
      return [
        {
          option_type: 'put',
          strike_price: upperStrike,
          quantity: -quantity,
          leg_label: 'short_put',
        },
        {
          option_type: 'put',
          strike_price: lowerStrike,
          quantity: quantity,
          leg_label: 'long_put',
        },
      ];

    default:
      return [];
  }
}

// ============================================================================
// GET /api/positions/spreads - List user's spreads
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseClient(authHeader);

    // Get user from token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Fetch spreads with their legs
    const { data, error } = await supabase
      .from('user_spreads')
      .select(
        `
        *,
        legs:user_positions(*)
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Spreads API] Fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch spreads' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data as Spread[] });
  } catch (error) {
    console.error('[Spreads API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/positions/spreads - Create a new spread
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseClient(authHeader);

    // Get user from token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: CreateSpreadRequest = await request.json();

    // Validate required fields
    if (
      !body.symbol ||
      !body.spread_type ||
      !body.quantity ||
      !body.entry_date ||
      !body.expiration_date
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For vertical spreads, require strikes
    const verticalSpreads = [
      'call_debit_spread',
      'call_credit_spread',
      'put_debit_spread',
      'put_credit_spread',
    ];

    if (verticalSpreads.includes(body.spread_type)) {
      if (!body.lower_strike || !body.upper_strike) {
        return NextResponse.json(
          { error: 'Vertical spreads require lower_strike and upper_strike' },
          { status: 400 }
        );
      }
    }

    // Insert spread first
    const { data: spread, error: spreadError } = await supabase
      .from('user_spreads')
      .insert({
        user_id: user.id,
        symbol: body.symbol.toUpperCase(),
        spread_type: body.spread_type,
        net_debit_credit: body.net_debit_credit,
        quantity: body.quantity,
        entry_date: body.entry_date,
        expiration_date: body.expiration_date,
        max_profit: body.max_profit,
        max_loss: body.max_loss,
        breakeven_lower: body.breakeven_lower,
        breakeven_upper: body.breakeven_upper,
        width: body.width,
        notes: body.notes,
      })
      .select()
      .single();

    if (spreadError) {
      console.error('[Spreads API] Insert spread error:', spreadError);
      return NextResponse.json(
        { error: 'Failed to create spread' },
        { status: 500 }
      );
    }

    // Generate and insert legs
    if (body.lower_strike && body.upper_strike) {
      const legs = generateSpreadLegs(
        body.spread_type,
        body.lower_strike,
        body.upper_strike,
        body.quantity
      );

      if (legs.length > 0) {
        // Calculate approximate leg prices from net price and width
        // For debit spreads: long leg ≈ net + (width * 0.3), short leg ≈ width * 0.3
        // For credit spreads: short leg ≈ net + (width * 0.3), long leg ≈ width * 0.3
        const width = body.upper_strike - body.lower_strike;
        const netPrice = Math.abs(body.net_debit_credit);
        const isDebit = body.spread_type.includes('debit');

        const legInserts = legs.map((leg) => {
          // Estimate individual leg price (placeholder - actual prices not tracked)
          const isLongLeg = leg.quantity > 0;
          let estimatedPrice: number;

          if (isDebit) {
            // Debit spread: long leg is more expensive
            estimatedPrice = isLongLeg
              ? netPrice + width * 0.3 // Long leg
              : width * 0.3; // Short leg
          } else {
            // Credit spread: short leg is more expensive
            estimatedPrice = isLongLeg
              ? width * 0.3 // Long leg (protection)
              : netPrice + width * 0.3; // Short leg (premium)
          }

          // Ensure minimum price of $0.01 to satisfy constraint
          const entryPrice = Math.max(
            0.01,
            Math.round(estimatedPrice * 100) / 100
          );

          return {
            user_id: user.id,
            spread_id: spread.id,
            symbol: body.symbol.toUpperCase(),
            position_type: 'option' as const,
            quantity: leg.quantity,
            entry_price: entryPrice,
            entry_date: body.entry_date,
            option_type: leg.option_type,
            strike_price: leg.strike_price,
            expiration_date: body.expiration_date,
            leg_label: leg.leg_label,
          };
        });

        const { error: legsError } = await supabase
          .from('user_positions')
          .insert(legInserts);

        if (legsError) {
          console.error('[Spreads API] Insert legs error:', legsError);
          // Don't fail the whole request, just log it
        }
      }
    }

    // Fetch the spread with legs
    const { data: fullSpread } = await supabase
      .from('user_spreads')
      .select(`*, legs:user_positions(*)`)
      .eq('id', spread.id)
      .single();

    return NextResponse.json({ data: fullSpread as Spread }, { status: 201 });
  } catch (error) {
    console.error('[Spreads API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
