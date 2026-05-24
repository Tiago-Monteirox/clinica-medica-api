/* SaasClinic API Console — endpoint catalog */

// Cada endpoint:
// { id, service, method, path, name, description, roles, public, body, pathParams, defaultBody }

const ENDPOINTS = [
  // ===== AUTH =====
  {
    id: "auth.login",
    service: "auth", method: "POST",
    path: "/auth/login",
    name: "Login",
    description: "Autentica via e-mail/senha. Retorna JWT no campo data.token.",
    roles: [],
    public: true,
    bodyTemplate: { email: "admin@clinica.com", senha: "admin123" },
    bodyHint: "Use admin@clinica.com / admin123 (seed do CommandLineRunner).",
    pathParams: [],
  },
  {
    id: "auth.register",
    service: "auth", method: "POST",
    path: "/auth/register",
    name: "Registrar usuário",
    description: "Cria um novo usuário com role. Apenas ADMIN.",
    roles: ["ADMIN"],
    bodyTemplate: { nome: "Renata Recepção", email: "renata@clinica.com", senha: "senha12345", role: "RECEPCIONISTA" },
    pathParams: [],
  },

  // ===== CONVÊNIOS =====
  {
    id: "convenio.list",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/convenios",
    name: "Listar convênios",
    description: "Lista todos os convênios cadastrados.",
    roles: ["ADMIN", "RECEPCIONISTA"],
    pathParams: [],
  },
  {
    id: "convenio.get",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/convenios/{id}",
    name: "Buscar convênio",
    roles: ["ADMIN", "RECEPCIONISTA"],
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "convenio.create",
    service: "administrativo", method: "POST",
    path: "/api/admin/v1/convenios",
    name: "Criar convênio",
    roles: ["ADMIN"],
    bodyTemplate: { nome: "Unimed Nacional", descricao: "Plano nacional, cobertura ampla" },
    pathParams: [],
  },
  {
    id: "convenio.update",
    service: "administrativo", method: "PUT",
    path: "/api/admin/v1/convenios/{id}",
    name: "Atualizar convênio",
    roles: ["ADMIN"],
    bodyTemplate: { nome: "Unimed Nacional Atualizado", descricao: "Nova descrição" },
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "convenio.delete",
    service: "administrativo", method: "DELETE",
    path: "/api/admin/v1/convenios/{id}",
    name: "Remover convênio",
    roles: ["ADMIN"],
    pathParams: [{ key: "id", default: "1" }],
  },

  // ===== PACIENTES =====
  {
    id: "paciente.list",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/pacientes",
    name: "Listar pacientes",
    roles: ["ADMIN", "RECEPCIONISTA"],
    pathParams: [],
  },
  {
    id: "paciente.get",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/pacientes/{id}",
    name: "Buscar paciente",
    roles: ["ADMIN", "RECEPCIONISTA"],
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "paciente.exists",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/pacientes/{id}/exists",
    name: "Verificar existência (interno)",
    description: "Endpoint público usado pelo serviço Agendamento via Feign.",
    public: true,
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "paciente.create",
    service: "administrativo", method: "POST",
    path: "/api/admin/v1/pacientes",
    name: "Criar paciente",
    roles: ["ADMIN", "RECEPCIONISTA"],
    bodyTemplate: {
      nome: "Ana Costa Silveira",
      email: "ana.costa@email.com",
      cpf: "11122233344",
      telefone: "11991111111",
      dataNascimento: "1988-04-12",
      convenioId: 1
    },
    pathParams: [],
  },
  {
    id: "paciente.update",
    service: "administrativo", method: "PUT",
    path: "/api/admin/v1/pacientes/{id}",
    name: "Atualizar paciente",
    roles: ["ADMIN", "RECEPCIONISTA"],
    bodyTemplate: { telefone: "11999998888", convenioId: 2 },
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "paciente.delete",
    service: "administrativo", method: "DELETE",
    path: "/api/admin/v1/pacientes/{id}",
    name: "Remover paciente",
    roles: ["ADMIN"],
    pathParams: [{ key: "id", default: "1" }],
  },

  // ===== MÉDICOS =====
  {
    id: "medico.list",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/medicos",
    name: "Listar médicos",
    roles: ["ADMIN", "RECEPCIONISTA"],
    pathParams: [],
  },
  {
    id: "medico.get",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/medicos/{id}",
    name: "Buscar médico",
    roles: ["ADMIN", "RECEPCIONISTA"],
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "medico.exists",
    service: "administrativo", method: "GET",
    path: "/api/admin/v1/medicos/{id}/exists",
    name: "Verificar existência (interno)",
    description: "Endpoint público usado pelo serviço Agendamento via Feign.",
    public: true,
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "medico.create",
    service: "administrativo", method: "POST",
    path: "/api/admin/v1/medicos",
    name: "Criar médico",
    roles: ["ADMIN", "RECEPCIONISTA"],
    bodyTemplate: {
      nome: "Dr. Paulo Andrade",
      email: "paulo.andrade@saasclinic.com",
      crm: "CRM/SP 123456",
      especialidade: "Cardiologia",
      telefone: "11988887777"
    },
    pathParams: [],
  },
  {
    id: "medico.update",
    service: "administrativo", method: "PUT",
    path: "/api/admin/v1/medicos/{id}",
    name: "Atualizar médico",
    roles: ["ADMIN", "RECEPCIONISTA"],
    bodyTemplate: { telefone: "11977776666", especialidade: "Cardiologia Clínica" },
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "medico.delete",
    service: "administrativo", method: "DELETE",
    path: "/api/admin/v1/medicos/{id}",
    name: "Remover médico",
    roles: ["ADMIN"],
    pathParams: [{ key: "id", default: "1" }],
  },

  // ===== AGENDAMENTOS =====
  {
    id: "agendamento.list",
    service: "agendamento", method: "GET",
    path: "/api/agendamentos/v1/agendamentos",
    name: "Listar agendamentos",
    roles: ["ADMIN", "RECEPCIONISTA"],
    pathParams: [],
  },
  {
    id: "agendamento.get",
    service: "agendamento", method: "GET",
    path: "/api/agendamentos/v1/agendamentos/{id}",
    name: "Buscar agendamento",
    roles: ["ADMIN", "RECEPCIONISTA", "MEDICO", "PACIENTE"],
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "agendamento.byMedico",
    service: "agendamento", method: "GET",
    path: "/api/agendamentos/v1/agendamentos/medico/{medicoId}",
    name: "Agenda de um médico",
    roles: ["ADMIN", "RECEPCIONISTA", "MEDICO"],
    pathParams: [{ key: "medicoId", default: "1" }],
  },
  {
    id: "agendamento.byPaciente",
    service: "agendamento", method: "GET",
    path: "/api/agendamentos/v1/agendamentos/paciente/{pacienteId}",
    name: "Agenda de um paciente",
    roles: ["ADMIN", "RECEPCIONISTA", "PACIENTE"],
    pathParams: [{ key: "pacienteId", default: "1" }],
  },
  {
    id: "agendamento.create",
    service: "agendamento", method: "POST",
    path: "/api/agendamentos/v1/agendamentos",
    name: "Criar agendamento",
    description: "Valida paciente e médico no administrativo via Feign.",
    roles: ["ADMIN", "RECEPCIONISTA"],
    bodyTemplate: () => ({
      pacienteId: 1,
      medicoId: 1,
      dataHora: nextWeekIso(),
      observacoes: "Consulta de rotina"
    }),
    pathParams: [],
  },
  {
    id: "agendamento.update",
    service: "agendamento", method: "PUT",
    path: "/api/agendamentos/v1/agendamentos/{id}",
    name: "Atualizar agendamento",
    roles: ["ADMIN", "RECEPCIONISTA"],
    bodyTemplate: { status: "CONFIRMADO", observacoes: "Confirmado por telefone" },
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "agendamento.delete",
    service: "agendamento", method: "DELETE",
    path: "/api/agendamentos/v1/agendamentos/{id}",
    name: "Cancelar agendamento",
    roles: ["ADMIN", "RECEPCIONISTA", "PACIENTE"],
    pathParams: [{ key: "id", default: "1" }],
  },

  // ===== ATENDIMENTOS =====
  {
    id: "atendimento.list",
    service: "atendimento", method: "GET",
    path: "/api/atendimentos/v1/atendimentos",
    name: "Listar atendimentos",
    roles: ["ADMIN", "MEDICO", "RECEPCIONISTA"],
    pathParams: [],
  },
  {
    id: "atendimento.get",
    service: "atendimento", method: "GET",
    path: "/api/atendimentos/v1/atendimentos/{id}",
    name: "Buscar atendimento",
    roles: ["ADMIN", "MEDICO", "RECEPCIONISTA"],
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "atendimento.byPaciente",
    service: "atendimento", method: "GET",
    path: "/api/atendimentos/v1/atendimentos/paciente/{pacienteId}",
    name: "Atendimentos de um paciente",
    roles: ["ADMIN", "MEDICO", "PACIENTE"],
    pathParams: [{ key: "pacienteId", default: "1" }],
  },
  {
    id: "atendimento.byMedico",
    service: "atendimento", method: "GET",
    path: "/api/atendimentos/v1/atendimentos/medico/{medicoId}",
    name: "Atendimentos de um médico",
    roles: ["ADMIN", "MEDICO"],
    pathParams: [{ key: "medicoId", default: "1" }],
  },
  {
    id: "atendimento.create",
    service: "atendimento", method: "POST",
    path: "/api/atendimentos/v1/atendimentos",
    name: "Registrar atendimento",
    description: "Busca agendamento via Feign para obter paciente e médico.",
    roles: ["MEDICO"],
    bodyTemplate: {
      agendamentoId: 1,
      diagnostico: "Hipertensão arterial estágio 1, controlada.",
      prescricao: "Losartana 50mg 1x ao dia. Retorno em 90 dias.",
      observacoes: "Paciente aderente ao tratamento."
    },
    pathParams: [],
  },
  {
    id: "atendimento.update",
    service: "atendimento", method: "PUT",
    path: "/api/atendimentos/v1/atendimentos/{id}",
    name: "Atualizar atendimento",
    roles: ["MEDICO"],
    bodyTemplate: { observacoes: "Atualizado em revisão clínica." },
    pathParams: [{ key: "id", default: "1" }],
  },
  {
    id: "atendimento.delete",
    service: "atendimento", method: "DELETE",
    path: "/api/atendimentos/v1/atendimentos/{id}",
    name: "Remover atendimento",
    roles: ["ADMIN"],
    pathParams: [{ key: "id", default: "1" }],
  },
];

