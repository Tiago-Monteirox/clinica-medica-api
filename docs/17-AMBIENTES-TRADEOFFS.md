# 17 — Tradeoffs entre Homologation e Production

> Material de apresentação. Justifica por que a **mesma codebase** roda em dois ambientes com topologias de banco diferentes (1 MySQL com 3 schemas vs. 3 bancos físicos separados), os tradeoffs operacionais de cada escolha e como provar que o código suporta os dois.
>
> Use junto com [`14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md) (guia de implementação) e os diagramas [`arquitetura-homologation.puml`](diagramas/arquitetura-homologation.puml) e [`arquitetura-production.puml`](diagramas/arquitetura-production.puml).

---

## Resumo executivo

A arquitetura do projeto é **database-per-service** lógico em homologation e **database-per-service físico** em production. **Não há duas codebases.** O mesmo código Java roda nos dois ambientes; o que muda é a configuração externa (`SPRING_DATASOURCE_URL`, usuário, senha) injetada via variáveis de ambiente. Na entrega atual, `production` é demonstrado localmente com 3 MySQLs dedicados via `docker-compose.production.yml`; em produção real, esses containers podem ser substituídos por DBaaS sem mudar o Java.

Essa portabilidade só é real porque o projeto respeita 6 regras de design que impedem o código de assumir que os dados de outros serviços estão no mesmo banco. As regras são apresentadas adiante.

A escolha entre 1 banco e 3 bancos não é uma decisão de código — é uma **decisão de operação** com tradeoffs de custo, latência, isolamento de falhas e complexidade de manutenção.

---

## As duas topologias lado a lado

### Homologation — isolamento lógico

```
                gateway
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
 administrativo agendamento atendimento
       │           │           │
       └───────────┴───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  MySQL único         │
        │  ├ clinica_admin     │
        │  ├ clinica_agendam.  │
        │  └ clinica_atendim.  │
        └──────────────────────┘
```

Um servidor MySQL hospeda três schemas. Cada serviço só conecta ao seu próprio schema.

### Production — isolamento físico

```
                gateway
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
 administrativo agendamento atendimento
       │           │           │
       ▼           ▼           ▼
   ┌──────┐    ┌──────┐    ┌──────┐
   │ DB   │    │ DB   │    │ DB   │
   │admin │    │agend │    │atend │
   │MySQL/│    │MySQL/│    │MySQL/│
   │DBaaS │    │DBaaS │    │DBaaS │
   └──────┘    └──────┘    └──────┘
```

Na entrega local, são três MySQLs em containers independentes. Em produção real, esses bancos podem ser instâncias gerenciadas/DBaaS. Em ambos os casos, host, credencial, backup e escala são próprios por serviço.

---

## Por que a mesma codebase atende os dois

Cada microsserviço só conhece **um** datasource. O `agendamento` não tem ideia de onde está o banco do `administrativo` — ele só fala HTTP com o serviço via Feign. Para o `agendamento`, o banco do `administrativo` poderia estar em outro planeta.

```
agendamento (Java)
    │
    ▼
spring.datasource.url = ???        ← uma única URL, um único banco
    │
    ▼
algum MySQL em algum host
```

Como cada serviço tem apenas 1 datasource e a comunicação entre serviços é exclusivamente REST, **a separação física dos bancos é invisível para o código**.

A `application.yml` de cada serviço usa placeholder com fallback:

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL:jdbc:mysql://localhost:3307/clinica_agendamento?...}
    username: ${SPRING_DATASOURCE_USERNAME:root}
    password: ${SPRING_DATASOURCE_PASSWORD:}
```

Trocar o ambiente é trocar **3 variáveis de ambiente**. Nada em Java muda.

---

## As 6 regras de design que tornam isso real

A portabilidade só é verdadeira se o código respeitar todas as regras abaixo. Quebrar uma só já amarra o sistema a "tudo no mesmo banco" e impede a migração para production.

### 1. Nenhum JOIN entre schemas ou bancos

**Armadilha clássica em homologation:**

```sql
-- Funciona em homologation (mesmo MySQL), quebra em production
SELECT a.*, m.nome
FROM clinica_agendamento.agendamentos a
JOIN clinica_administrativo.medicos m ON a.medico_id = m.id;
```

Em production o schema `clinica_administrativo` está em **outro host** — não há JOIN possível.

✅ **Estado do projeto:** todas as consultas usam apenas o schema próprio do serviço.

### 2. Nenhuma foreign key entre serviços

`@JoinColumn` ou FK SQL entre tabelas de domínios diferentes funcionam em hom (mesmo MySQL aceita), mas são impossíveis em prod.

✅ **Estado do projeto:** `pacienteId`/`medicoId` em `agendamento` são `Long` puros. Sem `@ManyToOne` cross-domínio. FKs existem apenas internamente (ex.: `paciente.convenio_id` dentro do `administrativo`).

### 3. Nada de stored procedure, trigger ou view cross-schema

Objetos de banco que mexem em mais de um schema dependem de tudo estar na mesma instância física.

✅ **Estado do projeto:** toda a lógica está em Java/Spring Data. Zero stored procedure.

### 4. Cada serviço só fala com o próprio datasource

Não pode haver `@Autowired DataSource` apontando para o banco de outro serviço, nem `JdbcTemplate` configurado com URL "do colega".

✅ **Estado do projeto:** cada `application.yml` declara apenas `spring.datasource.url` apontando para o schema próprio.

### 5. Comunicação cross-serviço exclusivamente via HTTP/Feign

Para `atendimento` validar um agendamento, ele faz `GET /v1/agendamentos/{id}` no `agendamento` — não consulta o banco dele.

✅ **Estado do projeto:** todas as integrações cross-serviço usam Feign declarativo com `ErrorDecoder` traduzindo erros HTTP em exceções.

### 6. Nenhuma transação ACID atravessa serviços

Não existe `@Transactional` que cubra operação em mais de um serviço. Cada serviço commita seu próprio banco; eventual consistency é o modelo.

✅ **Estado do projeto:** ao criar atendimento, o serviço grava local e chama o agendamento via HTTP. Se a chamada externa falhar, é tratada com 502 — não há tentativa de rollback distribuído.

---

## Comparação operacional ponto a ponto

| Aspecto | Homologation (1 banco) | Production (3 bancos) |
|---|---|---|
| **Custo** | 1 instância (~R$ 30/mês na nuvem mais barata) | 3 instâncias gerenciadas (~R$ 200-500/mês) |
| **Latência banco↔app** | ~0,1ms (loopback) | 1-20ms (rede entre AZs) |
| **Falhas** | banco cai → tudo cai | banco do atendimento cai → só atendimento afetado |
| **Backup** | 1 dump diário cobre tudo | 3 estratégias independentes (mais flexível, mais para gerir) |
| **Migração de schema** | precisa coordenar mudanças | cada serviço evolui no seu ritmo |
| **Credenciais** | 1 usuário root para tudo | 3 usuários, cada um com acesso só ao seu banco (princípio do menor privilégio) |
| **Escalabilidade** | escalar verticalmente o MySQL único | escalar só o banco quente (ex.: agendamento na alta) |
| **Compliance / LGPD** | difícil isolar dado sensível por contexto | natural — atendimento (dados clínicos) pode ter encryption e auditoria mais fortes |
| **Setup local** | `docker compose` de homologation resolve | `docker compose` de production sobe 3 MySQLs locais; produção real exige DBaaS/instâncias |
| **Observabilidade** | 1 dashboard, 1 conjunto de métricas | 3 dashboards, mais painéis |
| **Custo total de ownership** | baixo, mas concentrado | maior, mas distribuído |

### Quando cada um faz sentido

| Cenário | Topologia |
|---|---|
| Validação de regra de negócio | Homologation suficiente |
| Demonstração para banca / professor | Homologation suficiente |
| Teste de carga próximo ao real | Production (latência de rede importa) |
| Validar isolamento de falha | Production |
| Validar segregação de credenciais | Production |
| Ambiente de desenvolvedor | Homologation |
| Sistema atendendo clientes reais | Production |

---

## O que muda em production e NÃO está no código

São coisas que o projeto Java não consegue resolver sozinho — são responsabilidade da **infra/ops**:

### Latência cumulativa
Em production, uma request que envolve dois serviços faz pelo menos **dois round-trips de rede**. Em homologation isso é invisível; em produção pode somar 50-100ms por chamada.

**Mitigação:** caching local de dados pouco mutáveis (médicos, convênios) com TTL; replicas de leitura por banco; co-localizar serviços e bancos na mesma AZ.

### Janelas de inconsistência
`atendimento` valida agendamento → recebe `200 OK` → grava → mas no intervalo o agendamento foi cancelado em outro pod → gravou atendimento de agendamento cancelado.

Em homologation isso é raro (~0,1ms entre validação e gravação). Em produção, com latência maior e mais concorrência, acontece.

**Mitigação:** lock otimista (campo `version` na entidade); flag `processing` no agendamento durante o atendimento.

### Saga / compensação
Fluxos longos que tocam vários serviços (ex.: criar atendimento → atualizar agendamento → emitir cobrança) não cabem em uma transação única. Se o passo 3 falhar, é preciso **compensar** os passos 1 e 2 explicitamente.

**No estado atual do projeto** os fluxos são curtos (no máximo 2 serviços) e não exigem saga. Se for adicionado pagamento, esse padrão precisa entrar no design.

### Schema drift
Os 3 bancos evoluem independentemente. Deploy do `atendimento` v2 esperando coluna nova vs. `agendamento` v1 ainda no formato antigo — incompatibilidades só aparecem em produção.

**Mitigação:** versionamento de API (`/v1`, `/v2`); deprecation antes de remover campo; contrato OpenAPI versionado; testes de integração entre versões.

### Observabilidade distribuída
1 banco → fácil ver "quem está lento". 3 bancos + 4 serviços → precisa de tracing (OpenTelemetry, Jaeger) para entender onde uma request gasta tempo.

**Mitigação:** correlation-id propagado em headers; APM por serviço; logs centralizados com ELK ou similar.

---

## Como provar agora que o código está pronto para produção

A validação de isolamento físico já está disponível no ambiente `production` local: ele troca o MySQL único por três containers dedicados e prova que o código não está acoplado ao "tudo no mesmo banco":

### Teste A — três MySQLs separados em compose

Subir `docker-compose.yml` + `docker-compose.production.yml`, que cria **3 services MySQL separados** (`db-administrativo`, `db-agendamento`, `db-atendimento`), em portas diferentes, cada serviço apontando para seu próprio banco. Rodar o smoke test ponta-a-ponta.

**Se passar, o código é portável.** Esse teste simula a topologia de production sem o custo do DBaaS.

### Teste B — busca de armadilhas no código

```bash
# JOINs cross-schema acidentais
grep -rn "clinica_administrativo\.\|clinica_agendamento\.\|clinica_atendimento\." */src/main

# @JoinColumn / relacionamento JPA entre domínios
grep -rn "@JoinColumn\|@ManyToOne\|@OneToMany" */src/main/java

# URLs JDBC hard-coded
grep -rn "jdbc:mysql" */src/main
```

Todos os resultados devem ser **vazios** ou conter **apenas relações internas** ao próprio serviço (ex.: `paciente.convenio_id` dentro do `administrativo`).

### Teste C — derrubar um banco em production (jogo do caos)

Em produção, matar deliberadamente o banco do `atendimento` e verificar: `administrativo` e `agendamento` continuam respondendo? Se sim, isolação está real. Se algum dos outros falhar, o acoplamento foi violado em algum lugar.

---

## Riscos específicos da "homologação simplificada"

Manter homologation com 1 banco é uma decisão pragmática, mas **mascara alguns problemas** que vão aparecer só em produção:

| Risco mascarado | Como aparece em prod |
|---|---|
| Acoplamento por JOIN/FK cross-schema | Query quebra com "schema not found" |
| Dependência de mesmo `JWT_SECRET` ou usuário do banco | Auth falha entre serviços |
| Pool de conexões superdimensionado | Múltiplas instâncias esgotam limite por banco |
| Migrations conflitantes | Schema drift em deploy parcial |
| Falta de retry/circuit breaker em chamadas Feign | Cascata de falhas quando um banco fica lento |

**Recomendação:** rodar o **Teste A** (`docker-compose.production.yml` com 3 MySQLs) antes de cada release maior. Pega 90% dos problemas que produção real exporia.

---

## Perguntas prováveis na banca (FAQ)

**P: Se eu uso 1 banco em homologation, não estou desrespeitando o database-per-service?**

R: O princípio database-per-service é sobre **isolamento de modelo de dados e ciclo de vida**, não sobre instância física. Mesmo com 1 MySQL, cada serviço só conhece seu próprio schema, suas próprias tabelas e migrations. O isolamento lógico é mantido. A separação física é uma evolução operacional, não uma mudança arquitetural.

---

**P: Por que rodar production local com 3 MySQLs em containers, se produção real usaria DBaaS?**

R: É a forma barata e reprodutível de demonstrar database-per-service físico na banca. Para clientes reais, os containers de banco seriam trocados por DBaaS (RDS, Cloud SQL, etc.) para ter backup automatizado, alta disponibilidade, replicação, escalabilidade vertical sem downtime e segurança gerenciada.

---

**P: Como vocês garantem integridade referencial entre serviços sem foreign key?**

R: Validação acontece **na borda**, no momento da escrita, via Feign. Ao criar um agendamento, o `agendamento` consulta `GET /v1/pacientes/{id}/exists` no `administrativo`. Se retornar 404, o serviço lança `EntityNotFoundException` (404). É um modelo de **consistência eventual com validação síncrona** — não há FK no banco, mas a regra de negócio é aplicada.

A integridade referencial **histórica** (e se o paciente for deletado depois?) é tratada com regras de negócio: paciente com agendamentos não pode ser deletado, ou é apenas inativado (soft delete).

---

**P: E se o banco do administrativo cair em produção, o agendamento continua funcionando?**

R: Parcialmente. Operações que não dependem de validação cross-serviço (listar agendamentos existentes, por exemplo) continuam. Operações que precisam validar paciente/médico via Feign vão receber 502 (`FeignIntegrationException` traduzida pelo `ErrorDecoder`) e responder erro claro para o cliente. Isso é o comportamento desejado: **degradação parcial em vez de cascata de falha**.

Em production madura, isso seria complementado por circuit breaker (Resilience4j) e cache local de validações.

---

**P: A latência de 3 bancos vai matar a performance?**

R: Não, se a arquitetura for desenhada considerando isso. Caching de dados quase-imutáveis (convênios, especialidades médicas) com TTL elimina 80% das chamadas Feign. Co-localizar app e banco na mesma AZ reduz latência pra ~1ms. Connection pooling adequado evita reabrir conexão a cada request. Esses são padrões de microsserviços, não improvisos do projeto.

---

**P: Por que não usaram um banco distribuído tipo CockroachDB ou Vitess?**

R: Premissa errada. Bancos distribuídos resolvem outro problema — escalar **horizontalmente uma única base lógica**. Aqui, cada microsserviço tem seu próprio **modelo de dados isolado** — não há razão pra ter o mesmo banco distribuído pra todos. MySQL gerenciado por serviço é mais simples, mais barato e atende os requisitos.

---

**P: Como migrar de homologation para production sem reescrever nada?**

R: Três passos:

1. Provisionar os 3 bancos externos (DBaaS) e rodar `init.sql` em cada um.
2. Criar um `.env.production` com `ADMIN_DB_URL`, `AGENDAMENTO_DB_URL`, `ATENDIMENTO_DB_URL`, credenciais e `JWT_SECRET` próprios.
3. Subir com `docker compose -f docker-compose.yml -f docker-compose.production.yml --env-file .env.production up -d`.

Nenhuma linha de Java muda. Esse é o ponto da arquitetura.

---

## Conclusão para a apresentação

A escolha entre **1 banco lógico** e **3 bancos físicos** não é sobre código — é sobre **operação**. O código foi projetado com 6 regras que garantem portabilidade total entre as duas topologias.

**Homologation com 1 banco** é uma escolha pragmática de custo e simplicidade, válida para desenvolvimento, demonstração e validação de regras de negócio. **Production com 3 bancos** entrega isolamento real de falhas, segregação de credenciais, escalabilidade independente e conformidade — atributos que justificam o custo extra apenas quando o sistema atende usuários reais.

A migração entre uma e outra é uma mudança de **3 variáveis de ambiente**. Esse é o entregável arquitetural do projeto.

---

## Referências cruzadas

- [`14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md) — implementação operacional dos dois ambientes em Docker Compose.
- [`01-ARQUITETURA.md`](01-ARQUITETURA.md) — visão geral dos componentes e da comunicação entre serviços.
- [`08-SEGURANCA.md`](08-SEGURANCA.md) — modelo de autenticação JWT que atravessa todos os serviços.
- [`diagramas/arquitetura-homologation.puml`](diagramas/arquitetura-homologation.puml) — diagrama do estado atual.
- [`diagramas/arquitetura-production.puml`](diagramas/arquitetura-production.puml) — diagrama do alvo de produção.
