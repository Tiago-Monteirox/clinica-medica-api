package br.edu.imepac.agendamento.agendamento;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Slf4j
@Component
@Profile("!test")
class AgendamentoSchemaUpdater implements ApplicationRunner {

    static final String STATUS_CONSTRAINT = "ck_agendamentos_status";

    private static final String FIND_STATUS_CHECK = """
            SELECT cc.CHECK_CLAUSE
              FROM information_schema.TABLE_CONSTRAINTS tc
              JOIN information_schema.CHECK_CONSTRAINTS cc
                ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
               AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
             WHERE tc.CONSTRAINT_SCHEMA = DATABASE()
               AND tc.TABLE_NAME = 'agendamentos'
               AND tc.CONSTRAINT_TYPE = 'CHECK'
               AND tc.CONSTRAINT_NAME = ?
            """;

    private static final String DROP_STATUS_CHECK =
            "ALTER TABLE agendamentos DROP CHECK " + STATUS_CONSTRAINT;

    private static final String ADD_STATUS_CHECK = """
            ALTER TABLE agendamentos
              ADD CONSTRAINT ck_agendamentos_status
              CHECK (status IN ('AGENDADO', 'CONFIRMADO', 'CANCELADO', 'REALIZADO', 'ATENDIDO'))
            """;

    private final JdbcTemplate jdbcTemplate;

    AgendamentoSchemaUpdater(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            Optional<String> currentCheck = findStatusCheckClause();
            if (currentCheck.map(clause -> clause.contains("ATENDIDO")).orElse(false)) {
                log.info("Check constraint {} ja aceita status ATENDIDO", STATUS_CONSTRAINT);
                return;
            }

            currentCheck.ifPresent(clause -> {
                log.info("Atualizando check constraint {} para aceitar status ATENDIDO", STATUS_CONSTRAINT);
                jdbcTemplate.execute(DROP_STATUS_CHECK);
            });
            if (currentCheck.isEmpty()) {
                log.info("Criando check constraint {} para status de agendamento", STATUS_CONSTRAINT);
            }
            jdbcTemplate.execute(ADD_STATUS_CHECK);
        } catch (DataAccessException ex) {
            throw new IllegalStateException("Falha ao ajustar check constraint de status dos agendamentos", ex);
        }
    }

    private Optional<String> findStatusCheckClause() {
        List<String> clauses = jdbcTemplate.queryForList(FIND_STATUS_CHECK, String.class, STATUS_CONSTRAINT);
        return clauses.stream().findFirst();
    }
}
