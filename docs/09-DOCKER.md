# 09 — Docker e Containerização

> Guia definitivo de infraestrutura de containers. Leia antes de executar qualquer `docker compose up`.

---

## Topologia de containers

### Estado atual — desenvolvimento

Enquanto apenas o `administrativo` está implementado, a stack mínima é:

```
┌────────────────────────────────────┐
│   Host (seu computador)            │
│                                    │
│  :8081 ─────► administrativo       │
│                    │               │
│               JDBC:3306            │
│                    ▼               │
│  :3307 ─────► MySQL 8.3            │
│               ├─ clinica_administrativo │
│               ├─ clinica_agendamento    │  ← criados pelo init.sql
│               └─ clinica_atendimento   │
└────────────────────────────────────┘
```

### Estado alvo — stack completa (Fases 3–5)

Quando todos os serviços estiverem implementados e o `docker-compose.yml` for migrado para o modelo completo (ver seção [Stack Completa](#stack-completa-3-mysqs--gateway)):

```
                    gateway :8080
                  ┌─────┬─────┬────┐
                  ▼     ▼     ▼
              admin  agend  atend
              :8081  :8082  :8083
                │      │      │
             MySQL  MySQL  MySQL
             :3307  :3308  :3309
```

**Por que 3 MySQLs no alvo?**
O padrão *database-per-service* exige que cada serviço seja o único dono do seu schema. Dois serviços acessando o mesmo banco criam acoplamento implícito — qualquer `ALTER TABLE` feito por um pode quebrar o outro. Durante o desenvolvimento (1 MySQL, 3 bancos lógicos), o isolamento é garantido pelo nome do banco, não pelo servidor. É aceitável enquanto os serviços estão sendo escritos, mas a arquitetura alvo usa 3 containers.

---

## Arquivos de infraestrutura

```
raiz/
├── Dockerfile              ← único Dockerfile, parametrizado por ARG MODULE
├── docker-compose.yml      ← estado atual: 1 MySQL + administrativo
├── .dockerignore           ← exclusões do contexto de build
├── .env.example            ← template de variáveis (nunca commite o .env)
└── sql/
    └── init.sql            ← DDL dos 3 bancos + seed do admin
```

---

## Dockerfile — análise completa

O projeto usa **um único Dockerfile na raiz**, reutilizável para todos os módulos via `ARG MODULE`. Essa abordagem elimina duplicação e garante que todos os serviços usam as mesmas imagens base, flags JVM e processo de build.

```dockerfile
FROM maven:3.9.9-eclipse-temurin-17 AS build
```

**Escolha da imagem de build:**
- `maven:3.9.9` — versão pinada. Nunca use `latest` em builds CI/CD; quebraria de forma não determinística.
- `eclipse-temurin-17` — distribuição Temurin da Eclipse Foundation (Adoptium). É a OpenJDK de referência para produção, substitui o AdoptOpenJDK.
- O stage chama-se `build` — usado na instrução `COPY --from=build` do stage seguinte.

---

### Estratégia de cache de camadas (layer caching)

Este é o padrão mais crítico de performance em Dockerfiles Maven:

```dockerfile
# ── PASSO 1: copia só os pom.xml ──────────────────────────────
COPY pom.xml .
COPY commons/pom.xml      commons/
COPY administrativo/pom.xml administrativo/
COPY agendamento/pom.xml  agendamento/
COPY atendimento/pom.xml  atendimento/

RUN mvn dependency:go-offline -B

# ── PASSO 2: copia o código-fonte ─────────────────────────────
COPY commons/src      commons/src
COPY administrativo/src administrativo/src
...
```

**Por que essa ordem importa:**

O Docker invalida o cache de uma camada quando qualquer arquivo de entrada muda. A separação em dois passos garante:

| Cenário | Cache de deps | Tempo de build |
|---|---|---|
| Mudou apenas `src/` | ✅ reutilizado | ~15s |
| Mudou um `pom.xml` (nova dep) | ❌ invalidado | ~3–5 min |
| Primeiro build | ❌ nada em cache | ~5 min |

Sem essa estratégia, o Maven baixaria todas as dependências a cada `docker build` mesmo que nenhum `pom.xml` tenha mudado.

`dependency:go-offline` pre-popula o cache local Maven (`~/.m2`). O `-B` (batch mode) elimina prompts interativos que travam o build.

---

### Build seletivo com `-pl` e `-am`

```dockerfile
ARG MODULE=administrativo
RUN mvn -pl ${MODULE} -am package -DskipTests -B
```

| Flag | Significado |
|---|---|
| `ARG MODULE=administrativo` | Valor padrão. Sobrescrito via `--build-arg MODULE=agendamento` ou via `args:` no compose. |
| `-pl ${MODULE}` | Builda apenas o módulo alvo (Project List). |
| `-am` (also-make) | Builda também os módulos dos quais o alvo depende. Ex: `administrativo` depende de `commons` → ambos são buildados. |
| `-DskipTests` | Testes rodam no CI, não no build de container. |

**Por que copiar `src/` de todos os módulos mesmo buildando só um?**
O Maven resolve o grafo de dependências no `pom.xml` durante a fase de download. Se o `commons/src` não existir no contexto, o Maven falha ao tentar compilar o `commons` que o `administrativo` precisa. Copie tudo, build seletivo.

---

### Runtime stage

```dockerfile
FROM eclipse-temurin:17-jre-alpine
```

**Alpine vs Debian:**

| Critério | Alpine | Debian slim |
|---|---|---|
| Tamanho | ~90 MB | ~200 MB |
| Package manager | `apk` | `apt-get` |
| Biblioteca C | musl | glibc |
| Ferramentas default | mínimas | mínimas |

Para Spring Boot com MySQL connector, Alpine é totalmente suficiente. Problemas com musl vs glibc só surgem em bibliotecas nativas específicas (ex: algumas libs de criptografia de hardware). Para este projeto, não há restrições.

**JRE, não JDK:**
`17-jre-alpine` não tem `javac`, `jstack`, `jmap` etc. Reduz a superfície de ataque — se um atacante entrar no container, não encontra ferramentas de desenvolvimento.

---

### Flags JVM e ENTRYPOINT

```dockerfile
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
```

**`-XX:MaxRAMPercentage=75.0`**

Substitui o `−Xmx` fixo. Em vez de fixar `−Xmx512m`, o JVM lê o `cgroup memory limit` do container e reserva 75% para o heap. Resultado:

```yaml
# compose
deploy:
  resources:
    limits:
      memory: 512m   # JVM usa até 384 MB de heap automaticamente
```

Sem essa flag, o JVM usaria como base a memória total da máquina host, não do container, e poderia estourar o limite e ser morto pelo kernel (`OOMKilled`).

**`-Djava.security.egd=file:/dev/./urandom`**

Containers têm pouca entropia de hardware. O JVM usa `/dev/random` para operações criptográficas (geração de session tokens, chaves JWT etc.), que pode bloquear por segundos em containers. `urandom` é não-bloqueante e seguro para aplicações web de alto nível.

**Por que `exec` no ENTRYPOINT é obrigatório:**

```
# SEM exec:
PID 1: sh       ← Docker envia SIGTERM aqui
PID 7: java     ← SIGTERM nunca chega → Spring Boot não faz graceful shutdown
                   → Docker espera 10s e mata com SIGKILL → dados podem ser perdidos

# COM exec:
PID 1: java     ← Docker envia SIGTERM direto ao Spring Boot
                   → Spring Boot finaliza conexões → graceful shutdown funciona
```

**Por que `sh -c "exec ..."` em vez de array `["java", ...]`?**

O array `ENTRYPOINT ["java", "-jar", "app.jar"]` não expande variáveis de shell. Com `sh -c "exec java $JAVA_OPTS ..."`, você pode sobrescrever `JAVA_OPTS` por container sem rebuild, passando no compose:

```yaml
environment:
  JAVA_OPTS: "-XX:MaxRAMPercentage=60.0 -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005"
```

---

## sql/init.sql — inicialização automática do banco

O MySQL Docker executa todos os scripts em `/docker-entrypoint-initdb.d/` **uma única vez**, quando o volume está vazio (primeiro `docker compose up`).

O compose monta o script como read-only:

```yaml
volumes:
  - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

O script `sql/init.sql` é executado como root e:

1. Cria os 3 bancos: `clinica_administrativo`, `clinica_agendamento`, `clinica_atendimento`
2. Cria todas as tabelas e índices em cada banco
3. Insere o usuário admin inicial (`admin@clinica.com` / `admin123`)

**Tabelas criadas:**

| Banco | Tabelas |
|---|---|
| `clinica_administrativo` | `convenios`, `medicos`, `pacientes`, `usuarios` |
| `clinica_agendamento` | `agendamentos` |
| `clinica_atendimento` | `atendimentos` |

**Atenção crítica — init roda uma única vez:**

O `docker-entrypoint-initdb.d` só executa quando o diretório de dados do MySQL (`/var/lib/mysql`) está vazio. Se o volume já existe (do `docker compose up` anterior), o script não roda. Para forçar re-execução:

```bash
docker compose down -v          # destrói os volumes
docker compose up -d            # sobe do zero — init.sql é executado
```

**Por que não usar `ddl-auto: create`?**

`spring.jpa.hibernate.ddl-auto=create` destruiria e recriaria o schema a cada restart do container. O `init.sql` é executado uma vez e o Hibernate usa `ddl-auto=update` para aplicar apenas as diferenças. É mais seguro e mais próximo do fluxo real de desenvolvimento.

**Relação com o `CommandLineRunner` (seed do admin):**

O `administrativo` tem um `CommandLineRunner` que insere `admin@clinica.com` se não existir. O `INSERT IGNORE` no `init.sql` cobre o mesmo caso. O `IGNORE` garante que não haverá conflito se ambos rodarem. Use um ou outro — os dois juntos são redundantes mas inofensivos.

---

## docker-compose.yml — Estado atual (desenvolvimento)

```yaml
version: "3.9"

services:

  mysql:
    image: mysql:8.3
    container_name: clinica-mysql
    restart: unless-stopped
    environment:
      MYSQL_ALLOW_EMPTY_PASSWORD: "yes"
      MYSQL_DATABASE: clinica_administrativo
    ports:
      - "3307:3306"
    volumes:
      - clinica_mysql_data:/var/lib/mysql
      - ./sql/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    networks: [clinica-net]

  administrativo:
    build:
      context: .
      args:
        MODULE: administrativo
    container_name: clinica-administrativo
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      SERVER_PORT: 8081
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/clinica_administrativo?...
      SPRING_DATASOURCE_USERNAME: root
      SPRING_DATASOURCE_PASSWORD: ""
    depends_on:
      mysql:
        condition: service_healthy
    networks: [clinica-net]

volumes:
  clinica_mysql_data:

networks:
  clinica-net:
    driver: bridge
```

**Explicação de cada campo:**

**`MYSQL_ALLOW_EMPTY_PASSWORD: "yes"`**
Em desenvolvimento, root sem senha simplifica a conexão. Em produção use `MYSQL_ROOT_PASSWORD` e gerencie via secrets.

**`ports: "3307:3306"`**
Expõe a porta 3306 interna como 3307 no host. Evita conflito com um MySQL local que pode estar rodando na 3306. Acesse pelo DBeaver/DataGrip com `host=localhost, port=3307`.

**`command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci`**
Garante que o MySQL use `utf8mb4` por padrão. Sem isso, nomes com acentos, emojis etc. falham. `utf8mb4_unicode_ci` (case-insensitive) é o padrão mais utilizado para aplicações web em português.

**`healthcheck`**
O `depends_on: condition: service_healthy` só avança quando o healthcheck passa. Sem isso, o Spring Boot tentaria conectar ao MySQL antes de ele estar pronto e falharia na inicialização.

- `start_period: 20s` — dá um grace period antes de começar a contar falhas. MySQL pode levar ~15s para inicializar na primeira vez.
- `interval: 10s` — verifica a cada 10 segundos.
- `retries: 5` — após 5 falhas consecutivas, considera unhealthy.

**`SPRING_DATASOURCE_URL`**
O hostname `mysql` é o nome do serviço no compose — o Docker resolve via DNS interno da rede `clinica-net`. A porta é `3306` (interna), não `3307` (host).

Parâmetros da URL:
- `createDatabaseIfNotExist=true` — redundante (o `init.sql` já criou), mas seguro.
- `useSSL=false` — evita erro de certificado em dev.
- `allowPublicKeyRetrieval=true` — necessário para MySQL 8 com autenticação `caching_sha2_password`.
- `serverTimezone=America/Sao_Paulo` — evita problemas de conversão de `LocalDateTime`.

**`networks: [clinica-net]`**
Todos os containers na mesma bridge network se comunicam por nome do serviço. Sem network explícita, o compose cria uma default, mas não a documenta. Explícita é mais legível e permite controle de isolamento.

---

## Stack Completa — 3 MySQLs + Gateway

Quando `agendamento`, `atendimento` e `gateway` estiverem implementados (Fases 3–5), migre o `docker-compose.yml` para esta versão:

```yaml
version: "3.9"
name: clinica-medica

services:

  # ── Bancos de dados (database-per-service) ────────────────────────────────────
  mysql-administrativo:
    image: mysql:8.3
    container_name: mysql-administrativo
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: clinica_administrativo
    ports:
      - "3307:3306"
    volumes:
      - mysql_administrativo_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-p${MYSQL_ROOT_PASSWORD:-root}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks: [clinica-net]

  mysql-agendamento:
    image: mysql:8.3
    container_name: mysql-agendamento
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: clinica_agendamento
    ports:
      - "3308:3306"
    volumes:
      - mysql_agendamento_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-p${MYSQL_ROOT_PASSWORD:-root}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks: [clinica-net]

  mysql-atendimento:
    image: mysql:8.3
    container_name: mysql-atendimento
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: clinica_atendimento
    ports:
      - "3309:3306"
    volumes:
      - mysql_atendimento_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-p${MYSQL_ROOT_PASSWORD:-root}"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s
    networks: [clinica-net]

  # ── Microsserviços ────────────────────────────────────────────────────────────
  administrativo:
    build:
      context: .
      args:
        MODULE: administrativo
    container_name: clinica-administrativo
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      SERVER_PORT: 8081
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql-administrativo:3306/clinica_administrativo?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
      SPRING_DATASOURCE_USERNAME: root
      SPRING_DATASOURCE_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET obrigatório — defina no .env}
      JPA_SHOW_SQL: ${JPA_SHOW_SQL:-false}
    depends_on:
      mysql-administrativo:
        condition: service_healthy
    networks: [clinica-net]

  agendamento:
    build:
      context: .
      args:
        MODULE: agendamento
    container_name: clinica-agendamento
    restart: unless-stopped
    ports:
      - "8082:8082"
    environment:
      SERVER_PORT: 8082
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql-agendamento:3306/clinica_agendamento?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
      SPRING_DATASOURCE_USERNAME: root
      SPRING_DATASOURCE_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
      ADMINISTRATIVO_URL: http://clinica-administrativo:8081
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET obrigatório — defina no .env}
    depends_on:
      mysql-agendamento:
        condition: service_healthy
      administrativo:
        condition: service_started
    networks: [clinica-net]

  atendimento:
    build:
      context: .
      args:
        MODULE: atendimento
    container_name: clinica-atendimento
    restart: unless-stopped
    ports:
      - "8083:8083"
    environment:
      SERVER_PORT: 8083
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql-atendimento:3306/clinica_atendimento?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Sao_Paulo
      SPRING_DATASOURCE_USERNAME: root
      SPRING_DATASOURCE_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
      AGENDAMENTO_URL: http://clinica-agendamento:8082
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET obrigatório — defina no .env}
    depends_on:
      mysql-atendimento:
        condition: service_healthy
      agendamento:
        condition: service_started
    networks: [clinica-net]

  gateway:
    build:
      context: .
      args:
        MODULE: gateway
    container_name: clinica-gateway
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      SERVER_PORT: 8080
      ADMINISTRATIVO_URL: http://clinica-administrativo:8081
      AGENDAMENTO_URL: http://clinica-agendamento:8082
      ATENDIMENTO_URL: http://clinica-atendimento:8083
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET obrigatório — defina no .env}
    depends_on:
      administrativo:
        condition: service_started
      agendamento:
        condition: service_started
      atendimento:
        condition: service_started
    networks: [clinica-net]

