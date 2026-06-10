package br.edu.imepac.atendimento.events;

import java.time.Instant;
import java.util.UUID;

/**
 * Evento publicado pelo atendimento no exchange clinica.events
 * com routing key atendimento.registrado.
 * Carrega apenas IDs — dados clínicos (diagnóstico/prescrição) ficam no banco do atendimento.
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
