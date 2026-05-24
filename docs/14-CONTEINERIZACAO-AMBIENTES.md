# 14 — Conteinerização por Ambiente com Docker

> Guia de implementação para manter dois ambientes usando Docker e Docker Compose.
> Este documento substitui a proposta anterior de Kubernetes para a entrega atual.

---

## Decisão

Para a entrega do projeto, os ambientes serão implementados com **Docker Compose**.

| Ambiente | Objetivo | Banco |
|---|---|---|
| `homologation` | ambiente atual, usado para demonstração, testes manuais e validação ponta a ponta | 1 MySQL com 3 databases lógicos |
| `production` | ambiente final conceitual, com banco externo por serviço | 3 bancos externos/DBaaS |

Kubernetes fica como evolução futura. A entrega atual prioriza uma stack reproduzível, simples de rodar e compatível com a apresentação do CI/CD via [GitHub Actions](15-CICD-GITHUB-ACTIONS.md).

---

## Justificativa

O projeto já demonstra os principais pontos arquiteturais de microsserviços:

- API Gateway como entrada única;
- serviços separados por domínio;
- bancos lógicos separados por serviço;
- comunicação entre serviços via Feign;
- autenticação JWT;
- containers por serviço;
- testes automatizados.

Usar Kubernetes agora adicionaria complexidade operacional que não é essencial para demonstrar o domínio do projeto. Docker Compose é suficiente para validar o comportamento do sistema e permite mostrar o CI/CD funcionando localmente.

---

## Topologia alvo

> Diagramas PlantUML correspondentes:
> - [`diagramas/arquitetura-homologation.puml`](diagramas/arquitetura-homologation.puml) — estado atual com 1 MySQL e 3 databases lógicos.
> - [`diagramas/arquitetura-production.puml`](diagramas/arquitetura-production.puml) — alvo com database-per-service real.

### Homologation

O ambiente `homologation` representa o estado atual da stack.

```text
cliente / frontend / curl
        |
        v
gateway :8084 no host / :8080 no container
        |
        +--> administrativo :8081
        +--> agendamento    :8082
        +--> atendimento    :8083
                 |
                 v
            MySQL único
            ├─ clinica_administrativo
            ├─ clinica_agendamento
            └─ clinica_atendimento
```

**Uso:** demonstração, homologação didática, teste manual e smoke test do pipeline.

---

### Production

O ambiente `production` mantém os mesmos containers da aplicação, mas não sobe MySQL local.

```text
cliente / frontend
        |
        v
gateway
        |
        +--> administrativo --> DB externo administrativo
        +--> agendamento ----> DB externo agendamento
        +--> atendimento ----> DB externo atendimento
```

**Uso:** representação da arquitetura final com database-per-service completo.

---

## Estratégia de arquivos

### Estado atual

Hoje o arquivo `docker-compose.yml` já representa a stack completa de homologation:

- `mysql`;
- `administrativo`;
- `agendamento`;
- `atendimento`;
- `gateway`.

Esse estado é aceitável e pode ser mantido como primeiro passo.

### Estado recomendado

Separar a configuração em arquivos por responsabilidade:

```text
raiz/
├── Dockerfile
├── docker-compose.yml
├── docker-compose.homologation.yml
├── docker-compose.production.yml
├── .env.homologation.example
├── .env.production.example
└── scripts/
    ├── smoke-homologation.sh
    └── smoke-production.sh
```

| Arquivo | Responsabilidade |
|---|---|
| `docker-compose.yml` | base comum dos serviços da aplicação |
| `docker-compose.homologation.yml` | MySQL local, URLs JDBC locais e portas de homologation |
| `docker-compose.production.yml` | URLs de bancos externos e configuração de produção |
| `.env.homologation.example` | variáveis de exemplo para homologation |
| `.env.production.example` | variáveis de exemplo para production |
| `scripts/smoke-*.sh` | validações rápidas pós-deploy (também usados no job `smoke` do GitHub Actions) |

---

## PASSO D0 — Confirmar a stack atual

