package br.edu.imepac.agendamento.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class AdministrativoLookupService {

    private final AdministrativoClient administrativoClient;

    public AdministrativoLookupService(AdministrativoClient administrativoClient) {
        this.administrativoClient = administrativoClient;
    }

    @Cacheable(cacheNames = "paciente-exists", key = "#pacienteId")
    public boolean pacienteExiste(Long pacienteId) {
        log.debug("Cache miss paciente-exists::{} — chamando administrativo via Feign", pacienteId);
        return administrativoClient.pacienteExiste(pacienteId).exists();
    }

    @Cacheable(cacheNames = "medico-exists", key = "#medicoId")
    public boolean medicoExiste(Long medicoId) {
        log.debug("Cache miss medico-exists::{} — chamando administrativo via Feign", medicoId);
        return administrativoClient.medicoExiste(medicoId).exists();
    }
}
