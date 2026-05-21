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

