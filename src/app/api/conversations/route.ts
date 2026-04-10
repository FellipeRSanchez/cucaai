import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
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
            } catch (error) {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {}
          },
        },
      }
    );

    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('id');

    const supabase = getServiceSupabase();

    if (conversationId) {
      // Fetch messages for a specific conversation
      const { data, error } = await supabase
        .schema('cuca')
        .from('mensagens')
        .select('*')
        .eq('men_conversa_id', conversationId)
        .neq('men_conteudo', '')
        .order('men_criado_em', { ascending: true });

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Fetch list of conversations
      const { data, error } = await supabase
        .schema('cuca')
        .from('conversas')
        .select('*')
        .eq('con_usuario_id', session.user.id)
        .order('con_atualizado_em', { ascending: false });

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
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
            } catch (error) {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {}
          },
        },
      }
    );

    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .schema('cuca')
      .from('conversas')
      .delete()
      .eq('con_id', id)
      .eq('con_usuario_id', session.user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
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
            } catch (error) {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {}
          },
        },
      }
    );

    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, title } = await req.json();
    if (!id || !title) return NextResponse.json({ error: 'ID and title are required' }, { status: 400 });

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .schema('cuca')
      .from('conversas')
      .update({ con_titulo: title })
      .eq('con_id', id)
      .eq('con_usuario_id', session.user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating conversation title:', error);
    return NextResponse.json({ error: 'Failed to update conversation title' }, { status: 500 });
  }
}
