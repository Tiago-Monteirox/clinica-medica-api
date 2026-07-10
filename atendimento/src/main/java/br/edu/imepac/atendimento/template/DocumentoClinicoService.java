package br.edu.imepac.atendimento.template;

import br.edu.imepac.atendimento.prontuario.ProntuarioEntity;
import br.edu.imepac.atendimento.prontuario.ProntuarioRepository;
import br.edu.imepac.atendimento.prontuario.StatusProntuario;
import br.edu.imepac.atendimento.template.dto.DocumentoClinicoRequest;
import br.edu.imepac.atendimento.template.dto.DocumentoClinicoResponse;
import br.edu.imepac.atendimento.template.renderer.TemplateRenderer;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class DocumentoClinicoService {

    private final DocumentoClinicoRepository documentoRepository;
    private final ProntuarioRepository prontuarioRepository;
    private final TemplateClinicoService templateClinicoService;
    private final TemplateRenderer templateRenderer;

    public DocumentoClinicoService(DocumentoClinicoRepository documentoRepository,
                                   ProntuarioRepository prontuarioRepository,
                                   TemplateClinicoService templateClinicoService,
                                   TemplateRenderer templateRenderer) {
        this.documentoRepository = documentoRepository;
        this.prontuarioRepository = prontuarioRepository;
        this.templateClinicoService = templateClinicoService;
        this.templateRenderer = templateRenderer;
    }

    @Transactional(readOnly = true)
    public DocumentoClinicoResponse preview(DocumentoClinicoRequest request) {
        RenderedDocumento rendered = renderizar(request);
        return DocumentoClinicoResponse.builder()
                .prontuarioId(rendered.prontuario().getId())
                .pacienteId(rendered.prontuario().getPacienteId())
                .medicoId(rendered.prontuario().getMedicoId())
                .templateCodigo(rendered.template().getCodigo())
                .templateVersao(rendered.template().getVersao())
                .tipo(rendered.template().getTipo())
                .conteudoMarkdown(rendered.markdown())
                .conteudoHtml(toBasicHtml(rendered.markdown()))
                .status(StatusDocumentoClinico.RASCUNHO)
                .build();
    }

    public DocumentoClinicoResponse emitir(DocumentoClinicoRequest request) {
        RenderedDocumento rendered = renderizar(request);

        DocumentoClinicoEntity entity = DocumentoClinicoEntity.builder()
                .prontuarioId(rendered.prontuario().getId())
                .pacienteId(rendered.prontuario().getPacienteId())
                .medicoId(rendered.prontuario().getMedicoId())
                .templateCodigo(rendered.template().getCodigo())
                .templateVersao(rendered.template().getVersao())
                .tipo(rendered.template().getTipo())
                .conteudoMarkdown(rendered.markdown())
                .conteudoHtml(toBasicHtml(rendered.markdown()))
                .status(StatusDocumentoClinico.EMITIDO)
                .emitidoEm(LocalDateTime.now())
                .build();

        return toResponse(documentoRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public List<DocumentoClinicoResponse> findByProntuario(Long prontuarioId) {
        return documentoRepository.findByProntuarioIdOrderByCreatedAtDesc(prontuarioId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private RenderedDocumento renderizar(DocumentoClinicoRequest request) {
        ProntuarioEntity prontuario = prontuarioRepository.findById(request.getProntuarioId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Prontuário com id " + request.getProntuarioId() + " não encontrado"));
        TemplateClinicoEntity template = templateClinicoService.buscarAtivoEntity(request.getTemplateCodigo());

        Map<String, Object> context = buildContext(prontuario, template);
        deepMerge(context, request.getDadosComplementares());

        String markdown = templateRenderer.render(template.getConteudoMarkdown(), context);
        return new RenderedDocumento(prontuario, template, markdown);
    }

    private Map<String, Object> buildContext(ProntuarioEntity prontuario, TemplateClinicoEntity template) {
        Map<String, Object> context = new LinkedHashMap<>();

        context.put("paciente", mapOf(
                "id", prontuario.getPacienteId(),
                "nome", "Paciente " + prontuario.getPacienteId(),
                "cpf", "",
                "dataNascimento", ""
        ));
        context.put("medico", mapOf(
                "id", prontuario.getMedicoId(),
                "nome", "Médico " + prontuario.getMedicoId(),
                "crm", ""
        ));
        context.put("atendimento", mapOf(
                "id", prontuario.getAtendimentoId(),
                "agendamentoId", prontuario.getAgendamentoId(),
                "dataAtendimento", valueOrBlank(prontuario.getDataAtendimento())
        ));
        context.put("prontuario", mapOf(
                "id", prontuario.getId(),
                "queixaPrincipal", valueOrBlank(prontuario.getQueixaPrincipal()),
                "historiaDoencaAtual", valueOrBlank(prontuario.getHistoriaDoencaAtual()),
                "resumo", valueOrBlank(prontuario.getResumo()),
                "diagnostico", valueOrBlank(prontuario.getDiagnostico()),
                "conduta", valueOrBlank(prontuario.getConduta()),
                "prescricao", valueOrBlank(prontuario.getPrescricao()),
                "observacoes", valueOrBlank(prontuario.getObservacoes())
        ));
        context.put("documento", mapOf(
                "dataEmissao", LocalDate.now().toString(),
                "orientacoes", "",
                "diasAfastamento", "",
                "dataInicioAfastamento", "",
                "cid", "",
                "observacoes", "",
                "exames", List.of()
        ));
        context.put("historico", historicoContext(prontuario, template));

        return context;
    }

    private Map<String, Object> historicoContext(ProntuarioEntity prontuario, TemplateClinicoEntity template) {
        List<Map<String, Object>> itens = new ArrayList<>();
        if (template.getTipo() == TipoTemplateClinico.HISTORICO) {
            itens = prontuarioRepository.findByPacienteIdAndStatusOrderByDataAtendimentoDesc(
                            prontuario.getPacienteId(), StatusProntuario.FINALIZADO)
                    .stream()
                    .map(item -> mapOf(
                            "prontuarioId", item.getId(),
                            "atendimentoId", item.getAtendimentoId(),
                            "agendamentoId", item.getAgendamentoId(),
                            "dataAtendimento", valueOrBlank(item.getDataAtendimento()),
                            "medicoId", item.getMedicoId(),
                            "medicoNome", "Médico " + item.getMedicoId(),
                            "status", item.getStatus(),
                            "resumo", valueOrBlank(item.getResumo()),
                            "diagnostico", valueOrBlank(item.getDiagnostico()),
                            "conduta", valueOrBlank(item.getConduta()),
                            "prescricao", valueOrBlank(item.getPrescricao())
                    ))
                    .toList();
        }

        return mapOf(
                "periodoInicio", itens.isEmpty() ? "" : itens.get(itens.size() - 1).get("dataAtendimento"),
                "periodoFim", itens.isEmpty() ? "" : itens.get(0).get("dataAtendimento"),
                "itens", itens
        );
    }

    @SuppressWarnings("unchecked")
    private void deepMerge(Map<String, Object> target, Map<String, Object> source) {
        if (source == null) return;
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            Object existing = target.get(entry.getKey());
            Object incoming = entry.getValue();
            if (existing instanceof Map<?, ?> existingMap && incoming instanceof Map<?, ?> incomingMap) {
                deepMerge((Map<String, Object>) existingMap, (Map<String, Object>) incomingMap);
            } else {
                target.put(entry.getKey(), incoming);
            }
        }
    }

    private Map<String, Object> mapOf(Object... values) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) {
            map.put((String) values[i], values[i + 1]);
        }
        return map;
    }

    private String valueOrBlank(Object value) {
        return value == null ? "" : value.toString();
    }

    private String toBasicHtml(String markdown) {
        String escaped = markdown
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
        return "<pre>" + escaped + "</pre>";
    }

    private DocumentoClinicoResponse toResponse(DocumentoClinicoEntity entity) {
        return DocumentoClinicoResponse.builder()
                .id(entity.getId())
                .prontuarioId(entity.getProntuarioId())
                .pacienteId(entity.getPacienteId())
                .medicoId(entity.getMedicoId())
                .templateCodigo(entity.getTemplateCodigo())
                .templateVersao(entity.getTemplateVersao())
                .tipo(entity.getTipo())
                .conteudoMarkdown(entity.getConteudoMarkdown())
                .conteudoHtml(entity.getConteudoHtml())
                .status(entity.getStatus())
                .emitidoEm(entity.getEmitidoEm())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private record RenderedDocumento(
            ProntuarioEntity prontuario,
            TemplateClinicoEntity template,
            String markdown
    ) {}
}
