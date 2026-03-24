import { ReactElement } from 'react';

export interface BlockData {
    type: 'analysis' | 'table' | 'code' | 'chart' | 'insight' | 'warning' | 'summary' | 'text';
    content: string;
    chartType?: 'bar' | 'line' | 'pie' | 'area';
    language?: string;
}

// Padrões de detecção de blocos
const BLOCK_PATTERNS = {
    analysis: /<analysis>([\s\S]*?)<\/analysis>/gi,
    table: /<table>([\s\S]*?)<\/table>/gi,
    code: /<code(?:\s+language="([^"]*)")?>([\s\S]*?)<\/code>/gi,
    chart: /<chart\s+type="(bar|line|pie|area)">([\s\S]*?)<\/chart>/gi,
    insight: /<insight>([\s\S]*?)<\/insight>/gi,
    warning: /<warning>([\s\S]*?)<\/warning>/gi,
    summary: /<summary>([\s\S]*?)<\/summary>/gi,
};

// Markdown-style patterns (alternativos)
const MD_BLOCK_PATTERNS = {
    analysis: /```analysis\n([\s\S]*?)\n```/gi,
    table: /```table\n([\s\S]*?)\n```/gi,
    code: /```(\w+)?\n([\s\S]*?)\n```/gi,
    chart: /```chart:(bar|line|pie|area)\n([\s\S]*?)\n```/gi,
    insight: /```insight\n([\s\S]*?)\n```/gi,
    warning: /```warning\n([\s\S]*?)\n```/gi,
    summary: /```summary\n([\s\S]*?)\n```/gi,
};

function parseBlocks(text: string): BlockData[] {
    const blocks: BlockData[] = [];
    let remainingText = text;

    // Primeiro, extrair blocos especiais
    for (const [type, pattern] of Object.entries(BLOCK_PATTERNS)) {
        const matches = [...remainingText.matchAll(pattern)];

        for (const match of matches) {
            const [fullMatch, ...groups] = match;
            const index = remainingText.indexOf(fullMatch);

            // Adicionar texto anterior se houver
            if (index > 0) {
                const precedingText = remainingText.substring(0, index).trim();
                if (precedingText) {
                    blocks.push({ type: 'text', content: precedingText });
                }
            }

            // Adicionar bloco
            let blockContent: BlockData;

            if (type === 'code') {
                const language = groups[0] || 'text';
                const codeContent = groups[1] || groups[0] || '';
                blockContent = { type: 'code', content: codeContent.trim(), language };
            } else if (type === 'chart') {
                const chartType = groups[0] as 'bar' | 'line' | 'pie' | 'area';
                const chartData = groups[1] || groups[0] || '';
                blockContent = { type: 'chart', content: chartData.trim(), chartType };
            } else {
                blockContent = { type: type as BlockData['type'], content: match[1] || match[0] || '' };
            }

            blocks.push(blockContent);

            // Remover bloco processado do texto
            remainingText = remainingText.substring(index + fullMatch.length);
        }
    }

    // Adicionar texto final restante
    if (remainingText.trim()) {
        const unclosedXmlCode = remainingText.match(/<code(?:\s+language="([^"]*)")?>([\s\S]*)$/i);
        const unclosedXmlChart = remainingText.match(/<chart\s+type="(bar|line|pie|area)">([\s\S]*)$/i);
        const unclosedXmlMatch = remainingText.match(/<(analysis|table|insight|warning|summary)(?:[^>]*)>([\s\S]*)$/i);

        if (unclosedXmlCode) {
            const preceding = remainingText.substring(0, unclosedXmlCode.index).trim();
            if (preceding) blocks.push({ type: 'text', content: preceding });
            blocks.push({ type: 'code', content: unclosedXmlCode[2], language: unclosedXmlCode[1] || 'text' });
        } else if (unclosedXmlChart) {
            const preceding = remainingText.substring(0, unclosedXmlChart.index).trim();
            if (preceding) blocks.push({ type: 'text', content: preceding });
            const typeExtracted = unclosedXmlChart[1];
            blocks.push({ type: 'chart', content: unclosedXmlChart[2], chartType: (typeExtracted as any) });
        } else if (unclosedXmlMatch) {
            const preceding = remainingText.substring(0, unclosedXmlMatch.index).trim();
            if (preceding) blocks.push({ type: 'text', content: preceding });
            blocks.push({ type: unclosedXmlMatch[1].toLowerCase() as any, content: unclosedXmlMatch[2] });
        } else {
            blocks.push({ type: 'text', content: remainingText.trim() });
        }
    }

    // Se não encontrou blocos XML-style, tentar markdown-style
    if (blocks.length <= 1 && blocks[0]?.type === 'text') {
        return parseMarkdownBlocks(text);
    }

    return blocks;
}