volumes:
  mysql_administrativo_data:
  mysql_agendamento_data:
  mysql_atendimento_data:

networks:
  clinica-net:
    driver: bridge
```

**Diferenças em relação ao compose de desenvolvimento:**

| Aspecto | Dev (atual) | Produção-like (alvo) |
|---|---|---|
| MySQLs | 1 container, 3 bancos lógicos | 3 containers, 1 banco cada |
| Senha root | vazia | `MYSQL_ROOT_PASSWORD` via `.env` |
| JWT_SECRET | sem validação | `:?` — falha se não definido |
| Gateway | ausente | presente |
| init.sql | montado | não necessário (Hibernate cria) |

**`${JWT_SECRET:?mensagem}`**
Sintaxe do compose para variável obrigatória: se `JWT_SECRET` não estiver definido no `.env` ou no ambiente, o `docker compose up` falha imediatamente com a mensagem de erro. Evita subir a stack com um segredo vazio em produção.

---

## .dockerignore

Arquivo criado em `raiz/.dockerignore`. Define o que **não** entra no contexto de build enviado ao Docker daemon. Contexto menor = build mais rápido e menos dados transferidos.

```
**/target/        ← JARs, classes compiladas — reconstruídos no build stage
**/.idea/         ← arquivos do IntelliJ
**/.git/          ← histórico git — não é necessário para o build
**/*.iml          ← arquivos de módulo do IntelliJ
**/*.log
**/.DS_Store      ← artefatos do macOS
**/docs/          ← documentação — não vai para a imagem
*.md
.env              ← NUNCA deve entrar na imagem
.env.example
```

**Como verificar o contexto enviado:**
```bash
docker build --no-cache . 2>&1 | grep "Sending build context"
# Sending build context to Docker daemon  X.XXMB
```
Com `.dockerignore`, o valor deve ser bem menor do que sem ele.

---

## .env e .env.example

Crie um `.env` na raiz baseado no `.env.example`:

```bash
cp .env.example .env
# Edite .env com seus valores reais
```

O Docker Compose lê `.env` automaticamente. Nunca commite o `.env` — já está no `.gitignore`.

Para gerar um `JWT_SECRET` seguro:
```bash
openssl rand -base64 64
```

---

## Comandos operacionais

### Subir a stack

```bash
# Primeira execução ou após mudar código
docker compose up --build

