package br.edu.imepac.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.security.Principal;

@Configuration
public class RateLimitConfig {

    // Identifica o solicitante para o RequestRateLimiter:
    // 1) preferir o Principal (usuario autenticado);
    // 2) cair pro IP de origem quando o filtro JWT ainda não populou contexto;
    // 3) "anonymous" como ultimo recurso (sem header X-Forwarded-For).
    @Bean
    public KeyResolver userOrIpKeyResolver() {
        return exchange -> exchange.getPrincipal()
                .map(Principal::getName)
                .switchIfEmpty(Mono.fromCallable(() -> {
                    InetSocketAddress addr = exchange.getRequest().getRemoteAddress();
                    if (addr != null && addr.getAddress() != null) {
                        return addr.getAddress().getHostAddress();
                    }
                    return "anonymous";
                }));
    }
}
