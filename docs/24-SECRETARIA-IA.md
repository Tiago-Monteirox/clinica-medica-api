# 24 - Secretaria IA Conversacional

> Modulo de atendimento conversacional para transformar um canal de mensagem em uma secretaria virtual capaz de orientar pacientes e criar agendamentos com confirmacao explicita. O MVP deve comecar pelo Telegram e manter o desenho preparado para um adaptador de WhatsApp depois.

---

## Objetivo

Adicionar ao SaasClinic um canal de atendimento por Telegram onde o paciente conversa com uma IA para:

- identificar-se por telefone, CPF ou dados basicos;
- consultar medicos e horarios disponiveis;
- solicitar agendamento de consulta;
- confirmar os dados antes da criacao do agendamento;
- ser encaminhado para atendimento humano quando o fluxo ficar ambíguo ou sensivel.

O modulo nao substitui o servico `agendamento`. Ele funciona como um canal/orquestrador que conversa com Telegram no MVP, IA e os microsservicos internos.

---

## Decisao de canal: Telegram primeiro

A primeira implementacao deve usar Telegram, nao WhatsApp. Motivos:

- menor atrito para desenvolvimento e homologacao: basta criar um bot e configurar token/webhook;
- nao exige WhatsApp Business Account, numero vinculado, templates aprovados ou janela de atendimento;
- permite validar o fluxo conversacional, Spring AI, tool calling, idempotencia e criacao de agendamento antes de lidar com as regras da Meta;
- reduz custo e burocracia enquanto o produto ainda esta em fase de prova.

**Decisao aplicada:** o core do modulo deve ser independente do canal. Telegram entra como primeiro adaptador de entrada/saida. WhatsApp entra depois como outro adaptador, reaproveitando conversa, IA, tools e orquestracao.

Modelo conceitual:

```text
Canal externo
  -> Adaptador Telegram no MVP
  -> Adaptador WhatsApp no futuro
      |
      v
Core secretaria-ia
  -> estado conversacional
  -> IA/tool calling
  -> clientes administrativo/agendamento
```

Com isso, nomes de dominio devem evitar acoplamento ao WhatsApp. Use `canal`, `provider`, `provider_user_id`, `provider_chat_id` e `mensagens_canal` no banco. O telefone pode existir como dado opcional quando o usuario informar CPF ou compartilhar contato, mas nao deve ser a chave primaria da conversa no MVP Telegram.

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
Paciente Telegram
      |
      v
Telegram Bot API
      |
      v
API Gateway
  /api/secretaria-ia/webhooks/telegram
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
- integracao com provedor de mensagem, inicialmente Telegram e futuramente WhatsApp.

---

## Escopo do MVP

Fluxos incluidos:

1. receber mensagens de texto do Telegram;
2. validar o segredo configurado no webhook do Telegram;
3. ignorar mensagens duplicadas por `provider_update_id`/`provider_message_id`;
4. identificar paciente existente por CPF ou telefone informado no fluxo;
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
├── canal/
│   ├── CanalMensagemClient.java
│   ├── CanalMensagemEntrada.java
│   ├── CanalMensagemSaida.java
│   └── CanalProvider.java
├── telegram/
│   ├── TelegramWebhookController.java
│   ├── TelegramWebhookVerifier.java
│   ├── TelegramWebhookParser.java
│   ├── TelegramClient.java
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
| `POST` | `/webhooks/telegram` | segredo do webhook | entrada de mensagens do Telegram |
| `GET` | `/v1/conversas/{canal}/{providerUserId}` | JWT interno | auditoria futura |
| `POST` | `/v1/conversas/{id}/handoff` | JWT interno | marcar atendimento humano |

Rota no gateway:

| Externo | Interno |
|---|---|
| `/api/secretaria-ia/webhooks/telegram` | `secretaria-ia:/webhooks/telegram` |

O filtro JWT do gateway deve liberar apenas o webhook publico do Telegram. Rotas administrativas do `secretaria-ia` continuam com JWT. Quando o WhatsApp entrar, ele deve receber rota propria, por exemplo `/api/secretaria-ia/webhooks/whatsapp`, usando o mesmo core conversacional.

---

## Modelo de dados

Banco: `clinica_secretaria_ia`.

Tabelas minimas:

### `conversas`

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `canal` | VARCHAR(20) | `TELEGRAM` no MVP; `WHATSAPP` no futuro |
| `provider_user_id` | VARCHAR(128) | id do usuario no provedor |
| `provider_chat_id` | VARCHAR(128) | id da conversa/chat no provedor |
| `telefone` | VARCHAR(20) NULL | telefone normalizado quando informado/compartilhado |
| `paciente_id` | BIGINT NULL | id logico do `administrativo` |
| `estado` | VARCHAR(40) | estado atual do fluxo |
| `intencao` | VARCHAR(40) | agendar, cancelar, duvida, humano |
| `dados_parciais_json` | JSON/TEXT | slots coletados |
| `handoff_humano` | BOOLEAN | se precisa recepcionista |
| `created_at` | DATETIME | auditoria |
| `updated_at` | DATETIME | auditoria |

### `mensagens_canal`

