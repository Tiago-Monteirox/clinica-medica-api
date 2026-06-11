/* SaasClinic — Pacientes CRUD */

function PacientesPage() {
  const { pacientes, convenios, agendamentos, api, auth, pushToast, navigate } = useApp();
  const writable = can(auth.role, "pacientes.write");
  const [search, setSearch] = React.useState("");
  const [convFilter, setConvFilter] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState(null);

  const filtered = pacientes.filter(p => {
    const matchSearch = !search.trim() ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.cpf.includes(search);
    const matchConv = !convFilter || (convFilter === "sem" ? p.convenioId == null : String(p.convenioId) === convFilter);
    return matchSearch && matchConv;
  });

  const openNew = () => { setEditing({ nome: "", email: "", cpf: "", telefone: "", nascimento: "", convenioId: null }); setDrawerOpen(true); };
  const openEdit = (item) => { setEditing({ ...item }); setDrawerOpen(true); };

  const save = () => {
    if (!editing.nome.trim()) { pushToast("Nome é obrigatório", "error"); return; }
    if (!editing.email.trim()) { pushToast("E-mail é obrigatório", "error"); return; }
    if (!editing.cpf.trim()) { pushToast("CPF é obrigatório", "error"); return; }
    api.pacientes.upsert({ ...editing, convenioId: editing.convenioId ? Number(editing.convenioId) : null });
    pushToast(editing.id ? "Paciente atualizado" : "Paciente cadastrado", "success");
    setDrawerOpen(false); setEditing(null);
  };

  const countConsultas = (pid) => agendamentos.filter(a => a.pacienteId === pid).length;

  const columns = [
    { header: "Nome", cell: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <window.Avatar nome={r.nome} cor="var(--n-200)" size={36} />
        <div>
          <div style={{ fontWeight: 500 }}>{r.nome}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.email}</div>
        </div>
      </div>
    )},
    { header: "CPF", width: 140, nowrap: true, cell: (r) => <span className="mono" style={{ fontSize: 13 }}>{r.cpf}</span> },
    { header: "Telefone", width: 160, nowrap: true, muted: true, cell: (r) => r.telefone || "—" },
    { header: "Convênio", width: 180, cell: (r) => {
      const c = convenios.find(x => x.id === r.convenioId);
      return c ? <window.Badge tone="brand">{c.nome}</window.Badge>
              : <span style={{ color: "var(--text-subtle)", fontSize: 13 }}>Sem plano</span>;
    }},
    { header: "Consultas", width: 110, align: "right", cell: (r) =>
      <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{countConsultas(r.id)}</span> },
    { header: "", width: 100, align: "right", cell: (r) =>
      <window.RowActions onEdit={() => openEdit(r)} onDelete={() => setToDelete(r)} canWrite={writable} /> },
  ];

  return (
    <div>
      <window.PageHeader
        title="Pacientes"
        subtitle={`${pacientes.length} cadastrados${!writable ? " · acesso somente leitura" : ""}`}
        actions={writable && <window.Button variant="primary" icon="plus" onClick={openNew}>Novo paciente</window.Button>}
      />
      <window.FilterBar search={search} onSearch={setSearch} searchPlaceholder="Buscar por nome, e-mail ou CPF">
        <div style={{ minWidth: 200 }}>
          <window.Select value={convFilter} onChange={(v) => setConvFilter(v || "")} placeholder="Todos os convênios"
            options={[
              { value: "sem", label: "Sem convênio" },
              ...convenios.map(c => ({ value: String(c.id), label: c.nome })),
            ]} />
        </div>
        {(search || convFilter) && (
          <window.Button variant="ghost" size="sm" icon="x" onClick={() => { setSearch(""); setConvFilter(""); }}>Limpar</window.Button>
        )}
      </window.FilterBar>
      <window.Table columns={columns} rows={filtered} onRowClick={writable ? openEdit : undefined}
        empty={<window.EmptyState message="Nenhum paciente encontrado" icon="users"
          action={writable && <window.Button variant="primary" icon="plus" onClick={openNew}>Cadastrar paciente</window.Button>} />} />

      <window.Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing?.id ? "Editar paciente" : "Novo paciente"}
        subtitle={editing?.id ? `ID #${editing.id}` : "Cadastre um novo paciente"}
        width={520}
        footer={<>
          <window.Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</window.Button>
          <window.Button variant="primary" onClick={save}>{editing?.id ? "Salvar" : "Criar"}</window.Button>
        </>}
      >
        {editing && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <window.Field label="Nome completo" required span={2}>
              <window.Input value={editing.nome} onChange={(v) => setEditing({ ...editing, nome: v })} placeholder="Maria da Silva" autoFocus />
            </window.Field>
            <window.Field label="E-mail" required span={2}>
              <window.Input type="email" icon="mail" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} placeholder="maria@email.com" />
            </window.Field>
            <window.Field label="CPF" required>
              <window.Input icon="id" value={editing.cpf} onChange={(v) => setEditing({ ...editing, cpf: v })} placeholder="000.000.000-00" />
            </window.Field>
            <window.Field label="Telefone">
              <window.Input icon="phone" value={editing.telefone} onChange={(v) => setEditing({ ...editing, telefone: v })} placeholder="(11) 9 0000-0000" />
            </window.Field>
            <window.Field label="Data de nascimento" span={2}>
              <window.Input type="date" value={editing.nascimento} onChange={(v) => setEditing({ ...editing, nascimento: v })} />
            </window.Field>
            <window.Field label="Convênio" hint="Pacientes podem não ter plano vinculado" span={2}>
              <window.Select value={editing.convenioId ? String(editing.convenioId) : ""}
                onChange={(v) => setEditing({ ...editing, convenioId: v ? Number(v) : null })}
                placeholder="Sem convênio"
                options={convenios.map(c => ({ value: String(c.id), label: c.nome }))} />
            </window.Field>
          </div>
        )}
      </window.Drawer>

      <window.ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { api.pacientes.remove(toDelete.id); pushToast("Paciente removido", "success"); }}
        title="Remover paciente?"
        message={toDelete ? `O paciente "${toDelete.nome}" e seus agendamentos vinculados serão impactados. Esta ação não pode ser desfeita.` : ""}
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}

window.PacientesPage = PacientesPage;
