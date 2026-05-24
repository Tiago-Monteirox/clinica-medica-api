/* SaasClinic API Console — main app */

// ===== Local state hooks =====
function useLocalStorage(key, def) {
  const [val, setVal] = React.useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? def : JSON.parse(raw);
    } catch { return def; }
  });
  React.useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal];
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}

// ===== HTTP client =====
async function sendRequest({ baseUrl, method, path, body, token, signal }) {
  const url = baseUrl.replace(/\/$/, "") + path;
  const headers = {
    "Accept": "application/json",
  };
  let bodyText = null;
  if (body != null && method !== "GET" && method !== "DELETE") {
    headers["Content-Type"] = "application/json";
    bodyText = typeof body === "string" ? body : JSON.stringify(body);
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const t0 = performance.now();
  try {
    const res = await fetch(url, { method, headers, body: bodyText, signal });
    const elapsed = Math.round(performance.now() - t0);
    const respHeaders = {};
    res.headers.forEach((v, k) => respHeaders[k] = v);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: res.ok, status: res.status, statusText: res.statusText,
      headers: respHeaders,
      bodyText: text,
      bodyJson: json,
      elapsed,
      requestUrl: url,
      requestMethod: method,
      requestHeaders: headers,
      requestBody: bodyText,
    };
  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    return {
      ok: false, status: 0,
      statusText: "Network Error",
      headers: {},
      bodyText: "",
      bodyJson: null,
      elapsed,
      requestUrl: url,
      requestMethod: method,
      requestHeaders: headers,
      requestBody: bodyText,
      networkError: err.message || String(err),
    };
  }
}

// ===== Path interpolation =====
function interpolatePath(path, params) {
  return path.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(params[k] ?? `{${k}}`));
}

// ===== Curl generator =====
function generateCurl({ baseUrl, method, path, body, token }) {
  const url = baseUrl.replace(/\/$/, "") + path;
  const lines = [`curl -X ${method} '${url}'`];
  if (token) lines.push(`  -H 'Authorization: Bearer ${token}'`);
  if (body && method !== "GET" && method !== "DELETE") {
    lines.push(`  -H 'Content-Type: application/json'`);
    const b = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    lines.push(`  -d '${b.replace(/'/g, "'\\''")}'`);
  }
  return lines.join(" \\\n");
}

// ===== Status badge =====
function StatusBadge({ status, statusText }) {
  let tone = "neutral";
  if (status >= 200 && status < 300) tone = "success";
  else if (status >= 300 && status < 400) tone = "info";
  else if (status >= 400 && status < 500) tone = "warning";
  else if (status >= 500) tone = "danger";
  else if (status === 0) tone = "danger";
  const label = status === 0 ? "Erro de rede" : `${status} ${statusText || ""}`.trim();
  return (
    <Badge tone={tone} style={{ fontSize: 12, padding: "4px 10px", letterSpacing: 0.4, fontFamily: "var(--font-mono)" }}>{label}</Badge>
  );
}

