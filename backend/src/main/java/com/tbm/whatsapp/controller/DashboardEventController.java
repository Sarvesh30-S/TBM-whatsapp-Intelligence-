package com.tbm.whatsapp.controller;

import com.tbm.whatsapp.repository.BrandRepository;
import com.tbm.whatsapp.service.DashboardEventHub;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin/events")
public class DashboardEventController {
    private final DashboardEventHub hub;
    private final BrandRepository brands;

    public DashboardEventController(DashboardEventHub hub, BrandRepository brands) {
        this.hub = hub;
        this.brands = brands;
    }

    @GetMapping(produces = "text/event-stream")
    public SseEmitter subscribe(@RequestParam UUID brandId) {
        if (!brands.existsById(brandId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found");
        return hub.subscribe(brandId);
    }
}
