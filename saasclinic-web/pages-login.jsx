/* SaasClinic — Login screen */

function LoginPage() {
  const { login, loginAs, personas, pushToast } = useApp();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  const submit = async (e) => {
    e?.preventDefault();
    const errs = {};
    if (!email.trim()) errs.email = "Informe seu e-mail";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = "E-mail inválido";
    if (!password) errs.password = "Informe sua senha";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
      pushToast("Bem-vindo de volta!", "success");
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      background: "var(--bg)",
    }}>
      {/* Left — form */}
      <div style={{
        display: "flex", flexDirection: "column",
        padding: "40px 8% 32px",
        background: "var(--surface)",
        minHeight: "100vh",
      }}>
        <Logo />

        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>
            <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.15 }}>
              Entrar no SaasClinic
            </h1>
            <p style={{ marginTop: 10, fontSize: 14.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
              Plataforma operacional para clínicas. Faça login com sua conta institucional para continuar.
            </p>

            <form onSubmit={submit} style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="E-mail" required error={errors.email}>
                <Input
                  type="email"
                  icon="mail"
                  value={email}
                  onChange={setEmail}
                  placeholder="seu@email.com"
                  autoFocus
                  error={!!errors.email}
                />
              </Field>

              <Field label="Senha" required error={errors.password}>
                <Input
                  type="password"
                  icon="lock"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  error={!!errors.password}
                />
              </Field>

              {errors.form && (
                <div style={{
                  padding: "10px 12px",
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                  borderRadius: 6,
                  fontSize: 13,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Icon name="warning" size={16} /> {errors.form}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "var(--text-muted)" }}>
                  <input type="checkbox" style={{ accentColor: "var(--accent)" }} /> Manter conectado
                </label>
                <a style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 500 }} onClick={() => pushToast("Demo: contate o administrador", "info")}>
                  Esqueci a senha
                </a>
              </div>

              <Button type="submit" variant="primary" size="lg" loading={loading} iconRight="arrow-right" fullWidth onClick={submit}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>

              <button
                type="button"
                onClick={() => window.open("/api-console/", "_blank", "noopener,noreferrer")}
                style={{
                  width: "100%",
                  height: 40,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <Icon name="clipboard" size={15} /> Abrir API Console
              </button>
            </form>

            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, color: "var(--text-subtle)", letterSpacing: 0.5, textTransform: "uppercase", fontWeight: 500, marginBottom: 10 }}>
                Acesso rápido para demo mock
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {personas.map(p => (
                  <button key={p.role} onClick={() => loginAs(p.role)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 8, cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 100ms, background 100ms",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-border)"; e.currentTarget.style.background = "var(--surface-2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                  >
                    <Avatar nome={p.nome} cor={p.cor} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{p.role}</div>
                      <div className="truncate" style={{ fontSize: 11, color: "var(--text-subtle)" }}>{p.nome}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--text-subtle)", lineHeight: 1.5 }}>
                Atalhos entram em mock automaticamente. Live usa <span className="mono" style={{ background: "var(--surface-2)", padding: "1px 6px", borderRadius: 4 }}>admin@clinica.com / admin123</span>.
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--text-subtle)", textAlign: "center" }}>
          © 2026 SaasClinic · <span className="mono">v1.0</span> · Gateway: <span className="mono">/auth/login</span>
        </div>
      </div>

      {/* Right — visual */}
      <div style={{
        position: "relative",
        background: "linear-gradient(160deg, var(--brand-ink), var(--brand-700) 60%, var(--brand-500))",
        color: "#fff",
        padding: "40px 8%",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        overflow: "hidden",
      }}>
        {/* Subtle pattern */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.08 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10, fontSize: 13, opacity: 0.85 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#7eecb3", boxShadow: "0 0 12px #7eecb3" }} />
          Todos os serviços operacionais
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 13, opacity: 0.7, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 500 }}>
            Hoje na clínica
          </div>
          <h2 style={{ marginTop: 12, fontSize: 44, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.05 }}>
            Sua agenda<br />em um lugar só.
          </h2>
          <p style={{ marginTop: 16, fontSize: 15, opacity: 0.78, maxWidth: 460, lineHeight: 1.55 }}>
            Pacientes, médicos, agendamentos e atendimentos integrados em uma plataforma única, distribuída em microsserviços, segura por padrão.
          </p>

          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 460 }}>
            {[
              { value: "128", label: "Pacientes ativos" },
              { value: "32",  label: "Agendamentos hoje" },
              { value: "8",   label: "Atendimentos pendentes" },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.6, fontFamily: "var(--font-display)" }}>{s.value}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, fontSize: 12, opacity: 0.6 }}>
          Conectado via Gateway · <span className="mono">https://clinica.exemplo</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginPage });
