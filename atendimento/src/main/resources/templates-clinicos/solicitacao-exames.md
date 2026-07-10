# Solicitacao de exames

Paciente: {{paciente.nome}}
Data: {{documento.dataEmissao}}
Medico: {{medico.nome}} - CRM {{medico.crm}}

## Exames solicitados

{{#documento.exames}}
- {{nome}} - {{justificativa}}
{{/documento.exames}}

## Observacoes

{{documento.observacoes}}
