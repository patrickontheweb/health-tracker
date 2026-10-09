package com.example.habits;
import java.time.DateTimeException;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import software.amazon.awssdk.core.exception.SdkException;
@RestControllerAdvice
public class ApiErrors {
    @ExceptionHandler({IllegalArgumentException.class, DateTimeException.class, HttpMessageNotReadableException.class})
    ResponseEntity<?> badInput(Exception error) { return ResponseEntity.badRequest().body(Map.of("message", "Invalid date or daily totals")); }
    @ExceptionHandler(StaleEntryException.class)
    ResponseEntity<?> conflict() { return ResponseEntity.status(409).body(Map.of("message", "Entry changed; refresh before saving")); }
    @ExceptionHandler(SdkException.class)
    ResponseEntity<?> unavailable() { return ResponseEntity.status(503).body(Map.of("message", "Storage temporarily unavailable")); }
}
