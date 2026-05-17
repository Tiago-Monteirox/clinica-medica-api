package br.edu.imepac.commons.exceptions;

public class EntityNotFoundException extends RuntimeException {

    public EntityNotFoundException(String message) {
        super(message);
    }

    /**
     * Conveniência para criar mensagem baseada em entidade e id, por ex: "Paciente com id 1 não encontrado".
     */
    public EntityNotFoundException(String entityName, Long id) {
        super(String.format("%s com id %d não encontrado", entityName, id));
    }
}
