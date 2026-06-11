/* SaasClinic — App root + router + initial loading + API console + tweaks */

function App() {
  const { auth, route, initialLoading, initialError, reload } = useApp();
  if (!auth) return <window.LoginPage />;

  const map = {
    "/":                  window.DashboardPage,
    "/agendamentos":      window.AgendamentosPage,
    "/minha-agenda":      window.AgendamentosPage,
    "/meus-agendamentos": window.MeusAgendamentosPage,
    "/atendimentos":      window.AtendimentosPage,
    "/meus-atendimentos": window.MeusAtendimentosPage,
    "/pacientes":         window.PacientesPage,
    "/medicos":           window.MedicosPage,
    "/convenios":         window.ConveniosPage,
    "/usuarios":          window.UsuariosPage,
  };
  const Page = map[route] || NotFoundPage;

  return (
    <window.AppShell>
      {initialLoading
        ? <InitialLoadingSkeleton />
        : initialError
          ? <InitialErrorState err={initialError} retry={reload} />
          : <div key={route}><Page /></div>}
    </window.AppShell>
  );
}

function InitialLoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SkBlock w="40%" h={28} />
      <SkBlock w="60%" h={14} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 8 }}>
        {[0,1,2,3].map(i => <SkCard key={i} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <SkCard h={280} />
        <SkCard h={280} />
      </div>
    </div>
  );
}

function SkBlock({ w = "100%", h = 16 }) {
  return <div style={{
    width: w, height: h, borderRadius: 4,
    background: "linear-gradient(90deg, var(--surface-2) 0%, var(--surface) 50%, var(--surface-2) 100%)",
    backgroundSize: "200% 100%",
    animation: "shimmer 1.4s linear infinite",
  }} />;
}
function SkCard({ h = 100 }) {
  return <div style={{
    height: h,
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 10, padding: 16,
    display: "flex", flexDirection: "column", gap: 10,
  }}>
    <SkBlock w="50%" h={12} />
    <SkBlock w="40%" h={28} />
    <SkBlock w="70%" h={10} />
  </div>;
}

function InitialErrorState({ err, retry }) {
  const { apiMode, gateway } = useApp();
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999,
        background: "var(--danger-bg)", color: "var(--danger)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}><window.Icon name="warning" size={28} /></div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Falha ao conectar com a API</div>
      <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4, maxWidth: 480, margin: "0 auto" }}>
        {err.message || "Não foi possível carregar os dados."}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-subtle)", marginBottom: 20, fontFamily: "var(--font-mono)" }}>
        Modo: {apiMode.toUpperCase()} {apiMode === "live" && `· ${gateway}`}
      </div>
      <div style={{ display: "inline-flex", gap: 8 }}>
        <window.Button variant="primary" icon="refresh" onClick={retry}>Tentar novamente</window.Button>
      </div>
      <div style={{ marginTop: 28, fontSize: 12, color: "var(--text-subtle)" }}>
        Dica: abra o <strong>API Console</strong> no canto inferior esquerdo para inspecionar a requisição.
      </div>
    </div>
  );
}

function NotFoundPage() {
  const { navigate } = useApp();
  return (
    <window.EmptyState icon="info" message="Página não encontrada"
      description="O recurso solicitado não existe ou foi movido."
      action={<window.Button variant="primary" onClick={() => navigate("/")}>Voltar ao início</window.Button>} />
  );
}

function Root() {
  return (
    <window.AppStateProvider>
      <App />
      <window.ToastContainer />
      <window.ApiConsole />
      <TweaksController />
    </window.AppStateProvider>
  );
}

