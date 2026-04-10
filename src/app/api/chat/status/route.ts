import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .schema('cuca')
      .from('mensagens')
      .select('men_status')
      .eq('men_job_id', jobId)
      .single();

    if (error) {
      // If no row found, the job might not exist yet
      if (error.code === 'PGRST116') {
        return NextResponse.json({ status: 'pending' });
      }
      console.error('[Chat Status] Error querying job status:', error.message);
      return NextResponse.json({ status: 'pending' });
    }

    const status = data?.men_status || 'pending';
    return NextResponse.json({ status });
  } catch (error: any) {
    console.error('[Chat Status] Unexpected error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
