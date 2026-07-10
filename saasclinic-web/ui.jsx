/* SaasClinic — UI primitives */

// ---------- Icon (24x24 stroke icons) ----------
function Icon({ name, size = 18, stroke = 1.6, color = "currentColor", style }) {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
    style,
  };
  switch (name) {
    case "dashboard":  return <svg {...props}><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>;
    case "users":      return <svg {...props}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c1-3.6 3.4-5.4 6-5.4s5 1.8 6 5.4"/><circle cx="17" cy="9" r="2.6"/><path d="M21 19c-.4-2.6-2-4-4-4"/></svg>;
    case "user":       return <svg {...props}><circle cx="12" cy="8.5" r="3.4"/><path d="M5 20c.8-3.5 3.6-5.2 7-5.2s6.2 1.7 7 5.2"/></svg>;
    case "stethoscope":return <svg {...props}><path d="M6 4v6a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V4"/><path d="M6 4h2M12 4h2"/><path d="M10 14v3a4 4 0 0 0 8 0v-2"/><circle cx="18" cy="13" r="1.6"/></svg>;
    case "calendar":   return <svg {...props}><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>;
    case "clipboard":  return <svg {...props}><rect x="6" y="4" width="12" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.2" rx="1"/><path d="M9 11h6M9 14.5h6M9 18h4"/></svg>;
    case "shield":     return <svg {...props}><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/></svg>;
    case "search":     return <svg {...props}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.5-3.5"/></svg>;
    case "plus":       return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "x":          return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case "check":      return <svg {...props}><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;
    case "chevron-down":return <svg {...props}><path d="M6 9l6 6 6-6"/></svg>;
    case "chevron-right":return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case "chevron-left":return <svg {...props}><path d="M15 6l-6 6 6 6"/></svg>;
    case "filter":     return <svg {...props}><path d="M3.5 5h17l-6.5 8v5l-4 2v-7L3.5 5z"/></svg>;
    case "more":       return <svg {...props}><circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/></svg>;
    case "edit":       return <svg {...props}><path d="M4 20h4l11-11-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>;
    case "trash":      return <svg {...props}><path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>;
    case "logout":     return <svg {...props}><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 16l-4-4 4-4M5 12h11"/></svg>;
    case "bell":       return <svg {...props}><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>;
    case "clock":      return <svg {...props}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
    case "arrow-right":return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "arrow-up":   return <svg {...props}><path d="M12 5v14M6 11l6-6 6 6"/></svg>;
    case "trending":   return <svg {...props}><path d="M4 17l5-5 4 4 7-9"/><path d="M14 7h6v6"/></svg>;
    case "phone":      return <svg {...props}><path d="M6 4h3l1.5 4.5L8 10a11 11 0 0 0 6 6l1.5-2.5L20 15v3a2 2 0 0 1-2 2C10.8 20 4 13.2 4 6a2 2 0 0 1 2-2z"/></svg>;
    case "mail":       return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 7 8.5-7"/></svg>;
    case "id":         return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 13h4M14 16h2M5 17c.6-1.6 2-2.5 4-2.5s3.4.9 4 2.5"/></svg>;
    case "credit":     return <svg {...props}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 16h4"/></svg>;
    case "warning":    return <svg {...props}><path d="M12 4 2 20h20L12 4z"/><path d="M12 10v5M12 17.5v.5"/></svg>;
    case "info":       return <svg {...props}><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/></svg>;
    case "lock":       return <svg {...props}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>;
    case "moon":       return <svg {...props}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>;
    case "sun":        return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>;
    case "refresh":    return <svg {...props}><path d="M4 12a8 8 0 0 1 13.5-5.8L20 8"/><path d="M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.5 5.8L4 16"/><path d="M4 20v-4h4"/></svg>;
    case "logo":       return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}><path d="M5 4h6a5 5 0 1 1 0 10H8v6H5V4z" fill="currentColor"/><circle cx="17" cy="7" r="2.5" fill="currentColor"/></svg>;
    default: return null;
  }
}

