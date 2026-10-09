package com.example.habits;

import java.net.URI;
import java.time.Duration;
import java.util.Set;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

final class DynamoClients {
    private DynamoClients() {}
    static URI localEndpoint(String endpoint) {
        URI uri=URI.create(endpoint);
        if(!"http".equals(uri.getScheme()) || !Set.of("127.0.0.1","localhost","[::1]","::1").contains(uri.getHost()==null?"":uri.getHost())
            || uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null
            || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))
            throw new IllegalArgumentException("Local DynamoDB must use an HTTP loopback address");
        return uri;
    }
    static DynamoDbClient create(boolean local,String endpoint) {
        var builder=DynamoDbClient.builder().httpClientBuilder(UrlConnectionHttpClient.builder())
            .overrideConfiguration(config -> config.apiCallTimeout(Duration.ofSeconds(8)).apiCallAttemptTimeout(Duration.ofSeconds(3)));
        if(local) builder.endpointOverride(localEndpoint(endpoint)).region(Region.US_EAST_1)
            .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create("localdev","localdev")));
        else if(!endpoint.isBlank()) throw new IllegalArgumentException("Custom database endpoints require the local profile");
        return builder.build();
    }
}
