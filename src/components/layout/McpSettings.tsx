'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, TestTube, Check, X, Loader2, Server, Power, PowerOff, Pencil, Save } from 'lucide-react';

interface McpServer {
  mcp_id: string;
  mcp_name: string;
  mcp_url: string;
  mcp_api_key: string | null;
  mcp_enabled: boolean;
}

interface McpToolInfo {
  name: string;
  description: string;
}

interface McpSettingsProps {
  onClose: () => void;
}

export default function McpSettings({ onClose }: McpSettingsProps) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; tools?: McpToolInfo[] }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/mcp');
      if (!res.ok) throw new Error('Falha ao buscar servidores');
      const data = await res.json();
      setServers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    setError(null);
    setIsAdding(true);

    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          url: newUrl.trim(),
          api_key: newApiKey.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao adicionar');
      }
      const data = await res.json();
      setServers([data, ...servers]);
      setNewName('');
      setNewUrl('');
      setNewApiKey('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/mcp?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao remover');
      }
      setServers(servers.filter((s) => s.mcp_id !== id));
      // Limpar teste associado
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao remover');
    }
  };

  const handleToggle = async (server: McpServer) => {
    setError(null);
    try {
      const res = await fetch(`/api/mcp?id=${server.mcp_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !server.mcp_enabled }),
      });
      if (!res.ok) throw new Error('Falha ao alternar');
      setServers(servers.map((s) =>
        s.mcp_id === server.mcp_id ? { ...s, mcp_enabled: !s.mcp_enabled } : s
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alternar');
    }
  };

  const handleTest = async (server: McpServer) => {
    setTesting(server.mcp_id);
    setError(null);

    try {
      const res = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: server.mcp_url,
          api_key: server.mcp_api_key,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTestResults((prev) => ({
          ...prev,
          [server.mcp_id]: {
            success: true,
            message: `${data.toolsCount} tools disponíveis`,
            tools: data.tools,
          },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [server.mcp_id]: {
            success: false,
            message: data.error || 'Falha na conexão',
          },
        }));
      }
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [server.mcp_id]: {
          success: false,
          message: err instanceof Error ? err.message : 'Erro ao testar',
        },
      }));
    } finally {
      setTesting(null);
    }
  };

  const startEdit = (server: McpServer) => {
    setEditingId(server.mcp_id);
    setEditName(server.mcp_name);
    setEditUrl(server.mcp_url);
    setEditApiKey(server.mcp_api_key || '');
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditUrl('');
    setEditApiKey('');
  };

  const handleSave = async (id: string) => {
    if (!editName.trim() || !editUrl.trim()) return;
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/mcp?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          url: editUrl.trim(),
          api_key: editApiKey.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Falha ao salvar');
      }

      const data = await res.json();
      setServers(servers.map((s) => (s.mcp_id === id ? data : s)));
      cancelEdit();
      // Limpar teste antigo (a URL pode ter mudado)
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Servidores MCP</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Add new server */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Nome do servidor"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="url"
              placeholder="URL do servidor MCP (ex: https://mcp.exemplo.com/mcp)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="password"
              placeholder="API Key (opcional)"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || !newUrl.trim() || isAdding}
              className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-sm rounded flex items-center justify-center gap-1"
            >
              {isAdding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {isAdding ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>

          {/* Server list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="text-zinc-400 animate-spin" />
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              Nenhum servidor MCP configurado
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => {
                const isEditing = editingId === server.mcp_id;
                const testResult = testResults[server.mcp_id];

                return (
                  <div
                    key={server.mcp_id}
                    className="bg-zinc-900 border border-zinc-800 rounded p-3 space-y-2"
                  >
                    {isEditing ? (
                      /* Edit mode */
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Nome"
                        />
                        <input
                          type="url"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="URL"
                        />
                        <input
                          type="password"
                          value={editApiKey}
                          onChange={(e) => setEditApiKey(e.target.value)}
                          className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="API Key (deixe vazio para manter)"
                        />
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-800 flex items-center gap-1"
                          >
                            <X size={12} /> Cancelar
                          </button>
                          <button
                            onClick={() => handleSave(server.mcp_id)}
                            disabled={saving || !editName.trim() || !editUrl.trim()}
                            className="px-2 py-1 text-xs text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 rounded flex items-center gap-1"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-200">{server.mcp_name}</div>
                            <div className="text-xs text-zinc-500 truncate max-w-xs">{server.mcp_url}</div>
                            {server.mcp_api_key && (
                              <div className="text-xs text-zinc-600">API Key: ••••••••</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggle(server)}
                              className={`p-1.5 rounded ${
                                server.mcp_enabled
                                  ? 'text-green-400 hover:text-green-300 hover:bg-zinc-800'
                                  : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
                              }`}
                              title={server.mcp_enabled ? 'Desativar' : 'Ativar'}
                            >
                              {server.mcp_enabled ? <Power size={14} /> : <PowerOff size={14} />}
                            </button>
                            <button
                              onClick={() => startEdit(server)}
                              className="p-1.5 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800 rounded"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleTest(server)}
                              disabled={testing === server.mcp_id}
                              className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded"
                              title="Testar conexão"
                            >
                              {testing === server.mcp_id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <TestTube size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(server.mcp_id)}
                              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded"
                              title="Remover"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Tool list (shown after successful test) */}
                        {testResult?.success && testResult.tools && testResult.tools.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {testResult.tools.map((tool) => (
                              <span
                                key={tool.name}
                                className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                title={tool.description}
                              >
                                {tool.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Test result */}
                        {testResult && !testResult.tools?.length && (
                          <div
                            className={`text-xs px-2 py-1 rounded ${
                              testResult.success
                                ? 'text-green-400 bg-green-400/10'
                                : 'text-red-400 bg-red-400/10'
                            }`}
                          >
                            {testResult.success ? <Check size={10} className="inline mr-1" /> : null}
                            {testResult.message}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-500">
          MCP (Model Context Protocol) permite conectar servidores externos para expandir as ferramentas disponíveis.
        </div>
      </div>
    </div>
  );
}
