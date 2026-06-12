export interface BlockData {
    type: 'analysis' | 'table' | 'code' | 'chart' | 'insight' | 'warning' | 'summary' | 'text';
    content: string;
    chartType?: 'bar' | 'line' | 'pie' | 'area';
    language?: string;
    isPartial?: boolean;
}

function parseBlocks(text: string): BlockData[] {
    const xmlBlocks = parseXmlBlocksIncremental(text);

    // Se nao encontrou blocos XML-style, tentar markdown-style
    if (xmlBlocks.length <= 1 && xmlBlocks[0]?.type === 'text') {
        return parseMarkdownBlocks(text);
    }

    return xmlBlocks;
}

function parseXmlBlocksIncremental(text: string): BlockData[] {
    const blocks: BlockData[] = [];
    const openTagRegex = /<(analysis|table|code|chart|insight|warning|summary)([^>]*)>/gi;

    let cursor = 0;

    while (cursor < text.length) {
        openTagRegex.lastIndex = cursor;
        const openMatch = openTagRegex.exec(text);

        if (!openMatch) {
            const trailingText = text.slice(cursor);
            if (trailingText.trim()) {
                blocks.push({ type: 'text', content: trailingText.trim() });
            }
            break;
        }

        const fullOpenTag = openMatch[0];
        const rawType = (openMatch[1] || '').toLowerCase() as BlockData['type'];
        const rawAttrs = openMatch[2] || '';
        const openStart = openMatch.index;
        const openEnd = openStart + fullOpenTag.length;

        // Bug #5 Fix: Skip code/table tags without attributes (likely HTML in normal text)
        if ((rawType === 'code' || rawType === 'table') && !rawAttrs.trim()) {
            cursor = openEnd;
            continue;
        }

        if (openStart > cursor) {
            const before = text.slice(cursor, openStart);
            if (before.trim()) {
                blocks.push({ type: 'text', content: before.trim() });
            }
        }

        const closeTag = `</${rawType}>`;
        const closeStart = text.toLowerCase().indexOf(closeTag, openEnd);
        const isClosed = closeStart >= 0;
        const contentEnd = isClosed ? closeStart : text.length;
        const blockContent = text.slice(openEnd, contentEnd);

        if (rawType === 'code') {
            const languageMatch = rawAttrs.match(/language="([^"]*)"/i);
            blocks.push({
                type: 'code',
                content: blockContent,
                language: languageMatch?.[1] || 'text',
                isPartial: !isClosed,
            });
        } else if (rawType === 'chart') {
            const chartTypeMatch = rawAttrs.match(/type="(bar|line|pie|area)"/i);
            blocks.push({
                type: 'chart',
                content: blockContent,
                chartType: (chartTypeMatch?.[1] as BlockData['chartType']) || 'bar',
                isPartial: !isClosed,
            });
        } else {
            blocks.push({
                type: rawType,
                content: blockContent,
                isPartial: !isClosed,
            });
        }

        if (!isClosed) {
            const afterBlock = text.slice(contentEnd);
            if (afterBlock.trim()) {
                blocks.push({ type: 'text', content: afterBlock.trim() });
            }
            break;
        }

        cursor = closeStart + closeTag.length;
    }

    return blocks;
}

function parseMarkdownBlocks(text: string): BlockData[] {
    const blocks: BlockData[] = [];
    // Bug #1 Fix: Make \n optional so we detect fences during streaming
    const openFenceRegex = /```([a-z0-9\-:]+)?(\n|$)/gi;
    let cursor = 0;

    while (cursor < text.length) {
        openFenceRegex.lastIndex = cursor;
        const openMatch = openFenceRegex.exec(text);

        if (!openMatch) {
            const trailingText = text.slice(cursor);
            if (trailingText.trim()) {
                blocks.push({ type: 'text', content: trailingText.trim() });
            }
            break;
        }

        const fullOpenFence = openMatch[0];
        const rawFenceType = (openMatch[1] || '').toLowerCase();
        const openStart = openMatch.index;
        const openEnd = openStart + fullOpenFence.length;

        if (openStart > cursor) {
            const before = text.slice(cursor, openStart);
            if (before.trim()) {
                blocks.push({ type: 'text', content: before.trim() });
            }
        }

        // Bug #2 Fix: Ensure close fence is on its own line
        // Search for \n``` followed by \n or end of string
        const closeStart = text.indexOf('\n```', openEnd);
        let isClosed = false;
        let contentEnd = text.length;

        if (closeStart >= 0) {
            const afterClose = closeStart + '\n```'.length;
            if (afterClose === text.length || text[afterClose] === '\n') {
                isClosed = true;
                contentEnd = closeStart;
            }
        }

        const blockContent = text.slice(openEnd, contentEnd);

        let type: BlockData['type'] = 'code';
        let language = 'text';
        let chartType: BlockData['chartType'] | undefined;

        if (
            rawFenceType === 'analysis' ||
            rawFenceType === 'table' ||
            rawFenceType === 'insight' ||
            rawFenceType === 'warning' ||
            rawFenceType === 'summary'
        ) {
            type = rawFenceType as BlockData['type'];
        } else if (rawFenceType.startsWith('chart:')) {
            type = 'chart';
            const parsedChartType = rawFenceType.split(':')[1] as BlockData['chartType'];
            chartType = parsedChartType || 'line';
        } else {
            language = rawFenceType || 'text';
        }

        blocks.push({
            type,
            content: blockContent,
            language,
            chartType,
            isPartial: !isClosed,
        });

        // Bug #4 Fix: Instead of silently dropping all text after a partial block,
        // push any remaining text as a text block
        if (!isClosed) {
            const afterBlock = text.slice(contentEnd);
            if (afterBlock.trim()) {
                blocks.push({ type: 'text', content: afterBlock.trim() });
            }
            break;
        }

        // Bug #3 Fix: Advance cursor by 5 chars (\n```\n) instead of 4 (\n```)
        cursor = closeStart + '\n```\n'.length;
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

// Utility para parsear dados de grafico (JSON ou CSV simples)
export function parseChartData(content: string): Array<Record<string, unknown>> {
    try {
        // Tentar JSON primeiro
        if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
            const json = JSON.parse(content);
            if (Array.isArray(json)) {
                return json as Array<Record<string, unknown>>;
            }

            if (json && typeof json === 'object') {
                return [json as Record<string, unknown>];
            }

            return [];
        }

        // CSV simples: coluna1, coluna2\nvalor1, valor2
        const lines = content.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: Record<string, string | number | null> = {};
            headers.forEach((header, idx) => {
                const value = values[idx];
                if (value === undefined || value === '') {
                    obj[header] = null;
                    return;
                }

                const numericValue = Number(value);
                obj[header] = Number.isNaN(numericValue) ? value : numericValue;
            });
            return obj;
        });
    } catch {
        console.warn('Failed to parse chart data, returning empty array');
        return [];
    }
}
