package br.edu.imepac.agendamento.agendamento;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgendamentoSchemaUpdaterTest {

    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final AgendamentoSchemaUpdater updater = new AgendamentoSchemaUpdater(jdbcTemplate);

    @Test
    void run_quandoConstraintJaAceitaAtendido_naoExecutaAlterTable() {
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(AgendamentoSchemaUpdater.STATUS_CONSTRAINT)))
                .thenReturn(List.of("(`status` in ('AGENDADO','CONFIRMADO','CANCELADO','REALIZADO','ATENDIDO'))"));

        updater.run(null);

        verify(jdbcTemplate, never()).execute(anyString());
    }

    @Test
    void run_quandoConstraintAntiga_recriaConstraintComAtendido() {
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq(AgendamentoSchemaUpdater.STATUS_CONSTRAINT)))
                .thenReturn(List.of("(`status` in ('AGENDADO','CONFIRMADO','CANCELADO','REALIZADO'))"));

        updater.run(null);

        verify(jdbcTemplate).execute("ALTER TABLE agendamentos DROP CHECK ck_agendamentos_status");
        verify(jdbcTemplate).execute("""
                ALTER TABLE agendamentos
                  ADD CONSTRAINT ck_agendamentos_status
                  CHECK (status IN ('AGENDADO', 'CONFIRMADO', 'CANCELADO', 'REALIZADO', 'ATENDIDO'))
                """);
    }
}
