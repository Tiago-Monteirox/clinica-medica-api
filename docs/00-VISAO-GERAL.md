# 00 — Visão Geral

> Tempo de leitura: ~10 minutos

## Domínio

Sistema de gestão para uma clínica médica de pequeno/médio porte. O sistema deve permitir que a equipe administrativa cadastre convênios, pacientes e médicos; que a recepção crie agendamentos; e que os médicos registrem o atendimento clínico (diagnóstico e prescrição).

A modelagem segue o estilo **didático** dos guias de microsserviços usados na disciplina (separação por domínio, baixo acoplamento, comunicação via REST), mas incorpora padrões reais de mercado vistos no projeto exemplo `app-order-service`: OpenFeign, Swagger, ApiResponse genérico, GlobalExceptionHandler, Testcontainers.

---

## Atores

Quatro perfis foram identificados nos diagramas de caso de uso:

| Ator | Permissões principais |
|---|---|
| **Administrador** | Tudo. CRUDs completos de Convênio, Paciente, Médico. Acesso administrativo. |
| **Recepcionista** | Cadastra/atualiza pacientes; consulta médicos; gerencia agendamentos. |
| **Médico** | Consulta sua agenda; registra atendimentos (diagnóstico/prescrição). |
| **Paciente** | Consulta e cancela o próprio agendamento. |

A autenticação é centralizada no **API Gateway** com JWT. As roles emitidas no token determinam o acesso aos endpoints.

---

## Escopo MVP

O MVP entrega os seguintes fluxos ponta a ponta:

1. **Login** → token JWT.
2. **Cadastrar Convênio** (administrativo).
3. **Cadastrar Paciente** com convênio opcional (administrativo).
4. **Cadastrar Médico** (administrativo).
5. **Criar Agendamento** validando paciente e médico via Feign (agendamento → administrativo).
6. **Listar agenda** do médico ou do paciente (agendamento).
7. **Registrar Atendimento** referenciando o agendamento (atendimento → agendamento via Feign).
8. **Documentação automática** dos endpoints via Swagger UI.
9. **Stack** subindo via `docker compose up`.

Fora do escopo do MVP (mas documentados como evolução): mensageria assíncrona, notificações, prontuário longitudinal, relatórios.

---

## Mapeamento Domínio → Microsserviço

| Domínio (Bounded Context) | Microsserviço | Banco | Porta |
|---|---|---|---|
| Cadastros mestres (Convênio, Paciente, Médico) | `administrativo` | `clinica_administrativo` | 8081 |
| Agendamento e agenda | `agendamento` | `clinica_agendamento` | 8082 |
| Atendimento clínico | `atendimento` | `clinica_atendimento` | 8083 |
| Roteamento e segurança | `gateway` | — | 8080 |
| Biblioteca técnica compartilhada | `commons` | — | — |

**Regra de ouro aplicada:** se duas entidades mudam juntas, ficam no mesmo serviço; se mudam separadas, vão para serviços diferentes. Convênio, Paciente e Médico mudam pelas mesmas regras administrativas → mesmo serviço. Agendamento muda por regras de agenda (conflito de horário, cancelamento) → serviço próprio. Atendimento muda por regras clínicas → serviço próprio.

---

## Entidades principais (visão lógica)

```
Convenio (1) ─── (0..1) Paciente
                     │
                     │ (id apenas, sem FK física)
                     ▼
              Agendamento ◄── pacienteId, medicoId, dataHora, status
                     │
                     │ (id apenas, sem FK física)
                     ▼
              Atendimento ◄── agendamentoId, diagnostico, prescricao
                                pacienteId, medicoId (denormalizados)
```

**Regra crítica do database-per-service:** não existem foreign keys cruzando bancos. As referências entre serviços são **IDs lógicos**. A integridade é garantida via Feign no momento da criação (validação síncrona).

---

## Decisões de produto (resumo)

| Decisão | Escolha | Motivação |
|---|---|---|
| Banco | **Database-per-service** com 3 instâncias MySQL | Padrão real de microsserviços; alinhado ao exemplo `app-order-service` |
| Comunicação | **OpenFeign** declarativo | Mais limpo que `RestTemplate`; tradutor de erros via `ErrorDecoder` |
| Autenticação | **JWT próprio** (não Keycloak) | Menos infraestrutura para a faculdade; suficiente para demonstrar Spring Security |
| Convênio × Paciente | **N:1 opcional** (`convenio_id` nullable) | Realista; nem todo paciente tem convênio |
| Documentação | **SpringDoc OpenAPI** (`/swagger-ui.html` por serviço) | Padrão de mercado |
| Logging HTTP | **Logbook** (Zalando) | Visibilidade do tráfego entre serviços |
| Mapeamento DTO↔Entity | **ModelMapper** | Já adotado no commons existente |
| Testes | **JUnit 5 + Mockito + MockMvc/WebMvcTest**; Testcontainers preparado | 89 testes cobrindo services, controllers, gateway, publisher e consumer |
| Cache | **Redis** via `@Cacheable` no `agendamento` | Reduz chamadas Feign repetidas para `paciente-exists`/`medico-exists`; TTL configurável |
| Rate limit | **RequestRateLimiter** (Spring Cloud Gateway + Redis) | Token bucket por usuário/IP nas rotas `/auth/**` e `/api/agendamentos/**` |
| Mensageria | **RabbitMQ** (exchange `clinica.events`, topologia topic) | Desacopla registro de atendimento da atualização de status do agendamento; DLQ para falhas |
| CI/CD | **GitHub Actions** | Substitui Jenkins do guia original; nativo do GitHub |
| Build | **Maven multi-módulo** | `commons` instalado uma vez, herdado por todos via `dependencyManagement` |

---

## Evolução implementada (além do MVP original)

Após o MVP, as seguintes funcionalidades foram adicionadas como demonstração de boas práticas:

| Evolução | Módulos envolvidos | Documento |
|---|---|---|
| **Redis** — cache de validação `paciente-exists`/`medico-exists`, rate limit no gateway (token bucket), blacklist JWT por `jti` | `agendamento`, `gateway` | [`21-REDIS.md`](21-REDIS.md) |
| **RabbitMQ** — evento `AtendimentoRegistradoEvent` publicado pelo `atendimento`; `agendamento` consome e marca status `ATENDIDO`; DLQ para falhas | `atendimento`, `agendamento` | [`22-RABBITMQ.md`](22-RABBITMQ.md) |
| **Secretaria IA no WhatsApp** — módulo planejado para atendimento conversacional, Spring AI e criação de agendamentos com confirmação explícita | `secretaria-ia`, `gateway`, `administrativo`, `agendamento` | [`24-SECRETARIA-IA.md`](24-SECRETARIA-IA.md) |

---

## Não-objetivos (deliberadamente fora)

- **Service Discovery** (Eureka): URLs configuráveis via variável de ambiente bastam.
- **Distributed tracing** (Zipkin/Jaeger): pode ser adicionado depois.
- **Migrações de schema** (Flyway/Liquibase): `ddl-auto=update` é aceitável para o escopo didático.

---

## Próximo passo

Vá para [`01-ARQUITETURA.md`](01-ARQUITETURA.md) para entender o desenho técnico, ou pule direto para o [`02-ROTEIRO.md`](02-ROTEIRO.md) se já estiver familiarizado com a arquitetura.
