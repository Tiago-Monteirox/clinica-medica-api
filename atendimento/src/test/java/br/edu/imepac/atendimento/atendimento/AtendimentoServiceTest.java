package br.edu.imepac.atendimento.atendimento;

import br.edu.imepac.atendimento.atendimento.dto.AtendimentoRequest;
import br.edu.imepac.atendimento.atendimento.dto.AtendimentoResponse;
import br.edu.imepac.atendimento.client.AgendamentoClient;
import br.edu.imepac.commons.dto.ApiResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AtendimentoServiceTest {

    @Mock
    private AtendimentoRepository repository;

    @Mock
    private AgendamentoClient agendamentoClient;

    @InjectMocks
    private AtendimentoService service;

    @Test
    void registrarDeveLancar422SeAgendamentoJaTemAtendimento() {
        AtendimentoRequest req = new AtendimentoRequest(1L, "diag", "presc", null);
        when(repository.existsByAgendamentoId(1L)).thenReturn(true);
        assertThrows(BusinessException.class, () -> service.registrar(req));
        verify(repository, never()).save(any());
    }

    @Test
    void registrarDeveLancar404QuandoAgendamentoNaoExiste() {
        AtendimentoRequest req = new AtendimentoRequest(99L, "d", "p", null);
        when(repository.existsByAgendamentoId(99L)).thenReturn(false);
        when(agendamentoClient.buscar(99L)).thenReturn(ApiResponse.success(null));

        assertThrows(EntityNotFoundException.class, () -> service.registrar(req));
    }

    @Test
    void registrarDeveLancar422SeStatusInvalido() {
        AtendimentoRequest req = new AtendimentoRequest(1L, "d", "p", null);
        when(repository.existsByAgendamentoId(1L)).thenReturn(false);
        var snap = new AgendamentoClient.AgendamentoSnapshot(
                1L, 2L, 3L, LocalDateTime.now(), "CANCELADO", null);
        when(agendamentoClient.buscar(1L)).thenReturn(ApiResponse.success(snap));

        assertThrows(BusinessException.class, () -> service.registrar(req));
    }

    @Test
    void registrarComStatusAgendadoDevePersistir() {
        AtendimentoRequest req = new AtendimentoRequest(1L, "diag", "presc", "obs");
        when(repository.existsByAgendamentoId(1L)).thenReturn(false);
        var snap = new AgendamentoClient.AgendamentoSnapshot(
                1L, 10L, 20L, LocalDateTime.now(), "AGENDADO", null);
        when(agendamentoClient.buscar(1L)).thenReturn(ApiResponse.success(snap));
        when(repository.save(any(AtendimentoEntity.class))).thenAnswer(inv -> {
            AtendimentoEntity e = inv.getArgument(0);
            e.setId(7L);
            return e;
        });

        AtendimentoResponse resp = service.registrar(req);

        assertEquals(7L, resp.getId());
        assertEquals(10L, resp.getPacienteId());
        assertEquals(20L, resp.getMedicoId());
        assertEquals("diag", resp.getDiagnostico());
    }

    @Test
    void deleteDeveLancar404QuandoNaoExistir() {
        when(repository.existsById(99L)).thenReturn(false);
        assertThrows(EntityNotFoundException.class, () -> service.delete(99L));
        verify(repository, never()).deleteById(any());
    }
}
