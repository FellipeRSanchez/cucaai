import { ReactElement, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { parseStructuredBlocks, BlockData } from './parser';
import { AnalysisBlock } from './AnalysisBlock';
import { TableBlock } from './TableBlock';
import { CodeBlockEnhanced } from './CodeBlockEnhanced';
import { ChartBlock } from './ChartBlock';
import { InsightBlock } from './InsightBlock';
import { WarningBlock } from './WarningBlock';
import { SummaryBlock } from './SummaryBlock';

interface StructuredBlocksRendererProps {
    content: string;
    isStreaming?: boolean;
}

// Bug #7 Fix: Single unified code renderer via CodeBlockEnhanced
// Bug #9 Fix: Stable keys based on block content hash + type
function stableBlockKey(block: BlockData, index: number): string {
    const prefix = block.type;
    const contentHash = block.content.length > 0
        ? block.content.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')
        : '';
    return `${prefix}-${contentHash}-${index}`;
}

function renderBlock(block: BlockData): ReactElement | null {
    switch (block.type) {
        case 'analysis':
            return <AnalysisBlock content={block.content} />;
        case 'table':
            return <TableBlock content={block.content} />;
        case 'code':
            return <CodeBlockEnhanced content={block.content} language={block.language} />;
        case 'chart':
            return <ChartBlock content={block.content} chartType={block.chartType || 'bar'} />;
        case 'insight':
            return <InsightBlock content={block.content} />;
        case 'warning':
            return <WarningBlock content={block.content} />;
        case 'summary':
            return <SummaryBlock content={block.content} />;
        case 'text':
            return (
                <div className="text-block prose prose-invert prose-sm max-w-none text-zinc-200">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeHighlight]}
                        components={{
                            code({ className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !match && !className;

                                if (isInline) {
                                    return (
                                        <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-400" {...props}>
                                            {children}
                                        </code>
                                    );
                                }

                                // Bug #7 Fix: Redirect block-level code to CodeBlockEnhanced
                                // so it doesn't flash between two different renderers
                                const lang = match?.[1] || 'text';
                                const codeContent = String(children).replace(/\n$/, '');
                                return <CodeBlockEnhanced content={codeContent} language={lang} />;
                            },
                            img({ src, alt, ...props }) {
                                return (
                                    <div className="my-3">
                                        <img
                                            src={src}
                                            alt={alt || 'Imagem gerada'}
                                            className="max-w-full rounded-lg border border-zinc-800 shadow-lg"
                                            loading="lazy"
                                            {...props}
                                        />
                                        {alt && alt !== 'Imagem gerada' && (
                                            <p className="text-xs text-zinc-500 mt-1 text-center">{alt}</p>
                                        )}
                                    </div>
                                );
                            },
                        }}
                    >
                        {block.content}
                    </ReactMarkdown>
                </div>
            );
        default:
            return null;
    }
}

export function StructuredBlocksRenderer({ content, isStreaming = false }: StructuredBlocksRendererProps) {
    const blocks = useMemo(() => parseStructuredBlocks(content), [content]);
    const hasPartialBlocks = useMemo(() => blocks.some(block => block.isPartial), [blocks]);

    if (blocks.length === 0) {
        // Se nao encontrou blocos estruturados, renderizar como texto markdown
        return (
            <div className="text-block prose prose-invert prose-sm max-w-none text-zinc-200">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                        code({ className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match && !className;

                            if (isInline) {
                                return (
                                    <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono text-pink-400" {...props}>
                                        {children}
                                    </code>
                                );
                            }

                            const lang = match?.[1] || 'text';
                            const codeContent = String(children).replace(/\n$/, '');
                            return <CodeBlockEnhanced content={codeContent} language={lang} />;
                        }
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="structured-blocks-renderer space-y-4" data-streaming={isStreaming || hasPartialBlocks}>
            {blocks.map((block, index) => (
                <div key={stableBlockKey(block, index)} data-partial={block.isPartial ? 'true' : 'false'}>
                    {renderBlock(block)}
                </div>
            ))}
        </div>
    );
}
