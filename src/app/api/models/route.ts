import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getEnrichedModels } from '@/lib/openrouter';

export async function GET() {
  try {
    // Try to serve from Supabase first
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('modelos')
      .select('*')
      .order('name');

    if (!error && data && data.length > 0) {
      return NextResponse.json(data);
    }

    // Fallback: fetch live from OpenRouter and enrich
    console.warn('[models] Supabase empty or error, falling back to live OpenRouter fetch');
    const models = await getEnrichedModels();
    return NextResponse.json(models);
  } catch (error: any) {
    console.error('[models] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve models' }, { status: 500 });
  }
}
