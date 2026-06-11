/* SaasClinic — API Console (floating dev panel showing network log) */

function ApiConsole() {
  const entries = useNetLog();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const config = window.loadConfig();
  const pending = entries.filter(e => e.pending).length;
  const errors  = entries.filter(e => e.ok === false).length;

  React.useEffect(() => {
    // close detail when selected entry no longer exists
    if (selected && !entries.find(e => e.id === selected.id)) setSelected(null);
    // update reference if same id but content changed
    if (selected) {
      const fresh = entries.find(e => e.id === selected.id);
      if (fresh && fresh !== selected) setSelected(fresh);
    }
  }, [entries]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="API Console"
        style={{
          position: "fixed", left: 16, bottom: 16, zIndex: 90,
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 14px 8px 10px",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 12, fontWeight: 500,
          color: "var(--text)",
          boxShadow: "var(--shadow-md)",
          fontFamily: "var(--font-mono)",
        }}>
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: pending > 0 ? "var(--warning)" : (config.mode === "live" ? "var(--success)" : "var(--accent)"),
          boxShadow: pending > 0 ? "0 0 8px var(--warning)" : "none",
          animation: pending > 0 ? "pulse 1.2s ease-in-out infinite" : "none",
        }} />
        <span>API</span>
        <span style={{ color: "var(--text-muted)" }}>{config.mode.toUpperCase()}</span>
        {entries.length > 0 && (
          <span style={{
            padding: "1px 6px", borderRadius: 999,
            background: errors > 0 ? "var(--danger-bg)" : "var(--surface-2)",
            color: errors > 0 ? "var(--danger)" : "var(--text-muted)",
            fontSize: 11, fontWeight: 500,
          }}>{entries.length}</span>
        )}
      </button>

      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }`}</style>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", left: 16, bottom: 64, zIndex: 95,
          width: selected ? 720 : 440,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "70vh",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: 12,
          boxShadow: "var(--shadow-overlay)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "scaleIn 180ms ease-out",
          transformOrigin: "bottom left",
        }}>
          {/* Header */}
          <div style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <window.Icon name="info" size={14} color="var(--text-muted)" />
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.3 }}>API Console</div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              · {config.mode === "live" ? config.gateway : "MOCK"}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={() => NetLog.clear()} style={consoleBtn}>Limpar</button>
            <button onClick={() => setOpen(false)} style={{ ...consoleBtn, padding: 4 }}>
              <window.Icon name="x" size={14} />
            </button>
          </div>

          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* List */}
            <div style={{
              width: selected ? 320 : "100%",
              borderRight: selected ? "1px solid var(--border)" : "none",
              overflowY: "auto",
            }}>
              {entries.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "var(--text-subtle)", fontSize: 13 }}>
                  Nenhuma requisição ainda.<br />
                  <span style={{ fontSize: 11 }}>Navegue pela aplicação para ver as chamadas.</span>
                </div>
              ) : entries.map(e => <NetRow key={e.id} entry={e} active={selected?.id === e.id} onClick={() => setSelected(e)} />)}
            </div>

            {/* Detail */}
            {selected && (
              <div style={{ flex: 1, overflowY: "auto", padding: 14, fontFamily: "var(--font-mono)", fontSize: 12 }}>
                <NetDetail entry={selected} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const consoleBtn = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "3px 8px",
  fontSize: 11,
  cursor: "pointer",
  color: "var(--text-muted)",
  display: "inline-flex", alignItems: "center", gap: 4,
  fontFamily: "var(--font-mono)",
};

function NetRow({ entry, active, onClick }) {
  const methodColors = {
    GET:    "var(--info)",
    POST:   "var(--success)",
    PUT:    "var(--warning)",
    PATCH:  "var(--warning)",
    DELETE: "var(--danger)",
  };
  const statusColor = entry.pending ? "var(--text-subtle)"
    : entry.ok ? "var(--success)" : "var(--danger)";

  return (
    <div onClick={onClick} style={{
      padding: "8px 12px",
      borderBottom: "1px solid var(--border)",
      cursor: "pointer",
      background: active ? "var(--accent-soft)" : "transparent",
      transition: "background 80ms",
      fontFamily: "var(--font-mono)",
      fontSize: 11.5,
    }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.background = "var(--surface-2)")}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontWeight: 600, color: methodColors[entry.method] || "var(--text)", minWidth: 48 }}>
          {entry.method}
        </span>
        {entry.pending ? (
          <span style={{ color: "var(--text-subtle)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> pendente
          </span>
        ) : (
          <span style={{ color: statusColor, fontWeight: 500 }}>{entry.status}</span>
        )}
        <span style={{ marginLeft: "auto", color: "var(--text-subtle)" }}>
          {entry.ms != null && `${entry.ms}ms`}
        </span>
      </div>
      <div className="truncate" style={{ marginTop: 2, color: active ? "var(--accent)" : "var(--text)", fontSize: 11.5 }}>
        {prettyPath(entry.url)}
      </div>
    </div>
  );
}

function prettyPath(url) {
  try {
    const u = new URL(url, "http://x");
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

function NetDetail({ entry }) {
  const [tab, setTab] = React.useState("response");
  const curl = buildCurl(entry);

  return (
    <div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
        {entry.at.toLocaleTimeString("pt-BR")} · {entry.ms}ms · <span style={{ textTransform: "uppercase" }}>{entry.mode}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, wordBreak: "break-all", marginBottom: 12 }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{entry.method}</span> {entry.url}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, fontFamily: "var(--font-sans)" }}>
        {["response", "request", "curl"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...consoleBtn,
            background: tab === t ? "var(--surface-2)" : "var(--surface)",
            color: tab === t ? "var(--text)" : "var(--text-muted)",
            textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>

      {tab === "response" && (
        entry.pending ? <Skeleton text="Aguardando resposta…" />
          : entry.error ? <CodeBlock kind="error">{entry.error}</CodeBlock>
          : <CodeBlock>{JSON.stringify(entry.response, null, 2)}</CodeBlock>
      )}
      {tab === "request" && (
        entry.request
          ? <CodeBlock>{JSON.stringify(entry.request, null, 2)}</CodeBlock>
          : <Skeleton text="Sem corpo na requisição." />
      )}
      {tab === "curl" && <CodeBlock>{curl}</CodeBlock>}
    </div>
  );
}

function CodeBlock({ children, kind }) {
  return (
    <pre style={{
      margin: 0,
      padding: 12,
      background: kind === "error" ? "var(--danger-bg)" : "var(--bg-sunken)",
      color: kind === "error" ? "var(--danger)" : "var(--text)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      fontSize: 11.5,
      lineHeight: 1.55,
      overflowX: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontFamily: "var(--font-mono)",
    }}>{children}</pre>
  );
}

function Skeleton({ text }) {
  return <div style={{ padding: 12, fontSize: 12, color: "var(--text-subtle)", fontStyle: "italic", fontFamily: "var(--font-sans)" }}>{text}</div>;
}

function buildCurl(entry) {
  const lines = [`curl -X ${entry.method} '${entry.url}'`];
  lines.push(`  -H 'Accept: application/json'`);
  lines.push(`  -H 'Content-Type: application/json'`);
  lines.push(`  -H 'Authorization: Bearer <token>'`);
  if (entry.request) {
    lines.push(`  -d '${JSON.stringify(entry.request)}'`);
  }
  return lines.join(" \\\n");
}

window.ApiConsole = ApiConsole;
