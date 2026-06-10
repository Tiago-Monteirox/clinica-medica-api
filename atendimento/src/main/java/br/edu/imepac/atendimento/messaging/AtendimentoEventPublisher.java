package br.edu.imepac.atendimento.messaging;

import br.edu.imepac.atendimento.atendimento.AtendimentoEntity;
import br.edu.imepac.atendimento.events.AtendimentoRegistradoEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Component
public class AtendimentoEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public AtendimentoEventPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publicarAtendimentoRegistrado(AtendimentoEntity atendimento) {
        var event = new AtendimentoRegistradoEvent(
                UUID.randomUUID(),
                "AtendimentoRegistrado",
                Instant.now(),
                atendimento.getAgendamentoId(),
                atendimento.getId(),
                atendimento.getPacienteId(),
                atendimento.getMedicoId()
        );
        log.info("Publicando AtendimentoRegistradoEvent: eventId={} agendamentoId={} atendimentoId={}",
                event.eventId(), event.agendamentoId(), event.atendimentoId());
        rabbitTemplate.convertAndSend(
                RabbitEventsConfig.EXCHANGE,
                RabbitEventsConfig.ROUTING_KEY,
                event
        );
    }
}
