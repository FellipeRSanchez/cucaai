import { Table as TableIcon } from 'lucide-react';

interface TableBlockProps {
    content: string;
}

export function TableBlock({ content }: TableBlockProps) {
    // Parse do conteúdo como markdown table
    const lines = content.trim().split('\n');
    const hasHeader = lines.length > 1 && lines[1].includes('|');

    const parseRow = (line: string) =>
        line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');

    const headers = hasHeader ? parseRow(lines[0]) : [];
    const rows = hasHeader ? lines.slice(2).map(parseRow) : lines.map(parseRow);

    return (
        <div className="table-block my-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                <TableIcon size={16} className="text-zinc-400" />
                <span className="text-xs font-medium text-zinc-300">Dados Estruturados</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        {headers.length > 0 && (
                            <tr className="bg-zinc-800/30 border-b border-zinc-800">
                                {headers.map((header, i) => (
                                    <th key={i} className="px-4 py-2 text-left text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {(hasHeader ? rows : lines.map(parseRow)).map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                className={rowIndex % 2 === 0 ? 'bg-zinc-900/20' : 'bg-zinc-800/10'}
                            >
                                {row.map((cell: string, cellIndex: number) => (
                                    <td key={cellIndex} className="px-4 py-2 text-sm text-zinc-300 border-b border-zinc-800/50 last:border-0">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}