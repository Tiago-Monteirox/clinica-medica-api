package br.edu.imepac.agendamento.messaging;

import br.edu.imepac.agendamento.agendamento.AgendamentoRepository;
import br.edu.imepac.agendamento.agendamento.enums.StatusAgendamento;
import br.edu.imepac.agendamento.events.AtendimentoRegistradoEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
public class AtendimentoRegistradoConsumer {

    private final AgendamentoRepository repository;

    public AtendimentoRegistradoConsumer(AgendamentoRepository repository) {
        this.repository = repository;
    }

    @RabbitListener(queues = RabbitEventsConfig.QUEUE)
    @Transactional
    public void consumir(AtendimentoRegistradoEvent event) {
        log.info("Recebendo AtendimentoRegistradoEvent: eventId={} agendamentoId={}",
                event.eventId(), event.agendamentoId());

        var agendamento = repository.findById(event.agendamentoId())
                .orElse(null);

        if (agendamento == null) {
            // Agendamento nao existe — pode ter sido deletado. Loga e descarta.
            // Em caso de processamento repetido com ID invalido, vai para DLQ apos retries.
            log.warn("AtendimentoRegistradoEvent: agendamento {} nao encontrado (eventId={})",
                    event.agendamentoId(), event.eventId());
            throw new IllegalStateException(
                    "Agendamento " + event.agendamentoId() + " nao encontrado — enviando para DLQ");
        }

        // Idempotencia por estado: se ja esta ATENDIDO, ignora silenciosamente.
        if (agendamento.getStatus() == StatusAgendamento.ATENDIDO) {
            log.info("Agendamento {} ja esta ATENDIDO — descartando evento duplicado (eventId={})",
                    event.agendamentoId(), event.eventId());
            return;
        }

        agendamento.setStatus(StatusAgendamento.ATENDIDO);
        repository.save(agendamento);
        log.info("Agendamento {} atualizado para ATENDIDO (eventId={})",
                event.agendamentoId(), event.eventId());
    }
}
