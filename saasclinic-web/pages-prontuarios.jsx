/* SaasClinic — Prontuários, histórico clínico e documentos */

function ProntuariosPage() {
  const { auth, atendimentos, prontuarios, templatesClinicos, lookup } = useApp();
  const canRead = can(auth.role, "prontuarios.read");
  const isMedico = auth.role === "MEDICO";
  const myMedicoId = isMedico ? auth.linkedId : null;

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [pacienteFilter, setPacienteFilter] = React.useState("");
  const [selectedAtendimento, setSelectedAtendimento] = React.useState(null);

  if (!canRead) return <window.ForbiddenState />;

  const rows = atendimentos
    .filter(at => !isMedico || at.medicoId === myMedicoId)
    .map(at => {
      const prontuario = lookup.prontuarioByAtendimentoId(at.id);
      const paciente = lookup.pacienteById(at.pacienteId);
      const medico = lookup.medicoById(at.medicoId);
      return { ...at, prontuario, paciente, medico, prontuarioStatus: prontuario?.status || "SEM_PRONTUARIO" };
    })
    .filter(row => {
      if (statusFilter && row.prontuarioStatus !== statusFilter) return false;
      if (pacienteFilter && String(row.pacienteId) !== pacienteFilter) return false;
      if (search.trim()) {
        const hay = `${row.paciente?.nome || ""} ${row.medico?.nome || ""} ${row.diagnostico || ""} ${row.prontuario?.resumo || ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => String(b.dataAtendimento).localeCompare(String(a.dataAtendimento)));

  const stats = {
    total: rows.length,
    finalizados: rows.filter(r => r.prontuarioStatus === "FINALIZADO").length,
    rascunhos: rows.filter(r => r.prontuarioStatus === "RASCUNHO").length,
    pendentes: rows.filter(r => r.prontuarioStatus === "SEM_PRONTUARIO").length,
  };

  const columns = [
    { header: "Data", width: 130, nowrap: true, cell: (r) => (
      <div>
        <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{fmtDate(r.dataAtendimento)}</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtTime(r.dataAtendimento)}</div>
      </div>
    )},
    { header: "Paciente", cell: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <window.Avatar nome={r.paciente?.nome} cor="var(--n-200)" size={32} />
        <div>
          <div style={{ fontWeight: 500 }}>{r.paciente?.nome || `Paciente ${r.pacienteId}`}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.paciente?.cpf || "CPF não carregado"}</div>
        </div>
      </div>
    )},
    { header: "Médico", cell: (r) => (
      <div>
        <div style={{ fontSize: 13 }}>{r.medico?.nome || `Médico ${r.medicoId}`}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.medico?.especialidade || "Especialidade não carregada"}</div>
      </div>
    )},
    { header: "Status", width: 130, cell: (r) => <ProntuarioStatusBadge status={r.prontuarioStatus} /> },
    { header: "Resumo", cell: (r) => (
      <div className="truncate" style={{ maxWidth: 360, fontSize: 13, color: "var(--text-muted)" }}>
        {r.prontuario?.resumo || r.diagnostico || "Sem resumo clínico"}
      </div>
    )},
    { header: "", width: 92, align: "right", cell: (r) =>
      <window.Button size="sm" variant="ghost" iconRight="arrow-right" onClick={() => setSelectedAtendimento(r)}>Abrir</window.Button> },
  ];

  return (
    <div>
      <window.PageHeader
        title="Prontuários"
        subtitle={`${stats.total} atendimentos clínicos${isMedico ? " da sua agenda" : ""}`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 20 }}>
        <window.StatCard label="Atendimentos" value={stats.total} icon="clipboard" />
        <window.StatCard label="Finalizados" value={stats.finalizados} icon="check" />
        <window.StatCard label="Rascunhos" value={stats.rascunhos} icon="edit" />
        <window.StatCard label="Pendentes" value={stats.pendentes} icon="warning" />
      </div>

      <window.FilterBar search={search} onSearch={setSearch} searchPlaceholder="Buscar por paciente, médico ou diagnóstico">
        <div style={{ minWidth: 190 }}>
          <window.Select value={statusFilter} onChange={(v) => setStatusFilter(v || "")} placeholder="Todos os status"
            options={[
              { value: "SEM_PRONTUARIO", label: "Sem prontuário" },
              { value: "RASCUNHO", label: "Rascunho" },
              { value: "FINALIZADO", label: "Finalizado" },
            ]} />
        </div>
        <div style={{ minWidth: 240 }}>
          <window.Select value={pacienteFilter} onChange={(v) => setPacienteFilter(v || "")} placeholder="Todos os pacientes"
            options={[...new Map(rows.map(r => [r.pacienteId, r.paciente])).entries()]
              .map(([id, paciente]) => ({ value: String(id), label: paciente?.nome || `Paciente ${id}` }))} />
        </div>
        {(search || statusFilter || pacienteFilter) && (
          <window.Button variant="ghost" size="sm" icon="x" onClick={() => { setSearch(""); setStatusFilter(""); setPacienteFilter(""); }}>Limpar</window.Button>
        )}
      </window.FilterBar>

      <window.Table columns={columns} rows={rows} onRowClick={setSelectedAtendimento}
        empty={<window.EmptyState message="Nenhum prontuário encontrado" icon="clipboard" />} />

      <window.Drawer
        open={!!selectedAtendimento}
        onClose={() => setSelectedAtendimento(null)}
        title={selectedAtendimento ? `Atendimento #${selectedAtendimento.id}` : "Prontuário"}
        subtitle={selectedAtendimento ? `${selectedAtendimento.paciente?.nome || "Paciente"} · ${fmtDateTime(selectedAtendimento.dataAtendimento)}` : ""}
        width={980}
      >
        {selectedAtendimento && (
          <ProntuarioWorkspace
            atendimento={selectedAtendimento}
            templatesClinicos={templatesClinicos}
            onClose={() => setSelectedAtendimento(null)}
          />
        )}
      </window.Drawer>
    </div>
  );
}

function ProntuarioWorkspace({ atendimento, templatesClinicos, onClose }) {
  const { auth, api, lookup, pushToast } = useApp();
  const [activeTab, setActiveTab] = React.useState("prontuario");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [prontuario, setProntuario] = React.useState(() => lookup.prontuarioByAtendimentoId(atendimento.id) || null);
  const [draft, setDraft] = React.useState(() => draftFromAtendimento(atendimento, lookup.prontuarioByAtendimentoId(atendimento.id)));
  const [historico, setHistorico] = React.useState(null);
  const [documentos, setDocumentos] = React.useState([]);

  const paciente = lookup.pacienteById(atendimento.pacienteId);
  const medico = lookup.medicoById(atendimento.medicoId);
  const canEdit = can(auth.role, "prontuarios.write") && prontuario?.status !== "FINALIZADO";
  const hasSavedProntuario = !!prontuario?.id;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const existing = lookup.prontuarioByAtendimentoId(atendimento.id);
    setProntuario(existing || null);
    setDraft(draftFromAtendimento(atendimento, existing));
    Promise.all([
      window.Api.prontuarios.byAtendimento(atendimento.id).catch(err => {
        if (err.status === 404) return null;
        throw err;
      }),
      api.prontuarios.historico(atendimento.pacienteId, true).catch(() => null),
    ]).then(([loadedProntuario, loadedHistorico]) => {
      if (cancelled) return;
      if (loadedProntuario) {
        setProntuario(loadedProntuario);
        setDraft(draftFromAtendimento(atendimento, loadedProntuario));
      }
      setHistorico(loadedHistorico);
    }).catch(err => {
      if (!cancelled) pushToast(`Falha ao carregar prontuário: ${err.message}`, "error");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [atendimento.id]);

  React.useEffect(() => {
    if (!prontuario?.id) {
      setDocumentos([]);
      return;
    }
    let cancelled = false;
    api.documentosClinicos.byProntuario(prontuario.id)
      .then(list => { if (!cancelled) setDocumentos(list || []); })
      .catch(() => { if (!cancelled) setDocumentos([]); });
    return () => { cancelled = true; };
  }, [prontuario?.id]);

  const saveDraft = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const saved = await api.prontuarios.save(atendimento.id, draft);
      setProntuario(saved);
      setDraft(draftFromAtendimento(atendimento, saved));
      pushToast("Prontuário salvo como rascunho", "success");
    } finally {
      setSaving(false);
    }
  };

  const finalizar = async () => {
    if (!canEdit) return;
    if (!String(draft.resumo || "").trim()) {
      pushToast("Resumo é obrigatório para finalizar", "error");
      return;
    }
    setSaving(true);
    try {
      const base = prontuario?.id ? prontuario : await api.prontuarios.save(atendimento.id, draft);
      const finalizado = await api.prontuarios.finalizar(base.id, { resumo: draft.resumo });
      setProntuario(finalizado);
      setDraft(draftFromAtendimento(atendimento, finalizado));
      setHistorico(await api.prontuarios.historico(atendimento.pacienteId, true).catch(() => historico));
      pushToast("Prontuário finalizado", "success");
    } finally {
      setSaving(false);
    }
  };

  const onDocumentoEmitido = async (documento) => {
    setDocumentos(prev => [documento, ...prev.filter(item => item.id !== documento.id)]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12 }}>
        <MiniInfo label="Paciente" title={paciente?.nome || `Paciente ${atendimento.pacienteId}`} subtitle={paciente?.cpf || "CPF não carregado"} />
        <MiniInfo label="Médico" title={medico?.nome || `Médico ${atendimento.medicoId}`} subtitle={medico?.especialidade || medico?.crm || "Médico"} />
        <div style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>Status</div>
          <div style={{ marginTop: 8 }}><ProntuarioStatusBadge status={prontuario?.status || "SEM_PRONTUARIO"} /></div>
        </div>
      </div>

      <window.Tabs value={activeTab} onChange={setActiveTab} items={[
        { value: "prontuario", label: "Prontuário" },
        { value: "historico", label: "Histórico" },
        { value: "documentos", label: "Documentos" },
      ]} />

      {loading ? (
        <window.Card padding={28}><div style={{ color: "var(--text-muted)", fontSize: 14 }}>Carregando dados clínicos...</div></window.Card>
      ) : activeTab === "prontuario" ? (
        <ProntuarioForm
          draft={draft}
          setDraft={setDraft}
          readOnly={!canEdit}
          canFinalize={canEdit}
          saving={saving}
          onSave={saveDraft}
          onFinalize={finalizar}
          onClose={onClose}
        />
      ) : activeTab === "historico" ? (
        <HistoricoClinicoPanel historico={historico} lookup={lookup} />
      ) : (
        <DocumentosClinicosPanel
          prontuario={prontuario}
          templatesClinicos={templatesClinicos}
          documentos={documentos}
          canEmit={can(auth.role, "documentos.write") && hasSavedProntuario}
          onDocumentoEmitido={onDocumentoEmitido}
        />
      )}
    </div>
  );
}