const SERVICES = [
  { id: "auth",           name: "Autenticação", icon: "lock",        port: 8081, color: "#9a6a16" },
  { id: "administrativo", name: "Administrativo", icon: "shield",    port: 8081, color: "#1f3699" },
  { id: "agendamento",    name: "Agendamento",  icon: "calendar",    port: 8082, color: "#1f7a64" },
  { id: "atendimento",    name: "Atendimento",  icon: "clipboard",   port: 8083, color: "#7a3b8e" },
];

// helper: agendamento dataHora padrão = próxima segunda 14:00
function nextWeekIso() {
  const d = new Date();
  d.setDate(d.getDate() + (8 - d.getDay()) % 7 + 1);
  d.setHours(14, 0, 0, 0);
  // Backend espera LocalDateTime: "2026-06-15T14:00:00"
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

// Quick scenarios — runs a sequence of requests to demonstrate the full flow
const SCENARIOS = [
  {
    id: "smoke",
    name: "Smoke test — verificar que tudo está no ar",
    description: "Login → lista convênios → lista médicos. Bom primeiro passo para validar que o Gateway está roteando.",
    steps: [
      { endpoint: "auth.login", body: { email: "admin@clinica.com", senha: "admin123" }, captureToken: true },
      { endpoint: "convenio.list" },
      { endpoint: "medico.list" },
      { endpoint: "paciente.list" },
    ],
  },
  {
    id: "happy-path",
    name: "Caminho feliz — cadastro completo",
    description: "Login → cria convênio → cria médico → cria paciente → agenda → confirma → registra atendimento. Cada execução usa um sufixo único ({{_uid}}) pra não conflitar com dados já criados.",
    steps: [
      { endpoint: "auth.login", body: { email: "admin@clinica.com", senha: "admin123" }, captureToken: true },
      {
        endpoint: "convenio.create",
        body: { nome: "Unimed Demo {{_uid}}", descricao: "Convênio criado pelo cenário caminho-feliz em {{_now}}" },
        capture: { "convenioId": "data.id" },
      },
      {
        endpoint: "medico.create",
        body: {
          nome: "Dr. Demo {{_uid}}",
          email: "dr.demo.{{_uid}}@clinica.com",
          crm: "CRM-{{_uid}}",
          especialidade: "Clínica Geral",
          telefone: "(34) 99999-0000",
        },
        capture: { "medicoId": "data.id" },
      },
      {
        endpoint: "paciente.create",
        body: {
          nome: "Paciente Demo {{_uid}}",
          email: "paciente.{{_uid}}@clinica.com",
          cpf: "000{{_uid}}",
          telefone: "(34) 98888-0000",
          dataNascimento: "1990-01-01",
        },
        interpolate: { convenioId: "{{convenioId}}" },
        capture: { "pacienteId": "data.id" },
      },
      { endpoint: "agendamento.create", interpolate: { pacienteId: "{{pacienteId}}", medicoId: "{{medicoId}}" }, capture: { "agendamentoId": "data.id" } },
      { endpoint: "agendamento.update", interpolatePath: { id: "{{agendamentoId}}" }, body: { status: "CONFIRMADO" } },
      { endpoint: "atendimento.create", interpolate: { agendamentoId: "{{agendamentoId}}" } },
    ],
  },
  {
    id: "errors",
    name: "Cenários de erro — validar GlobalExceptionHandler",
    description: "Dispara erros 401, 404, 422 e 400 para conferir as respostas estruturadas via ApiResponse.",
    steps: [
      { endpoint: "convenio.list", clearToken: true, expectStatus: 401, label: "401 — sem token" },
      { endpoint: "auth.login", body: { email: "naoexiste@x.com", senha: "errada" }, expectStatus: 422, label: "422 — credenciais inválidas" },
      { endpoint: "auth.login", body: { email: "admin@clinica.com", senha: "admin123" }, captureToken: true, label: "200 — login ok" },
      { endpoint: "paciente.get", pathParams: { id: "999999" }, expectStatus: 404, label: "404 — paciente inexistente" },
      { endpoint: "paciente.create", body: { nome: "X", email: "naoeumemail", cpf: "abc" }, expectStatus: 400, label: "400 — bean validation" },
    ],
  },
  {
    id: "feign",
    name: "Feign — agendamento valida via administrativo",
    description: "Tenta criar agendamento com paciente inexistente. O serviço Agendamento consulta o Administrativo via Feign e propaga 404.",
    steps: [
      { endpoint: "auth.login", body: { email: "admin@clinica.com", senha: "admin123" }, captureToken: true },
      { endpoint: "agendamento.create", body: { pacienteId: 999999, medicoId: 999999, dataHora: nextWeekIso() }, expectStatus: 404, label: "404 — paciente não existe (Feign)" },
    ],
  },
  {
    id: "cleanup",
    name: "Cleanup — remove dados de demo",
    description: "Limpa entidades criadas por execuções anteriores dos cenários (Caminho feliz, Feign, etc). Filtra por prefixos conhecidos (Unimed Demo / Dr. Demo / Paciente Demo) e respeita a ordem reversa de dependências.",
    steps: [
      { endpoint: "auth.login", body: { email: "admin@clinica.com", senha: "admin123" }, captureToken: true },
      // 1. Identifica pacientes e médicos de demo e captura seus IDs.
      {
        kind: "cleanup-list",
        listEndpoint: "paciente.list",
        deleteEndpoint: "paciente.delete",
        match: { field: "nome", startsWith: "Paciente Demo" },
        captureIdsAs: "_demoPacienteIds",
        label: "Pacientes 'Paciente Demo …'",
      },
      {
        kind: "cleanup-list",
        listEndpoint: "medico.list",
        deleteEndpoint: "medico.delete",
        match: { field: "nome", startsWith: "Dr. Demo" },
        captureIdsAs: "_demoMedicoIds",
        label: "Médicos 'Dr. Demo …'",
      },
      // 2. Atendimentos cujos agendamentos referenciam pacientes ou médicos demo.
      //    Como atendimento não tem prefixo, marcamos pelo agendamentoId em uso.
      //    Aqui simplificamos: limpamos atendimentos cujos pacienteId/medicoId batem.
      {
        kind: "cleanup-list",
        listEndpoint: "atendimento.list",
        deleteEndpoint: "atendimento.delete",
        match: { idsFromVar: "_demoPacienteIds", field: "pacienteId" },
        label: "Atendimentos de pacientes demo",
      },
      // 3. Agendamentos com pacienteId ou medicoId em demo.
      {
        kind: "cleanup-list",
        listEndpoint: "agendamento.list",
        deleteEndpoint: "agendamento.delete",
        match: { idsFromVar: "_demoPacienteIds", field: "pacienteId" },
        label: "Agendamentos de pacientes demo",
      },
      // 4. Convênios demo (precisa rodar DEPOIS de pacientes, por causa da FK).
      {
        kind: "cleanup-list",
        listEndpoint: "convenio.list",
        deleteEndpoint: "convenio.delete",
        match: { field: "nome", startsWith: "Unimed Demo" },
        label: "Convênios 'Unimed Demo …'",
      },
    ],
  },
];

Object.assign(window, { ENDPOINTS, SERVICES, SCENARIOS, nextWeekIso });
