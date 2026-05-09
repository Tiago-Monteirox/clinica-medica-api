# 09 — Docker

> Containerizar todos os serviços e subir a stack com Docker Compose. Tempo estimado: 2h.

## O que vamos containerizar

| Container | Imagem base | Porta host:container |
|---|---|---|
| `mysql-administrativo` | `mysql:8` | `3307:3306` |
| `mysql-agendamento` | `mysql:8` | `3308:3306` |
| `mysql-atendimento` | `mysql:8` | `3309:3306` |
| `administrativo` | build local | `8081:8081` |
| `agendamento` | build local | `8082:8082` |
| `atendimento` | build local | `8083:8083` |
| `gateway` | build local | `8080:8080` |

Tudo na mesma network `clinica-net`.

---

## `Dockerfile` multi-stage (template)

Crie um `Dockerfile` em **cada** módulo de serviço (administrativo, agendamento, atendimento, gateway). Use este template e ajuste o `<service>` e a `EXPOSE`:

```dockerfile
# ============================================================
# Stage 1 — Build
# ============================================================
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace

# Copia tudo (multi-módulo precisa do parent + commons + serviço)
COPY pom.xml ./
COPY commons/pom.xml commons/
COPY administrativo/pom.xml administrativo/
COPY agendamento/pom.xml agendamento/
COPY atendimento/pom.xml atendimento/
COPY gateway/pom.xml gateway/

# Pré-baixa dependências (cache de layers)
RUN mvn dependency:go-offline -B || true

# Agora copia o código-fonte
COPY commons/src commons/src
COPY administrativo/src administrativo/src
COPY agendamento/src agendamento/src
COPY atendimento/src atendimento/src
COPY gateway/src gateway/src

# Builda o serviço específico (e seus dependentes via -am)
ARG SERVICE
RUN mvn -pl ${SERVICE} -am clean package -DskipTests -B

# ============================================================
# Stage 2 — Runtime
# ============================================================
FROM eclipse-temurin:17-jre AS runtime
WORKDIR /app

ARG SERVICE
COPY --from=build /workspace/${SERVICE}/target/*.jar app.jar

ENV JAVA_OPTS=""
EXPOSE 8081 8082 8083 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
```

> **Por que multi-stage?** Stage 1 baixa Maven + JDK + dependências (~500MB). Stage 2 só leva o JRE + o JAR (~200MB). Resultado: imagem final menor e mais segura (sem ferramentas de build).
>
> **Por que copiar todos os módulos?** Maven multi-módulo precisa resolver as dependências entre módulos no momento do build. Não dá para isolar só um.

### Build args

Cada serviço passa o `SERVICE` no `build:` do compose. Exemplo manual:

```bash
docker build --build-arg SERVICE=administrativo -t clinica/administrativo:latest .
```

> **Alternativa mais simples:** ter um `Dockerfile` único na raiz do projeto e parametrizar via build arg. Documentado acima. Se preferir, crie um `Dockerfile` específico por serviço, hardcoded.

---

## `docker-compose.yml` (reescrito)

Substitua o `docker-compose.yml` atual da raiz por este:

