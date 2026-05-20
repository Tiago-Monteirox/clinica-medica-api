package br.edu.imepac.agendamento.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "administrativo",
        url = "${administrativo.url}",
        configuration = FeignConfig.class)
public interface AdministrativoClient {

    @GetMapping("/v1/pacientes/{id}/exists")
    ExistsResponse pacienteExiste(@PathVariable("id") Long id);

    @GetMapping("/v1/medicos/{id}/exists")
    ExistsResponse medicoExiste(@PathVariable("id") Long id);
}
