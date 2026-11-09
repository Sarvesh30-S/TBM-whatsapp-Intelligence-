package com.tbm.whatsapp.service;

import com.tbm.whatsapp.entity.ConversationSummary;
import com.tbm.whatsapp.repository.ConversationSummaryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("supabase")
class SupabaseSummarizationVerificationTest {

    @Autowired
    private ConversationIntelligenceService intelligence;

    @Autowired
    private ConversationSummaryRepository summaryRepo;

    @Autowired
    private GroqContentService groqService;

    @Test
    void testGroqModelConfigurationAndSaveSummaryToSupabase() throws Exception {
        // Verify model configuration is updated to openai/gpt-oss-120b
        assertThat(groqService.modelName()).isEqualTo("openai/gpt-oss-120b");
        assertThat(groqService.endpoint()).isEqualTo("https://api.groq.com/openai/v1/chat/completions");

        UUID podId = UUID.fromString("7127d888-d5a7-4eff-ba8c-1e30045693ed");

        // Execute summarization test (force = true)
        ConversationSummary summary = intelligence.summarize(podId, true);

        assertThat(summary).isNotNull();
        assertThat(summary.getSummaryText()).isNotEmpty();
        assertThat(summary.getWhatsappGroupId()).isEqualTo(podId);

        // Verify summary is persisted in Supabase
        var found = summaryRepo.findById(summary.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getId()).isEqualTo(summary.getId());
        System.out.println("VERIFIED_SUPABASE_SUMMARY_ID=" + summary.getId());
        System.out.println("VERIFIED_PROVIDER=" + summary.getProvider());
        System.out.println("VERIFIED_MODEL=" + summary.getModel());
        System.out.println("VERIFIED_SUMMARY_TEXT=" + summary.getSummaryText());
    }
}
