/* SaasClinic — Dashboard (4 variations by role) */

function DashboardPage() {
  const { auth } = useApp();
  const roleMap = {
    ADMIN:         <AdminDashboard />,
    RECEPCIONISTA: <RecepDashboard />,
    MEDICO:        <MedicoDashboard />,
    PACIENTE:      <PacienteDashboard />,
  };
  return roleMap[auth.role] || <EmptyState message="Dashboard indisponível" />;
}

// ===== ADMIN =====
function AdminDashboard() {
  const { pacientes, medicos, agendamentos, atendimentos, convenios, usuarios, pushToast, navigate } = useApp();
  const today = ymd(new Date());
  const todayAgs = agendamentos.filter(a => a.dataHora.startsWith(today));
  const todayAt = atendimentos.filter(a => a.dataAtendimento.startsWith(today));
  const realizadosWeek = atendimentos.length;
  const pendingConfirm = agendamentos.filter(a => a.status === "AGENDADO").length;

  return (
    <div>
      <PageHeader
        title={`Boa ${greeting()}, Administrador`}
        subtitle={`Visão geral do dia · ${fmtDateLong(new Date().toISOString())}`}
        actions={
          <>
            <Button icon="refresh" onClick={() => pushToast("Dados atualizados", "success")}>Atualizar</Button>
            <Button variant="primary" icon="plus" onClick={() => navigate("/agendamentos")}>Novo agendamento</Button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Pacientes" value={pacientes.length} icon="users" hint="cadastrados" trend={6} />
        <StatCard label="Médicos"   value={medicos.length}   icon="stethoscope" hint="ativos" />
        <StatCard label="Agendamentos hoje" value={todayAgs.length} icon="calendar" hint={`${pendingConfirm} aguardam confirmação`} />
        <StatCard label="Atendimentos hoje" value={todayAt.length} icon="clipboard" hint={`${realizadosWeek} no total da base`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Próximos agendamentos */}
        <Card padding={0}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Próximos agendamentos</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Hoje · {todayAgs.length} consultas</div>
            </div>
            <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => navigate("/agendamentos")}>Ver agenda</Button>
          </div>
          <UpcomingTable items={todayAgs.slice(0, 6)} />
        </Card>

        {/* Alertas */}
        <Card padding={0}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Alertas</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Itens que pedem atenção</div>
          </div>
          <div style={{ padding: "8px 8px 12px" }}>
            <AlertItem icon="warning" tone="warning" title={`${pendingConfirm} agendamentos aguardam confirmação`} desc="Recepção pode ligar para confirmar." />
            <AlertItem icon="clipboard" tone="info" title="3 atendimentos não registrados" desc="Consultas realizadas sem prontuário." />
            <AlertItem icon="users" tone="brand" title="2 novos pacientes cadastrados hoje" desc="Por Renata Oliveira (recepção)." />
            <AlertItem icon="shield" tone="success" title="Todos os serviços operacionais" desc="Gateway, administrativo, agendamento e atendimento OK." />
          </div>
        </Card>
      </div>

      {/* Quick navigate */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Acesso rápido
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { label: "Convênios", count: convenios.length, icon: "credit", to: "/convenios" },
            { label: "Médicos", count: medicos.length, icon: "stethoscope", to: "/medicos" },
            { label: "Pacientes", count: pacientes.length, icon: "users", to: "/pacientes" },
            { label: "Usuários", count: usuarios.length, icon: "shield", to: "/usuarios" },
          ].map(q => (
            <Card key={q.to} padding={16} hover style={{ cursor: "pointer" }} >
              <div onClick={() => navigate(q.to)} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "var(--accent-soft)", color: "var(--accent)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}><Icon name={q.icon} size={18} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{q.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{q.count} registros</div>
                </div>
                <Icon name="chevron-right" size={16} color="var(--text-subtle)" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== RECEPCIONISTA =====
function RecepDashboard() {
  const { agendamentos, pushToast, navigate } = useApp();
  const today = ymd(new Date());
  const tomorrow = ymd(addDays(new Date(), 1));
  const todayAgs = agendamentos.filter(a => a.dataHora.startsWith(today));
  const tomorrowAgs = agendamentos.filter(a => a.dataHora.startsWith(tomorrow));
  const pendingConfirm = agendamentos.filter(a => a.status === "AGENDADO");

  return (
    <div>
      <PageHeader
        title="Recepção · agenda do dia"
        subtitle={fmtDateLong(new Date().toISOString())}
        actions={
          <Button variant="primary" icon="plus" onClick={() => navigate("/agendamentos")}>Novo agendamento</Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Hoje" value={todayAgs.length} hint="agendamentos do dia" icon="calendar" />
        <StatCard label="Amanhã" value={tomorrowAgs.length} hint="já agendados" icon="clock" />
        <StatCard label="A confirmar" value={pendingConfirm.length} hint="ligações pendentes" icon="phone" color="var(--warning-bg)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        <Card padding={0}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Agenda de hoje</div>
            <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => navigate("/agendamentos")}>Ver tudo</Button>
          </div>
          <UpcomingTable items={todayAgs} />
        </Card>

        <Card padding={0}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Para confirmar</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Ligar com 24h de antecedência</div>
          </div>
          <div style={{ padding: 8, display: "flex", flexDirection: "column" }}>
            {pendingConfirm.slice(0, 5).map(a => <ConfirmCallItem key={a.id} ag={a} />)}
            {pendingConfirm.length === 0 && <EmptyState message="Nada pendente" />}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ===== MEDICO =====
function MedicoDashboard() {
  const { auth, agendamentos, lookup, navigate } = useApp();
  const myMedicoId = auth.linkedId;
  const today = ymd(new Date());
  const todayMine = agendamentos
    .filter(a => a.medicoId === myMedicoId && a.dataHora.startsWith(today) && a.status !== "CANCELADO")
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  const nextOne = todayMine.find(a => !isAgendamentoEncerrado(a.status));
  const totalWeek = agendamentos.filter(a => a.medicoId === myMedicoId && a.status !== "CANCELADO").length;
  const realized = agendamentos.filter(a => a.medicoId === myMedicoId && isAgendamentoEncerrado(a.status)).length;

  return (
    <div>
      <PageHeader
        title={`Boa ${greeting()}, ${auth.nome.split(" ")[0]} ${auth.nome.split(" ")[1] || ""}`}
        subtitle={`${fmtDateLong(new Date().toISOString())} · ${todayMine.length} consultas hoje`}
        actions={
          <Button variant="primary" icon="calendar" onClick={() => navigate("/minha-agenda")}>Ver minha agenda</Button>
        }
      />

      {/* Next patient hero */}
      {nextOne && <NextPatientHero ag={nextOne} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24, marginBottom: 24 }}>
        <StatCard label="Hoje" value={todayMine.length} hint="consultas agendadas" icon="calendar" />
        <StatCard label="Semana" value={totalWeek} hint="total de atendimentos" icon="clipboard" />
        <StatCard label="Já realizados" value={realized} hint="prontuários completos" icon="check" />
      </div>

      <Card padding={0}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Minha agenda — hoje</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Ordem cronológica</div>
          </div>
          <Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => navigate("/minha-agenda")}>Ver semana</Button>
        </div>
        <UpcomingTable items={todayMine} showRegistrarAtendimento />
      </Card>
    </div>
  );
}

function NextPatientHero({ ag }) {
  const { lookup, navigate } = useApp();
  const paciente = lookup.pacienteById(ag.pacienteId);
  const time = fmtTime(ag.dataHora);
  return (
    <Card padding={0} style={{
      background: "linear-gradient(135deg, var(--brand-700), var(--brand-500))",
      color: "#fff",
      border: "none",
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{ padding: "24px 28px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: 0.85, marginBottom: 16, letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 500 }}>
          <Icon name="clock" size={14} /> Próximo paciente · {time}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Avatar nome={paciente?.nome} cor="rgba(255,255,255,0.18)" size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1 }}>{paciente?.nome}</h2>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85, display: "flex", flexWrap: "wrap", gap: 14 }}>
              <span><Icon name="id" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{paciente?.cpf}</span>
              <span><Icon name="phone" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{paciente?.telefone}</span>
              {ag.observacoes && <span><Icon name="info" size={13} style={{ verticalAlign: -2, marginRight: 4 }} />{ag.observacoes}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={heroButtonStyle("secondary")} onClick={() => navigate("/atendimentos")}>
              <Icon name="clipboard" size={15} /> Registrar atendimento
            </button>
            <button style={heroButtonStyle("primary")} onClick={() => navigate("/minha-agenda")}>
              <Icon name="calendar" size={15} /> Ver agenda
            </button>
          </div>
        </div>
      </div>
      <svg style={{ position: "absolute", right: -40, top: -40, opacity: 0.07 }} width="280" height="280" viewBox="0 0 24 24">
        <path d="M5 4h6.5a4.5 4.5 0 0 1 0 9H8.5V20h-3.5V4z" fill="#fff" />
        <circle cx="17" cy="6.5" r="2.4" fill="#fff" />
      </svg>
    </Card>
  );
}
function heroButtonStyle(kind) {
  return {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "10px 16px",
    border: "1px solid",
    borderRadius: 8,
    fontSize: 13, fontWeight: 500,
    cursor: "pointer",
    background: kind === "primary" ? "#fff" : "transparent",
    color: kind === "primary" ? "var(--brand-700)" : "#fff",
    borderColor: kind === "primary" ? "#fff" : "rgba(255,255,255,0.35)",
    whiteSpace: "nowrap",
  };
}

// ===== PACIENTE =====
function PacienteDashboard() {
  const { auth, agendamentos, lookup, navigate, pushToast } = useApp();
  const myPacienteId = auth.linkedId;
  const mine = agendamentos
    .filter(a => a.pacienteId === myPacienteId)
    .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  const upcoming = mine.filter(a => new Date(a.dataHora) >= new Date() && a.status !== "CANCELADO" && !isAgendamentoEncerrado(a.status));
  const past = mine.filter(a => isAgendamentoEncerrado(a.status));
  const next = upcoming[0];

  return (
    <div>
      <PageHeader
        title={`Olá, ${auth.nome.split(" ")[0]}`}
        subtitle="Seu portal pessoal de atendimento"
      />

      {next ? (
        <Card padding={0} style={{ marginBottom: 20, overflow: "hidden" }}>
          <div style={{
            padding: "10px 20px",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: 12, fontWeight: 500, letterSpacing: 0.4, textTransform: "uppercase",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon name="calendar" size={14} /> Sua próxima consulta
          </div>
          <div style={{ padding: 24, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 42, fontWeight: 600, letterSpacing: -1, lineHeight: 1, fontFamily: "var(--font-display)" }}>{fmtTime(next.dataHora)}</div>
              <div style={{ marginTop: 6, fontSize: 14, color: "var(--text-muted)" }}>{fmtDateLong(next.dataHora)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{lookup.medicoById(next.medicoId)?.nome}</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{lookup.medicoById(next.medicoId)?.especialidade}</div>
              <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <StatusBadge status={next.status} />
                <Badge tone="neutral" dot>Presencial</Badge>
              </div>
              {next.observacoes && (
                <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)", padding: 10, background: "var(--surface-2)", borderRadius: 6 }}>
                  <strong style={{ color: "var(--text)" }}>Observação:</strong> {next.observacoes}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="danger" icon="x" onClick={() => pushToast("Solicitação de cancelamento enviada", "info")}>Cancelar consulta</Button>
              <Button variant="ghost" icon="calendar" onClick={() => navigate("/meus-agendamentos")}>Ver histórico</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding={32} style={{ marginBottom: 20, textAlign: "center" }}>
          <Icon name="calendar" size={28} color="var(--text-subtle)" />
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 500 }}>Nenhum agendamento futuro</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>Entre em contato com a clínica para agendar uma consulta.</div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <StatCard label="Consultas futuras" value={upcoming.length} hint="agendadas" icon="calendar" />
        <StatCard label="Realizadas" value={past.length} hint="histórico" icon="check" />
        <StatCard label="Cancelamentos" value={mine.filter(a => a.status === "CANCELADO").length} hint="total" icon="x" />
      </div>
    </div>
  );
}

// ===== Subcomponents =====

function UpcomingTable({ items, showRegistrarAtendimento }) {
  const { lookup, navigate } = useApp();
  if (!items || items.length === 0) {
    return <EmptyState message="Nada agendado para este período" icon="calendar" />;
  }
  return (
    <div>
      {items.map((a, i) => {
        const paciente = lookup.pacienteById(a.pacienteId);
        const medico = lookup.medicoById(a.medicoId);
        return (
          <div key={a.id} style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 1fr 110px 90px",
            alignItems: "center", gap: 16,
            padding: "12px 20px",
            borderTop: i === 0 ? "none" : "1px solid var(--border)",
          }}>
            <div className="mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{fmtTime(a.dataHora)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar nome={paciente?.nome} cor="var(--n-200)" size={28} />
              <div className="truncate" style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{paciente?.nome}</div>
                <div className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>{paciente?.cpf}</div>
              </div>
            </div>
            <div className="truncate" style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 13, color: "var(--text)" }}>{medico?.nome}</div>
              <div className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>{medico?.especialidade}</div>
            </div>
            <StatusBadge status={a.status} size="sm" />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {showRegistrarAtendimento && a.status === "CONFIRMADO" ? (
                <Button size="sm" variant="primary" onClick={() => navigate("/atendimentos")}>Registrar</Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => navigate("/agendamentos")}>Ver</Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmCallItem({ ag }) {
  const { lookup, api, pushToast } = useApp();
  const paciente = lookup.pacienteById(ag.pacienteId);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 6 }}>
      <Avatar nome={paciente?.nome} cor="var(--n-200)" size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate" style={{ fontSize: 13, fontWeight: 500 }}>{paciente?.nome}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtTime(ag.dataHora)} · {paciente?.telefone}</div>
      </div>
      <IconButton icon="phone" label="Ligar" />
      <IconButton icon="check" label="Confirmar" onClick={() => { api.agendamentos.setStatus(ag.id, "CONFIRMADO"); pushToast("Agendamento confirmado", "success"); }} />
    </div>
  );
}

function AlertItem({ icon, tone, title, desc }) {
  const tones = {
    warning: { bg: "var(--warning-bg)", fg: "var(--warning)" },
    info:    { bg: "var(--info-bg)",    fg: "var(--info)"    },
    success: { bg: "var(--success-bg)", fg: "var(--success)" },
    brand:   { bg: "var(--accent-soft)",fg: "var(--accent)"  },
  };
  const t = tones[tone] || tones.info;
  return (
    <div style={{ display: "flex", gap: 12, padding: 12, borderRadius: 6 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: t.bg, color: t.fg,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}><Icon name={icon} size={15} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35 }}>{title}</div>
        <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-muted)" }}>{desc}</div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "manhã";
  if (h < 18) return "tarde";
  return "noite";
}

Object.assign(window, { DashboardPage });
