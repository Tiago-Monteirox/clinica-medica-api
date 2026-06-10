package br.edu.imepac.atendimento.messaging;

import br.edu.imepac.atendimento.atendimento.AtendimentoEntity;
import br.edu.imepac.atendimento.events.AtendimentoRegistradoEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AtendimentoEventPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private AtendimentoEventPublisher publisher;

    @Test
    void publicarAtendimentoRegistrado_enviaEventoComIDsCorretos() {
        AtendimentoEntity atendimento = AtendimentoEntity.builder()
                .id(99L)
                .agendamentoId(42L)
                .pacienteId(10L)
                .medicoId(20L)
                .build();

        publisher.publicarAtendimentoRegistrado(atendimento);

        ArgumentCaptor<AtendimentoRegistradoEvent> captor =
                ArgumentCaptor.forClass(AtendimentoRegistradoEvent.class);
        verify(rabbitTemplate).convertAndSend(
                eq(RabbitEventsConfig.EXCHANGE),
                eq(RabbitEventsConfig.ROUTING_KEY),
                captor.capture());

        AtendimentoRegistradoEvent evento = captor.getValue();
        assertThat(evento.atendimentoId()).isEqualTo(99L);
        assertThat(evento.agendamentoId()).isEqualTo(42L);
        assertThat(evento.pacienteId()).isEqualTo(10L);
        assertThat(evento.medicoId()).isEqualTo(20L);
        assertThat(evento.eventId()).isNotNull();
        assertThat(evento.eventType()).isEqualTo("AtendimentoRegistrado");
        assertThat(evento.occurredAt()).isNotNull();
    }
}
