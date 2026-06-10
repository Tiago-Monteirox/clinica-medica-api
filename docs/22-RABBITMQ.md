# 22 — RabbitMQ como evolução

> Proposta de implementação. RabbitMQ não faz parte do MVP atual, mas é a evolução mais útil para reduzir acoplamento temporal entre microsserviços e demonstrar comunicação assíncrona orientada a eventos.

---

## Decisão recomendada

Implementar RabbitMQ primeiro em um fluxo pequeno e defensável:

```text
atendimento registra atendimento
  |
  v
publica AtendimentoRegistradoEvent
  |
  v
agendamento consome evento
  |
  v
marca agendamento como ATENDIDO
```

Depois disso, os mesmos eventos podem alimentar notificações, auditoria ou analytics sem mudar o fluxo principal.

---

## Por que RabbitMQ aqui

Hoje a comunicação entre serviços é síncrona via Feign. Isso é correto para validações que precisam responder na hora, por exemplo:

- `agendamento` valida se paciente existe no `administrativo`;
- `atendimento` valida se o agendamento existe no `agendamento`.

RabbitMQ entra onde a resposta imediata não precisa depender do outro serviço. Após registrar um atendimento, o cliente já pode receber `201 Created`; atualizar o status do agendamento para `ATENDIDO` pode acontecer de forma assíncrona.

---

## O que não substituir

Não use RabbitMQ para validações críticas da request atual:

- criar agendamento ainda deve validar paciente/médico via Feign;
- registrar atendimento ainda deve validar o agendamento via Feign;
- autenticação/autorização continua com JWT e Spring Security.

RabbitMQ complementa o Feign. Não substitui tudo.

---

## Evento inicial

### Nome

`AtendimentoRegistradoEvent`

### Publicador

`atendimento`

### Consumidor inicial

`agendamento`

### Contrato

```json
{
  "eventId": "6e7f1a2b-3b6d-4f70-81a1-0ef3a1b6a777",
  "eventType": "AtendimentoRegistrado",
  "occurredAt": "2026-06-10T15:30:00Z",
  "agendamentoId": 42,
  "atendimentoId": 99,
  "pacienteId": 10,
  "medicoId": 7
}
```

### Regras

- `eventId` deve ser UUID para idempotência.
- `occurredAt` deve usar UTC.
- O evento carrega IDs, não objetos completos.
- Dados clínicos sensíveis, como diagnóstico e prescrição, não devem ir no evento inicial.

---

## Topologia RabbitMQ

```text
exchange: clinica.events
type: topic

routing key: atendimento.registrado

queue: agendamento.atendimento-registrado
binding: atendimento.registrado

DLQ: agendamento.atendimento-registrado.dlq
```

Motivo para `topic`: permite evoluir para chaves como `paciente.alterado`, `medico.alterado`, `agendamento.cancelado` e `notificacao.enviar` sem redesenhar tudo.

---

## Dependências

Adicionar nos módulos que publicam ou consomem eventos.

No `atendimento/pom.xml`:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

No `agendamento/pom.xml`:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

---

## Configuração

Em `application.yml` dos serviços envolvidos:

```yaml
spring:
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: ${RABBITMQ_PORT:5672}
    username: ${RABBITMQ_USER:clinica}
    password: ${RABBITMQ_PASSWORD:clinica}

clinica:
  events:
    exchange: ${CLINICA_EVENTS_EXCHANGE:clinica.events}
    atendimento-registrado-routing-key: atendimento.registrado
    agendamento-atendimento-registrado-queue: agendamento.atendimento-registrado
```

---

## Docker Compose

Adicionar RabbitMQ nos overlays de ambiente:

```yaml
services:
  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    ports:
      - "${RABBITMQ_HOST_PORT:-5672}:5672"
      - "${RABBITMQ_MANAGEMENT_HOST_PORT:-15672}:15672"
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER:-clinica}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-clinica}
    networks:
      - clinica-net
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  atendimento:
    environment:
      RABBITMQ_HOST: rabbitmq
      RABBITMQ_PORT: 5672
      RABBITMQ_USER: ${RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
    depends_on:
      rabbitmq:
        condition: service_healthy

  agendamento:
    environment:
      RABBITMQ_HOST: rabbitmq
      RABBITMQ_PORT: 5672
      RABBITMQ_USER: ${RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
    depends_on:
      rabbitmq:
        condition: service_healthy
```

Management UI local:

```text
http://localhost:15672
```

Em produção real, a UI de management não deve ficar exposta publicamente.

---

## Declaração de exchange e filas

Criar configuração comum no serviço consumidor, ou em uma lib técnica se mais módulos passarem a consumir eventos.

