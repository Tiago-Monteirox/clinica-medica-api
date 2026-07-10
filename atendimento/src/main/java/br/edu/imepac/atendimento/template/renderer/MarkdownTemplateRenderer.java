package br.edu.imepac.atendimento.template.renderer;

import br.edu.imepac.commons.exceptions.BusinessException;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class MarkdownTemplateRenderer implements TemplateRenderer {

    private static final Pattern LOOP_PATTERN = Pattern.compile(
            "\\{\\{#\\s*([a-zA-Z0-9_.]+)\\s*}}([\\s\\S]*?)\\{\\{/\\s*\\1\\s*}}");
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile(
            "\\{\\{\\s*([a-zA-Z0-9_.]+)\\s*}}");

    @Override
    public String render(String template, Map<String, Object> context) {
        String withLoops = renderLoops(template, context);
        return renderPlaceholders(withLoops, context);
    }

    private String renderLoops(String template, Map<String, Object> context) {
        Matcher matcher = LOOP_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();

        while (matcher.find()) {
            String path = matcher.group(1);
            String block = matcher.group(2);
            Object value = resolve(path, context);

            if (!(value instanceof List<?> items)) {
                throw new BusinessException("Campo de lista do template não encontrado: " + path);
            }

            StringBuilder renderedBlock = new StringBuilder();
            for (Object item : items) {
                if (!(item instanceof Map<?, ?> itemMap)) {
                    throw new BusinessException("Item inválido no campo de lista do template: " + path);
                }
                renderedBlock.append(renderPlaceholders(block, context, itemMap));
            }

            matcher.appendReplacement(result, Matcher.quoteReplacement(renderedBlock.toString()));
        }

        matcher.appendTail(result);
        return result.toString();
    }

    private String renderPlaceholders(String template, Map<String, Object> context) {
        return renderPlaceholders(template, context, null);
    }

    private String renderPlaceholders(String template, Map<String, Object> context, Map<?, ?> localContext) {
        Matcher matcher = PLACEHOLDER_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();

        while (matcher.find()) {
            String path = matcher.group(1);
            Object value = resolve(path, context, localContext);
            matcher.appendReplacement(result, Matcher.quoteReplacement(value == null ? "" : value.toString()));
        }

        matcher.appendTail(result);
        return result.toString();
    }

    private Object resolve(String path, Map<String, Object> context) {
        return resolve(path, context, null);
    }

    private Object resolve(String path, Map<String, Object> context, Map<?, ?> localContext) {
        Object localValue = localContext == null ? MissingValue.INSTANCE : resolveFromMap(path, localContext);
        if (localValue != MissingValue.INSTANCE) {
            return localValue;
        }

        Object value = resolveFromMap(path, context);
        if (value == MissingValue.INSTANCE) {
            throw new BusinessException("Campo obrigatório do template não encontrado: " + path);
        }
        return value;
    }

    private Object resolveFromMap(String path, Map<?, ?> context) {
        String[] parts = path.split("\\.");
        Object current = context;

        for (String part : parts) {
            if (!(current instanceof Map<?, ?> map) || !map.containsKey(part)) {
                return MissingValue.INSTANCE;
            }
            current = map.get(part);
        }

        return current;
    }

    private enum MissingValue {
        INSTANCE
    }
}