# Em background
docker compose up -d --build

# Só o banco (útil para rodar o serviço na IDE)
docker compose up -d mysql
```

### Acompanhar logs

```bash
# Todos os serviços
docker compose logs -f

# Um serviço específico
docker compose logs -f administrativo

# Últimas 100 linhas
docker compose logs --tail=100 administrativo
```

### Reiniciar e rebuild

```bash
# Rebuild e reinicia só um serviço (sem parar os outros)
docker compose up -d --build administrativo

# Forçar recriação sem rebuild (útil após mudar variáveis de ambiente)
docker compose up -d --force-recreate administrativo
```

### Parar

```bash
# Para os containers (mantém volumes)
docker compose down

# Para e destrói os volumes (dados do banco zerados — DESTRUTIVO)
docker compose down -v

# Para um serviço só
docker compose stop administrativo
```

### Inspecionar

```bash
# Status de todos os containers e healthchecks
docker compose ps

# Entrar no container da aplicação
docker compose exec administrativo sh

# Entrar no MySQL
docker compose exec mysql mysql -uroot clinica_administrativo

# Ver variáveis de ambiente do container
docker compose exec administrativo env | sort
```

### Build isolado (sem compose)

```bash
# Buildar imagem do administrativo
docker build --build-arg MODULE=administrativo -t clinica/administrativo:latest .

