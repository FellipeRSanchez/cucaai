import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getServiceSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {}
          },
        },
      }
    )

    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceSupabase()

    // Fetch custom agents for the user
    const { data, error } = await supabase
      .schema('cuca')
      .from('agentes')
      .select('*')
      .eq('usuario_id', session.user.id)
      .order('criado_em', { ascending: false })

    if (error) {
      console.error('Supabase error fetching agents:', error)
      // Return empty array on error to prevent frontend issues
      return NextResponse.json([])
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching agents:', error)
    // Return empty array on error
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {}
          },
        },
      }
    )

    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const agentData = await req.json()

    // Validate required fields
    if (!agentData.nome || !agentData.system_prompt) {
      return NextResponse.json(
        { error: 'Nome e system_prompt são obrigatórios' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .schema('cuca')
      .from('agentes')
      .insert({
        usuario_id: session.user.id,
        nome: agentData.nome,
        descricao: agentData.descricao || '',
        emoji: agentData.emoji || '🤖',
        system_prompt: agentData.system_prompt,
        ferramentas: agentData.ferramentas || [],
        is_default: agentData.is_default || false,
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error creating agent:', error)
      throw error
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating agent:', error)
    return NextResponse.json({ error: error.message || 'Failed to create agent' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {}
          },
        },
      }
    )

    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const agentData = await req.json()

    // Validate required fields
    if (!agentData.id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }
    if (!agentData.nome || !agentData.system_prompt) {
      return NextResponse.json(
        { error: 'Nome e system_prompt são obrigatórios' },
        { status: 400 }
      )
    }

    // Ensure user can only update their own agents
    const { data, error } = await supabase
      .schema('cuca')
      .from('agentes')
      .update({
        nome: agentData.nome,
        descricao: agentData.descricao || '',
        emoji: agentData.emoji || '🤖',
        system_prompt: agentData.system_prompt,
        ferramentas: agentData.ferramentas || [],
        is_default: agentData.is_default || false,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', agentData.id)
      .eq('usuario_id', session.user.id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error updating agent:', error)
      throw error
    }
    if (!data) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Error updating agent:', error)
    return NextResponse.json({ error: error.message || 'Failed to update agent' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {}
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {}
          },
        },
      }
    )

    const { data: { session } } = await supabaseAuth.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // Ensure user can only delete their own agents
    const { error } = await supabase
      .schema('cuca')
      .from('agentes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', session.user.id)

    if (error) {
      console.error('Supabase error deleting agent:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting agent:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete agent' }, { status: 500 })
  }
}
