import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { extractTextFromBuffer, chunkText } from '@/lib/documentParser';
import { generateEmbeddings } from '@/lib/embeddings';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 1. Upload to Supabase Storage (Buckets must be configured)
    const supabase = getServiceSupabase();
    const filePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from('documents') // Needs a bucket named 'documents'
      .upload(filePath, buffer, { contentType: file.type });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      return NextResponse.json({ error: 'Failed to upload file to storage' }, { status: 500 });
    }

    // 2. Extract Text
    const extractedText = await extractTextFromBuffer(buffer, file.type);
    
    // 3. Insert into `documentos` table
    const { data: docInfo, error: docError } = await supabase
      .schema('cuca')
      .from('documentos')
      .insert({
        doc_nome: file.name,
        doc_tipo: file.type,
      })
      .select('doc_id')
      .single();

    if (docError || !docInfo) {
      console.error('DB Insert error (documentos):', docError);
      return NextResponse.json({ error: 'Failed to save document metadata' }, { status: 500 });
    }

    // 4. Chunk text & create Embeddings in batches
    // Very large files might need a background queue, but we'll do simple await for MVPs
    const chunks = chunkText(extractedText);
    
    // Fetch all embeddings concurrently
    const embeddings = await generateEmbeddings(chunks);
    
    // Prepare chunks to insert into vector DB
    const chunkInserts = chunks.map((chunkText, i) => ({
      dch_documento: docInfo.doc_id,
      dch_texto: chunkText,
      // Format array of numbers to string [number, number...] for pgvector
      dch_embedding: `[${embeddings[i].join(',')}]`
    }));

    // Perform bulk insert
    const { error: chunksError } = await supabase
      .schema('cuca')
      .from('documentos_chunks')
      .insert(chunkInserts);

    if (chunksError) {
      console.error('DB Insert error (documentos_chunks):', chunksError);
      return NextResponse.json({ error: 'Failed to save document chunks' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      documentId: docInfo.doc_id,
      chunksProcessed: chunks.length 
    });

  } catch (error) {
    console.error('Document processing error:', error);
    return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
  }
}
