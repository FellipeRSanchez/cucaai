import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { videoUrl, prompt, model } = body;

    if (!videoUrl) {
      return NextResponse.json({ error: 'videoUrl is required' }, { status: 400 });
    }

    const analysisPrompt = prompt || 'Analyze this video in detail. Describe what happens, identify objects, people, actions, text, and any other relevant information. Provide a comprehensive summary in Portuguese.';

    console.log(`[VideoAnalysis] Analyzing video: ${videoUrl} with model ${model || 'google/gemini-2.5-flash'}`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              { type: 'video', video: { url: videoUrl } },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[VideoAnalysis] API error:', response.status, errorData);
      return NextResponse.json({ error: `API error: ${response.status} - ${errorData}` }, { status: 500 });
    }

    const data = await response.json();

    const choice = data.choices?.[0];
    if (!choice) {
      return NextResponse.json({ error: 'No response from model' }, { status: 500 });
    }

    const content = choice.message?.content || '';
    const usage = data.usage;

    return NextResponse.json({
      success: true,
      analysis: content,
      usage: {
        prompt_tokens: usage?.prompt_tokens,
        completion_tokens: usage?.completion_tokens,
        total_tokens: usage?.total_tokens,
      },
    });

  } catch (error) {
    console.error('[VideoAnalysis] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}