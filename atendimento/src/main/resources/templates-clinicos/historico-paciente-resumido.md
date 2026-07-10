# Historico clinico resumido

Paciente: {{paciente.nome}}
CPF: {{paciente.cpf}}
Periodo: {{historico.periodoInicio}} a {{historico.periodoFim}}

{{#historico.itens}}
## {{dataAtendimento}} - Dr(a). {{medicoNome}}

Resumo: {{resumo}}

Diagnostico: {{diagnostico}}

Conduta: {{conduta}}

{{/historico.itens}}
