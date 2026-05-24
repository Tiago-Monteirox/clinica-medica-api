/* SaasClinic API Console — UI primitives */

// ===== Icon =====
function Icon({ name, size = 16, color = "currentColor", style }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style };
  switch (name) {
    case "lock":      return <svg {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case "shield":    return <svg {...p}><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/></svg>;
    case "calendar":  return <svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>;
    case "clipboard": return <svg {...p}><rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.2" rx="1"/><path d="M9 11h6M9 14.5h6M9 18h4"/></svg>;
    case "play":      return <svg {...p}><path d="M7 5v14l12-7L7 5z" fill="currentColor"/></svg>;
    case "send":      return <svg {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>;
    case "copy":      return <svg {...p}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/></svg>;
    case "check":     return <svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;
    case "x":         return <svg {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case "info":      return <svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/></svg>;
    case "warning":   return <svg {...p}><path d="M12 4 2 20h20L12 4z"/><path d="M12 10v5M12 17.5v.5"/></svg>;
    case "search":    return <svg {...p}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>;
    case "chevron-down":  return <svg {...p}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevron-right": return <svg {...p}><path d="M9 6l6 6-6 6"/></svg>;
    case "trash":     return <svg {...p}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/></svg>;
    case "user":      return <svg {...p}><circle cx="12" cy="8.5" r="3.4"/><path d="M5 20c.8-3.5 3.6-5.2 7-5.2s6.2 1.7 7 5.2"/></svg>;
    case "logout":    return <svg {...p}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 16l-4-4 4-4M5 12h11"/></svg>;
    case "refresh":   return <svg {...p}><path d="M4 12a8 8 0 0 1 13.5-5.8L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.5 5.8L4 16"/><path d="M4 20v-4h4"/></svg>;
    case "moon":      return <svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>;
    case "sun":       return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>;
    case "code":      return <svg {...p}><path d="m8 6-6 6 6 6M16 6l6 6-6 6"/></svg>;
    case "list":      return <svg {...p}><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>;
    case "settings":  return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case "zap":       return <svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
    case "history":   return <svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/></svg>;
    case "globe":     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>;
    case "github":    return <svg {...p}><path d="M9 18c-4.5 1.5-4.5-2.5-6-3M15 22v-3.9a3.4 3.4 0 0 0-1-2.6c3.4-.4 7-1.7 7-7.6A6 6 0 0 0 19.4 4a5.6 5.6 0 0 0-.1-4S18.2-.4 15 1.7a13.4 13.4 0 0 0-7 0C4.8-.4 3.7 0 3.7 0a5.6 5.6 0 0 0-.1 4 6 6 0 0 0-1.6 3.9c0 5.9 3.6 7.2 7 7.6a3.4 3.4 0 0 0-1 2.6V22"/></svg>;
    case "logo":      return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <path d="M5 4h6.5a4.5 4.5 0 0 1 0 9H8.5V20h-3.5V4z" fill="currentColor"/>
        <circle cx="17" cy="6.5" r="2.4" fill="currentColor"/>
      </svg>
    );
    default: return null;
  }
}

// ===== Button =====
function Button({ children, variant = "secondary", size = "md", icon, iconRight, onClick, disabled, loading, type = "button", style, fullWidth, danger, title }) {
  const v = {
    primary: { bg: danger ? "var(--c-danger)" : "var(--c-accent)", fg: "#fff", bd: "transparent" },
    secondary: { bg: "var(--c-surface)", fg: "var(--c-text)", bd: "var(--c-border-strong)" },
    ghost: { bg: "transparent", fg: "var(--c-text)", bd: "transparent" },
    soft: { bg: "var(--c-accent-soft)", fg: "var(--c-accent)", bd: "var(--c-accent-border)" },
    danger: { bg: "var(--c-surface)", fg: "var(--c-danger)", bd: "var(--c-border-strong)" },
  }[variant];
  const s = {
    sm: { h: 28, px: 10, fs: 12, gap: 6, br: 5 },
    md: { h: 34, px: 12, fs: 13, gap: 7, br: 6 },
    lg: { h: 40, px: 16, fs: 14, gap: 8, br: 7 },
  }[size];
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} title={title}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: s.gap, height: s.h, padding: `0 ${s.px}px`, fontSize: s.fs, fontWeight: 500,
        background: v.bg, color: v.fg, border: `1px solid ${v.bd}`, borderRadius: s.br,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        whiteSpace: "nowrap",
        transition: "background 100ms, border-color 100ms",
        width: fullWidth ? "100%" : "auto",
        ...style,
      }}>
      {loading ? <span className="spinner" /> : (icon ? <Icon name={icon} size={s.fs + 2} /> : null)}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={s.fs + 2} /> : null}
    </button>
  );
}