// ===== Service header in sidebar =====
function ServiceSection({ service, endpoints, selectedId, onSelect, search }) {
  const [open, setOpen] = useLocalStorage(`svc-open-${service.id}`, true);
  const filtered = endpoints.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.path.toLowerCase().includes(search.toLowerCase()) ||
    e.method.toLowerCase().includes(search.toLowerCase())
  );
  if (filtered.length === 0) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px",
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--c-muted)", textAlign: "left",
        fontSize: 11, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: 0.6,
      }}>
        <Icon name="chevron-right" size={11} style={{ transition: "transform 100ms", transform: open ? "rotate(90deg)" : "none" }} />
        <Icon name={service.icon} size={13} color={service.color} />
        <span style={{ flex: 1 }}>{service.name}</span>
        <span style={{ color: "var(--c-subtle)", fontWeight: 500, fontSize: 10 }}>:{service.port}</span>
      </button>
      {open && (
        <div>
          {filtered.map(ep => (
            <button key={ep.id} onClick={() => onSelect(ep.id)}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 10px 6px 26px",
                background: selectedId === ep.id ? "var(--c-accent-soft)" : "transparent",
                border: "none",
                borderLeft: `2px solid ${selectedId === ep.id ? "var(--c-accent)" : "transparent"}`,
                cursor: "pointer", textAlign: "left",
                color: selectedId === ep.id ? "var(--c-accent)" : "var(--c-text)",
                transition: "background 80ms",
              }}
              onMouseEnter={(e) => { if (selectedId !== ep.id) e.currentTarget.style.background = "var(--c-surface-2)"; }}
              onMouseLeave={(e) => { if (selectedId !== ep.id) e.currentTarget.style.background = "transparent"; }}
            >
              <MethodLabel method={ep.method} size="sm" />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                {ep.name}
              </span>
              {ep.public && <Icon name="globe" size={11} color="var(--c-subtle)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== Sidebar =====
function Sidebar({ selectedEndpointId, onSelect, scenariosCount, onShowScenarios, onShowHistory, historyCount, activeTab }) {
  const [search, setSearch] = React.useState("");

  return (
    <aside className="sidebar" style={{
      borderRight: "1px solid var(--c-border)",
      background: "var(--c-surface)",
      display: "flex", flexDirection: "column",
      height: "100%",
      overflow: "hidden",
    }}>
      <div style={{ padding: 12, borderBottom: "1px solid var(--c-border)" }}>
        <Input icon="search" placeholder="Buscar endpoint..." value={search} onChange={setSearch} size="sm" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", padding: "8px 0", borderBottom: "1px solid var(--c-border)" }}>
        <SidebarTab icon="zap" label="Cenários rápidos" count={scenariosCount} active={activeTab === "scenarios"} onClick={onShowScenarios} />
        <SidebarTab icon="history" label="Histórico" count={historyCount} active={activeTab === "history"} onClick={onShowHistory} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {SERVICES.map(svc => (
          <ServiceSection
            key={svc.id}
            service={svc}
            endpoints={ENDPOINTS.filter(e => e.service === svc.id)}
            selectedId={activeTab === "endpoint" ? selectedEndpointId : null}
            onSelect={onSelect}
            search={search}
          />
        ))}
      </div>
    </aside>
  );
}

function SidebarTab({ icon, label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 10,
      padding: "8px 14px",
      background: active ? "var(--c-accent-soft)" : "transparent",
      border: "none",
      borderLeft: `2px solid ${active ? "var(--c-accent)" : "transparent"}`,
      color: active ? "var(--c-accent)" : "var(--c-text)",
      cursor: "pointer", textAlign: "left",
      fontSize: 13, fontWeight: active ? 500 : 400,
    }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--c-surface-2)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      <Icon name={icon} size={14} />
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && count > 0 && (
        <span style={{ fontSize: 10, color: "var(--c-subtle)", fontWeight: 500 }}>{count}</span>
      )}
    </button>
  );
}

// ===== Ambientes (HOM / PROD) =====
// Mapeia o environment para a URL do gateway e tema visual.
// Centralizado aqui pra que o toggle, o catálogo e o login leiam a mesma fonte.
const ENVIRONMENTS = {
  hom: {
    label: "HOM",
    longLabel: "Homologation",
    baseUrl: "http://localhost:8084",
    color: "#16a34a",       // verde
    colorBg: "rgba(22, 163, 74, 0.12)",
    description: "1 MySQL com 3 schemas",
  },
  prod: {
    label: "PROD",
    longLabel: "Production",
    baseUrl: "http://localhost:8085",
    color: "#dc2626",       // vermelho
    colorBg: "rgba(220, 38, 38, 0.12)",
    description: "3 MySQLs dedicados",
  },
};
window.ENVIRONMENTS = ENVIRONMENTS;

// ===== Topbar =====
function Topbar({ env, onEnvChange, token, user, onLogin, onLogout, theme, onThemeToggle }) {
  const active = ENVIRONMENTS[env];

  const segButton = (key) => {
    const e = ENVIRONMENTS[key];
    const isActive = env === key;
    return (
      <button
        onClick={() => onEnvChange(key)}
        title={`${e.longLabel} — ${e.baseUrl}`}
        style={{
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.5,
          border: "none",
          background: isActive ? e.color : "transparent",
          color: isActive ? "#fff" : "var(--c-muted)",
          cursor: isActive ? "default" : "pointer",
          transition: "background 120ms ease",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {isActive && (
          <span style={{
            width: 6, height: 6, borderRadius: 99,
            background: "#fff", display: "inline-block",
          }} />
        )}
        {e.label}
      </button>
    );
  };

  return (
    <header className="topbar" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "0 16px",
      borderBottom: "1px solid var(--c-border)",
      background: "var(--c-surface)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: "linear-gradient(135deg, #1f3699, #3a5fd9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff",
        }}>
          <Icon name="logo" size={16} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>SaasClinic</span>
          <span style={{ fontSize: 10, color: "var(--c-subtle)", letterSpacing: 0.4, textTransform: "uppercase" }}>API Console</span>
        </div>
      </div>

      {/* Toggle HOM / PROD */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 12 }}>
        <div style={{
          display: "inline-flex",
          border: `1px solid ${active.color}`,
          borderRadius: 6,
          overflow: "hidden",
          background: active.colorBg,
        }}>
          {segButton("hom")}
          {segButton("prod")}
        </div>
        <span style={{
          fontSize: 10,
          color: "var(--c-muted)",
          fontFamily: "var(--font-mono)",
          letterSpacing: 0.3,
        }}>
          {active.baseUrl.replace("http://", "")} · {active.description}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {token ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge tone="success" size="sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor", display: "inline-block" }} />
            Autenticado {user?.role ? `· ${user.role}` : ""}
          </Badge>
          {user?.sub && (
            <span style={{ fontSize: 11, color: "var(--c-muted)", fontFamily: "var(--font-mono)" }}>{user.sub}</span>
          )}
          <Button size="sm" variant="ghost" icon="logout" onClick={onLogout}>Sair</Button>
        </div>
      ) : (
        <Button size="sm" variant="primary" icon="lock" onClick={onLogin}>Login</Button>
      )}

      <button onClick={onThemeToggle} title="Alternar tema" style={{
        width: 32, height: 32, borderRadius: 6,
        background: "transparent", border: "1px solid var(--c-border)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "var(--c-muted)",
      }}>
        <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
      </button>
    </header>
  );
}

