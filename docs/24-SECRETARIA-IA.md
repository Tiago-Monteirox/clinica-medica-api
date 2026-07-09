# 24 - Secretaria IA no WhatsApp

> Modulo de atendimento conversacional para transformar o WhatsApp em uma secretaria virtual capaz de orientar pacientes e criar agendamentos com confirmacao explicita.

---

## Objetivo

Adicionar ao SaasClinic um canal de atendimento por WhatsApp onde o paciente conversa com uma IA para:

- identificar-se por telefone, CPF ou dados basicos;
- consultar medicos e horarios disponiveis;
- solicitar agendamento de consulta;
- confirmar os dados antes da criacao do agendamento;
- ser encaminhado para atendimento humano quando o fluxo ficar ambíguo ou sensivel.

O modulo nao substitui o servico `agendamento`. Ele funciona como um canal/orquestrador que conversa com WhatsApp, IA e os microsservicos internos.

---

## Decisao de versao: Spring AI 2.x implica Spring Boot 4.x

A plataforma foi atualizada para:

| Item | Versao atual |
|---|---|
| Spring Boot | `4.1.0` |
| Spring Cloud | `2025.1.2` |
| Spring AI | `2.0.0` |
| Java | `21` |

A documentacao atual do Spring AI informa que **Spring AI 2.0.x suporta Spring Boot 4.0.x e 4.1.x**. A pagina do Spring Cloud tambem mapeia o release train `2025.1.x` para Spring Boot `4.0.x`/`4.1.x`. Por isso, o parent Maven agora importa os BOMs de Spring Boot `4.1.0`, Spring Cloud `2025.1.2` e Spring AI `2.0.0`.

**Decisao aplicada:** para usar Spring AI 2.x, a fase tecnica de upgrade da plataforma vem antes do modulo conversacional:

| Componente | Versao aplicada |
|---|---|
| Spring Boot | `4.1.0` |
| Spring Cloud | `2025.1.2` |
| Spring AI | `2.0.0` |

**Por que nao misturar agora:** colocar um unico modulo em Boot 4 dentro do mesmo parent Maven Boot 3 tende a criar conflito de BOM, starters, auto-configuracao e versoes transversais. Como o projeto e multi-modulo e compartilha `dependencyManagement`, a migracao deve ser tratada como decisao de plataforma.

**Alternativa conservadora:** manter Boot 3.3.x e implementar o MVP com Spring AI 1.x. E mais rapido, mas ja nasce atras da linha atual do Spring AI. Para este projeto, a melhor rota tecnica e:

1. manter a base em Boot 4/Spring Cloud 2025.1;
2. validar os microsservicos existentes antes de cada incremento;
3. implementar `secretaria-ia` com Spring AI 2.x.

---

## Arquitetura proposta

```
Paciente WhatsApp
      |
      v
Meta WhatsApp Cloud API
      |
      v
API Gateway
  /api/secretaria-ia/webhooks/whatsapp
      |
      v
secretaria-ia (novo microsservico)
      |             |             |
      |             |             +--> Spring AI / LLM
      |             |
      |             +--> MySQL clinica_secretaria_ia
      |
      +--> Feign administrativo
      +--> Feign agendamento
```

O `secretaria-ia` deve ser um bounded context proprio porque ele tem regras diferentes das regras de agenda:

- conversa e estado conversacional;
- validacao de webhook externo;
- idempotencia de mensagens;
- auditoria minima de atendimento;
- integracao com provedor de IA;
- integracao com provedor de WhatsApp.

---

## Escopo do MVP

Fluxos incluidos:

1. receber mensagens de texto do WhatsApp;
2. validar webhook da Meta;
3. ignorar mensagens duplicadas por `message.id`;
4. identificar paciente existente por telefone ou CPF;
5. listar medicos e horarios possiveis;
6. coletar dados faltantes;
7. pedir confirmacao explicita;
8. criar agendamento no servico `agendamento`;
9. responder ao paciente com protocolo/resumo;
10. registrar handoff quando a IA nao puder continuar.

Fora do MVP:

- audio e transcricao;
- imagens, documentos e localizacao;
- campanhas ativas;
- reagendamento e cancelamento automaticos;
- painel humano omnichannel;
- RAG/base vetorial;
- pagamentos;
- envio de lembretes automaticos.

---

## Modulo `secretaria-ia`

Estrutura sugerida:

```
secretaria-ia/src/main/java/br/edu/imepac/secretariaia/
├── SecretariaIaApplication.java
├── ai/
│   ├── SecretariaAiService.java
│   ├── SecretariaPrompt.java
│   └── tools/
│       ├── AgendamentoTools.java
│       └── AdministrativoTools.java
├── conversa/
│   ├── ConversaEntity.java
│   ├── MensagemEntity.java
│   ├── ConversaRepository.java
│   └── ConversaService.java
├── whatsapp/
│   ├── WhatsAppWebhookController.java
│   ├── WhatsAppWebhookVerifier.java
│   ├── WhatsAppWebhookParser.java
│   ├── WhatsAppClient.java
│   └── dto/
├── client/
│   ├── AdministrativoClient.java
│   ├── AgendamentoClient.java
│   └── FeignConfig.java
├── config/
│   ├── SecurityConfig.java
│   └── SpringAiConfig.java
└── atendimento/
    ├── AtendimentoConversacionalService.java
    ├── EstadoConversa.java
    └── IntencaoConversa.java
```

---

## Endpoints

Base interna do servico:

| Metodo | Rota | Auth | Uso |
|---|---|---|---|
| `GET` | `/webhooks/whatsapp` | token de verificacao Meta | validacao inicial do webhook |
| `POST` | `/webhooks/whatsapp` | assinatura Meta | entrada de mensagens |
| `GET` | `/v1/conversas/{telefone}` | JWT interno | auditoria futura |
| `POST` | `/v1/conversas/{id}/handoff` | JWT interno | marcar atendimento humano |

Rota no gateway:

| Externo | Interno |
|---|---|
| `/api/secretaria-ia/webhooks/whatsapp` | `secretaria-ia:/webhooks/whatsapp` |

O filtro JWT do gateway deve liberar apenas o webhook publico. Rotas administrativas do `secretaria-ia` continuam com JWT.

---

## Modelo de dados

Banco: `clinica_secretaria_ia`.

Tabelas minimas:

### `conversas`

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `telefone` | VARCHAR(20) | numero WhatsApp normalizado |
| `paciente_id` | BIGINT NULL | id logico do `administrativo` |
| `estado` | VARCHAR(40) | estado atual do fluxo |
| `intencao` | VARCHAR(40) | agendar, cancelar, duvida, humano |
| `dados_parciais_json` | JSON/TEXT | slots coletados |
| `handoff_humano` | BOOLEAN | se precisa recepcionista |
| `created_at` | DATETIME | auditoria |
| `updated_at` | DATETIME | auditoria |

### `mensagens_whatsapp`

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `conversa_id` | BIGINT | FK local |
| `provider_message_id` | VARCHAR(128) | unique, idempotencia |
| `direcao` | VARCHAR(10) | `IN` ou `OUT` |
| `tipo` | VARCHAR(20) | texto no MVP |
| `conteudo` | TEXT | conteudo sanitizado |
| `status_processamento` | VARCHAR(30) | recebido, processado, erro |
| `created_at` | DATETIME | auditoria |

### `agendamentos_ia`

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `conversa_id` | BIGINT | FK local |
| `agendamento_id` | BIGINT NULL | id logico do `agendamento` |
| `paciente_id` | BIGINT | id logico |
| `medico_id` | BIGINT | id logico |
| `data_hora` | DATETIME | horario confirmado |
| `status` | VARCHAR(30) | proposto, confirmado, criado, erro |
| `resumo_confirmacao` | TEXT | texto mostrado ao paciente |
| `created_at` | DATETIME | auditoria |

---

## Fluxo de conversa

Estados sugeridos:

| Estado | Responsabilidade |
|---|---|
| `INICIADA` | primeira mensagem recebida |
| `IDENTIFICANDO_PACIENTE` | buscar por telefone/CPF |
| `COLETANDO_PREFERENCIA` | especialidade, medico, data ou periodo |
| `OFERECENDO_HORARIOS` | apresentar opcoes reais |
| `AGUARDANDO_CONFIRMACAO` | confirmar resumo antes de criar |
| `AGENDAMENTO_CRIADO` | informar sucesso |
| `HUMANO_NECESSARIO` | fila de recepcao |
| `ENCERRADA` | fluxo finalizado |

Regra central: **a IA nunca cria agendamento sem confirmacao explicita**.

Exemplo de confirmacao:

```text
Confirmo seu agendamento:
Paciente: Maria Silva
Medico: Dra. Ana Souza
Data: 15/07/2026
Horario: 14:30

Posso confirmar?
```

Somente respostas claras como `sim`, `confirmo`, `pode confirmar` ou equivalente devem disparar a criacao.

---

## Regras de IA

Usar Spring AI `ChatClient` com tool calling. A IA deve conversar, mas as acoes de negocio devem ser funcoes Java controladas.

Tools minimas:

| Tool | Responsabilidade |
|---|---|
| `buscarPacientePorTelefoneOuCpf` | localizar paciente no administrativo |
| `listarMedicos` | consultar medicos disponiveis |
| `buscarHorariosDisponiveis` | obter opcoes deterministicas |
| `prepararResumoAgendamento` | montar confirmacao |
| `criarAgendamentoConfirmado` | criar somente apos confirmacao |
| `registrarHandoffHumano` | encerrar automacao e sinalizar recepcao |

Guardrails:

- nao dar diagnostico, prescricao ou orientacao clinica;
- nao inventar disponibilidade;
- nao expor dados de outros pacientes;
- nao aceitar dados sensiveis desnecessarios pelo WhatsApp;
- nao prometer encaixe;
- transferir para humano em urgencia, ambiguidade persistente ou conflito de dados.

Prompt de sistema deve deixar claro que a IA e uma secretaria de agenda, nao uma medica.

---

## Ajustes necessarios em servicos existentes

### `administrativo`

Adicionar consultas de apoio:

| Metodo | Rota | Uso |
|---|---|---|
| `GET` | `/v1/pacientes/telefone/{telefone}` | localizar paciente pelo WhatsApp |
| `GET` | `/v1/pacientes/cpf/{cpf}` | localizar paciente quando telefone nao bater |
| `GET` | `/v1/medicos` | ja existe, reutilizar |

Criacao automatica de paciente deve ficar fora do MVP ou exigir confirmacao adicional, porque hoje `PacienteRequest` exige nome, email e CPF.

### `agendamento`

Adicionar endpoint de disponibilidade:

| Metodo | Rota | Uso |
|---|---|---|
| `GET` | `/v1/agendamentos/disponibilidade` | retornar horarios livres por medico e periodo |

Parametros sugeridos:

| Parametro | Exemplo |
|---|---|
| `medicoId` | `20` |
| `inicio` | `2026-07-15T00:00:00` |
| `fim` | `2026-07-20T23:59:59` |
| `slotMinutos` | `30` |

O calculo de disponibilidade deve ser deterministico no backend. A IA apenas apresenta as opcoes retornadas.

---

## WhatsApp Cloud API

Configuracoes necessarias na Meta:

- app no Meta for Developers;
- WhatsApp Business Account;
- numero de telefone vinculado;
- callback URL apontando para o gateway;
- verify token configurado;
- permissao/token para envio de mensagens;
- templates aprovados para mensagens iniciadas fora da janela de atendimento.

Variaveis de ambiente:

```properties
WHATSAPP_VERIFY_TOKEN=trocar
WHATSAPP_ACCESS_TOKEN=trocar
WHATSAPP_PHONE_NUMBER_ID=trocar
WHATSAPP_APP_SECRET=trocar
WHATSAPP_GRAPH_API_VERSION=versao_suportada_no_app_meta
```

Seguranca do webhook:

- `GET /webhooks/whatsapp` valida `hub.verify_token` e devolve `hub.challenge`;
- `POST /webhooks/whatsapp` valida `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET`;
- payload invalido deve retornar `401` ou `403`;
- payload duplicado deve retornar `200` sem reprocessar.

---

## Configuracao do Spring AI