### O que fazer

Validar que a stack atual continua funcionando antes de separar os ambientes.

### Comandos

```bash
mvn test
docker compose up --build -d
docker compose ps
```

Login:

```bash
TOKEN=$(curl -s -X POST http://localhost:8084/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}' | jq -r '.data.token')
```

Teste autenticado:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8084/api/admin/v1/convenios | jq .
```

### Ponto de controle

- [ ] `mvn test` passa.
- [ ] `docker compose up --build -d` sobe a stack.
- [ ] Gateway responde em `http://localhost:8084`.
- [ ] Login retorna token.
- [ ] Endpoint autenticado responde com sucesso.

---

## PASSO D1 — Definir variáveis por ambiente

### Homologation

Criar `.env.homologation.example` com valores didáticos.

Variáveis esperadas:

| Variável | Exemplo |
|---|---|
| `COMPOSE_PROJECT_NAME` | `clinica-homologation` |
| `GATEWAY_HOST_PORT` | `8084` |
| `MYSQL_HOST_PORT` | `3307` |
| `MYSQL_ROOT_PASSWORD` | vazio ou `root` |
| `JWT_SECRET` | segredo de homologation |
| `ADMIN_DB_URL` | JDBC para `clinica_administrativo` |
| `AGENDAMENTO_DB_URL` | JDBC para `clinica_agendamento` |
| `ATENDIMENTO_DB_URL` | JDBC para `clinica_atendimento` |

### Production

Criar `.env.production.example` sem credenciais reais.

Variáveis esperadas:

| Variável | Exemplo |
|---|---|
| `COMPOSE_PROJECT_NAME` | `clinica-production` |
| `GATEWAY_HOST_PORT` | `8080` |
| `JWT_SECRET` | preencher fora do Git |
| `ADMIN_DB_URL` | JDBC do banco externo administrativo |
| `ADMIN_DB_USER` | usuário do banco administrativo |
| `ADMIN_DB_PASSWORD` | senha fora do Git |
| `AGENDAMENTO_DB_URL` | JDBC do banco externo agendamento |
| `AGENDAMENTO_DB_USER` | usuário do banco agendamento |
| `AGENDAMENTO_DB_PASSWORD` | senha fora do Git |
| `ATENDIMENTO_DB_URL` | JDBC do banco externo atendimento |
| `ATENDIMENTO_DB_USER` | usuário do banco atendimento |
| `ATENDIMENTO_DB_PASSWORD` | senha fora do Git |

### Ponto de controle

- [ ] `.env.homologation.example` criado sem senha sensível real.
- [ ] `.env.production.example` criado sem senha sensível real.
- [ ] `.env*` real está ignorado no Git.
- [ ] `JWT_SECRET` fica configurável por ambiente.

---

## PASSO D2 — Separar o Compose base

### Objetivo

Deixar o `docker-compose.yml` com a parte comum dos serviços:

- build de cada módulo;
- rede;
- portas internas;
- variáveis comuns;
- dependências entre aplicações.

### Serviços da base

| Serviço | Imagem/Build | Porta interna |
|---|---|---|
| `administrativo` | `MODULE=administrativo` | `8081` |
| `agendamento` | `MODULE=agendamento` | `8082` |
| `atendimento` | `MODULE=atendimento` | `8083` |
| `gateway` | `MODULE=gateway` | `8080` |

### Padrão de rede

Todos os serviços devem permanecer na mesma rede:

```text
clinica-net
```

### Ponto de controle

- [ ] `docker-compose.yml` não contém decisão específica de homologation ou production além do necessário.
- [ ] Os quatro serviços da aplicação continuam declarados.
- [ ] O Gateway aponta para nomes de serviço internos.

---

## PASSO D3 — Criar `docker-compose.homologation.yml`

### Objetivo

Representar o ambiente atual de homologation.

### Responsabilidades do arquivo

- declarar o serviço `mysql`;
- montar `sql/init.sql`;
- publicar porta local do MySQL;
- configurar JDBC dos três serviços para o MySQL interno;
- expor o Gateway na porta local de homologation.

