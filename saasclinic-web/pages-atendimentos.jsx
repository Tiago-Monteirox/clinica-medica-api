/* SaasClinic — Atendimentos (registrar + listar) */

function AtendimentosPage() {
  const { auth, atendimentos, agendamentos, lookup, api, pushToast } = useApp();
  const canWrite = can(auth.role, "atendimentos.write");
  const isMedico = auth.role === "MEDICO";
  const myMedicoId = isMedico ? auth.linkedId : null;

  const [search, setSearch] = React.useState("");
  const [period, setPeriod] = React.useState("mes");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [viewing, setViewing] = React.useState(null);

  // Filtros temporais
  const now = new Date();
  const filtered = atendimentos.filter(a => {
    if (isMedico && a.medicoId !== myMedicoId) return false;
    if (search.trim()) {
      const paciente = lookup.pacienteById(a.pacienteId);
      const medico = lookup.medicoById(a.medicoId);
      const hay = `${paciente?.nome} ${medico?.nome} ${a.diagnostico}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    if (period === "hoje" && !a.dataAtendimento.startsWith(ymd(now))) return false;
    if (period === "semana") {
      const start = startOfWeek(now);
      const end = addDays(start, 7);
      const d = new Date(a.dataAtendimento);
      if (d < start || d >= end) return false;
    }
    if (period === "mes") {
      const d = new Date(a.dataAtendimento);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
    }
    return true;
  }).sort((a, b) => b.dataAtendimento.localeCompare(a.dataAtendimento));

  // Para o form: agendamentos CONFIRMADOS sem atendimento ainda
  const elegibleAgs = agendamentos.filter(a =>
    a.status === "CONFIRMADO" &&
    !lookup.atendimentoByAgendamentoId(a.id) &&
    (!isMedico || a.medicoId === myMedicoId)
  ).sort((a, b) => a.dataHora.localeCompare(b.dataHora));

  const openNew = () => {
    const first = elegibleAgs[0];
    setEditing({
      agendamentoId: first?.id || "",
      pacienteId: first?.pacienteId || "",
      medicoId: first?.medicoId || "",
      dataAtendimento: first?.dataHora || isoLocal(new Date()),
      diagnostico: "",
      prescricao: "",
      observacoes: "",
    });
    setDrawerOpen(true);
  };

  const save = () => {
    if (!editing.agendamentoId) { pushToast("Selecione um agendamento", "error"); return; }
    if (!editing.diagnostico.trim()) { pushToast("Diagnóstico é obrigatório", "error"); return; }
    if (!editing.prescricao.trim()) { pushToast("Prescrição é obrigatória", "error"); return; }
    api.atendimentos.upsert({
      ...editing,
      agendamentoId: Number(editing.agendamentoId),
      pacienteId: Number(editing.pacienteId),
      medicoId: Number(editing.medicoId),
    });
    pushToast("Atendimento registrado. O status do agendamento será atualizado pelo RabbitMQ.", "success");
    setDrawerOpen(false); setEditing(null);
  };

  const columns = [
    { header: "Data", width: 140, nowrap: true, cell: (r) => (
      <div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmtDate(r.dataAtendimento)}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtTime(r.dataAtendimento)}</div>
      </div>
    )},
    { header: "Paciente", cell: (r) => {
      const p = lookup.pacienteById(r.pacienteId);
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <window.Avatar nome={p?.nome} cor="var(--n-200)" size={32} />
          <div>
            <div style={{ fontWeight: 500 }}>{p?.nome}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{p?.cpf}</div>
          </div>
        </div>
      );
    }},
    { header: "Médico", cell: (r) => {
      const m = lookup.medicoById(r.medicoId);
      return (
        <div>
          <div style={{ fontSize: 13 }}>{m?.nome}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m?.especialidade}</div>
        </div>
      );
    }},
    { header: "Diagnóstico", cell: (r) => (
      <div className="truncate" style={{ maxWidth: 320, fontSize: 13, color: "var(--text-muted)" }}>{r.diagnostico}</div>
    )},
    { header: "", width: 80, align: "right", cell: (r) =>
      <window.Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => setViewing(r)}>Ver</window.Button> },
  ];

  return (
    <div>
      <window.PageHeader
        title={isMedico ? "Meus atendimentos" : "Atendimentos"}
        subtitle={`${atendimentos.length} prontuários no sistema`}
        actions={canWrite && <window.Button variant="primary" icon="plus" onClick={openNew}>Registrar atendimento</window.Button>}
      />
      <window.FilterBar search={search} onSearch={setSearch} searchPlaceholder="Buscar por paciente, médico ou diagnóstico">
        <div style={{ minWidth: 160 }}>
          <window.Select value={period} onChange={(v) => setPeriod(v || "mes")} placeholder="Período"
            options={[
              { value: "hoje", label: "Hoje" },
              { value: "semana", label: "Esta semana" },
              { value: "mes", label: "Este mês" },
              { value: "tudo", label: "Todo o histórico" },
            ]} />
        </div>
      </window.FilterBar>
      <window.Table columns={columns} rows={filtered} onRowClick={setViewing}
        empty={<window.EmptyState message="Nenhum atendimento neste período" icon="clipboard"
          action={canWrite && <window.Button variant="primary" icon="plus" onClick={openNew}>Registrar atendimento</window.Button>} />} />

      {/* Drawer registrar — full-height two-column form */}
      <window.Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Registrar atendimento"
        subtitle="O agendamento será marcado como Realizado"
        width={720}
        footer={<>
          <window.Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</window.Button>
          <window.Button variant="primary" icon="check" onClick={save}>Registrar</window.Button>
        </>}
      >
        {editing && <AtendimentoForm editing={editing} setEditing={setEditing} elegibleAgs={elegibleAgs} />}
      </window.Drawer>

      {/* View modal */}
      {viewing && <AtendimentoDetailsModal at={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function AtendimentoForm({ editing, setEditing, elegibleAgs }) {
  const { lookup } = useApp();
  const selectedAg = elegibleAgs.find(a => a.id === Number(editing.agendamentoId));
  const paciente = selectedAg ? lookup.pacienteById(selectedAg.pacienteId) : null;
  const medico = selectedAg ? lookup.medicoById(selectedAg.medicoId) : null;
  const conv = paciente?.convenioId ? lookup.convenioById(paciente.convenioId) : null;

  React.useEffect(() => {
    if (selectedAg) {
      setEditing(prev => ({
        ...prev,
        pacienteId: selectedAg.pacienteId,
        medicoId: selectedAg.medicoId,
        dataAtendimento: selectedAg.dataHora,
      }));
    }
  }, [editing.agendamentoId]);

  if (elegibleAgs.length === 0) {
    return (
      <window.EmptyState
        icon="info"
        message="Nenhum agendamento elegível"
        description="Para registrar um atendimento, você precisa de um agendamento com status Confirmado e sem prontuário associado."
      />
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      {/* Left — dados do agendamento (read-only) */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Agendamento
        </div>
        <window.Field label="Selecionar agendamento" required>
          <window.Select value={editing.agendamentoId ? String(editing.agendamentoId) : ""}
            onChange={(v) => setEditing({ ...editing, agendamentoId: v })}
            placeholder="Escolha um agendamento"
            options={elegibleAgs.map(a => {
              const p = lookup.pacienteById(a.pacienteId);
              return { value: String(a.id), label: `${fmtDate(a.dataHora)} ${fmtTime(a.dataHora)} · ${p?.nome}` };
            })} />
        </window.Field>

        {selectedAg && (
          <div style={{ marginTop: 16, padding: 16, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <window.Icon name="clock" size={14} color="var(--text-muted)" />
              <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
                {fmtDate(selectedAg.dataHora)} · {fmtTime(selectedAg.dataHora)}
              </div>
              <div style={{ flex: 1 }} />
              <window.StatusBadge status={selectedAg.status} size="sm" />
            </div>

            <div style={{ paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Paciente</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <window.Avatar nome={paciente?.nome} cor="var(--n-200)" size={32} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{paciente?.nome}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{paciente?.cpf} {conv && <>· {conv.nome}</>}</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Médico</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <window.Avatar nome={medico?.nome} cor={medico?.cor} size={32} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{medico?.nome}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{medico?.especialidade} · {medico?.crm}</div>
                </div>
              </div>
            </div>

            {selectedAg.observacoes && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Observações do agendamento</div>
                <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>{selectedAg.observacoes}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right — prontuário */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
          Prontuário
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <window.Field label="Diagnóstico" required hint="Descrição clínica e CID se aplicável">
            <window.Textarea rows={5} value={editing.diagnostico} onChange={(v) => setEditing({ ...editing, diagnostico: v })}
              placeholder="Ex: Hipertensão arterial estágio 1, controlada. Exame físico sem alterações..." />
          </window.Field>
          <window.Field label="Prescrição" required hint="Medicações, dosagens e instruções">
            <window.Textarea rows={6} value={editing.prescricao} onChange={(v) => setEditing({ ...editing, prescricao: v })}
              placeholder="Ex: Losartana 50mg 1x ao dia. Caminhada 30min 5x/semana. Retorno em 90 dias..." />
          </window.Field>
          <window.Field label="Observações" hint="Opcional · contexto adicional">
            <window.Textarea rows={3} value={editing.observacoes} onChange={(v) => setEditing({ ...editing, observacoes: v })}
              placeholder="Aderência ao tratamento, recomendações..." />
          </window.Field>
        </div>
      </div>
    </div>
  );
}

function AtendimentoDetailsModal({ at, onClose }) {
  const { lookup } = useApp();
  const paciente = lookup.pacienteById(at.pacienteId);
  const medico = lookup.medicoById(at.medicoId);

  return (
    <window.Modal open={true} onClose={onClose} width={620} title={null}
      footer={<window.Button onClick={onClose}>Fechar</window.Button>}
    >
      <div style={{ marginTop: -6 }}>
        <div className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>Atendimento #{at.id}</div>
        <div style={{ marginTop: 4, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>{fmtDateLong(at.dataAtendimento)}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>às {fmtTime(at.dataAtendimento)}</div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Paciente</div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <window.Avatar nome={paciente?.nome} cor="var(--n-200)" size={32} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{paciente?.nome}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{paciente?.cpf}</div>
              </div>
            </div>
          </div>
          <div style={{ padding: 12, background: "var(--surface-2)", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Médico</div>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <window.Avatar nome={medico?.nome} cor={medico?.cor} size={32} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{medico?.nome}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{medico?.especialidade}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Diagnóstico</div>
          <div style={{ marginTop: 6, padding: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, lineHeight: 1.55, color: "var(--text)" }}>
            {at.diagnostico}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Prescrição</div>
          <div style={{ marginTop: 6, padding: 14, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, lineHeight: 1.55, color: "var(--text)", whiteSpace: "pre-wrap" }}>
            {at.prescricao}
          </div>
        </div>

        {at.observacoes && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Observações</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{at.observacoes}</div>
          </div>
        )}
      </div>
    </window.Modal>
  );
}

// ===== Paciente: meus atendimentos =====
function MeusAtendimentosPage() {
  const { auth, atendimentos, lookup } = useApp();
  const myId = auth.linkedId;
  const [viewing, setViewing] = React.useState(null);

  const mine = atendimentos
    .filter(a => a.pacienteId === myId)
    .sort((a, b) => b.dataAtendimento.localeCompare(a.dataAtendimento));

  return (
    <div>
      <window.PageHeader title="Meus atendimentos" subtitle={`${mine.length} consultas com prontuário registrado`} />

      {mine.length === 0 ? (
        <window.Card padding={32} style={{ textAlign: "center" }}>
          <window.Icon name="clipboard" size={28} color="var(--text-subtle)" />
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 500 }}>Nenhum atendimento ainda</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-muted)" }}>Quando seus médicos registrarem suas consultas, elas aparecerão aqui.</div>
        </window.Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mine.map(a => {
            const medico = lookup.medicoById(a.medicoId);
            return (
              <window.Card key={a.id} padding={20} hover>
                <div onClick={() => setViewing(a)}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <window.Avatar nome={medico?.nome} cor={medico?.cor} size={40} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{medico?.nome}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{medico?.especialidade}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      <window.Icon name="calendar" size={14} /> {fmtDate(a.dataAtendimento)}
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>
                    <strong style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>Diagnóstico</strong>
                    {a.diagnostico}
                  </div>
                </div>
              </window.Card>
            );
          })}
        </div>
      )}

      {viewing && <AtendimentoDetailsModal at={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

window.AtendimentosPage = AtendimentosPage;
window.MeusAtendimentosPage = MeusAtendimentosPage;
