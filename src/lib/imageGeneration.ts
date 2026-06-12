import { tool } from 'ai';
import { z } from 'zod';

export const generateImage = tool({
  description: 'Generate an image from a text description. Use this when the user asks to create, generate, or draw an image, picture, illustration, or artwork.',
  parameters: z.object({
    prompt: z.string().describe('Detailed description of the image to generate.'),
    model: z.string().optional().describe('Image model to use (default: openai/gpt-5-image).'),
    aspect_ratio: z.string().optional().describe('Aspect ratio: "1:1", "16:9", "4:3", "3:4".'),
    image_size: z.string().optional().describe('Resolution: "1K", "2K", "4K".'),
  }),
  execute: async ({ prompt, model, aspect_ratio, image_size }) => {
    console.log(`[ImageGen] Generating image: "${prompt}" with model ${model || 'openai/gpt-5-image'}`);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-5-image',
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
        return `Erro ao gerar imagem: ${response.status}`;
      }

      const data = await response.json();

      // Extract image from response
      const choice = data.choices?.[0];
      if (!choice) {
        return 'Sem resposta do modelo de imagem.';
      }

      const message = choice.message;

      // Check for images in the response
      if (message?.images && message.images.length > 0) {
        const imageData = message.images[0];
        const url = imageData.url || `data:image/png;base64,${imageData.base64}`;
        return `![Imagem gerada](${url})`;
      }

      // Check for content parts with image type
      if (Array.isArray(message?.content)) {
        for (const part of message.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            return `![Imagem gerada](${part.image_url.url})`;
          }
        }
      }

      // If text response, return it
      if (message?.content && typeof message.content === 'string') {
        return message.content;
      }

      return 'Não foi possível gerar a imagem.';
    } catch (err) {
      console.error('[ImageGen] Error:', err);
      return `Erro ao gerar imagem: ${err instanceof Error ? err.message : 'Erro desconhecido'}`;
    }
  },
});
