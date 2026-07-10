# Historico clinico completo

Paciente: {{paciente.nome}}
CPF: {{paciente.cpf}}
Data de nascimento: {{paciente.dataNascimento}}

{{#historico.itens}}
---

Atendimento: {{atendimentoId}}
Data: {{dataAtendimento}}
Medico: {{medicoNome}}
Status: {{status}}

## Resumo

{{resumo}}

## Diagnostico

{{diagnostico}}

## Prescricao

{{prescricao}}

## Conduta

{{conduta}}

{{/historico.itens}}
