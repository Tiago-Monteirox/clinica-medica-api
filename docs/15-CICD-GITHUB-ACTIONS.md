# 15 — CI/CD com GitHub Actions

> Guia de implementação do pipeline de CI/CD usando **GitHub Actions** no repositório `github.com/Tiago-Monteirox/clinica-medica-api`.
> Substitui a proposta anterior de Gitea local — usar GitHub Actions é mais simples, atende ao requisito de "cloud" e aproveita o repositório que já existe.

---

## Decisão

Usar **GitHub Actions** nativo do GitHub para:

- rodar `mvn test` em todo push e pull request;
- buildar imagens Docker dos 4 serviços;
- publicar imagens no **GitHub Container Registry (GHCR)** (`ghcr.io/tiago-monteirox/...`);
- gerar badge de build no README;
- (opcional) rodar smoke test contra a stack subida no próprio job.

O **deploy de homologation** continua sendo executado **localmente** com `docker compose` (a banca/avaliador vê a stack subindo). GitHub Actions cobre **build + test + publicação de imagens**, que é o escopo razoável de CI/CD para um projeto acadêmico.

---

## Por que não Gitea

A proposta anterior usava Gitea + `act_runner` local. O motivo era "não depender de infra externa". Como o projeto já vive em `github.com`, isso é redundante:

| Aspecto | GitHub Actions | Gitea + act_runner |
|---|---|---|
| Infra a manter | nenhuma (hosted) | Gitea + runner em containers |
| Custo | grátis para repos públicos | grátis (mas roda na sua máquina) |
| "Cloud" | runners hospedados pela GitHub | tudo local |
| Visibilidade pra avaliador | URL pública com logs e badge | precisa rodar a máquina |
| Sintaxe do workflow | YAML do GitHub Actions | **mesma sintaxe** (Gitea é compatível) |
| Esforço inicial | criar 1 arquivo YAML | subir Gitea, registrar runner, configurar DNS |

Como a sintaxe é a mesma, se um dia quiser portar pra Gitea/self-hosted, basta copiar os YAMLs pra `.gitea/workflows/`. Nada do código do projeto muda.

---

## Topologia

```text
┌──────────────────────────────────────────────────────────────┐
│ github.com/Tiago-Monteirox/clinica-medica-api                │
│                                                              │
│   push / PR                                                  │
│      │                                                       │
│      ▼                                                       │
│   .github/workflows/ci.yml                                   │
│      │                                                       │
│      ├──► job: test       (ubuntu-latest)                    │
│      │       └─ mvn -B test                                  │
│      │                                                       │
│      ├──► job: build      (depende de test)                  │
│      │       └─ mvn -B package -DskipTests                   │
│      │                                                       │
│      └──► job: docker     (só em push em main)               │
│              └─ build + push de 4 imagens pro GHCR           │
│                  ghcr.io/tiago-monteirox/clinica-*:<sha>     │
└──────────────────────────────────────────────────────────────┘
```

---

## Estratégia de arquivos

```text
raiz/
├── .github/
│   └── workflows/
│       ├── ci.yml              # test + build + docker (push)
│       └── pr.yml              # test apenas (em PR)
└── scripts/
    └── ci-smoke-test.sh        # opcional, rodado dentro de um job docker compose
```

| Arquivo | Responsabilidade |
|---|---|
| `.github/workflows/ci.yml` | Pipeline principal: testes, build, publicação de imagens em push para `main` |
| `.github/workflows/pr.yml` | Apenas testes e build (sem publicar imagem) em pull requests |
| `scripts/ci-smoke-test.sh` | Validação ponta a ponta opcional executada dentro do job |

---

## PASSO C0 — Preparar o repositório

### O que fazer

1. Confirmar que o repositório está em `github.com/Tiago-Monteirox/clinica-medica-api`.
2. Habilitar GitHub Actions (já vem habilitado por default em repos públicos).
3. Habilitar permissão de escrita no GHCR para o `GITHUB_TOKEN`:
   - `Settings → Actions → General → Workflow permissions`
   - Marcar **Read and write permissions**.

### Ponto de controle

- [ ] Repositório existe e tem permissão de Actions.
- [ ] `GITHUB_TOKEN` pode publicar pacotes (necessário pro GHCR).
- [ ] Aba **Actions** aparece no repositório.

---

## PASSO C1 — Workflow de CI (test)

### Objetivo

Rodar `mvn test` em todo push e pull request, deixando o status verde visível no GitHub.

### Arquivo

```text
.github/workflows/ci.yml
```

### Gatilhos

- `push` em qualquer branch.
- `pull_request` para `main`.

### Esqueleto esperado

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
      - run: mvn -B test