// ===== Input =====
function Input({ value, onChange, placeholder, type = "text", icon, error, disabled, autoFocus, onKeyDown, style, mono, size = "md" }) {
  const [focused, setFocused] = React.useState(false);
  const h = size === "sm" ? 30 : size === "lg" ? 40 : 34;
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      {icon && <span style={{ position: "absolute", left: 10, color: "var(--c-subtle)", display: "flex" }}><Icon name={icon} size={14} /></span>}
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        style={{
          width: "100%", height: h,
          padding: `0 12px 0 ${icon ? 32 : 12}px`,
          fontSize: 13,
          background: disabled ? "var(--c-surface-2)" : "var(--c-surface)",
          color: "var(--c-text)",
          border: `1px solid ${error ? "var(--c-danger)" : (focused ? "var(--c-accent)" : "var(--c-border-strong)")}`,
          borderRadius: 6,
          outline: "none",
          boxShadow: focused ? "0 0 0 3px var(--c-accent-soft)" : "none",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          ...style,
        }} />
    </div>
  );
}

// ===== Textarea (code editor light) =====
function CodeEditor({ value, onChange, placeholder, rows = 10, error }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      placeholder={placeholder}
      spellCheck={false}
      rows={rows}
      style={{
        width: "100%",
        padding: 12,
        fontSize: 12.5,
        lineHeight: 1.55,
        fontFamily: "var(--font-mono)",
        background: "var(--c-surface)",
        color: "var(--c-text)",
        border: `1px solid ${error ? "var(--c-danger)" : (focused ? "var(--c-accent)" : "var(--c-border-strong)")}`,
        borderRadius: 6,
        outline: "none",
        boxShadow: focused ? "0 0 0 3px var(--c-accent-soft)" : "none",
        resize: "vertical",
        tabSize: 2,
        minHeight: 180,
      }} />
  );
}

// ===== Badge =====
function Badge({ children, tone = "neutral", size = "md", style }) {
  const tones = {
    neutral: { bg: "var(--c-surface-2)",  fg: "var(--c-muted)"   },
    info:    { bg: "var(--c-info-bg)",    fg: "var(--c-info)"    },
    success: { bg: "var(--c-success-bg)", fg: "var(--c-success)" },
    warning: { bg: "var(--c-warning-bg)", fg: "var(--c-warning)" },
    danger:  { bg: "var(--c-danger-bg)",  fg: "var(--c-danger)"  },
    brand:   { bg: "var(--c-accent-soft)",fg: "var(--c-accent)"  },
  };
  const t = tones[tone] || tones.neutral;
  const sz = size === "sm" ? { fs: 10, py: 2, px: 6 } : { fs: 11, py: 3, px: 7 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: sz.fs, fontWeight: 500,
      padding: `${sz.py}px ${sz.px}px`,
      background: t.bg, color: t.fg,
      borderRadius: 4, letterSpacing: 0.3,
      ...style,
    }}>{children}</span>
  );
}

// ===== Method pill =====
function MethodPill({ method, size = "md" }) {
  const colors = { GET: "get", POST: "post", PUT: "put", PATCH: "put", DELETE: "delete" };
  const c = colors[method] || "get";
  const fs = size === "sm" ? 10 : 11;
  return (
    <span className={`m-${c}`} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-mono)", fontWeight: 600,
      fontSize: fs, letterSpacing: 0.4,
      minWidth: size === "sm" ? 38 : 52,
      padding: "3px 6px",
      borderRadius: 3,
      background: "currentColor",
      color: "transparent",
    }}>
      <span style={{ color: "white", mixBlendMode: "screen" }}>{method}</span>
      <span style={{ position: "absolute", color: "var(--c-text)", display: "none" }}>{method}</span>
    </span>
  );
}

// Simpler method label — uses fg color, no background trick
function MethodLabel({ method, size = "md" }) {
  const map = {
    GET:    "var(--c-method-get)",
    POST:   "var(--c-method-post)",
    PUT:    "var(--c-method-put)",
    DELETE: "var(--c-method-delete)",
    PATCH:  "var(--c-warning)",
  };
  const fs = size === "sm" ? 10 : 11;
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontWeight: 700,
      fontSize: fs, letterSpacing: 0.5,
      color: map[method] || "var(--c-muted)",
      minWidth: size === "sm" ? 42 : 50,
      display: "inline-block",
      textAlign: "left",
    }}>{method}</span>
  );
}

