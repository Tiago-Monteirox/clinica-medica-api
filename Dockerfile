# ─── Build stage ───────────────────────────────────────────────────────────────
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build

# Copia apenas os pom.xml primeiro → camada de dependências em cache.
# Se só o src/ mudar, o Docker reutiliza essa camada e pula o download.
COPY pom.xml .
COPY commons/pom.xml      commons/
COPY administrativo/pom.xml administrativo/
COPY agendamento/pom.xml  agendamento/
COPY atendimento/pom.xml  atendimento/

RUN mvn dependency:go-offline -B

# Copia código-fonte (invalida o cache apenas quando há mudanças em src/)
COPY commons/src      commons/src
COPY administrativo/src administrativo/src
COPY agendamento/src  agendamento/src
COPY atendimento/src  atendimento/src

ARG MODULE=administrativo
RUN mvn -pl ${MODULE} -am package -DskipTests -B

# ─── Runtime stage ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
ARG MODULE=administrativo
WORKDIR /app

COPY --from=build /build/${MODULE}/target/*.jar app.jar

# MaxRAMPercentage: usa no máximo 75% da memória do container (substitui -Xmx fixo)
# urandom: evita bloqueio em geração de entropy — problema comum em containers
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8081

# 'exec' é obrigatório: substitui o sh pelo processo java como PID 1.
# Sem exec, o SIGTERM do Docker vai para o sh e nunca chega ao Spring Boot,
# quebrando o graceful shutdown.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
