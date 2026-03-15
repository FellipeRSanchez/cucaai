import { CheckCircle2 } from 'lucide-react';

interface SummaryBlockProps {
    content: string;
}

export function SummaryBlock({ content }: SummaryBlockProps) {
    return (
        <div className="summary-block my-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-green-500/10 p-4">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="text-white" size={16} />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-emerald-300 mb-1">📌 Resumo</h4>
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
}