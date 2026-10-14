package com.example.habits;
public record Entry(long cardio, long lifting, long produce, long revision, Long weight,Long systolic,Long diastolic,Long heartRate,Double sleepHours,Long calories,Double sugarGrams,Double saturatedFatGrams,Long sodiumMg) {
    public Entry(long cardio,long lifting,long produce,long revision){this(cardio,lifting,produce,revision,null);}
    public Entry(long cardio,long lifting,long produce,long revision,Long weight){this(cardio,lifting,produce,revision,weight,null,null,null,null);}
    public Entry(long cardio,long lifting,long produce,long revision,Long weight,Long systolic,Long diastolic,Long heartRate,Double sleepHours){this(cardio,lifting,produce,revision,weight,systolic,diastolic,heartRate,sleepHours,null,null,null,null);}
}
