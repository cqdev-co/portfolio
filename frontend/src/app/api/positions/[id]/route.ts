import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  UpdatePositionRequest,
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

  const options = authHeader
    ? { global: { headers: { Authorization: authHeader } } }
    : {};

  return createClient(supabaseUrl, supabaseKey, options);
}

// ============================================================================
// GET /api/positions/[id] - Get single position
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseClient(authHeader);

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

    const { data, error } = await supabase
      .from('user_positions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: data as Position });
  } catch (error) {
    console.error('[Positions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/positions/[id] - Update position
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseClient(authHeader);

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

    const body: UpdatePositionRequest = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.entry_price !== undefined)
      updateData.entry_price = body.entry_price;
    if (body.entry_date !== undefined) updateData.entry_date = body.entry_date;
    if (body.notes !== undefined) updateData.notes = body.notes;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('user_positions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[Positions API] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update position' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: data as Position });
  } catch (error) {
    console.error('[Positions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/positions/[id] - Delete position
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = getSupabaseClient(authHeader);

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

    const { error } = await supabase
      .from('user_positions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[Positions API] Delete error:', error);
      return NextResponse.json(
        { error: 'Failed to delete position' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Positions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