```java
@Configuration
public class RabbitEventsConfig {

    public static final String EXCHANGE = "clinica.events";
    public static final String QUEUE = "agendamento.atendimento-registrado";
    public static final String ROUTING_KEY = "atendimento.registrado";

    @Bean
    TopicExchange clinicaEventsExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE)
            .durable(true)
            .build();
    }

    @Bean
    Queue atendimentoRegistradoQueue() {
        return QueueBuilder.durable(QUEUE)
            .deadLetterExchange(EXCHANGE)
            .deadLetterRoutingKey("atendimento.registrado.dlq")
            .build();
    }

    @Bean
    Binding atendimentoRegistradoBinding() {
        return BindingBuilder
            .bind(atendimentoRegistradoQueue())
            .to(clinicaEventsExchange())
            .with(ROUTING_KEY);
    }
}
```

---

## Publicação no `atendimento`

Após persistir o atendimento, publicar o evento:

```java
@Service
@RequiredArgsConstructor
public class AtendimentoEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publicarAtendimentoRegistrado(AtendimentoEntity atendimento) {
        var event = new AtendimentoRegistradoEvent(
            UUID.randomUUID(),
            "AtendimentoRegistrado",
            Instant.now(),
            atendimento.getAgendamentoId(),
            atendimento.getId(),
            atendimento.getPacienteId(),
            atendimento.getMedicoId()
        );

        rabbitTemplate.convertAndSend(
            "clinica.events",
            "atendimento.registrado",
            event
        );
    }
}
```

Chamar o publisher depois do `repository.save(...)`.

Para o projeto acadêmico, publicar após o commit já é suficiente. Para produção real, prefira **outbox pattern** para evitar o caso "salvou no banco, mas caiu antes de publicar".

---

## Consumo no `agendamento`

O consumidor deve ser idempotente. Se receber o mesmo evento duas vezes, não pode quebrar o estado.

```java
@Component
@RequiredArgsConstructor
public class AtendimentoRegistradoConsumer {

    private final AgendamentoRepository repository;

    @RabbitListener(queues = "agendamento.atendimento-registrado")
    @Transactional
    public void consumir(AtendimentoRegistradoEvent event) {
        var agendamento = repository.findById(event.agendamentoId())
            .orElseThrow(() -> new EntityNotFoundException("Agendamento", event.agendamentoId()));

        if (agendamento.getStatus() == StatusAgendamento.ATENDIDO) {
            return;
        }

        agendamento.setStatus(StatusAgendamento.ATENDIDO);
        repository.save(agendamento);
    }
}
```

Se o enum atual ainda não tiver `ATENDIDO`, adicionar esse status ou mapear para o status equivalente já existente.

---

## Tratamento de erro

Configuração mínima recomendada:

- retry curto para falhas transitórias;
- DLQ para mensagens que continuam falhando;
- logs com `eventId`, `routingKey` e `agendamentoId`;
- alerta manual na apresentação via RabbitMQ Management UI.

Exemplo de política:

```yaml
spring:
  rabbitmq:
    listener:
      simple:
        retry:
          enabled: true
          initial-interval: 1s
          max-attempts: 3
          multiplier: 2
```

---

## Idempotência

RabbitMQ entrega mensagens pelo menos uma vez. O consumidor precisa aceitar duplicidade.

Opções:

1. Idempotência por estado: se agendamento já está `ATENDIDO`, retorna sem erro.
2. Tabela `processed_events`: grava `eventId` processado com constraint unique.

Para o primeiro fluxo, idempotência por estado é suficiente. Para eventos financeiros ou efeitos externos, use `processed_events`.

---

## Testes esperados

| Escopo | Teste |
|---|---|
| Publicador | ao registrar atendimento, envia `AtendimentoRegistradoEvent` com IDs corretos |
| Consumidor | evento muda status do agendamento para `ATENDIDO` |
| Idempotência | consumir o mesmo evento duas vezes não falha |
| Erro | evento com `agendamentoId` inexistente vai para retry/DLQ ou gera log rastreável |
| Integração | Testcontainers sobe RabbitMQ e valida publish/consume real |

Exemplo com Testcontainers:

```java
@Container
static RabbitMQContainer RABBIT = new RabbitMQContainer("rabbitmq:3.13-management-alpine");
```

---

## Evoluções futuras

Depois do primeiro evento, bons próximos passos:

- `AgendamentoCanceladoEvent` para auditoria e notificação;
- `PacienteAlteradoEvent` e `MedicoAlteradoEvent` para invalidar cache Redis no `agendamento`;
- serviço `notificacao` consumindo eventos para e-mail/SMS/WhatsApp;
- serviço `auditoria` gravando trilha de eventos de negócio;
- outbox pattern para publicação transacional.

---

## Definition of Done

- RabbitMQ sobe saudável no Docker Compose.
- `atendimento` publica `AtendimentoRegistradoEvent` após registrar atendimento.
- `agendamento` consome o evento e atualiza o status do agendamento.
- O consumidor é idempotente.
- Falhas vão para retry e depois DLQ.
- RabbitMQ Management UI permite demonstrar exchange, queue, mensagem e DLQ localmente.
- Docs deixam claro que RabbitMQ é assíncrono e não substitui validações síncronas críticas.
