import { NextResponse } from 'next/server';

const IMAGE_CAPABLE_MODELS = [
  'openai/gpt-5-image',
  'openai/gpt-5',
  'openai/o3',
];

function isImageCapable(model: string): boolean {
  return IMAGE_CAPABLE_MODELS.some(m => model.toLowerCase().includes(m));
}

function resolveImageModel(userModel: string | undefined): string {
  if (!userModel) return 'openai/gpt-5-image';
  const lower = userModel.toLowerCase();
  if (isImageCapable(lower)) return userModel;
  return 'openai/gpt-5-image';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, aspect_ratio, image_size } = body;
    const resolvedModel = resolveImageModel(model);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const fallbackNote = resolvedModel !== model && model ? ` (fallback: ${model} não suporta geração de imagens)` : '';
    console.log(`[ImageGen] Generating image: "${prompt}" with model ${resolvedModel}${fallbackNote}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modalities: ['image', 'text'],
        ...(aspect_ratio || image_size ? {
          image_config: {
            ...(aspect_ratio && { aspect_ratio }),
            ...(image_size && { image_size }),
          },
        } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[ImageGen] API error:', response.status, errorData);
      return NextResponse.json({ error: `API error: ${response.status}` }, { status: 500 });
    }

    const data = await response.json();

    // Extract image from response
    const choice = data.choices?.[0];
    if (!choice) {
      return NextResponse.json({ error: 'No response from model' }, { status: 500 });
    }

    const message = choice.message;

    // Check for images in the response
    if (message?.images && message.images.length > 0) {
      const imageData = message.images[0];
      const url = imageData.url || `data:image/png;base64,${imageData.base64}`;
      return NextResponse.json({
        success: true,
        imageUrl: url,
        revised_prompt: imageData.revised_prompt || prompt,
      });
    }

    // Check for content parts with image type
    if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        if (part.type === 'image_url' && part.image_url?.url) {
          return NextResponse.json({
            success: true,
            imageUrl: part.image_url.url,
            revised_prompt: prompt,
          });
        }
      }
    }

    // If text response, return it
    if (message?.content && typeof message.content === 'string') {
      return NextResponse.json({
        success: true,
        text: message.content,
      });
    }

    return NextResponse.json({ error: 'No image in response' }, { status: 500 });
  } catch (err) {
    console.error('[ImageGen] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
