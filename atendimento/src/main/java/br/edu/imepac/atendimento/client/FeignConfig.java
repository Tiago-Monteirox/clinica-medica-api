package br.edu.imepac.atendimento.client;

import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import br.edu.imepac.commons.exceptions.FeignIntegrationException;
import feign.RequestInterceptor;
import feign.codec.ErrorDecoder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

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

    @Bean
    public RequestInterceptor authForwardingInterceptor() {
        return template -> {
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes servlet) {
                String auth = servlet.getRequest().getHeader("Authorization");
                if (auth != null && !auth.isBlank()) {
                    template.header("Authorization", auth);
                }
            }
        };
    }

    private String serviceName(String methodKey) {
        return methodKey.split("#")[0];
    }
}
