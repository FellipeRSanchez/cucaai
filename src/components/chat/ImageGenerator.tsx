'use client';

import { useState } from 'react';
import { ImageIcon, Loader2, X } from 'lucide-react';

interface ImageGeneratorProps {
  onImageGenerated: (imageUrl: string, prompt: string) => void;
  onClose: () => void;
  selectedModel?: string;
}

export default function ImageGenerator({ onImageGenerated, onClose, selectedModel }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao gerar imagem');
      }

      if (data.imageUrl) {
        setPreview(data.imageUrl);
        onImageGenerated(data.imageUrl, prompt);
      } else if (data.text) {
        setError(data.text);
      } else {
        throw new Error('Nenhuma imagem retornada');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar imagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ImageIcon size={18} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Gerar Imagem</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <textarea
            placeholder="Descreva a imagem que deseja gerar..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {preview && (
            <div className="relative">
              <img
                src={preview}
                alt="Imagem gerada"
                className="w-full rounded-lg border border-zinc-800"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm rounded flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <ImageIcon size={14} />
                  Gerar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
