package com.example.habits;
import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.model.AwsProxyResponse;
import com.amazonaws.serverless.proxy.model.HttpApiV2ProxyRequest;
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
public class LambdaHandler implements RequestStreamHandler {
    private static final SpringBootLambdaContainerHandler<HttpApiV2ProxyRequest, AwsProxyResponse> HANDLER;
    static {
        try { HANDLER = SpringBootLambdaContainerHandler.getHttpApiV2ProxyHandler(HabitsApplication.class); }
        catch (ContainerInitializationException e) { throw new IllegalStateException("Could not start API", e); }
    }
    @Override public void handleRequest(InputStream input, OutputStream output, Context context) throws IOException { HANDLER.proxyStream(input, output, context); }
}