### Banco de homologation

Um único MySQL com três databases:

```text
clinica_administrativo
clinica_agendamento
clinica_atendimento
```

### URLs internas esperadas

| Serviço | JDBC |
|---|---|
| `administrativo` | `jdbc:mysql://mysql:3306/clinica_administrativo?...` |
| `agendamento` | `jdbc:mysql://mysql:3306/clinica_agendamento?...` |
| `atendimento` | `jdbc:mysql://mysql:3306/clinica_atendimento?...` |

### Comando de subida

```bash
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  up --build -d
```

### Ponto de controle

- [ ] `mysql` sobe saudável.
- [ ] `sql/init.sql` cria os três databases.
- [ ] Os três serviços conectam no database correto.
- [ ] Gateway responde na porta definida em `GATEWAY_HOST_PORT`.

---

## PASSO D4 — Criar `docker-compose.production.yml`

### Objetivo

Representar produção sem MySQL local.

### Responsabilidades do arquivo

- não declarar serviço `mysql`;
- configurar URLs JDBC externas;
- remover dependência de `mysql`;
- usar porta padrão do Gateway;
- usar secrets/variáveis reais fora do Git.

### Bancos externos esperados

| Serviço | Banco |
|---|---|
| `administrativo` | banco externo administrativo |
| `agendamento` | banco externo agendamento |
| `atendimento` | banco externo atendimento |

### Comando de subida

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up --build -d
```

### Ponto de controle

- [ ] Nenhum container MySQL sobe em production.
- [ ] Cada serviço recebe sua própria URL JDBC.
- [ ] Cada serviço usa usuário e senha próprios.
- [ ] Gateway responde na porta definida para production.

---

## PASSO D5 — Criar smoke tests

### Objetivo

Validar rapidamente se um ambiente subiu corretamente.

### Script de homologation

`scripts/smoke-homologation.sh` deve validar:

1. health do Gateway;
2. login;
3. endpoint autenticado;
4. fluxo mínimo de escrita;
5. rota sem token retornando `401`.

### Script de production

`scripts/smoke-production.sh` deve fazer a mesma validação, mas usando `BASE_URL` de produção.

### Variáveis dos scripts

| Variável | Uso |
|---|---|
| `BASE_URL` | URL do Gateway |
| `ADMIN_EMAIL` | usuário admin |
| `ADMIN_PASSWORD` | senha admin |

### Ponto de controle

- [ ] Smoke test passa em homologation.
- [ ] Smoke test consegue apontar para production quando os bancos externos existirem.
- [ ] Scripts não contêm senha real fixa.

---

## PASSO D6 — Comandos operacionais

### Subir homologation

```bash
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  up --build -d
```

### Derrubar homologation

```bash
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  down
```

### Resetar banco de homologation

```bash
docker compose \
  --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  down -v
```

### Subir production

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  up --build -d
```

### Logs

```bash
docker compose logs -f gateway
docker compose logs -f administrativo
docker compose logs -f agendamento
docker compose logs -f atendimento
```

---

## Troubleshooting

### Serviço não conecta no banco

Verificar:

- `SPRING_DATASOURCE_URL`;
- usuário e senha;
- se o database existe;
- se o host do banco é acessível a partir do container;
- logs do serviço.

### Gateway retorna 502

Verificar:

- se o serviço de destino está de pé;
- se `ADMINISTRATIVO_URL`, `AGENDAMENTO_URL` e `ATENDIMENTO_URL` estão corretas;
- se a porta interna está correta;
- logs do Gateway.

### Login funciona em um ambiente e falha em outro

Verificar:

- `JWT_SECRET`;
- seed do usuário admin;
- tabela `usuarios`;
- senha configurada para o usuário.

### Production subiu MySQL por engano

Verificar:

- se o comando usou `docker-compose.production.yml`;
- se não foi usado `docker-compose.homologation.yml`;
- se o arquivo base não contém o serviço `mysql`.

### Login retorna 422 "Credenciais inválidas" no primeiro boot do volume novo

