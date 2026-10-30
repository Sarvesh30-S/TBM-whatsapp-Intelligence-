package com.tbm.whatsapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class AiProviderConfiguration {
    @Bean("openAiRestClient")
    RestClient openAiRestClient(@Value("${app.ai.openai-base-url:https://api.openai.com}") String baseUrl) {
        return RestClient.builder().baseUrl(baseUrl).build();
    }

    @Bean("sarvamRestClient")
    RestClient sarvamRestClient(@Value("${app.ai.sarvam-base-url:https://api.sarvam.ai}") String baseUrl) {
        return RestClient.builder().baseUrl(baseUrl).build();
    }
}