```yaml
name: clinica-medica

services:
  # ============================================================
  # MySQLs — um por serviço (database-per-service)
  # ============================================================
  mysql-administrativo:
    image: mysql:8
    container_name: mysql-administrativo
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: clinica_administrativo
    ports:
      - "3307:3306"
    volumes:
      - mysql_administrativo_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [clinica-net]

  mysql-agendamento:
    image: mysql:8
    container_name: mysql-agendamento
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: clinica_agendamento
    ports:
      - "3308:3306"
    volumes:
      - mysql_agendamento_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [clinica-net]

  mysql-atendimento:
    image: mysql:8
    container_name: mysql-atendimento
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: clinica_atendimento
    ports:
      - "3309:3306"
    volumes:
      - mysql_atendimento_data:/var/lib/mysql
    command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-proot"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [clinica-net]

  # ============================================================
  # Microsserviços
  # ============================================================
  administrativo:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE: administrativo
    image: clinica/administrativo:latest
    container_name: administrativo
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      SERVER_PORT: 8081
      DB_HOST: mysql-administrativo
      DB_PORT: 3306
      DB_NAME: clinica_administrativo
      DB_USER: root
      DB_PASSWORD: root
      JWT_SECRET: ${JWT_SECRET:-dev-secret-please-change-in-production-with-256-bits-minimum}
    depends_on:
      mysql-administrativo:
        condition: service_healthy
    networks: [clinica-net]

  agendamento:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE: agendamento
    image: clinica/agendamento:latest
    container_name: agendamento
    restart: unless-stopped
    ports:
      - "8082:8082"
    environment:
      SERVER_PORT: 8082
      DB_HOST: mysql-agendamento
      DB_PORT: 3306
      DB_NAME: clinica_agendamento
      DB_USER: root
      DB_PASSWORD: root
      ADMINISTRATIVO_URL: http://administrativo:8081
      JWT_SECRET: ${JWT_SECRET:-dev-secret-please-change-in-production-with-256-bits-minimum}
    depends_on:
      mysql-agendamento:
        condition: service_healthy
      administrativo:
        condition: service_started
    networks: [clinica-net]

  atendimento:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE: atendimento
    image: clinica/atendimento:latest
    container_name: atendimento
    restart: unless-stopped
    ports:
      - "8083:8083"
    environment:
      SERVER_PORT: 8083
      DB_HOST: mysql-atendimento
      DB_PORT: 3306
      DB_NAME: clinica_atendimento
      DB_USER: root
      DB_PASSWORD: root
      AGENDAMENTO_URL: http://agendamento:8082
      JWT_SECRET: ${JWT_SECRET:-dev-secret-please-change-in-production-with-256-bits-minimum}
    depends_on:
      mysql-atendimento:
        condition: service_healthy
      agendamento:
        condition: service_started
    networks: [clinica-net]

  gateway:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        SERVICE: gateway
    image: clinica/gateway:latest
    container_name: gateway
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      SERVER_PORT: 8080
      ADMINISTRATIVO_URL: http://administrativo:8081
      AGENDAMENTO_URL: http://agendamento:8082
      ATENDIMENTO_URL: http://atendimento:8083
      JWT_SECRET: ${JWT_SECRET:-dev-secret-please-change-in-production-with-256-bits-minimum}
    depends_on:
      administrativo:
        condition: service_started
      agendamento:
        condition: service_started
      atendimento:
        condition: service_started
    networks: [clinica-net]

# ============================================================
# Volumes e network
# ============================================================
volumes:
  mysql_administrativo_data:
  mysql_agendamento_data:
  mysql_atendimento_data:

networks:
  clinica-net:
    driver: bridge
```

---

## `.dockerignore`

Crie `.dockerignore` na raiz para acelerar o build (exclui o que não precisa entrar no contexto):

```
**/target/
**/.idea/
**/.git/
**/.mvn/wrapper/
**/*.log
**/.DS_Store
**/.planning/
**/docs/
*.md
```

---

## Fluxo de boot

```
1. docker compose up --build

2. Os 3 MySQLs sobem em paralelo (~10s cada).
3. Quando os healthchecks passam, os 3 microsserviços sobem (paralelo).
4. Cada microsserviço:
   - Conecta no seu MySQL (DB_HOST=mysql-<servico>)
   - Hibernate cria as tabelas (ddl-auto=update)
   - Spring Security inicializa
   - Tomcat sobe na porta configurada
5. Gateway sobe quando os 3 já estão de pé.
```

Tempo total: ~60-90s na primeira execução (com build); ~30s nas execuções seguintes.

---

## Variáveis de ambiente (`.env` opcional)

Crie um `.env` na raiz para sobrescrever defaults sem editar o compose:

```env
JWT_SECRET=meu-segredo-super-secreto-com-pelo-menos-256-bits-aqui
JPA_SHOW_SQL=false
```

O `docker compose` lê automaticamente. Versão do exemplo do professor mostra como.

> **Nunca commite o `.env`.** Adicione ao `.gitignore`.

---

## Operações comuns

```bash
# Subir tudo
docker compose up --build

# Subir em background
docker compose up -d --build

# Ver logs (tail)
docker compose logs -f
docker compose logs -f administrativo   # de um serviço

# Reiniciar um serviço
docker compose restart agendamento

# Rebuilds só o que mudou
docker compose up --build

# Derrubar tudo (mantém volumes)
docker compose down

# Derrubar e apagar dados dos bancos
docker compose down -v

# Entrar num container
docker compose exec administrativo sh
docker compose exec mysql-administrativo mysql -uroot -proot clinica_administrativo

# Status dos healthchecks
docker compose ps
```

---

## Build script auxiliar (opcional)

Igual ao `app-order-service` tem `build-and-run.sh`. Crie na raiz:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "==> Maven package (skip tests)"
mvn -B clean package -DskipTests

echo "==> Docker compose up --build"
docker compose up --build -d

echo "==> Aguardando serviços..."
sleep 30

echo "==> Status:"
docker compose ps

echo
echo "Endpoints:"
echo "  Gateway:        http://localhost:8080"
echo "  Administrativo: http://localhost:8081/swagger-ui.html"
echo "  Agendamento:    http://localhost:8082/swagger-ui.html"
echo "  Atendimento:    http://localhost:8083/swagger-ui.html"
```

Tornar executável: `chmod +x build-and-run.sh`.

> **Nota:** se usar o multi-stage Docker (que faz `mvn package` dentro do container), o `mvn package` local antes é redundante. Mantém só por compatibilidade com IDE / ferramentas locais.

---

## Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| `Connection refused` no Feign | Microsserviço alvo ainda não subiu | Aumentar `depends_on` com `service_healthy` (após implementar healthcheck `/actuator/health`) |
| MySQL "Public Key Retrieval is not allowed" | URL JDBC incompleta | Adicionar `&allowPublicKeyRetrieval=true` na URL |
| Imagem nova não usada após rebuild | Cache do compose | `docker compose up --build --force-recreate` |
| Porta 3307 já em uso | Outro MySQL local | Mudar porta externa ou parar o local |
| Hibernate não cria tabelas | `ddl-auto: validate` em vez de `update` | Ajustar `spring.jpa.hibernate.ddl-auto: update` |
| `docker compose` comando não encontrado | Versão antiga | Use `docker-compose` (com hífen) ou atualize o Docker |

---

## Healthcheck no Spring (recomendado)

Adicione `spring-boot-starter-actuator` aos microsserviços e habilite o endpoint health:

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      show-details: when-authorized
```

Atualize o `depends_on` no compose para usar healthcheck dos serviços (não só do MySQL):

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8081/actuator/health"]
  interval: 15s
  timeout: 5s
  retries: 5
  start_period: 30s
```

E adicione `curl` na imagem runtime (Eclipse Temurin não traz por padrão):

```dockerfile
FROM eclipse-temurin:17-jre AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
...
```

---

## Checklist

- [ ] `Dockerfile` na raiz com multi-stage e ARG `SERVICE`
- [ ] `.dockerignore` criado
- [ ] `docker-compose.yml` reescrito com 3 MySQLs + 3 microsserviços + gateway + network
- [ ] `JWT_SECRET` injetado em todos os serviços
- [ ] `depends_on` com healthcheck dos MySQLs
- [ ] `docker compose up --build` sobe tudo verde
- [ ] `curl http://localhost:8080/auth/login ...` funciona
- [ ] `docker compose down -v` apaga volumes corretamente

---

## Próximo passo

[`10-CICD.md`](10-CICD.md) — automação com GitHub Actions.
