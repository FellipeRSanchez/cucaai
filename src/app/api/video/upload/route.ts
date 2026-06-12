import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No video provided' }, { status: 400 });
    }

    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'File must be a video' }, { status: 400 });
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Video must be less than 100MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getServiceSupabase();
    const filePath = `videos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const { data: storageData, error: storageError } = await supabase.storage
      .from('images')
      .upload(filePath, buffer, { contentType: file.type });

    if (storageError) {
      console.error('Video upload error:', storageError);
      return NextResponse.json({ error: 'Failed to upload video' }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return NextResponse.json({ 
      success: true, 
      videoUrl: publicUrlData.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type
    });

  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json({ error: 'Failed to process video' }, { status: 500 });
  }
}