# 11 — Testes

> Pirâmide completa: unit (JUnit + Mockito) + integração (Testcontainers + MockMvc). Tempo estimado: 4h.

## Pirâmide de testes

```
                  /\
                 /  \   ← E2E (Postman / Newman) — poucos, lentos, frágeis
                /────\
               / IT   \  ← Integração (SpringBootTest + Testcontainers)
              /────────\    ~25% — Controller → Service → Repository → MySQL real
             /  Unit    \
            /────────────\  ← Unit (JUnit + Mockito) — ~70%, milisegundos
            └────────────┘     Service isolado, repository mockado
```

**Regra prática por serviço:**

- 1 teste de **unidade** por método público de Service.
- 1 teste de **integração** por endpoint REST (happy path + 1-2 erros).
- Testes E2E manuais via Postman collection (não obrigatórios no CI).

---

## Estrutura de pastas

```
<servico>/
└── src/test/
    ├── java/br/edu/imepac/<servico>/
    │   ├── <feature>/
    │   │   ├── <Feature>ServiceTest.java        ← unit
    │   │   └── <Feature>ControllerIT.java       ← integração
    │   └── support/
    │       └── AbstractIntegrationTest.java     ← base com Testcontainers
    └── resources/
        └── application-test.yml
```

---

## `application-test.yml`

Config específica para testes — Hibernate cria/dropa schema, log mais verboso. O JDBC URL não precisa ser definido aqui se você usar `@DynamicPropertySource` (mais robusto, ver abaixo).

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: create-drop
    show-sql: false
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver

logging:
  level:
    br.edu.imepac: DEBUG
    org.hibernate.SQL: DEBUG

jwt:
  secret: test-secret-with-at-least-256-bits-of-entropy-here-please-12345

# URLs Feign — mockadas com WireMock ou MockBean nos testes
administrativo:
  url: http://localhost:0
agendamento:
  url: http://localhost:0
```

---

## Base com Testcontainers

```java
package br.edu.imepac.administrativo.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@ActiveProfiles("test")
@Testcontainers
public abstract class AbstractIntegrationTest {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8")
        .withDatabaseName("clinica_test")
        .withUsername("root")
        .withPassword("root")
        .withReuse(true);   // reusa o mesmo container entre testes da JVM

    @DynamicPropertySource
    static void registerProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }
}
```

> **`@DynamicPropertySource`** registra a URL do MySQL dinamicamente (porta randomizada pelo Testcontainers). Sem isso, você teria que hardcodear porta e correr o risco de conflito.
>
> **`withReuse(true)`** + arquivo `~/.testcontainers.properties` com `testcontainers.reuse.enable=true` faz o container ficar de pé entre execuções do `mvn test`, acelerando muito o ciclo.

---

## Teste de UNIDADE — Service com Mockito

Exemplo: `ConvenioServiceTest`.

```java
package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.administrativo.convenio.dto.ConvenioRequest;
import br.edu.imepac.commons.exception.BusinessException;
import br.edu.imepac.commons.exception.EntityNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConvenioServiceTest {

    @Mock private ConvenioRepository repository;
    @Mock private ModelMapper modelMapper;

    @InjectMocks private ConvenioService service;

    @Test
    void create_quandoNomeDuplicado_lancaBusinessException() {
        // arrange
        var req = new ConvenioRequest("Unimed", null);
        when(repository.existsByNomeIgnoreCase("Unimed")).thenReturn(true);

        // act + assert
        assertThatThrownBy(() -> service.create(req))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Já existe");

        verify(repository, never()).save(any());
    }

    @Test
    void findById_quandoNaoExiste_lancaNotFound() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.findById(99L))
            .isInstanceOf(EntityNotFoundException.class)
            .hasMessageContaining("Convênio")
            .hasMessageContaining("99");
    }

    @Test
    void create_happyPath_salvaERetornaDto() {
        var req = new ConvenioRequest("Unimed", "Plano premium");
        var entity = ConvenioEntity.builder().id(1L).nome("Unimed").build();
        var response = new ConvenioResponse(); response.setId(1L); response.setNome("Unimed");

        when(repository.existsByNomeIgnoreCase("Unimed")).thenReturn(false);
        when(modelMapper.map(req, ConvenioEntity.class)).thenReturn(entity);
        when(repository.save(entity)).thenReturn(entity);
        when(modelMapper.map(entity, ConvenioResponse.class)).thenReturn(response);

        var result = service.create(req);

        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getNome()).isEqualTo("Unimed");
    }
}
```

**Padrão AAA (Arrange / Act / Assert).** Cada teste tem três blocos visualmente separados.

---

## Teste de INTEGRAÇÃO — Controller com MockMvc + MySQL real

```java
package br.edu.imepac.administrativo.convenio;

