package com.example.habits;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.model.ResourceInUseException;
import software.amazon.awssdk.services.dynamodb.model.KeySchemaElement;
import software.amazon.awssdk.services.dynamodb.model.KeyType;
import software.amazon.awssdk.services.dynamodb.model.AttributeDefinition;
import software.amazon.awssdk.services.dynamodb.model.ScalarAttributeType;
import software.amazon.awssdk.services.dynamodb.model.BillingMode;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.ConditionalCheckFailedException;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
@Repository
public class DynamoEntryRepository implements EntryRepository {
    private final DynamoDbClient client;
    private final String table;
    @org.springframework.beans.factory.annotation.Autowired
    public DynamoEntryRepository(@Value("${habits.table}") String table,
        @Value("${habits.local:false}") boolean local,@Value("${habits.endpoint:}") String endpoint) {
        this(DynamoClients.create(local,endpoint),table,local);
    }
    DynamoEntryRepository(DynamoDbClient client,String table,boolean initializeLocalTable) {
        this.table = table;
        this.client = client;
        if(initializeLocalTable) {
            try {
                client.createTable(r -> r.tableName(table).billingMode(BillingMode.PAY_PER_REQUEST)
                    .keySchema(KeySchemaElement.builder().attributeName("log").keyType(KeyType.HASH).build(),KeySchemaElement.builder().attributeName("day").keyType(KeyType.RANGE).build())
                    .attributeDefinitions(AttributeDefinition.builder().attributeName("log").attributeType(ScalarAttributeType.S).build(),AttributeDefinition.builder().attributeName("day").attributeType(ScalarAttributeType.S).build()));
            } catch(ResourceInUseException existing) { /* Keep all existing local records. */ }
            client.waiter().waitUntilTableExists(r -> r.tableName(table));
        }
    }
    @jakarta.annotation.PreDestroy void close() { client.close(); }
    private static AttributeValue s(String value) { return AttributeValue.builder().s(value).build(); }
    private static AttributeValue n(long value) { return AttributeValue.builder().n(Long.toString(value)).build(); }
    private static Long optionalLong(Map<String,AttributeValue> item,String key){return item.containsKey(key)?Long.valueOf(item.get(key).n()):null;}
    private static Double optionalDouble(Map<String,AttributeValue> item,String key){return item.containsKey(key)?Double.valueOf(item.get(key).n()):null;}
    private static void bodyValues(Map<String,AttributeValue> item,Entry entry){
        if(entry.weight()!=null)item.put("weight",n(entry.weight()));
        if(entry.systolic()!=null)item.put("systolic",n(entry.systolic()));
        if(entry.diastolic()!=null)item.put("diastolic",n(entry.diastolic()));
        if(entry.heartRate()!=null)item.put("heartRate",n(entry.heartRate()));
        if(entry.sleepHours()!=null)item.put("sleepHours",AttributeValue.builder().n(Double.toString(entry.sleepHours())).build());
        if(entry.calories()!=null)item.put("calories",n(entry.calories()));
        if(entry.sugarGrams()!=null)item.put("sugarGrams",AttributeValue.builder().n(Double.toString(entry.sugarGrams())).build());
        if(entry.saturatedFatGrams()!=null)item.put("saturatedFatGrams",AttributeValue.builder().n(Double.toString(entry.saturatedFatGrams())).build());
        if(entry.sodiumMg()!=null)item.put("sodiumMg",n(entry.sodiumMg()));
    }
    @Override public Map<String, Entry> week(String start, String end) {
        return query("main",start,end);
    }
    static String userPartition(String user){if(user==null||!user.matches("[a-zA-Z0-9_-]{1,128}"))throw new IllegalArgumentException();return "user#"+user;}
    static String publicName(String username){String name=username==null?"":username.toLowerCase(java.util.Locale.ROOT);if(!name.matches("[a-z0-9][a-z0-9_-]{0,63}"))throw new IllegalArgumentException();return name;}
    @Override public String publicUser(String username){var item=client.getItem(r->r.tableName(table).consistentRead(true).key(Map.of("log",s("profile#"+publicName(username)),"day",s("~profile")))).item();return item.containsKey("user")?item.get("user").s():null;}
    @Override public void ensureProfile(String user,String username){
        userPartition(user);String name=publicName(username);
        try{client.putItem(r->r.tableName(table).item(Map.of("log",s("profile#"+name),"day",s("~profile"),"user",s(user)))
            .conditionExpression("attribute_not_exists(#user) OR #user = :user").expressionAttributeNames(Map.of("#user","user")).expressionAttributeValues(Map.of(":user",s(user))));}
        catch(ConditionalCheckFailedException error){throw new StaleEntryException();}
    }
    @Override public Goals goals(String user){
        var item=client.getItem(r->r.tableName(table).consistentRead(true).key(Map.of("log",s(userPartition(user)),"day",s("~settings")))).item();
        return item.isEmpty()?Goals.DEFAULT:new Goals(Long.parseLong(item.get("produce").n()),Long.parseLong(item.get("lifting").n()),Long.parseLong(item.get("cardio").n()));
    }
    @Override public Goals saveGoals(String user,Goals goals){
        client.putItem(r->r.tableName(table).item(Map.of("log",s(userPartition(user)),"day",s("~settings"),"produce",n(goals.produce()),"lifting",n(goals.lifting()),"cardio",n(goals.cardio()))));
        return goals;
    }
    @Override public Map<String,Entry> weekForUser(String user,String start,String end){return query(userPartition(user),start,end);}
    private Map<String,Entry> query(String partition,String start,String end){
        var pages = client.queryPaginator(request -> request.tableName(table).consistentRead(true)
            .keyConditionExpression("#log = :log AND #day BETWEEN :start AND :end")
            .expressionAttributeNames(Map.of("#log", "log", "#day", "day"))
            .expressionAttributeValues(Map.of(":log", s(partition), ":start", s(start), ":end", s(end))));
        Map<String, Entry> entries = new LinkedHashMap<>();
        for (var page : pages) for (var item : page.items()) entries.put(item.get("day").s(), new Entry(Long.parseLong(item.get("cardio").n()), Long.parseLong(item.get("lifting").n()), Long.parseLong(item.get("produce").n()), Long.parseLong(item.get("revision").n()),optionalLong(item,"weight"),optionalLong(item,"systolic"),optionalLong(item,"diastolic"),optionalLong(item,"heartRate"),optionalDouble(item,"sleepHours"),optionalLong(item,"calories"),optionalDouble(item,"sugarGrams"),optionalDouble(item,"saturatedFatGrams"),optionalLong(item,"sodiumMg")));
        return entries;
    }
    @Override public Entry save(String day, long cardio, long lifting, long produce, long expectedRevision) {
        Entry previous=week(day,day).get(day);
        return save(day,cardio,lifting,produce,expectedRevision,previous==null?null:previous.weight());
    }
    @Override public Entry save(String day, long cardio, long lifting, long produce, long expectedRevision, Long weight) {
        return put("main",day,cardio,lifting,produce,expectedRevision,weight);
    }
    @Override public Entry saveForUser(String user,String day,long cardio,long lifting,long produce,long expectedRevision,Long weight){
        Entry previous=weekForUser(user,day,day).get(day);
        return saveMeasurements(user,day,new Entry(cardio,lifting,produce,0,weight,previous==null?null:previous.systolic(),previous==null?null:previous.diastolic(),previous==null?null:previous.heartRate(),previous==null?null:previous.sleepHours(),previous==null?null:previous.calories(),previous==null?null:previous.sugarGrams(),previous==null?null:previous.saturatedFatGrams(),previous==null?null:previous.sodiumMg()),expectedRevision);
    }
    @Override public Entry saveMeasurements(String user,String day,Entry e,long expectedRevision){return putEntry(userPartition(user),day,new Entry(e.cardio(),e.lifting(),e.produce(),expectedRevision+1,e.weight(),e.systolic(),e.diastolic(),e.heartRate(),e.sleepHours(),e.calories(),e.sugarGrams(),e.saturatedFatGrams(),e.sodiumMg()),expectedRevision);}
    private Entry put(String partition,String day,long cardio,long lifting,long produce,long expectedRevision,Long weight){
        Entry entry = new Entry(cardio, lifting, produce, expectedRevision + 1,weight);
        return putEntry(partition,day,entry,expectedRevision);
    }
    private Entry putEntry(String partition,String day,Entry entry,long expectedRevision){
        Map<String,AttributeValue> item=new LinkedHashMap<>(Map.of("log",s(partition),"day",s(day),"cardio",n(entry.cardio()),"lifting",n(entry.lifting()),"produce",n(entry.produce()),"revision",n(entry.revision())));
        bodyValues(item,entry);
        var request = PutItemRequest.builder().tableName(table)
            .item(item)
            .expressionAttributeNames(Map.of("#rev", "revision"));
        if (expectedRevision == 0) request.conditionExpression("attribute_not_exists(#rev)");
        else request.conditionExpression("#rev = :expected").expressionAttributeValues(Map.of(":expected", n(expectedRevision)));
        try { client.putItem(request.build()); }
        catch (ConditionalCheckFailedException error) { throw new StaleEntryException(); }
        return entry;
    }
    void copyLegacyToUser(String user){
        for(var record:week("0001-01-01","9999-12-31").entrySet()){
            var e=record.getValue();var item=new LinkedHashMap<>(Map.of("log",s(userPartition(user)),"day",s(record.getKey()),"cardio",n(e.cardio()),"lifting",n(e.lifting()),"produce",n(e.produce()),"revision",n(e.revision())));
            bodyValues(item,e);
            try{client.putItem(r->r.tableName(table).item(item).conditionExpression("attribute_not_exists(#day)").expressionAttributeNames(Map.of("#day","day")));}catch(ConditionalCheckFailedException exists){/* Never overwrite a user's newer entry. */}
        }
    }
}
