import { ReactElement } from 'react';
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
}

function renderBlock(block: BlockData): ReactElement | null {
    switch (block.type) {
        case 'analysis':
            return <AnalysisBlock key={`block-${Date.now()}`} content={block.content} />;
        case 'table':
            return <TableBlock key={`block-${Date.now()}`} content={block.content} />;
        case 'code':
            return <CodeBlockEnhanced key={`block-${Date.now()}`} content={block.content} language={block.language} />;
        case 'chart':
            return <ChartBlock key={`block-${Date.now()}`} content={block.content} chartType={block.chartType || 'bar'} />;
        case 'insight':
            return <InsightBlock key={`block-${Date.now()}`} content={block.content} />;
        case 'warning':
            return <WarningBlock key={`block-${Date.now()}`} content={block.content} />;
        case 'summary':
            return <SummaryBlock key={`block-${Date.now()}`} content={block.content} />;
        case 'text':
            return (
                <div key={`block-${Date.now()}`} className="text-block prose prose-invert prose-sm max-w-none text-zinc-200">
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

                                // For regular code blocks, just render as pre/code (will be styled by highlight.js)
                                return (
                                    <pre className="rounded-lg bg-zinc-800/50 p-4 overflow-x-auto border border-zinc-700">
                                        <code className={className}>{children}</code>
                                    </pre>
                                );
                            }
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

export function StructuredBlocksRenderer({ content }: StructuredBlocksRendererProps) {
    const blocks = parseStructuredBlocks(content);

    if (blocks.length === 0) {
        // Se não encontrou blocos estruturados, renderizar como texto markdown
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

                            return (
                                <pre className="rounded-lg bg-zinc-800/50 p-4 overflow-x-auto border border-zinc-700">
                                    <code className={className}>{children}</code>
                                </pre>
                            );
                        }
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="structured-blocks-renderer space-y-4">
            {blocks.map((block, index) => (
                <div key={`block-${index}`}>
                    {renderBlock(block)}
                </div>
            ))}
        </div>
    );
}
