package br.edu.imepac.gateway.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;

@Slf4j
@Service
public class JtiBlacklistService {

    private static final String KEY_PREFIX = "jwt:blacklist:";

    private final ReactiveRedisTemplate<String, String> redisTemplate;

    public JtiBlacklistService(ReactiveRedisTemplate<String, String> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    // Adiciona o jti na blacklist ate o token expirar.
    public Mono<Void> revogar(String jti, Instant exp) {
        String key = KEY_PREFIX + jti;
        Duration ttl = Duration.between(Instant.now(), exp);
        if (ttl.isNegative() || ttl.isZero()) {
            return Mono.empty();
        }
        log.info("Revogando jti={} (TTL={}s)", jti, ttl.getSeconds());
        return redisTemplate.opsForValue()
                .set(key, "1", ttl)
                .then();
    }

    public Mono<Boolean> estaRevogado(String jti) {
        return redisTemplate.hasKey(KEY_PREFIX + jti);
    }
}
