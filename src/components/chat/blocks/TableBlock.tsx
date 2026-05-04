import { Table as TableIcon } from 'lucide-react';

interface TableBlockProps {
    content: string;
}

// Função para parsear linha de tabela markdown com suporte a alinhamento e pipes escapados
function parseMarkdownTableLine(line: string): string[] {
    // Remove pipes iniciais e finais se existirem
    const cleaned = line.trim().startsWith('|') ? line.trim().slice(1) : line.trim();
    const cleanedEnd = cleaned.endsWith('|') ? cleaned.slice(0, -1) : cleaned;
    
    // Divide por pipes que não estão escapados
    const cells: string[] = [];
    let current = '';
    let escaped = false;
    
    for (let i = 0; i < cleanedEnd.length; i++) {
        const char = cleanedEnd[i];
        
        if (char === '\\' && !escaped) {
            escaped = true;
            continue;
        }
        
        if (char === '|' && !escaped) {
            cells.push(current.trim());
            current = '';
        } else {
            current += char;
            escaped = false;
        }
    }
    
    // Adiciona a última célula
    cells.push(current.trim());
    
    return cells;
}

// Função para detectar alinhamento das colunas da linha de separador
function parseAlignment(separatorLine: string): ('left' | 'center' | 'right')[] {
    const cells = parseMarkdownTableLine(separatorLine);
    return cells.map(cell => {
        // Remove os dois pontos e traços para verificar o padrão
        const trimmed = cell.trim();
        if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
            return 'center';
        } else if (trimmed.startsWith(':')) {
            return 'left';
        } else if (trimmed.endsWith(':')) {
            return 'right';
        } else {
            return 'left'; // padrão
        }
    });
}

export function TableBlock({ content }: TableBlockProps) {
    // Parse do conteúdo como markdown table
    const lines = content.trim().split('\n');
    
    // Verifica se é uma tabela válida (pelo menos 2 linhas e segunda linha contém |)
    const hasHeader = lines.length >= 2 && lines[1].trim().includes('|');
    
    let headers: string[] = [];
    let alignment: ('left' | 'center' | 'right')[] = [];
    let dataRows: string[][] = [];
    
    if (hasHeader) {
        // Primeira linha é o cabeçalho
        headers = parseMarkdownTableLine(lines[0]);
        
        // Segunda linha é o separador (define alinhamento)
        alignment = parseAlignment(lines[1]);
        
        // Garantir que o alinhamento tenha o mesmo tamanho que os cabeçalhos
        while (alignment.length < headers.length) {
            alignment.push('left');
        }
        if (alignment.length > headers.length) {
            alignment.splice(headers.length);
        }
        
        // Linhas de dados (a partir da terceira linha)
        dataRows = lines.slice(2).map(parseMarkdownTableLine);
    } else {
        // Não tem cabeçalho, todas são linhas de dados
        dataRows = lines.map(parseMarkdownTableLine);
        // Alinhamento padrão para todas as colunas
        if (dataRows.length > 0) {
            alignment = Array(dataRows[0].length).fill('left');
        }
    }

    return (
        <div className="table-block my-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                <TableIcon size={16} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-300">Dados Estruturados</span>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-800">
                    <thead>
                        {headers.length > 0 && (
                            <tr className="bg-zinc-800">
                                {headers.map((header, i) => {
                                    const align = alignment[i] || 'left';
                                    const alignClass =
                                        align === 'center' ? 'text-center' :
                                        align === 'right' ? 'text-right' :
                                        'text-left';
                                    
                                    return (
                                        <th
                                            key={i}
                                            className={`px-4 py-3 text-left text-xs font-semibold text-zinc-100 uppercase tracking-wider ${alignClass}`}
                                        >
                                            {header}
                                        </th>
                                    );
                                })}
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {dataRows.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={rowIndex % 2 === 0 ? 'bg-zinc-900/50' : 'bg-zinc-800/50'}
                            >
                                {row.map((cell: string, cellIndex: number) => {
                                    const align = alignment[cellIndex] || 'left';
                                    const alignClass =
                                        align === 'center' ? 'text-center' :
                                        align === 'right' ? 'text-right' :
                                        'text-left';
                                    
                                    return (
                                        <td
                                            key={cellIndex}
                                            className={`px-4 py-3 text-sm text-zinc-200 ${alignClass}`}
                                        >
                                            {cell}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}