Causa: alguma versão antiga do `sql/init.sql` continha um `INSERT IGNORE INTO usuarios` com hash BCrypt hardcoded. Em volume Docker novo (típico ao mudar `COMPOSE_PROJECT_NAME`), o init.sql rodava primeiro e inseria o admin com hash potencialmente desalinhado do encoder do Spring, fazendo o seed Java pular (já existia) e o login falhar.

Correção atual: o seed do admin é responsabilidade exclusiva do `CommandLineRunner` em `AdministrativoApplication.seedAdmin` — o `init.sql` só cria o schema, não insere usuário.

Se você ainda encontrar esse erro:

```bash
# 1. apague o usuário com hash quebrado
docker compose exec mysql mysql -uroot -D clinica_administrativo \
  -e "DELETE FROM usuarios WHERE email = 'admin@clinica.com';"
# 2. reinicie o administrativo (vai rodar o seed Java)
docker compose restart administrativo
# 3. teste o login
curl -s -X POST http://localhost:8084/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clinica.com","senha":"admin123"}'
```

---

## Referência dos containers

Tabela única com tudo o que cada container expõe, depende e consome.

> Convenção de nomes pós-Compose: `${COMPOSE_PROJECT_NAME}-<service>-1`.
> Em `homologation` os containers ficam `clinica-homologation-administrativo-1`, etc.
> Em `production`, `clinica-production-administrativo-1`, etc.

### `mysql` — só existe em homologation

| Campo | Valor |
|---|---|
| Imagem | `mysql:8.3` |
| Porta interna | `3306` |
| Porta no host (hom.) | `${MYSQL_HOST_PORT}` (default `3307`) |
| Porta no host (prod.) | **não sobe** (banco é externo) |
| Volume persistente | `clinica_mysql_data` → `/var/lib/mysql` |
| Init SQL | `./sql/init.sql` → `/docker-entrypoint-initdb.d/init.sql` (cria 3 schemas + seed) |
| Healthcheck | `mysqladmin ping` a cada 10s, até 5 tentativas |
| Env vars | `MYSQL_ALLOW_EMPTY_PASSWORD=yes` (didático; em produção real, NÃO) |
| Depende de | — |

### `administrativo`

| Campo | Valor |
|---|---|
| Build | `Dockerfile` com `ARG MODULE=administrativo` (copia o JAR do host) |
| Porta interna | `8081` |
| Porta no host (hom.) | `8081` (publicada para Swagger/debug) |
| Porta no host (prod.) | não publicada (acesso só pela rede interna via gateway) |
| Env vars | `SERVER_PORT`, `SPRING_DATASOURCE_URL` ← `${ADMIN_DB_URL}`, `SPRING_DATASOURCE_USERNAME` ← `${ADMIN_DB_USER}`, `SPRING_DATASOURCE_PASSWORD` ← `${ADMIN_DB_PASSWORD}`, `JWT_SECRET`, `JPA_SHOW_SQL`, `JAVA_OPTS` |
| Depende de | `mysql` (só em homologation, condition: service_healthy) |
| Healthcheck | — (Spring Boot Actuator interno responde via gateway) |
| Swagger | `http://localhost:8081/swagger-ui.html` (só hom.) |

### `agendamento`

| Campo | Valor |
|---|---|
| Build | `Dockerfile` com `ARG MODULE=agendamento` |
| Porta interna | `8082` |
| Porta no host (hom.) | `8082` |
| Porta no host (prod.) | não publicada |
| Env vars | `SERVER_PORT`, `SPRING_DATASOURCE_URL` ← `${AGENDAMENTO_DB_URL}`, `SPRING_DATASOURCE_USERNAME` ← `${AGENDAMENTO_DB_USER}`, `SPRING_DATASOURCE_PASSWORD` ← `${AGENDAMENTO_DB_PASSWORD}`, `ADMINISTRATIVO_URL=http://administrativo:8081` (Feign), `JWT_SECRET`, `JPA_SHOW_SQL`, `JAVA_OPTS` |
| Depende de | `administrativo` (started); `mysql` (healthy, só em hom.) |
| Swagger | `http://localhost:8082/swagger-ui.html` (só hom.) |

