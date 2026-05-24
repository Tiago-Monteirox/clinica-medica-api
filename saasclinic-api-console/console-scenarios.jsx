/* SaasClinic API Console — Scenarios runner + History + Root */

// ===== Scenarios panel =====
function ScenariosPanel({ baseUrl, token, onTokenChange, onPushHistory, onShowEndpoint }) {
  const [runningId, setRunningId] = React.useState(null);
  const [runResults, setRunResults] = React.useState({}); // { scenarioId: [stepResults] }

  // Helper: read property from object via dot path "data.id"
  const dig = (obj, path) => path.split(".").reduce((o, k) => o == null ? o : o[k], obj);

  // Helper: replace {{var}} tokens
  const interp = (val, vars) => {
    if (typeof val !== "string") return val;
    return val.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  };
  const interpObject = (obj, vars) => {
    if (obj == null || typeof obj !== "object") return obj;
    const out = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === "string") out[k] = interp(v, vars);
      else if (typeof v === "object") out[k] = interpObject(v, vars);
      else out[k] = v;
    }
    return out;
  };

  const runScenario = async (scenario) => {
    setRunningId(scenario.id);
    setRunResults(prev => ({ ...prev, [scenario.id]: [] }));

    // Vars pré-populadas pra cada execução. Cenários podem referenciar:
    //   {{_ts}}   — timestamp ms da execução (Long), usar pra IDs únicos
    //   {{_now}}  — ISO string, usar em campos de data se precisar
    //   {{_uid}}  — sufixo curto único pra nomes/emails (8 chars do timestamp)
    const ts = Date.now();
    const uid = ts.toString().slice(-8);
    let vars = {
      _ts: ts.toString(),
      _now: new Date(ts).toISOString(),
      _uid: uid,
    };
    let currentToken = token;
    const stepResults = [];

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];

      // === Step especial: cleanup-list ===
      // GET na lista, filtra entradas cujo campo começa com um prefixo,
      // dispara DELETE em cada uma. Usado pelo cenário "Cleanup demos".
      if (step.kind === "cleanup-list") {
        const listEp = ENDPOINTS.find(e => e.id === step.listEndpoint);
        const delEp = ENDPOINTS.find(e => e.id === step.deleteEndpoint);
        const label = step.label || `Cleanup ${step.match?.startsWith || step.listEndpoint}`;
        stepResults.push({ label, status: "running", method: "MIXED", path: "—" });
        setRunResults(prev => ({ ...prev, [scenario.id]: [...stepResults] }));

        if (!listEp || !delEp) {
          stepResults[stepResults.length - 1] = { label, status: "skipped", message: "Endpoint não encontrado no catálogo" };
          setRunResults(prev => ({ ...prev, [scenario.id]: [...stepResults] }));
          continue;
        }

        const listRes = await sendRequest({ baseUrl, method: "GET", path: listEp.path, token: currentToken });
        if (!listRes.ok) {
          stepResults[stepResults.length - 1] = { label, status: "fail", response: listRes, message: `Falhou listando (${listRes.status})` };
          setRunResults(prev => ({ ...prev, [scenario.id]: [...stepResults] }));
          continue;
        }

        const list = Array.isArray(listRes.bodyJson?.data) ? listRes.bodyJson.data : [];
        const matched = list.filter(item => {
          if (step.match?.startsWith && step.match?.field) {
            const v = item[step.match.field];
            return typeof v === "string" && v.startsWith(step.match.startsWith);
          }
          if (step.match?.idsFromVar) {
            const ids = vars[step.match.idsFromVar];
            if (!Array.isArray(ids)) return false;
            const refField = step.match.field || "id";
            return ids.includes(item[refField]);
          }
          return false;
        });

        // Captura os IDs encontrados pra que steps seguintes possam usar
        // (ex: agendamentos cleanup usa demoPacienteIds + demoMedicoIds).
        if (step.captureIdsAs) vars[step.captureIdsAs] = matched.map(m => m.id);

        let deleted = 0, failed = 0;
        for (const item of matched) {
          const delPath = interpolatePath(delEp.path, { id: String(item.id) });
          const delRes = await sendRequest({ baseUrl, method: "DELETE", path: delPath, token: currentToken });
          if (delRes.ok || delRes.status === 204) deleted++;
          else failed++;
        }

        stepResults[stepResults.length - 1] = {
          label,
          status: failed === 0 ? "pass" : (deleted > 0 ? "partial" : "fail"),
          method: "MIXED",
          path: `${listEp.path} (${matched.length} match) → DELETE`,
          message: `${deleted} deletado(s), ${failed} falha(s), de ${list.length} total na lista`,
          vars: { ...vars },
        };
        setRunResults(prev => ({ ...prev, [scenario.id]: [...stepResults] }));
        await new Promise(r => setTimeout(r, 250));
        continue;
      }

      const ep = ENDPOINTS.find(e => e.id === step.endpoint);
      if (!ep) {
        stepResults.push({ label: step.label || step.endpoint, status: "skipped", message: "Endpoint não encontrado" });
        setRunResults(prev => ({ ...prev, [scenario.id]: [...stepResults] }));
        continue;
      }

      // Determine path params
      let pathParams = {};
      for (const p of (ep.pathParams || [])) pathParams[p.key] = p.default;
      if (step.pathParams) {
        for (const [k, v] of Object.entries(step.pathParams)) pathParams[k] = interp(v, vars);
      }
      if (step.interpolatePath) {
        for (const [k, v] of Object.entries(step.interpolatePath)) pathParams[k] = interp(v, vars);
      }
      const resolvedPath = interpolatePath(ep.path, pathParams);

      // Determine body
      let body = null;
      const wantsBody = ep.method === "POST" || ep.method === "PUT" || ep.method === "PATCH";
      if (wantsBody) {
        const tpl = step.body !== undefined ? step.body
                  : (typeof ep.bodyTemplate === "function" ? ep.bodyTemplate() : ep.bodyTemplate);
        body = step.interpolate ? { ...interpObject(tpl, vars), ...interpObject(step.interpolate, vars) }
                                 : interpObject(tpl, vars);
      }

      // Token control
      const useToken = step.clearToken ? null : currentToken;

      // Mark as running
      stepResults.push({
        label: step.label || ep.name,
        endpoint: ep, method: ep.method, path: resolvedPath,
        body,
        status: "running",
      });
      setRunResults(prev => ({ ...prev, [scenario.id]: [...stepResults] }));

      const res = await sendRequest({ baseUrl, method: ep.method, path: resolvedPath, body, token: useToken });

      // Capture token
      if (step.captureToken && res.ok && res.bodyJson?.data?.token) {
        currentToken = res.bodyJson.data.token;
        onTokenChange?.(currentToken, res.bodyJson.data);
      }

      // Capture variables
      if (step.capture && res.ok) {
        for (const [varName, dataPath] of Object.entries(step.capture)) {
          const val = dig(res.bodyJson, dataPath);
          if (val !== undefined) vars[varName] = val;
        }
      }

      // Pass/fail
      const expected = step.expectStatus;
      let outcome;
      if (expected != null) {
        outcome = res.status === expected ? "pass" : "fail";
      } else {
        outcome = res.ok ? "pass" : "fail";
      }

      stepResults[stepResults.length - 1] = {
        ...stepResults[stepResults.length - 1],
        status: outcome,
        response: res,
        expectStatus: expected,
        vars: { ...vars },
      };
      setRunResults(prev => ({ ...prev, [scenario.id]: [...stepResults] }));
      onPushHistory?.(ep, res);

      await new Promise(r => setTimeout(r, 250));
    }

    setRunningId(null);
  };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: 24, background: "var(--c-bg)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Cenários rápidos</h1>
        <p style={{ marginTop: 6, fontSize: 14, color: "var(--c-muted)", lineHeight: 1.55 }}>
          Sequências pré-montadas que demonstram o consumo das APIs de ponta a ponta — incluindo login, criação encadeada e tratamento de erros via <code style={inlineCode}>GlobalExceptionHandler</code>.
        </p>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {SCENARIOS.map(sc => {
            const results = runResults[sc.id] || [];
            const running = runningId === sc.id;
            const done = results.length > 0 && !running;
            const passed = results.filter(r => r.status === "pass").length;
            const total = sc.steps.length;
            return (
              <div key={sc.id} style={{
                background: "var(--c-surface)",
                border: "1px solid var(--c-border)",
                borderRadius: 10,
                overflow: "hidden",
              }}>
                <div style={{ padding: "16px 20px", borderBottom: results.length > 0 ? "1px solid var(--c-border)" : "none", display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "var(--c-accent-soft)", color: "var(--c-accent)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Icon name="zap" size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{sc.name}</div>
                      {done && (
                        <Badge tone={passed === total ? "success" : "warning"} size="sm">
                          {passed}/{total} passos OK
                        </Badge>
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 13, color: "var(--c-muted)", lineHeight: 1.5 }}>{sc.description}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--c-subtle)" }}>{sc.steps.length} passos</div>
                  </div>
                  <Button variant="primary" icon="play" onClick={() => runScenario(sc)} loading={running} disabled={running}>
                    {running ? "Executando..." : (done ? "Reexecutar" : "Executar")}
                  </Button>
                </div>

                {results.length > 0 && (
                  <div>
                    {results.map((r, i) => <ScenarioStepRow key={i} idx={i} result={r} onOpen={() => r.endpoint && onShowEndpoint(r.endpoint.id)} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScenarioStepRow({ idx, result, onOpen }) {
  const [open, setOpen] = React.useState(false);
  const statusIcon = {
    pass: { icon: "check", color: "var(--c-success)" },
    fail: { icon: "x", color: "var(--c-danger)" },
    running: { icon: "refresh", color: "var(--c-muted)" },
    skipped: { icon: "info", color: "var(--c-subtle)" },
  }[result.status] || { icon: "info", color: "var(--c-muted)" };

  const expectMsg = result.expectStatus != null
    ? (result.response?.status === result.expectStatus
      ? `esperava ${result.expectStatus}, recebeu ${result.response.status} ✓`
      : `esperava ${result.expectStatus}, recebeu ${result.response?.status || "?"}`)
    : null;

  return (
    <div style={{ borderTop: idx > 0 ? "1px solid var(--c-border)" : "none" }}>
      <div onClick={() => setOpen(!open)} style={{
        padding: "10px 20px 10px 16px",
        display: "flex", alignItems: "center", gap: 12,
        cursor: "pointer",
      }}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--c-surface-2)"}
        onMouseLeave={(e) => e.currentTarget.style.background = ""}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 999,
          background: result.status === "running" ? "transparent" : `color-mix(in srgb, ${statusIcon.color} 16%, transparent)`,
          color: statusIcon.color,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {result.status === "running" ? <span className="spinner" /> : <Icon name={statusIcon.icon} size={13} />}
        </div>
        <span style={{ fontSize: 11, color: "var(--c-subtle)", width: 18 }} className="mono">#{idx + 1}</span>
        <MethodLabel method={result.method || "?"} size="sm" />
        <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {result.path || ""}
        </code>
        <span style={{ fontSize: 12, color: "var(--c-text)" }}>{result.label}</span>
        {result.response && <StatusBadge status={result.response.status} statusText="" />}
        {result.response && <span style={{ fontSize: 11, color: "var(--c-subtle)" }}>{result.response.elapsed}ms</span>}
        <Icon name={open ? "chevron-down" : "chevron-right"} size={12} color="var(--c-subtle)" />
      </div>
      {open && result.response && (
        <div style={{ padding: "0 20px 16px 56px" }}>
          {expectMsg && (
            <div style={{ fontSize: 12, color: result.status === "pass" ? "var(--c-success)" : "var(--c-danger)", marginBottom: 8 }}>
              {expectMsg}
            </div>
          )}
          {result.vars && Object.keys(result.vars).length > 0 && (
            <div style={{ marginBottom: 8, padding: 10, background: "var(--c-surface-2)", borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 500, color: "var(--c-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4, fontSize: 10 }}>Variáveis capturadas</div>
              <div className="mono" style={{ fontSize: 11.5 }}>
                {Object.entries(result.vars).map(([k, v]) => (
                  <div key={k}>{k} = <span style={{ color: "var(--c-accent)" }}>{JSON.stringify(v)}</span></div>
                ))}
              </div>
            </div>
          )}
          {result.body && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "var(--c-subtle)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500, marginBottom: 4 }}>Request body</div>
              <JsonView data={result.body} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: "var(--c-subtle)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500, marginBottom: 4 }}>Response body</div>
            <JsonView data={result.response.bodyJson} />
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <Button size="sm" variant="ghost" iconRight="chevron-right" onClick={onOpen}>Abrir endpoint</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== History panel =====
function HistoryPanel({ history, onClear, onShowEndpoint }) {
  return (
    <div style={{ height: "100%", overflow: "auto", padding: 24, background: "var(--c-bg)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Histórico</h1>
            <p style={{ marginTop: 6, fontSize: 14, color: "var(--c-muted)" }}>
              Últimas {history.length} requisições. Persistido em <code style={inlineCode}>localStorage</code>.
            </p>
          </div>
          {history.length > 0 && <Button variant="danger" icon="trash" onClick={onClear}>Limpar histórico</Button>}
        </div>

        {history.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--c-subtle)" }}>
            <Icon name="history" size={32} />
            <div style={{ marginTop: 12, fontSize: 14 }}>Nenhuma requisição ainda. Envie uma para começar.</div>
          </div>
        ) : (
          <div style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10, overflow: "hidden" }}>
            {history.map((h, i) => (
              <div key={h.id} onClick={() => h.endpointId && onShowEndpoint(h.endpointId)} style={{
                display: "grid",
                gridTemplateColumns: "80px 60px 1fr 100px 80px 100px",
                gap: 12, alignItems: "center",
                padding: "10px 16px",
                borderTop: i > 0 ? "1px solid var(--c-border)" : "none",
                cursor: "pointer",
                transition: "background 80ms",
                fontSize: 13,
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--c-surface-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = ""}
              >
                <span className="mono" style={{ fontSize: 11, color: "var(--c-subtle)" }}>{new Date(h.at).toLocaleTimeString("pt-BR")}</span>
                <MethodLabel method={h.method} size="sm" />
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--c-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.path}</code>
                <StatusBadge status={h.status} statusText="" />
                <span style={{ fontSize: 11, color: "var(--c-subtle)" }}>{h.elapsed}ms</span>
                <span style={{ fontSize: 11, color: "var(--c-subtle)", textAlign: "right" }}>{h.endpointName || ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Welcome / Home =====
function WelcomePanel({ baseUrl, token, onLogin, onSelectEndpoint, onShowScenarios }) {
  return (
    <div style={{ height: "100%", overflow: "auto", padding: 32, background: "var(--c-bg)" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{
          padding: 32,
          borderRadius: 14,
          background: "linear-gradient(135deg, #162760, #1f3699 65%, #3a5fd9)",
          color: "#fff",
          overflow: "hidden",
          position: "relative",
        }}>
          <div style={{ position: "relative", zIndex: 2 }}>
            <Badge tone="brand" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 4 }}>SaasClinic · API Console</Badge>
            <h1 style={{ marginTop: 14, fontSize: 30, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1.15 }}>
              Demonstre o consumo das APIs<br />sem sair do navegador.
            </h1>
            <p style={{ marginTop: 12, fontSize: 14.5, opacity: 0.85, maxWidth: 560, lineHeight: 1.55 }}>
              Console estilo Postman/Insomnia conectado direto ao API Gateway da clínica. Faça login, dispare endpoints,
              veja a resposta estruturada do <code style={{ fontFamily: "var(--font-mono)", background: "rgba(0,0,0,0.2)", padding: "1px 6px", borderRadius: 4 }}>ApiResponse&lt;T&gt;</code>,
              copie o cURL equivalente e rode cenários ponta-a-ponta.
            </p>
            <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!token && <Button variant="primary" icon="lock" size="lg" onClick={onLogin} style={{ background: "#fff", color: "var(--c-accent)", border: "none" }}>Fazer login</Button>}
              <Button variant="ghost" icon="zap" size="lg" onClick={onShowScenarios} style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.4)" }}>Ver cenários rápidos</Button>
            </div>
          </div>
          <svg style={{ position: "absolute", right: -40, top: -30, opacity: 0.08, zIndex: 1 }} width="280" height="280" viewBox="0 0 24 24">
            <path d="M5 4h6.5a4.5 4.5 0 0 1 0 9H8.5V20h-3.5V4z" fill="#fff" />
            <circle cx="17" cy="6.5" r="2.4" fill="#fff" />
          </svg>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Por onde começar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <QuickCard
              title="1. Login"
              desc={token ? "Já autenticado ✓" : "POST /auth/login para receber um JWT"}
              icon="lock"
              onClick={() => onSelectEndpoint("auth.login")}
              done={!!token}
            />
            <QuickCard
              title="2. Listar convênios"
              desc="GET /api/admin/v1/convenios — testa o roteamento via Gateway"
              icon="shield"
              onClick={() => onSelectEndpoint("convenio.list")}
            />
            <QuickCard
              title="3. Criar agendamento"
              desc="POST /api/agendamentos/v1/agendamentos — Feign valida paciente e médico"
              icon="calendar"
              onClick={() => onSelectEndpoint("agendamento.create")}
            />
            <QuickCard
              title="4. Cenário ponta-a-ponta"
              desc="Roda fluxo completo: login → cadastros → agendamento → atendimento"
              icon="zap"
              onClick={onShowScenarios}
            />
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
            Microsserviços
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {SERVICES.map(svc => {
              const count = ENDPOINTS.filter(e => e.service === svc.id).length;
              return (
                <div key={svc.id} style={{
                  padding: 16, background: "var(--c-surface)",
                  border: "1px solid var(--c-border)", borderRadius: 10,
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 8,
                    background: `color-mix(in srgb, ${svc.color} 14%, transparent)`,
                    color: svc.color,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}><Icon name={svc.icon} size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{svc.name}</div>
                    <div style={{ fontSize: 12, color: "var(--c-muted)" }}>{count} endpoints · porta {svc.port}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 28, padding: 16, background: "var(--c-surface)", border: "1px solid var(--c-border)", borderRadius: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
            <Icon name="globe" size={15} color="var(--c-muted)" /> Base URL
          </div>
          <div style={{ fontSize: 13, color: "var(--c-muted)", lineHeight: 1.6 }}>
            Configurada para <code style={inlineCode}>{baseUrl}</code> — você pode alterar no topo da página.
            Em dev local, suba o backend com:
            <pre className="mono" style={{
              marginTop: 8, padding: 10,
              background: "var(--c-code-bg)", color: "#e3e6f0",
              borderRadius: 6, fontSize: 12, overflow: "auto",
            }}>{`# 1. Sobe MySQL + microsserviços + gateway
docker compose up -d

# 2. Verifica que está respondendo
curl http://localhost:8080/actuator/health`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickCard({ title, desc, icon, onClick, done }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: 16,
      background: "var(--c-surface)",
      border: "1px solid var(--c-border)",
      borderRadius: 10, cursor: "pointer",
      transition: "border-color 100ms, box-shadow 100ms",
      display: "flex", flexDirection: "column", gap: 10,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--c-accent-border)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--c-border)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--c-accent-soft)", color: "var(--c-accent)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}><Icon name={icon} size={15} /></div>
        {done && <Badge tone="success" size="sm">Pronto</Badge>}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--c-muted)", marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </button>
  );
}

// ===== Root =====
function ConsoleApp() {
  // env é a única fonte de verdade para qual gateway atender.
  // baseUrl é derivado via ENVIRONMENTS[env].baseUrl.
  const [env, setEnv] = useLocalStorage("api-console-env", "hom");
  const baseUrl = (window.ENVIRONMENTS[env] || window.ENVIRONMENTS.hom).baseUrl;

  // Tokens são por-ambiente: o JWT_SECRET de hom não bate em prod e vice-versa.
  // Guardamos um mapa { hom: tokenA, prod: tokenB } pra não precisar relogar a cada switch.
  const [tokensByEnv, setTokensByEnv] = useLocalStorage("api-console-tokens", {});
  const token = tokensByEnv[env] || null;
  const setToken = (next) => setTokensByEnv(prev => ({ ...prev, [env]: next }));

  const [history, setHistory] = useLocalStorage("api-console-history", []);
  const [theme, setTheme] = useLocalStorage("api-console-theme", "light");
  const [activeTab, setActiveTab] = React.useState("welcome"); // welcome | endpoint | scenarios | history
  const [selectedEndpointId, setSelectedEndpointId] = React.useState(null);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [toasts, setToasts] = React.useState([]);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const user = token ? decodeJwt(token) : null;

  const pushToast = (msg, kind = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const pushHistory = (endpoint, response) => {
    setHistory(h => [{
      id: Math.random().toString(36).slice(2),
      at: Date.now(),
      method: endpoint.method,
      path: response.requestUrl.replace(baseUrl.replace(/\/$/, ""), ""),
      status: response.status,
      elapsed: response.elapsed,
      endpointId: endpoint.id,
      endpointName: endpoint.name,
    }, ...h].slice(0, 50));
  };

  const handleLogin = (newToken, data) => {
    setToken(newToken);
    pushToast(`Autenticado como ${data.email || ""} (${data.role || "?"})`, "success");
  };

  const handleSelectEndpoint = (id) => {
    setSelectedEndpointId(id);
    setActiveTab("endpoint");
  };

  const selectedEndpoint = ENDPOINTS.find(e => e.id === selectedEndpointId);

  const handleEnvChange = (nextEnv) => {
    if (nextEnv === env) return;
    setEnv(nextEnv);
    const e = window.ENVIRONMENTS[nextEnv];
    const hasTokenForNext = !!tokensByEnv[nextEnv];
    pushToast(
      hasTokenForNext
        ? `Ambiente: ${e.longLabel} — token reaproveitado`
        : `Ambiente: ${e.longLabel} — faça login (tokens são por-ambiente)`,
      hasTokenForNext ? "success" : "info"
    );
  };

  return (
    <div className="app-shell">
      <Topbar
        env={env} onEnvChange={handleEnvChange}
        token={token} user={user}
        onLogin={() => setLoginOpen(true)}
        onLogout={() => { setToken(null); pushToast("Sessão encerrada", "info"); }}
        theme={theme}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
      />

      <Sidebar
        selectedEndpointId={selectedEndpointId}
        onSelect={handleSelectEndpoint}
        scenariosCount={SCENARIOS.length}
        onShowScenarios={() => setActiveTab("scenarios")}
        onShowHistory={() => setActiveTab("history")}
        historyCount={history.length}
        activeTab={activeTab}
      />

      <div className="main">
        {activeTab === "welcome" && (
          <WelcomePanel
            baseUrl={baseUrl}
            token={token}
            onLogin={() => setLoginOpen(true)}
            onSelectEndpoint={handleSelectEndpoint}
            onShowScenarios={() => setActiveTab("scenarios")}
          />
        )}
        {activeTab === "endpoint" && selectedEndpoint && (
          <EndpointPanel
            endpoint={selectedEndpoint}
            baseUrl={baseUrl}
            token={token}
            onSend={(ep, res) => {
              pushHistory(ep, res);
              if (ep.id === "auth.login" && res.ok && res.bodyJson?.data?.token) {
                setToken(res.bodyJson.data.token);
                pushToast("Token atualizado", "success");
              }
            }}
          />
        )}
        {activeTab === "scenarios" && (
          <ScenariosPanel
            baseUrl={baseUrl} token={token}
            onTokenChange={(t, data) => { setToken(t); pushToast("Token atualizado pelo cenário", "success"); }}
            onPushHistory={pushHistory}
            onShowEndpoint={handleSelectEndpoint}
          />
        )}
        {activeTab === "history" && (
          <HistoryPanel history={history} onClear={() => setHistory([])} onShowEndpoint={handleSelectEndpoint} />
        )}
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} baseUrl={baseUrl} />
      <ToastContainer toasts={toasts} />
    </div>
  );
}

window.ConsoleApp = ConsoleApp;
