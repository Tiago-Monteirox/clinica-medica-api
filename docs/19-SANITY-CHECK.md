# 19 — Sanity Check Pré-apresentação

> Runbook end-to-end. Use antes da banca para garantir que tudo sobe e responde como esperado, e como roteiro de demonstração ao vivo.

Cada seção tem **comando** + **resultado esperado** + **o que mostrar pra banca**. Em ~15 minutos você sobe homologation, conecta com DBeaver, mostra logs no Dozzle, derruba, sobe production com 3 MySQLs reais, repete a conexão e o smoke.

---

## Pré-requisitos

Antes de começar, garanta que:

| Item | Como verificar |
|---|---|
| Docker daemon de pé | `docker info \| head -3` |
| `mvn` e Java 21 disponíveis | `java -version && mvn -v` |
| Nenhuma stack `clinica-*` rodando | `docker compose ls \| grep clinica` (deve não retornar nada) |
| Porta `8080` livre (ou usar `8084`/`8085`) | `lsof -i :8080` |
| JARs buildados | `ls administrativo/target/*.jar agendamento/target/*.jar atendimento/target/*.jar gateway/target/*.jar` |
| **DBeaver** instalado | <https://dbeaver.io/download/> — Community Edition basta |

Se os JARs não existem ou estão desatualizados:

```bash
mvn clean package -DskipTests
```

Se já tem outra stack `clinica-*` de pé:

```bash
# substitua o sufixo conforme o caso
docker compose --env-file .env.homologation \
  -f docker-compose.yml -f docker-compose.homologation.yml down
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml down
```

---

## Parte 1 — Homologation (1 MySQL com 3 schemas)

### 1.1 Subir a stack com Dozzle

```bash
cp .env.homologation.example .env.homologation

docker compose --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  -f docker-compose.tools.yml \
  up --build -d
```

Esperado: 6 containers de pé (mysql + 4 services + dozzle).

```bash
docker compose --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  -f docker-compose.tools.yml \
  ps
```

| Container | Status |
|---|---|
| `clinica-homologation-mysql-1` | `Up X seconds (healthy)` |
| `clinica-homologation-administrativo-1` | `Up X seconds` |
| `clinica-homologation-agendamento-1` | `Up X seconds` |
| `clinica-homologation-atendimento-1` | `Up X seconds` |
| `clinica-homologation-gateway-1` | `Up X seconds` |
| `clinica-homologation-dozzle-1` | `Up X seconds` |

### 1.2 Abrir o Dozzle (visualizar containers + logs)

Abra no browser:

```
http://localhost:9999
```

**Mostra pra banca:**

- Lista de 6 containers (mysql + dozzle + 4 services Java), todos com bolinha verde.
- Clique em `gateway` — mostra logs do Spring Cloud Gateway.
- Clique em `administrativo` — mostra o seed do admin: `INFO Usuário admin seedado: admin@clinica.com (ADMIN)`.

### 1.3 Conectar com DBeaver

**Conexão única em homologation** (1 MySQL com 3 schemas).

1. Em DBeaver: `Database → New Connection → MySQL`.
2. Preencha:

| Campo | Valor |
|---|---|
| Server Host | `localhost` |
| Port | `3307` |
| Database | (deixe em branco para ver todos, ou `clinica_administrativo`) |
| Username | `root` |
| Password | (vazio) |
| Driver properties → `allowPublicKeyRetrieval` | `true` |
| Driver properties → `useSSL` | `false` |

3. **Test Connection** → clique. Espera "Connected".
4. **Finish**.

**Mostra pra banca:**

Expandir a conexão na árvore. Você vê os 3 schemas:

```
homologation@localhost:3307
├── Databases
│   ├── clinica_administrativo
│   │   └── Tables: convenios, medicos, pacientes, usuarios
│   ├── clinica_agendamento
│   │   └── Tables: agendamentos
│   └── clinica_atendimento
│       └── Tables: atendimentos
```