```

### Ponto de controle

- [ ] Push em qualquer branch dispara o workflow.
- [ ] Job `test` aparece na aba **Actions** e fica verde.
- [ ] Falha em qualquer teste deixa o job vermelho e barra o PR.
- [ ] Cache do Maven encurta builds subsequentes para < 1 min.

---

## PASSO C2 — Workflow de build dos JARs

### Objetivo

Garantir que os 4 módulos buildam (`mvn package`) com os JARs prontos para serem empacotados em Docker.

### Estratégia

Adicionar um job `build` no mesmo `ci.yml`, dependente de `test`:

```yaml
  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '21'
          cache: maven
      - run: mvn -B package -DskipTests
      - uses: actions/upload-artifact@v4
        with:
          name: jars
          path: |
            administrativo/target/*.jar
            agendamento/target/*.jar
            atendimento/target/*.jar
            gateway/target/*.jar
          retention-days: 7
```

### Ponto de controle

- [ ] Job `build` roda só se `test` passou.
- [ ] Os 4 JARs ficam disponíveis como artefato `jars` no run.
- [ ] Nenhum JAR `.jar.original` aparece nos artefatos (deve usar pattern `${MODULE}-*-SNAPSHOT.jar`).

---

## PASSO C3 — Workflow de build Docker + push pro GHCR

### Objetivo

Buildar as 4 imagens Docker e publicar no GitHub Container Registry com tag pelo commit SHA + `latest`.

### Estratégia

Job extra no `ci.yml`, condicional a push em `main`:

```yaml
  docker:
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        module: [administrativo, agendamento, atendimento, gateway]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: jars
          path: .
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          build-args: MODULE=${{ matrix.module }}
          push: true
          tags: |
            ghcr.io/tiago-monteirox/clinica-${{ matrix.module }}:${{ github.sha }}
            ghcr.io/tiago-monteirox/clinica-${{ matrix.module }}:latest
```

> Observação: como o `Dockerfile` agora é **runtime-only** (ver doc 14), o job baixa os JARs do artefato `jars` antes de buildar. Isso evita refazer `mvn package` dentro do container.

### Ponto de controle

- [ ] Em push em `main`, as 4 imagens são publicadas em `ghcr.io/tiago-monteirox/clinica-*`.
- [ ] Cada imagem tem 2 tags: o SHA do commit e `latest`.
- [ ] Aba **Packages** do repositório lista os 4 pacotes.
- [ ] Pull de uma imagem por terceiros funciona após `docker login ghcr.io`.

---

## PASSO C4 — Cobertura com JaCoCo (opcional, mas recomendado)

### Objetivo

Mostrar percentual de cobertura nos testes unitários.

### O que fazer

1. Adicionar o plugin JaCoCo no `<pluginManagement>` do `pom.xml` raiz.
2. Vincular execuções nos `prepare-agent` e `report` do ciclo de testes.
3. No workflow, após `mvn test`, fazer upload do `target/site/jacoco/jacoco.xml`.
4. (Opcional) Integrar com Codecov ou similar.

### Esqueleto do step

```yaml
      - run: mvn -B verify
      - uses: codecov/codecov-action@v4
        if: success()
        with:
          files: '**/target/site/jacoco/jacoco.xml'
          token: ${{ secrets.CODECOV_TOKEN }}
```

### Ponto de controle

- [ ] `mvn verify` gera relatório JaCoCo em cada módulo.
- [ ] Workflow upload do XML.
- [ ] Badge de cobertura aparece no README.

---

## PASSO C5 — Badges no README

### Badges sugeridas

| Badge | URL |
|---|---|
| CI status | `https://github.com/Tiago-Monteirox/clinica-medica-api/actions/workflows/ci.yml/badge.svg` |
| Cobertura (se integrar Codecov) | `https://codecov.io/gh/Tiago-Monteirox/clinica-medica-api/branch/main/graph/badge.svg` |
| Last release | gerado pelo GitHub Releases |

### Onde colocar

No topo do `README.md`, abaixo do título.

### Ponto de controle

- [ ] Badge de CI aparece verde no README após o primeiro push em `main`.
- [ ] Link da badge leva para a aba **Actions**.

---

## PASSO C6 — Smoke test pós-build (opcional)

### Objetivo

Mostrar que as imagens recém-publicadas sobem e respondem.

### Estratégia

Job extra que baixa o `docker-compose.yml` + os JARs (ou puxa as imagens recém-publicadas) e roda:

```yaml
  smoke:
    runs-on: ubuntu-latest
    needs: docker
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: jars
          path: .
      - run: docker compose up --build -d
      - run: |
          for i in {1..30}; do
            if curl -sf http://localhost:8084/actuator/health > /dev/null; then exit 0; fi
            sleep 2
          done
          exit 1
      - run: bash scripts/ci-smoke-test.sh
      - if: always()
        run: docker compose down -v
```

### Validações mínimas do `scripts/ci-smoke-test.sh`

1. Gateway responde em `/actuator/health` → 200.
2. `POST /auth/login` retorna token.
3. Endpoint autenticado retorna 200 com Bearer.
4. Endpoint privado sem token retorna 401.

### Variáveis

