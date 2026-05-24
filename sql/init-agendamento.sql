-- ============================================================
-- Clínica Médica — Init do banco do serviço AGENDAMENTO
-- Ambiente: production (1 MySQL dedicado por serviço)
-- Compatível com MySQL 8.x — montado em /docker-entrypoint-initdb.d/
-- ============================================================

-- ── Database ─────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS clinica_agendamento
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Usuário do serviço (princípio do menor privilégio) ───────
CREATE USER IF NOT EXISTS 'svc_agendamento'@'%'
  IDENTIFIED BY 'clinica_agendamento_prod_2026';

GRANT ALL PRIVILEGES ON clinica_agendamento.* TO 'svc_agendamento'@'%';
FLUSH PRIVILEGES;

-- ── Esquema ──────────────────────────────────────────────────
USE clinica_agendamento;

CREATE TABLE IF NOT EXISTS agendamentos (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    paciente_id BIGINT       NOT NULL,
    medico_id   BIGINT       NOT NULL,
    data_hora   DATETIME(6)  NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'AGENDADO',
    observacoes VARCHAR(500),
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    CONSTRAINT pk_agendamentos    PRIMARY KEY (id),
    CONSTRAINT ck_agendamentos_status
        CHECK (status IN ('AGENDADO', 'CONFIRMADO', 'CANCELADO', 'REALIZADO')),
    INDEX idx_agendamento_medico_data (medico_id, data_hora),
    INDEX idx_agendamento_paciente    (paciente_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
