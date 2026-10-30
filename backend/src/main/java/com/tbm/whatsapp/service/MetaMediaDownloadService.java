package com.tbm.whatsapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.tbm.whatsapp.config.MetaApiProperties;
import com.tbm.whatsapp.entity.WhatsAppMessageAsset;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

@Service
public class MetaMediaDownloadService {
    private static final Set<String> SAFE_EXTENSIONS = Set.of(
            "pdf", "txt", "md", "csv", "doc", "docx", "rtf", "odt", "ppt", "pptx", "xls", "xlsx", "jpg", "jpeg", "png", "webp");
    private final RestClient metaClient;
    private final MetaApiProperties properties;
    private final Path storageRoot;
    private final long maxBytes;

    public MetaMediaDownloadService(@Qualifier("metaRestClient") RestClient metaRestClient, MetaApiProperties properties,
                                   @Value("${app.media.storage-dir:./data/media}") String storageDir,
                                   @Value("${app.media.max-bytes:20971520}") long maxBytes) {
        this.metaClient = metaRestClient;
        this.properties = properties;
        this.storageRoot = Path.of(storageDir).toAbsolutePath().normalize();
        this.maxBytes = Math.max(1024, Math.min(maxBytes, 50L * 1024 * 1024));
    }

    public DownloadedMedia download(WhatsAppMessageAsset asset) throws Exception {
        if (!StringUtils.hasText(properties.accessToken())) {
            throw new MissingProviderCredentialException("META_ACCESS_TOKEN is not configured");
        }
        JsonNode metadata = metaClient.get()
                .uri(uriBuilder -> uriBuilder.path("/{mediaId}").build(asset.getProviderMediaId()))
                .headers(headers -> headers.setBearerAuth(properties.accessToken()))
                .retrieve().body(JsonNode.class);
        if (metadata == null || !StringUtils.hasText(metadata.path("url").asText())) {
            throw new IllegalStateException("Meta media metadata did not include a download URL");
        }
        String remoteUrl = metadata.path("url").asText();
        URI uri = URI.create(remoteUrl);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !isMetaMediaHost(uri.getHost())) {
            throw new IllegalStateException("Meta returned a media URL outside the approved download hosts");
        }
        long declaredSize = metadata.path("file_size").asLong(-1);
        if (declaredSize > maxBytes) throw new UnsupportedMediaException("MEDIA_TOO_LARGE");

        byte[] bytes = RestClient.create().get().uri(uri)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.accessToken())
                .retrieve().body(byte[].class);
        if (bytes == null || bytes.length == 0) throw new IllegalStateException("Meta media download was empty");
        if (bytes.length > maxBytes) throw new UnsupportedMediaException("MEDIA_TOO_LARGE");
        if (declaredSize >= 0 && bytes.length != declaredSize) throw new IllegalStateException("Downloaded media size did not match Meta metadata");

        Files.createDirectories(storageRoot);
        Path target = storageRoot.resolve(asset.getId() + extension(asset)).normalize();
        if (!target.startsWith(storageRoot)) throw new IllegalStateException("Invalid local media storage path");
        Files.write(target, bytes, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
        String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        return new DownloadedMedia(target.toString(), digest, bytes.length,
                text(metadata, "mime_type", asset.getMimeType()));
    }

    private boolean isMetaMediaHost(String host) {
        if (host == null) return false;
        String normalized = host.toLowerCase(Locale.ROOT);
        return normalized.equals("lookaside.fbsbx.com")
                || normalized.endsWith(".fbcdn.net")
                || normalized.equals("scontent.whatsapp.net")
                || normalized.endsWith(".whatsapp.net");
    }

    private String extension(WhatsAppMessageAsset asset) {
        String filename = asset.getOriginalFilename();
        if (filename != null) {
            String safeName = Path.of(filename.replace('\\', '/')).getFileName().toString();
            int dot = safeName.lastIndexOf('.');
            if (dot >= 0 && dot < safeName.length() - 1) {
                String ext = safeName.substring(dot + 1).toLowerCase(Locale.ROOT);
                if (SAFE_EXTENSIONS.contains(ext)) return "." + ext;
            }
        }
        String mime = asset.getMimeType() == null ? "" : asset.getMimeType().toLowerCase(Locale.ROOT);
        if (mime.contains("jpeg")) return ".jpg";
        if (mime.contains("png")) return ".png";
        if (mime.contains("webp")) return ".webp";
        if (mime.contains("pdf")) return ".pdf";
        if (mime.contains("ogg")) return ".ogg";
        if (mime.contains("mp4")) return ".mp4";
        if (mime.contains("mpeg")) return ".mp3";
        if (mime.contains("wav")) return ".wav";
        if (mime.contains("plain")) return ".txt";
        return ".bin";
    }

    private String text(JsonNode node, String property, String fallback) {
        String value = node.path(property).asText(null);
        return StringUtils.hasText(value) ? value : fallback;
    }

    public record DownloadedMedia(String storageKey, String sha256, long byteSize, String mimeType) {}

    public static class MissingProviderCredentialException extends RuntimeException {
        public MissingProviderCredentialException(String message) { super(message); }
    }

    public static class UnsupportedMediaException extends RuntimeException {
        public UnsupportedMediaException(String message) { super(message); }
    }
}