| Campo | Tipo | Observacao |
|---|---|---|
| `id` | BIGINT | PK |
| `conversa_id` | BIGINT | FK local |
| `canal` | VARCHAR(20) | `TELEGRAM` no MVP |
| `provider_update_id` | VARCHAR(128) | idempotencia de evento/update |
| `provider_message_id` | VARCHAR(128) NULL | id da mensagem quando existir |
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
- nao aceitar dados sensiveis desnecessarios pelo canal de mensagem;
- nao prometer encaixe;
- transferir para humano em urgencia, ambiguidade persistente ou conflito de dados.

Prompt de sistema deve deixar claro que a IA e uma secretaria de agenda, nao uma medica.

---

## Ajustes necessarios em servicos existentes

### `administrativo`

Adicionar consultas de apoio:

| Metodo | Rota | Uso |
|---|---|---|
| `GET` | `/v1/pacientes/telefone/{telefone}` | localizar paciente quando telefone for informado ou compartilhado |
| `GET` | `/v1/pacientes/cpf/{cpf}` | localizar paciente quando telefone nao foi informado ou nao bater |
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

## Telegram Bot API

Configuracoes necessarias no Telegram:

- bot criado no BotFather;
- token do bot configurado fora do codigo;
- webhook apontando para o gateway;
- segredo do webhook configurado;
- politica de logs sem token, chat id sensivel ou conteudo excessivo.

Variaveis de ambiente:

```properties
TELEGRAM_BOT_TOKEN=trocar
TELEGRAM_WEBHOOK_SECRET=trocar
TELEGRAM_API_BASE_URL=https://api.telegram.org
```

Seguranca do webhook:

- `POST /webhooks/telegram` valida o segredo configurado para o webhook;
- payload invalido deve retornar `401` ou `403`;
- payload duplicado deve retornar `200` sem reprocessar.

### WhatsApp Cloud API futura

Quando o MVP estiver validado no Telegram, o WhatsApp deve entrar como segundo adaptador de canal. O core nao deve mudar; devem mudar apenas parser, verificacao de webhook, cliente de envio e variaveis do provedor.

Configuracoes esperadas na fase WhatsApp:

- app no Meta for Developers;
- WhatsApp Business Account;
- numero de telefone vinculado;
- callback URL apontando para o gateway;
- verify token configurado;
- permissao/token para envio de mensagens;
- templates aprovados para mensagens iniciadas fora da janela de atendimento.

Variaveis futuras:

```properties
WHATSAPP_VERIFY_TOKEN=trocar
WHATSAPP_ACCESS_TOKEN=trocar
WHATSAPP_PHONE_NUMBER_ID=trocar
WHATSAPP_APP_SECRET=trocar
WHATSAPP_GRAPH_API_VERSION=versao_suportada_no_app_meta
```

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
5. Criar porta generica de canal.
6. Criar adaptador Telegram com controller de webhook e cliente de envio.

### PASSO 3 - IA e orquestracao

1. Criar prompt de sistema.
2. Criar tools controladas.
3. Implementar maquina de estados conversacional.
4. Integrar envio de resposta ao Telegram via porta de canal.

### PASSO 4 - Gateway e Docker

1. Adicionar rota `/api/secretaria-ia/**`.
2. Liberar webhook publico `/api/secretaria-ia/webhooks/telegram` no filtro JWT.
3. Adicionar servico no Compose.
4. Adicionar variaveis nos `.env.example`.
5. Adicionar SQL de init para `clinica_secretaria_ia`.

### PASSO 5 - Adaptador WhatsApp futuro

1. Criar pacote `whatsapp/` implementando a mesma porta de canal.
2. Adicionar parser/verificador do webhook da Meta.
3. Adicionar cliente de envio da WhatsApp Cloud API.
4. Criar rota `/api/secretaria-ia/webhooks/whatsapp`.
5. Reaproveitar os mesmos testes de core, adicionando testes especificos do provedor.

---

## Testes

Unitarios:

- parser de payload do Telegram;
- validacao do segredo do webhook;
- idempotencia por `provider_update_id`;
- transicoes de estado;
- confirmacao explicita vs resposta ambigua;
- handoff humano.

Controller:

- webhook `POST` com segredo valido;
- webhook `POST` com segredo invalido;
- payload duplicado retorna `200` sem chamar IA.

Integracao:

- Feign para `administrativo`;
- Feign para `agendamento`;
- criacao de agendamento apos confirmacao.

Smoke manual:

1. enviar mensagem "quero agendar uma consulta" para o bot do Telegram;
2. informar CPF quando solicitado;
3. escolher medico/periodo;
4. confirmar um horario;
5. verificar agendamento criado em `/api/agendamentos/v1/agendamentos`.

---

## LGPD e seguranca

Cuidados minimos:

- mascarar CPF e telefone em logs;
- nao logar token do Telegram, token da Meta nem chave da OpenAI;
- tratar `provider_user_id`, `provider_chat_id`, telefone e CPF como dados sensiveis;
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
- Telegram Bot API: https://core.telegram.org/bots/api
- Telegram Bots: https://core.telegram.org/bots
- Meta WhatsApp Cloud API futura: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Meta WhatsApp Webhooks futura: https://developers.facebook.com/docs/graph-api/webhooks/
