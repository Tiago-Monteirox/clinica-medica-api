/* SaasClinic — global state + auth + data cache (sourced via Api client) */

// ---------- Seed data (used by mock backend) ----------
const SEED_CONVENIOS = [
  { id: 1, nome: "Unimed Nacional", descricao: "Plano nacional, cobertura ampla", ativo: true, criadoEm: "2024-02-12" },
  { id: 2, nome: "Bradesco Saúde", descricao: "Top Premium", ativo: true, criadoEm: "2024-03-04" },
  { id: 3, nome: "SulAmérica", descricao: "Executivo", ativo: true, criadoEm: "2024-04-21" },
  { id: 4, nome: "Amil One", descricao: "Black", ativo: false, criadoEm: "2023-11-09" },
  { id: 5, nome: "Hapvida", descricao: "Mix Empresarial", ativo: true, criadoEm: "2024-06-15" },
  { id: 6, nome: "Notre Dame Intermédica", descricao: "Família 600", ativo: true, criadoEm: "2024-07-30" },
];

const SEED_MEDICOS = [
  { id: 1, nome: "Dr. Paulo Andrade",  email: "paulo.andrade@saasclinic.com",  crm: "SP 123.456", especialidade: "Cardiologia",     telefone: "(11) 9 8123-4567", cor: "#1f3699" },
  { id: 2, nome: "Dra. Marina Lopes",  email: "marina.lopes@saasclinic.com",  crm: "SP 234.567", especialidade: "Pediatria",       telefone: "(11) 9 8234-5678", cor: "#7a3b8e" },
  { id: 3, nome: "Dr. Henrique Vieira",email: "henrique.vieira@saasclinic.com",crm: "SP 345.678", especialidade: "Clínica Geral",   telefone: "(11) 9 8345-6789", cor: "#1f7a64" },
  { id: 4, nome: "Dra. Sofia Bernardes",email:"sofia.bernardes@saasclinic.com",crm: "SP 456.789", especialidade: "Dermatologia",    telefone: "(11) 9 8456-7890", cor: "#9a6a16" },
  { id: 5, nome: "Dr. Ricardo Tanaka", email: "ricardo.tanaka@saasclinic.com", crm: "SP 567.890", especialidade: "Ortopedia",       telefone: "(11) 9 8567-8901", cor: "#a33333" },
  { id: 6, nome: "Dra. Beatriz Nunes", email: "beatriz.nunes@saasclinic.com",  crm: "SP 678.901", especialidade: "Ginecologia",     telefone: "(11) 9 8678-9012", cor: "#2945bf" },
];

const SEED_PACIENTES = [
  { id: 1, nome: "Ana Costa Silveira", email: "ana.costa@email.com",      cpf: "111.222.333-44", telefone: "(11) 9 9111-1111", nascimento: "1988-04-12", convenioId: 1 },
  { id: 2, nome: "Carlos Lima Junior",  email: "carlos.lima@email.com",    cpf: "222.333.444-55", telefone: "(11) 9 9222-2222", nascimento: "1976-09-30", convenioId: null },
  { id: 3, nome: "Beatriz Almeida",    email: "bia.almeida@email.com",    cpf: "333.444.555-66", telefone: "(11) 9 9333-3333", nascimento: "1995-01-22", convenioId: 2 },
  { id: 4, nome: "Diego Ramirez",      email: "diego.ramirez@email.com",  cpf: "444.555.666-77", telefone: "(11) 9 9444-4444", nascimento: "1990-12-05", convenioId: 3 },
  { id: 5, nome: "Eduarda Pires",      email: "duda.pires@email.com",     cpf: "555.666.777-88", telefone: "(11) 9 9555-5555", nascimento: "1982-07-18", convenioId: 1 },
  { id: 6, nome: "Felipe Tavares",     email: "felipe.tavares@email.com", cpf: "666.777.888-99", telefone: "(11) 9 9666-6666", nascimento: "1968-03-09", convenioId: 5 },
  { id: 7, nome: "Giovana Mendes",     email: "gio.mendes@email.com",     cpf: "777.888.999-00", telefone: "(11) 9 9777-7777", nascimento: "2001-11-14", convenioId: null },
  { id: 8, nome: "Heitor Yoshida",     email: "heitor.yoshida@email.com", cpf: "888.999.000-11", telefone: "(11) 9 9888-8888", nascimento: "1985-06-26", convenioId: 6 },
  { id: 9, nome: "Isabela Drummond",   email: "isa.drummond@email.com",   cpf: "999.000.111-22", telefone: "(11) 9 9999-9999", nascimento: "1993-02-17", convenioId: 2 },
  { id: 10, nome: "Júlio Cesar Bento", email: "julio.bento@email.com",    cpf: "100.200.300-44", telefone: "(11) 9 8100-2000", nascimento: "1970-08-03", convenioId: 1 },
];

