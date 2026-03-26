import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: any) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: any) {
            try { cookieStore.set({ name, value: '', ...options }); } catch {}
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      .eq('men_papel', 'assistant')
      .single();

    if (error || !data) {
      return NextResponse.json({ status: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ status: data.men_status });
  } catch (error) {
    console.error('[Status API] Error:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}
