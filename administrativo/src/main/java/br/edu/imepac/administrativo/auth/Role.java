package br.edu.imepac.administrativo.auth;

public enum Role {
    ADMIN,          // acesso total
    RECEPCIONISTA,  // cadastros e agendamentos
    MEDICO,         // atendimentos
    PACIENTE        // visualização própria
}
