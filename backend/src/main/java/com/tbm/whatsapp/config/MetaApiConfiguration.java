package com.tbm.whatsapp.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(MetaApiProperties.class)
public class MetaApiConfiguration {
    @Bean
    RestClient metaRestClient(MetaApiProperties properties) {
        return RestClient.builder().baseUrl(properties.graphApiBaseUrl()).build();
    }
}
