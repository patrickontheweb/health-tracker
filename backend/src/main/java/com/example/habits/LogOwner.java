package com.example.habits;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
@Component
public class LogOwner {
    private final String subject;
    public LogOwner(@Value("${habits.owner-sub:}") String subject){this.subject=subject;if(!subject.isBlank())DynamoEntryRepository.userPartition(subject);}
    String subject(){if(subject.isBlank())throw new IllegalStateException("Configure the existing log owner's Cognito subject before using per-user storage");return subject;}
    void check(String user){if(!subject().equals(user))throw new AccessDeniedException("This page belongs to a different user");}
}
