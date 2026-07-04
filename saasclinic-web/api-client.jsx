/* SaasClinic — API client (Live + Mock) + Network log */

const ENVIRONMENTS = {
  hom:  { id: "hom",  label: "HOM",  gateway: "http://localhost:8084" },
  prod: { id: "prod", label: "PROD", gateway: "http://localhost:8085" },
};
const DEFAULT_ENV = "hom";
const DEFAULT_GATEWAY = ENVIRONMENTS[DEFAULT_ENV].gateway;
const STORAGE_KEYS = {
  mode: "saasclinic:apiMode",      // "mock" | "live"
  env: "saasclinic:env",           // "hom" | "prod"
  tokens: "saasclinic:tokensByEnv",
  users: "saasclinic:usersByEnv",
};

function readJsonStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return fallback; }
}
function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function currentEnvId() {
  const env = localStorage.getItem(STORAGE_KEYS.env) || DEFAULT_ENV;
  return ENVIRONMENTS[env] ? env : DEFAULT_ENV;
}
function gatewayForEnv(env) {
  return (ENVIRONMENTS[env] || ENVIRONMENTS[DEFAULT_ENV]).gateway;
}

// ---------- Network log (in-memory, observable) ----------
const NetLog = (() => {
  const subs = new Set();
  let entries = [];
  let counter = 0;
  return {
    push(entry) {
      const id = ++counter;
      const full = { id, at: new Date(), ...entry };
      entries = [full, ...entries].slice(0, 80);
      subs.forEach(fn => fn(entries));
      return id;
    },
    update(id, patch) {
      entries = entries.map(e => e.id === id ? { ...e, ...patch } : e);
      subs.forEach(fn => fn(entries));
    },
    clear() {
      entries = [];
      subs.forEach(fn => fn(entries));
    },
    all() { return entries; },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
})();

function useNetLog() {
  const [entries, setEntries] = React.useState(NetLog.all());
  React.useEffect(() => NetLog.subscribe(setEntries), []);
  return entries;
}

// ---------- Endpoint registry ----------
// Maps domain actions to (method, path) — matches doc 16 routing through gateway
const ENDPOINTS = {
  login:             () => ({ m: "POST",   p: "/auth/login" }),
  logout:            () => ({ m: "POST",   p: "/auth/logout" }),
  register:          () => ({ m: "POST",   p: "/auth/register" }),

  convenios_list:    () => ({ m: "GET",    p: "/api/admin/v1/convenios" }),
  convenios_create:  () => ({ m: "POST",   p: "/api/admin/v1/convenios" }),
  convenios_update:  (id) => ({ m: "PUT",  p: `/api/admin/v1/convenios/${id}` }),
  convenios_delete:  (id) => ({ m: "DELETE", p: `/api/admin/v1/convenios/${id}` }),

  medicos_list:      () => ({ m: "GET",    p: "/api/admin/v1/medicos" }),
  medicos_create:    () => ({ m: "POST",   p: "/api/admin/v1/medicos" }),
  medicos_update:    (id) => ({ m: "PUT",  p: `/api/admin/v1/medicos/${id}` }),
  medicos_delete:    (id) => ({ m: "DELETE", p: `/api/admin/v1/medicos/${id}` }),

  pacientes_list:    () => ({ m: "GET",    p: "/api/admin/v1/pacientes" }),
  pacientes_create:  () => ({ m: "POST",   p: "/api/admin/v1/pacientes" }),
  pacientes_update:  (id) => ({ m: "PUT",  p: `/api/admin/v1/pacientes/${id}` }),
  pacientes_delete:  (id) => ({ m: "DELETE", p: `/api/admin/v1/pacientes/${id}` }),

  agendamentos_list:   () => ({ m: "GET",    p: "/api/agendamentos/v1/agendamentos" }),
  agendamentos_create: () => ({ m: "POST",   p: "/api/agendamentos/v1/agendamentos" }),
  agendamentos_update: (id) => ({ m: "PUT",  p: `/api/agendamentos/v1/agendamentos/${id}` }),
  agendamentos_status: (id) => ({ m: "PUT", p: `/api/agendamentos/v1/agendamentos/${id}` }),
  agendamentos_delete: (id) => ({ m: "DELETE", p: `/api/agendamentos/v1/agendamentos/${id}` }),

  atendimentos_list:   () => ({ m: "GET",    p: "/api/atendimentos/v1/atendimentos" }),
  atendimentos_create: () => ({ m: "POST",   p: "/api/atendimentos/v1/atendimentos" }),
  atendimentos_update: (id) => ({ m: "PUT",  p: `/api/atendimentos/v1/atendimentos/${id}` }),
  atendimentos_delete: (id) => ({ m: "DELETE", p: `/api/atendimentos/v1/atendimentos/${id}` }),

  usuarios_list:     () => ({ m: "GET",    p: "/api/admin/v1/usuarios" }),
  usuarios_create:   () => ({ m: "POST",   p: "/auth/register" }),
  usuarios_update:   (id) => ({ m: "PUT",  p: `/api/admin/v1/usuarios/${id}` }),
  usuarios_delete:   (id) => ({ m: "DELETE", p: `/api/admin/v1/usuarios/${id}` }),
};

// ---------- Config (persists in localStorage) ----------
function loadConfig() {
  const env = currentEnvId();
  const tokens = readJsonStorage(STORAGE_KEYS.tokens, {});
  return {
    mode: localStorage.getItem(STORAGE_KEYS.mode) || "live",
    env,
    gateway: gatewayForEnv(env),
    token: tokens[env] || null,
  };
}
function saveConfig(patch) {
  if ("mode" in patch) localStorage.setItem(STORAGE_KEYS.mode, patch.mode);
  if ("env" in patch && ENVIRONMENTS[patch.env]) localStorage.setItem(STORAGE_KEYS.env, patch.env);
}
function saveAuthForCurrentEnv(token, user) {
  const env = currentEnvId();
  const tokens = readJsonStorage(STORAGE_KEYS.tokens, {});
  const users = readJsonStorage(STORAGE_KEYS.users, {});
  if (token) tokens[env] = token; else delete tokens[env];
  if (user) users[env] = user; else delete users[env];
  writeJsonStorage(STORAGE_KEYS.tokens, tokens);
  writeJsonStorage(STORAGE_KEYS.users, users);
}
function clearAuthForCurrentEnv() {
  saveAuthForCurrentEnv(null, null);
}
function getStoredAuth() {
  const env = currentEnvId();
  const tokens = readJsonStorage(STORAGE_KEYS.tokens, {});
  const users = readJsonStorage(STORAGE_KEYS.users, {});
  if (tokens[env] && users[env]) return { ...users[env], token: tokens[env] };
  return null;
}
function personaFor(role, email) {
  return (window.PERSONAS || []).find(p => p.role === role && (!email || p.email === email))
      || (window.PERSONAS || []).find(p => p.role === role)
      || { role, nome: role, email, cor: "#1f3699", linkedId: null, kind: "user" };
}
function normalizeLoginResult(raw, email) {
  if (raw?.user && raw?.token) return raw;
  const role = raw?.role || "ADMIN";
  const base = personaFor(role, raw?.email || email);
  return {
    token: raw?.token,
    expiresInSeconds: raw?.expiresInSeconds,
    user: {
      ...base,
      email: raw?.email || email || base.email,
      role,
      nome: base.nome || raw?.email || email,
    },
  };
}
function isLiveMode() {
  return loadConfig().mode === "live";
}

// ---------- HTTP wrapper ----------
async function liveRequest(method, path, body, token, gateway) {
  const url = gateway + path;
  const headers = { "Content-Type": "application/json", "Accept": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const t0 = performance.now();
  const logId = NetLog.push({ method, url, status: 0, pending: true, request: body, mode: "live" });

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
    const ms = Math.round(performance.now() - t0);

    NetLog.update(logId, { status: res.status, ms, response: parsed, pending: false, ok: res.ok });

    if (!res.ok) {
      const err = new Error(parsed?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.response = parsed;
      throw err;
    }
    // ApiResponse<T> unwrap
    if (parsed && typeof parsed === "object" && "success" in parsed) {
      if (parsed.success) return parsed.data;
      const e = new Error(parsed.message || "Erro");
      e.errors = parsed.errors;
      throw e;
    }
    return parsed;
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    NetLog.update(logId, { status: err.status || 0, ms, error: err.message, pending: false, ok: false });
    throw err;
  }
}

// ---------- Mock backend (uses in-memory store) ----------
// Store mirrors what the seed data initializes, so live and mock feel symmetric
let MOCK_STORE = null;

function initMockStore() {
  if (MOCK_STORE) return MOCK_STORE;
  MOCK_STORE = {
    convenios:    JSON.parse(JSON.stringify(window.SEED_CONVENIOS)),
    medicos:      JSON.parse(JSON.stringify(window.SEED_MEDICOS)),
    pacientes:    JSON.parse(JSON.stringify(window.SEED_PACIENTES)),
    agendamentos: JSON.parse(JSON.stringify(window.SEED_AGENDAMENTOS)),
    atendimentos: JSON.parse(JSON.stringify(window.SEED_ATENDIMENTOS)),
    usuarios:     JSON.parse(JSON.stringify(window.SEED_USUARIOS)),
  };
  return MOCK_STORE;
}

function nextId(arr) {
  return arr.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
}

async function mockRequest(method, path, body, token) {
  const store = initMockStore();
  const t0 = performance.now();
  // Simula latência de rede
  const delay = 180 + Math.random() * 280;

  const logId = NetLog.push({ method, url: path, status: 0, pending: true, request: body, mode: "mock" });

  await new Promise(r => setTimeout(r, delay));

  let status = 200;
  let response = null;
  let error = null;

  try {
    // Auth
    if (path === "/auth/login") {
      const persona = window.PERSONAS.find(p => p.email === body.email);
      if (!persona) { status = 401; throw new Error("Usuário não encontrado"); }
      const senha = body.senha ?? body.password;
      if (senha !== "admin123" && senha !== "demo") {
        status = 401; throw new Error("Credenciais inválidas");
      }
      response = {
        success: true,
        data: {
          token: "mock-jwt." + btoa(JSON.stringify({ sub: persona.email, role: persona.role, exp: Date.now() + 86400000 })),
          user: { ...persona },
        },
      };
    }
    // Convênios
    else if (path === "/api/admin/v1/convenios" && method === "GET") {
      response = { success: true, data: store.convenios };
    }
    else if (path === "/api/admin/v1/convenios" && method === "POST") {
      const created = { ...body, id: nextId(store.convenios), criadoEm: ymd(new Date()) };
      store.convenios.unshift(created);
      status = 201; response = { success: true, data: created, message: "Convênio criado" };
    }
    else if (/^\/api\/admin\/v1\/convenios\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const idx = store.convenios.findIndex(x => x.id === id);
      if (idx < 0) { status = 404; throw new Error("Convênio não encontrado"); }
      store.convenios[idx] = { ...store.convenios[idx], ...body, id };
      response = { success: true, data: store.convenios[idx], message: "Convênio atualizado" };
    }
    else if (/^\/api\/admin\/v1\/convenios\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      store.convenios = store.convenios.filter(x => x.id !== id);
      status = 204; response = { success: true, message: "Removido" };
    }
    // Médicos
    else if (path === "/api/admin/v1/medicos" && method === "GET") {
      response = { success: true, data: store.medicos };
    }
    else if (path === "/api/admin/v1/medicos" && method === "POST") {
      const created = { ...body, id: nextId(store.medicos) };
      store.medicos.unshift(created);
      status = 201; response = { success: true, data: created, message: "Médico criado" };
    }
    else if (/^\/api\/admin\/v1\/medicos\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const idx = store.medicos.findIndex(x => x.id === id);
      if (idx < 0) { status = 404; throw new Error("Médico não encontrado"); }
      store.medicos[idx] = { ...store.medicos[idx], ...body, id };
      response = { success: true, data: store.medicos[idx] };
    }
    else if (/^\/api\/admin\/v1\/medicos\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      store.medicos = store.medicos.filter(x => x.id !== id);
      status = 204; response = { success: true };
    }
    // Pacientes
    else if (path === "/api/admin/v1/pacientes" && method === "GET") {
      const enriched = store.pacientes.map(p => ({ ...p, convenio: p.convenioId ? store.convenios.find(c => c.id === p.convenioId) : null }));
      response = { success: true, data: enriched };
    }
    else if (path === "/api/admin/v1/pacientes" && method === "POST") {
      const created = { ...body, id: nextId(store.pacientes) };
      store.pacientes.unshift(created);
      status = 201; response = { success: true, data: created };
    }
    else if (/^\/api\/admin\/v1\/pacientes\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const idx = store.pacientes.findIndex(x => x.id === id);
      if (idx < 0) { status = 404; throw new Error("Paciente não encontrado"); }
      store.pacientes[idx] = { ...store.pacientes[idx], ...body, id };
      response = { success: true, data: store.pacientes[idx] };
    }
    else if (/^\/api\/admin\/v1\/pacientes\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      store.pacientes = store.pacientes.filter(x => x.id !== id);
      status = 204; response = { success: true };
    }
    // Agendamentos
    else if (path === "/api/agendamentos/v1/agendamentos" && method === "GET") {
      response = { success: true, data: store.agendamentos };
    }
    else if (path === "/api/agendamentos/v1/agendamentos" && method === "POST") {
      const med = store.medicos.find(m => m.id === body.medicoId);
      const pac = store.pacientes.find(p => p.id === body.pacienteId);
      if (!med) { status = 502; throw new Error("Serviço administrativo respondeu: médico não encontrado"); }
      if (!pac) { status = 502; throw new Error("Serviço administrativo respondeu: paciente não encontrado"); }
      const created = { ...body, id: nextId(store.agendamentos) };
      store.agendamentos.unshift(created);
      status = 201; response = { success: true, data: created };
    }
    else if (/^\/api\/agendamentos\/v1\/agendamentos\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const idx = store.agendamentos.findIndex(x => x.id === id);
      if (idx < 0) { status = 404; throw new Error("Agendamento não encontrado"); }
      store.agendamentos[idx] = { ...store.agendamentos[idx], ...body, id };
      response = { success: true, data: store.agendamentos[idx] };
    }
    else if (/^\/api\/agendamentos\/v1\/agendamentos\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      store.agendamentos = store.agendamentos.filter(x => x.id !== id);
      status = 204; response = { success: true };
    }
    // Atendimentos
    else if (path === "/api/atendimentos/v1/atendimentos" && method === "GET") {
      response = { success: true, data: store.atendimentos };
    }
    else if (path === "/api/atendimentos/v1/atendimentos" && method === "POST") {
      const ag = store.agendamentos.find(a => a.id === body.agendamentoId);
      if (!ag) { status = 502; throw new Error("Serviço de agendamento: agendamento não encontrado"); }
      const created = { ...body, id: nextId(store.atendimentos) };
      store.atendimentos.unshift(created);
      // Side effect: simula o evento RabbitMQ que marca o agendamento como ATENDIDO
      ag.status = "ATENDIDO";
      status = 201; response = { success: true, data: created };
    }
    else if (/^\/api\/atendimentos\/v1\/atendimentos\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const idx = store.atendimentos.findIndex(x => x.id === id);
      if (idx < 0) { status = 404; throw new Error("Atendimento não encontrado"); }
      store.atendimentos[idx] = { ...store.atendimentos[idx], ...body, id };
      response = { success: true, data: store.atendimentos[idx] };
    }
    // Usuários
    else if (path === "/api/admin/v1/usuarios" && method === "GET") {
      response = { success: true, data: store.usuarios };
    }
    else if (path === "/auth/register" && method === "POST") {
      const created = { ...body, id: nextId(store.usuarios), ultimoAcesso: "—" };
      delete created.senha;
      store.usuarios.unshift(created);
      status = 201; response = { success: true, data: created };
    }
    else if (/^\/api\/admin\/v1\/usuarios\/\d+$/.test(path) && method === "PUT") {
      const id = Number(path.split("/").pop());
      const idx = store.usuarios.findIndex(x => x.id === id);
      if (idx < 0) { status = 404; throw new Error("Usuário não encontrado"); }
      const upd = { ...body }; delete upd.senha;
      store.usuarios[idx] = { ...store.usuarios[idx], ...upd, id };
      response = { success: true, data: store.usuarios[idx] };
    }
    else if (/^\/api\/admin\/v1\/usuarios\/\d+$/.test(path) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      store.usuarios = store.usuarios.filter(x => x.id !== id);
      status = 204; response = { success: true };
    }
    else {
      status = 404; throw new Error("Endpoint não implementado no mock");
    }
  } catch (e) {
    error = e;
  }

  const ms = Math.round(performance.now() - t0);
  NetLog.update(logId, { status: error ? status : status, ms, response, error: error?.message, pending: false, ok: !error });

  if (error) {
    const err = new Error(error.message);
    err.status = status;
    throw err;
  }
  return response?.data;
}

// ---------- Public API ----------
async function apiCall(endpointKey, ...args) {
  const config = loadConfig();
  let body = null;
  // last arg may be body (for POST/PUT/PATCH)
  if (args.length > 0 && args[args.length - 1] && typeof args[args.length - 1] === "object") {
    body = args[args.length - 1];
    args = args.slice(0, -1);
  }
  const endpoint = ENDPOINTS[endpointKey];
  if (!endpoint) throw new Error(`Endpoint desconhecido: ${endpointKey}`);
  const { m, p } = endpoint(...args);

  if (config.mode === "mock") {
    return mockRequest(m, p, body, config.token);
  } else {
    return liveRequest(m, p, body, config.token, config.gateway);
  }
}

// ---------- DTO normalization ----------
function stripMeta(data) {
  const copy = { ...(data || {}) };
  ["id", "createdAt", "updatedAt", "criadoEm", "ativo", "ultimoAcesso", "duracaoMin", "convenio"].forEach(k => delete copy[k]);
  return copy;
}
function convenioPayload(data) {
  const copy = stripMeta(data);
  return { nome: copy.nome, descricao: copy.descricao || null };
}
function medicoPayload(data) {
  const copy = stripMeta(data);
  return { nome: copy.nome, email: copy.email, crm: copy.crm, especialidade: copy.especialidade, telefone: copy.telefone || null };
}
function normalizePaciente(p) {
  if (!p) return p;
  return {
    ...p,
    convenioId: p.convenioId ?? p.convenio?.id ?? null,
    nascimento: p.nascimento ?? p.dataNascimento ?? "",
  };
}
function pacientePayload(data) {
  const copy = stripMeta(data);
  const cpf = String(copy.cpf || "").replace(/\D/g, "");
  return {
    nome: copy.nome,
    email: copy.email,
    cpf,
    telefone: copy.telefone || null,
    dataNascimento: copy.dataNascimento || copy.nascimento || null,
    convenioId: copy.convenioId ? Number(copy.convenioId) : null,
  };
}
function agendamentoPayload(data) {
  const copy = stripMeta(data);
  const payload = {};
  if (copy.pacienteId != null) payload.pacienteId = Number(copy.pacienteId);
  if (copy.medicoId != null) payload.medicoId = Number(copy.medicoId);
  if (copy.dataHora) payload.dataHora = copy.dataHora;
  if (copy.status) payload.status = copy.status;
  if (copy.observacoes != null) payload.observacoes = copy.observacoes;
  return payload;
}
function atendimentoPayload(data) {
  const copy = stripMeta(data);
  const payload = {};
  if (copy.agendamentoId != null) payload.agendamentoId = Number(copy.agendamentoId);
  if (copy.diagnostico != null) payload.diagnostico = copy.diagnostico;
  if (copy.prescricao != null) payload.prescricao = copy.prescricao;
  if (copy.observacoes != null) payload.observacoes = copy.observacoes;
  return payload;
}
function usuarioPayload(data) {
  return { nome: data.nome, email: data.email, senha: data.senha, role: data.role };
}
function normalizeUsuario(u) {
  if (!u) return u;
  return {
    ...u,
    ativo: u.ativo ?? true,
    ultimoAcesso: u.ultimoAcesso || null,
  };
}
function liveUnsupported(message) {
  const err = new Error(message);
  err.status = 501;
  throw err;
}

// Convenience helpers for each domain
const Api = {
  auth: {
    login: async (email, password) => normalizeLoginResult(await apiCall("login", { email, senha: password }), email),
    logout: () => apiCall("logout"),
    register: (data) => apiCall("register", usuarioPayload(data)),
  },
  convenios: {
    list:   () => apiCall("convenios_list"),
    create: (data) => apiCall("convenios_create", convenioPayload(data)),
    update: (id, data) => apiCall("convenios_update", id, convenioPayload(data)),
    remove: (id) => apiCall("convenios_delete", id),
  },
  medicos: {
    list:   () => apiCall("medicos_list"),
    create: (data) => apiCall("medicos_create", medicoPayload(data)),
    update: (id, data) => apiCall("medicos_update", id, medicoPayload(data)),
    remove: (id) => apiCall("medicos_delete", id),
  },
  pacientes: {
    list:   async () => (await apiCall("pacientes_list")).map(normalizePaciente),
    create: async (data) => normalizePaciente(await apiCall("pacientes_create", pacientePayload(data))),
    update: async (id, data) => normalizePaciente(await apiCall("pacientes_update", id, pacientePayload(data))),
    remove: (id) => apiCall("pacientes_delete", id),
  },
  agendamentos: {
    list:    () => apiCall("agendamentos_list"),
    create:  (data) => apiCall("agendamentos_create", agendamentoPayload(data)),
    update:  (id, data) => apiCall("agendamentos_update", id, agendamentoPayload(data)),
    setStatus: (id, status) => apiCall("agendamentos_status", id, { status }),
    remove:  (id) => apiCall("agendamentos_delete", id),
  },
  atendimentos: {
    list:   () => apiCall("atendimentos_list"),
    create: (data) => apiCall("atendimentos_create", atendimentoPayload(data)),
    update: (id, data) => apiCall("atendimentos_update", id, atendimentoPayload(data)),
    remove: (id) => apiCall("atendimentos_delete", id),
  },
  usuarios: {
    list:   async () => (await apiCall("usuarios_list")).map(normalizeUsuario),
    create: (data) => Api.auth.register(data),
    update: (id, data) => isLiveMode()
      ? liveUnsupported("O backend atual não expõe edição de usuários")
      : apiCall("usuarios_update", id, data),
    remove: (id) => isLiveMode()
      ? liveUnsupported("O backend atual não expõe remoção de usuários")
      : apiCall("usuarios_delete", id),
  },
};

// ---------- Async hooks ----------
function useQuery(loader, deps = []) {
  const [state, setState] = React.useState({ loading: true, data: null, error: null });
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    loader()
      .then(data => { if (!cancelled) setState({ loading: false, data, error: null }); })
      .catch(err => { if (!cancelled) setState({ loading: false, data: null, error: err }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [...deps, tick]);

  return { ...state, refetch: () => setTick(t => t + 1) };
}

function useMutation(fn) {
  const [state, setState] = React.useState({ loading: false, error: null });
  const exec = async (...args) => {
    setState({ loading: true, error: null });
    try {
      const result = await fn(...args);
      setState({ loading: false, error: null });
      return result;
    } catch (err) {
      setState({ loading: false, error: err });
      throw err;
    }
  };
  return { ...state, mutate: exec };
}

Object.assign(window, {
  Api, apiCall, ENDPOINTS,
  NetLog, useNetLog, useQuery, useMutation,
  loadConfig, saveConfig, saveAuthForCurrentEnv, clearAuthForCurrentEnv, getStoredAuth,
  STORAGE_KEYS, DEFAULT_GATEWAY, ENVIRONMENTS,
});
