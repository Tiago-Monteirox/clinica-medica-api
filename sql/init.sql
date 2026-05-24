-- ============================================================
-- Clínica Médica — Script de criação / inicialização do banco
-- Compatível com MySQL 8.x
-- Gerado para ser montado em /docker-entrypoint-initdb.d/
-- ============================================================

-- ── Bancos de dados ──────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS clinica_administrativo
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS clinica_agendamento
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS clinica_atendimento
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- ============================================================
-- Módulo: administrativo
-- ============================================================
USE clinica_administrativo;

-- ── convenios ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS convenios (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    nome       VARCHAR(150) NOT NULL,
    descricao  VARCHAR(500),
    created_at DATETIME(6)  NOT NULL,
    updated_at DATETIME(6)  NOT NULL,
    CONSTRAINT pk_convenios      PRIMARY KEY (id),
    CONSTRAINT uq_convenios_nome UNIQUE      (nome)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ── medicos ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicos (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    nome          VARCHAR(150) NOT NULL,
    email         VARCHAR(200) NOT NULL,
    crm           VARCHAR(20)  NOT NULL,
    especialidade VARCHAR(100) NOT NULL,
    telefone      VARCHAR(20),
    created_at    DATETIME(6)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    CONSTRAINT pk_medicos       PRIMARY KEY (id),
    CONSTRAINT uq_medicos_email UNIQUE      (email),
    CONSTRAINT uq_medicos_crm   UNIQUE      (crm)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ── pacientes ─────────────────────────────────────────────────
-- convenio_id é nullable: paciente pode não ter convênio
CREATE TABLE IF NOT EXISTS pacientes (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    nome             VARCHAR(150) NOT NULL,
    email            VARCHAR(200) NOT NULL,
    cpf              CHAR(11)     NOT NULL,
    telefone         VARCHAR(20),
    data_nascimento  DATE,
    convenio_id      BIGINT,
    created_at       DATETIME(6)  NOT NULL,
    updated_at       DATETIME(6)  NOT NULL,
    CONSTRAINT pk_pacientes       PRIMARY KEY (id),
    CONSTRAINT uq_pacientes_email UNIQUE      (email),
    CONSTRAINT uq_pacientes_cpf   UNIQUE      (cpf),
    CONSTRAINT fk_pacientes_convenio
        FOREIGN KEY (convenio_id) REFERENCES convenios (id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- ── usuarios ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    nome       VARCHAR(150) NOT NULL,
    email      VARCHAR(200) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    role       VARCHAR(20)  NOT NULL,
    created_at DATETIME(6)  NOT NULL,
    CONSTRAINT pk_usuarios       PRIMARY KEY (id),
    CONSTRAINT uq_usuarios_email UNIQUE      (email),
    CONSTRAINT ck_usuarios_role
        CHECK (role IN ('ADMIN', 'RECEPCIONISTA', 'MEDICO', 'PACIENTE'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- Seed do admin: feito em runtime pelo CommandLineRunner em
-- AdministrativoApplication.seedAdmin (admin@clinica.com / admin123, role ADMIN).
-- Mantido lá para que o hash seja sempre coerente com o BCryptPasswordEncoder
-- do Spring, em vez de um hash hardcoded que pode descolar do encoder.


-- ============================================================
-- Módulo: agendamento
-- ============================================================
USE clinica_agendamento;

-- ── agendamentos ─────────────────────────────────────────────
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


-- ============================================================
-- Módulo: atendimento
-- ============================================================
USE clinica_atendimento;

-- ── atendimentos ─────────────────────────────────────────────
-- agendamento_id é UNIQUE: um agendamento gera no máximo um atendimento
-- paciente_id e medico_id são denormalizados para evitar chamada Feign em leituras
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