// ===== Tabs =====
function Tabs({ value, onChange, items, fullWidth }) {
  return (
    <div style={{
      display: "flex", gap: 0,
      borderBottom: "1px solid var(--c-border)",
      width: fullWidth ? "100%" : "auto",
    }}>
      {items.map(item => {
        const active = value === item.value;
        return (
          <button key={item.value} onClick={() => onChange(item.value)}
            style={{
              padding: "10px 14px",
              fontSize: 13, fontWeight: 500,
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${active ? "var(--c-accent)" : "transparent"}`,
              color: active ? "var(--c-text)" : "var(--c-muted)",
              cursor: "pointer",
              marginBottom: -1,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            {item.icon && <Icon name={item.icon} size={13} />}
            {item.label}
            {item.count != null && (
              <span style={{
                fontSize: 10, padding: "1px 5px", borderRadius: 999,
                background: active ? "var(--c-accent-soft)" : "var(--c-surface-2)",
                color: active ? "var(--c-accent)" : "var(--c-muted)",
                fontWeight: 600, marginLeft: 2,
              }}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ===== Modal =====
function Modal({ open, onClose, title, children, footer, width = 480 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      animation: "fadeIn 160ms ease-out",
    }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(15, 23, 42, 0.5)" }} />
      <div style={{
        position: "relative", width, maxWidth: "100%",
        background: "var(--c-surface)",
        borderRadius: 10,
        boxShadow: "var(--shadow-lg)",
        border: "1px solid var(--c-border)",
        maxHeight: "90vh", overflow: "auto",
      }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--c-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--c-muted)", padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ padding: "16px 22px" }}>{children}</div>
        {footer && <div style={{ padding: "12px 22px", borderTop: "1px solid var(--c-border)", display: "flex", justifyContent: "flex-end", gap: 8, background: "var(--c-surface-2)" }}>{footer}</div>}
      </div>
    </div>
  );
}

// ===== Toast =====
function ToastContainer({ toasts }) {
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 500,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const map = {
          info: { bg: "var(--c-info-bg)", fg: "var(--c-info)", icon: "info" },
          success: { bg: "var(--c-success-bg)", fg: "var(--c-success)", icon: "check" },
          error: { bg: "var(--c-danger-bg)", fg: "var(--c-danger)", icon: "warning" },
          warning: { bg: "var(--c-warning-bg)", fg: "var(--c-warning)", icon: "warning" },
        }[t.kind] || { bg: "var(--c-info-bg)", fg: "var(--c-info)", icon: "info" };
        return (
          <div key={t.id} style={{
            background: "var(--c-surface)", color: "var(--c-text)",
            border: "1px solid var(--c-border-strong)",
            borderLeft: `3px solid ${map.fg}`,
            borderRadius: 6,
            padding: "10px 14px",
            minWidth: 260, maxWidth: 420,
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 13,
            boxShadow: "var(--shadow-md)",
            animation: "fadeIn 200ms ease-out",
            pointerEvents: "auto",
          }}>
            <span style={{ color: map.fg, display: "flex" }}><Icon name={map.icon} size={16} /></span>
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}

// ===== JSON pretty (with syntax highlight) =====
function highlightJson(json) {
  if (json == null) return "";
  const str = typeof json === "string" ? json : JSON.stringify(json, null, 2);
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (m) => {
      let cls = "n";
      if (/^"/.test(m)) {
        cls = /:$/.test(m) ? "k" : "s";
      } else if (/true|false/.test(m)) {
        cls = "b";
      } else if (/null/.test(m)) {
        cls = "nu";
      }
      return `<span class="${cls}">${m}</span>`;
    });
}

function JsonView({ data }) {
  if (data === null || data === undefined) {
    return <div style={{ padding: 16, color: "var(--c-subtle)", fontSize: 13, fontStyle: "italic" }}>Sem corpo na resposta</div>;
  }
  const html = highlightJson(data);
  return <pre className="json-viewer" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ===== Copy button =====
function CopyButton({ value, label = "Copiar", size = "sm" }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button size={size} variant="ghost" icon={done ? "check" : "copy"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}>
      {done ? "Copiado" : label}
    </Button>
  );
}

Object.assign(window, {
  Icon, Button, Input, CodeEditor, Badge,
  MethodPill, MethodLabel, Tabs, Modal,
  ToastContainer, JsonView, highlightJson, CopyButton,
});
