package br.edu.imepac.agendamento.agendamento;

import br.edu.imepac.agendamento.agendamento.dto.AgendamentoRequest;
import br.edu.imepac.agendamento.agendamento.dto.AgendamentoResponse;
import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import br.edu.imepac.agendamento.client.AdministrativoLookupService;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AgendamentoServiceTest {

    @Mock
    private AgendamentoRepository repository;

    @Mock
    private AdministrativoLookupService lookupService;

    @InjectMocks
    private AgendamentoService service;

    @Test
    void criarDeveLancar404QuandoPacienteNaoExiste() {
        AgendamentoRequest req = new AgendamentoRequest(99L, 1L, LocalDateTime.now().plusDays(7), null);
        when(lookupService.pacienteExiste(99L)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> service.criar(req));
        verify(repository, never()).save(any());
    }

    @Test
    void criarDeveLancar404QuandoMedicoNaoExiste() {
        AgendamentoRequest req = new AgendamentoRequest(1L, 99L, LocalDateTime.now().plusDays(7), null);
        when(lookupService.pacienteExiste(1L)).thenReturn(true);
        when(lookupService.medicoExiste(99L)).thenReturn(false);

        assertThrows(EntityNotFoundException.class, () -> service.criar(req));
        verify(repository, never()).save(any());
    }

    @Test
    void criarDeveLancar422QuandoHorarioConflitar() {
        LocalDateTime dh = LocalDateTime.now().plusDays(7);
        AgendamentoRequest req = new AgendamentoRequest(1L, 1L, dh, null);
        when(lookupService.pacienteExiste(1L)).thenReturn(true);
        when(lookupService.medicoExiste(1L)).thenReturn(true);
        when(repository.existsByMedicoIdAndDataHoraAndStatusIn(eq(1L), eq(dh), any()))
                .thenReturn(true);

        assertThrows(BusinessException.class, () -> service.criar(req));
        verify(repository, never()).save(any());
    }

    @Test
    void criarComDadosValidosDevePersistir() {
        LocalDateTime dh = LocalDateTime.now().plusDays(7);
        AgendamentoRequest req = new AgendamentoRequest(1L, 1L, dh, "obs");
        when(lookupService.pacienteExiste(1L)).thenReturn(true);
        when(lookupService.medicoExiste(1L)).thenReturn(true);
        when(repository.existsByMedicoIdAndDataHoraAndStatusIn(anyLong(), any(), any())).thenReturn(false);
        when(repository.save(any(AgendamentoEntity.class))).thenAnswer(inv -> {
            AgendamentoEntity e = inv.getArgument(0);
            e.setId(42L);
            return e;
        });

        AgendamentoResponse resp = service.criar(req);

        assertEquals(42L, resp.getId());
        assertEquals(StatusAgendamento.AGENDADO, resp.getStatus());
    }

    @Test
    void cancelarDeveLancar422SeJaRealizado() {
        AgendamentoEntity e = AgendamentoEntity.builder()
                .id(1L).status(StatusAgendamento.REALIZADO).build();
        when(repository.findById(1L)).thenReturn(Optional.of(e));

        assertThrows(BusinessException.class, () -> service.cancelar(1L));
    }

    @Test
    void findByMedicoDeveDelegarRepository() {
        when(repository.findByMedicoId(1L)).thenReturn(List.of(
                AgendamentoEntity.builder().id(1L).medicoId(1L).pacienteId(2L)
                        .dataHora(LocalDateTime.now()).status(StatusAgendamento.AGENDADO).build()
        ));
        var lista = service.findByMedico(1L);
        assertEquals(1, lista.size());
    }
}
