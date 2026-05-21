# 13 — Ambientes e Wireframes do Frontend

> Documento de proposta. Não contém código, manifests Kubernetes ou implementação de telas.
> Status: frontend adiado. Para a decisão atual de ambientes, use [`14-CONTEINERIZACAO-AMBIENTES.md`](14-CONTEINERIZACAO-AMBIENTES.md). A proposta Kubernetes foi substituída por Docker Compose + GitHub Actions para a entrega (ver [`15-CICD-GITHUB-ACTIONS.md`](15-CICD-GITHUB-ACTIONS.md)).

## Objetivo

Definir uma proposta simples e defensável para dois ambientes do projeto e um esqueleto de interface para consumir as rotas do backend via API Gateway.

O projeto nasceu com a decisão arquitetural de **database-per-service**. Na prática atual, o checkpoint mostra uma stack funcional com **um MySQL e três databases lógicos**:

- `clinica_administrativo`
- `clinica_agendamento`
- `clinica_atendimento`

A proposta abaixo mantém isso como ambiente simplificado e reserva a separação física em três bancos para produção.

---

## Decisão de ambientes

### Ambiente 1 — Desenvolvimento / Homologação simplificada

**Objetivo:** facilitar execução, demonstração, testes manuais e validação do trabalho sem custo operacional alto.

**Topologia sugerida:**

```text
frontend
   |
   v
gateway
   |
   +--> administrativo ----+
   +--> agendamento -------+--> MySQL único
   +--> atendimento -------+    ├─ clinica_administrativo
                                ├─ clinica_agendamento
                                └─ clinica_atendimento
```

**Quando usar:**

- Desenvolvimento local.
- Demonstração para professor/banca.
- Homologação didática de fluxo ponta a ponta.
- Execução barata em um único host ou cluster pequeno.

**Justificativa técnica:**

Mesmo com um servidor MySQL único, cada serviço continua usando **seu próprio database/schema**. Isso preserva parte importante do isolamento lógico e mantém o código preparado para produção, desde que as URLs de banco sejam configuráveis por ambiente.

**Ressalva importante:**

Homologação normalmente deveria ser parecida com produção. Aqui a homologação simplificada é uma decisão pragmática por custo e complexidade. Ela valida regra de negócio e integração HTTP, mas não valida completamente isolamento físico, latência, credenciais independentes e falhas individuais de cada banco.

---

### Ambiente 2 — Produção

**Objetivo:** representar a arquitetura real de microsserviços, com independência operacional entre os bancos.

**Topologia sugerida:**

```text
frontend
   |
   v
gateway
   |
   +--> administrativo --> DBaaS administrativo
   +--> agendamento ----> DBaaS agendamento
   +--> atendimento ----> DBaaS atendimento
```

**Quando usar:**

- Ambiente final de produção.
- Demonstração de arquitetura cloud-native.
- Cenários em que se deseja provar database-per-service de forma completa.

**Justificativa técnica:**

Cada serviço passa a ter host, credencial, backup, escala e ciclo de manutenção próprios. Isso reduz acoplamento entre domínios, mas exige configuração e operação mais cuidadosas.

---

## Kubernetes: escopo recomendado

Kubernetes faz sentido para demonstrar deploy organizado dos serviços, mas a sugestão é separar responsabilidades:

| Componente | Desenvolvimento / Homologação | Produção |
|---|---|---|
| `gateway` | Deployment + Service | Deployment + Service + Ingress |
| `administrativo` | Deployment + Service | Deployment + Service |
| `agendamento` | Deployment + Service | Deployment + Service |
| `atendimento` | Deployment + Service | Deployment + Service |
| Banco | MySQL único, preferencialmente fora do app ou StatefulSet simples | DBaaS externo, 3 instâncias/databases isolados |
| Configuração | ConfigMap + Secret por namespace | ConfigMap + Secret por namespace |
| Exposição externa | Gateway exposto | Gateway exposto |

### Namespaces sugeridos

| Namespace | Uso |
|---|---|
| `clinica-hml` | desenvolvimento compartilhado / homologação simplificada |
| `clinica-prod` | produção |

### Objetos esperados por ambiente

Para cada ambiente, o esqueleto conceitual é:

```text
namespace
├─ config
│  ├─ URLs internas dos serviços
│  ├─ porta do gateway
│  └─ parâmetros não sensíveis
├─ secrets
│  ├─ senhas dos bancos
│  ├─ JWT_SECRET
│  └─ credenciais de registry se necessário
├─ workloads
│  ├─ gateway
│  ├─ administrativo
│  ├─ agendamento
│  └─ atendimento
├─ services
│  ├─ gateway
│  ├─ administrativo
│  ├─ agendamento
│  └─ atendimento
└─ ingress
   └─ entrada HTTP pública somente para o gateway
```

### Matriz de configuração

| Serviço | HML simplificado | Produção |
|---|---|---|
| `administrativo` | MySQL único / database `clinica_administrativo` | DBaaS administrativo |
| `agendamento` | MySQL único / database `clinica_agendamento` | DBaaS agendamento |
| `atendimento` | MySQL único / database `clinica_atendimento` | DBaaS atendimento |
| `gateway` | aponta para services internos do cluster | aponta para services internos do cluster |
| `JWT_SECRET` | único por ambiente | único por ambiente, mais forte e protegido |

### Pontos que precisam ficar claros na apresentação

- Em homologação simplificada, o isolamento é lógico.
- Em produção, o isolamento é físico ou gerenciado por DBaaS.
- O código não deve depender de host fixo de banco.
- Os serviços devem receber `SPRING_DATASOURCE_URL`, usuário e senha por ambiente.
- O frontend deve consumir apenas o Gateway, nunca os microsserviços diretamente.

---

## Riscos e mitigação

| Risco | Onde aparece | Mitigação |
|---|---|---|
| Homologação diferente da produção | Banco único em HML, três bancos em produção | Documentar a diferença e validar produção com smoke tests |
| Referência órfã entre serviços | `agendamento` guarda `pacienteId` e `medicoId` | Validar via Feign na criação e definir regra para exclusão |
| Falha de serviço dependente | `agendamento` depende do `administrativo`; `atendimento` depende do `agendamento` | ErrorDecoder, resposta 502 e logs claros |
| Configuração divergente | URLs, secrets e portas por ambiente | Centralizar em ConfigMaps/Secrets |
| Gateway indisponível | Única entrada externa | Healthcheck, restart policy e replicas em produção |

---

## Design do frontend

### Direção visual

Interface operacional, simples e eficiente. O sistema deve parecer uma ferramenta interna de clínica, não uma landing page.

**Estilo sugerido:**

- Layout com sidebar fixa no desktop.
- Topbar simples com busca, usuário logado e ação de sair.
- Tabelas densas, mas legíveis.
- Filtros visíveis acima das tabelas.
- Formulários em página dedicada ou drawer lateral.
- Cards apenas para métricas rápidas e itens repetidos.
- Raio de borda discreto, até 8px.
- Paleta neutra com acento em verde/azul saúde.
- Status com cores semânticas: verde, amarelo, vermelho, cinza.

### Paleta sugerida

| Uso | Cor conceitual |
|---|---|
| Fundo geral | cinza muito claro |
| Superfícies | branco |
| Texto principal | grafite |
| Ação primária | verde petróleo ou azul clínico |
| Informação | azul |
| Sucesso | verde |
| Atenção | amarelo/âmbar |
| Erro/cancelado | vermelho |
| Neutro/inativo | cinza |

---

## Navegação principal

Menu lateral sugerido:

```text
Clínica Médica
├─ Dashboard
├─ Convênios
├─ Médicos
├─ Pacientes
├─ Agendamentos
├─ Atendimentos
└─ Usuários
```

Regras por perfil:

| Perfil | Itens principais |
|---|---|
| ADMIN | todos |
| RECEPCIONISTA | Dashboard, Convênios leitura, Médicos leitura, Pacientes, Agendamentos |
| MEDICO | Dashboard, Médicos leitura, Pacientes leitura, Agendamentos, Atendimentos |
| PACIENTE | Meus agendamentos, meus atendimentos |

---

## Wireframe global

### Desktop

```text
┌──────────────────┬──────────────────────────────────────────────────────────┐
│ Clínica Médica   │ Topbar: busca global                 usuário | sair      │
│                  ├──────────────────────────────────────────────────────────┤
│ Dashboard        │ Título da página                         Ação primária   │
│ Convênios        │ Filtros / atalhos / status                                │
│ Médicos          │                                                          │
│ Pacientes        │ Conteúdo principal                                        │
│ Agendamentos     │                                                          │
│ Atendimentos     │                                                          │
│ Usuários         │                                                          │
└──────────────────┴──────────────────────────────────────────────────────────┘
```

### Mobile

```text
┌────────────────────────────────────┐
│ ☰  Título da página          sair  │
├────────────────────────────────────┤
│ Busca / filtro principal           │
├────────────────────────────────────┤
│ Conteúdo em lista vertical         │
│ Ações principais no topo ou rodapé │
└────────────────────────────────────┘
```

---

## Tela 1 — Login

**Objetivo:** autenticar via `POST /auth/login`.

```text
┌────────────────────────────────────────┐
│ Clínica Médica                         │
│                                        │
│ E-mail                                 │
│ [____________________________]         │
│ Senha                                  │
│ [____________________________]         │
│                                        │
│ [ Entrar ]                             │
│                                        │
│ Mensagem de erro abaixo do botão       │
└────────────────────────────────────────┘
```

**Estados:**

- Carregando ao enviar.
- Credenciais inválidas.
- Token salvo e redirecionamento para Dashboard.

---

## Tela 2 — Dashboard

**Objetivo:** visão rápida do estado da clínica.

```text
┌──────────────────────────────────────────────────────────────┐
│ Dashboard                                      Atualizar      │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ Pacientes    │ Médicos      │ Agendamentos │ Atendimentos   │
│ 128          │ 14           │ 32 hoje      │ 8 hoje         │
├──────────────┴──────────────┴──────────────┴────────────────┤
│ Próximos agendamentos                                        │
│ Hora   Paciente        Médico          Status      Ação       │
│ 09:00  Ana Costa      Dr. Paulo       Confirmado  Ver        │
│ 10:30  Carlos Lima    Dra. Marina     Agendado    Ver        │
├──────────────────────────────────────────────────────────────┤
│ Alertas                                                       │
│ - Agendamentos pendentes de confirmação                       │
│ - Atendimentos ainda não registrados                          │
└──────────────────────────────────────────────────────────────┘
```

**Observação:** o dashboard pode começar simples, usando apenas listas já disponíveis. Não precisa criar endpoint agregado no backend no primeiro momento.

---

## Tela 3 — Template CRUD

Usar o mesmo esqueleto para `Convênios`, `Médicos` e `Pacientes`.

```text
┌──────────────────────────────────────────────────────────────┐
│ Pacientes                                      + Novo         │
├──────────────────────────────────────────────────────────────┤
│ Buscar por nome, e-mail ou CPF    Convênio ▼    Limpar       │
├──────────────────────────────────────────────────────────────┤
│ Nome          CPF          E-mail          Convênio    Ações │
│ Ana Costa     111...       ana@email.com   Unimed      ⋯     │
│ Carlos Lima   555...       carlos@email    Sem plano   ⋯     │
└──────────────────────────────────────────────────────────────┘
```

### Formulário de criação/edição

