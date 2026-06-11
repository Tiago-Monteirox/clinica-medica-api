/* SaasClinic — Agendamentos (calendário semanal estilo Cal.com) */

const SLOT_START_HOUR = 7;   // grade começa às 07:00
const SLOT_END_HOUR = 19;    // termina às 19:00
const SLOT_HEIGHT = 56;      // px por slot de 1h
const PX_PER_MIN = SLOT_HEIGHT / 60;

function AgendamentosPage() {
  const { auth, agendamentos, medicos, lookup, api, pushToast, navigate } = useApp();
  const isMedico = auth.role === "MEDICO";
  const myMedicoId = isMedico ? auth.linkedId : null;
  const writable = can(auth.role, "agendamentos.write");

  // Filters
  const [weekRef, setWeekRef] = React.useState(startOfWeek(new Date()));
  const [medicoFilter, setMedicoFilter] = React.useState(isMedico ? String(myMedicoId) : "");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [view, setView] = React.useState("week"); // week | day | list

  // Drawer state
  const [editing, setEditing] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedAg, setSelectedAg] = React.useState(null);
  const [confirmCancel, setConfirmCancel] = React.useState(null);

  // Hoje na semana exibida
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekRef, i)); // Seg-Sex

  // Filtragem
  const visibleAgs = agendamentos.filter(a => {
    if (medicoFilter && String(a.medicoId) !== medicoFilter) return false;
    if (statusFilter && a.status !== statusFilter) return false;
    return true;
  });

  const goPrev = () => setWeekRef(addDays(weekRef, -7));
  const goNext = () => setWeekRef(addDays(weekRef, 7));
  const goToday = () => setWeekRef(startOfWeek(new Date()));

  const openNew = (preset = {}) => {
    setEditing({
      pacienteId: "", medicoId: isMedico ? myMedicoId : "",
      dataHora: preset.dataHora || isoLocal(new Date()),
      duracaoMin: 60,
      status: "AGENDADO",
      observacoes: "",
    });
    setDrawerOpen(true);
  };

  const onSlotClick = (day, hour) => {
    if (!writable) return;
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    openNew({ dataHora: isoLocal(d) });
  };

  const onEventClick = (a) => { setSelectedAg(a); };

  const save = () => {
    if (!editing.pacienteId || !editing.medicoId) { pushToast("Selecione paciente e médico", "error"); return; }
    if (!editing.dataHora) { pushToast("Defina data e hora", "error"); return; }
    api.agendamentos.upsert({
      ...editing,
      pacienteId: Number(editing.pacienteId),
      medicoId: Number(editing.medicoId),
      duracaoMin: Number(editing.duracaoMin) || 60,
    });
    pushToast(editing.id ? "Agendamento atualizado" : "Agendamento criado", "success");
    setDrawerOpen(false); setEditing(null);
  };

  const isMinhaAgenda = window.useApp && (useApp().route === "/minha-agenda");

  return (
    <div>
      <window.PageHeader
        title={isMinhaAgenda ? "Minha agenda" : "Agendamentos"}
        subtitle={`Semana de ${fmtDateLong(days[0].toISOString())} a ${fmtDate(days[4].toISOString())}`}
        actions={writable && <window.Button variant="primary" icon="plus" onClick={() => openNew()}>Novo agendamento</window.Button>}
      />

      {/* Controles */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <window.Button size="sm" onClick={goToday}>Hoje</window.Button>
          <window.IconButton icon="chevron-left" label="Semana anterior" onClick={goPrev} />
          <window.IconButton icon="chevron-right" label="Próxima semana" onClick={goNext} />
          <div style={{ marginLeft: 8, fontSize: 14, fontWeight: 500 }}>
            {days[0].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} – {days[4].toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!isMedico && (
            <div style={{ minWidth: 220 }}>
              <window.Select value={medicoFilter} onChange={(v) => setMedicoFilter(v || "")} placeholder="Todos os médicos"
                options={medicos.map(m => ({ value: String(m.id), label: m.nome }))} />
            </div>
          )}
          <div style={{ minWidth: 180 }}>
            <window.Select value={statusFilter} onChange={(v) => setStatusFilter(v || "")} placeholder="Todos os status"
              options={[
                { value: "AGENDADO", label: "Agendado" },
                { value: "CONFIRMADO", label: "Confirmado" },
                { value: "REALIZADO", label: "Realizado" },
                { value: "ATENDIDO", label: "Atendido" },
                { value: "CANCELADO", label: "Cancelado" },
              ]} />
          </div>
          <window.Tabs value={view} onChange={setView} items={[
            { value: "week", label: "Semana" },
            { value: "list", label: "Lista" },
          ]} />
        </div>
      </div>

      {/* Vista calendário ou lista */}
      {view === "week"
        ? <WeekGrid days={days} ags={visibleAgs} onSlotClick={onSlotClick} onEventClick={onEventClick} writable={writable} />
        : <AgendaList ags={visibleAgs} onEventClick={onEventClick} />}

      {/* Drawer novo/editar */}
      <window.Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing?.id ? "Editar agendamento" : "Novo agendamento"}
        subtitle={editing?.id ? `#${editing.id}` : "Reserve um horário na agenda"}
        width={520}
        footer={<>
          <window.Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</window.Button>
          <window.Button variant="primary" onClick={save}>{editing?.id ? "Salvar" : "Agendar"}</window.Button>
        </>}
      >
        {editing && <AgendamentoForm editing={editing} setEditing={setEditing} disableMedico={isMedico} />}
      </window.Drawer>

      {/* Detalhes (popover-as-modal) */}
      {selectedAg && (
        <AgendamentoDetailsModal
          ag={selectedAg}
          onClose={() => setSelectedAg(null)}
          onEdit={() => { setEditing({ ...selectedAg }); setSelectedAg(null); setDrawerOpen(true); }}
          onCancel={() => { setConfirmCancel(selectedAg); setSelectedAg(null); }}
          onConfirm={() => { api.agendamentos.setStatus(selectedAg.id, "CONFIRMADO"); pushToast("Confirmado", "success"); setSelectedAg(null); }}
          onRegisterAtendimento={() => { navigate("/atendimentos"); /* will jump */ setSelectedAg(null); }}
        />
      )}

      <window.ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => { api.agendamentos.setStatus(confirmCancel.id, "CANCELADO"); pushToast("Agendamento cancelado", "info"); }}
        title="Cancelar agendamento?"
        message={confirmCancel ? `O agendamento de ${lookup.pacienteById(confirmCancel.pacienteId)?.nome} para ${fmtDateTime(confirmCancel.dataHora)} será cancelado. Esta ação pode ser revertida.` : ""}
        confirmLabel="Cancelar agendamento"
        danger
      />
    </div>
  );
}

