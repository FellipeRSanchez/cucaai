import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getEnrichedModels } from '@/lib/openrouter';

export const dynamic = 'force-dynamic';

const STALE_HOURS = 6;
const MIN_EXPECTED_MODELS = 50;

function isModelsSnapshotStale(rows: any[]): boolean {
  if (!rows || rows.length === 0) return true;
  if (rows.length < MIN_EXPECTED_MODELS) return true;

  const latest = rows
    .map((r) => r.last_synced_at)
    .filter(Boolean)
    .map((v) => new Date(v as string).getTime())
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => b - a)[0];

  if (!latest) return true;

  const maxAgeMs = STALE_HOURS * 60 * 60 * 1000;
  return Date.now() - latest > maxAgeMs;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('refresh') === '1';

    // Try to serve from Supabase first (schema cuca)
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .schema('cuca')
      .from('modelos')
      .select('*')
      .order('name');

    const hasDbData = !error && Array.isArray(data) && data.length > 0;
    const shouldRefresh =
      forceRefresh ||
      !hasDbData ||
      isModelsSnapshotStale(data ?? []);

    if (!shouldRefresh && hasDbData) {
      console.log('[models] Found fresh models in cuca.modelos:', data.length);
      return NextResponse.json(data);
    }

    if (shouldRefresh) {
      console.log('[models] Refresh required:', {
        forceRefresh,
        hasDbData,
        dbCount: data?.length ?? 0,
      });
    }

    // Fallback: fetch live from OpenRouter and enrich
    console.warn('[models] cuca.modelos empty or error, falling back to live OpenRouter fetch');
    const models = await getEnrichedModels(forceRefresh);
    console.log('[models] Fetched models from OpenRouter:', models.length);

    // Try to persist fallback models in cuca.modelos so next requests are fast and consistent
    if (models.length > 0) {
      const { error: upsertError } = await supabase
        .schema('cuca')
        .from('modelos')
        .upsert(
          models.map((m) => ({
            ...m,
            last_synced_at: new Date().toISOString(),
          })),
          { onConflict: 'id' }
        );

      if (upsertError) {
        console.error('[models] Failed to upsert fallback models into cuca.modelos:', upsertError);
        if (hasDbData) {
          // Degrade gracefully: if sync fails but DB has old data, return old data
          return NextResponse.json(data);
        }
      }
    }

    if (models.length === 0 && hasDbData) {
      return NextResponse.json(data);
    }

    return NextResponse.json(models);
  } catch (error: any) {
    console.error('[models] GET error:', error);
    return NextResponse.json({ error: 'Failed to retrieve models' }, { status: 500 });
  }
}
