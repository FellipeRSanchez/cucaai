import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getServiceSupabase();
    const filePath = `images/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload to Supabase Storage (Bucket: 'images')
    const { data: storageData, error: storageError } = await supabase.storage
      .from('images') // User must create this bucket
      .upload(filePath, buffer, { contentType: file.type });

    if (storageError) {
      console.error('Image upload error:', storageError);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Gerar a URL Pública para a imagem
    const { data: publicUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    // TODO: In a more advanced flow, we would pass this image URL to a Vision Model (like Claude 3.5 Sonnet) 
    // to extract its contents and save the representation to the 'memorias' or 'documentos' table.
    
    return NextResponse.json({ 
      success: true, 
      imageUrl: publicUrlData.publicUrl 
    });

  } catch (error) {
    console.error('Image processing error:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
