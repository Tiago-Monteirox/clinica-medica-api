/* SaasClinic — global state (auth, route, toasts) + data cache via Api client */

const AppStateContext = React.createContext(null);

function AppStateProvider({ children, initialRoute = "/login" }) {
  // ---- Auth (loaded from localStorage if present)
  const [auth, setAuth] = React.useState(() => window.getStoredAuth());

  const [route, setRoute] = React.useState(auth ? "/" : initialRoute);

  // ---- API config (api-client manages persistence)
  const [apiMode, setApiModeState] = React.useState(() => window.loadConfig().mode);
  const [env, setEnvState] = React.useState(() => window.loadConfig().env);
  const [gateway, setGatewayState] = React.useState(() => window.loadConfig().gateway);

  const refreshSessionFromStorage = React.useCallback(() => {
    const stored = window.getStoredAuth();
    setAuth(stored);
    setRoute(stored ? "/" : "/login");
  }, []);

  const setApiMode = React.useCallback((mode) => {
    window.saveConfig({ mode });
    setApiModeState(mode);
    refreshSessionFromStorage();
    bump();
  }, [refreshSessionFromStorage]);
  const setEnv = React.useCallback((nextEnv) => {
    window.saveConfig({ env: nextEnv });
    const cfg = window.loadConfig();
    setEnvState(cfg.env);
    setGatewayState(cfg.gateway);
    refreshSessionFromStorage();
    bump();
  }, [refreshSessionFromStorage]);
  const setGateway = React.useCallback(() => {}, []);

  // ---- Data cache (loaded via Api)
  const [convenios, setConvenios]       = React.useState([]);
  const [medicos, setMedicos]           = React.useState([]);
  const [pacientes, setPacientes]       = React.useState([]);
  const [agendamentos, setAgendamentos] = React.useState([]);
  const [atendimentos, setAtendimentos] = React.useState([]);
  const [prontuarios, setProntuarios]   = React.useState([]);
  const [templatesClinicos, setTemplatesClinicos] = React.useState([]);
  const [usuarios, setUsuarios]         = React.useState([]);

  const [initialLoading, setInitialLoading] = React.useState(true);
  const [initialError, setInitialError] = React.useState(null);
  const [dataVersion, setDataVersion] = React.useState(0);
  const bump = React.useCallback(() => setDataVersion(v => v + 1), []);

  // ---- Toasts
  const [toasts, setToasts] = React.useState([]);
  const pushToast = React.useCallback((msg, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3800);
  }, []);

  // ---- Initial load — fires whenever auth or mode/version changes
  React.useEffect(() => {
    if (!auth) {
      setInitialLoading(false);
      return;
    }
    let cancelled = false;
    setInitialLoading(true);
    setInitialError(null);
    (async () => {
      try {
        const promises = [];
        // Carregar só o que a role pode ver
        const canRead = (action) => can(auth.role, action);
        const wants = {
          convenios:    auth.role === "ADMIN" || auth.role === "RECEPCIONISTA",
          medicos:      auth.role !== "PACIENTE",
          pacientes:    auth.role !== "PACIENTE",
          agendamentos: true,
          atendimentos: true,
          clinico:      auth.role === "ADMIN" || auth.role === "MEDICO",
          usuarios:     auth.role === "ADMIN",
        };

        const [c, m, p, ag, at, u] = await Promise.all([
          wants.convenios    ? window.Api.convenios.list().catch(() => []) : Promise.resolve([]),
          wants.medicos      ? window.Api.medicos.list().catch(() => [])   : Promise.resolve([]),
          wants.pacientes    ? window.Api.pacientes.list().catch(() => []) : Promise.resolve([]),
          window.Api.agendamentos.list().catch(() => []),
          window.Api.atendimentos.list().catch(() => []),
          wants.usuarios     ? window.Api.usuarios.list().catch(() => [])  : Promise.resolve([]),
        ]);
        let prontuariosAtivos = [];
        let templatesAtivos = [];
        if (wants.clinico) {
          const atendimentosVisiveis = (at || []).filter(item => auth.role !== "MEDICO" || item.medicoId === auth.linkedId);
          const prontuarioResults = await Promise.allSettled(
            atendimentosVisiveis.map(item => window.Api.prontuarios.byAtendimento(item.id))
          );
          prontuariosAtivos = prontuarioResults
            .filter(result => result.status === "fulfilled" && result.value)
            .map(result => result.value);
          templatesAtivos = await window.Api.templatesClinicos.list().catch(() => []);
        }
        if (cancelled) return;
        setConvenios(c || []);
        setMedicos(m || []);
        setPacientes(p || []);
        setAgendamentos(ag || []);
        setAtendimentos(at || []);
        setProntuarios(prontuariosAtivos || []);
        setTemplatesClinicos(templatesAtivos || []);
        setUsuarios(u || []);
        setInitialLoading(false);
      } catch (err) {
        if (cancelled) return;
        setInitialError(err);
        setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [auth, apiMode, gateway, dataVersion]);

  // ---- Generic mutation helper
  const wrapMutation = React.useCallback(async (apiCall, optimistic, onSuccess, errorMsg = "Erro na requisição") => {
    try {
      if (optimistic) optimistic();
      const result = await apiCall();
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      if (err.status === 401) {
        pushToast("Sessão expirada. Faça login novamente.", "error");
        doLogout(false);
      } else if (err.status === 403) {
        pushToast("Sem permissão para essa ação", "error");
      } else if (err.status === 502) {
        pushToast(`Serviço dependente indisponível: ${err.message}`, "error");
      } else {
        pushToast(`${errorMsg}: ${err.message}`, "error");
      }
      // Re-fetch to undo optimistic
      bump();
      throw err;
    }
  }, []);

  // ---- Domain mutations (each calls Api + updates cache)
  const api = React.useMemo(() => ({
    convenios: {
      upsert: async (data) => {
        const res = data.id
          ? await wrapMutation(() => window.Api.convenios.update(data.id, data), null, null, "Falha ao atualizar")
          : await wrapMutation(() => window.Api.convenios.create(data), null, null, "Falha ao criar");
        bump();
        return res;
      },
      remove: async (id) => {
        await wrapMutation(() => window.Api.convenios.remove(id), null, null, "Falha ao remover");
        bump();
      },
    },
    medicos: {
      upsert: async (data) => {
        const res = data.id
          ? await wrapMutation(() => window.Api.medicos.update(data.id, data), null, null, "Falha ao atualizar")
          : await wrapMutation(() => window.Api.medicos.create(data), null, null, "Falha ao criar");
        bump(); return res;
      },
      remove: async (id) => { await wrapMutation(() => window.Api.medicos.remove(id)); bump(); },
    },
    pacientes: {
      upsert: async (data) => {
        const res = data.id
          ? await wrapMutation(() => window.Api.pacientes.update(data.id, data))
          : await wrapMutation(() => window.Api.pacientes.create(data));
        bump(); return res;
      },
      remove: async (id) => { await wrapMutation(() => window.Api.pacientes.remove(id)); bump(); },
    },
    agendamentos: {
      upsert: async (data) => {
        const res = data.id
          ? await wrapMutation(() => window.Api.agendamentos.update(data.id, data))
          : await wrapMutation(() => window.Api.agendamentos.create(data));
        bump(); return res;
      },
      remove: async (id) => { await wrapMutation(() => window.Api.agendamentos.remove(id)); bump(); },
      setStatus: async (id, status) => { await wrapMutation(() => window.Api.agendamentos.setStatus(id, status)); bump(); },
    },
    atendimentos: {
      upsert: async (data) => {
        const res = data.id
          ? await wrapMutation(() => window.Api.atendimentos.update(data.id, data))
          : await wrapMutation(() => window.Api.atendimentos.create(data));
        bump(); return res;
      },
    },
    prontuarios: {
      save: async (atendimentoId, data) => {
        const res = await wrapMutation(() => window.Api.prontuarios.save(atendimentoId, data), null, null, "Falha ao salvar prontuário");
        setProntuarios(prev => [res, ...prev.filter(item => item.id !== res.id && item.atendimentoId !== res.atendimentoId)]);
        return res;
      },
      finalizar: async (id, data) => {
        const res = await wrapMutation(() => window.Api.prontuarios.finalizar(id, data), null, null, "Falha ao finalizar prontuário");
        setProntuarios(prev => [res, ...prev.filter(item => item.id !== res.id && item.atendimentoId !== res.atendimentoId)]);
        return res;
      },
      historico: (pacienteId, incluirRascunhos = false) => window.Api.prontuarios.historico(pacienteId, incluirRascunhos),
    },
    templatesClinicos: {
      create: async (data) => {
        const res = await wrapMutation(() => window.Api.templatesClinicos.create(data), null, null, "Falha ao criar template");
        setTemplatesClinicos(prev => [res, ...prev.filter(item => item.codigo !== res.codigo || item.id === res.id)]);
        return res;
      },
    },
    documentosClinicos: {
      preview: (data) => window.Api.documentosClinicos.preview(data),
      create: async (data) => {
        const res = await wrapMutation(() => window.Api.documentosClinicos.create(data), null, null, "Falha ao emitir documento");
        bump(); return res;
      },
      byProntuario: (prontuarioId) => window.Api.documentosClinicos.byProntuario(prontuarioId),
    },
    usuarios: {
      upsert: async (data) => {
        const res = data.id
          ? await wrapMutation(() => window.Api.usuarios.update(data.id, data))
          : await wrapMutation(() => window.Api.usuarios.create(data));
        bump(); return res;
      },
      remove: async (id) => { await wrapMutation(() => window.Api.usuarios.remove(id)); bump(); },
    },
  }), [wrapMutation, bump]);

  // ---- Lookups
  const lookup = React.useMemo(() => ({
    medicoById:    (id) => medicos.find(m => m.id === id),
    pacienteById:  (id) => pacientes.find(p => p.id === id),
    convenioById:  (id) => convenios.find(c => c.id === id),
    atendimentoByAgendamentoId: (aid) => atendimentos.find(a => a.agendamentoId === aid),
    prontuarioByAtendimentoId: (atendimentoId) => prontuarios.find(p => p.atendimentoId === atendimentoId),
  }), [medicos, pacientes, convenios, atendimentos, prontuarios]);

  // ---- Auth actions
  const login = React.useCallback(async (email, password) => {
    const result = await window.Api.auth.login(email, password);
    const { token, user } = result;
    window.saveAuthForCurrentEnv(token, user);
    setAuth({ ...user, token });
    setRoute("/");
    return user;
  }, []);

  const loginAs = React.useCallback(async (role) => {
    const persona = PERSONAS.find(p => p.role === role);
    if (!persona) return;
    try {
      if (window.loadConfig().mode !== "mock") {
        window.saveConfig({ mode: "mock" });
        setApiModeState("mock");
        pushToast("Demo aberta em modo mock", "info");
      }
      await login(persona.email, "demo");
    } catch (e) {
      pushToast(`Falha ao trocar persona: ${e.message}`, "error");
    }
  }, [login, pushToast]);

  const doLogout = async (callBackend = false) => {
    if (callBackend && window.loadConfig().mode === "live") {
      await window.Api.auth.logout().catch(() => null);
    }
    window.clearAuthForCurrentEnv();
    setAuth(null);
    setRoute("/login");
  };
  const logout = React.useCallback(() => doLogout(true), []);

  const value = {
    auth, login, loginAs, logout,
    route, navigate: setRoute,
    toasts, pushToast,
    convenios, medicos, pacientes, agendamentos, atendimentos, prontuarios, templatesClinicos, usuarios,
    api, lookup,
    personas: PERSONAS,
    initialLoading, initialError, reload: bump,
    apiMode, setApiMode, env, setEnv, gateway, setGateway, environments: window.ENVIRONMENTS,
  };
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

const useApp = () => React.useContext(AppStateContext);

// Permissions
function can(role, action) {
  const matrix = {
    ADMIN: ["convenios.write","convenios.read","medicos.write","medicos.read","pacientes.write","pacientes.read",
            "agendamentos.write","agendamentos.read","atendimentos.read","prontuarios.read","documentos.read",
            "templatesClinicos.write","usuarios.write", "dashboard.full"],
    RECEPCIONISTA: ["convenios.read","medicos.read","pacientes.write","pacientes.read",
                    "agendamentos.write","agendamentos.read"],
    MEDICO: ["medicos.read","pacientes.read","agendamentos.read","atendimentos.write","atendimentos.read",
             "prontuarios.read","prontuarios.write","documentos.read","documentos.write","minhaAgenda"],
    PACIENTE: ["meusAgendamentos","meusAtendimentos"],
  };
  return (matrix[role] || []).includes(action);
}

function isAgendamentoEncerrado(status) {
  return status === "ATENDIDO" || status === "REALIZADO";
}

// Format helpers
const fmtDate = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); };
const fmtDateLong = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }); };
const fmtTime = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };
const fmtDateTime = (iso) => { if (!iso) return ""; return `${fmtDate(iso)} · ${fmtTime(iso)}`; };

const initials = (nome) => {
  if (!nome) return "?";
  const parts = nome.replace(/^(Dr|Dra)\.\s+/, "").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

Object.assign(window, {
  AppStateProvider, AppStateContext, useApp, can,
  isAgendamentoEncerrado,
  fmtDate, fmtDateLong, fmtTime, fmtDateTime,
  initials,
});