// ---------- Button ----------
function Button({ children, variant = "secondary", size = "md", icon, iconRight, disabled, loading, onClick, type = "button", style, fullWidth, danger }) {
  const variantStyle = {
    primary: {
      background: danger ? "var(--danger)" : "var(--accent)",
      color: "var(--text-on-brand)",
      border: "1px solid transparent",
    },
    secondary: {
      background: "var(--surface)",
      color: "var(--text)",
      border: "1px solid var(--border-strong)",
    },
    ghost: {
      background: "transparent",
      color: "var(--text)",
      border: "1px solid transparent",
    },
    soft: {
      background: "var(--accent-soft)",
      color: "var(--accent)",
      border: "1px solid var(--accent-border)",
    },
    danger: {
      background: "var(--surface)",
      color: "var(--danger)",
      border: "1px solid var(--border-strong)",
    },
  }[variant];

  const sizeStyle = {
    sm: { height: 30, padding: "0 10px", fontSize: 13, gap: 6, borderRadius: 6 },
    md: { height: 36, padding: "0 14px", fontSize: 14, gap: 8, borderRadius: 6 },
    lg: { height: 44, padding: "0 18px", fontSize: 15, gap: 10, borderRadius: 8 },
  }[size];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background 120ms, border-color 120ms, transform 80ms",
        whiteSpace: "nowrap",
        boxShadow: variant === "primary" ? "var(--shadow-xs)" : "none",
        width: fullWidth ? "100%" : "auto",
        ...sizeStyle,
        ...variantStyle,
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "translateY(1px)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = ""; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
    >
      {loading ? <span className="spinner" /> : (icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null)}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === "sm" ? 14 : 16} /> : null}
    </button>
  );
}

// ---------- Input ----------
function Field({ label, hint, error, required, children, span }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: span ? `span ${span}` : undefined }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
          {label}{required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children}
      {error
        ? <div style={{ fontSize: 12, color: "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}><Icon name="warning" size={13} /> {error}</div>
        : hint ? <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>{hint}</div> : null}
    </div>
  );
}

const inputBase = {
  width: "100%",
  height: 38,
  padding: "0 12px",
  fontSize: 14,
  background: "var(--surface)",
  color: "var(--text)",
  border: "1px solid var(--border-strong)",
  borderRadius: 6,
  outline: "none",
  transition: "border-color 120ms, box-shadow 120ms",
};

function Input({ value, onChange, placeholder, type = "text", icon, error, disabled, autoFocus, onKeyDown, style }) {
  const [focused, setFocused] = React.useState(false);
  const wrapStyle = {
    position: "relative",
    display: "flex",
    alignItems: "center",
  };
  const finalStyle = {
    ...inputBase,
    paddingLeft: icon ? 36 : 12,
    borderColor: error ? "var(--danger)" : (focused ? "var(--accent)" : "var(--border-strong)"),
    boxShadow: focused && !error ? "0 0 0 3px var(--accent-soft)" : (error ? "0 0 0 3px var(--danger-bg)" : "none"),
    background: disabled ? "var(--surface-2)" : "var(--surface)",
    ...style,
  };
  return (
    <div style={wrapStyle}>
      {icon && <span style={{ position: "absolute", left: 12, color: "var(--text-subtle)", display: "flex" }}><Icon name={icon} size={16} /></span>}
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        style={finalStyle}
      />
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4, error, disabled }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <textarea
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      style={{
        ...inputBase,
        height: "auto",
        padding: "10px 12px",
        resize: "vertical",
        lineHeight: 1.5,
        borderColor: error ? "var(--danger)" : (focused ? "var(--accent)" : "var(--border-strong)"),
        boxShadow: focused && !error ? "0 0 0 3px var(--accent-soft)" : (error ? "0 0 0 3px var(--danger-bg)" : "none"),
        background: disabled ? "var(--surface-2)" : "var(--surface)",
        cursor: disabled ? "not-allowed" : "text",
      }}
    />
  );
}

