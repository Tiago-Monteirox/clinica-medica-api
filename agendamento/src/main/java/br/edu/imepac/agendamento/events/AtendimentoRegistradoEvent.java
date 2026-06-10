package br.edu.imepac.agendamento.events;

import java.time.Instant;
import java.util.UUID;

/**
 * Espelho do evento publicado pelo atendimento.
 * Cópias independentes em cada módulo evitam dependência bidirecional entre serviços.
 */
public record AtendimentoRegistradoEvent(
        UUID eventId,
        String eventType,
        Instant occurredAt,
        Long agendamentoId,
        Long atendimentoId,
        Long pacienteId,
        Long medicoId
) {}