function ProntuarioForm({ draft, setDraft, readOnly, canFinalize, saving, onSave, onFinalize, onClose }) {
  const update = (key, value) => setDraft({ ...draft, [key]: value });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {readOnly && (
        <div style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 13 }}>
          Prontuário em modo leitura.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <window.Field label="Queixa principal">
          <window.Textarea rows={4} value={draft.queixaPrincipal} onChange={(v) => update("queixaPrincipal", v)} placeholder="Motivo principal da consulta" disabled={readOnly} />
        </window.Field>
        <window.Field label="História da doença atual">
          <window.Textarea rows={4} value={draft.historiaDoencaAtual} onChange={(v) => update("historiaDoencaAtual", v)} placeholder="Evolução, duração e contexto dos sintomas" disabled={readOnly} />
        </window.Field>
        <window.Field label="Resumo" required span={2}>
          <window.Textarea rows={4} value={draft.resumo} onChange={(v) => update("resumo", v)} placeholder="Síntese clínica que será usada no histórico do paciente" disabled={readOnly} />
        </window.Field>
        <window.Field label="Diagnóstico">
          <window.Textarea rows={4} value={draft.diagnostico} onChange={(v) => update("diagnostico", v)} placeholder="Diagnóstico clínico e CID se aplicável" disabled={readOnly} />
        </window.Field>
        <window.Field label="Conduta">
          <window.Textarea rows={4} value={draft.conduta} onChange={(v) => update("conduta", v)} placeholder="Plano terapêutico, exames e orientações" disabled={readOnly} />
        </window.Field>
        <window.Field label="Prescrição">
          <window.Textarea rows={5} value={draft.prescricao} onChange={(v) => update("prescricao", v)} placeholder="Medicações, doses e frequência" disabled={readOnly} />
        </window.Field>
        <window.Field label="Observações">
          <window.Textarea rows={5} value={draft.observacoes} onChange={(v) => update("observacoes", v)} placeholder="Observações adicionais" disabled={readOnly} />
        </window.Field>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
        <window.Button variant="ghost" onClick={onClose}>Fechar</window.Button>
        {!readOnly && <window.Button onClick={onSave} loading={saving}>Salvar rascunho</window.Button>}
        {canFinalize && <window.Button variant="primary" icon="check" onClick={onFinalize} loading={saving}>Finalizar</window.Button>}
      </div>
    </div>
  );
}