// ===== Login Modal =====
function LoginModal({ open, onClose, onLogin, baseUrl }) {
  const [email, setEmail] = React.useState("admin@clinica.com");
  const [senha, setSenha] = React.useState("admin123");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const submit = async () => {
    setLoading(true);
    setError(null);
    const res = await sendRequest({
      baseUrl, method: "POST", path: "/auth/login",
      body: { email, senha },
    });
    setLoading(false);
    if (res.ok && res.bodyJson?.data?.token) {
      onLogin(res.bodyJson.data.token, res.bodyJson.data);
      onClose();
    } else {
      const msg = res.networkError
        ? `Não foi possível conectar a ${baseUrl}. Verifique se o Gateway está rodando.`
        : (res.bodyJson?.message || res.bodyJson?.errors?.[0] || `HTTP ${res.status}`);
      setError(msg);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Autenticar"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" icon="lock" onClick={submit} loading={loading}>Entrar</Button>
      </>}
    >
      <div style={{ fontSize: 13, color: "var(--c-muted)", marginBottom: 16, lineHeight: 1.5 }}>
        Faz <code style={inlineCode}>POST {baseUrl}/auth/login</code> e armazena o token retornado em <code style={inlineCode}>localStorage</code>.
        Todas as próximas requisições incluem <code style={inlineCode}>Authorization: Bearer ...</code> automaticamente.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={fieldLabel}>E-mail</label>
          <Input type="email" value={email} onChange={setEmail} placeholder="admin@clinica.com" autoFocus />
        </div>
        <div>
          <label style={fieldLabel}>Senha</label>
          <Input type="password" value={senha} onChange={setSenha} placeholder="admin123"
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>

        {error && (
          <div style={{
            padding: "10px 12px",
            background: "var(--c-danger-bg)", color: "var(--c-danger)",
            border: "1px solid color-mix(in srgb, var(--c-danger) 30%, transparent)",
            borderRadius: 6, fontSize: 12.5,
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <Icon name="warning" size={15} style={{ marginTop: 1, flexShrink: 0 }} /> {error}
          </div>
        )}

        <div style={{ marginTop: 8, padding: 12, background: "var(--c-surface-2)", borderRadius: 6, fontSize: 12, color: "var(--c-muted)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--c-text)" }}>Seed disponível:</strong><br />
          <code style={inlineCode}>admin@clinica.com</code> / <code style={inlineCode}>admin123</code> · role <code style={inlineCode}>ADMIN</code>
        </div>
      </div>
    </Modal>
  );
}

const fieldLabel = { display: "block", fontSize: 12, fontWeight: 500, marginBottom: 6, color: "var(--c-text)" };
const inlineCode = {
  fontFamily: "var(--font-mono)", fontSize: "0.92em",
  padding: "1px 6px", borderRadius: 4,
  background: "var(--c-surface-2)", color: "var(--c-text)",
  border: "1px solid var(--c-border)",
};

// ===== Endpoint detail =====
function EndpointPanel({ endpoint, baseUrl, token, onSend, onCleartoken }) {
  const [pathParams, setPathParams] = React.useState({});
  const [bodyText, setBodyText] = React.useState("");
  const [bodyError, setBodyError] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState("body");
  const [response, setResponse] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  // Reset state when endpoint changes
  React.useEffect(() => {
    const defaults = {};
    for (const p of (endpoint.pathParams || [])) defaults[p.key] = p.default || "";
    setPathParams(defaults);

    const tpl = typeof endpoint.bodyTemplate === "function"
      ? endpoint.bodyTemplate()
      : endpoint.bodyTemplate;
    setBodyText(tpl ? JSON.stringify(tpl, null, 2) : "");
    setBodyError(null);
    setResponse(null);
    setActiveTab(endpoint.bodyTemplate ? "body" : (endpoint.pathParams?.length ? "params" : "body"));
  }, [endpoint.id]);

  const resolvedPath = interpolatePath(endpoint.path, pathParams);
  const wantsBody = endpoint.method === "POST" || endpoint.method === "PUT" || endpoint.method === "PATCH";

  let parsedBody = null;
  if (wantsBody && bodyText.trim()) {
    try { parsedBody = JSON.parse(bodyText); } catch {}
  }

  const send = async () => {
    setBodyError(null);
    if (wantsBody && bodyText.trim()) {
      try { JSON.parse(bodyText); } catch (e) {
        setBodyError("JSON inválido: " + e.message);
        setActiveTab("body");
        return;
      }
    }
    setSending(true);
    const res = await sendRequest({
      baseUrl,
      method: endpoint.method,
      path: resolvedPath,
      body: wantsBody && bodyText.trim() ? JSON.parse(bodyText) : null,
      token,
    });
    setSending(false);
    setResponse(res);
    setActiveTab("response");
    onSend?.(endpoint, res);
  };

  const curlCmd = generateCurl({
    baseUrl, method: endpoint.method, path: resolvedPath,
    body: wantsBody && bodyText.trim() && parsedBody ? parsedBody : null,
    token,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid var(--c-border)",
        background: "var(--c-surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <MethodLabel method={endpoint.method} />
          <code style={{
            fontFamily: "var(--font-mono)", fontSize: 13,
            color: "var(--c-text)", letterSpacing: 0.2,
          }}>{endpoint.path}</code>
          <span style={{ flex: 1 }} />
          <Button variant="primary" icon="send" size="md" onClick={send} loading={sending} disabled={sending}>
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{endpoint.name}</div>
          {endpoint.public ? (
            <Badge tone="neutral" size="sm">PÚBLICO</Badge>
          ) : (
            endpoint.roles?.length > 0 && (
              <>
                <span style={{ fontSize: 11, color: "var(--c-subtle)" }}>Requer role:</span>
                {endpoint.roles.map(r => <Badge key={r} tone="brand" size="sm">{r}</Badge>)}
              </>
            )
          )}
          {endpoint.description && (
            <div style={{ width: "100%", fontSize: 12.5, color: "var(--c-muted)", marginTop: 4, lineHeight: 1.5 }}>
              {endpoint.description}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} items={[
        { value: "body", label: "Body", icon: "code" },
        { value: "params", label: "Path params", icon: "list", count: endpoint.pathParams?.length },
        { value: "curl", label: "cURL", icon: "code" },
        { value: "response", label: "Resposta", icon: "globe", count: response ? 1 : null },
      ]} />

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: 24, background: "var(--c-bg)" }}>
        {activeTab === "body" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!wantsBody ? (
              <div style={{ padding: 16, color: "var(--c-subtle)", fontSize: 13, background: "var(--c-surface-2)", borderRadius: 6 }}>
                Esta requisição <strong>{endpoint.method}</strong> não envia corpo.
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Request body (JSON)
                  </div>
                  <Button size="sm" variant="ghost" icon="refresh"
                    onClick={() => {
                      const tpl = typeof endpoint.bodyTemplate === "function" ? endpoint.bodyTemplate() : endpoint.bodyTemplate;
                      setBodyText(tpl ? JSON.stringify(tpl, null, 2) : "");
                      setBodyError(null);
                    }}>Resetar exemplo</Button>
                </div>
                {endpoint.bodyHint && (
                  <div style={{ fontSize: 12, color: "var(--c-subtle)", lineHeight: 1.5 }}>{endpoint.bodyHint}</div>
                )}
                <CodeEditor value={bodyText} onChange={setBodyText} rows={14} error={!!bodyError} placeholder='{ }' />
                {bodyError && (
                  <div style={{ fontSize: 12, color: "var(--c-danger)", display: "flex", gap: 6, alignItems: "center" }}>
                    <Icon name="warning" size={13} /> {bodyError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "params" && (
          <div style={{ maxWidth: 600 }}>
            {endpoint.pathParams?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Parâmetros de path
                </div>
                {endpoint.pathParams.map(p => (
                  <div key={p.key} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "center" }}>
                    <label style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>{`{${p.key}}`}</label>
                    <Input mono value={pathParams[p.key] || ""} onChange={(v) => setPathParams({ ...pathParams, [p.key]: v })} placeholder={p.default} />
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: 12, background: "var(--c-surface-2)", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--c-subtle)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>URL resolvida</div>
                  <div className="mono" style={{ fontSize: 13, marginTop: 4, wordBreak: "break-all" }}>{baseUrl}<span style={{ color: "var(--c-accent)" }}>{resolvedPath}</span></div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, color: "var(--c-subtle)", fontSize: 13 }}>Esta rota não tem parâmetros de path.</div>
            )}
          </div>
        )}

        {activeTab === "curl" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Comando equivalente
              </div>
              <CopyButton value={curlCmd} />
            </div>
            <pre className="mono" style={{
              padding: 16, fontSize: 12.5, lineHeight: 1.55,
              background: "var(--c-code-bg)", color: "#e3e6f0",
              borderRadius: 6, overflow: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-all",
              margin: 0,
            }}>{curlCmd}</pre>

            {!token && !endpoint.public && (
              <div style={{ marginTop: 12, padding: 12, background: "var(--c-warning-bg)", color: "var(--c-warning)", borderRadius: 6, fontSize: 12.5, display: "flex", gap: 8 }}>
                <Icon name="warning" size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>Esta rota exige autenticação, mas você não está logado. O header <code style={inlineCode}>Authorization</code> não foi incluído no cURL.</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "response" && (
          response ? <ResponseView response={response} /> :
          <div style={{ padding: 40, textAlign: "center", color: "var(--c-subtle)" }}>
            <Icon name="send" size={28} />
            <div style={{ marginTop: 10, fontSize: 14 }}>Clique em <strong>Enviar</strong> para fazer a requisição.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Response viewer =====
function ResponseView({ response }) {
  const [tab, setTab] = React.useState("body");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <StatusBadge status={response.status} statusText={response.statusText} />
        <span style={{ fontSize: 13, color: "var(--c-muted)" }}>
          <Icon name="refresh" size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
          {response.elapsed}ms
        </span>
        {response.bodyText && (
          <span style={{ fontSize: 13, color: "var(--c-muted)" }}>
            <Icon name="code" size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {(response.bodyText.length / 1024).toFixed(1)} kB
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--c-subtle)" }}>
          {response.requestMethod} {response.requestUrl}
        </span>
      </div>

      {response.networkError && (
        <div style={{
          padding: 14, background: "var(--c-danger-bg)", color: "var(--c-danger)",
          borderRadius: 6, fontSize: 13, lineHeight: 1.5, marginBottom: 16,
          border: "1px solid color-mix(in srgb, var(--c-danger) 25%, transparent)",
        }}>
          <div style={{ display: "flex", gap: 8, fontWeight: 500 }}>
            <Icon name="warning" size={16} />
            Erro de rede: {response.networkError}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--c-text)", lineHeight: 1.55 }}>
            Possíveis causas: o Gateway não está rodando, a URL base está errada, ou há um bloqueio de CORS.
            Em desenvolvimento, suba o backend com <code style={inlineCode}>docker compose up</code> ou <code style={inlineCode}>mvn spring-boot:run -pl gateway</code>.
          </div>
        </div>
      )}

      <Tabs value={tab} onChange={setTab} items={[
        { value: "body", label: "Body" },
        { value: "headers", label: "Headers", count: Object.keys(response.headers).length },
      ]} />

      <div style={{ marginTop: 16 }}>
        {tab === "body" && (response.bodyJson != null
          ? <JsonView data={response.bodyJson} />
          : response.bodyText
            ? <pre className="mono" style={{ padding: 16, background: "var(--c-surface-2)", borderRadius: 6, fontSize: 12.5, whiteSpace: "pre-wrap" }}>{response.bodyText}</pre>
            : <div style={{ padding: 16, color: "var(--c-subtle)", fontSize: 13, fontStyle: "italic" }}>Sem corpo na resposta</div>
        )}
        {tab === "headers" && (
          <div style={{ background: "var(--c-surface-2)", borderRadius: 6, border: "1px solid var(--c-border)", overflow: "hidden" }}>
            {Object.entries(response.headers).map(([k, v], i) => (
              <div key={k} style={{
                display: "grid", gridTemplateColumns: "200px 1fr", gap: 12,
                padding: "8px 14px", fontSize: 12.5,
                borderTop: i > 0 ? "1px solid var(--c-border)" : "none",
                fontFamily: "var(--font-mono)",
              }}>
                <span style={{ color: "var(--c-muted)" }}>{k}</span>
                <span style={{ wordBreak: "break-all" }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  useLocalStorage, decodeJwt, sendRequest, interpolatePath, generateCurl,
  StatusBadge, Sidebar, Topbar, LoginModal, EndpointPanel, ResponseView,
});