```text
┌────────────────────────────────────┐
│ Novo paciente                  X   │
├────────────────────────────────────┤
│ Nome                               │
│ [____________________________]     │
│ E-mail                             │
│ [____________________________]     │
│ CPF                                │
│ [____________________________]     │
│ Telefone                           │
│ [____________________________]     │
│ Data de nascimento                 │
│ [____-__-__]                       │
│ Convênio                           │
│ [Selecionar convênio ▼]            │
├────────────────────────────────────┤
│ Cancelar                 Salvar    │
└────────────────────────────────────┘
```

**Padrões:**

- Criar/editar em drawer lateral no desktop.
- Criar/editar em tela cheia no mobile.
- Excluir sempre com confirmação.
- Mostrar erro de validação junto ao campo.
- Mostrar erro de autorização como mensagem de página, não como modal.

---

## Tela 4 — Agendamentos

**Objetivo:** criar e acompanhar agendamentos.

```text
┌──────────────────────────────────────────────────────────────┐
│ Agendamentos                                  + Agendar      │
├──────────────────────────────────────────────────────────────┤
│ Data [hoje ▼]  Médico [todos ▼]  Status [todos ▼]            │
├──────────────────────────────────────────────────────────────┤
│ 08:00 ─────────────────────────────────────────────────────  │
│ 09:00  Ana Costa      Dr. Paulo      AGENDADO      Ver       │
│ 10:00  Carlos Lima    Dra. Marina    CONFIRMADO    Ver       │
│ 11:00 ─────────────────────────────────────────────────────  │
└──────────────────────────────────────────────────────────────┘
```

### Novo agendamento

```text
┌────────────────────────────────────┐
│ Novo agendamento               X   │
├────────────────────────────────────┤
│ Paciente                           │
│ [Buscar paciente ▼]                │
│ Médico                             │
│ [Buscar médico ▼]                  │
│ Data e hora                        │
│ [____-__-__ __:__]                 │
│ Observações                        │
│ [____________________________]     │
├────────────────────────────────────┤
│ Cancelar                Agendar    │
└────────────────────────────────────┘
```

**Status visual:**

| Status | Tratamento visual |
|---|---|
| `AGENDADO` | badge azul/cinza |
| `CONFIRMADO` | badge verde |
| `CANCELADO` | badge vermelho/cinza |
| `REALIZADO` | badge verde escuro ou neutro |

---

## Tela 5 — Atendimentos

**Objetivo:** registrar diagnóstico e prescrição de um agendamento.

```text
┌──────────────────────────────────────────────────────────────┐
│ Atendimentos                                  + Registrar    │
├──────────────────────────────────────────────────────────────┤
│ Buscar paciente/médico     Período [mês atual ▼]             │
├──────────────────────────────────────────────────────────────┤
│ Data        Paciente       Médico        Diagnóstico   Ações │
│ 19/05/2026  Ana Costa      Dr. Paulo     Resumo...     Ver   │
└──────────────────────────────────────────────────────────────┘
```

### Registrar atendimento

```text
┌────────────────────────────────────────────┐
│ Registrar atendimento                  X   │
├────────────────────────────────────────────┤
│ Agendamento                                │
│ [Selecionar agendamento confirmado ▼]      │
│                                            │
│ Diagnóstico                                │
│ [textarea grande]                          │
│                                            │
│ Prescrição                                 │
│ [textarea grande]                          │
│                                            │
│ Observações                                │
│ [textarea opcional]                        │
├────────────────────────────────────────────┤
│ Cancelar                         Registrar │
└────────────────────────────────────────────┘
```

**Cuidados:**

- Diagnóstico e prescrição são campos longos.
- O formulário deve ter boa área vertical.
- Evitar colocar tudo em modal pequeno.
- Mostrar claramente quando já existe atendimento para o agendamento.

---

## Tela 6 — Usuários

**Objetivo:** permitir que ADMIN cadastre usuários e roles.