Variaveis:

```properties
SPRING_AI_OPENAI_API_KEY=trocar
SPRING_AI_OPENAI_CHAT_OPTIONS_MODEL=gpt-4.1-mini
SPRING_AI_OPENAI_CHAT_OPTIONS_TEMPERATURE=0.2
```

Dependencias apos migracao para Boot 4:

```xml
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>org.springframework.ai</groupId>
      <artifactId>spring-ai-bom</artifactId>
      <version>${spring-ai.version}</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
```

No modulo:

```xml
<dependency>
  <groupId>org.springframework.ai</groupId>
  <artifactId>spring-ai-starter-model-openai</artifactId>
</dependency>
```

---

## Roteiro de implementacao

### PASSO 0 - Upgrade de plataforma

1. Atualizar o parent Maven:
   - `spring-boot.version=4.1.0`;
   - `spring-cloud.version=2025.1.2`;
   - `spring-ai.version=2.0.0`.
2. Atualizar plugins e BOMs.
3. Rodar build completo.
4. Corrigir quebras de Gateway, Security, Feign, Redis, RabbitMQ e testes.
5. Validar smoke test atual sem nenhuma funcionalidade nova.

Ponto de controle:

```bash
mvn clean test
docker compose --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  up --build -d
```

### PASSO 1 - Contratos de apoio

1. Adicionar busca de paciente por telefone/CPF no `administrativo`.
2. Adicionar disponibilidade no `agendamento`.
3. Cobrir com testes unitarios e controller tests.

### PASSO 2 - Criar `secretaria-ia`

1. Criar modulo Maven.
2. Configurar banco proprio.
3. Criar entidades de conversa/mensagem/agendamento IA.
4. Criar clients Feign.
5. Criar controller de webhook.

### PASSO 3 - IA e orquestracao

1. Criar prompt de sistema.
2. Criar tools controladas.
3. Implementar maquina de estados conversacional.
4. Integrar envio de resposta ao WhatsApp.

### PASSO 4 - Gateway e Docker

1. Adicionar rota `/api/secretaria-ia/**`.
2. Liberar webhook publico no filtro JWT.
3. Adicionar servico no Compose.
4. Adicionar variaveis nos `.env.example`.
5. Adicionar SQL de init para `clinica_secretaria_ia`.

---

## Testes

Unitarios:

- parser de payload do WhatsApp;
- validacao de assinatura;
- idempotencia por `provider_message_id`;
- transicoes de estado;
- confirmacao explicita vs resposta ambigua;
- handoff humano.

Controller:

- webhook `GET` com token correto;
- webhook `GET` com token incorreto;
- webhook `POST` com assinatura valida;
- webhook `POST` com assinatura invalida;
- payload duplicado retorna `200` sem chamar IA.

Integracao:

- Feign para `administrativo`;
- Feign para `agendamento`;
- criacao de agendamento apos confirmacao.

Smoke manual:

1. enviar mensagem "quero agendar uma consulta";
2. informar CPF quando solicitado;
3. escolher medico/periodo;
4. confirmar um horario;
5. verificar agendamento criado em `/api/agendamentos/v1/agendamentos`.

---

## LGPD e seguranca

Cuidados minimos:

- mascarar CPF e telefone em logs;
- nao logar token da Meta nem chave da OpenAI;
- guardar apenas mensagens necessarias para auditoria;
- configurar retencao de historico;
- registrar quando houve confirmacao do paciente;
- permitir handoff humano;
- tratar urgencias com resposta de encaminhamento, nao com orientacao medica.

---

## Referencias

- Spring AI Reference - Getting Started: https://docs.spring.io/spring-ai/reference/getting-started.html
- Spring AI Reference - Chat Client API: https://docs.spring.io/spring-ai/reference/api/chatclient.html
- Spring AI Reference - Tool Calling: https://docs.spring.io/spring-ai/reference/api/tools.html
- Spring Boot: https://spring.io/projects/spring-boot/
- Spring Cloud version mapping: https://spring.io/projects/spring-cloud/
- Meta WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Meta WhatsApp Webhooks: https://developers.facebook.com/docs/graph-api/webhooks/
