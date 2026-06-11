/* SaasClinic — Médicos CRUD */

const ESPECIALIDADES = [
  "Cardiologia", "Pediatria", "Clínica Geral", "Dermatologia", "Ortopedia",
  "Ginecologia", "Neurologia", "Oftalmologia", "Psiquiatria", "Endocrinologia",
];

function MedicosPage() {
  const { medicos, agendamentos, api, auth, pushToast } = useApp();
  const writable = can(auth.role, "medicos.write");
  const [search, setSearch] = React.useState("");
  const [espFilter, setEspFilter] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState(null);

  const filtered = medicos.filter(m => {
    const matchSearch = !search.trim() ||
      m.nome.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.crm.toLowerCase().includes(search.toLowerCase());
    const matchEsp = !espFilter || m.especialidade === espFilter;
    return matchSearch && matchEsp;
  });

  const openNew = () => { setEditing({ nome: "", email: "", crm: "", especialidade: "", telefone: "", cor: "#3a5fd9" }); setDrawerOpen(true); };
  const openEdit = (item) => { setEditing({ ...item }); setDrawerOpen(true); };

  const save = () => {
    const errs = [];
    if (!editing.nome.trim()) errs.push("Nome é obrigatório");
    if (!editing.email.trim()) errs.push("E-mail é obrigatório");
    if (!editing.crm.trim()) errs.push("CRM é obrigatório");
    if (!editing.especialidade) errs.push("Especialidade é obrigatória");
    if (errs.length) { pushToast(errs[0], "error"); return; }
    api.medicos.upsert(editing);
    pushToast(editing.id ? "Médico atualizado" : "Médico cadastrado", "success");
    setDrawerOpen(false); setEditing(null);
  };

  const countConsultas = (mid) => agendamentos.filter(a => a.medicoId === mid).length;

  const columns = [
    { header: "Nome", cell: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <window.Avatar nome={r.nome} cor={r.cor} size={36} />
        <div>
          <div style={{ fontWeight: 500 }}>{r.nome}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.email}</div>
        </div>
      </div>
    )},
    { header: "Especialidade", width: 180, cell: (r) =>
      <window.Badge tone="brand">{r.especialidade}</window.Badge> },
    { header: "CRM", width: 130, nowrap: true, cell: (r) => <span className="mono" style={{ fontSize: 13 }}>{r.crm}</span> },
    { header: "Telefone", width: 160, nowrap: true, muted: true, cell: (r) => r.telefone || "—" },
    { header: "Consultas", width: 110, align: "right", cell: (r) =>
      <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{countConsultas(r.id)}</span> },
    { header: "", width: 100, align: "right", cell: (r) =>
      <window.RowActions onEdit={() => openEdit(r)} onDelete={() => setToDelete(r)} canWrite={writable} /> },
  ];

  return (
    <div>
      <window.PageHeader
        title="Médicos"
        subtitle={`${medicos.length} profissionais${!writable ? " · acesso somente leitura" : ""}`}
        actions={writable && <window.Button variant="primary" icon="plus" onClick={openNew}>Novo médico</window.Button>}
      />
      <window.FilterBar search={search} onSearch={setSearch} searchPlaceholder="Buscar por nome, e-mail ou CRM">
        <div style={{ minWidth: 200 }}>
          <window.Select value={espFilter} onChange={(v) => setEspFilter(v || "")} placeholder="Todas especialidades"
            options={ESPECIALIDADES.map(e => ({ value: e, label: e }))} />
        </div>
        {(search || espFilter) && (
          <window.Button variant="ghost" size="sm" icon="x" onClick={() => { setSearch(""); setEspFilter(""); }}>Limpar</window.Button>
        )}
      </window.FilterBar>
      <window.Table columns={columns} rows={filtered} onRowClick={writable ? openEdit : undefined}
        empty={<window.EmptyState message="Nenhum médico encontrado" icon="stethoscope" />} />

      <window.Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing?.id ? "Editar médico" : "Novo médico"}
        subtitle={editing?.id ? `${editing.crm}` : "Cadastre um novo profissional"}
        width={520}
        footer={<>
          <window.Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</window.Button>
          <window.Button variant="primary" onClick={save}>{editing?.id ? "Salvar" : "Criar"}</window.Button>
        </>}
      >
        {editing && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <window.Field label="Nome completo" required span={2}>
              <window.Input value={editing.nome} onChange={(v) => setEditing({ ...editing, nome: v })} placeholder="Dr. João Silva" autoFocus />
            </window.Field>
            <window.Field label="E-mail" required span={2}>
              <window.Input type="email" icon="mail" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} placeholder="joao.silva@saasclinic.com" />
            </window.Field>
            <window.Field label="CRM" required>
              <window.Input value={editing.crm} onChange={(v) => setEditing({ ...editing, crm: v })} placeholder="SP 123.456" />
            </window.Field>
            <window.Field label="Telefone">
              <window.Input icon="phone" value={editing.telefone} onChange={(v) => setEditing({ ...editing, telefone: v })} placeholder="(11) 9 0000-0000" />
            </window.Field>
            <window.Field label="Especialidade" required span={2}>
              <window.Select value={editing.especialidade} onChange={(v) => setEditing({ ...editing, especialidade: v })} placeholder="Selecione"
                options={ESPECIALIDADES.map(e => ({ value: e, label: e }))} />
            </window.Field>
            <window.Field label="Cor do calendário" hint="Aparece nos slots da agenda" span={2}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["#1f3699", "#7a3b8e", "#1f7a64", "#9a6a16", "#a33333", "#2945bf", "#0f6f8a", "#5e2a7d"].map(c => (
                  <button key={c} onClick={() => setEditing({ ...editing, cor: c })}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: c, border: editing.cor === c ? "2px solid var(--text)" : "2px solid transparent",
                      boxShadow: editing.cor === c ? "0 0 0 2px var(--bg)" : "var(--shadow-xs)",
                      cursor: "pointer",
                    }} />
                ))}
              </div>
            </window.Field>
          </div>
        )}
      </window.Drawer>

      <window.ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { api.medicos.remove(toDelete.id); pushToast("Médico removido", "success"); }}
        title="Remover médico?"
        message={toDelete ? `O médico "${toDelete.nome}" será removido. Agendamentos existentes ficarão sem responsável.` : ""}
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}

window.MedicosPage = MedicosPage;