# Buildar imagem do agendamento
docker build --build-arg MODULE=agendamento -t clinica/agendamento:latest .
```

---

## Healthchecks — MySQL e Spring Boot

### MySQL (já configurado)

```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 20s
```

O `mysqladmin ping` retorna 0 quando o MySQL aceita conexões. O `start_period` é essencial: na primeira inicialização, o MySQL roda os scripts de init e pode demorar ~15-20s antes de aceitar conexões.

### Spring Boot (adicionar ao Actuator)

Quando a Fase 6 (Segurança) estiver concluída, adicione `spring-boot-starter-actuator` às dependências e configure:

```yaml
# application.yml de cada serviço
management:
  endpoints:
    web:
      exposure:
        include: health
  endpoint:
    health:
      show-details: never        # nunca expor detalhes em produção
  server:
    port: 8091                   # porta separada para actuator (opcional)
```

Com isso, o healthcheck do compose pode verificar o serviço em si:

```yaml
# No docker-compose.yml
administrativo:
  healthcheck:
    test: ["CMD-SHELL", "wget -qO- http://localhost:8081/actuator/health | grep UP || exit 1"]
    interval: 15s
    timeout: 5s
    retries: 5
    start_period: 45s
```

`wget` está disponível no Alpine por padrão. `curl` não está.

**Por que healthcheck do serviço importa?**
Permite que o `depends_on: condition: service_healthy` do `gateway` aguarde o `administrativo` estar realmente pronto para receber tráfego — não apenas iniciado. Sem isso, o gateway pode começar a rotear antes do Spring Boot subir completamente.

---

## Fluxo de boot — o que acontece internamente

```
docker compose up --build

