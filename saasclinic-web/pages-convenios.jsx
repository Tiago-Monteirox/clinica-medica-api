/* SaasClinic — Convênios CRUD */

function ConveniosPage() {
  const { convenios, api, auth, pushToast } = useApp();
  const writable = can(auth.role, "convenios.write");
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState(null);
  const [statusFilter, setStatusFilter] = React.useState("");

  const filtered = convenios.filter(c => {
    const matchSearch = !search.trim() || c.nome.toLowerCase().includes(search.toLowerCase()) ||
      (c.descricao || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || (statusFilter === "ativo" ? c.ativo : !c.ativo);
    return matchSearch && matchStatus;
  });

  const openNew = () => { setEditing({ nome: "", descricao: "", ativo: true }); setDrawerOpen(true); };
  const openEdit = (item) => { setEditing({ ...item }); setDrawerOpen(true); };

  const save = () => {
    if (!editing.nome.trim()) { pushToast("Informe o nome do convênio", "error"); return; }
    api.convenios.upsert(editing);
    pushToast(editing.id ? "Convênio atualizado" : "Convênio criado", "success");
    setDrawerOpen(false); setEditing(null);
  };

  const del = () => {
    api.convenios.remove(toDelete.id);
    pushToast("Convênio removido", "success");
  };

  const columns = [
    { header: "Nome", cell: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--accent-soft)", color: "var(--accent)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontWeight: 600, fontSize: 12, letterSpacing: 0.5,
        }}>{initials(r.nome)}</div>
        <div>
          <div style={{ fontWeight: 500 }}>{r.nome}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.descricao || "—"}</div>
        </div>
      </div>
    )},
    { header: "Status", width: 110, cell: (r) => r.ativo
      ? <window.Badge tone="success" dot>Ativo</window.Badge>
      : <window.Badge tone="neutral" dot>Inativo</window.Badge> },
    { header: "Criado em", width: 130, nowrap: true, cell: (r) => <span className="mono" style={{ fontSize: 13 }}>{fmtDate(r.criadoEm)}</span> },
    { header: "", width: 100, align: "right", cell: (r) =>
      <window.RowActions onEdit={() => openEdit(r)} onDelete={() => setToDelete(r)} canWrite={writable} /> },
  ];

  return (
    <div>
      <window.PageHeader
        title="Convênios"
        subtitle={`${convenios.length} cadastrados${!writable ? " · acesso somente leitura" : ""}`}
        actions={writable && <window.Button variant="primary" icon="plus" onClick={openNew}>Novo convênio</window.Button>}
      />
      <window.FilterBar search={search} onSearch={setSearch} searchPlaceholder="Buscar por nome ou descrição">
        <div style={{ minWidth: 160 }}>
          <window.Select value={statusFilter} onChange={(v) => setStatusFilter(v || "")} placeholder="Todos os status"
            options={[{ value: "ativo", label: "Ativos" }, { value: "inativo", label: "Inativos" }]} />
        </div>
      </window.FilterBar>
      <window.Table columns={columns} rows={filtered} onRowClick={writable ? openEdit : undefined}
        empty={<window.EmptyState message="Nenhum convênio encontrado" icon="credit" />} />

      <window.Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing?.id ? "Editar convênio" : "Novo convênio"}
        subtitle={editing?.id ? `ID #${editing.id}` : "Cadastre um novo plano de saúde"}
        footer={<>
          <window.Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</window.Button>
          <window.Button variant="primary" onClick={save}>{editing?.id ? "Salvar" : "Criar"}</window.Button>
        </>}
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <window.Field label="Nome" required>
              <window.Input value={editing.nome} onChange={(v) => setEditing({ ...editing, nome: v })} placeholder="Ex: Unimed Nacional" autoFocus />
            </window.Field>
            <window.Field label="Descrição" hint="Categoria ou observação opcional">
              <window.Input value={editing.descricao} onChange={(v) => setEditing({ ...editing, descricao: v })} placeholder="Ex: Plano nacional, cobertura ampla" />
            </window.Field>
            <window.Field label="Status">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={editing.ativo} onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
                  style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
                <span>Convênio ativo</span>
              </label>
            </window.Field>
          </div>
        )}
      </window.Drawer>

      <window.ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={del}
        title="Remover convênio?"
        message={toDelete ? `O convênio "${toDelete.nome}" será removido permanentemente. Pacientes vinculados serão desvinculados.` : ""}
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}

window.ConveniosPage = ConveniosPage;