function pad(n) { return String(n).padStart(2, "0"); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function isoLocal(d) { return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function startOfWeek(d) { const x = new Date(d); const dow = x.getDay(); x.setDate(x.getDate() - dow + 1); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

function buildAgendamentos() {
  const monday = startOfWeek(new Date());
  const items = [];
  const distrib = [
    [0, 8,  1, 1, "REALIZADO", "Retorno após exame de esforço"],
    [0, 9,  3, 1, "REALIZADO", "Consulta de rotina"],
    [0, 10, 5, 2, "REALIZADO", "Pediatria — vacinas atualizadas"],
    [0, 11, 2, 3, "REALIZADO", ""],
    [0, 14, 7, 4, "REALIZADO", "Dermatite atópica"],
    [0, 16, 9, 6, "REALIZADO", ""],
    [1, 8,  4, 1, "CONFIRMADO", "Eletro de controle"],
    [1, 9,  6, 5, "CONFIRMADO", ""],
    [1, 10, 8, 2, "AGENDADO",   "Primeira consulta"],
    [1, 11, 10,3, "CONFIRMADO", "Check-up anual"],
    [1, 14, 1, 4, "AGENDADO",   ""],
    [1, 15, 3, 6, "CANCELADO",  "Paciente solicitou remarcar"],
    [1, 16, 5, 5, "CONFIRMADO", ""],
    [2, 8,  2, 1, "CONFIRMADO", ""],
    [2, 9,  4, 2, "AGENDADO",   "Vacina"],
    [2, 10, 7, 3, "CONFIRMADO", ""],
    [2, 14, 9, 4, "AGENDADO",   "Mancha no braço"],
    [2, 15, 6, 6, "CONFIRMADO", ""],
    [2, 16, 8, 5, "AGENDADO",   ""],
    [3, 8,  10,1, "AGENDADO",   ""],
    [3, 9,  1, 6, "AGENDADO",   "Exame preventivo"],
    [3, 10, 3, 3, "AGENDADO",   ""],
    [3, 11, 5, 2, "AGENDADO",   ""],
    [3, 14, 2, 4, "AGENDADO",   ""],
    [3, 16, 7, 5, "AGENDADO",   ""],
    [4, 9,  9, 1, "AGENDADO",   ""],
    [4, 10, 8, 6, "AGENDADO",   ""],
    [4, 11, 6, 3, "AGENDADO",   ""],
    [4, 14, 4, 2, "AGENDADO",   ""],
    [4, 15, 10,5, "AGENDADO",   ""],
  ];
  let id = 1;
  for (const [d, h, pid, mid, status, obs] of distrib) {
    const date = new Date(monday);
    date.setDate(date.getDate() + d);
    date.setHours(h, 0, 0, 0);
    items.push({ id: id++, pacienteId: pid, medicoId: mid, dataHora: isoLocal(date), status, observacoes: obs, duracaoMin: 60 });
  }
  return items;
}

const SEED_AGENDAMENTOS = buildAgendamentos();

const SEED_ATENDIMENTOS = [
  { id: 1, agendamentoId: 1,  pacienteId: 1, medicoId: 1, dataAtendimento: SEED_AGENDAMENTOS[0].dataHora,
    diagnostico: "Hipertensão arterial estágio 1, controlada. Exame de esforço sem alterações isquêmicas.",
    prescricao: "Manter losartana 50mg 1x ao dia. Caminhada 30min 5x/semana. Retorno em 90 dias.",
    observacoes: "Paciente aderente ao tratamento." },
  { id: 2, agendamentoId: 2,  pacienteId: 3, medicoId: 1, dataAtendimento: SEED_AGENDAMENTOS[1].dataHora,
    diagnostico: "Sopro funcional benigno. Ausculta cardíaca normal.",
    prescricao: "Sem medicação. Acompanhamento anual.", observacoes: "" },
  { id: 3, agendamentoId: 3,  pacienteId: 5, medicoId: 2, dataAtendimento: SEED_AGENDAMENTOS[2].dataHora,
    diagnostico: "Quadro viral autolimitado. Vacinação em dia.",
    prescricao: "Hidratação oral e dipirona 500mg se febre acima de 38°C.",
    observacoes: "Mãe orientada sobre sinais de alarme." },
  { id: 4, agendamentoId: 4,  pacienteId: 2, medicoId: 3, dataAtendimento: SEED_AGENDAMENTOS[3].dataHora,
    diagnostico: "Lombalgia mecânica.",
    prescricao: "Ciclobenzaprina 5mg à noite por 7 dias. Fisioterapia 2x/semana.", observacoes: "" },
  { id: 5, agendamentoId: 5,  pacienteId: 7, medicoId: 4, dataAtendimento: SEED_AGENDAMENTOS[4].dataHora,
    diagnostico: "Dermatite atópica leve em flexuras.",
    prescricao: "Hidratante cetil 2x/dia. Hidrocortisona 1% creme 1x/dia por 5 dias nos surtos.",
    observacoes: "Evitar banhos quentes." },
  { id: 6, agendamentoId: 6,  pacienteId: 9, medicoId: 6, dataAtendimento: SEED_AGENDAMENTOS[5].dataHora,
    diagnostico: "Exame ginecológico de rotina sem alterações.",
    prescricao: "Repetir colpocitológico em 12 meses.", observacoes: "" },
];

const SEED_PRONTUARIOS = SEED_ATENDIMENTOS.map((a, idx) => ({
  id: idx + 1,
  atendimentoId: a.id,
  agendamentoId: a.agendamentoId,
  pacienteId: a.pacienteId,
  medicoId: a.medicoId,
  dataAtendimento: a.dataAtendimento,
  queixaPrincipal: [
    "Retorno para avaliação de controle cardiovascular.",
    "Avaliação preventiva anual.",
    "Febre baixa e coriza há 48 horas.",
    "Dor lombar após esforço físico.",
    "Prurido e lesões em flexuras.",
    "Consulta ginecológica de rotina.",
  ][idx] || "",
  historiaDoencaAtual: [
    "Paciente refere boa adesão medicamentosa, sem dor torácica ou dispneia aos esforços habituais.",
    "Paciente assintomática, comparece para acompanhamento de rotina.",
    "Quadro iniciado há dois dias, sem vômitos, sem sinais de desidratação.",
    "Dor localizada em região lombar baixa, sem irradiação e sem déficit motor.",
    "Lesões recorrentes, piora após banho quente e uso de sabonete perfumado.",
    "Sem queixas no momento, ciclo regular e exames prévios sem alterações relevantes.",
  ][idx] || "",
  resumo: [
    "Controle pressórico adequado e exame complementar sem sinais de isquemia.",
    "Avaliação cardiológica sem achados patológicos.",
    "Quadro compatível com infecção viral autolimitada.",
    "Lombalgia mecânica sem sinais neurológicos de alarme.",
    "Dermatite atópica leve, sem sinais de infecção secundária.",
    "Exame ginecológico de rotina sem alterações.",
  ][idx] || a.diagnostico,
  diagnostico: a.diagnostico,
  conduta: [
    "Manter tratamento atual, reforçar atividade física e retorno programado.",
    "Manter acompanhamento anual.",
    "Tratamento sintomático e orientação de sinais de alarme.",
    "Analgesia, relaxante muscular noturno e fisioterapia.",
    "Hidratação cutânea intensiva e corticoide tópico em crises.",
    "Rotina preventiva anual.",
  ][idx] || "",
  prescricao: a.prescricao,
  observacoes: a.observacoes,
  status: "FINALIZADO",
  finalizadoEm: a.dataAtendimento,
  createdAt: a.dataAtendimento,
  updatedAt: a.dataAtendimento,
}));

const SEED_TEMPLATES_CLINICOS = [
  {
    id: 1,
    codigo: "PRONTUARIO_CONSULTA_GERAL",
    nome: "Prontuário de consulta geral",
    tipo: "PRONTUARIO",
    versao: 1,
    ativo: true,
    schemaJson: "{}",
    conteudoMarkdown: `# Prontuario de Consulta

Paciente: {{paciente.nome}}
Data do atendimento: {{atendimento.dataAtendimento}}
Medico: {{medico.nome}} - CRM {{medico.crm}}

## Queixa principal

{{prontuario.queixaPrincipal}}

## Historia da doenca atual

{{prontuario.historiaDoencaAtual}}

## Resumo

{{prontuario.resumo}}

## Diagnostico

{{prontuario.diagnostico}}

## Conduta

{{prontuario.conduta}}

## Prescricao

{{prontuario.prescricao}}

## Observacoes

{{prontuario.observacoes}}`,
  },
  {
    id: 2,
    codigo: "HISTORICO_PACIENTE_RESUMIDO",
    nome: "Histórico do paciente resumido",
    tipo: "HISTORICO",
    versao: 1,
    ativo: true,
    schemaJson: "{}",
    conteudoMarkdown: `# Historico clinico resumido

Paciente: {{paciente.nome}}
CPF: {{paciente.cpf}}
Periodo: {{historico.periodoInicio}} a {{historico.periodoFim}}

{{#historico.itens}}
## {{dataAtendimento}} - Dr(a). {{medicoNome}}

Resumo: {{resumo}}

Diagnostico: {{diagnostico}}

Conduta: {{conduta}}

{{/historico.itens}}`,
  },
  {
    id: 3,
    codigo: "PRESCRICAO_SIMPLES",
    nome: "Prescrição simples",
    tipo: "PRESCRICAO",
    versao: 1,
    ativo: true,
    schemaJson: "{}",
    conteudoMarkdown: `# Prescricao medica

Paciente: {{paciente.nome}}
Data: {{documento.dataEmissao}}
Medico: {{medico.nome}} - CRM {{medico.crm}}

## Prescricao

{{prontuario.prescricao}}

Orientacoes adicionais:

{{documento.orientacoes}}`,
  },
  {
    id: 4,
    codigo: "ATESTADO_MEDICO",
    nome: "Atestado médico",
    tipo: "ATESTADO",
    versao: 1,
    ativo: true,
    schemaJson: "{}",
    conteudoMarkdown: `# Atestado medico

Atesto, para os devidos fins, que {{paciente.nome}}, CPF {{paciente.cpf}},
foi atendido(a) em {{atendimento.dataAtendimento}} e necessita de afastamento
por {{documento.diasAfastamento}} dia(s), a partir de {{documento.dataInicioAfastamento}}.

CID: {{documento.cid}}

Observacoes: {{documento.observacoes}}

Medico: {{medico.nome}} - CRM {{medico.crm}}`,
  },
  {
    id: 5,
    codigo: "SOLICITACAO_EXAMES",
    nome: "Solicitação de exames",
    tipo: "EXAME",
    versao: 1,
    ativo: true,
    schemaJson: "{}",
    conteudoMarkdown: `# Solicitacao de exames

Paciente: {{paciente.nome}}
Data: {{documento.dataEmissao}}
Medico: {{medico.nome}} - CRM {{medico.crm}}

## Exames solicitados

{{#documento.exames}}
- {{nome}} - {{justificativa}}
{{/documento.exames}}

## Observacoes

{{documento.observacoes}}`,
  },
];

const SEED_DOCUMENTOS_CLINICOS = [
  {
    id: 1,
    prontuarioId: 1,
    pacienteId: 1,
    medicoId: 1,
    templateCodigo: "PRONTUARIO_CONSULTA_GERAL",
    templateVersao: 1,
    tipo: "PRONTUARIO",
    conteudoMarkdown: "Prontuário emitido no fechamento da consulta.",
    conteudoHtml: "<pre>Prontuário emitido no fechamento da consulta.</pre>",
    status: "EMITIDO",
    emitidoEm: SEED_ATENDIMENTOS[0].dataAtendimento,
    createdAt: SEED_ATENDIMENTOS[0].dataAtendimento,
    updatedAt: SEED_ATENDIMENTOS[0].dataAtendimento,
  },
];

const SEED_USUARIOS = [
  { id: 1, nome: "Administrador",       email: "admin@saasclinic.com",       role: "ADMIN",          ativo: true,  ultimoAcesso: "2026-05-20 09:14" },
  { id: 2, nome: "Renata Oliveira",     email: "renata.recep@saasclinic.com", role: "RECEPCIONISTA", ativo: true,  ultimoAcesso: "2026-05-20 08:42" },
  { id: 3, nome: "Marcos Pieri",        email: "marcos.recep@saasclinic.com", role: "RECEPCIONISTA", ativo: true,  ultimoAcesso: "2026-05-19 17:55" },
  { id: 4, nome: "Dr. Paulo Andrade",    email: "paulo.andrade@saasclinic.com",role: "MEDICO",        ativo: true,  ultimoAcesso: "2026-05-20 07:30" },
  { id: 5, nome: "Dra. Marina Lopes",    email: "marina.lopes@saasclinic.com", role: "MEDICO",        ativo: true,  ultimoAcesso: "2026-05-19 19:12" },
  { id: 6, nome: "Dr. Henrique Vieira",  email: "henrique.vieira@saasclinic.com",role: "MEDICO",      ativo: true,  ultimoAcesso: "2026-05-18 12:01" },
  { id: 7, nome: "Ana Costa Silveira",   email: "ana.costa@email.com",         role: "PACIENTE",      ativo: true,  ultimoAcesso: "2026-05-15 21:33" },
  { id: 8, nome: "Carlos Lima Junior",   email: "carlos.lima@email.com",       role: "PACIENTE",      ativo: false, ultimoAcesso: "2025-12-04 10:11" },
];

const PERSONAS = [
  { role: "ADMIN",          nome: "Administrador",       email: "admin@saasclinic.com",        avatar: "AD", cor: "#1f3699", linkedId: 1, kind: "user" },
  { role: "RECEPCIONISTA",  nome: "Renata Oliveira",     email: "renata.recep@saasclinic.com", avatar: "RO", cor: "#9a6a16", linkedId: 2, kind: "user" },
  { role: "MEDICO",         nome: "Dr. Paulo Andrade",   email: "paulo.andrade@saasclinic.com",avatar: "PA", cor: "#1f3699", linkedId: 1, kind: "medico" },
  { role: "PACIENTE",       nome: "Ana Costa Silveira",  email: "ana.costa@email.com",         avatar: "AC", cor: "#7a3b8e", linkedId: 1, kind: "paciente" },
];

Object.assign(window, {
  SEED_CONVENIOS, SEED_MEDICOS, SEED_PACIENTES, SEED_AGENDAMENTOS, SEED_ATENDIMENTOS, SEED_USUARIOS,
  SEED_PRONTUARIOS, SEED_TEMPLATES_CLINICOS, SEED_DOCUMENTOS_CLINICOS,
  PERSONAS, pad, ymd, isoLocal, startOfWeek, addDays,
});