import br.edu.imepac.administrativo.support.AbstractIntegrationTest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@AutoConfigureMockMvc
class ConvenioControllerIT extends AbstractIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ConvenioRepository repository;

    @BeforeEach
    void cleanup() {
        repository.deleteAll();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void post_convenio_happyPath() throws Exception {
        var body = objectMapper.writeValueAsString(
            new ConvenioRequestStub("Unimed", "Plano premium"));

        mockMvc.perform(post("/v1/convenios")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.id").exists())
            .andExpect(jsonPath("$.data.nome").value("Unimed"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void post_convenio_nomeDuplicado_retorna422() throws Exception {
        repository.save(ConvenioEntity.builder().nome("Unimed").build());

        mockMvc.perform(post("/v1/convenios")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nome\":\"Unimed\"}"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Já existe")));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void post_convenio_nomeAusente_retorna400() throws Exception {
        mockMvc.perform(post("/v1/convenios")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    @WithMockUser(roles = "RECEPCIONISTA")
    void delete_convenio_recepNaoPode_retorna403() throws Exception {
        var entity = repository.save(ConvenioEntity.builder().nome("Unimed").build());

        mockMvc.perform(delete("/v1/convenios/{id}", entity.getId()))
            .andExpect(status().isForbidden());
    }

    record ConvenioRequestStub(String nome, String descricao) {}
}
```

**Pontos-chave:**

- `@WithMockUser(roles = "ADMIN")` preenche o `SecurityContext` sem precisar emitir JWT real no teste.
- `jsonPath("$.data.nome")` extrai do envelope `ApiResponse<T>`.
- `@BeforeEach` limpa o banco entre testes para isolamento.

---

## Teste de Service que usa Feign — `@MockBean`

Exemplo: `AgendamentoServiceTest` precisa simular o `AdministrativoClient`.

```java
@SpringBootTest
@ActiveProfiles("test")
class AgendamentoServiceFeignTest extends AbstractIntegrationTest {

    @Autowired private AgendamentoService service;
    @Autowired private AgendamentoRepository repository;

    @MockBean private AdministrativoClient administrativoClient;

    @BeforeEach
    void setup() { repository.deleteAll(); }

    @Test
    void criar_quandoPacienteNaoExiste_lancaNotFound() {
        when(administrativoClient.pacienteExiste(99L))
            .thenReturn(new ExistsResponse(false));

        var req = new AgendamentoRequest(99L, 1L,
            LocalDateTime.now().plusDays(1), "obs");

        assertThatThrownBy(() -> service.criar(req))
            .isInstanceOf(EntityNotFoundException.class)
            .hasMessageContaining("Paciente");
    }

    @Test
    void criar_happyPath_salvaERetorna() {
        when(administrativoClient.pacienteExiste(1L))
            .thenReturn(new ExistsResponse(true));
        when(administrativoClient.medicoExiste(1L))
            .thenReturn(new ExistsResponse(true));

        var req = new AgendamentoRequest(1L, 1L,
            LocalDateTime.now().plusDays(1), null);

        var result = service.criar(req);

        assertThat(result.getId()).isNotNull();
        assertThat(result.getStatus()).isEqualTo(StatusAgendamento.AGENDADO);
        verify(administrativoClient).pacienteExiste(1L);
        verify(administrativoClient).medicoExiste(1L);
    }
}
```

> **`@MockBean`** substitui o bean `AdministrativoClient` no contexto Spring por um mock Mockito. Usa quando o teste precisa do contexto Spring (transações, JPA real) mas não pode chamar serviços externos.

---

## Teste de Repository — só JPA

Use `@DataJpaTest` quando quiser testar queries customizadas isoladamente:

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)  // usa MySQL real
@ActiveProfiles("test")
@Testcontainers
class AgendamentoRepositoryTest {

    @Container static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MYSQL::getJdbcUrl);
        r.add("spring.datasource.username", MYSQL::getUsername);
        r.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired private AgendamentoRepository repository;

    @Test
    void existsByMedicoIdAndDataHoraAndStatusIn_acertivo() {
        var ag = AgendamentoEntity.builder()
            .pacienteId(1L).medicoId(1L)
            .dataHora(LocalDateTime.of(2026, 6, 1, 14, 0))
            .status(StatusAgendamento.AGENDADO)
            .build();
        repository.save(ag);

        boolean conflito = repository.existsByMedicoIdAndDataHoraAndStatusIn(
            1L, LocalDateTime.of(2026, 6, 1, 14, 0),
            List.of(StatusAgendamento.AGENDADO, StatusAgendamento.CONFIRMADO));

        assertThat(conflito).isTrue();
    }
}
```

---

## Cobertura por endpoint

Para cada endpoint REST, escreva pelo menos 3 testes:

| Caso | Status esperado |
|---|---|
| Happy path com role correto | 2xx |
| Falta de campo obrigatório | 400 |
| ID inexistente | 404 |
| Regra de negócio violada (duplicidade, conflito) | 422 |
| Sem autenticação | 401 |
| Role insuficiente | 403 |

Dá ~30 testes para o conjunto inteiro de 3 microsserviços. Aceitável.

---

## JaCoCo (cobertura)

Adicione no parent `pom.xml`:

```xml
<build>
  <plugins>
    <plugin>
      <groupId>org.jacoco</groupId>
      <artifactId>jacoco-maven-plugin</artifactId>
      <version>0.8.12</version>
      <executions>
        <execution>
          <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
          <id>report</id>
          <phase>verify</phase>
          <goals><goal>report</goal></goals>
        </execution>
        <execution>
          <id>check</id>
          <goals><goal>check</goal></goals>
          <configuration>
            <rules>
              <rule>
                <element>BUNDLE</element>
                <limits>
                  <limit>
                    <counter>LINE</counter>
                    <value>COVEREDRATIO</value>
                    <minimum>0.70</minimum>
                  </limit>
                </limits>
              </rule>
            </rules>
          </configuration>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

Roda em `mvn verify`. Quebra o build se cobertura < 70%. Relatório HTML em `<servico>/target/site/jacoco/index.html`.

---

## Postman collection (E2E manual)

Inspirar-se no `app-order-service/imepac-order-system.postman_collection.json`. Estrutura:

```
Clinica Médica
├── 1. Login (admin)
│   └── (script salva token em variável de ambiente)
├── 2. Convênio
│   ├── Listar
│   ├── Criar
│   ├── Buscar por ID
│   ├── Atualizar
│   └── Remover
├── 3. Paciente
│   ├── ...
├── 4. Médico
├── 5. Agendamento
│   ├── Criar (com paciente/médico válidos)
│   ├── Tentar com paciente inválido (404)
│   └── Tentar conflito horário (422)
└── 6. Atendimento
    └── ...
```

Para rodar no CI: `npm i -g newman && newman run collection.json`.

---

## Comandos

```bash
# Rodar todos os testes
mvn clean verify

# Só de um módulo
mvn test -pl agendamento

# Só uma classe
mvn test -pl administrativo -Dtest=ConvenioServiceTest

# Pular Testcontainers (só unit)
mvn test -pl administrativo -DexcludedGroups=integration
```

> Para `@Tag("integration")` em IT classes, configure o `surefire-plugin` com `excludedGroups`. Permite separar runs rápidos (só unit) de runs completos (CI).

---

## Boas práticas

1. **Um assert por teste** quando possível. Falha mais clara.
2. **Nomes descritivos.** `metodo_quandoCondicao_resultadoEsperado` (ex: `create_quandoNomeDuplicado_lancaBusinessException`).
3. **Não compartilhe estado entre testes.** Use `@BeforeEach` para limpar.
4. **Não mocke o que você está testando.** Mocke as dependências (repository, client), não o service em teste.
5. **Não teste getters/setters.** Lombok já fez. Foque no comportamento.
6. **Prefira `assertThatThrownBy`** (AssertJ) a `assertThrows` (JUnit). Encadeia melhor.
7. **`@MockBean` é caro** (recria contexto). Prefira `@Mock` em testes de unidade puros.

---

## Checklist por serviço

- [ ] `application-test.yml` com `ddl-auto=create-drop`
- [ ] `AbstractIntegrationTest` com Testcontainers MySQL
- [ ] `*ServiceTest` para cada Service (Mockito puro)
- [ ] `*ControllerIT` para cada Controller (MockMvc + Testcontainers)
- [ ] Casos cobertos: happy path, 400, 404, 422, 401/403
- [ ] `@MockBean` para Feign clients em testes de service
- [ ] `mvn clean verify` passa em todos os módulos
- [ ] Cobertura JaCoCo ≥ 70%

---

## Próximo passo

[`12-TECNOLOGIAS.md`](12-TECNOLOGIAS.md) — referência detalhada de cada tecnologia.
