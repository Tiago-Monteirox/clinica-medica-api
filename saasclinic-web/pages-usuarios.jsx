/* SaasClinic — Usuários CRUD */

const ROLES = [
  { value: "ADMIN", label: "Administrador" },
  { value: "RECEPCIONISTA", label: "Recepcionista" },
  { value: "MEDICO", label: "Médico" },
  { value: "PACIENTE", label: "Paciente" },
];

function UsuariosPage() {
  const { usuarios, api, auth, pushToast, apiMode } = useApp();
  const writable = can(auth.role, "usuarios.write");
  const liveMode = apiMode === "live";
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState(null);

  if (!writable) {
    return (
      <div>
        <window.PageHeader title="Usuários" />
        <window.ForbiddenState />
      </div>
    );
  }

  const filtered = usuarios.filter(u => {
    const matchSearch = !search.trim() || u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const openNew = () => { setEditing({ nome: "", email: "", senha: "", role: "RECEPCIONISTA", ativo: true }); setDrawerOpen(true); };
  const openEdit = (item) => {
    if (liveMode) { pushToast("O backend atual não expõe edição de usuários", "info"); return; }
    setEditing({ ...item, senha: "" }); setDrawerOpen(true);
  };

  const save = () => {
    if (!editing.nome.trim() || !editing.email.trim()) { pushToast("Nome e e-mail são obrigatórios", "error"); return; }
    if (!editing.id && !editing.senha) { pushToast("Defina uma senha inicial", "error"); return; }
    if (editing.id && liveMode) { pushToast("O backend atual não expõe edição de usuários", "info"); return; }
    const toSave = editing.id
      ? { ...editing, senha: undefined }
      : { nome: editing.nome, email: editing.email, senha: editing.senha, role: editing.role };
    if (editing.id) delete toSave.senha;
    api.usuarios.upsert(toSave);
    pushToast(editing.id ? "Usuário atualizado" : "Usuário criado", "success");
    setDrawerOpen(false); setEditing(null);
  };

  const roleTone = { ADMIN: "danger", RECEPCIONISTA: "warning", MEDICO: "brand", PACIENTE: "neutral" };

  const columns = [
    { header: "Nome", cell: (r) => (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <window.Avatar nome={r.nome} cor="var(--n-300)" size={32} />
        <div>
          <div style={{ fontWeight: 500 }}>{r.nome}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.email}</div>
        </div>
      </div>
    )},
    { header: "Perfil", width: 160, cell: (r) => <window.Badge tone={roleTone[r.role]} dot>{r.role}</window.Badge> },
    { header: "Status", width: 110, cell: (r) => r.ativo
      ? <window.Badge tone="success" dot>Ativo</window.Badge>
      : <window.Badge tone="neutral" dot>Bloqueado</window.Badge> },
    { header: "Último acesso", width: 170, nowrap: true, cell: (r) => <span className="mono" style={{ fontSize: 13, color: "var(--text-muted)" }}>{r.ultimoAcesso || "—"}</span> },
    { header: "", width: 140, align: "right", cell: (r) => liveMode
      ? <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>Somente criação</span>
      : <window.RowActions onEdit={() => openEdit(r)} onDelete={() => setToDelete(r)} canWrite={writable} /> },
  ];

  return (
    <div>
      <window.PageHeader
        title="Usuários"
        subtitle={liveMode ? `${usuarios.length} contas cadastradas · edição/exclusão indisponíveis no backend` : `${usuarios.length} contas cadastradas`}
        actions={<window.Button variant="primary" icon="plus" onClick={openNew}>Novo usuário</window.Button>}
      />
      <window.FilterBar search={search} onSearch={setSearch} searchPlaceholder="Buscar por nome ou e-mail">
        <div style={{ minWidth: 200 }}>
          <window.Select value={roleFilter} onChange={(v) => setRoleFilter(v || "")} placeholder="Todos os perfis"
            options={ROLES} />
        </div>
        {(search || roleFilter) && (
          <window.Button variant="ghost" size="sm" icon="x" onClick={() => { setSearch(""); setRoleFilter(""); }}>Limpar</window.Button>
        )}
      </window.FilterBar>
      <window.Table columns={columns} rows={filtered} onRowClick={liveMode ? undefined : openEdit}
        empty={<window.EmptyState message="Nenhum usuário encontrado" icon="shield" />} />

      <window.Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing?.id ? "Editar usuário" : "Novo usuário"}
        subtitle={editing?.id ? `${editing.email}` : "Conceda acesso à plataforma"}
        footer={<>
          <window.Button variant="ghost" onClick={() => setDrawerOpen(false)}>Cancelar</window.Button>
          <window.Button variant="primary" onClick={save}>{editing?.id ? "Salvar" : "Criar"}</window.Button>
        </>}
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <window.Field label="Nome completo" required>
              <window.Input value={editing.nome} onChange={(v) => setEditing({ ...editing, nome: v })} placeholder="Renata Oliveira" autoFocus />
            </window.Field>
            <window.Field label="E-mail" required>
              <window.Input type="email" icon="mail" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} placeholder="renata@saasclinic.com" />
            </window.Field>
            {!editing.id && (
              <window.Field label="Senha inicial" required hint="O usuário será solicitado a trocar no primeiro acesso">
                <window.Input type="password" icon="lock" value={editing.senha} onChange={(v) => setEditing({ ...editing, senha: v })} placeholder="••••••••" />
              </window.Field>
            )}
            <window.Field label="Perfil de acesso" required hint="Define as permissões dentro do sistema">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ROLES.map(r => {
                  const active = editing.role === r.value;
                  return (
                    <button key={r.value} onClick={() => setEditing({ ...editing, role: r.value })}
                      style={{
                        padding: "10px 12px",
                        background: active ? "var(--accent-soft)" : "var(--surface)",
                        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 6, cursor: "pointer",
                        textAlign: "left", fontSize: 13,
                        color: active ? "var(--accent)" : "var(--text)",
                        fontWeight: active ? 500 : 400,
                      }}>
                      {r.label}
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{r.value}</div>
                    </button>
                  );
                })}
              </div>
            </window.Field>
            <window.Field label="Status">
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" checked={editing.ativo} onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
                  style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
                <span>Conta ativa (permitir login)</span>
              </label>
            </window.Field>
          </div>
        )}
      </window.Drawer>

      <window.ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => { api.usuarios.remove(toDelete.id); pushToast("Usuário removido", "success"); }}
        title="Remover usuário?"
        message={toDelete ? `O acesso de "${toDelete.nome}" será revogado. Esta ação não pode ser desfeita.` : ""}
        confirmLabel="Remover"
        danger
      />
    </div>
  );
}

window.UsuariosPage = UsuariosPage;
