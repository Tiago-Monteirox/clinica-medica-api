package br.edu.imepac.atendimento.template;

import br.edu.imepac.atendimento.template.dto.TemplateClinicoRequest;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

@Configuration
public class TemplateClinicoSeeder {

    @Bean
    CommandLineRunner seedTemplatesClinicos(TemplateClinicoRepository repository,
                                            TemplateClinicoService service) {
        return args -> {
            seed(repository, service, "PRONTUARIO_CONSULTA_GERAL", "Prontuário de consulta geral",
                    TipoTemplateClinico.PRONTUARIO, "templates-clinicos/prontuario-consulta-geral.md");
            seed(repository, service, "HISTORICO_PACIENTE_RESUMIDO", "Histórico do paciente resumido",
                    TipoTemplateClinico.HISTORICO, "templates-clinicos/historico-paciente-resumido.md");
            seed(repository, service, "HISTORICO_PACIENTE_COMPLETO", "Histórico do paciente completo",
                    TipoTemplateClinico.HISTORICO, "templates-clinicos/historico-paciente-completo.md");
            seed(repository, service, "PRESCRICAO_SIMPLES", "Prescrição simples",
                    TipoTemplateClinico.PRESCRICAO, "templates-clinicos/prescricao-simples.md");
            seed(repository, service, "ATESTADO_MEDICO", "Atestado médico",
                    TipoTemplateClinico.ATESTADO, "templates-clinicos/atestado-medico.md");
            seed(repository, service, "SOLICITACAO_EXAMES", "Solicitação de exames",
                    TipoTemplateClinico.EXAME, "templates-clinicos/solicitacao-exames.md");
        };
    }

    private void seed(TemplateClinicoRepository repository,
                      TemplateClinicoService service,
                      String codigo,
                      String nome,
                      TipoTemplateClinico tipo,
                      String resourcePath) throws Exception {
        if (repository.existsByCodigoAndAtivoTrue(codigo)) {
            return;
        }
        ClassPathResource resource = new ClassPathResource(resourcePath);
        String content = resource.getContentAsString(StandardCharsets.UTF_8);
        service.criarNovaVersao(new TemplateClinicoRequest(codigo, nome, tipo, content, "{}"));
    }
}
