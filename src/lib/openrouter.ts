import { createOpenAI } from '@ai-sdk/openai';

export const openRouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OpenRouterRawModel {
  id: string;
  name: string;
  description?: string;
  pricing: { prompt: string; completion: string; image?: string };
  context_length: number;
  architecture?: { modality?: string; tokenizer?: string; instruct_type?: string };
  top_provider?: { context_length?: number; max_completion_tokens?: number; is_moderated?: boolean };
  per_request_limits?: Record<string, string> | null;
  supported_parameters?: string[];
}

export interface EnrichedModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  context_length: number;
  pricing_prompt: number;     // $ per 1M tokens
  pricing_completion: number; // $ per 1M tokens
  modality: 'text' | 'image' | 'multimodal';
  capabilities: {
    vision: boolean;
    tools: boolean;
    json_mode: boolean;
  };
  tags: string[];
  is_free: boolean;
  top_provider: object | null;
  architecture: object | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractProvider(id: string): string {
  return id.split('/')[0] ?? id;
}

function resolveModality(raw: OpenRouterRawModel): 'text' | 'image' | 'multimodal' {
  const mod = raw.architecture?.modality?.toLowerCase() ?? '';
  if (mod.includes('image') && mod.includes('text')) return 'multimodal';
  if (mod.includes('image')) return 'image';
  return 'text';
}

function resolveCapabilities(raw: OpenRouterRawModel) {
  const params = raw.supported_parameters ?? [];
  const nameId = (raw.id + raw.name).toLowerCase();
  return {
    vision: resolveModality(raw) !== 'text' || nameId.includes('vision'),
    tools: params.includes('tools') || params.includes('tool_choice'),
    json_mode: params.includes('response_format'),
  };
}

const CODE_PATTERNS = ['coder', 'code', 'codestral', 'devstral', 'phi-4', 'starcoder'];
const REASONING_PATTERNS = ['o1', 'o3', 'r1', 'thinking', 'reasoner', 'reason', 'qwq', 'deepseek-r'];
const CHAT_PATTERNS = ['claude', 'gpt', 'gemini', 'llama', 'mistral', 'mixtral'];

function resolveTags(raw: OpenRouterRawModel, isFree: boolean): string[] {
  const nameId = (raw.id + ' ' + raw.name).toLowerCase();
  const tags: string[] = [];

  if (isFree) tags.push('free');
  if (CODE_PATTERNS.some(p => nameId.includes(p))) tags.push('code');
  if (REASONING_PATTERNS.some(p => nameId.includes(p))) tags.push('reasoning');
  if (CHAT_PATTERNS.some(p => nameId.includes(p))) tags.push('chat');

  // Vision models
  if (resolveModality(raw) !== 'text') tags.push('vision');

  return [...new Set(tags)];
}

export function enrichModel(raw: OpenRouterRawModel): EnrichedModel {
  const pricingPrompt = parseFloat(raw.pricing.prompt) * 1_000_000;
  const pricingCompletion = parseFloat(raw.pricing.completion) * 1_000_000;
  const isFree = pricingPrompt === 0 && pricingCompletion === 0;

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    provider: extractProvider(raw.id),
    context_length: raw.context_length ?? 0,
    pricing_prompt: pricingPrompt,
    pricing_completion: pricingCompletion,
    modality: resolveModality(raw),
    capabilities: resolveCapabilities(raw),
    tags: resolveTags(raw, isFree),
    is_free: isFree,
    top_provider: raw.top_provider ?? null,
    architecture: raw.architecture ?? null,
  };
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export const getOpenRouterModels = async (forceFresh: boolean = false): Promise<OpenRouterRawModel[]> => {
  try {
    const init: RequestInit & { next?: { revalidate: number } } = {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` },
    };

    if (forceFresh) {
      init.cache = 'no-store';
    } else {
      init.next = { revalidate: 3600 }; // Next.js ISR cache for 1 hour
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', init);
    if (!res.ok) throw new Error('Failed to fetch OpenRouter models');
    const data = await res.json();
    return data.data as OpenRouterRawModel[];
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    return [];
  }
};

export const getEnrichedModels = async (forceFresh: boolean = false): Promise<EnrichedModel[]> => {
  const raw = await getOpenRouterModels(forceFresh);
  return raw.map(enrichModel);
};
