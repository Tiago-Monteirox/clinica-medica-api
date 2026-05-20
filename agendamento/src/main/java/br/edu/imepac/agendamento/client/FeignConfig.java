package br.edu.imepac.agendamento.client;

import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import br.edu.imepac.commons.exceptions.FeignIntegrationException;
import feign.codec.ErrorDecoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignConfig {

    @Bean
    public ErrorDecoder errorDecoder() {
        return (methodKey, response) -> switch (response.status()) {
            case 404 -> new EntityNotFoundException(
                    "Recurso não encontrado em " + serviceName(methodKey));
            case 502, 503, 504 -> new FeignIntegrationException(
                    serviceName(methodKey) + ": serviço indisponível");
            default -> new FeignIntegrationException(
                    serviceName(methodKey) + ": HTTP " + response.status());
        };
    }

    private String serviceName(String methodKey) {
        return methodKey.split("#")[0];
    }
}
