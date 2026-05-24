# 18 — Logging com SLF4J + Lombok

> Convenções, decisões e exemplos de logging estruturado em todos os microsserviços do projeto.

---

## Decisão

Todo logging do código de negócio usa **SLF4J** (interface) com **Logback** (implementação default do Spring Boot), via a annotation **`@Slf4j`** do Lombok para evitar boilerplate.

```java
@Slf4j  // injeta automaticamente `private static final Logger log = LoggerFactory.getLogger(<className>);`
@Service
public class AuthService {
    public LoginResponse login(LoginRequest request) {
        log.info("Tentativa de login para {}", request.email());
        // ...
    }
}
```

Por que essa pilha:

- **SLF4J** é a interface padrão de logging em Java desde 2005. Compatível com Logback, Log4j2, java.util.logging.
- **Logback** já vem com o Spring Boot — zero configuração extra.
- **`@Slf4j`** (Lombok) reduz 3 linhas de boilerplate por classe para 1 annotation. Lombok já é dependência de todos os módulos.

---

## Convenções de uso

### Níveis

| Nível | Quando usar | Exemplos no projeto |
|---|---|---|
| `log.error` | exceção não tratada, falha que afeta o sistema | `GlobalExceptionHandler.handleGeneral` — captura tudo que não casa com exceções específicas |
| `log.warn` | comportamento anormal mas esperado (validação que falha, tentativa não autorizada, recurso não encontrado) | login com senha errada, médico já com agendamento no horário, paciente inexistente em validação Feign |
| `log.info` | eventos de negócio importantes (entry/exit de operações que mudam estado) | login OK, agendamento criado, atendimento registrado, usuário admin seedado |
| `log.debug` | detalhes internos úteis em debug, **desligados** por default em produção | filtro JWT rejeitando token, decisões de roteamento |
| `log.trace` | granularidade extrema, raramente usado | — |

### Granularidade

Estilo **"trace points importantes"**: 1-2 linhas por operação de negócio (entry/exit), `warn` em cada validação que falha, sem logs em cada decisão interna. Isso entrega:

- ~3-5 linhas de log por request bem-sucedido (gateway + admin/agen/aten);
- 1-2 linhas extras por validação que falha (mostra na hora exatamente o que recusou);
- nenhum log spam em loops, getters, mapeamentos.

### Mensagens — boas práticas

- **Use placeholders `{}` do SLF4J**, nunca concatenação:
  ```java
  log.info("Agendamento {} criado para paciente {}", id, pacienteId);  // OK
  log.info("Agendamento " + id + " criado para paciente " + pacienteId); // EVITAR
  ```
  Motivo: SLF4J só substitui se o nível estiver ativo — concatenação é executada sempre.

- **Português** nas mensagens (alinha com o domínio do projeto).

- **Identificadores no início**, contexto no fim:
  ```java
  log.info("Atendimento {} registrado (agendamento={}, paciente={}, médico={})", ...);
  ```

- **NUNCA logar dados sensíveis**: senhas, hashes, tokens JWT completos, números de cartão. Logar e-mail/id é OK.

### Quando NÃO logar

- **Controllers que só delegam** para o service — o service já loga. Duplica.
- **DTOs, Entities, Repositories** — sem lógica de negócio.
- **Getters/setters/builders** — Lombok já gera.
- **Sucesso de uma validação interna trivial** (`existsByEmail` retornando false). Se passou, segue. Logue só quando falhar.

---

## Pattern de log

Mantemos o **default do Spring Boot**:

```
2026-05-24T16:23:36.699Z  INFO 1 --- [administrativo] [main] b.e.i.a.AuthService : Tentativa de login para admin@clinica.com
```

Campos:

| Campo | Exemplo |
|---|---|
| Timestamp ISO-8601 UTC | `2026-05-24T16:23:36.699Z` |
| Level | `INFO` |
| PID | `1` (sempre 1 em container) |
| Application name | `[administrativo]` (vem de `spring.application.name`) |
| Thread | `[main]` |
| Logger (classe abreviada) | `b.e.i.a.AuthService` |
| Mensagem | `Tentativa de login para admin@clinica.com` |

