import { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockEnhancedProps {
    content: string;
    language?: string;
}

export function CodeBlockEnhanced({ content, language = 'text' }: CodeBlockEnhancedProps) {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef<HTMLPreElement>(null);

    // Apply syntax highlighting when content or language changes
    useEffect(() => {
        if (codeRef.current && window.hljs) {
            const codeElement = codeRef.current.querySelector('code');
            if (codeElement) {
                window.hljs.highlightElement(codeElement);
            }
        }
    }, [content, language]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Trim content to remove trailing newlines from parser
    const trimmedContent = content.trim();

    return (
        <div className="code-block-enhanced my-4 rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 ml-2 uppercase">{language}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                >
                    {copied ? (
                        <>
                            <Check size={12} />
                            Copiado!
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            Copiar
                        </>
                    )}
                </button>
            </div>
            <pre ref={codeRef} className="p-4 overflow-x-auto">
                <code className={`language-${language} text-sm font-mono text-zinc-200 leading-relaxed`}>{trimmedContent}</code>
            </pre>
        </div>
    );
}
