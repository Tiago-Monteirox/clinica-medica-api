-- ============================================================
-- Clínica Médica — Init do banco do serviço ADMINISTRATIVO
-- Ambiente: production (1 MySQL dedicado por serviço)
-- Compatível com MySQL 8.x — montado em /docker-entrypoint-initdb.d/
-- ============================================================

-- ── Database ─────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS clinica_administrativo
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Usuário do serviço (princípio do menor privilégio) ───────
-- svc_administrativo só enxerga clinica_administrativo.
CREATE USER IF NOT EXISTS 'svc_administrativo'@'%'
  IDENTIFIED BY 'clinica_administrativo_prod_2026';

GRANT ALL PRIVILEGES ON clinica_administrativo.* TO 'svc_administrativo'@'%';
FLUSH PRIVILEGES;

-- ── Esquema ──────────────────────────────────────────────────
USE clinica_administrativo;

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

-- Seed do admin: criado em runtime pelo CommandLineRunner em
-- AdministrativoApplication.seedAdmin (admin@clinica.com / admin123).