function TweaksController() {
  const { auth, loginAs, apiMode, setApiMode, env, setEnv, gateway, environments } = useApp();
  const [tweaks, setTweak] = useTweaks(window.SAAS_TWEAKS_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
    const palette = BRAND_PALETTES.find(p => p.id === tweaks.palette) || BRAND_PALETTES[0];
    for (const [k, v] of Object.entries(palette.vars)) {
      document.documentElement.style.setProperty(k, v);
    }
  }, [tweaks.theme, tweaks.density, tweaks.palette]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="API Backend" hint="Onde o frontend faz as chamadas">
        <TweakRadio
          label="Modo"
          value={apiMode}
          onChange={setApiMode}
          options={[{ value: "mock", label: "Mock" }, { value: "live", label: "Live" }]}
        />
        <TweakRadio
          label="Ambiente"
          value={env}
          onChange={setEnv}
          options={Object.values(environments).map(e => ({ value: e.id, label: e.label }))}
        />
        <div style={{ fontSize: 11, color: "var(--text-subtle)", padding: "6px 2px 0", lineHeight: 1.5 }}>
          {apiMode === "mock"
            ? "Mock simula o gateway localmente — útil para demonstração offline."
            : `Live: ${gateway}. Tokens são separados por ambiente.`}
        </div>
      </TweakSection>

      <TweakSection title="Persona ativa" hint="Login automático sem digitar senha">
        {auth ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {window.PERSONAS.map(p => {
              const active = auth.role === p.role;
              return (
                <button key={p.role} onClick={() => loginAs(p.role)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: 8,
                    background: active ? "var(--accent-soft)" : "var(--surface)",
                    border: `1px solid ${active ? "var(--accent-border)" : "var(--border)"}`,
                    borderRadius: 6, cursor: "pointer", fontSize: 12, textAlign: "left",
                    color: active ? "var(--accent)" : "var(--text)",
                  }}>
                  <window.Avatar nome={p.nome} cor={p.cor} size={22} />
                  <span style={{ fontWeight: active ? 500 : 400 }}>{p.role}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Faça login primeiro.</div>
        )}
      </TweakSection>

      <TweakSection title="Aparência">
        <TweakRadio label="Tema" value={tweaks.theme} onChange={(v) => setTweak("theme", v)}
          options={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }]} />
        <TweakRadio label="Densidade" value={tweaks.density} onChange={(v) => setTweak("density", v)}
          options={[{ value: "compact", label: "Compacta" }, { value: "default", label: "Confort." }]} />
      </TweakSection>

      <TweakSection title="Paleta de marca">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {BRAND_PALETTES.map(p => {
            const active = tweaks.palette === p.id;
            return (
              <button key={p.id} onClick={() => setTweak("palette", p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  background: active ? "var(--surface-2)" : "var(--surface)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 6, cursor: "pointer", textAlign: "left", fontSize: 12,
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: `linear-gradient(135deg, ${p.preview[0]}, ${p.preview[1]})`,
                  flexShrink: 0, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
                }} />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </TweakSection>
    </TweaksPanel>
  );
}

const BRAND_PALETTES = [
  {
    id: "ink-blue", label: "Azul-tinta", preview: ["#1f3699", "#3a5fd9"],
    vars: { "--brand-50": "#eef2ff", "--brand-100": "#dde5fc", "--brand-200": "#b9c8f7", "--brand-300": "#8aa3ef", "--brand-400": "#5b7ee5", "--brand-500": "#3a5fd9", "--brand-600": "#2945bf", "--brand-700": "#1f3699", "--brand-800": "#1a2d7a", "--brand-900": "#162760", "--brand-ink": "#0f1b4d" },
  },
  {
    id: "graphite", label: "Grafite", preview: ["#1b1d23", "#3f4452"],
    vars: { "--brand-50": "#f1f2f5", "--brand-100": "#e1e3e9", "--brand-200": "#c2c6d2", "--brand-300": "#9da3b3", "--brand-400": "#6c7388", "--brand-500": "#4d5365", "--brand-600": "#363a48", "--brand-700": "#272a35", "--brand-800": "#1b1d23", "--brand-900": "#0f1015", "--brand-ink": "#0a0b0e" },
  },
  {
    id: "forest", label: "Floresta", preview: ["#1f5a3a", "#3aa566"],
    vars: { "--brand-50": "#ecf6f0", "--brand-100": "#cfe7d8", "--brand-200": "#9fcfb1", "--brand-300": "#6db78a", "--brand-400": "#3aa566", "--brand-500": "#258f51", "--brand-600": "#1d7a43", "--brand-700": "#1f5a3a", "--brand-800": "#16432b", "--brand-900": "#0f2e1e", "--brand-ink": "#0a2317" },
  },
  {
    id: "terracotta", label: "Terracota", preview: ["#8e3320", "#cd6a4e"],
    vars: { "--brand-50": "#fcefeb", "--brand-100": "#f6d6cb", "--brand-200": "#eaa896", "--brand-300": "#dc8a72", "--brand-400": "#cd6a4e", "--brand-500": "#b95237", "--brand-600": "#9f3f29", "--brand-700": "#8e3320", "--brand-800": "#6f2618", "--brand-900": "#4e1a10", "--brand-ink": "#3a1209" },
  },
];

Object.assign(window, { App, Root, BRAND_PALETTES });
