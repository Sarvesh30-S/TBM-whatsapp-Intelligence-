package com.tbm.whatsapp.service;

import com.tbm.whatsapp.entity.WhatsAppMessageAsset;
import com.tbm.whatsapp.repository.WhatsAppMessageAssetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

@Component
public class WhatsAppMessageAssetWorker {
    private static final Logger log = LoggerFactory.getLogger(WhatsAppMessageAssetWorker.class);
    private final WhatsAppMessageAssetRepository assets;
    private final MetaMediaDownloadService downloader;
    private final SarvamTranscriptionService sarvam;
    private final OpenAiContentService openAi;
    private final long maxBytes;

    public WhatsAppMessageAssetWorker(WhatsAppMessageAssetRepository assets,
                                      MetaMediaDownloadService downloader,
                                      SarvamTranscriptionService sarvam,
                                      OpenAiContentService openAi,
                                      @Value("${app.media.max-bytes:20971520}") long maxBytes) {
        this.assets = assets;
        this.downloader = downloader;
        this.sarvam = sarvam;
        this.openAi = openAi;
        this.maxBytes = maxBytes;
    }

    @Scheduled(fixedDelayString = "${app.ai.worker-delay-ms:5000}")
    public synchronized void processPendingAssets() {
        List<WhatsAppMessageAsset> batch = assets.findAllByStatusInOrderByCreatedAtAsc(
                List.of("DOWNLOAD_PENDING", "DOWNLOADED", "WAITING_FOR_PROVIDER", "PROCESSING"), PageRequest.of(0, 5));
        for (WhatsAppMessageAsset asset : batch) {
            if (StringUtils.hasText(asset.getStorageKey()) && !providerConfigured(asset)) continue;
            try {
                if (!StringUtils.hasText(asset.getStorageKey())) download(asset);
                if (StringUtils.hasText(asset.getStorageKey()) && !"READY".equals(asset.getStatus())) extract(asset);
            } catch (MetaMediaDownloadService.UnsupportedMediaException exception) {
                asset.markUnsupported(exception.getMessage());
                assets.save(asset);
            } catch (MetaMediaDownloadService.MissingProviderCredentialException exception) {
                asset.markWaitingForProvider(exception.getMessage().startsWith("META_") ? "META_CREDENTIAL_MISSING" : "CONTENT_PROVIDER_KEY_MISSING");
                assets.save(asset);
            } catch (UnsupportedOperationException exception) {
                asset.markUnsupported("UNSUPPORTED_ATTACHMENT_TYPE");
                assets.save(asset);
            } catch (Exception exception) {
                asset.markFailed("PROCESSING_FAILED", true);
                assets.save(asset);
                log.warn("WhatsApp media processing failed for asset {} with {}", asset.getId(), exception.getClass().getSimpleName());
            }
        }
    }

    private void download(WhatsAppMessageAsset asset) throws Exception {
        MetaMediaDownloadService.DownloadedMedia downloaded = downloader.download(asset);
        if (downloaded.byteSize() > maxBytes) throw new MetaMediaDownloadService.UnsupportedMediaException("MEDIA_TOO_LARGE");
        asset.markDownloaded(downloaded.storageKey(), downloaded.sha256(), downloaded.byteSize(), downloaded.mimeType());
        assets.save(asset);
    }

    private void extract(WhatsAppMessageAsset asset) throws Exception {
        Path file = Path.of(asset.getStorageKey()).toAbsolutePath().normalize();
        if (!Files.isRegularFile(file) || Files.size(file) > maxBytes) {
            throw new MetaMediaDownloadService.UnsupportedMediaException("MEDIA_FILE_MISSING_OR_TOO_LARGE");
        }
        asset.markProcessing();
        assets.save(asset);
        if ("audio".equals(asset.getMediaKind())) {
            if (!sarvam.isConfigured()) throw new MetaMediaDownloadService.MissingProviderCredentialException("SARVAM_API_KEY is not configured");
            SarvamTranscriptionService.Transcription result = sarvam.transcribe(file);
            asset.markReady(result.text(), result.language());
        } else if ("image".equals(asset.getMediaKind()) || "sticker".equals(asset.getMediaKind())
                || "document".equals(asset.getMediaKind())) {
            if (!openAi.isConfigured()) throw new MetaMediaDownloadService.MissingProviderCredentialException("OPENAI_API_KEY is not configured");
            OpenAiContentService.ExtractedContent result = openAi.extractText(file, asset.getMimeType(), asset.getOriginalFilename());
            asset.markReady(result.text(), result.language());
        } else {
            asset.markUnsupported("VIDEO_EXTRACTION_NOT_CONFIGURED");
            assets.save(asset);
            return;
        }
        assets.save(asset);
    }

    private boolean providerConfigured(WhatsAppMessageAsset asset) {
        return "audio".equals(asset.getMediaKind()) ? sarvam.isConfigured() : openAi.isConfigured();
    }
}