### `atendimento`

| Campo | Valor |
|---|---|
| Build | `Dockerfile` com `ARG MODULE=atendimento` |
| Porta interna | `8083` |
| Porta no host (hom.) | `8083` |
| Porta no host (prod.) | não publicada |
| Env vars | `SERVER_PORT`, `SPRING_DATASOURCE_URL` ← `${ATENDIMENTO_DB_URL}`, `SPRING_DATASOURCE_USERNAME` ← `${ATENDIMENTO_DB_USER}`, `SPRING_DATASOURCE_PASSWORD` ← `${ATENDIMENTO_DB_PASSWORD}`, `AGENDAMENTO_URL=http://agendamento:8082` (Feign), `JWT_SECRET`, `JPA_SHOW_SQL`, `JAVA_OPTS` |
| Depende de | `agendamento` (started); `mysql` (healthy, só em hom.) |
| Swagger | `http://localhost:8083/swagger-ui.html` (só hom.) |

### `gateway`

| Campo | Valor |
|---|---|
| Build | `Dockerfile` com `ARG MODULE=gateway` |
| Porta interna | `8080` |
| Porta no host (hom.) | `${GATEWAY_HOST_PORT}` (default `8084` — `8080` já é usado por wordpress local) |
| Porta no host (prod.) | `${GATEWAY_HOST_PORT}` (default `8080`) |
| Env vars | `SERVER_PORT=8080`, `ADMINISTRATIVO_URL=http://administrativo:8081`, `AGENDAMENTO_URL=http://agendamento:8082`, `ATENDIMENTO_URL=http://atendimento:8083`, `JWT_SECRET`, `JAVA_OPTS` |
| Depende de | `administrativo`, `agendamento`, `atendimento` (todos started) |
| Health público | `http://localhost:${GATEWAY_HOST_PORT}/actuator/health` |

---

## Comandos por container

Todos os comandos abaixo assumem `--env-file .env.homologation -f docker-compose.yml -f docker-compose.homologation.yml`. Para production, troque por `.env.production` e `docker-compose.production.yml`. Para manter os comandos curtos, exporte:

```bash
export COMPOSE_FILE=docker-compose.yml:docker-compose.homologation.yml
export COMPOSE_ENV_FILES=.env.homologation
```

Com isso `docker compose ...` passa a usar overlay + env automaticamente.

### Subir tudo

```bash
docker compose up --build -d
```

### Subir só um container (e suas dependências)

```bash
docker compose up -d mysql              # só o banco
docker compose up -d administrativo     # mysql + administrativo
docker compose up -d agendamento        # mysql + administrativo + agendamento
docker compose up -d gateway            # tudo (gateway depende dos 3)
```

### Parar / derrubar

```bash
docker compose stop gateway             # para só um, mantém os outros
docker compose down                     # derruba tudo, mantém volumes (dados do MySQL persistem)
docker compose down -v                  # derruba tudo e apaga o volume clinica_mysql_data
```

### Logs

```bash
docker compose logs -f gateway          # acompanha em tempo real
docker compose logs --tail=100 administrativo
docker compose logs --since=5m          # últimos 5 minutos de todos
```

### Status e healthcheck

```bash
docker compose ps                       # status dos containers
docker compose ps mysql                 # só um
docker inspect --format='{{.State.Health.Status}}' \
  $(docker compose ps -q mysql)         # healthcheck do mysql
```

### Shell dentro de um container

```bash
docker compose exec administrativo sh   # shell na imagem da app
docker compose exec mysql mysql -uroot  # cliente MySQL no banco
```

### Rebuild forçado (após mudar Dockerfile ou JAR)

```bash
mvn clean package -DskipTests           # rebuilda JARs no host
docker compose build --no-cache gateway # rebuilda imagem sem cache
docker compose up -d --force-recreate gateway
```

