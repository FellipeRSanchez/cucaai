import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: Request) {
    try {
        console.log('[Memories API] GET request received');

        // Get Auth Session
        const cookieStore = await cookies();
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: any) {
                        try {
                            cookieStore.set({ name, value, ...options });
                        } catch (error) {
                            // Ignore
                        }
                    },
                    remove(name: string, options: any) {
                        try {
                            cookieStore.set({ name, value: '', ...options });
                        } catch (error) {
                            // Ignore
                        }
                    },
                },
            }
        );
        const { data: { session } } = await supabaseAuth.auth.getSession();

        if (!session) {
            console.log('[Memories API] No session found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        console.log('[Memories API] User ID:', userId);

        const supabase = getServiceSupabase();

        // Get search term from query params
        const { searchParams } = new URL(req.url);
        const searchTerm = searchParams.get('search') || '';
        console.log('[Memories API] Search term:', searchTerm);

        let query = supabase
            .schema('cuca')
            .from('memorias')
            .select('*')
            .eq('mem_usuario_id', userId)
            .order('mem_criado_em', { ascending: false });

        if (searchTerm) {
            query = query.ilike('mem_conteudo', `%${searchTerm}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Memories API] Erro ao buscar memórias:', error);
            return NextResponse.json({ error: 'Erro ao buscar memórias' }, { status: 500 });
        }

        console.log('[Memories API] Found memories:', data?.length || 0);
        return NextResponse.json(data || []);
    } catch (error) {
        console.error('[Memories API] Erro inesperado:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        // Get Auth Session
        const cookieStore = await cookies();
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: any) {
                        try {
                            cookieStore.set({ name, value, ...options });
                        } catch (error) {
                            // Ignore
                        }
                    },
                    remove(name: string, options: any) {
                        try {
                            cookieStore.set({ name, value: '', ...options });
                        } catch (error) {
                            // Ignore
                        }
                    },
                },
            }
        );
        const { data: { session } } = await supabaseAuth.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const memoryId = searchParams.get('id');

        if (!memoryId) {
            return NextResponse.json({ error: 'ID da memória é obrigatório' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        const { error } = await supabase
            .schema('cuca')
            .from('memorias')
            .delete()
            .eq('mem_id', memoryId)
            .eq('mem_usuario_id', session.user.id);

        if (error) {
            console.error('Erro ao deletar memória:', error);
            return NextResponse.json({ error: 'Erro ao deletar memória' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Erro inesperado:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}