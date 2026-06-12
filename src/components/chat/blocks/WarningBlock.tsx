import { AlertTriangle } from 'lucide-react';

interface WarningBlockProps {
    content: string;
}

export function WarningBlock({ content }: WarningBlockProps) {
    return (
        <div className="warning-block my-4 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-orange-500/10 p-4">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                    <AlertTriangle className="text-white" size={16} />
                </div>
                <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-300 mb-1">⚠️ Atenção</h4>
                    <div className="prose prose-invert prose-sm max-w-none text-zinc-200">
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
}