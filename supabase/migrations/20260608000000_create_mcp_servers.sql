-- Create MCP servers table
CREATE TABLE IF NOT EXISTS cuca.mcp_servers (
  mcp_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mcp_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mcp_name TEXT NOT NULL,
  mcp_url TEXT NOT NULL,
  mcp_api_key TEXT,
  mcp_enabled BOOLEAN DEFAULT true,
  mcp_criado_em TIMESTAMPTZ DEFAULT now(),
  mcp_atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE cuca.mcp_servers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own MCP servers"
  ON cuca.mcp_servers FOR SELECT
  USING (auth.uid() = mcp_usuario_id);

CREATE POLICY "Users can insert their own MCP servers"
  ON cuca.mcp_servers FOR INSERT
  WITH CHECK (auth.uid() = mcp_usuario_id);

CREATE POLICY "Users can update their own MCP servers"
  ON cuca.mcp_servers FOR UPDATE
  USING (auth.uid() = mcp_usuario_id);

CREATE POLICY "Users can delete their own MCP servers"
  ON cuca.mcp_servers FOR DELETE
  USING (auth.uid() = mcp_usuario_id);

-- Create index for faster lookups
CREATE INDEX idx_mcp_servers_usuario_id ON cuca.mcp_servers(mcp_usuario_id);
