# 10 — CI/CD com GitHub Actions

> Pipeline automatizado em todo `push` e `pull_request`. Tempo estimado: 2h.

## O que vamos automatizar

1. **CI (`ci.yml`)** — em todo push e PR: compilar, rodar testes (incl. Testcontainers), publicar relatórios.
2. **Imagens Docker (`docker.yml`)** — em push para `main`: build e push das 4 imagens para o GitHub Container Registry (GHCR).
3. **Release (`release.yml`)** — em tag `v*`: cria GitHub Release com os JARs.

> Substitui o Jenkins do IMPL_GUIDE_PT2. Vantagem: zero infraestrutura, integrado ao repositório.

---

## Pré-requisitos

- Repositório no GitHub.
- Permissão `Settings → Actions → General → Workflow permissions: Read and write` (para publicar pacotes em GHCR).
- Branch `main` como default.

---

## Estrutura de pastas

```
.github/
└── workflows/
    ├── ci.yml
    ├── docker.yml
    └── release.yml
```

Crie a pasta com `mkdir -p .github/workflows`.

---

## `ci.yml` — Build + Test

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

permissions:
  contents: read
  checks: write
  pull-requests: write

jobs:
  build-and-test:
    name: Build and test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Cache Testcontainers Docker images
        uses: actions/cache@v4
        with:
          path: ~/.testcontainers
          key: testcontainers-${{ hashFiles('**/pom.xml') }}

      - name: Build and run tests
        run: mvn -B clean verify

      - name: Publish test report
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Maven Tests
          path: '**/target/surefire-reports/*.xml'
          reporter: java-junit

      - name: Upload coverage (JaCoCo)
        if: success()
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: '**/target/site/jacoco/'
```

> O runner `ubuntu-latest` já tem Docker rodando, então **Testcontainers funciona out-of-the-box**. Não precisa de Docker-in-Docker.
>
> O `cache: maven` na action `setup-java` cacheia `~/.m2/repository` por hash do pom.xml.

---

## `docker.yml` — Build e push das imagens

```yaml
name: Docker

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository_owner }}/clinica-medica

jobs:
  build-images:
    name: Build & push ${{ matrix.service }}
    runs-on: ubuntu-latest

    strategy:
      matrix:
        service: [administrativo, agendamento, atendimento, gateway]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-${{ matrix.service }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build & push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          build-args: |
            SERVICE=${{ matrix.service }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**O que isso faz:**

- Em todo push para `main`, builda **paralelamente** as 4 imagens (matrix strategy).
- Publica em `ghcr.io/<seu-usuario>/clinica-medica-administrativo:latest`, `:sha`, `:main`, etc.
- Reusa cache de build do GitHub Actions (`cache-from: type=gha`).

Após o primeiro run, as imagens aparecem em `https://github.com/<usuario>?tab=packages`.

---

## `release.yml` — GitHub Release

```yaml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    name: Build JARs and create release
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Build (skip tests — CI já validou)
        run: mvn -B clean package -DskipTests

      - name: Collect JARs
        run: |
          mkdir -p release
          cp administrativo/target/*.jar release/
          cp agendamento/target/*.jar release/
          cp atendimento/target/*.jar release/
          cp gateway/target/*.jar release/

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: release/*.jar
          generate_release_notes: true
```

**Como acionar:**

```bash
git tag v1.0.0
git push origin v1.0.0
```

Resultado: `https://github.com/<usuario>/<repo>/releases/tag/v1.0.0` com os 4 JARs anexados.

---

## Status check obrigatório no `main`

Para o CI virar bloqueio de merge:

1. Vá em **Settings → Branches → Add branch protection rule**.
2. Branch name pattern: `main`.
3. Marque:
   - **Require a pull request before merging**
   - **Require status checks to pass before merging** → adicione `Build and test`
   - **Require branches to be up to date before merging** (opcional)
4. Salve.

A partir daí, ninguém merga PR com CI vermelho.

---

## Badges no README

Adicione no topo do `README.md` da raiz:

```markdown
![CI](https://github.com/<usuario>/<repo>/actions/workflows/ci.yml/badge.svg)
![Docker](https://github.com/<usuario>/<repo>/actions/workflows/docker.yml/badge.svg)
```

Substitua `<usuario>/<repo>`.

---

## Como testar localmente antes de fazer push

```bash
# Mesmo comando que o CI roda
mvn -B clean verify

# Build de imagem (mesmo argumento que o workflow usa)
docker build --build-arg SERVICE=administrativo -t test/admin .
```

Se isso passa local, o CI passa.

---

## Boas práticas

1. **Não commitar credenciais.** Use `secrets` do GitHub: `Settings → Secrets and variables → Actions`.
2. **Use `pull_request_target` com cuidado.** Só se você precisar acessar secrets em PRs de fork.
3. **Limite o blast radius do `GITHUB_TOKEN`.** O bloco `permissions:` no topo do workflow restringe o que ele pode fazer.
4. **Use cache.** Tanto Maven (`cache: maven`) quanto Docker buildx (`cache-from: type=gha`).
5. **Roda matrix com `fail-fast: false`** se um serviço falhar não parar os outros (opcional).

---

## Troubleshooting

| Problema | Solução |
|---|---|
| Testcontainers `Could not find Docker on this machine` | Não pode rodar em runner self-hosted sem Docker. Use `ubuntu-latest`. |
| Push para GHCR retorna 403 | Faltou `permissions: packages: write` no workflow ou na conta. |
| Cache do Maven não pega | Confirme que o `cache: maven` está em `setup-java`, não em outro step. |
| Build do Docker muito lento | Garanta `cache-from/cache-to: type=gha`. Primeira execução é lenta; depois cacheia layers. |
| Test reporter vazio | Caminho do XML está errado. Para Maven: `**/target/surefire-reports/*.xml`. |

---

## Próximas evoluções (fora do MVP)

- **SonarQube via SonarCloud** (gratuito para repos públicos): adicionar step `sonarsource/sonarqube-scan-action`.
- **Análise de dependências (Dependabot):** ativar em `Settings → Security → Dependabot`.
- **CodeQL:** habilita scan de segurança em `Settings → Security → Code security and analysis`.
- **Deploy automático:** após `docker.yml` passar, abrir PR no repositório de infra/k8s atualizando o tag das imagens.

---

## Checklist

- [ ] Pasta `.github/workflows/` criada
- [ ] `ci.yml` rodando em PRs
- [ ] `docker.yml` publicando imagens em GHCR a cada push em `main`
- [ ] `release.yml` opcional (configurar quando for fazer a primeira release)
- [ ] Badges no README
- [ ] Status check `Build and test` obrigatório no `main`
- [ ] Primeira run verde

---

## Próximo passo

[`11-TESTES.md`](11-TESTES.md) — escrever a suite de testes que o CI vai rodar.
