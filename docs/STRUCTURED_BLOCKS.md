# Sistema de Blocos Estruturados - Cuca AI

## Visão Geral

O Cuca AI agora suporta blocos visuais estruturados que permitem respostas mais organizadas e interativas. A IA pode gerar diferentes tipos de blocos que são renderizados automaticamente com design moderno e inspirado em ferramentas como Notion, Perplexity e ChatGPT.

## Tipos de Blocos Suportados

### 1. Análise (`<analysis>`)
Renderiza um card de análise com ícone de cérebro e fundo gradiente azul.

**Formato:**
```xml
<analysis>
Texto da análise detalhada aqui. Pode conter markdown.
</analysis>
```

**Alternativa Markdown:**
```markdown
```analysis
Texto da análise
```
```

### 2. Tabela (`<table>`)
Renderiza uma tabela estilizada com cabeçalho e linhas alternadas.

**Formato:**
```xml
<table>
| Coluna 1 | Coluna 2 | Coluna 3 |
|----------|----------|----------|
| Dado 1   | Dado 2   | Dado 3   |
| Dado 4   | Dado 5   | Dado 6   |
</table>
```

**Alternativa Markdown:**
```markdown
```table
| Coluna 1 | Coluna 2 |
|----------|----------|
| Dado 1   | Dado 2   |
```
```

### 3. Código (`<code language="python">`)
Renderiza um editor de código com botão copiar e sintaxe highlight.

**Formato:**
```xml
<code language="javascript">
const exemplo = "código aqui";
console.log(exemplo);
</code>
```

**Alternativa Markdown:**
```markdown
```javascript
const exemplo = "código aqui";
console.log(exemplo);
```
```

### 4. Gráfico (`<chart type="bar">`)
Renderiza gráficos interativos usando recharts.

**Tipos suportados:** `bar`, `line`, `pie`, `area`

**Formato:**
```xml
<chart type="bar">
[
  {"name": "Jan", "value": 100},
  {"name": "Fev", "value": 150},
  {"name": "Mar", "value": 200}
]
</chart>
```

**Formatos de dados aceitos:**
- JSON array de objetos com propriedades `name` e `value`
- CSV simples: `Mês,Valor\nJan,100\nFev,150`

**Exemplo com CSV:**
```xml
<chart type="line">
Mês,Valor
Jan,100
Fev,150
Mar,200
</chart>
```

### 5. Insight (`<insight>`)
Renderiza uma caixa azul com ícone de lâmpada, ideal para conclusões importantes.

**Formato:**
```xml
<insight>
Insight importante sobre o assunto. Pode conter markdown.
</insight>
```

**Alternativa Markdown:**
```markdown
```insight
Insight importante
```
```

### 6. Atenção (`<warning>`)
Renderiza uma caixa amarela/laranja com ícone de alerta, para pontos de atenção.

**Formato:**
```xml
<warning>
Ponto crítico que precisa de atenção. Pode conter markdown.
</warning>
```

**Alternativa Markdown:**
```markdown
```warning
Atenção: ponto crítico
```
```

### 7. Resumo (`<summary>`)
Renderiza uma caixa destacada verde com ícone de check, para conclusões finais.

**Formato:**
```xml
<summary>
Resumo final da análise ou decisão tomada.
</summary>
```

**Alternativa Markdown:**
```markdown
```summary
Resumo final
```
```

## Como Funciona

1. A IA gera texto normal com as tags especiais
2. O frontend detecta automaticamente as tags
3. Cada bloco é renderizado com seu componente visual correspondente
4. O texto normal (fora dos blocos) é renderizado como markdown comum

## Exemplo Completo de Resposta

```xml
# Análise de Desempenho

<analysis>
O desempenho do trimestre superou as expectativas com crescimento de 15% na receita.
</analysis>

## Dados Mensais

<table>
| Mês | Receita | Crescimento |
|-----|---------|-------------|
| Jan | R$ 100k | +5% |
| Fev | R$ 115k | +15% |
| Mar | R$ 132k | +14.8% |
</table>

<insight>
O padrão de crescimento sugere expansão sustentável do mercado.
</insight>

## Tendência

<chart type="line">
[
  {"name": "Jan", "value": 100},
  {"name": "Fev", "value": 115},
  {"name": "Mar", "value": 132}
]
</chart>

<warning>
Atenção: A margem de lucro diminuiu 2% no último mês.
</warning>

## Conclusão

<summary>
O trimestre foi positivo com receita recorde, mas atenção necessária às margens.
</summary>
```

## Design e Estilização

Os blocos seguem um design moderno e consistente:

- **Cores:** Gradientes sutis com transparência
- **Bordas:** Arredondadas com bordas semi-transparentes
- **Sombras:** Leves e elegantes
- **Animações:** Transições suaves em hover
- **Responsivo:** Adaptado para mobile e desktop

## Personalização

Os estilos estão definidos em `src/app/globals.css` na seção "BLOCOS ESTRUTURADOS". Cores e animações podem ser modificadas conforme a identidade visual do projeto.

## Compatibilidade

- Funciona com qualquer modelo de IA via OpenRouter
- Não requer alterações no backend
- Suporta streaming de respostas
- Compatível com histórico de conversas
- Totalmente integrado com o sistema existente do Cuca AI

## Arquivos do Sistema

```
src/components/chat/blocks/
├── index.ts                      # Exportações
├── parser.ts                     # Parser de blocos
├── StructuredBlocksRenderer.tsx  # Renderizador principal
├── AnalysisBlock.tsx            # Bloco de análise
├── TableBlock.tsx               # Bloco de tabela
├── CodeBlockEnhanced.tsx        # Bloco de código
├── ChartBlock.tsx               # Bloco de gráfico
├── InsightBlock.tsx             # Bloco de insight
├── WarningBlock.tsx             # Bloco de warning
├── SummaryBlock.tsx             # Bloco de summary
└── demo/
    └── BlocksDemo.tsx           # Componente de demonstração
```

## Testes

Para testar os blocos, importe o componente de demonstração:

```tsx
import { BlocksDemo } from '@/components/chat/blocks/demo/BlocksDemo';

// Use em qualquer página
<BlocksDemo />
```

## Dicas para a IA

Para melhores resultados, instrua a IA a usar:

1. **Um bloco por vez** - Evite misturar múltiplos blocos do mesmo tipo muito próximos
2. **Conteúdo dentro das tags** - Não coloque texto após o fechamento da tag
3. **Formato consistente** - Use JSON válido para gráficos
4. **Markdown inline** - Dentro dos blocos pode usar markdown normalmente
5. **Contexto claro** - Forneça contexto antes/depois dos blocos

## Troubleshooting

**Bloco não aparece:**
- Verifique se as tags estão corretamente fechadas
- Confira se não há espaços extras dentros das tags
- Para markdown, confira se usou ``` (3 backticks) não `

**Gráfico erro:**
- Dados devem ser JSON válido
- Propriedades devem ser `name` e `value`
- Use aspas duplas no JSON

**Estilos não aplicam:**
- Verifique se o globals.css foi importado
- Confira se as classes do Tailwind estão disponíveis
- Faça rebuild da aplicação

## Futuras Melhorias

- [ ] Suporte a mais tipos de gráficos (scatter, radar)
- [ ] Templates pré-definidos
- [ ] Animações de entrada mais elaboradas
- [ ] Exportação de gráficos como imagem
- [ ] Bloco de flowchart/diagrama
- [ ] Bloco de métricas com contadores animados