package br.edu.imepac.gateway.auth;

import br.edu.imepac.gateway.security.JtiBlacklistService;
import br.edu.imepac.gateway.security.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Slf4j
@RestController
@RequestMapping("/auth")
public class LogoutController {

    private final JwtUtil jwtUtil;
    private final JtiBlacklistService blacklistService;

    public LogoutController(JwtUtil jwtUtil, JtiBlacklistService blacklistService) {
        this.jwtUtil = jwtUtil;
        this.blacklistService = blacklistService;
    }

    @PostMapping("/logout")
    public Mono<ResponseEntity<Void>> logout(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
        }
        try {
            Claims claims = jwtUtil.parse(authHeader.substring(7));
            String jti = claims.getId();
            Instant exp = claims.getExpiration().toInstant();
            log.info("Logout solicitado: sub={} jti={}", claims.getSubject(), jti);
            return blacklistService.revogar(jti, exp)
                    .thenReturn(ResponseEntity.<Void>noContent().build());
        } catch (Exception e) {
            log.warn("Logout com token inválido: {}", e.getMessage());
            return Mono.just(ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
        }
    }
}
