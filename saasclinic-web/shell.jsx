/* SaasClinic — AppShell (sidebar + topbar) */

function Logo({ size = 22, withText = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff",
        boxShadow: "var(--shadow-sm)",
        position: "relative",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M5 4h6.5a4.5 4.5 0 0 1 0 9H8.5V20h-3.5V4z" fill="white"/>
          <circle cx="17" cy="6.5" r="2.4" fill="white"/>
        </svg>
      </div>
      {withText && (
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.2 }}>SaasClinic</span>
          <span style={{ fontSize: 11, color: "var(--text-subtle)", letterSpacing: 0.4, textTransform: "uppercase" }}>Operations</span>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS_BY_ROLE = {
  ADMIN: [
    { path: "/",              label: "Dashboard",     icon: "dashboard" },
    { path: "/agendamentos",  label: "Agendamentos",  icon: "calendar"  },
    { path: "/atendimentos",  label: "Atendimentos",  icon: "clipboard" },
    { path: "/pacientes",     label: "Pacientes",     icon: "users"     },
    { path: "/medicos",       label: "Médicos",       icon: "stethoscope" },
    { path: "/convenios",     label: "Convênios",     icon: "credit"    },
    { path: "/usuarios",      label: "Usuários",      icon: "shield"    },
  ],
  RECEPCIONISTA: [
    { path: "/",              label: "Dashboard",     icon: "dashboard" },
    { path: "/agendamentos",  label: "Agendamentos",  icon: "calendar"  },
    { path: "/pacientes",     label: "Pacientes",     icon: "users"     },
    { path: "/medicos",       label: "Médicos",       icon: "stethoscope", readonly: true },
    { path: "/convenios",     label: "Convênios",     icon: "credit", readonly: true },
  ],
  MEDICO: [
    { path: "/",              label: "Dashboard",     icon: "dashboard" },
    { path: "/minha-agenda",  label: "Minha agenda",  icon: "calendar"  },
    { path: "/atendimentos",  label: "Atendimentos",  icon: "clipboard" },
    { path: "/pacientes",     label: "Pacientes",     icon: "users", readonly: true },
  ],
  PACIENTE: [
    { path: "/",                  label: "Início",            icon: "dashboard" },
    { path: "/meus-agendamentos", label: "Meus agendamentos", icon: "calendar"  },
    { path: "/meus-atendimentos", label: "Meus atendimentos", icon: "clipboard" },
  ],
};

function Sidebar() {
  const { auth, route, navigate } = useApp();
  const items = NAV_ITEMS_BY_ROLE[auth.role] || [];

  return (
    <aside style={{
      width: "var(--side-w)",
      flexShrink: 0,
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100vh",
      position: "sticky", top: 0,
    }}>
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
        <Logo />
      </div>
      <nav style={{ padding: "12px 10px", flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "10px 10px 6px", fontSize: 11, fontWeight: 500, color: "var(--text-subtle)", letterSpacing: 0.6, textTransform: "uppercase" }}>
          Navegação
        </div>
        {items.map(item => {
          const active = route === item.path || (item.path !== "/" && route.startsWith(item.path + "/"));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px",
                margin: "1px 0",
                borderRadius: 6,
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--text)",
                border: "none",
                fontSize: 14, fontWeight: active ? 500 : 400,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 100ms, color 100ms",
                position: "relative",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--surface-2)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
            >
              <Icon name={item.icon} size={17} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.readonly && (
                <span style={{ fontSize: 10, color: "var(--text-subtle)", padding: "1px 6px", borderRadius: 999, background: "var(--surface-2)", letterSpacing: 0.4 }}>VER</span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{
        padding: 12,
        borderTop: "1px solid var(--border)",
      }}>
        <UserMenu />
      </div>
    </aside>
  );
}

function UserMenu() {
  const { auth, logout } = useApp();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%",
        display: "flex", alignItems: "center", gap: 10,
        padding: 8,
        background: open ? "var(--surface-2)" : "transparent",
        border: "1px solid transparent",
        borderColor: open ? "var(--border)" : "transparent",
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 100ms",
      }}
        onMouseEnter={(e) => !open && (e.currentTarget.style.background = "var(--surface-2)")}
        onMouseLeave={(e) => !open && (e.currentTarget.style.background = "transparent")}
      >
        <Avatar nome={auth.nome} cor={auth.cor} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{auth.nome}</div>
          <div style={{ fontSize: 11, color: "var(--text-subtle)", letterSpacing: 0.5 }}>{auth.role}</div>
        </div>
        <Icon name="chevron-down" size={14} color="var(--text-subtle)" />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 6px)",
          left: 0, right: 0,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "var(--shadow-lg)",
          padding: 6,
          zIndex: 50,
          animation: "fadeIn 140ms ease-out",
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{auth.email}</div>
          </div>
          <button onClick={() => { setOpen(false); logout(); }}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
              fontSize: 13,
              background: "transparent", border: "none", cursor: "pointer",
              borderRadius: 6, color: "var(--text)", textAlign: "left",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          ><Icon name="logout" size={15} color="var(--text-muted)" /> Sair</button>
        </div>
      )}
    </div>
  );
}

function Topbar({ pageTitle, pageActions }) {
  const { pushToast } = useApp();
  return (
    <header style={{
      height: "var(--top-h)",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
      display: "flex", alignItems: "center", gap: 16,
      padding: "0 24px",
      position: "sticky", top: 0, zIndex: 50,
    }}>
      <div style={{ flex: 1, maxWidth: 460 }}>
        <Input icon="search" placeholder="Buscar pacientes, agendamentos…" onChange={() => {}} />
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => pushToast("Nenhuma notificação nova", "info")}
        style={{
          width: 36, height: 36,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "transparent", border: "1px solid transparent",
          borderRadius: 8, cursor: "pointer",
          color: "var(--text-muted)", position: "relative",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
      >
        <Icon name="bell" size={18} />
        <span style={{
          position: "absolute", top: 8, right: 8,
          width: 7, height: 7, borderRadius: 999,
          background: "var(--accent)", border: "2px solid var(--surface)",
        }} />
      </button>
      <div style={{
        width: 1, height: 22, background: "var(--border)",
      }} />
      <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
        <span className="mono">v1.0</span> · <span>{new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</span>
      </div>
    </header>
  );
}

function AppShell({ children }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar />
        <main style={{ flex: 1, padding: "32px 40px 80px", maxWidth: 1400, width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { Logo, Sidebar, Topbar, AppShell, UserMenu });
