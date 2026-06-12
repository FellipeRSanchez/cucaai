import { Lightbulb } from 'lucide-react';

interface InsightBlockProps {
    content: string;
}

export function InsightBlock({ content }: InsightBlockProps) {
    return (
        <div className="insight-block my-4 rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-indigo-500/5 p-4">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
                    <Lightbulb className="text-white" size={16} />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-300 mb-1">💡 Insight</h4>
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
}