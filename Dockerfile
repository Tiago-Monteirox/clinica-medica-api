# Runtime-only stage.
# Os JARs são buildados no host (mvn clean package -DskipTests) antes do
# `docker compose up --build`. O `.dockerignore` libera apenas **/target/*.jar.
FROM eclipse-temurin:21-jre-alpine
ARG MODULE=administrativo
WORKDIR /app

COPY ${MODULE}/target/${MODULE}-*-SNAPSHOT.jar app.jar

ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

# exec → java vira PID 1; SIGTERM chega no Spring Boot e o graceful shutdown funciona.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
