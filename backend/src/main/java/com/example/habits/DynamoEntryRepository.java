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
    @Override public Map<String, Entry> week(String start, String end) {
        var pages = client.queryPaginator(request -> request.tableName(table).consistentRead(true)
            .keyConditionExpression("#log = :log AND #day BETWEEN :start AND :end")
            .expressionAttributeNames(Map.of("#log", "log", "#day", "day"))
            .expressionAttributeValues(Map.of(":log", s("main"), ":start", s(start), ":end", s(end))));
        Map<String, Entry> entries = new LinkedHashMap<>();
        for (var page : pages) for (var item : page.items()) entries.put(item.get("day").s(), new Entry(Long.parseLong(item.get("cardio").n()), Long.parseLong(item.get("lifting").n()), Long.parseLong(item.get("produce").n()), Long.parseLong(item.get("revision").n())));
        return entries;
    }
    @Override public Entry save(String day, long cardio, long lifting, long produce, long expectedRevision) {
        Entry entry = new Entry(cardio, lifting, produce, expectedRevision + 1);
        var request = PutItemRequest.builder().tableName(table)
            .item(Map.of("log", s("main"), "day", s(day), "cardio", n(cardio), "lifting", n(lifting), "produce", n(produce), "revision", n(entry.revision())))
            .expressionAttributeNames(Map.of("#rev", "revision"));
        if (expectedRevision == 0) request.conditionExpression("attribute_not_exists(#rev)");
        else request.conditionExpression("#rev = :expected").expressionAttributeValues(Map.of(":expected", n(expectedRevision)));
        try { client.putItem(request.build()); }
        catch (ConditionalCheckFailedException error) { throw new StaleEntryException(); }
        return entry;
    }
}
