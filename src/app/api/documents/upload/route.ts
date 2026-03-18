import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { extractTextFromBuffer, chunkText } from '@/lib/documentParser';
import { generateEmbeddings } from '@/lib/embeddings';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    // 0. Get user session
    const cookieStore = await cookies();
    const supabaseClient = createServerClient(
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
              // Handle server component session refresh
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options });
            } catch (error) {
              // Handle server component session refresh
            }
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error('[Upload API] Auth error or no user found:', authError);
      return NextResponse.json({ error: 'Unauthorized - No user session' }, { status: 401 });
    }

    const userId = user.id;
    console.log('[Upload API] User authenticated:', userId);

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.error('[Upload API] No file in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`[Upload API] Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. Upload to Supabase Storage
    const supabase = getServiceSupabase();
    const filePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    console.log('[Upload API] Uploading to storage bucket "documents"...');
    const { data: storageData, error: storageError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, { contentType: file.type });

    if (storageError) {
      console.error('[Upload API] Storage upload error:', storageError);
      return NextResponse.json({ 
        error: 'Failed to upload file to storage', 
        details: storageError.message 
      }, { status: 500 });
    }

    console.log('[Upload API] Storage upload successful:', storageData);

    // 2. Extract Text
    console.log('[Upload API] Extracting text...');
    let extractedText = '';
    try {
      extractedText = await extractTextFromBuffer(buffer, file.type);
      console.log(`[Upload API] Text extracted successfully (${extractedText.length} characters)`);
    } catch (parseError: any) {
      console.error('[Upload API] Text extraction error:', parseError);
      return NextResponse.json({ 
        error: 'Failed to parse document content', 
        details: parseError.message 
      }, { status: 500 });
    }
    
    // 3. Insert into `documentos` table
    console.log('[Upload API] Inserting metadata into "documentos" table...');
    const { data: docInfo, error: docError } = await supabase
      .schema('cuca')
      .from('documentos')
      .insert({
        doc_usuario_id: userId,
        doc_nome: file.name,
        doc_tipo: file.type,
        doc_tamanho: file.size,
        doc_conteudo: extractedText,
      })
      .select('doc_id')
      .single();

    if (docError || !docInfo) {
      console.error('[Upload API] DB Insert error (documentos):', docError);
      return NextResponse.json({ 
        error: 'Failed to save document metadata', 
        details: docError?.message || 'No data returned' 
      }, { status: 500 });
    }

    console.log('[Upload API] Document metadata saved:', docInfo.doc_id);

    // 4. Chunk text & create Embeddings
    console.log('[Upload API] Chunking text and generating embeddings...');
    const chunks = chunkText(extractedText);
    console.log(`[Upload API] Generated ${chunks.length} chunks`);
    
    let embeddings: number[][] = [];
    try {
      embeddings = await generateEmbeddings(chunks);
      console.log(`[Upload API] Generated ${embeddings.length} embeddings`);
    } catch (embedError: any) {
      console.error('[Upload API] Embedding generation error:', embedError);
      return NextResponse.json({ 
        error: 'Failed to generate embeddings', 
        details: embedError.message 
      }, { status: 500 });
    }
    
    // Prepare chunks to insert
    const chunkInserts = chunks.map((chunkText, i) => ({
      dch_documento: docInfo.doc_id,
      dch_texto: chunkText,
      dch_embedding: `[${embeddings[i].join(',')}]`
    }));

    // Perform bulk insert
    console.log('[Upload API] Inserting chunks into "documentos_chunks" table...');
    const { error: chunksError } = await supabase
      .schema('cuca')
      .from('documentos_chunks')
      .insert(chunkInserts);

    if (chunksError) {
      console.error('[Upload API] DB Insert error (documentos_chunks):', chunksError);
      return NextResponse.json({ 
        error: 'Failed to save document chunks', 
        details: chunksError.message 
      }, { status: 500 });
    }

    console.log('[Upload API] All chunks saved successfully');

    return NextResponse.json({ 
      success: true, 
      documentId: docInfo.doc_id,
      chunksProcessed: chunks.length 
    });

  } catch (error: any) {
    console.error('[Upload API] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to process document', 
      details: error.message 
    }, { status: 500 });
  }
}
