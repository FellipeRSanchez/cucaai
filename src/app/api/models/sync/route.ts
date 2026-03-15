import { NextRequest, NextResponse } from 'next/server';
import { getEnrichedModels } from '@/lib/openrouter';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Light secret check to avoid public abuse
  const secret = req.headers.get('x-sync-secret');
  if (secret !== (process.env.SYNC_SECRET ?? 'cucaai-sync')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceSupabase();
    const models = await getEnrichedModels();

    if (models.length === 0) {
      return NextResponse.json({ error: 'No models fetched from OpenRouter' }, { status: 502 });
    }

    // Upsert all models into cuca.modelos
    const rows = models.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      provider: m.provider,
      context_length: m.context_length,
      pricing_prompt: m.pricing_prompt,
      pricing_completion: m.pricing_completion,
      modality: m.modality,
      capabilities: m.capabilities,
      tags: m.tags,
      is_free: m.is_free,
      top_provider: m.top_provider,
      architecture: m.architecture,
      last_synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .schema('cuca')
      .from('modelos')
      .upsert(rows, { onConflict: 'id' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      synced: rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[sync] Error syncing models:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}

// Allow GET for a quick status check
export async function GET() {
  try {
    const supabase = getServiceSupabase();
    const { count } = await supabase
      .schema('cuca')
      .from('modelos')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({ models_in_db: count ?? 0, timestamp: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
