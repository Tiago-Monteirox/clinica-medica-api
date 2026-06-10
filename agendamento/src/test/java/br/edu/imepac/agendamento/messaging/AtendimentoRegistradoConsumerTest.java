package br.edu.imepac.agendamento.messaging;

import br.edu.imepac.agendamento.agendamento.AgendamentoEntity;
import br.edu.imepac.agendamento.agendamento.AgendamentoRepository;
import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import br.edu.imepac.agendamento.events.AtendimentoRegistradoEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AtendimentoRegistradoConsumerTest {

    @Mock
    private AgendamentoRepository repository;

    @InjectMocks
    private AtendimentoRegistradoConsumer consumer;

    private AtendimentoRegistradoEvent evento(Long agendamentoId) {
        return new AtendimentoRegistradoEvent(
                UUID.randomUUID(), "AtendimentoRegistrado", Instant.now(),
                agendamentoId, 99L, 10L, 20L);
    }

    @Test
    void consumir_atualizaStatusParaATENDIDO() {
        AgendamentoEntity agendamento = AgendamentoEntity.builder()
                .id(1L).pacienteId(10L).medicoId(20L)
                .dataHora(LocalDateTime.now()).status(StatusAgendamento.AGENDADO).build();
        when(repository.findById(1L)).thenReturn(Optional.of(agendamento));
        when(repository.save(any())).thenReturn(agendamento);

        consumer.consumir(evento(1L));

        assertThat(agendamento.getStatus()).isEqualTo(StatusAgendamento.ATENDIDO);
        verify(repository).save(agendamento);
    }

    @Test
    void consumir_idempotencia_jaAtendido_naoSalvaNovamente() {
        AgendamentoEntity agendamento = AgendamentoEntity.builder()
                .id(2L).pacienteId(10L).medicoId(20L)
                .dataHora(LocalDateTime.now()).status(StatusAgendamento.ATENDIDO).build();
        when(repository.findById(2L)).thenReturn(Optional.of(agendamento));

        consumer.consumir(evento(2L));

        verify(repository, never()).save(any());
    }

    @Test
    void consumir_agendamentoInexistente_lancaExcecaoParaDLQ() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThrows(IllegalStateException.class, () -> consumer.consumir(evento(99L)));
        verify(repository, never()).save(any());
    }
}
