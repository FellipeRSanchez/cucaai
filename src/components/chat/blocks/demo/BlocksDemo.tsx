import { StructuredBlocksRenderer } from '../StructuredBlocksRenderer';

const DEMO_CONTENT = `
# Análise de Dados de Vendas

<analysis>
Esta análise revela um crescimento consistente nas vendas trimestrais, com destaque para o canal online que superou as projeções em 15%. A margem de lucro aumentou 2.3 pontos percentuais devido à otimização operacional.
</analysis>

Aqui estão alguns insights importantes:

<table>
| Mês | Vendas (R$) | Crescimento |
|-----|-------------|-------------|
| Jan | 125.000 | +5% |
| Fev | 138.500 | +10.8% |
| Mar | 156.200 | +12.8% |
| Abr | 142.300 | -8.9% |
| Mai | 168.900 | +18.7% |
</table>

<insight>
O pico de vendas em maio sugere uma correlação forte com a campanha de marketing digital lançada no início do mês. Recomenda-se investir em estratégias similares para o próximo trimestre.
</insight>

A distribuição dos dados pode ser visualizada no gráfico abaixo:

<chart type="bar">
[
  {"name": "Jan", "value": 125000},
  {"name": "Fev", "value": 138500},
  {"name": "Mar", "value": 156200},
  {"name": "Abr", "value": 142300},
  {"name": "Mai", "value": 168900}
]
</chart>

<warning>
A queda em abril coincidiu com problemas técnicos no site. É crucial investir em infraestrutura mais robusta e planos de contingência.
</warning>

Podemos também analisar a tendência de crescimento:

<chart type="line">
[
  {"name": "T1", "value": 139900},
  {"name": "T2", "value": 155466}
]
</chart>

Para complementar, segue um código de exemplo para automação:

<code language="python">
def analyze_sales_trend(data):
    \"\"\"
    Analisa tendências de vendas
    \"\"\"
    avg_growth = data['growth'].mean()
    if avg_growth > 0.1:
        return "Crescimento forte"
    else:
        return "Crescimento moderado"
</code>

<summary>
Em resumo, os dados indicam uma trajetória de crescimento positivo com oportunidades de otimização na infraestrutura digital e campanhas de marketing. A margem de lucro expandida sugere eficiência operacional melhorada.
</summary>
`;

export function BlocksDemo() {
    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Demonstração de Blocos Estruturados</h1>
            <StructuredBlocksRenderer content={DEMO_CONTENT} />
        </div>
    );
}