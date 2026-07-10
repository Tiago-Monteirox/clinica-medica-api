# 25 - Prontuario e Historico Clinico

> Modulo clinico implementado no backend do servico `atendimento` com prontuario estruturado, historico longitudinal do paciente e templates versionados para prontuario, historico, prescricao, atestado e solicitacao de exames.

---

## Referencia analisada

Foi usado como referencia o projeto antigo [`samelamaria/AgendaClinic`](https://github.com/samelamaria/AgendaClinic), especialmente:

- `Prontuario`: campos `resumo`, `anotacoes`, `arquivoPdf` e vinculo obrigatorio com `Consulta`;
- `ProntuarioService`: cria ou atualiza prontuario e marca a consulta como realizada;
- `ProntuarioDao#listarPorPaciente`: historico do paciente ordenado da consulta mais recente para a mais antiga;
- `ProntuarioFormScreen`: tela de atendimento com dados do paciente/consulta, resumo obrigatorio, anotacoes e arquivo PDF;
- `HistoricoPacienteScreen`: tabela de historico com data, medico, tipo/convênio e resumo diagnostico.

O desenho abaixo adapta essas ideias para a arquitetura atual de microsservicos, Spring Boot 4 e APIs REST. Nao e uma copia do modelo desktop/JDBC.

---

## Decisao arquitetural

Implementar o modulo **dentro do servico `atendimento`**, nao como novo microsservico neste momento.

Motivos:

- o `atendimento` ja e o bounded context do registro clinico;
- ele ja denormaliza `agendamentoId`, `pacienteId`, `medicoId` e `dataAtendimento`;
- ele ja valida o agendamento via Feign e publica evento para o `agendamento`;
- prontuario e historico sao evolucoes diretas do registro clinico atual;
- evita uma nova base de dados e nova comunicacao distribuida antes de existir complexidade real.

Novo pacote sugerido:

```text
atendimento/src/main/java/br/edu/imepac/atendimento/
├── atendimento/              # registro atual de atendimento
├── prontuario/               # novo subdominio clinico
│   ├── ProntuarioController.java
│   ├── ProntuarioService.java
│   ├── ProntuarioRepository.java
│   ├── ProntuarioEntity.java
│   ├── HistoricoClinicoService.java
│   └── dto/
├── template/
│   ├── TemplateClinicoController.java
│   ├── TemplateClinicoService.java
│   ├── TemplateClinicoRepository.java
│   ├── TemplateClinicoEntity.java
│   ├── DocumentoClinicoEntity.java
│   └── renderer/
│       ├── TemplateRenderer.java
│       └── MarkdownTemplateRenderer.java

atendimento/src/main/resources/templates-clinicos/
├── prontuario-consulta-geral.md
├── historico-paciente-resumido.md
├── historico-paciente-completo.md
├── prescricao-simples.md
├── atestado-medico.md
└── solicitacao-exames.md
```

---

## Objetivo do modulo

Permitir que o medico:

1. abra o atendimento de um agendamento confirmado ou agendado;
2. registre prontuario clinico estruturado;
3. consulte o historico longitudinal do paciente;
4. gere documentos clinicos a partir de templates;
5. finalize o prontuario de forma auditavel.

Permitir que o sistema:

1. mantenha um prontuario por atendimento;
2. liste historico por paciente em ordem decrescente;
3. preserve snapshots de templates usados em documentos;
4. controle permissao de leitura/escrita de conteudo sensivel;
5. mantenha base para futura geracao de PDF e assinatura.

---

## Estado da implementacao

Implementado no backend:

- entidades JPA `ProntuarioEntity`, `TemplateClinicoEntity` e `DocumentoClinicoEntity`;
- services de prontuario, templates, documentos e renderizacao Markdown;
- endpoints REST para prontuario, historico, templates e documentos;
- seed dos seis templates iniciais no boot do `atendimento`;
- testes unitarios e WebMvcTest para regras principais;
- API Console atualizado com os endpoints do modulo.

Ainda fora do MVP:

- PDF com layout final;
- assinatura digital;
- upload/anexos reais;
- acesso do paciente ao prontuario;
- resumo por IA/RAG;
- tela operacional dedicada no SaaS Web.

---

## Escopo do MVP

Incluido:

- CRUD controlado de prontuario por atendimento;
- status `RASCUNHO` e `FINALIZADO`;
- historico clinico por paciente;
- busca de prontuario por atendimento;
- templates clinicos versionados;
- renderizacao de documento em Markdown/HTML;
- seed dos templates iniciais;
- permissao restrita a `MEDICO` para escrita clinica;
- testes de service e controller.

Fora do MVP:

- assinatura digital ICP-Brasil;
- certificado medico legal;
- upload real de anexos;
- PDF com layout final;
- editor rich text;
- versionamento completo por diff;
- integração com laboratorio;
- RAG/IA para resumir historico;
- acesso do paciente ao prontuario.

---

## Modelo de dominio

### `ProntuarioEntity`

Um atendimento gera no maximo um prontuario.

Campos sugeridos:

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `atendimentoId` | BIGINT | unique, referencia logica ao `AtendimentoEntity` |
| `agendamentoId` | BIGINT | denormalizado para rastreio |
| `pacienteId` | BIGINT | denormalizado para historico |
| `medicoId` | BIGINT | denormalizado para historico |
| `dataAtendimento` | DATETIME | copia do atendimento |
| `queixaPrincipal` | TEXT | opcional no MVP |
| `historiaDoencaAtual` | TEXT | opcional |
| `resumo` | TEXT | obrigatorio para finalizar |
| `diagnostico` | TEXT | pode iniciar com valor do atendimento atual |
| `conduta` | TEXT | plano/encaminhamento |
| `prescricao` | TEXT | pode iniciar com valor do atendimento atual |
| `observacoes` | TEXT | notas livres |
| `status` | VARCHAR(20) | `RASCUNHO`, `FINALIZADO`, `RETIFICADO` |
| `finalizadoEm` | DATETIME NULL | preenchido ao finalizar |
| `createdAt` | DATETIME | auditoria |
| `updatedAt` | DATETIME | auditoria |

Regra importante: depois de `FINALIZADO`, o prontuario nao deve ser alterado livremente. Mudancas futuras devem virar retificacao ou nova evolucao.

### `HistoricoClinicoItem`

Historico nao precisa ser tabela no MVP. Pode ser um DTO/read-model montado a partir de `prontuarios` e `atendimentos`.

Campos do item:

| Campo | Tipo | Observacao |
|---|---|---|
| `prontuarioId` | BIGINT | id do prontuario |
| `atendimentoId` | BIGINT | id do atendimento |
| `agendamentoId` | BIGINT | rastreio |
| `pacienteId` | BIGINT | filtro |
| `medicoId` | BIGINT | autor |
| `dataAtendimento` | DATETIME | ordenacao desc |
| `status` | VARCHAR | status do prontuario |
| `resumo` | TEXT | resumo clinico |
| `diagnostico` | TEXT | diagnostico |
| `conduta` | TEXT | conduta |

### `TemplateClinicoEntity`

Templates precisam ser versionados porque documentos antigos devem continuar representando o texto usado na epoca.

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `codigo` | VARCHAR(80) | ex.: `PRONTUARIO_CONSULTA_GERAL` |
| `nome` | VARCHAR(160) | nome exibido |
| `tipo` | VARCHAR(40) | `PRONTUARIO`, `HISTORICO`, `PRESCRICAO`, `ATESTADO`, `EXAME` |
| `versao` | INT | incrementa quando conteudo muda |
| `conteudoMarkdown` | TEXT | template com placeholders |
| `schemaJson` | TEXT | campos esperados pelo template |
| `ativo` | BOOLEAN | selecionavel ou legado |
| `createdAt` | DATETIME | auditoria |
| `updatedAt` | DATETIME | auditoria |

Indice unico: `(codigo, versao)`.

### `DocumentoClinicoEntity`

Documento gerado a partir de template.

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `prontuarioId` | BIGINT | FK logica |
| `pacienteId` | BIGINT | denormalizado |
| `medicoId` | BIGINT | denormalizado |
| `templateCodigo` | VARCHAR(80) | snapshot |
| `templateVersao` | INT | snapshot |
| `tipo` | VARCHAR(40) | prescricao, atestado, historico |
| `conteudoMarkdown` | TEXT | resultado renderizado |
| `conteudoHtml` | MEDIUMTEXT NULL | opcional |
| `status` | VARCHAR(20) | `RASCUNHO`, `EMITIDO`, `CANCELADO` |
| `emitidoEm` | DATETIME NULL | quando emitido |
| `createdAt` | DATETIME | auditoria |
| `updatedAt` | DATETIME | auditoria |

---

## Endpoints

Rotas internas do servico `atendimento`.

| Metodo | Rota | Auth | Uso |
|---|---|---|---|
| `GET` | `/v1/prontuarios/atendimento/{atendimentoId}` | `ADMIN`, `MEDICO` | buscar prontuario do atendimento |
| `PUT` | `/v1/prontuarios/atendimento/{atendimentoId}` | `MEDICO` | criar/atualizar rascunho |
| `POST` | `/v1/prontuarios/{id}/finalizar` | `MEDICO` | finalizar prontuario |
| `GET` | `/v1/prontuarios/paciente/{pacienteId}/historico` | `ADMIN`, `MEDICO` | listar historico clinico |
| `GET` | `/v1/templates-clinicos` | `ADMIN`, `MEDICO` | listar templates ativos |
| `GET` | `/v1/templates-clinicos/{codigo}` | `ADMIN`, `MEDICO` | buscar template ativo |
| `POST` | `/v1/templates-clinicos` | `ADMIN` | criar nova versao de template |
| `POST` | `/v1/documentos-clinicos/preview` | `MEDICO` | renderizar sem emitir |
| `POST` | `/v1/documentos-clinicos` | `MEDICO` | emitir documento clinico |
| `GET` | `/v1/documentos-clinicos/prontuario/{prontuarioId}` | `ADMIN`, `MEDICO` | listar documentos do prontuario |

Via gateway:

| Externo | Interno |
|---|---|
| `/api/atendimentos/v1/prontuarios/**` | `atendimento:/v1/prontuarios/**` |
| `/api/atendimentos/v1/templates-clinicos/**` | `atendimento:/v1/templates-clinicos/**` |
| `/api/atendimentos/v1/documentos-clinicos/**` | `atendimento:/v1/documentos-clinicos/**` |

---

## Regras de negocio

### Prontuario

- `atendimentoId` e obrigatorio.
- Deve existir `AtendimentoEntity` para o `atendimentoId`.
- Um atendimento tem no maximo um prontuario.
- `resumo` e obrigatorio para finalizar.
- `MEDICO` pode criar/editar rascunho.
- `ADMIN` pode visualizar, mas nao editar conteudo clinico no MVP.
- `RECEPCIONISTA` nao deve acessar conteudo clinico.
- `PACIENTE` fica fora do MVP; acesso futuro deve ser propria rota, com regra de titularidade.
- Ao finalizar, `finalizadoEm` e preenchido e o status vira `FINALIZADO`.
- Alteracao de prontuario finalizado deve ser bloqueada no MVP.

### Historico

- Historico filtra por `pacienteId`.
- Ordenacao padrao: `dataAtendimento DESC`.
- Deve retornar apenas prontuarios finalizados por padrao.
- Opcional: parametro `incluirRascunhos=true` apenas para `MEDICO`/`ADMIN`.
- Cada item deve trazer dados suficientes para abrir o prontuario em modo leitura.

### Templates

- Templates possuem `codigo` estavel e `versao` incremental.
- Alterar template cria nova versao; nao sobrescreve versao antiga.
- Apenas templates `ativo=true` aparecem para emissao.
- Documento emitido guarda snapshot do template usado.
- Placeholders desconhecidos devem falhar com erro 422, nao gerar documento parcial.

---

## Templates iniciais

Usar placeholders simples no formato `{{objeto.campo}}`. No MVP, renderizar Markdown primeiro; HTML/PDF podem vir depois.

### 1. `PRONTUARIO_CONSULTA_GERAL`

Arquivo: `templates-clinicos/prontuario-consulta-geral.md`

```md
# Prontuario de Consulta

Paciente: {{paciente.nome}}
Data do atendimento: {{atendimento.dataAtendimento}}
Medico: {{medico.nome}}

## Queixa principal

{{prontuario.queixaPrincipal}}

## Historia da doenca atual

{{prontuario.historiaDoencaAtual}}

## Resumo

{{prontuario.resumo}}

## Diagnostico

{{prontuario.diagnostico}}

## Conduta

{{prontuario.conduta}}

## Prescricao

{{prontuario.prescricao}}

## Observacoes

{{prontuario.observacoes}}
```

### 2. `HISTORICO_PACIENTE_RESUMIDO`

Arquivo: `templates-clinicos/historico-paciente-resumido.md`

```md
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
```

### 3. `HISTORICO_PACIENTE_COMPLETO`

Arquivo: `templates-clinicos/historico-paciente-completo.md`

```md
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
```

### 4. `PRESCRICAO_SIMPLES`

Arquivo: `templates-clinicos/prescricao-simples.md`

```md
# Prescricao medica

Paciente: {{paciente.nome}}
Data: {{documento.dataEmissao}}
Medico: {{medico.nome}} - CRM {{medico.crm}}

## Prescricao

{{prontuario.prescricao}}

Orientacoes adicionais:

{{documento.orientacoes}}
```

### 5. `ATESTADO_MEDICO`

Arquivo: `templates-clinicos/atestado-medico.md`

```md
# Atestado medico

Atesto, para os devidos fins, que {{paciente.nome}}, CPF {{paciente.cpf}},
foi atendido(a) em {{atendimento.dataAtendimento}} e necessita de afastamento
por {{documento.diasAfastamento}} dia(s), a partir de {{documento.dataInicioAfastamento}}.

CID: {{documento.cid}}

Observacoes: {{documento.observacoes}}

Medico: {{medico.nome}} - CRM {{medico.crm}}
```

### 6. `SOLICITACAO_EXAMES`

Arquivo: `templates-clinicos/solicitacao-exames.md`

```md
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
```

---

## DTOs sugeridos

### `ProntuarioRequest`

```java
public class ProntuarioRequest {
    private String queixaPrincipal;
    private String historiaDoencaAtual;
    private String resumo;
    private String diagnostico;
    private String conduta;
    private String prescricao;
    private String observacoes;
}
```

### `FinalizarProntuarioRequest`

```java
public class FinalizarProntuarioRequest {
    private String resumo;
}
```

### `HistoricoClinicoResponse`

```java
public class HistoricoClinicoResponse {
    private Long pacienteId;
    private List<HistoricoClinicoItemResponse> itens;
}
```

### `DocumentoClinicoRequest`

```java
public class DocumentoClinicoRequest {
    private Long prontuarioId;
    private String templateCodigo;
    private Map<String, Object> dadosComplementares;
}
```

---

## Fluxos principais

### Registrar prontuario

```text
MEDICO
  |
  v
GET /api/atendimentos/v1/atendimentos/{id}
  |
  v
PUT /api/atendimentos/v1/prontuarios/atendimento/{id}
  |
  v
salva RASCUNHO em clinica_atendimento.prontuarios
```

### Finalizar prontuario

```text
POST /api/atendimentos/v1/prontuarios/{id}/finalizar
  |
  +-- valida resumo obrigatorio
  +-- valida status != FINALIZADO
  +-- status = FINALIZADO
  +-- finalizadoEm = now()
```

### Consultar historico

```text
GET /api/atendimentos/v1/prontuarios/paciente/{pacienteId}/historico
  |
  +-- filtra por pacienteId
  +-- status FINALIZADO por padrao
  +-- ordena dataAtendimento DESC
  +-- retorna timeline clinica
```

### Gerar documento por template

```text
POST /api/atendimentos/v1/documentos-clinicos
  |
  +-- busca prontuario
  +-- busca template ativo
  +-- monta contexto paciente/medico/atendimento/prontuario
  +-- aplica dadosComplementares
  +-- renderiza Markdown
  +-- grava DocumentoClinico com snapshot de template
```

---

## Integracao com o estado atual

Hoje `AtendimentoEntity` ja tem:

- `diagnostico`;
- `prescricao`;
- `observacoes`;
- `agendamentoId`, `pacienteId`, `medicoId`;
- `dataAtendimento`.

Para evitar quebra de API:

1. manter `AtendimentoEntity` como registro base;
2. criar `ProntuarioEntity` como extensao clinica 1:1 por atendimento;
3. ao criar prontuario, preencher campos iniciais com os valores do atendimento;
4. manter endpoints atuais de atendimento funcionando;
5. depois, avaliar se `diagnostico`/`prescricao` devem migrar totalmente para `ProntuarioEntity`.

---

## Testes esperados

Service:

- cria rascunho quando nao existe prontuario;
- atualiza rascunho existente;
- bloqueia edicao de prontuario finalizado;
- finaliza apenas com `resumo` preenchido;
- lista historico por paciente ordenado desc;
- lista apenas finalizados por padrao;
- cria nova versao de template;
- renderiza template com placeholders validos;
- falha quando placeholder obrigatorio nao tem valor.

Controller:

- `MEDICO` cria/atualiza prontuario;
- `ADMIN` visualiza historico;
- `RECEPCIONISTA` recebe 403 para conteudo clinico;
- request invalido retorna 400/422;
- template inexistente retorna 404.

Fluxo integrado via Gateway:

1. login admin/medico;
2. criar convenio, medico, paciente, agendamento e atendimento;
3. criar prontuario do atendimento;
4. finalizar prontuario;
5. consultar historico do paciente;
6. gerar prescricao por template.

---

## Definition of Done

- [x] `ProntuarioEntity` criada no `atendimento`.
- [x] `TemplateClinicoEntity` e `DocumentoClinicoEntity` criadas.
- [x] Seed dos templates iniciais.
- [x] Endpoints de prontuario, historico, templates e documentos no Swagger.
- [x] Gateway roteando sem nova rota especial, via `/api/atendimentos/**`.
- [x] Roles revisadas: escrita clinica apenas `MEDICO`; leitura clinica `MEDICO`/`ADMIN`.
- [x] Testes unitarios e WebMvcTest cobrindo regras principais.
- [x] API Console atualizado com endpoints de prontuario, historico, templates e documentos.
- [x] Docs `06-ATENDIMENTO.md` atualizada na implementacao.
- [x] Fluxo via gateway validado com usuario `MEDICO`: atendimento, prontuario, historico, templates e documento clinico.
- [ ] Roteiro feliz completo no API Console com usuario `MEDICO` seedado.

---

## Ordem sugerida de implementacao

1. Criar entidades, repositories e enums (`StatusProntuario`, `TipoTemplateClinico`, `StatusDocumentoClinico`).
2. Criar `ProntuarioService` com create/update/finalizar/historico.
3. Criar endpoints REST e testes.
4. Criar seed dos templates em `resources/templates-clinicos`.
5. Criar renderer simples de Markdown com placeholders.
6. Criar `DocumentoClinicoService`.
7. Adicionar endpoints de templates/documentos.
8. Atualizar API Console com passos do novo fluxo.
9. Testar rota por rota via Gateway antes de considerar pronto.
