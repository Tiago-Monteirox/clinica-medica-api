/* SaasClinic — shared CRUD helpers */
function RowActions({ onEdit, onDelete, canWrite }) {
  if (!canWrite) return null;
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
      <window.IconButton icon="edit" label="Editar" onClick={onEdit} />
      <window.IconButton icon="trash" label="Excluir" tone="danger" onClick={onDelete} />
    </div>
  );
}
window.RowActions = RowActions;
