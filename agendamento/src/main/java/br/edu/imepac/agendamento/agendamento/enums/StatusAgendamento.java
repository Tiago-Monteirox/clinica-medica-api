package br.edu.imepac.agendamento.agendamento.enums;

public enum StatusAgendamento {
    AGENDADO,
    CONFIRMADO,
    CANCELADO,
    REALIZADO,
    /** Atualizado de forma assíncrona quando o atendimento é registrado via RabbitMQ. */
    ATENDIDO
}