| Variável | Exemplo |
|---|---|
| `BASE_URL` | `http://localhost:8084` |
| `ADMIN_EMAIL` | `admin@clinica.com` |
| `ADMIN_PASSWORD` | `admin123` |

### Ponto de controle

- [ ] Job `smoke` roda após `docker`.
- [ ] Falha se o gateway não subir em 60s.
- [ ] Falha se o login não retornar token.
- [ ] Falha se endpoint protegido aceitar request sem token.

---

## PASSO C7 — Secrets e segurança

### O que NÃO commitar

- senhas reais (`JWT_SECRET`, `MYSQL_ROOT_PASSWORD`);
- tokens pessoais;
- chaves de assinatura.

### Onde guardar

| Tipo | Lugar |
|---|---|
| `JWT_SECRET` de homologation | `.env.homologation` (fora do Git) |
| `JWT_SECRET` de produção | GitHub Secret (`Settings → Secrets and variables → Actions`) |
| Token de registry externo (se houver) | GitHub Secret |
| `GITHUB_TOKEN` | injetado automaticamente, **não** precisa criar |

### Ponto de controle

- [ ] Nenhum secret real está versionado.
- [ ] `.env*` reais estão no `.gitignore`.
- [ ] Workflows usam `${{ secrets.X }}` ou `${{ github.token }}`, nunca string fixa.

---

## PASSO C8 — Demonstração para a banca

### Roteiro de apresentação

1. Abrir o repositório no GitHub.
2. Mostrar a aba **Actions** com o último run verde.
3. Abrir o run mais recente — destacar os jobs `test → build → docker → smoke`.
4. Mostrar a aba **Packages** com as 4 imagens publicadas no GHCR.
5. Fazer um commit local trivial + push → mostrar o workflow disparando ao vivo.
6. (Opcional) Pull de uma imagem do GHCR localmente:
   ```bash
   docker pull ghcr.io/tiago-monteirox/clinica-administrativo:latest
   ```
7. Mostrar a badge no README como atalho.

### Evidências visuais

| Evidência | Onde |
|---|---|
| Workflow verde | Actions tab |
| Logs do Maven | clique no job `test` |
| Build Docker | clique no job `docker` |
| Imagens publicadas | Packages tab |
| Badge | topo do README |

### Ponto de controle

- [ ] Demonstração executável a partir de uma URL pública.
- [ ] Banca não precisa instalar nada.
- [ ] Pipeline mostra claramente CI (test) + build artefato (jar) + build/publish imagem.

---

## Troubleshooting

### Workflow não dispara

Verificar:
- arquivo está em `.github/workflows/` (não `.github/workflow/`).
- nome termina em `.yml` ou `.yaml`.
- sintaxe YAML válida (indentação).
- Actions habilitado em `Settings → Actions`.

### `permission_denied` ao publicar no GHCR

Verificar:
- `Settings → Actions → General → Workflow permissions` está como **Read and write**.
- job declara `permissions: { packages: write }`.
- Usuário do login é `${{ github.actor }}`.

### Imagem publicada não é encontrada

Verificar:
- nome do pacote (lowercase) — `ghcr.io/tiago-monteirox/...`, não `Tiago-Monteirox`.
- visibilidade do pacote: pode estar como **private** por default. Trocar para **public** em `Packages → Package settings → Change visibility`.

### Maven baixa tudo de novo a cada run

Verificar:
- `actions/setup-java@v4` está usando `cache: maven`.
- `pom.xml` raiz é o hash usado pra cache key — não muda toda hora.

### Job de Docker quebra com "no main manifest attribute"

Verificar:
- artefato `jars` foi baixado antes do `docker build`.
- `.dockerignore` libera `**/target/*.jar`.
- `Dockerfile` faz `COPY ${MODULE}/target/${MODULE}-*-SNAPSHOT.jar app.jar` (não casa `.jar.original`).

---

## Portabilidade para Gitea / self-hosted (futuro)

Se um dia for necessário rodar a esteira sem depender do GitHub:

1. Subir Gitea localmente com `act_runner`.
2. Copiar `.github/workflows/*.yml` para `.gitea/workflows/`.
3. Trocar `${{ secrets.GITHUB_TOKEN }}` por um token de runner do Gitea.
4. Trocar `ghcr.io` por registry local (ex.: `localhost:5000`).

A sintaxe dos workflows é a mesma. Não há retrabalho no código do projeto.

---

## Definition of Done

O CI/CD com GitHub Actions está concluído quando:

1. `.github/workflows/ci.yml` existe e roda em todo push.
2. Job `test` executa `mvn test` e fica verde com 29 testes passando.
3. Job `build` empacota os 4 JARs e disponibiliza como artefato.
4. Job `docker` publica as 4 imagens em `ghcr.io/tiago-monteirox/clinica-*` em push para `main`.
5. Badge de CI no README aponta para o workflow.
6. Nenhum secret real está versionado.
7. Aba **Packages** do repositório lista as 4 imagens.
8. (Opcional) Job `smoke` valida que a stack sobe e responde.
