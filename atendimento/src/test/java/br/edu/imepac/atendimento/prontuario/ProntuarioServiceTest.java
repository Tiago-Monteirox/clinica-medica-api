package br.edu.imepac.atendimento.prontuario;

import br.edu.imepac.atendimento.atendimento.AtendimentoEntity;
import br.edu.imepac.atendimento.atendimento.AtendimentoRepository;
import br.edu.imepac.atendimento.prontuario.dto.FinalizarProntuarioRequest;
import br.edu.imepac.atendimento.prontuario.dto.ProntuarioRequest;
import br.edu.imepac.commons.exceptions.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProntuarioServiceTest {

    @Mock
    private ProntuarioRepository prontuarioRepository;

    @Mock
    private AtendimentoRepository atendimentoRepository;

    @InjectMocks
    private ProntuarioService service;

    @Test
    void salvarRascunhoCriaProntuarioComSnapshotDoAtendimento() {
        AtendimentoEntity atendimento = AtendimentoEntity.builder()
                .id(7L)
                .agendamentoId(3L)
                .pacienteId(10L)
                .medicoId(20L)
                .dataAtendimento(LocalDateTime.of(2026, 7, 9, 14, 0))
                .diagnostico("Diagnóstico inicial")
                .prescricao("Prescrição inicial")
                .observacoes("Observação inicial")
                .build();

        when(atendimentoRepository.findById(7L)).thenReturn(Optional.of(atendimento));
        when(prontuarioRepository.findByAtendimentoId(7L)).thenReturn(Optional.empty());
        when(prontuarioRepository.save(any(ProntuarioEntity.class))).thenAnswer(invocation -> {
            ProntuarioEntity entity = invocation.getArgument(0);
            entity.setId(99L);
            return entity;
        });

        var response = service.salvarRascunho(7L, new ProntuarioRequest(
                "Dor de cabeça",
                "Início há 2 dias",
                "Paciente estável",
                null,
                "Hidratação e repouso",
                null,
                null
        ));

        assertEquals(99L, response.getId());
        assertEquals(3L, response.getAgendamentoId());
        assertEquals(10L, response.getPacienteId());
        assertEquals(20L, response.getMedicoId());
        assertEquals("Diagnóstico inicial", response.getDiagnostico());
        assertEquals("Prescrição inicial", response.getPrescricao());
        assertEquals("Paciente estável", response.getResumo());
        assertEquals(StatusProntuario.RASCUNHO, response.getStatus());
    }

    @Test
    void finalizarSemResumoLancaBusinessException() {
        ProntuarioEntity prontuario = ProntuarioEntity.builder()
                .id(1L)
                .status(StatusProntuario.RASCUNHO)
                .build();
        when(prontuarioRepository.findById(1L)).thenReturn(Optional.of(prontuario));

        assertThrows(BusinessException.class, () -> service.finalizar(1L, new FinalizarProntuarioRequest()));
    }

    @Test
    void historicoPadraoListaSomenteFinalizados() {
        ProntuarioEntity prontuario = ProntuarioEntity.builder()
                .id(5L)
                .atendimentoId(2L)
                .agendamentoId(3L)
                .pacienteId(10L)
                .medicoId(20L)
                .dataAtendimento(LocalDateTime.of(2026, 7, 9, 14, 0))
                .status(StatusProntuario.FINALIZADO)
                .resumo("Resumo")
                .diagnostico("Diagnóstico")
                .conduta("Conduta")
                .prescricao("Prescrição")
                .build();

        when(prontuarioRepository.findByPacienteIdAndStatusOrderByDataAtendimentoDesc(
                10L, StatusProntuario.FINALIZADO)).thenReturn(List.of(prontuario));

        var historico = service.historicoPorPaciente(10L, false);

        assertEquals(10L, historico.getPacienteId());
        assertEquals(1, historico.getItens().size());
        assertEquals(5L, historico.getItens().getFirst().getProntuarioId());
        assertEquals(StatusProntuario.FINALIZADO, historico.getItens().getFirst().getStatus());
    }
}