1. Docker constrói as imagens (multi-stage Dockerfile)
   ├─ Stage build: mvn package → fat JAR
   └─ Stage runtime: copia JAR → imagem Alpine

2. MySQL sobe e executa init.sql (se volume vazio)
   ├─ Cria os 3 bancos
   ├─ Cria todas as tabelas
   └─ Insere admin@clinica.com

3. Healthcheck do MySQL: mysqladmin ping a cada 10s
   └─ Após passar, o depends_on libera o próximo serviço

4. administrativo sobe
   ├─ Conecta ao MySQL (SPRING_DATASOURCE_URL com hostname mysql)
   ├─ Hibernate roda ddl-auto=update (detecta diff do schema)
   ├─ CommandLineRunner: insere admin se não existir (INSERT IGNORE)
   └─ Tomcat sobe na porta 8081

5. (estado alvo) agendamento e atendimento sobem após MySQL e administrativo
6. (estado alvo) gateway sobe por último
```

**Tempo esperado:**
- Primeiro build: ~4–6 min (download de dependências Maven + imagens Docker)
- Primeiro `up` após build: ~30–45s (init.sql + Spring Boot)
- Restarts subsequentes: ~15–20s

---

## Trabalhando com IDE + Docker

Durante o desenvolvimento, você não precisa rodar o serviço em container. O fluxo mais produtivo é:

1. **MySQL em container:** `docker compose up -d mysql`
2. **Serviço na IDE:** `Run → AdministrativoApplication` no IntelliJ

O `application.properties` já aponta para `localhost:3307`, então funciona diretamente.

**Por que não rodar tudo em container durante o desenvolvimento?**
- Rebuild de container a cada mudança de código leva ~20s (mesmo com cache de deps).
- Hot reload com Spring DevTools na IDE é instantâneo.
- Debugger do IntelliJ funciona nativamente com a IDE, não precisa de port mapping.

Quando a feature estiver pronta, faça `docker compose up --build` para validar que o container também funciona.

---

## Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Connection refused` ao tentar conectar ao MySQL via compose | O serviço Spring Boot subiu antes do MySQL estar pronto | Verificar `depends_on: condition: service_healthy` e `start_period` do healthcheck |
| `Public Key Retrieval is not allowed` | Falta `allowPublicKeyRetrieval=true` na URL | Adicionar o parâmetro na `SPRING_DATASOURCE_URL` |
| `Table 'X' doesn't exist` | init.sql não rodou (volume já existia) | `docker compose down -v && docker compose up -d` |
| `Port 3307 already in use` | MySQL local rodando na mesma porta | `sudo systemctl stop mysql` ou mudar porta no compose |
| Imagem antiga sendo usada após mudança de código | Cache do Docker | `docker compose up --build --force-recreate` |
| Container `OOMKilled` (saiu com code 137) | JVM ultrapassou o memory limit do container | Aumentar `memory:` no compose ou ajustar `MaxRAMPercentage` |
| `JWT_SECRET:? JWT_SECRET obrigatório` ao rodar compose full | Variável não definida | Criar `.env` a partir do `.env.example` |
| `Hibernate não cria tabelas` | `ddl-auto: validate` ou `none` | Alterar para `update` em `application.yml` |
| Build lento sempre (sem cache) | `.dockerignore` não exclui `target/` | Verificar se `.dockerignore` existe e tem `**/target/` |
| `Address already in use: 8081` | Porta ocupada pelo IntelliJ | Parar a aplicação na IDE antes do `docker compose up` |
| `docker-compose: command not found` | Docker antigo (v1) | Usar `docker compose` (sem hífen, plugin v2) |