function HistoricoClinicoPanel({ historico, lookup }) {
  const itens = historico?.itens || [];
  if (!historico) {
    return <window.EmptyState icon="info" message="Histórico indisponível" />;
  }
  if (itens.length === 0) {
    return <window.EmptyState icon="clipboard" message="Paciente sem histórico finalizado" />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {itens.map(item => {
        const medico = lookup.medicoById(item.medicoId);
        return (
          <window.Card key={item.prontuarioId} padding={16}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
              <div>
                <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtDateTime(item.dataAtendimento)}</div>
                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600 }}>{medico?.nome || `Médico ${item.medicoId}`}</div>
              </div>
              <ProntuarioStatusBadge status={item.status} />
            </div>
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <ClinicalTextBlock label="Resumo" text={item.resumo} />
              <ClinicalTextBlock label="Diagnóstico" text={item.diagnostico} />
              <ClinicalTextBlock label="Conduta" text={item.conduta} />
              <ClinicalTextBlock label="Prescrição" text={item.prescricao} />
            </div>
          </window.Card>
        );
      })}
    </div>
  );
}

function DocumentosClinicosPanel({ prontuario, templatesClinicos, documentos, canEmit, onDocumentoEmitido }) {
  const { api, pushToast } = useApp();
  const [templateCodigo, setTemplateCodigo] = React.useState("");
  const [extras, setExtras] = React.useState({
    orientacoes: "",
    cid: "",
    diasAfastamento: "",
    dataInicioAfastamento: "",
    observacoes: "",
    exames: "",
  });
  const [preview, setPreview] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!templateCodigo && templatesClinicos.length > 0) {
      setTemplateCodigo(templatesClinicos[0].codigo);
    }
  }, [templatesClinicos.length]);

  if (!prontuario?.id) {
    return <window.EmptyState icon="info" message="Salve o prontuário antes de emitir documentos" />;
  }

  const payload = () => ({
    prontuarioId: prontuario.id,
    templateCodigo,
    dadosComplementares: {
      documento: {
        orientacoes: extras.orientacoes,
        cid: extras.cid,
        diasAfastamento: extras.diasAfastamento,
        dataInicioAfastamento: extras.dataInicioAfastamento,
        observacoes: extras.observacoes,
        exames: extras.exames.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
          const [nome, justificativa = ""] = line.split(" - ");
          return { nome, justificativa };
        }),
      },
    },
  });

  const gerarPreview = async () => {
    if (!templateCodigo) { pushToast("Selecione um template", "error"); return; }
    setLoading(true);
    try {
      setPreview(await api.documentosClinicos.preview(payload()));
    } finally {
      setLoading(false);
    }
  };

  const emitir = async () => {
    if (!templateCodigo) { pushToast("Selecione um template", "error"); return; }
    setLoading(true);
    try {
      const documento = await api.documentosClinicos.create(payload());
      onDocumentoEmitido(documento);
      setPreview(documento);
      pushToast("Documento clínico emitido", "success");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <window.Field label="Template">
          <window.Select value={templateCodigo} onChange={(v) => { setTemplateCodigo(v || ""); setPreview(null); }} placeholder="Selecionar template"
            options={templatesClinicos.map(t => ({ value: t.codigo, label: `${t.nome} · v${t.versao}` }))} />
        </window.Field>
        <window.Field label="Orientações">
          <window.Textarea rows={3} value={extras.orientacoes} onChange={(v) => setExtras({ ...extras, orientacoes: v })} placeholder="Orientações adicionais para prescrição" />
        </window.Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <window.Field label="CID">
            <window.Input value={extras.cid} onChange={(v) => setExtras({ ...extras, cid: v })} placeholder="J00" />
          </window.Field>
          <window.Field label="Dias">
            <window.Input value={extras.diasAfastamento} onChange={(v) => setExtras({ ...extras, diasAfastamento: v })} placeholder="3" />
          </window.Field>
        </div>
        <window.Field label="Início afastamento">
          <window.Input type="date" value={extras.dataInicioAfastamento} onChange={(v) => setExtras({ ...extras, dataInicioAfastamento: v })} />
        </window.Field>
        <window.Field label="Exames">
          <window.Textarea rows={3} value={extras.exames} onChange={(v) => setExtras({ ...extras, exames: v })} placeholder="Hemograma - investigação inicial" />
        </window.Field>
        <window.Field label="Observações do documento">
          <window.Textarea rows={3} value={extras.observacoes} onChange={(v) => setExtras({ ...extras, observacoes: v })} placeholder="Observações complementares" />
        </window.Field>
        <div style={{ display: "flex", gap: 8 }}>
          <window.Button onClick={gerarPreview} loading={loading}>Preview</window.Button>
          <window.Button variant="primary" icon="check" onClick={emitir} loading={loading} disabled={!canEmit}>Emitir</window.Button>
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Emitidos</div>
          {documentos.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum documento emitido.</div>
          ) : documentos.map(doc => (
            <div key={doc.id} style={{ padding: "9px 0", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{doc.templateCodigo}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{doc.emitidoEm ? fmtDateTime(doc.emitidoEm) : "Emitido"}</div>
            </div>
          ))}
        </div>
      </div>

      <window.Card padding={0}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Preview</div>
          {preview && <window.Badge tone={preview.status === "EMITIDO" ? "success" : "neutral"}>{preview.status}</window.Badge>}
        </div>
        <pre style={{
          margin: 0,
          minHeight: 460,
          maxHeight: 560,
          overflow: "auto",
          padding: 18,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.55,
          color: "var(--text)",
          whiteSpace: "pre-wrap",
        }}>{preview?.conteudoMarkdown || "Gere um preview para visualizar o documento."}</pre>
      </window.Card>
    </div>
  );
}

function MiniInfo({ label, title, subtitle }) {
  return (
    <div style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ marginTop: 2, fontSize: 12, color: "var(--text-muted)" }}>{subtitle}</div>
    </div>
  );
}

