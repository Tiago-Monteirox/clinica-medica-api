package br.edu.imepac.commons.exceptions.handler;

import br.edu.imepac.commons.dto.ApiResponse;
import br.edu.imepac.commons.exceptions.BusinessException;
import br.edu.imepac.commons.exceptions.EntityNotFoundException;
import br.edu.imepac.commons.exceptions.FeignIntegrationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.GenericBeanDefinition;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
    }

    @Test
    void handleEntityNotFound_retorna404ComMensagem() {
        var ex = new EntityNotFoundException("Convênio não encontrado");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleEntityNotFound(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().isSuccess()).isFalse();
        assertThat(resp.getBody().getMessage()).isEqualTo("Convênio não encontrado");
    }

    @Test
    void handleBusiness_retorna422ComMensagem() {
        var ex = new BusinessException("E-mail já cadastrado");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleBusiness(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(resp.getBody().getMessage()).isEqualTo("E-mail já cadastrado");
    }

    @Test
    void handleValidation_retorna400ComListaDeErros() throws NoSuchMethodException {
        // Cria um BindingResult com 2 FieldErrors e empacota em MethodArgumentNotValidException
        var target = new Object();
        var bindingResult = new BeanPropertyBindingResult(target, "request");
        bindingResult.addError(new FieldError("request", "nome", "O nome é obrigatório"));
        bindingResult.addError(new FieldError("request", "email", "E-mail inválido"));

        Method method = DummyController.class.getDeclaredMethod("dummy", String.class);
        var parameter = new MethodParameter(method, 0);
        var ex = new MethodArgumentNotValidException(parameter, bindingResult);

        ResponseEntity<ApiResponse<Void>> resp = handler.handleValidation(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resp.getBody().getMessage()).isEqualTo("Erro de validação");
        assertThat(resp.getBody().getErrors())
                .containsExactlyInAnyOrder("O nome é obrigatório", "E-mail inválido");
    }

    @Test
    void handleFeignIntegration_retorna502ComMensagem() {
        var ex = new FeignIntegrationException("Falha ao consultar paciente no administrativo");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleFeignIntegration(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(resp.getBody().getMessage()).contains("administrativo");
    }

    @Test
    void handleAccessDenied_retorna403() {
        var ex = new AccessDeniedException("forbidden");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleAccessDenied(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(resp.getBody().getMessage()).isEqualTo("Acesso negado");
    }

    @Test
    void handleNoCredentials_retorna401() {
        var ex = new AuthenticationCredentialsNotFoundException("missing");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleNoCredentials(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(resp.getBody().getMessage()).isEqualTo("Autenticação necessária");
    }

    @Test
    void handleGeneral_retorna500ComMensagemGenerica() {
        var ex = new RuntimeException("kaboom — não deveria vazar pro cliente");

        ResponseEntity<ApiResponse<Void>> resp = handler.handleGeneral(ex);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(resp.getBody().getMessage()).isEqualTo("Erro interno do servidor");
        // a mensagem real da exception NÃO vaza para o cliente
        assertThat(resp.getBody().getMessage()).doesNotContain("kaboom");
    }

    /** Stub usado apenas para satisfazer MethodParameter no teste de validação. */
    @SuppressWarnings("unused")
    private static class DummyController {
        public void dummy(String body) {}
    }

    @SuppressWarnings("unused")
    private static class StubBean extends GenericBeanDefinition {}
}