function Select({ value, onChange, options, placeholder = "Selecionar", disabled }) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value === "" ? null : e.target.value)}
        disabled={disabled}
        style={{
          ...inputBase,
          appearance: "none",
          paddingRight: 32,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-subtle)" }}>
        <Icon name="chevron-down" size={16} />
      </span>
    </div>
  );
}

// ---------- Badge ----------
function Badge({ children, tone = "neutral", size = "md", dot, style }) {
  const tones = {
    neutral: { bg: "var(--neutral-bg)", fg: "var(--neutral-fg)", dotC: "var(--n-300)" },
    info:    { bg: "var(--info-bg)",    fg: "var(--info)",       dotC: "var(--info)"    },
    success: { bg: "var(--success-bg)", fg: "var(--success)",    dotC: "var(--success)" },
    warning: { bg: "var(--warning-bg)", fg: "var(--warning)",    dotC: "var(--warning)" },
    danger:  { bg: "var(--danger-bg)",  fg: "var(--danger)",     dotC: "var(--danger)"  },
    brand:   { bg: "var(--accent-soft)",fg: "var(--accent)",     dotC: "var(--accent)"  },
  };
  const t = tones[tone];
  const sz = size === "sm" ? { fs: 11, py: 2, px: 6, gap: 4 } : { fs: 12, py: 3, px: 8, gap: 5 };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: sz.gap,
      fontSize: sz.fs, fontWeight: 500,
      padding: `${sz.py}px ${sz.px}px`,
      background: t.bg, color: t.fg,
      borderRadius: 999,
      letterSpacing: 0.2,
      ...style,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dotC }} />}
      {children}
    </span>
  );
}

function StatusBadge({ status, size }) {
  const map = {
    AGENDADO:   { tone: "info",    label: "Agendado",    dot: true },
    CONFIRMADO: { tone: "success", label: "Confirmado",  dot: true },
    REALIZADO:  { tone: "brand",   label: "Realizado",   dot: true },
    ATENDIDO:   { tone: "brand",   label: "Atendido",    dot: true },
    CANCELADO:  { tone: "danger",  label: "Cancelado",   dot: true },
  };
  const c = map[status] || { tone: "neutral", label: status };
  return <Badge tone={c.tone} dot={c.dot} size={size}>{c.label}</Badge>;
}

// ---------- Avatar ----------
function Avatar({ nome, cor, size = 32, color }) {
  const bg = cor || color || "var(--n-200)";
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 999,
      background: bg,
      color: "#fff",
      display: "inline-flex",
      alignItems: "center", justifyContent: "center",
      fontWeight: 600, fontSize: size * 0.38,
      flexShrink: 0,
      letterSpacing: 0.5,
    }}>{initials(nome)}</div>
  );
}

// ---------- Card ----------
function Card({ children, padding = 20, style, hover }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding,
      transition: "border-color 120ms, box-shadow 120ms",
      ...(hover ? { cursor: "pointer" } : {}),
      ...style,
    }}
    onMouseEnter={hover ? (e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; } : undefined}
    onMouseLeave={hover ? (e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; } : undefined}
    >
      {children}
    </div>
  );
}