Query útil pra defesa: mostrar que os 3 schemas estão isolados, mesmo no mesmo MySQL.

```sql
-- Mostra os 3 databases do projeto
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name LIKE 'clinica_%';

-- Mostra o usuário admin seedado pelo Spring (não pelo init.sql)
USE clinica_administrativo;
SELECT id, email, role, LEFT(senha_hash, 30) AS hash_prefix, created_at
FROM usuarios;
```

### 1.4 Smoke test de homologation

Em um terminal:

```bash
./scripts/smoke-homologation.sh
```

Esperado (5 OK consecutivos):

```
OK   Health do gateway responde UP
OK   Login retorna token JWT (len=260)
OK   GET /api/admin/v1/convenios responde 200 com token
OK   POST /api/admin/v1/convenios responde 201
OK   GET sem token retorna 401 corretamente

Smoke homologation OK.
```

### 1.5 Logs no Dozzle durante o smoke

Imediatamente depois do smoke, volte ao Dozzle. Clique em `administrativo`:

```
INFO  AuthService    : Tentativa de login para admin@clinica.com
INFO  AuthService    : Login OK: usuário id=1 role=ADMIN
INFO  ConvenioService: Convênio Smoke-... criado (id=N)
```

E em `gateway`: mostra a requisição passando pelo filtro JWT.

**Mostra pra banca:**

- Esses logs vivos demonstram que (i) requisição chegou no gateway, (ii) gateway encaminhou pro administrativo, (iii) administrativo autenticou, (iv) administrativo persistiu no banco.

### 1.6 Verificar que o smoke deixou rastro no banco

No DBeaver, na aba do `clinica_administrativo`:

```sql
SELECT id, nome, descricao, created_at
FROM convenios
ORDER BY id DESC
LIMIT 5;
```

Esperado: pelo menos uma linha `Smoke-<timestamp>` criada nos últimos segundos.

### 1.7 Derrubar homologation

```bash
docker compose --env-file .env.homologation \
  -f docker-compose.yml \
  -f docker-compose.homologation.yml \
  -f docker-compose.tools.yml \
  down
```

> Não use `-v` se quer manter os dados criados para a próxima vez.

---

## Parte 2 — Production (3 MySQLs reais, database-per-service literal)

### 2.1 Subir a stack com Dozzle

```bash
cp .env.production.example .env.production

docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.tools.yml \
  up --build -d
```

Esperado: 8 containers (3 DBs + 4 services + dozzle).

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.tools.yml \
  ps
```

| Container | Porta no host | Status |
|---|---|---|
| `clinica-production-db-administrativo-1` | `3308 → 3306` | healthy |
| `clinica-production-db-agendamento-1` | `3309 → 3306` | healthy |
| `clinica-production-db-atendimento-1` | `3310 → 3306` | healthy |
| `clinica-production-administrativo-1` | (interna) | Up |
| `clinica-production-agendamento-1` | (interna) | Up |
| `clinica-production-atendimento-1` | (interna) | Up |
| `clinica-production-gateway-1` | `8085 → 8080` | Up |
| `clinica-production-dozzle-1` | `9999 → 8080` | Up |

### 2.2 Conectar com DBeaver — três conexões separadas

Em production há **3 conexões distintas** no DBeaver, uma por banco. Crie todas e mantenha-as na árvore lado a lado.

#### Conexão 1 — `db-administrativo` (porta 3308)

| Campo | Valor |
|---|---|
| Server Host | `localhost` |
| Port | `3308` |
| Database | `clinica_administrativo` |
| Username | `svc_administrativo` |
| Password | `clinica_administrativo_prod_2026` |
| Driver properties → `allowPublicKeyRetrieval` | `true` |
| Driver properties → `useSSL` | `false` |

Connection name sugerido: `clinica-production / administrativo`.

#### Conexão 2 — `db-agendamento` (porta 3309)

| Campo | Valor |
|---|---|
| Server Host | `localhost` |
| Port | `3309` |
| Database | `clinica_agendamento` |
| Username | `svc_agendamento` |
| Password | `clinica_agendamento_prod_2026` |
| Driver properties → `allowPublicKeyRetrieval` | `true` |
| Driver properties → `useSSL` | `false` |

Connection name sugerido: `clinica-production / agendamento`.

#### Conexão 3 — `db-atendimento` (porta 3310)

| Campo | Valor |
|---|---|
| Server Host | `localhost` |
| Port | `3310` |
| Database | `clinica_atendimento` |
| Username | `svc_atendimento` |
| Password | `clinica_atendimento_prod_2026` |
| Driver properties → `allowPublicKeyRetrieval` | `true` |
| Driver properties → `useSSL` | `false` |

Connection name sugerido: `clinica-production / atendimento`.

**Mostra pra banca:**

Na árvore lateral do DBeaver vão aparecer as 3 conexões abertas em paralelo, cada uma com **apenas o seu schema** visível. Isso é o argumento visual mais forte do database-per-service:

```
clinica-production / administrativo  (localhost:3308)
└── clinica_administrativo
    └── Tables: convenios, medicos, pacientes, usuarios