// ===== Week grid =====
function WeekGrid({ days, ags, onSlotClick, onEventClick, writable }) {
  const hours = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) hours.push(h);

  const today = ymd(new Date());
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMin - SLOT_START_HOUR * 60) * PX_PER_MIN;
  const showNow = nowMin >= SLOT_START_HOUR * 60 && nowMin <= SLOT_END_HOUR * 60;
  const todayIdx = days.findIndex(d => ymd(d) === today);

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        <div />
        {days.map((d, i) => {
          const isToday = ymd(d) === today;
          return (
            <div key={i} style={{
              padding: "12px 12px 10px",
              borderLeft: "1px solid var(--border)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 500 }}>
                {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(/\.$/, "")}
              </div>
              <div style={{ marginTop: 2, display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, fontWeight: 600, minWidth: 32, height: 32, borderRadius: 999,
                background: isToday ? "var(--accent)" : "transparent",
                color: isToday ? "#fff" : "var(--text)",
                fontFamily: "var(--font-display)",
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `60px repeat(${days.length}, 1fr)`,
        position: "relative",
      }}>
        {/* Hours column */}
        <div style={{ borderRight: "1px solid var(--border)" }}>
          {hours.map(h => (
            <div key={h} style={{
              height: SLOT_HEIGHT, position: "relative",
              fontSize: 11, color: "var(--text-subtle)", textAlign: "right",
              paddingRight: 8, paddingTop: 2,
              fontFeatureSettings: "'tnum'",
            }}>{pad(h)}:00</div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, i) => {
          const dayKey = ymd(d);
          const dayAgs = ags.filter(a => a.dataHora.startsWith(dayKey));
          return (
            <div key={i} style={{
              position: "relative",
              borderLeft: "1px solid var(--border)",
              background: dayKey === today ? "color-mix(in srgb, var(--accent-soft) 40%, transparent)" : "transparent",
            }}>
              {/* Slot rows (clickable) */}
              {hours.map(h => (
                <div key={h}
                  onClick={() => onSlotClick(d, h)}
                  style={{
                    height: SLOT_HEIGHT,
                    borderTop: h === SLOT_START_HOUR ? "none" : "1px solid var(--border)",
                    cursor: writable ? "pointer" : "default",
                    transition: "background 80ms",
                  }}
                  onMouseEnter={(e) => writable && (e.currentTarget.style.background = "color-mix(in srgb, var(--accent-soft) 70%, transparent)")}
                  onMouseLeave={(e) => writable && (e.currentTarget.style.background = "")}
                />
              ))}

              {/* Events overlay */}
              {dayAgs.map(a => <EventBlock key={a.id} ag={a} onClick={() => onEventClick(a)} />)}

              {/* Now indicator */}
              {showNow && i === todayIdx && (
                <div style={{
                  position: "absolute", left: 0, right: 0, top: nowTop,
                  height: 1, background: "var(--danger)", pointerEvents: "none",
                  zIndex: 4,
                }}>
                  <div style={{ position: "absolute", left: -4, top: -4, width: 8, height: 8, borderRadius: 999, background: "var(--danger)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventBlock({ ag, onClick }) {
  const { lookup } = useApp();
  const d = new Date(ag.dataHora);
  const minutes = d.getHours() * 60 + d.getMinutes();
  const top = (minutes - SLOT_START_HOUR * 60) * PX_PER_MIN;
  const height = ag.duracaoMin * PX_PER_MIN - 2;
  const medico = lookup.medicoById(ag.medicoId);
  const paciente = lookup.pacienteById(ag.pacienteId);

  const statusStyles = {
    AGENDADO:   { bg: "var(--info-bg)",    border: "var(--info)",    text: "var(--info)"    },
    CONFIRMADO: { bg: "var(--success-bg)", border: "var(--success)", text: "var(--success)" },
    REALIZADO:  { bg: "var(--accent-soft)",border: "var(--accent)",  text: "var(--accent)"  },
    ATENDIDO:   { bg: "var(--accent-soft)",border: "var(--accent)",  text: "var(--accent)"  },
    CANCELADO:  { bg: "var(--n-100)",      border: "var(--n-300)",   text: "var(--n-500)"   },
  };
  const ss = statusStyles[ag.status] || statusStyles.AGENDADO;
  const isCancelled = ag.status === "CANCELADO";

  return (
    <div onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        position: "absolute",
        top, left: 4, right: 4,
        height,
        background: ss.bg,
        borderLeft: `3px solid ${medico?.cor || ss.border}`,
        borderRadius: 6,
        padding: "6px 8px",
        fontSize: 12,
        cursor: "pointer",
        overflow: "hidden",
        zIndex: 2,
        boxShadow: "var(--shadow-xs)",
        textDecoration: isCancelled ? "line-through" : "none",
        opacity: isCancelled ? 0.6 : 1,
        transition: "transform 80ms, box-shadow 80ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.zIndex = 5; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-xs)"; e.currentTarget.style.zIndex = 2; }}
    >
      <div className="mono" style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", letterSpacing: 0.3 }}>
        {fmtTime(ag.dataHora)} · {ag.duracaoMin}min
      </div>
      <div className="truncate" style={{ marginTop: 2, fontWeight: 500, color: "var(--text)" }}>{paciente?.nome}</div>
      <div className="truncate" style={{ fontSize: 11, color: "var(--text-muted)" }}>{medico?.nome.replace(/^(Dr|Dra)\.\s+/, "")} · {medico?.especialidade}</div>
    </div>
  );
}

// ===== Lista =====
function AgendaList({ ags, onEventClick }) {
  const { lookup } = useApp();
  const sorted = [...ags].sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  const byDay = {};
  for (const a of sorted) {
    const key = a.dataHora.slice(0, 10);
    (byDay[key] ||= []).push(a);
  }

  if (sorted.length === 0) {
    return <window.Card padding={0}><window.EmptyState message="Nenhum agendamento" icon="calendar" /></window.Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {Object.entries(byDay).map(([day, list]) => (
        <div key={day}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            {fmtDateLong(day + "T00:00:00")}
          </div>
          <window.Card padding={0}>
            {list.map((a, i) => {
              const paciente = lookup.pacienteById(a.pacienteId);
              const medico = lookup.medicoById(a.medicoId);
              return (
                <div key={a.id} onClick={() => onEventClick(a)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 1fr 1fr 120px",
                    alignItems: "center", gap: 16,
                    padding: "14px 20px",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    cursor: "pointer",
                    transition: "background 100ms",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}
                >
                  <div className="mono" style={{ fontSize: 14, fontWeight: 500 }}>{fmtTime(a.dataHora)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <window.Avatar nome={paciente?.nome} cor="var(--n-200)" size={28} />
                    <div className="truncate">
                      <div className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>{paciente?.nome}</div>
                      <div className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>{paciente?.cpf}</div>
                    </div>
                  </div>
                  <div className="truncate" style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 13 }}>{medico?.nome}</div>
                    <div className="truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>{medico?.especialidade}</div>
                  </div>
                  <window.StatusBadge status={a.status} size="sm" />
                </div>
              );
            })}
          </window.Card>
        </div>
      ))}
    </div>
  );
}

// ===== Form =====
function AgendamentoForm({ editing, setEditing, disableMedico }) {
  const { medicos, pacientes } = useApp();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <window.Field label="Paciente" required span={2}>
        <window.Select value={editing.pacienteId ? String(editing.pacienteId) : ""}
          onChange={(v) => setEditing({ ...editing, pacienteId: v })}
          placeholder="Buscar paciente..."
          options={pacientes.map(p => ({ value: String(p.id), label: `${p.nome} · ${p.cpf}` }))} />
      </window.Field>
      <window.Field label="Médico" required span={2}>
        <window.Select value={editing.medicoId ? String(editing.medicoId) : ""}
          onChange={(v) => setEditing({ ...editing, medicoId: v })}
          placeholder="Selecionar médico"
          options={medicos.map(m => ({ value: String(m.id), label: `${m.nome} · ${m.especialidade}` }))}
          disabled={disableMedico} />
      </window.Field>
      <window.Field label="Data e hora" required>
        <input type="datetime-local"
          value={editing.dataHora?.slice(0, 16) || ""}
          onChange={(e) => setEditing({ ...editing, dataHora: e.target.value })}
          style={window.inputBase} />
      </window.Field>
      <window.Field label="Duração">
        <window.Select value={String(editing.duracaoMin || 60)} onChange={(v) => setEditing({ ...editing, duracaoMin: Number(v) })}
          options={[
            { value: "30", label: "30 minutos" },
            { value: "45", label: "45 minutos" },
            { value: "60", label: "1 hora" },
            { value: "90", label: "1h 30min" },
            { value: "120", label: "2 horas" },
          ]} />
      </window.Field>
      <window.Field label="Status" span={2}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["AGENDADO", "CONFIRMADO", "ATENDIDO", "CANCELADO"].map(s => {
            const active = editing.status === s;
            return (
              <button key={s} onClick={() => setEditing({ ...editing, status: s })}
                style={{
                  padding: "6px 12px", fontSize: 13,
                  borderRadius: 999,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text)",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                  cursor: "pointer",
                }}>{s}</button>
            );
          })}
        </div>
      </window.Field>
      <window.Field label="Observações" hint="Opcional · contexto adicional" span={2}>
        <window.Textarea value={editing.observacoes} onChange={(v) => setEditing({ ...editing, observacoes: v })}
          rows={3} placeholder="Ex: retorno, primeira consulta, exames recentes..." />
      </window.Field>
    </div>
  );
}

// ===== Details modal =====
function AgendamentoDetailsModal({ ag, onClose, onEdit, onCancel, onConfirm, onRegisterAtendimento }) {
  const { lookup, auth } = useApp();
  const paciente = lookup.pacienteById(ag.pacienteId);
  const medico = lookup.medicoById(ag.medicoId);
  const conv = paciente?.convenioId ? lookup.convenioById(paciente.convenioId) : null;
  const at = lookup.atendimentoByAgendamentoId(ag.id);
  const canEdit = can(auth.role, "agendamentos.write");
  const canRegistrar = auth.role === "MEDICO" && ag.medicoId === auth.linkedId && ag.status === "CONFIRMADO" && !at;
  const canConfirm = canEdit && ag.status === "AGENDADO";
  const canCancel = canEdit && ag.status !== "CANCELADO" && !isAgendamentoEncerrado(ag.status);

  return (
    <window.Modal open={true} onClose={onClose} title={null} width={520}>
      <div>
        <div style={{ marginTop: -12, display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 14, color: "var(--text-muted)" }}>#{ag.id}</div>
          <window.StatusBadge status={ag.status} />
          <div style={{ flex: 1 }} />
          <window.IconButton icon="x" label="Fechar" onClick={onClose} />
        </div>

        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>{fmtTime(ag.dataHora)} · {ag.duracaoMin}min</div>
        <div style={{ marginTop: 4, fontSize: 14, color: "var(--text-muted)" }}>{fmtDateLong(ag.dataHora)}</div>

        <div style={{ marginTop: 20, padding: 14, background: "var(--surface-2)", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Paciente</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <window.Avatar nome={paciente?.nome} cor="var(--n-200)" size={36} />
            <div>
              <div style={{ fontWeight: 500 }}>{paciente?.nome}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {paciente?.cpf} · {paciente?.telefone || "sem telefone"}
                {conv && <> · <span style={{ color: "var(--accent)" }}>{conv.nome}</span></>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 14, background: "var(--surface-2)", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Médico</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <window.Avatar nome={medico?.nome} cor={medico?.cor} size={36} />
            <div>
              <div style={{ fontWeight: 500 }}>{medico?.nome}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{medico?.especialidade} · {medico?.crm}</div>
            </div>
          </div>
        </div>

        {ag.observacoes && (
          <div style={{ marginTop: 12, padding: 14, background: "var(--surface-2)", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Observações</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>{ag.observacoes}</div>
          </div>
        )}

        {at && (
          <div style={{ marginTop: 12, padding: 14, background: "var(--accent-soft)", borderRadius: 8, color: "var(--accent)", display: "flex", alignItems: "center", gap: 10 }}>
            <window.Icon name="clipboard" size={16} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Atendimento registrado nesta consulta</span>
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canConfirm && <window.Button variant="primary" icon="check" onClick={onConfirm}>Confirmar</window.Button>}
          {canRegistrar && <window.Button variant="primary" icon="clipboard" onClick={onRegisterAtendimento}>Registrar atendimento</window.Button>}
          {canEdit && <window.Button icon="edit" onClick={onEdit}>Editar</window.Button>}
          {canCancel && <window.Button variant="danger" icon="x" onClick={onCancel}>Cancelar consulta</window.Button>}
          <div style={{ flex: 1 }} />
          <window.Button variant="ghost" onClick={onClose}>Fechar</window.Button>
        </div>
      </div>
    </window.Modal>
  );
}

// ===== Paciente: meus agendamentos =====
function MeusAgendamentosPage() {
  const { auth, agendamentos, lookup, api, pushToast } = useApp();
  const myId = auth.linkedId;
  const [confirmCancel, setConfirmCancel] = React.useState(null);

  const mine = agendamentos
    .filter(a => a.pacienteId === myId)
    .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  const upcoming = mine.filter(a => new Date(a.dataHora) >= new Date() && a.status !== "CANCELADO" && !isAgendamentoEncerrado(a.status));
  const past = mine.filter(a => new Date(a.dataHora) < new Date() || isAgendamentoEncerrado(a.status) || a.status === "CANCELADO");

  return (
    <div>
      <window.PageHeader title="Meus agendamentos" subtitle={`${mine.length} consultas no histórico`} />

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Próximas ({upcoming.length})
        </div>
        {upcoming.length === 0 ? (
          <window.Card padding={32} style={{ textAlign: "center" }}>
            <window.Icon name="calendar" size={28} color="var(--text-subtle)" />
            <div style={{ marginTop: 10, color: "var(--text-muted)" }}>Você não tem consultas agendadas.</div>
          </window.Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcoming.map(a => {
              const medico = lookup.medicoById(a.medicoId);
              return (
                <window.Card key={a.id} padding={16}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 90 }}>
                      <div className="mono" style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-display)" }}>{fmtTime(a.dataHora)}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(a.dataHora)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 500 }}>{medico?.nome}</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{medico?.especialidade}</div>
                    </div>
                    <window.StatusBadge status={a.status} />
                    <window.Button variant="danger" icon="x" onClick={() => setConfirmCancel(a)}>Cancelar</window.Button>
                  </div>
                </window.Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Histórico ({past.length})
        </div>
        {past.length === 0 ? (
          <window.EmptyState message="Sem histórico de consultas" />
        ) : (
          <window.Card padding={0}>
            {past.map((a, i) => {
              const medico = lookup.medicoById(a.medicoId);
              return (
                <div key={a.id} style={{
                  display: "grid", gridTemplateColumns: "120px 1fr 1fr 120px",
                  alignItems: "center", gap: 16,
                  padding: "12px 16px",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                }}>
                  <div className="mono" style={{ fontSize: 13 }}>{fmtDate(a.dataHora)} {fmtTime(a.dataHora)}</div>
                  <div className="truncate">{medico?.nome}</div>
                  <div className="truncate" style={{ fontSize: 13, color: "var(--text-muted)" }}>{medico?.especialidade}</div>
                  <window.StatusBadge status={a.status} size="sm" />
                </div>
              );
            })}
          </window.Card>
        )}
      </div>

      <window.ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={() => { api.agendamentos.setStatus(confirmCancel.id, "CANCELADO"); pushToast("Agendamento cancelado", "info"); }}
        title="Cancelar consulta?"
        message={confirmCancel ? `Sua consulta de ${fmtDate(confirmCancel.dataHora)} às ${fmtTime(confirmCancel.dataHora)} será cancelada. Entre em contato com a recepção para remarcar.` : ""}
        confirmLabel="Cancelar consulta"
        danger
      />
    </div>
  );
}

window.AgendamentosPage = AgendamentosPage;
window.MeusAgendamentosPage = MeusAgendamentosPage;
