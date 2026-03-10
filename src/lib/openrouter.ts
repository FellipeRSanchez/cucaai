import { createOpenAI } from '@ai-sdk/openai';

export const openRouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const getOpenRouterModels = async () => {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      }
    });
    if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
    const data = await res.json();
    return data.data; // Array of model objects
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return [];
  }
};