clinica-production / agendamento     (localhost:3309)
└── clinica_agendamento
    └── Tables: agendamentos

clinica-production / atendimento     (localhost:3310)
└── clinica_atendimento
    └── Tables: atendimentos
```

Os três bancos são **fisicamente isolados** — instâncias MySQL distintas, processos diferentes, volumes Docker separados. Você pode parar `db-atendimento` e os outros dois continuam atendendo.

### 2.3 Provar o isolamento (opcional, mas impactante)

Conectado como `svc_administrativo` no DBeaver, tente:

```sql
-- Isso vai FALHAR com "Access denied" — svc_administrativo
-- só enxerga o database administrativo.
USE clinica_agendamento;
SELECT * FROM agendamentos;
```

Esperado: `Access denied for user 'svc_administrativo'@'%' to database 'clinica_agendamento'`.

**Diz pra banca:** "isso é o princípio do menor privilégio. Se o serviço `administrativo` for comprometido, o atacante não consegue tocar nos dados de agendamento — nem como root do MySQL, porque o usuário aqui não é root."

### 2.4 Smoke test de production

```bash
BASE_URL=http://localhost:8085 \
  ADMIN_EMAIL=admin@clinica.com \
  ADMIN_PASSWORD=admin123 \
  SMOKE_WRITE=1 \
  ./scripts/smoke-production.sh
```

Esperado:

```
OK   Health do gateway responde UP
OK   Login retorna token JWT (len=282)
OK   GET /api/admin/v1/convenios responde 200 com token
OK   POST /api/admin/v1/convenios responde 201
OK   GET sem token retorna 401 corretamente

Smoke production OK.
```

### 2.5 Confirmar a escrita em production

Na conexão `clinica-production / administrativo` no DBeaver:

```sql
SELECT id, nome, descricao, created_at
FROM convenios
ORDER BY id DESC
LIMIT 5;
```

Esperado: pelo menos uma linha `Smoke-prod-<timestamp>` recente.

### 2.6 Logs no Dozzle (production)

Em `http://localhost:9999`, o Dozzle agora mostra **8 containers** (filtrados por `COMPOSE_PROJECT_NAME=clinica-production`):

- Clique em `db-administrativo` — logs do MySQL.
- Clique em `administrativo` — logs do Spring Boot, incluindo `INFO Login OK: usuário id=1 role=ADMIN`.
- Clique em `gateway` — requests passando pelo filtro JWT.

### 2.7 Derrubar production

```bash
docker compose --env-file .env.production \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  -f docker-compose.tools.yml \
  down
```

> Não use `-v` se quer manter os dados criados para mostrar persistência entre boots.

---

## Sequência sugerida para apresentação ao vivo (15min)