// ---------- PageHeader ----------
function PageHeader({ title, subtitle, actions, breadcrumbs }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 28 }}>
      <div style={{ minWidth: 0 }}>
        {breadcrumbs && (
          <div style={{ fontSize: 13, color: "var(--text-subtle)", marginBottom: 6 }}>
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span style={{ margin: "0 6px" }}>/</span>}
                <span>{b}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.15 }}>{title}</h1>
        {subtitle && <div style={{ marginTop: 6, fontSize: 14, color: "var(--text-muted)" }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

// ---------- Table ----------
function Table({ columns, rows, onRowClick, empty, rowKey = "id" }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {columns.map((c, i) => (
                <th key={i} style={{
                  textAlign: c.align || "left",
                  padding: "10px var(--pad-x-cell)",
                  fontWeight: 500,
                  fontSize: 12,
                  color: "var(--text-muted)",
                  letterSpacing: 0.4,
                  textTransform: "uppercase",
                  width: c.width,
                  whiteSpace: "nowrap",
                }}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length}>
                {empty || <EmptyState message="Nenhum resultado encontrado" />}
              </td></tr>
            ) : rows.map((r, i) => (
              <tr key={r[rowKey] ?? i}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                style={{
                  borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
                  cursor: onRowClick ? "pointer" : "default",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => onRowClick && (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => onRowClick && (e.currentTarget.style.background = "")}
              >
                {columns.map((c, j) => (
                  <td key={j} style={{
                    padding: "var(--pad-y-cell) var(--pad-x-cell)",
                    textAlign: c.align || "left",
                    color: c.muted ? "var(--text-muted)" : "var(--text)",
                    verticalAlign: "middle",
                    whiteSpace: c.nowrap ? "nowrap" : undefined,
                  }}>
                    {c.cell ? c.cell(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Drawer (lateral form) ----------
function Drawer({ open, onClose, title, subtitle, children, footer, width = 480 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", justifyContent: "flex-end",
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        animation: "fadeIn 160ms ease-out",
      }} />
      <div style={{
        position: "relative",
        width, maxWidth: "100%",
        height: "100%",
        background: "var(--surface)",
        boxShadow: "var(--shadow-overlay)",
        display: "flex", flexDirection: "column",
        animation: "slideInRight 200ms ease-out",
      }}>
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: 4, borderRadius: 4,
            display: "flex",
          }} aria-label="Fechar"><Icon name="x" size={20} /></button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface-2)",
            display: "flex", justifyContent: "flex-end", gap: 8,
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ---------- Modal (confirmation, etc.) ----------
function Modal({ open, onClose, title, children, footer, width = 440 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "rgba(15, 23, 42, 0.42)",
        animation: "fadeIn 160ms ease-out",
      }} />
      <div style={{
        position: "relative",
        width, maxWidth: "100%",
        background: "var(--surface)",
        borderRadius: 12,
        boxShadow: "var(--shadow-overlay)",
        animation: "scaleIn 180ms ease-out",
      }}>
        <div style={{ padding: "20px 24px 0 24px", fontSize: 17, fontWeight: 600 }}>{title}</div>
        <div style={{ padding: "12px 24px 24px 24px", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.55 }}>{children}</div>
        {footer && (
          <div style={{ padding: "12px 24px 20px 24px", display: "flex", justifyContent: "flex-end", gap: 8 }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirmar", danger }) {
  return (
    <Modal
      open={open} onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" danger={danger} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </>
      }
    >{message}</Modal>
  );
}

// ---------- Empty state ----------
function EmptyState({ message = "Nada por aqui ainda.", description, action, icon = "info" }) {
  return (
    <div style={{
      padding: "48px 24px",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 12, color: "var(--text-muted)", textAlign: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999,
        background: "var(--surface-2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-subtle)",
      }}><Icon name={icon} size={22} /></div>
      <div style={{ fontSize: 14, color: "var(--text)" }}>{message}</div>
      {description && <div style={{ fontSize: 13, maxWidth: 360 }}>{description}</div>}
      {action}
    </div>
  );
}

function ForbiddenState() {
  return (
    <EmptyState
      icon="lock"
      message="Sem permissão para acessar esta seção"
      description="Sua role atual não permite visualizar este conteúdo. Troque de persona pelo painel Tweaks ou peça acesso ao administrador."
    />
  );
}

// ---------- Toast container ----------
function ToastContainer() {
  const { toasts } = useApp();
  return (
    <div style={{
      position: "fixed", right: 20, bottom: 20, zIndex: 500,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const map = {
          info:    { bg: "var(--info-bg)",    fg: "var(--info)",    icon: "info"   },
          success: { bg: "var(--success-bg)", fg: "var(--success)", icon: "check"  },
          warning: { bg: "var(--warning-bg)", fg: "var(--warning)", icon: "warning"},
          error:   { bg: "var(--danger-bg)",  fg: "var(--danger)",  icon: "warning"},
        }[t.kind] || { bg: "var(--info-bg)", fg: "var(--info)", icon: "info" };
        return (
          <div key={t.id} style={{
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderLeft: `3px solid ${map.fg}`,
            borderRadius: 8,
            padding: "10px 14px 10px 12px",
            minWidth: 280, maxWidth: 420,
            display: "flex", alignItems: "center", gap: 10,
            color: "var(--text)",
            boxShadow: "var(--shadow-lg)",
            animation: "fadeIn 200ms ease-out",
            pointerEvents: "auto",
            fontSize: 14,
          }}>
            <span style={{ color: map.fg, display: "flex" }}><Icon name={map.icon} size={18} /></span>
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Tabs ----------
function Tabs({ value, onChange, items }) {
  return (
    <div style={{
      display: "inline-flex",
      padding: 3,
      background: "var(--surface-2)",
      borderRadius: 8,
      border: "1px solid var(--border)",
      gap: 2,
    }}>
      {items.map(item => {
        const active = value === item.value;
        return (
          <button key={item.value}
            onClick={() => onChange(item.value)}
            style={{
              padding: "6px 14px",
              fontSize: 13, fontWeight: 500,
              background: active ? "var(--surface)" : "transparent",
              color: active ? "var(--text)" : "var(--text-muted)",
              border: "none", borderRadius: 6,
              cursor: "pointer",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              transition: "background 120ms",
            }}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Stat ----------
function StatCard({ label, value, hint, trend, icon, color }) {
  return (
    <Card padding={20}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
          <div style={{ marginTop: 8, fontSize: 30, fontWeight: 600, letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-display)" }}>{value}</div>
          {(hint || trend) && (
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              {trend != null && (
                <span style={{ color: trend > 0 ? "var(--success)" : "var(--danger)", display: "inline-flex", alignItems: "center", gap: 2, fontWeight: 500 }}>
                  <Icon name={trend > 0 ? "arrow-up" : "arrow-up"} size={12} style={{ transform: trend > 0 ? "" : "rotate(180deg)" }} />
                  {Math.abs(trend)}%
                </span>
              )}
              {hint}
            </div>
          )}
        </div>
        {icon && (
          <div style={{
            width: 36, height: 36,
            borderRadius: 8,
            background: color || "var(--accent-soft)",
            color: "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}><Icon name={icon} size={18} /></div>
        )}
      </div>
    </Card>
  );
}

// ---------- FilterBar ----------
function FilterBar({ children, search, onSearch, searchPlaceholder = "Buscar..." }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      flexWrap: "wrap",
      marginBottom: 16,
    }}>
      {onSearch && (
        <div style={{ minWidth: 280, maxWidth: 400, flex: 1 }}>
          <Input icon="search" value={search} onChange={onSearch} placeholder={searchPlaceholder} />
        </div>
      )}
      {children}
    </div>
  );
}

// ---------- IconButton ----------
function IconButton({ icon, onClick, label, size = 32, tone = "neutral" }) {
  const tones = {
    neutral: { color: "var(--text-muted)", bg: "transparent", hov: "var(--surface-2)" },
    danger:  { color: "var(--danger)",     bg: "transparent", hov: "var(--danger-bg)" },
  };
  const t = tones[tone];
  return (
    <button onClick={onClick} aria-label={label} title={label} style={{
      width: size, height: size,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: t.bg, color: t.color,
      border: "none", borderRadius: 6, cursor: "pointer",
      transition: "background 100ms",
    }}
      onMouseEnter={(e) => e.currentTarget.style.background = t.hov}
      onMouseLeave={(e) => e.currentTarget.style.background = t.bg}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

// ---------- Expose ----------
Object.assign(window, {
  Icon, Button, Field, Input, Textarea, Select,
  Badge, StatusBadge, Avatar, Card, PageHeader,
  Table, Drawer, Modal, ConfirmDialog,
  EmptyState, ForbiddenState, ToastContainer,
  Tabs, StatCard, FilterBar, IconButton, inputBase,
});
