import { Brain } from 'lucide-react';

interface AnalysisBlockProps {
    content: string;
}

export function AnalysisBlock({ content }: AnalysisBlockProps) {
    return (
        <div className="analysis-block my-4">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Brain className="text-white" size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-white">Análise Detalhada</h4>
                    <p className="text-xs text-zinc-400">Insights baseados em dados</p>
                </div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4">
                <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
                    {content}
                </div>
            </div>
        </div>
    );
}