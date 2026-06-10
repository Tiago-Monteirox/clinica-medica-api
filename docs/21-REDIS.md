# 21 — Redis como evolução

> Proposta de implementação. Redis não faz parte do MVP atual, mas é uma evolução válida para cache de validações, rate limit no gateway e, opcionalmente, blacklist de JWT.

---

## Decisão recomendada

Implementar Redis em duas etapas:

1. **Cache no `agendamento`** para respostas de `pacienteExiste` e `medicoExiste`.
2. **Rate limit no `gateway`** usando Spring Cloud Gateway + Redis.

Blacklist de JWT pode ficar como terceira etapa, apenas se o projeto precisar de logout/revogação real antes do vencimento do token.

---

## Por que Redis aqui

Hoje o `agendamento` chama o `administrativo` via Feign para validar paciente e médico antes de criar ou atualizar um agendamento. Essa validação síncrona é correta porque a resposta da API depende dela, mas pode gerar chamadas repetidas para dados pouco mutáveis.

Redis entra como cache distribuído para reduzir chamadas repetidas sem trocar o contrato entre serviços:

```text
cliente
  |
  v
gateway
  |
  v
agendamento
  |
  +--> Redis: cache paciente/medico existe?
  |
  +--> administrativo via Feign: fallback em cache miss
```

Redis também pode apoiar o gateway com rate limit por usuário/IP:

```text
cliente -> gateway -> RedisRateLimiter -> microsserviços
```

---

## O que não fazer

- Não usar Redis como fonte de verdade de paciente, médico ou agendamento.
- Não substituir validação crítica por cache sem TTL.
- Não cachear dados clínicos sensíveis do `atendimento`.
- Não colocar JWT completo em cache sem necessidade.
- Não adicionar Redis apenas para "ter mais uma tecnologia" na stack.

---

## Etapa 1 — Cache no `agendamento`

### Dependências

Adicionar no `agendamento/pom.xml`:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### Configuração

Em `AgendamentoApplication`:

```java
@EnableCaching
@SpringBootApplication(scanBasePackages = "br.edu.imepac")
@EnableFeignClients
public class AgendamentoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AgendamentoApplication.class, args);
    }
}
```

Em `application.yml` do `agendamento`:

```yaml
spring:
  cache:
    type: redis
    redis:
      time-to-live: ${CACHE_TTL:5m}
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
```

### Onde aplicar

Não coloque `@Cacheable` diretamente no Feign client. Crie um serviço pequeno de validação no `agendamento`, mantendo o Feign como detalhe de infraestrutura:

```java
@Service
@RequiredArgsConstructor
public class AdministrativoLookupService {

    private final AdministrativoClient administrativoClient;

    @Cacheable(cacheNames = "paciente-exists", key = "#pacienteId")
    public boolean pacienteExiste(Long pacienteId) {
        return administrativoClient.pacienteExiste(pacienteId).exists();
    }

    @Cacheable(cacheNames = "medico-exists", key = "#medicoId")
    public boolean medicoExiste(Long medicoId) {
        return administrativoClient.medicoExiste(medicoId).exists();
    }
}
```

O `AgendamentoService` passa a depender desse lookup:

```java
if (!lookupService.pacienteExiste(request.getPacienteId())) {
    throw new EntityNotFoundException("Paciente", request.getPacienteId());
}

if (!lookupService.medicoExiste(request.getMedicoId())) {
    throw new EntityNotFoundException("Médico", request.getMedicoId());
}
```

### TTL recomendado

| Cache | TTL | Motivo |
|---|---:|---|
| `paciente-exists` | 5 min | paciente muda pouco, mas pode ser removido |
| `medico-exists` | 10 min | médico muda pouco |

TTL curto evita inconsistência longa quando um médico/paciente é removido no `administrativo`.

---

## Invalidação de cache

No MVP, TTL curto é suficiente. Se quiser uma solução mais correta, use eventos de domínio com RabbitMQ depois:

```text
administrativo publica PacienteAlteradoEvent
agendamento consome e limpa paciente-exists::<id>
```

Sem mensageria, o `administrativo` não deve chamar o Redis do `agendamento`; isso criaria acoplamento entre serviços.

---

## Etapa 2 — Redis no Docker Compose

Adicionar Redis nos overlays de ambiente.

### Homologation

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_HOST_PORT:-6379}:6379"
    command: ["redis-server", "--appendonly", "no"]
    networks:
      - clinica-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  agendamento:
    environment:
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      redis:
        condition: service_healthy
```

### Production local

Para a demonstração local, pode ser um Redis único:

```yaml
services:
  redis:
    image: redis:7-alpine
    networks:
      - clinica-net
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

Em produção real, Redis deveria ser gerenciado, com autenticação, TLS e política de eviction definida.

---

## Etapa 3 — Rate limit no gateway

Se o objetivo for demonstrar proteção de borda, Redis faz sentido no `gateway` com `RequestRateLimiter`.

### Dependência

Adicionar no `gateway/pom.xml`:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
</dependency>
```

### Key resolver

```java
@Bean
public KeyResolver userOrIpKeyResolver() {
    return exchange -> exchange.getPrincipal()
        .map(Principal::getName)
        .switchIfEmpty(Mono.just(
            exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
        ));
}
```

### Rota com rate limit

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: agendamento
          uri: ${AGENDAMENTO_URL:http://localhost:8082}
          predicates:
            - Path=/api/agendamentos/**
          filters:
            - StripPrefix=2
            - name: RequestRateLimiter
              args:
                key-resolver: "#{@userOrIpKeyResolver}"
                redis-rate-limiter.replenishRate: 10
                redis-rate-limiter.burstCapacity: 20
```

Para apresentação, limite por IP já é suficiente. Em produto real, prefira usuário/tenant quando houver multi-tenancy.

---

## Etapa opcional — blacklist de JWT

O JWT atual é stateless. Logout real antes do token expirar exige algum estado compartilhado. Redis pode guardar o `jti` ou hash do token até o vencimento:

```text
jwt:blacklist:<jti> -> true
TTL = exp - now
```

Critério para implementar:

- existe endpoint `POST /auth/logout`;
- tokens têm claim `jti`;
- filtro JWT consulta Redis antes de aceitar o token.

Se o projeto não precisa de logout/revogação, não implemente. Expiração curta de token é mais simples.

---

## Testes esperados

| Escopo | Teste |
|---|---|
| Lookup cacheado | primeira chamada aciona Feign; segunda usa cache |
| TTL | após expirar, chamada volta a acionar Feign |
| Cache miss | paciente/médico inexistente continua retornando 404 |
| Gateway | excesso de requests retorna `429 Too Many Requests` |
| Ambiente sem Redis | aplicação falha rápido ou cache fica desabilitado explicitamente por profile |

Para teste automatizado de Redis, usar Testcontainers:

```java
@Container
static GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
    .withExposedPorts(6379);
```

---

## Definition of Done

- `docker compose` sobe Redis saudável em homologation.
- `agendamento` usa Redis para cache de `pacienteExiste` e `medicoExiste`.
- TTL configurável por variável de ambiente.
- Fluxo de criação de agendamento continua correto com cache frio e cache quente.
- Gateway aplica rate limit e retorna `429` quando excedido.
- Docs deixam claro que Redis é cache/infra, não fonte de verdade.
