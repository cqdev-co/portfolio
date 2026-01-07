import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  CreatePositionRequest,
  Position,
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

  // If we have an auth header, use it for RLS
  const options = authHeader
    ? { global: { headers: { Authorization: authHeader } } }
    : {};

  return createClient(supabaseUrl, supabaseKey, options);
}

// ============================================================================
// GET /api/positions - List user's positions
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

    // Fetch positions
    const { data, error } = await supabase
      .from('user_positions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Positions API] Fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch positions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data as Position[] });
  } catch (error) {
    console.error('[Positions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/positions - Create a new position
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
    const body: CreatePositionRequest = await request.json();

    // Validate required fields
    if (
      !body.symbol ||
      !body.quantity ||
      !body.entry_price ||
      !body.entry_date
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate option fields
    if (body.position_type === 'option') {
      if (!body.option_type || !body.strike_price || !body.expiration_date) {
        return NextResponse.json(
          {
            error:
              'Options require option_type, strike_price, and expiration_date',
          },
          { status: 400 }
        );
      }
    }

    // Insert position
    const { data, error } = await supabase
      .from('user_positions')
      .insert({
        user_id: user.id,
        symbol: body.symbol.toUpperCase(),
        position_type: body.position_type || 'stock',
        quantity: body.quantity,
        entry_price: body.entry_price,
        entry_date: body.entry_date,
        option_type: body.option_type,
        strike_price: body.strike_price,
        expiration_date: body.expiration_date,
        notes: body.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('[Positions API] Insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create position' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data as Position }, { status: 201 });
  } catch (error) {
    console.error('[Positions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