function ClinicalTextBlock({ label, text }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 5, fontSize: 13, lineHeight: 1.5, color: text ? "var(--text)" : "var(--text-subtle)", whiteSpace: "pre-wrap" }}>
        {text || "—"}
      </div>
    </div>
  );
}

function ProntuarioStatusBadge({ status }) {
  const map = {
    SEM_PRONTUARIO: { tone: "neutral", label: "Sem prontuário" },
    RASCUNHO: { tone: "warning", label: "Rascunho" },
    FINALIZADO: { tone: "success", label: "Finalizado" },
    RETIFICADO: { tone: "brand", label: "Retificado" },
  };
  const item = map[status] || { tone: "neutral", label: status || "—" };
  return <window.Badge tone={item.tone} dot>{item.label}</window.Badge>;
}

function draftFromAtendimento(atendimento, prontuario) {
  return {
    queixaPrincipal: prontuario?.queixaPrincipal || "",
    historiaDoencaAtual: prontuario?.historiaDoencaAtual || "",
    resumo: prontuario?.resumo || "",
    diagnostico: prontuario?.diagnostico ?? atendimento?.diagnostico ?? "",
    conduta: prontuario?.conduta || "",
    prescricao: prontuario?.prescricao ?? atendimento?.prescricao ?? "",
    observacoes: prontuario?.observacoes ?? atendimento?.observacoes ?? "",
  };
}

window.ProntuariosPage = ProntuariosPage;