```text
┌──────────────────────────────────────────────────────────────┐
│ Usuários                                      + Novo usuário │
├──────────────────────────────────────────────────────────────┤
│ Buscar por nome/e-mail         Role [todos ▼]                │
├──────────────────────────────────────────────────────────────┤
│ Nome             E-mail                 Role           Ações │
│ Administrador    admin@clinica.com      ADMIN          ⋯     │
└──────────────────────────────────────────────────────────────┘
```

### Novo usuário

```text
┌────────────────────────────────────┐
│ Novo usuário                   X   │
├────────────────────────────────────┤
│ Nome                               │
│ [____________________________]     │
│ E-mail                             │
│ [____________________________]     │
│ Senha                              │
│ [____________________________]     │
│ Role                               │
│ [ADMIN | RECEPCIONISTA | MEDICO]   │
├────────────────────────────────────┤
│ Cancelar                 Criar     │
└────────────────────────────────────┘
```

---

## Componentes reutilizáveis

| Componente | Uso |
|---|---|
| `PageHeader` | título, descrição curta opcional e ação primária |
| `FilterBar` | busca, selects e botão limpar |
| `DataTable` | listagens principais |
| `StatusBadge` | status de agendamento e mensagens |
| `FormDrawer` | criação/edição no desktop |
| `ConfirmDialog` | exclusão e cancelamento |
| `Toast` | sucesso/erro não bloqueante |
| `EmptyState` | lista vazia com ação principal |
| `ForbiddenState` | usuário autenticado sem permissão |

---

## Regras de UX por erro

| Situação | Experiência sugerida |
|---|---|
| 400 validação | destacar campos inválidos |
| 401 sem token | redirecionar para login |
| 403 role insuficiente | página ou aviso "sem permissão" |
| 404 entidade não encontrada | mensagem na página e opção voltar |
| 422 regra de negócio | alerta próximo da ação feita |
| 502 serviço dependente fora | banner "serviço temporariamente indisponível" |
| 500 erro inesperado | mensagem genérica e opção tentar novamente |

---

## Contrato frontend-backend

O frontend deve consumir apenas o Gateway:

```text
HML:  https://hml.clinica.exemplo
PROD: https://clinica.exemplo
```

Rotas conceituais:

| Tela | Backend via Gateway |
|---|---|
| Login | `/auth/login` |
| Convênios | `/api/admin/v1/convenios` |
| Médicos | `/api/admin/v1/medicos` |
| Pacientes | `/api/admin/v1/pacientes` |
| Agendamentos | `/api/agendamentos/v1/agendamentos` |
| Atendimentos | `/api/atendimentos/v1/atendimentos` |
| Usuários | `/auth/register` e futuras rotas de usuário |

---

## Briefing para gerar no Claude Design

Use este briefing como base:

```text
Criar uma interface web operacional para um sistema de clínica médica.
Não criar landing page.
Usar layout com sidebar, topbar, tabelas, filtros e formulários objetivos.
Priorizar eficiência, leitura rápida e aparência de sistema interno.
Criar telas: Login, Dashboard, Convênios, Médicos, Pacientes, Agendamentos, Atendimentos e Usuários.
Consumir rotas via API Gateway.
Usar estados de loading, erro, vazio, sem permissão e confirmação de exclusão/cancelamento.
Design responsivo: sidebar no desktop, menu recolhível no mobile.
Visual neutro, limpo, com acento verde/azul clínico e badges semânticas para status.
```

---

## Checklist de aceite das telas

- [ ] Login salva token e redireciona para Dashboard.
- [ ] Todas as chamadas passam pelo Gateway.
- [ ] Usuário sem permissão não vê ações bloqueadas ou recebe feedback 403 claro.
- [ ] Listagens têm busca/filtros.
- [ ] CRUDs principais têm criar, editar, excluir e ver detalhes.
- [ ] Agendamento valida paciente, médico, data/hora e conflito.
- [ ] Atendimento usa um agendamento existente.
- [ ] Erros do `ApiResponse` são exibidos de forma legível.
- [ ] Layout funciona em desktop e mobile.
- [ ] Interface não depende de acesso direto às portas 8081/8082/8083.
