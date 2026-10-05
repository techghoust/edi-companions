package com.techghoust.edi.companion;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.intellij.ide.util.PropertiesComponent;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

final class EdiIntegrationClient {
    static final String PLUGIN_VERSION = "0.3.0";
    static final String CLIENT_ID = "edi-jetbrains";
    static final int PROTOCOL_VERSION = 1;
    private static final String EXECUTABLE_SETTING = "edi.companion.executablePath";
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    private EdiIntegrationClient() {}

    static JsonObject openProject(JsonObject project) throws IOException, InterruptedException {
        JsonObject request = envelope("project.open", project);
        request.add("payload", new JsonObject());
        return send(request);
    }

    static JsonObject createEntry(JsonObject project, JsonObject source, String type, String title, String comment)
            throws IOException, InterruptedException {
        JsonObject request = envelope("entry.create", project);
        if (source != null) request.add("source", source);
        JsonObject payload = new JsonObject();
        payload.addProperty("entryType", type);
        payload.addProperty("title", title);
        payload.addProperty("comment", comment);
        request.add("payload", payload);
        return send(request);
    }

    private static JsonObject envelope(String action, JsonObject project) {
        JsonObject request = new JsonObject();
        request.addProperty("protocolVersion", PROTOCOL_VERSION);
        request.addProperty("requestId", UUID.randomUUID().toString());
        JsonObject client = new JsonObject();
        client.addProperty("id", CLIENT_ID);
        client.addProperty("version", PLUGIN_VERSION);
        request.add("client", client);
        request.addProperty("action", action);
        request.add("project", project);
        return request;
    }

    private static JsonObject send(JsonObject request) throws IOException, InterruptedException {
        RuntimeDescriptor runtime = connectOrLaunch();
        JsonObject response = request(runtime, "POST", "/v1/requests", request, true);
        validateResponse(response, request.get("requestId").getAsString());
        if (!response.get("ok").getAsBoolean()) {
            JsonObject error = response.getAsJsonObject("error");
            String message = error != null && error.has("message") ? error.get("message").getAsString() : "EDI rejected the request.";
            throw new IOException(message);
        }
        return response.getAsJsonObject("result");
    }

    private static RuntimeDescriptor connectOrLaunch() throws IOException, InterruptedException {
        try {
            RuntimeDescriptor runtime = readRuntime();
            checkHealth(runtime);
            return runtime;
        } catch (IOException firstFailure) {
            Path executable = findExecutable();
            if (executable == null) {
                throw new IOException("EDI is not running. Set its executable with Tools → EDI → Configure EDI Executable.", firstFailure);
            }
            launch(executable);
            IOException lastFailure = firstFailure;
            for (int attempt = 0; attempt < 24; attempt++) {
                try {
                    Thread.sleep(250);
                    RuntimeDescriptor runtime = readRuntime();
                    checkHealth(runtime);
                    return runtime;
                } catch (IOException error) {
                    lastFailure = error;
                }
            }
            throw new IOException("EDI did not start. Open EDI and try again.", lastFailure);
        }
    }

    private static RuntimeDescriptor readRuntime() throws IOException {
        Path descriptor = runtimeDescriptorPath();
        if (!Files.isRegularFile(descriptor)) throw new IOException("EDI runtime descriptor was not found.");
        try {
            JsonObject json = JsonParser.parseString(Files.readString(descriptor, StandardCharsets.UTF_8)).getAsJsonObject();
            int protocol = json.get("protocolVersion").getAsInt();
            int port = json.get("port").getAsInt();
            String token = json.get("token").getAsString();
            String instanceId = json.get("instanceId").getAsString();
            if (protocol != PROTOCOL_VERSION || port < 1 || port > 65535 || token.length() < 32 || instanceId.length() < 8) {
                throw new IOException("EDI runtime descriptor is invalid or uses an unsupported protocol.");
            }
            return new RuntimeDescriptor(port, token, instanceId);
        } catch (RuntimeException error) {
            throw new IOException("EDI runtime descriptor is invalid or incomplete.", error);
        }
    }

    private static void checkHealth(RuntimeDescriptor runtime) throws IOException, InterruptedException {
        JsonObject health = request(runtime, "GET", "/v1/health", null, false);
        if (health.get("protocolVersion").getAsInt() != PROTOCOL_VERSION
                || !runtime.instanceId.equals(health.get("instanceId").getAsString())) {
            throw new IOException("EDI runtime information is stale.");
        }
    }