```text
00:00 — abre slide com diagrama de arquitetura (docs/diagramas/arquitetura-homologation.puml)
01:00 — terminal: docker compose ... up (homologation + dozzle)
03:00 — browser: http://localhost:9999 (Dozzle) — mostra 6 containers verdes
04:00 — DBeaver: conexão localhost:3307 — mostra 3 schemas no mesmo MySQL
05:30 — terminal: ./scripts/smoke-homologation.sh — 5/5 OK
06:30 — volta ao Dozzle → administrativo: mostra "INFO Login OK"
07:30 — slide com diagrama de production (docs/diagramas/arquitetura-production.puml)
08:00 — terminal: docker compose down + docker compose ... up (production)
10:00 — DBeaver: 3 conexões — uma por banco — mostra isolamento na árvore
11:30 — DBeaver: tentativa USE clinica_agendamento como svc_administrativo → Access denied
12:30 — terminal: smoke-production.sh com SMOKE_WRITE=1 — 5/5 OK
13:30 — DBeaver: SELECT em clinica_administrativo.convenios — linha nova
14:00 — Dozzle: logs do gateway durante o smoke
14:30 — terminal: docker compose down
15:00 — slide final: badges no README (CI verde, Codecov, etc.)
```

---

## Troubleshooting durante a apresentação

### "Não consigo conectar no MySQL pelo DBeaver"

- Confira que o container do banco está `healthy` (`docker compose ps`).
- Confira a porta no host (3307 em hom; 3308/3309/3310 em prod).
- Em **Driver properties**, marque `allowPublicKeyRetrieval=true` e `useSSL=false`.

### "Smoke test falha com 500 no login"

O admin ainda está bootando o Hibernate. Espere ~20-30s após o `docker compose up` e tente de novo.

Se quiser uma espera ativa:

```bash
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST http://localhost:8085/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","senha":"y"}')
  [ "$code" = "422" ] && { echo "Pronto"; break; }
  sleep 2
done
```

### "Gateway retorna `port is already allocated`"

Outra aplicação está ocupando a porta (8080 ou 8085).

- Em hom: ajuste `GATEWAY_HOST_PORT` em `.env.homologation`.
- Em prod: ajuste `GATEWAY_HOST_PORT` em `.env.production`.

### "Dozzle não mostra meus containers"

O filtro depende do `COMPOSE_PROJECT_NAME`. Confira:

```bash
docker inspect clinica-homologation-dozzle-1 \
  --format='{{.Config.Env}}' | tr ' ' '\n' | grep DOZZLE_FILTER
```

Deve mostrar `label=com.docker.compose.project=clinica-homologation` (ou `clinica-production`).

### "DBeaver mostra 'Access denied' mesmo com a senha certa"

Em production, **cada usuário só enxerga o seu banco**. Se você tentar `USE clinica_agendamento` na conexão de `svc_administrativo`, vai falhar — isso é o comportamento esperado e até desejado. Use a conexão certa pra cada schema.

### "Quero resetar tudo do zero"

```bash
# Apaga volumes (dados perdidos)
docker compose --env-file .env.homologation \
  -f docker-compose.yml -f docker-compose.homologation.yml down -v

docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.production.yml down -v
```

---

## Lista de verificação rápida (5min antes da banca)

- [ ] `mvn clean package -DskipTests` rodou sem erros há ≤ 1 hora
- [ ] `docker info` responde
- [ ] Nenhum container `clinica-*` órfão de execução anterior (`docker compose ls`)
- [ ] Portas livres: `8080`, `8084`, `8085`, `9999`, `3307`, `3308`, `3309`, `3310`
- [ ] DBeaver aberto com as 4 conexões já cadastradas (1 hom + 3 prod)
- [ ] Browser aberto em `http://localhost:9999` (Dozzle) e nas Swaggers (`:8081`, `:8082`, `:8083`)
- [ ] Terminais separados: 1 pra comandos, 1 pra `docker compose logs -f`, 1 pra smoke
- [ ] Slide de arquitetura aberto
- [ ] Repo aberto no browser pra mostrar badges + Codecov no fim
