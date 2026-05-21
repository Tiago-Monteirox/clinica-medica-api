# 16 — Esboço do Frontend (SPA)

> Esboço para o frontend da clínica-médica. SPA separada, fala **só com o gateway** em `http://localhost:8084`. Doc usado como input para o Claude Design.

---

## Stack sugerida

| Camada | Escolha | Por quê |
|---|---|---|
| Build | **Vite** | HMR rápido, zero config |
| Lib UI | **React 18 + TypeScript** | Tipos batem com `ApiResponse<T>` do backend |
| Router | **React Router v6** | Padrão; rotas protegidas por role |
| Estado server | **TanStack Query (React Query)** | Cache + invalidação por mutação. Substitui Redux/Context para dados remotos |
| Estado client | **Zustand** (só pra auth) | 1 store mínima: token, user, login/logout |
| HTTP | **axios** com interceptor | Injeta `Authorization: Bearer` automaticamente |
| Form | **react-hook-form + zod** | Validação alinhada com Bean Validation do backend |
| Estilo | **Tailwind + shadcn/ui** | Componentes acessíveis, design system pronto |
| Datas | **date-fns** | LocalDateTime do Java vira string ISO → fácil |

---

## Estrutura de pastas

```
web/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── .env.local                  # VITE_API_URL=http://localhost:8084
└── src/
    ├── main.tsx
    ├── App.tsx                 # rotas
    ├── lib/
    │   ├── api.ts              # axios instance + interceptor JWT
    │   ├── auth-store.ts       # Zustand (token, user, login, logout)
    │   └── query-client.ts     # TanStack QueryClient
    ├── routes/
    │   ├── Login.tsx
    │   ├── ProtectedRoute.tsx  # redireciona se sem token / role errada
    │   └── layout/AppShell.tsx # header com user + logout + sidebar
    ├── features/
    │   ├── convenios/          # list, form, hooks (useConvenios, useCreateConvenio)
    │   ├── medicos/
    │   ├── pacientes/
    │   ├── agendamentos/       # calendário + form
    │   └── atendimentos/       # form com diagnóstico/prescrição
    └── types/
        ├── api.ts              # ApiResponse<T>, Role, etc.
        └── domain.ts           # Convenio, Medico, Paciente, ...
```

---

## Tipos compartilhados (do backend)

```ts
// src/types/api.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export type Role = "ADMIN" | "RECEPCIONISTA" | "MEDICO" | "PACIENTE";

// src/types/domain.ts
export interface Convenio   { id: number; nome: string; descricao?: string; }
export interface Medico     { id: number; nome: string; email: string; crm: string; especialidade: string; telefone?: string; }
export interface Paciente   { id: number; nome: string; email: string; cpf: string; telefone?: string; convenio?: Convenio | null; }
export type StatusAgendamento = "AGENDADO" | "CONFIRMADO" | "CANCELADO" | "REALIZADO";
export interface Agendamento { id: number; pacienteId: number; medicoId: number; dataHora: string; status: StatusAgendamento; observacoes?: string; }
export interface Atendimento { id: number; agendamentoId: number; pacienteId: number; medicoId: number; dataAtendimento: string; diagnostico: string; prescricao: string; observacoes?: string; }
```

---

## API client (axios + interceptor)

```ts
// src/lib/api.ts
import axios from "axios";
import { useAuth } from "./auth-store";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // http://localhost:8084
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) useAuth.getState().logout();
    return Promise.reject(err);
  }
);
```

---

## Rotas e atores

| Rota | Quem acessa | Tela |
|---|---|---|
| `/login` | público | Login |
| `/` | logado | Dashboard (varia por role) |
| `/convenios` | ADMIN | CRUD convênios |
| `/medicos` | ADMIN | CRUD médicos |
| `/pacientes` | ADMIN, RECEPCIONISTA | CRUD pacientes (RECEP só create/update) |
| `/agendamentos` | ADMIN, RECEPCIONISTA | Calendário + novo agendamento |
| `/minha-agenda` | MEDICO | Agenda do dia/semana do próprio médico |
| `/atendimentos/novo/:agendamentoId` | MEDICO | Form diagnóstico/prescrição |
| `/meus-agendamentos` | PACIENTE | Lista + cancelar |
| `/usuarios` | ADMIN | Registrar novos usuários |

Cada `ProtectedRoute` recebe `allowedRoles={["ADMIN", "MEDICO"]}` e redireciona pra `/` se não bater.

---

## Fluxo de auth

```
1. /login → POST /auth/login → guarda { token, role, email } no Zustand
                                          ↓
                                  persist em localStorage
2. Toda chamada → interceptor injeta Bearer
3. 401 → logout + redirect /login
4. Token expira em 24h (admin/admin123 default)
```

---

## CORS no gateway (mudança no backend)

O gateway WebFlux precisa liberar a origem do front. Adicionar em `gateway/src/main/resources/application.yml`:

```yaml
spring:
  cloud:
    gateway:
      globalcors:
        cors-configurations:
          '[/**]':
            allowed-origins:
              - "http://localhost:5173"   # vite dev
              - "http://localhost:4173"   # vite preview
            allowed-methods: [GET, POST, PUT, DELETE, OPTIONS]
            allowed-headers: "*"
            allow-credentials: true
            max-age: 3600
```

Em produção, trocar para a origem real do frontend deployado.

---

## Telas prioritárias para o Claude Design (em ordem)

1. **Login** — card centralizado, logo, campo email/senha, erro inline (422).
2. **Dashboard por role** — cards de atalho diferentes por persona:
   - ADMIN: contagem de convênios, médicos, pacientes, usuários.
   - RECEPCIONISTA: pacientes hoje + botão "Novo agendamento".
   - MEDICO: "Minha agenda" do dia, próximo paciente em destaque.
   - PACIENTE: próximo agendamento, botão cancelar.
3. **Lista CRUD** (template reaproveitado em convênio/médico/paciente) — tabela com busca, paginação leve, botão "Novo", drawer/modal de form.
4. **Agendamento** — calendário semanal por médico (visual tipo Google Calendar) + modal de criação com paciente + médico + dataHora.
5. **Atendimento** — form em duas colunas: dados do agendamento (read-only à esquerda) + diagnóstico/prescrição (textareas à direita).

### Tom visual sugerido
- **Não usar** verde-hospital genérico nem ícones de cruz. Vibração mais "Linear meets Notion" — tipografia generosa, espaço, contraste alto.
- Paleta: 1 cor de marca (sugestão: âmbar/terracota ou azul-tinta — fugir do azul-saúde) + neutros + 2 estados (sucesso/erro).
- Densidade: alta nas tabelas, confortável nos forms.
- Sem skeumorfismo, sem gradientes pesados.

---

## Comandos de bootstrap

```bash
mkdir web && cd web
npm create vite@latest . -- --template react-ts
npm i axios @tanstack/react-query react-router-dom zustand react-hook-form zod date-fns
npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
npx shadcn@latest init
npm run dev   # http://localhost:5173
```

---

## Por que SPA e não Thymeleaf/HTMX

- O backend já é multi-service com gateway + JWT. Render server-side teria que viver dentro de **um** dos serviços (provavelmente administrativo), criando acoplamento que a arquitetura já se esforçou para evitar.
- Swagger + OpenAPI já documenta cada endpoint — uma SPA consome esses contratos diretamente.
- Permite que o frontend evolua independente (deploy próprio, build próprio, time próprio).
- Tradeoff aceito: 2 processos rodando em dev. O `docker-compose` pode adicionar um service `web` no futuro se quisermos um único `up`.