### Reset do banco de homologation (apaga tudo)

```bash
docker compose down -v
docker compose up -d
```

---

## Segredos e URLs por ambiente

Comparação direta entre o que cada microsserviço consome em cada ambiente.

### `administrativo`

| Variável | Homologation | Production |
|---|---|---|
| `ADMIN_DB_URL` | `jdbc:mysql://mysql:3306/clinica_administrativo?...&useSSL=false` | `jdbc:mysql://db-administrativo.internal:3306/clinica_administrativo?useSSL=true` |
| `ADMIN_DB_USER` | `root` | `svc_administrativo` (usuário próprio, menor privilégio) |
| `ADMIN_DB_PASSWORD` | vazio | vem do secret manager — placeholder `CHANGE_ME_FROM_SECRET_MANAGER` no `.env.production.example` |

### `agendamento`

| Variável | Homologation | Production |
|---|---|---|
| `AGENDAMENTO_DB_URL` | `jdbc:mysql://mysql:3306/clinica_agendamento?...&useSSL=false` | `jdbc:mysql://db-agendamento.internal:3306/clinica_agendamento?useSSL=true` |
| `AGENDAMENTO_DB_USER` | `root` | `svc_agendamento` |
| `AGENDAMENTO_DB_PASSWORD` | vazio | secret manager |

### `atendimento`

| Variável | Homologation | Production |
|---|---|---|
| `ATENDIMENTO_DB_URL` | `jdbc:mysql://mysql:3306/clinica_atendimento?...&useSSL=false` | `jdbc:mysql://db-atendimento.internal:3306/clinica_atendimento?useSSL=true` |
| `ATENDIMENTO_DB_USER` | `root` | `svc_atendimento` |
| `ATENDIMENTO_DB_PASSWORD` | vazio | secret manager |

### Comuns (consumidos por todos os 4 serviços + gateway)

| Variável | Homologation | Production |
|---|---|---|
| `JWT_SECRET` | `dev-secret-please-change-...` (didático, no `.env.homologation.example`) | **vem do secret manager** — placeholder no `.env.production.example`. NUNCA reutilizar o segredo de homologation |
| `JPA_SHOW_SQL` | `true` (debug) | `false` |
| `JAVA_OPTS` | `-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom` | mesmo (pode ajustar `MaxRAMPercentage` por instância) |
| `GATEWAY_HOST_PORT` | `8084` (8080 já usado por wordpress local) | `8080` (porta padrão pública) |
| `MYSQL_HOST_PORT` | `3307` | — (não há mysql local) |
| `COMPOSE_PROJECT_NAME` | `clinica-homologation` | `clinica-production` |

### Observações de segurança

1. **`.env.homologation` e `.env.production` estão no `.gitignore`** — apenas os arquivos `*.example` são versionados, com placeholders.
2. Em produção real, `JWT_SECRET` e as senhas devem vir de um **secret manager** (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) e ser injetadas no host antes do `docker compose up`. Nunca colar o valor no `.env.production`.
3. Cada serviço usa **usuário próprio no banco** em produção (`svc_administrativo`, `svc_agendamento`, `svc_atendimento`) — princípio do menor privilégio. Se um serviço for comprometido, o blast radius fica restrito ao seu schema.
4. Em produção, **só o gateway publica porta no host** (`8080`). Os serviços de domínio são acessíveis apenas pela rede interna `clinica-net`. Não há como bater diretamente em `administrativo` por fora.
5. **JPA_SHOW_SQL=true em produção é vazamento de informação** (SQL com valores aparece no log). Manter sempre `false` fora de homologation.

---

## Definition of Done

A conteinerização por ambiente está concluída quando:

1. `homologation` sobe com um MySQL e três databases.
2. `production` sobe sem container MySQL.
3. Cada serviço recebe datasource por variável de ambiente.
4. Gateway é a única porta de entrada.
5. Smoke test passa em homologation.
6. Production está pronta para receber três bancos externos.
7. Nenhum secret real está versionado.
8. Os comandos operacionais estão documentados.