---

## Checklist — Estado atual (1 MySQL + administrativo)

- [ ] `Dockerfile` na raiz com multi-stage e `ARG MODULE`
- [ ] `.dockerignore` criado
- [ ] `.env.example` criado; `.env` local gerado e no `.gitignore`
- [ ] `sql/init.sql` montado em `/docker-entrypoint-initdb.d/`
- [ ] `docker compose up -d mysql` → healthcheck passa
- [ ] `docker compose up --build` → `administrativo` sobe na 8081
- [ ] `curl http://localhost:8081/v1/convenios` → `200 OK`
- [ ] `docker compose exec mysql mysql -uroot clinica_administrativo -e "SHOW TABLES;"` → lista tabelas
- [ ] `docker compose down -v && docker compose up -d` → init.sql reexecuta limpo

## Checklist — Stack completa (após Fases 3–5)

- [ ] Migrar `docker-compose.yml` para o modelo com 3 MySQLs + gateway
- [ ] `gateway/pom.xml` adicionado ao `pom.xml` raiz
- [ ] `ARG MODULE=gateway` funciona no Dockerfile (gateway no COPY dos pom.xml)
- [ ] Todos os `JWT_SECRET` injetados via `.env`
- [ ] `docker compose up --build` sobe todos os 7 containers
- [ ] Healthchecks dos 3 MySQLs passando
- [ ] `POST http://localhost:8080/auth/login` → retorna JWT
- [ ] Com JWT: criar convênio → criar paciente → criar médico → criar agendamento → registrar atendimento
- [ ] `docker compose down -v` limpa tudo corretamente

---

## Próximo passo

[`10-CICD.md`](10-CICD.md) — pipeline GitHub Actions para build, test e push de imagem.
