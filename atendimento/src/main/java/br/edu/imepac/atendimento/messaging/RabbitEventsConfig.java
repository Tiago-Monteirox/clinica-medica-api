package br.edu.imepac.atendimento.messaging;

import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitEventsConfig {

    // Constantes do contrato de eventos — precisam ser iguais no consumidor (agendamento).
    public static final String EXCHANGE    = "clinica.events";
    public static final String ROUTING_KEY = "atendimento.registrado";

    // Spring Boot detecta o bean MessageConverter e injeta no RabbitTemplate automaticamente.
    @Bean
    MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
