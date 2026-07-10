package br.edu.imepac.atendimento.template;

import br.edu.imepac.atendimento.template.renderer.MarkdownTemplateRenderer;
import br.edu.imepac.commons.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MarkdownTemplateRendererTest {

    private final MarkdownTemplateRenderer renderer = new MarkdownTemplateRenderer();

    @Test
    void renderizaPlaceholdersSimplesELista() {
        String template = "Paciente {{paciente.nome}}\n{{#historico.itens}}- {{data}}: {{resumo}}\n{{/historico.itens}}";

        Map<String, Object> paciente = new LinkedHashMap<>();
        paciente.put("nome", "Ana");
        Map<String, Object> historico = new LinkedHashMap<>();
        historico.put("itens", List.of(
                Map.of("data", "2026-07-09", "resumo", "Consulta"),
                Map.of("data", "2026-06-01", "resumo", "Retorno")
        ));
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("paciente", paciente);
        context.put("historico", historico);

        String result = renderer.render(template, context);

        assertEquals("""
                Paciente Ana
                - 2026-07-09: Consulta
                - 2026-06-01: Retorno
                """, result);
    }

    @Test
    void falhaQuandoPlaceholderNaoExiste() {
        assertThrows(BusinessException.class, () -> renderer.render("{{paciente.nome}}", Map.of()));
    }
}
