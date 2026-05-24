-- ============================================================
-- Clínica Médica — Init do banco do serviço ATENDIMENTO
-- Ambiente: production (1 MySQL dedicado por serviço)
-- Compatível com MySQL 8.x — montado em /docker-entrypoint-initdb.d/
-- ============================================================

-- ── Database ─────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS clinica_atendimento
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Usuário do serviço (princípio do menor privilégio) ───────
CREATE USER IF NOT EXISTS 'svc_atendimento'@'%'
  IDENTIFIED BY 'clinica_atendimento_prod_2026';

GRANT ALL PRIVILEGES ON clinica_atendimento.* TO 'svc_atendimento'@'%';
FLUSH PRIVILEGES;

-- ── Esquema ──────────────────────────────────────────────────
USE clinica_atendimento;

-- agendamento_id é UNIQUE: um agendamento gera no máximo um atendimento.
-- paciente_id e medico_id são denormalizados para evitar Feign em leituras.
CREATE TABLE IF NOT EXISTS atendimentos (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    agendamento_id   BIGINT      NOT NULL,
    paciente_id      BIGINT      NOT NULL,
    medico_id        BIGINT      NOT NULL,
    data_atendimento DATETIME(6) NOT NULL,
    diagnostico      TEXT        NOT NULL,
    prescricao       TEXT        NOT NULL,
    observacoes      TEXT,
    created_at       DATETIME(6) NOT NULL,
    updated_at       DATETIME(6) NOT NULL,
    CONSTRAINT pk_atendimentos            PRIMARY KEY (id),
    CONSTRAINT uq_atendimento_agendamento UNIQUE      (agendamento_id),
    INDEX idx_atendimento_paciente (paciente_id),
    INDEX idx_atendimento_medico   (medico_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;
