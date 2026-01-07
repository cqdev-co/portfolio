import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
// DELETE /api/positions/spreads/[id] - Delete a spread
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

    // First check that the spread belongs to this user
    const { data: spread, error: fetchError } = await supabase
      .from('user_spreads')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !spread) {
      return NextResponse.json({ error: 'Spread not found' }, { status: 404 });
    }

    // Delete the spread (legs will be cascade deleted due to FK constraint)
    const { error: deleteError } = await supabase
      .from('user_spreads')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[Spreads API] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete spread' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Spreads API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
