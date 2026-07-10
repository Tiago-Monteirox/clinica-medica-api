package br.edu.imepac.atendimento.template;

import br.edu.imepac.atendimento.prontuario.ProntuarioEntity;
import br.edu.imepac.atendimento.prontuario.ProntuarioRepository;
import br.edu.imepac.atendimento.prontuario.StatusProntuario;
import br.edu.imepac.atendimento.template.dto.DocumentoClinicoRequest;
import br.edu.imepac.atendimento.template.renderer.MarkdownTemplateRenderer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentoClinicoServiceTest {

    @Mock
    private DocumentoClinicoRepository documentoRepository;

    @Mock
    private ProntuarioRepository prontuarioRepository;

    @Mock
    private TemplateClinicoService templateClinicoService;

    private DocumentoClinicoService service;

    @BeforeEach
    void setUp() {
        service = new DocumentoClinicoService(
                documentoRepository,
                prontuarioRepository,
                templateClinicoService,
                new MarkdownTemplateRenderer()
        );
    }

    @Test
    void emitirRenderizaTemplateEGravaSnapshot() {
        ProntuarioEntity prontuario = ProntuarioEntity.builder()
                .id(8L)
                .atendimentoId(7L)
                .agendamentoId(6L)
                .pacienteId(10L)
                .medicoId(20L)
                .dataAtendimento(LocalDateTime.of(2026, 7, 9, 14, 0))
                .status(StatusProntuario.FINALIZADO)
                .prescricao("Tomar água")
                .build();
        TemplateClinicoEntity template = TemplateClinicoEntity.builder()
                .codigo("PRESCRICAO_SIMPLES")
                .nome("Prescrição")
                .tipo(TipoTemplateClinico.PRESCRICAO)
                .versao(2)
                .conteudoMarkdown("Paciente {{paciente.nome}}\n{{prontuario.prescricao}}")
                .ativo(true)
                .build();

        when(prontuarioRepository.findById(8L)).thenReturn(Optional.of(prontuario));
        when(templateClinicoService.buscarAtivoEntity("PRESCRICAO_SIMPLES")).thenReturn(template);
        when(documentoRepository.save(any(DocumentoClinicoEntity.class))).thenAnswer(invocation -> {
            DocumentoClinicoEntity entity = invocation.getArgument(0);
            entity.setId(77L);
            return entity;
        });

        var response = service.emitir(new DocumentoClinicoRequest(
                8L,
                "PRESCRICAO_SIMPLES",
                Map.of("paciente", Map.of("nome", "Ana"))
        ));

        assertEquals(77L, response.getId());
        assertEquals("PRESCRICAO_SIMPLES", response.getTemplateCodigo());
        assertEquals(2, response.getTemplateVersao());
        assertEquals(StatusDocumentoClinico.EMITIDO, response.getStatus());
        assertTrue(response.getConteudoMarkdown().contains("Paciente Ana"));
        assertTrue(response.getConteudoMarkdown().contains("Tomar água"));
    }
}
