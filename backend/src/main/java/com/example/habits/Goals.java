package com.example.habits;

public record Goals(long produce, long lifting, long cardio) {
    public static final Goals DEFAULT = new Goals(5, 2, 150);
    public Goals {
        if (produce < 1 || produce > 99 || lifting < 1 || lifting > 7 || cardio < 1 || cardio > 9999)
            throw new IllegalArgumentException("Enter valid positive whole-number goals.");
    }
}