function parseMarkdownBlocks(text: string): BlockData[] {
    const blocks: BlockData[] = [];
    let remainingText = text;

    for (const [type, pattern] of Object.entries(MD_BLOCK_PATTERNS)) {
        const matches = [...remainingText.matchAll(pattern)];

        for (const match of matches) {
            const [fullMatch, ...groups] = match;
            const index = remainingText.indexOf(fullMatch);

            if (index > 0) {
                const precedingText = remainingText.substring(0, index).trim();
                if (precedingText) {
                    blocks.push({ type: 'text', content: precedingText });
                }
            }

            let blockContent: BlockData;

            if (type === 'code') {
                const language = groups[0] || 'text';
                const codeContent = match[2] || match[1] || '';
                blockContent = { type: 'code', content: codeContent.trim(), language };
            } else if (type === 'chart') {
                const chartType = groups[0] as 'bar' | 'line' | 'pie' | 'area';
                const chartData = groups[1] || groups[0] || '';
                blockContent = { type: 'chart', content: chartData.trim(), chartType };
            } else {
                blockContent = { type: type as BlockData['type'], content: match[1] || match[0] || '' };
            }

            blocks.push(blockContent);
            remainingText = remainingText.substring(index + fullMatch.length);
        }
    }

    if (remainingText.trim()) {
        const unclosedMd = remainingText.match(/```([a-z0-9\-:]+)?\n([\s\S]*)$/i);
        if (unclosedMd) {
            const preceding = remainingText.substring(0, unclosedMd.index).trim();
            if (preceding) blocks.push({ type: 'text', content: preceding });
            
            const typeStr = (unclosedMd[1] || '').toLowerCase();
            let type: BlockData['type'] = 'code';
            let language = 'text';
            let chartType: any = undefined;

            if (typeStr === 'analysis' || typeStr === 'table' || typeStr === 'insight' || typeStr === 'warning' || typeStr === 'summary') {
                type = typeStr as any;
            } else if (typeStr.startsWith('chart:')) {
                type = 'chart';
                chartType = typeStr.split(':')[1] || 'line';
            } else {
                language = typeStr || 'text';
            }

            blocks.push({ type, content: unclosedMd[2], language, chartType });
        } else {
            blocks.push({ type: 'text', content: remainingText.trim() });
        }
    }

    return blocks;
}

export function parseStructuredBlocks(text: string): BlockData[] {
    const trimmedText = text.trim();
    if (!trimmedText) return [];

    const blocks = parseBlocks(trimmedText);

    // Mesclar blocos de texto consecutivos
    const mergedBlocks: BlockData[] = [];
    for (const block of blocks) {
        if (block.type === 'text' && mergedBlocks.length > 0 && mergedBlocks[mergedBlocks.length - 1].type === 'text') {
            mergedBlocks[mergedBlocks.length - 1].content += '\n\n' + block.content;
        } else {
            mergedBlocks.push(block);
        }
    }

    return mergedBlocks;
}

// Utility para converter CSV/JSON para tabela
export function parseTableData(content: string): string[][] {
    const lines = content.trim().split('\n');
    return lines.map(line =>
        line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
    );
}

// Utility para parsear dados de gráfico (JSON ou CSV simples)
export function parseChartData(content: string): any[] {
    try {
        // Tentar JSON primeiro
        if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
            const json = JSON.parse(content);
            return Array.isArray(json) ? json : [json];
        }

        // CSV simples: coluna1, coluna2\nvalor1, valor2
        const lines = content.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: any = {};
            headers.forEach((header, idx) => {
                const value = values[idx];
                obj[header] = isNaN(Number(value)) ? value : Number(value);
            });
            return obj;
        });
    } catch {
        console.warn('Failed to parse chart data, returning empty array');
        return [];
    }
}