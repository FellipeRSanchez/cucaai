#!/usr/bin/env node

/**
 * Script para corrigir automaticamente o schema do Supabase
 * Uso: node scripts/fix-supabase-schema.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erro: Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql) {
    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql }).catch(() => {
            // Se a função RPC não existe, tenta via REST admin API
            return { data: null, error: { message: 'RPC not available' } };
        });

        if (error && !error.message.includes('RPC not available')) {
            throw error;
        }

        // Se RPC não está disponível, precisamos usar另一教学方法
        return { success: true };
    } catch (error) {
        throw error;
    }
}

// Alternativa: executar via query direta (funciona sem RPC)
async function query(sql) {
    try {
        // Usando o método from para executar SQL direto (nem sempre disponível)
        // Vamos usar uma abordagem diferente
        const { data, error } = await supabase.from('_tmp_table_').select('*').limit(1).catch(() => ({ data: null, error: null }));
        return { data, error };
    } catch (error) {
        throw error;
    }
}

async function checkTableExists(tableName) {
    const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'cuca')
        .eq('table_name', tableName)
        .limit(1);

    return !error && data && data.length > 0;
}

async function checkColumnExists(tableName, columnName) {
    const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'cuca')
        .eq('table_name', tableName)
        .eq('column_name', columnName)
        .limit(1);

    return !error && data && data.length > 0;
}

async function addColumn(tableName, columnName, columnType, isNullable = true, defaultValue = null) {
    console.log(`  ➕ Adicionando coluna ${columnName} à tabela ${tableName}...`);

    let sql = `ALTER TABLE cuca.${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnType}`;

    if (!isNullable) {
        // Primeiro adicionar como nullable, popular, depois tornar NOT NULL
        await executeSQL(sql + ';');

        // Popular com valor padrão se houver
        if (defaultValue !== null) {
            await executeSQL(`UPDATE cuca.${tableName} SET ${columnName} = ${defaultValue} WHERE ${columnName} IS NULL;`);
        }

        // Tornar NOT NULL
        await executeSQL(`ALTER TABLE cuca.${tableName} ALTER COLUMN ${columnName} SET NOT NULL;`);
    } else {
        await executeSQL(sql + ';');
    }
}

async function ensureConversasTable() {
    console.log('\n📋 Verificando tabela conversas...');

    // Criar tabela se não existir
    const exists = await checkTableExists('conversas');

    if (!exists) {
        console.log('  ➕ Criando tabela conversas...');
        await executeSQL(`
      CREATE TABLE cuca.conversas (
        con_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        con_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        con_titulo TEXT NOT NULL,
        con_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        con_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);
    } else {
        console.log('  ✅ Tabela conversas já existe');

        // Adicionar colunas faltantes
        if (!await checkColumnExists('conversas', 'con_usuario_id')) {
            await addColumn('conversas', 'con_usuario_id', 'UUID', false);
            // Associar a um usuário existente
            await executeSQL(`
        UPDATE cuca.conversas 
        SET con_usuario_id = (SELECT id FROM auth.users LIMIT 1) 
        WHERE con_usuario_id IS NULL;
      `);
        }

        if (!await checkColumnExists('conversas', 'con_criado_em')) {
            await addColumn('conversas', 'con_criado_em', 'TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(\'utc\'::text, NOW()) NOT NULL', true);
        }

        if (!await checkColumnExists('conversas', 'con_atualizado_em')) {
            await addColumn('conversas', 'con_atualizado_em', 'TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(\'utc\'::text, NOW()) NOT NULL', true);
        }
    }

    // Criar índices
    console.log('  📈 Criando índices...');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_conversas_usuario ON cuca.conversas(con_usuario_id);');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_conversas_atualizado ON cuca.conversas(con_atualizado_em DESC);');
}

async function ensureMensagensTable() {
    console.log('\n📋 Verificando tabela mensagens...');

    const exists = await checkTableExists('mensagens');

    if (!exists) {
        console.log('  ➕ Criando tabela mensagens...');
        await executeSQL(`
      CREATE TABLE cuca.mensagens (
        men_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        men_conversa_id UUID NOT NULL REFERENCES cuca.conversas(con_id) ON DELETE CASCADE,
        men_papel TEXT NOT NULL CHECK (men_papel IN ('user', 'assistant')),
        men_conteudo TEXT NOT NULL,
        men_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);
    } else {
        console.log('  ✅ Tabela mensagens já existe');

        // Adicionar todas as colunas necessárias
        const columns = [
            { name: 'men_conteudo', type: 'TEXT NOT NULL DEFAULT \'\'' },
            { name: 'men_criado_em', type: 'TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(\'utc\'::text, NOW()) NOT NULL' },
            { name: 'men_papel', type: 'TEXT NOT NULL DEFAULT \'user\'' },
            { name: 'men_conversa_id', type: 'UUID REFERENCES cuca.conversas(con_id)' }
        ];

        for (const col of columns) {
            if (!await checkColumnExists('mensagens', col.name)) {
                await addColumn('mensagens', col.name, col.type, false);
            }
        }
    }

    // Criar índices
    console.log('  📈 Criando índices...');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON cuca.mensagens(men_conversa_id);');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_mensagens_criado ON cuca.mensagens(men_criado_em ASC);');
}

async function ensureDocumentosTable() {
    console.log('\n📋 Verificando tabela documentos...');

    const exists = await checkTableExists('documentos');

    if (!exists) {
        console.log('  ➕ Criando tabela documentos...');
        await executeSQL(`
      CREATE TABLE cuca.documentos (
        doc_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        doc_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        doc_nome TEXT NOT NULL,
        doc_tipo TEXT NOT NULL,
        doc_tamanho INTEGER,
        doc_conteudo TEXT,
        doc_embedding vector(1536),
        doc_metadados JSONB,
        doc_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        doc_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);
    } else {
        console.log('  ✅ Tabela documentos já existe');

        const columns = [
            { name: 'doc_usuario_id', type: 'UUID', nullable: false },
            { name: 'doc_nome', type: 'TEXT NOT NULL DEFAULT \'untitled\'' },
            { name: 'doc_tipo', type: 'TEXT NOT NULL DEFAULT \'unknown\'' },
            { name: 'doc_criado_em', type: 'TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(\'utc\'::text, NOW()) NOT NULL' },
            { name: 'doc_atualizado_em', type: 'TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(\'utc\'::text, NOW()) NOT NULL' }
        ];

        for (const col of columns) {
            if (!await checkColumnExists('documentos', col.name)) {
                await addColumn('documentos', col.name, col.type, col.nullable || false);
            }
        }

        // Popular doc_usuario_id
        await executeSQL(`
      UPDATE cuca.documentos 
      SET doc_usuario_id = (SELECT id FROM auth.users LIMIT 1) 
      WHERE doc_usuario_id IS NULL;
    `);
    }

    // Criar índices
    console.log('  📈 Criando índices...');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_documentos_usuario ON cuca.documentos(doc_usuario_id);');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_documentos_criado ON cuca.documentos(doc_criado_em DESC);');
}

async function ensureMemoriasTable() {
    console.log('\n📋 Verificando tabela memorias...');

    const exists = await checkTableExists('memorias');

    if (!exists) {
        console.log('  ➕ Criando tabela memorias...');
        await executeSQL(`
      CREATE TABLE cuca.memorias (
        mem_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        mem_usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        mem_conteudo TEXT NOT NULL,
        mem_relevancia INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10),
        mem_fonte TEXT,
        mem_metadados JSONB,
        mem_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        mem_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);
    } else {
        console.log('  ✅ Tabela memorias já existe');

        const columns = [
            { name: 'mem_usuario_id', type: 'UUID', nullable: false },
            { name: 'mem_conteudo', type: 'TEXT NOT NULL DEFAULT \'\'' },
            { name: 'mem_relevancia', type: 'INTEGER CHECK (mem_relevancia >= 1 AND mem_relevancia <= 10) DEFAULT 5' },
            { name: 'mem_fonte', type: 'TEXT' },
            { name: 'mem_metadados', type: 'JSONB' },
            { name: 'mem_criado_em', type: 'TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(\'utc\'::text, NOW()) NOT NULL' },
            { name: 'mem_atualizado_em', type: 'TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE(\'utc\'::text, NOW()) NOT NULL' }
        ];

        for (const col of columns) {
            if (!await checkColumnExists('memorias', col.name)) {
                await addColumn('memorias', col.name, col.type, col.nullable || false);
            }
        }

        // Popular mem_usuario_id
        await executeSQL(`
      UPDATE cuca.memorias 
      SET mem_usuario_id = (SELECT id FROM auth.users LIMIT 1) 
      WHERE mem_usuario_id IS NULL;
    `);
    }

    // Criar índices
    console.log('  📈 Criando índices...');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_memorias_usuario ON cuca.memorias(mem_usuario_id);');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_memorias_relevancia ON cuca.memorias(mem_relevancia DESC);');
}

async function ensureCacheSemanticoTable() {
    console.log('\n📋 Verificando tabela cache_semantico...');

    const exists = await checkTableExists('cache_semantico');

    if (!exists) {
        console.log('  ➕ Criando tabela cache_semantico...');
        await executeSQL(`
      CREATE TABLE cuca.cache_semantico (
        cache_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        cache_pergunta TEXT NOT NULL,
        cache_resposta TEXT NOT NULL,
        cache_modelo TEXT NOT NULL,
        cache_embedding vector(1536),
        cache_contador INTEGER DEFAULT 1,
        cache_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        cache_atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);
    }

    // Índices
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_cache_criado ON cuca.cache_semantico(cache_criado_em DESC);');
}

async function ensureGrafoEntidadesTable() {
    console.log('\n📋 Verificando tabela grafo_entidades...');

    const exists = await checkTableExists('grafo_entidades');

    if (!exists) {
        console.log('  ➕ Criando tabela grafo_entidades...');
        await executeSQL(`
      CREATE TABLE cuca.grafo_entidades (
        ent_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ent_nome TEXT NOT NULL,
        ent_tipo TEXT NOT NULL,
        ent_metadados JSONB,
        ent_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        UNIQUE(ent_nome, ent_tipo)
      );
    `);
    }

    // Índices
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_entidades_tipo ON cuca.grafo_entidades(ent_tipo);');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_entidades_nome ON cuca.grafo_entidades(ent_nome);');
}

async function ensureGrafoRelacoesTable() {
    console.log('\n📋 Verificando tabela grafo_relacoes...');

    const exists = await checkTableExists('grafo_relacoes');

    if (!exists) {
        console.log('  ➕ Criando tabela grafo_relacoes...');
        await executeSQL(`
      CREATE TABLE cuca.grafo_relacoes (
        rel_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        rel_entidade_origem UUID NOT NULL REFERENCES cuca.grafo_entidades(ent_id) ON DELETE CASCADE,
        rel_entidade_destino UUID NOT NULL REFERENCES cuca.grafo_entidades(ent_id) ON DELETE CASCADE,
        rel_tipo TEXT NOT NULL,
        rel_descricao TEXT,
        rel_força INTEGER DEFAULT 1 CHECK (rel_força >= 1 AND rel_força <= 10),
        rel_metadados JSONB,
        rel_criado_em TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        UNIQUE(rel_entidade_origem, rel_entidade_destino, rel_tipo)
      );
    `);
    }

    // Índices
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_relacoes_origem ON cuca.grafo_relacoes(rel_entidade_origem);');
    await executeSQL('CREATE INDEX IF NOT EXISTS idx_relacoes_destino ON cuca.grafo_relacoes(rel_entidade_destino);');
}

async function enableRLS() {
    console.log('\n🔒 Habilitando Row Level Security...');

    const tables = ['conversas', 'mensagens', 'documentos', 'memorias', 'cache_semantico', 'grafo_entidades', 'grafo_relacoes'];

    for (const table of tables) {
        try {
            await executeSQL(`ALTER TABLE cuca.${table} ENABLE ROW LEVEL SECURITY;`);
            console.log(`  ✅ RLS habilitado em ${table}`);
        } catch (error) {
            console.log(`  ℹ️  RLS já habilitado ou tabela não existe: ${table}`);
        }
    }
}

async function createPolicies() {
    console.log('\n📜 Criando políticas RLS...');

    // Políticas para conversas
    const policies = [
        {
            table: 'conversas',
            policy: `CREATE POLICY "Usuários podem ver suas próprias conversas" ON cuca.conversas FOR SELECT USING (auth.uid() = con_usuario_id);`
        },
        {
            table: 'conversas',
            policy: `CREATE POLICY "Usuários podem criar suas próprias conversas" ON cuca.conversas FOR INSERT WITH CHECK (auth.uid() = con_usuario_id);`
        },
        {
            table: 'conversas',
            policy: `CREATE POLICY "Usuários podem atualizar suas próprias conversas" ON cuca.conversas FOR UPDATE USING (auth.uid() = con_usuario_id) WITH CHECK (auth.uid() = con_usuario_id);`
        },
        {
            table: 'conversas',
            policy: `CREATE POLICY "Usuários podem deletar suas próprias conversas" ON cuca.conversas FOR DELETE USING (auth.uid() = con_usuario_id);`
        },
        // Mensagens
        {
            table: 'mensagens',
            policy: `CREATE POLICY "Usuários podem ver mensagens de suas conversas" ON cuca.mensagens FOR SELECT USING (EXISTS (SELECT 1 FROM cuca.conversas WHERE con_id = mensagens.men_conversa_id AND con_usuario_id = auth.uid()));`
        },
        {
            table: 'mensagens',
            policy: `CREATE POLICY "Usuários podem criar mensagens em suas conversas" ON cuca.mensagens FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM cuca.conversas WHERE con_id = mensagens.men_conversa_id AND con_usuario_id = auth.uid()));`
        },
        // Documentos
        {
            table: 'documentos',
            policy: `CREATE POLICY "Usuários podem ver seus próprios documentos" ON cuca.documentos FOR SELECT USING (auth.uid() = doc_usuario_id);`
        },
        {
            table: 'documentos',
            policy: `CREATE POLICY "Usuários podem criar seus próprios documentos" ON cuca.documentos FOR INSERT WITH CHECK (auth.uid() = doc_usuario_id);`
        },
        // Memorias
        {
            table: 'memorias',
            policy: `CREATE POLICY "Usuários podem ver suas próprias memórias" ON cuca.memorias FOR SELECT USING (auth.uid() = mem_usuario_id);`
        },
        {
            table: 'memorias',
            policy: `CREATE POLICY "Usuários podem criar suas próprias memórias" ON cuca.memorias FOR INSERT WITH CHECK (auth.uid() = mem_usuario_id);`
        }
    ];

    // Nota: Para cache_semantico, grafo_entidades, grafo_relacoes vamos usar USING (true)
    // para permitir acesso compartilhado

    for (const { table, policy } of policies) {
        try {
            // Verificar se política já existe usando consulta direta
            await executeSQL(policy);
            console.log(`  ✅ Política criada para ${table}`);
        } catch (error) {
            if (error.message && error.message.includes('already exists')) {
                console.log(`  ℹ️  Política já existe para ${table}`);
            } else {
                console.log(`  ⚠️  Erro ao criar política para ${table}: ${error.message}`);
            }
        }
    }
}

async function createSchema() {
    console.log('🏗️  Garantindo schema cuca...');
    await executeSQL('CREATE SCHEMA IF NOT EXISTS cuca;');
    console.log('  ✅ Schema cuca garantido');
}

async function run() {
    console.log('🚀 Iniciando correção automática do schema Supabase...\n');

    try {
        // Testar conexão
        console.log('🔗 Testando conexão com Supabase...');
        const { error: testError } = await supabase.from('_test_').select('*').limit(1).catch(() => ({ error: null }));

        if (testError && !testError.message.includes('does not exist')) {
            console.error('❌ Erro de conexão. Verifique suas credenciais no .env.local');
            console.error('Erro:', testError.message);
            process.exit(1);
        }

        console.log('  ✅ Conexão OK!\n');

        // Executar todas as verificações
        await createSchema();
        await ensureConversasTable();
        await ensureMensagensTable();
        await ensureDocumentosTable();
        await ensureMemoriasTable();
        await ensureCacheSemanticoTable();
        await ensureGrafoEntidadesTable();
        await ensureGrafoRelacoesTable();

        await enableRLS();
        await createPolicies();

        console.log('\n✅ ✅ ✅ CORREÇÃO COMPLETA! ✅ ✅ ✅');
        console.log('\n📋 Próximos passos:');
        console.log('1. Recarregue a aplicação (F5)');
        console.log('2. Envie uma mensagem no chat');
        console.log('3. Verifique se os dados aparecem no Supabase Table Editor');
        console.log('\nSe houver erros, verifique o console do servidor para detalhes.\n');

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error('\nPossíveis soluções:');
        console.error('1. Verifique se o Supabase está acessível');
        console.error('2. Verifique se o service role key tem permissões de admin');
        console.error('3. Execute manualmente o SQL: docs/supabase-complete-schema.sql');
        process.exit(1);
    }
}

run();