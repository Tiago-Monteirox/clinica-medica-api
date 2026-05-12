package br.edu.imepac.commons.exceptions;

public class FeignIntegrationException extends RuntimeException {

    public FeignIntegrationException(String message) {
        super(message);
    }

    public FeignIntegrationException(String message, Throwable cause) {
        super(message, cause);
    }
}