Não precisamos de pattern customizado neste estágio. Para tracking entre serviços via Feign, MDC com `X-Request-Id` é uma evolução futura (PASSO opcional).

---

## Configuração por ambiente

Cada serviço tem em `application.yml`:

```yaml
logging:
  level:
    br.edu.imepac: ${LOG_LEVEL_APP:INFO}
```

- Default: **INFO** para o pacote da aplicação.
- Override via env var no `.env`:
  ```
  LOG_LEVEL_APP=DEBUG     # ver tudo (debug do filtro JWT, etc.)
  ```
- Frameworks (Spring, Hibernate, Tomcat) seguem o nível default deles (`INFO` ou `WARN`).

Em production, deixe `INFO`. Em homologation, suba para `DEBUG` quando precisar investigar comportamento de filtro JWT, Feign, etc.

---

## Onde logamos em cada serviço

### `administrativo`

| Classe | Nível | Quando |
|---|---|---|
| `AdministrativoApplication.seedAdmin` | INFO | Admin seedado / seed pulado no boot |
| `AuthService.login` | INFO/WARN | Tentativa, OK, e-mail inexistente, senha errada |
| `AuthService.register` | INFO/WARN | Novo usuário, e-mail já cadastrado |
| `ConvenioService` | INFO/WARN | Criar, atualizar, remover, recusar remoção inexistente |
| `MedicoService` | INFO/WARN | Criar, atualizar, remover, e-mail/CRM duplicado |
| `PacienteService` | INFO/WARN | Criar, atualizar, remover, e-mail/CPF duplicado |
| `JwtAuthFilter` | DEBUG | Token JWT rejeitado |

### `agendamento`

| Classe | Nível | Quando |
|---|---|---|
| `AgendamentoService.criar` | INFO/WARN | Criar agendamento, paciente inexistente, médico inexistente, horário conflitante |
| `AgendamentoService.atualizar` | INFO/WARN | Atualizar, tentativa em status terminal |
| `AgendamentoService.cancelar` | INFO/WARN | Cancelar, tentativa em REALIZADO |

### `atendimento`

| Classe | Nível | Quando |
|---|---|---|
| `AtendimentoService.registrar` | INFO/WARN | Registrar atendimento, duplicado, agendamento ausente/inválido |

### `gateway`

| Classe | Nível | Quando |
|---|---|---|
| `JwtAuthenticationFilter` | WARN | JWT inválido descartado |

### `commons`

| Classe | Nível | Quando |
|---|---|---|
| `GlobalExceptionHandler.handleFeignIntegration` | WARN | Falha de integração entre serviços |
| `GlobalExceptionHandler.handleAccessDenied` | WARN | 403 |
| `GlobalExceptionHandler.handleNoCredentials` | WARN | 401 sem credenciais |
| `GlobalExceptionHandler.handleGeneral` | ERROR | Exceção não tratada |

---

## Como ler logs em desenvolvimento

### Container individual

```bash
docker compose logs -f administrativo
```

### Todos os serviços com prefixo

```bash
docker compose logs -f
```

### Apenas WARN+ (filtro local)

```bash
docker compose logs -f | grep -E "(WARN|ERROR)"
```

### UI visual (Dozzle)

```bash
docker compose --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  -f docker-compose.tools.yml \
  up -d
```

Abra `http://localhost:9999`, clique no container, veja logs em tempo real com cores e filtros. Ver [`docs/14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md#visualizar-containers-em-tempo-real-apresentação) para detalhes.

---

## Evoluções futuras (não implementadas)

| Item | Por quê seria útil | Custo |
|---|---|---|
| MDC com `X-Request-Id` | Rastrear uma requisição que percorre gateway → admin → agen → aten via Feign | Médio — precisa adicionar filtro pra propagar header + ajustar pattern |
| JSON estruturado (`logstash-logback-encoder`) | Ingestão direta em Elastic / Loki / Datadog | Baixo — 1 dependência + `logback-spring.xml` |
| Sampling de logs em produção | Reduzir custo quando volume alto | Alto — requer infra de observabilidade externa |

Para o escopo atual do projeto (acadêmico, baixa carga), as evoluções acima são **overkill**. A pilha atual já entrega o que importa: rastreabilidade local + apresentação clara em demo.
