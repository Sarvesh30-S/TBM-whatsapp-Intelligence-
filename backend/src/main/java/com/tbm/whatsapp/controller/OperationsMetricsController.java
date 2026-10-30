package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.entity.ImportantMessageInsight;
import com.tbm.whatsapp.repository.ImportantMessageInsightRepository;
import com.tbm.whatsapp.service.OperationsMetricsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/brands/{brandId}/operations")
public class OperationsMetricsController {
    private final OperationsMetricsService metrics;
    private final ImportantMessageInsightRepository insights;

    public OperationsMetricsController(OperationsMetricsService metrics,
                                       ImportantMessageInsightRepository insights) {
        this.metrics = metrics;
        this.insights = insights;
    }

    @GetMapping
    public OperationsMetricsService.BoardView getBoard(@PathVariable UUID brandId) {
        try {
            return metrics.getBoard(brandId, Instant.now());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found");
        }
    }

    @PutMapping("/tasks/{taskId}")
    public TaskStatusView updateTask(@PathVariable UUID brandId, @PathVariable UUID taskId,
                                    @Valid @RequestBody UpdateTaskRequest request) {
        ImportantMessageInsight task = insights.findTaskByIdAndBrandId(taskId, brandId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
        try {
            task.updateTaskStatus(request.status(), Instant.now());
            insights.saveAndFlush(task);
            return new TaskStatusView(task.getId(), task.getTaskStatus(), task.getResolvedAt());
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported task status");
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage());
        }
    }

    public record UpdateTaskRequest(@NotBlank @Pattern(regexp = "OPEN|IN_PROGRESS|DONE") String status) {}
    public record TaskStatusView(UUID id, String status, Instant resolvedAt) {}
}
