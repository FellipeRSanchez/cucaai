import { Client } from '@modelcontextprotocol/sdk/client';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { tool } from 'ai';
import { z } from 'zod';

export interface McpServerConfig {
  mcp_id: string;
  mcp_usuario_id: string;
  mcp_name: string;
  mcp_url: string;
  mcp_api_key: string | null;
  mcp_enabled: boolean;
  mcp_criado_em: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Extract a clean server name from a URL for use as tool namespace.
 * e.g. "https://mcp.example.com/v1" → "example"
 */
function extractServerName(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove 'mcp.' prefix if present, then take first segment of hostname
    let host = parsed.hostname.replace(/^mcp\./, '');
    const segment = host.split('.')[0];
    // Sanitize: only alphanumeric and underscores
    return segment.replace(/[^a-zA-Z0-9]/g, '_') || 'server';
  } catch {
    return 'server';
  }
}

/**
 * Connect to an MCP server. Creates a fresh connection per call (serverless-safe).
 */
export async function connectToMcpServer(url: string, apiKey?: string | null): Promise<Client> {
  const client = new Client(
    { name: 'cuca-ai', version: '1.0.0' },
    { capabilities: {} }
  );

  const requestInit: RequestInit = {};
  if (apiKey) {
    requestInit.headers = {
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit,
  });
  await client.connect(transport);

  return client;
}

/**
 * List tools from an MCP server.
 */
export async function listMcpTools(url: string, apiKey?: string | null): Promise<McpTool[]> {
  let client: Client | null = null;
  try {
    client = await connectToMcpServer(url, apiKey);
    const response = await client.listTools();

    return response.tools.map((t) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  } catch (err) {
    console.error(`[MCP] Error listing tools from ${url}:`, err);
    return [];
  } finally {
    client?.close().catch(() => {});
  }
}

/**
 * Call a tool on an MCP server.
 */
export async function callMcpTool(
  url: string,
  toolName: string,
  args: Record<string, unknown>,
  apiKey?: string | null
): Promise<unknown> {
  let client: Client | null = null;
  try {
    client = await connectToMcpServer(url, apiKey);
    const result = await client.callTool({ name: toolName, arguments: args });
    return result.content;
  } catch (err) {
    console.error(`[MCP] Error calling tool ${toolName} on ${url}:`, err);
    throw err;
  } finally {
    client?.close().catch(() => {});
  }
}

/**
 * Recursively convert a JSON Schema definition to a Zod type.
 */
function jsonSchemaToZod(schema: Record<string, unknown>, requiredFields: string[]): z.ZodTypeAny {
  const type = schema.type as string | undefined;

  // Handle enum
  if (schema.enum && Array.isArray(schema.enum)) {
    return z.enum(schema.enum as [string, ...string[]]);
  }

  // Handle anyOf / oneOf (take first variant as fallback)
  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf || schema.oneOf) as Record<string, unknown>[];
    const zodVariants = variants.map((v) => jsonSchemaToZod(v, requiredFields));
    if (zodVariants.length === 1) return zodVariants[0];
    return z.union(zodVariants as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
  }

  switch (type) {
    case 'string':
      return z.string();
    case 'number':
    case 'integer':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array': {
      const items = schema.items as Record<string, unknown> | undefined;
      if (items) {
        return z.array(jsonSchemaToZod(items, requiredFields));
      }
      return z.array(z.unknown());
    }
    case 'object': {
      const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
      const objRequired = (schema.required as string[]) || [];
      const shape: Record<string, z.ZodTypeAny> = {};

      for (const [key, propSchema] of Object.entries(properties)) {
        let fieldZod = jsonSchemaToZod(propSchema, objRequired);
        if (propSchema.description) {
          fieldZod = fieldZod.describe(propSchema.description as string);
        }
        if (!objRequired.includes(key)) {
          fieldZod = fieldZod.optional();
        }
        shape[key] = fieldZod;
      }

      return z.object(shape).passthrough();
    }
    case 'null':
      return z.null();
    default:
      // Unknown type — use z.unknown() as safe fallback
      return z.unknown();
  }
}

/**
 * Convert MCP tools to Vercel AI SDK tool format with server-namespaced keys.
 *
 * Tool names follow the pattern: mcp_{serverName}_{toolName}
 * This prevents collisions when multiple MCP servers expose tools with the same name.
 */
export function mcpToolsToAiSdk(
  mcpTools: McpTool[],
  serverUrl: string,
  serverName?: string
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  const namespace = serverName || extractServerName(serverUrl);

  for (const mcpTool of mcpTools) {
    // Namespace: mcp_{server}_{tool} — prevents collisions between servers
    const toolKey = `mcp_${namespace}_${mcpTool.name}`;

    const requiredFields = (mcpTool.inputSchema.required as string[]) || [];
    const properties = (mcpTool.inputSchema.properties || {}) as Record<string, Record<string, unknown>>;

    // Build Zod schema from JSON Schema properties
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      let fieldZod = jsonSchemaToZod(propSchema, requiredFields);
      if (propSchema.description) {
        fieldZod = fieldZod.describe(propSchema.description as string);
      }
      if (!requiredFields.includes(key)) {
        fieldZod = fieldZod.optional();
      }
      shape[key] = fieldZod;
    }

    const paramSchema = Object.keys(shape).length > 0
      ? z.object(shape)
      : z.object({}).passthrough();

    tools[toolKey] = tool({
      description: `[MCP → ${namespace}] ${mcpTool.description}`,
      parameters: paramSchema,
      execute: async (args: Record<string, unknown>) => {
        const result = await callMcpTool(serverUrl, mcpTool.name, args, null);
        // Return MCP content directly — the AI SDK handles serialization
        return result;
      },
    });
  }

  return tools;
}

/**
 * Extract a list of MCP tool summaries for system prompt injection.
 */
export function getMcpToolSummaries(
  mcpTools: McpTool[],
  serverUrl: string,
  serverName?: string
): Array<{ key: string; name: string; description: string }> {
  const namespace = serverName || extractServerName(serverUrl);
  return mcpTools.map((t) => ({
    key: `mcp_${namespace}_${t.name}`,
    name: t.name,
    description: t.description,
  }));
}
