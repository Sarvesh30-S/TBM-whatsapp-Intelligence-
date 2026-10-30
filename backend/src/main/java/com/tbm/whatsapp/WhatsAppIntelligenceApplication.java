package com.tbm.whatsapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class WhatsAppIntelligenceApplication {
    public static void main(String[] args) {
        SpringApplication.run(WhatsAppIntelligenceApplication.class, args);
    }
}
