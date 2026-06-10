package br.edu.imepac.agendamento.messaging;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitEventsConfig {

    public static final String EXCHANGE    = "clinica.events";
    public static final String QUEUE       = "agendamento.atendimento-registrado";
    public static final String ROUTING_KEY = "atendimento.registrado";
    public static final String DLQ         = QUEUE + ".dlq";
    public static final String DLQ_ROUTING_KEY = ROUTING_KEY + ".dlq";

    @Bean
    TopicExchange clinicaEventsExchange() {
        return ExchangeBuilder.topicExchange(EXCHANGE)
                .durable(true)
                .build();
    }

    @Bean
    Queue atendimentoRegistradoQueue() {
        return QueueBuilder.durable(QUEUE)
                .withArgument("x-dead-letter-exchange", EXCHANGE)
                .withArgument("x-dead-letter-routing-key", DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    Queue atendimentoRegistradoDlq() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    Binding atendimentoRegistradoBinding() {
        return BindingBuilder
                .bind(atendimentoRegistradoQueue())
                .to(clinicaEventsExchange())
                .with(ROUTING_KEY);
    }

    @Bean
    Binding atendimentoRegistradoDlqBinding() {
        return BindingBuilder
                .bind(atendimentoRegistradoDlq())
                .to(clinicaEventsExchange())
                .with(DLQ_ROUTING_KEY);
    }

    // Serializa/desserializa mensagens como JSON.
    @Bean
    MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jsonMessageConverter());
        return factory;
    }
}