    private static JsonObject request(RuntimeDescriptor runtime, String method, String endpoint, JsonObject body, boolean authenticated)
            throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + runtime.port + endpoint))
                .timeout(Duration.ofSeconds(3));
        if (authenticated) builder.header("Authorization", "Bearer " + runtime.token);
        if (body == null) builder.GET();
        else builder.header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString(), StandardCharsets.UTF_8));
        HttpResponse<String> response = HTTP.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonObject json;
        try {
            json = JsonParser.parseString(response.body()).getAsJsonObject();
        } catch (RuntimeException error) {
            throw new IOException("EDI returned an invalid response.", error);
        }
        if (response.statusCode() >= 400) {
            JsonObject error = json.has("error") && json.get("error").isJsonObject() ? json.getAsJsonObject("error") : null;
            String message = error != null && error.has("message") ? error.get("message").getAsString() : "EDI request failed.";
            throw new IOException(message);
        }
        return json;
    }

    private static void validateResponse(JsonObject response, String requestId) throws IOException {
        if (!response.has("protocolVersion") || response.get("protocolVersion").getAsInt() != PROTOCOL_VERSION
                || !response.has("requestId") || !requestId.equals(response.get("requestId").getAsString())
                || !response.has("ok")) {
            throw new IOException("EDI returned a mismatched response.");
        }
    }

    private static Path runtimeDescriptorPath() throws IOException {
        String os = System.getProperty("os.name", "").toLowerCase();
        Path config;
        if (os.contains("win")) {
            String appData = System.getenv("APPDATA");
            config = appData == null || appData.isBlank()
                    ? Path.of(System.getProperty("user.home"), "AppData", "Roaming")
                    : Path.of(appData);
        } else if (os.contains("mac")) {
            config = Path.of(System.getProperty("user.home"), "Library", "Application Support");
        } else {
            String xdg = System.getenv("XDG_CONFIG_HOME");
            config = xdg == null || xdg.isBlank() ? Path.of(System.getProperty("user.home"), ".config") : Path.of(xdg);
        }
        return config.resolve("EDI Developer Journal").resolve("integration.json");
    }

    static List<Path> executableCandidates() {
        List<Path> candidates = new ArrayList<>();
        String configured = PropertiesComponent.getInstance().getValue(EXECUTABLE_SETTING, "").trim();
        if (!configured.isEmpty()) candidates.add(Path.of(configured));
        String os = System.getProperty("os.name", "").toLowerCase();
        String home = System.getProperty("user.home", "");
        if (os.contains("win")) {
            String local = System.getenv("LOCALAPPDATA");
            String programs = System.getenv("ProgramFiles");
            if (local != null) {
                candidates.add(Path.of(local, "Programs", "EDI Developer Journal", "EDI Developer Journal.exe"));
                candidates.add(Path.of(local, "EDI Developer Journal", "EDI Developer Journal.exe"));
            }
            if (programs != null) candidates.add(Path.of(programs, "EDI Developer Journal", "EDI Developer Journal.exe"));
        } else if (os.contains("mac")) {
            candidates.add(Path.of("/Applications/EDI Developer Journal.app"));
            candidates.add(Path.of(home, "Applications", "EDI Developer Journal.app"));
        } else {
            candidates.add(Path.of("/usr/bin/edi-developer-journal"));
            candidates.add(Path.of("/usr/local/bin/edi-developer-journal"));
        }
        return candidates;
    }

    private static Path findExecutable() {
        for (Path candidate : executableCandidates()) {
            if (Files.isRegularFile(candidate) || (isMac() && candidate.toString().endsWith(".app") && Files.isDirectory(candidate))) {
                return candidate;
            }
        }
        return null;
    }

    static void rememberExecutable(Path executable) {
        PropertiesComponent.getInstance().setValue(EXECUTABLE_SETTING, executable.toAbsolutePath().toString());
    }

    private static void launch(Path executable) throws IOException {
        List<String> command = new ArrayList<>();
        if (isMac() && executable.toString().endsWith(".app")) {
            command.add("open");
            command.add("-a");
            command.add(executable.toString());
        } else {
            command.add(executable.toString());
        }
        new ProcessBuilder(command).redirectOutput(ProcessBuilder.Redirect.DISCARD)
                .redirectError(ProcessBuilder.Redirect.DISCARD).start();
    }

    private static boolean isMac() {
        return System.getProperty("os.name", "").toLowerCase().contains("mac");
    }

    private record RuntimeDescriptor(int port, String token, String instanceId) {}
}
