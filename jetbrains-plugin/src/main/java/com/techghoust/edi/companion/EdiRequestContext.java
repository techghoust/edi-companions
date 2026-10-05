package com.techghoust.edi.companion;

import com.google.gson.JsonObject;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.editor.Document;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.openapi.fileEditor.FileDocumentManager;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

final class EdiRequestContext {
    private EdiRequestContext() {}

    static JsonObject project(Project project) {
        String workspace = project.getBasePath();
        if (workspace == null || workspace.isBlank()) throw new IllegalStateException("Open a project folder first.");
        Path workspacePath = Path.of(workspace).toAbsolutePath().normalize();
        String repository = git(workspacePath, "rev-parse", "--show-toplevel");

        JsonObject result = new JsonObject();
        result.addProperty("workspacePath", workspacePath.toString());
        if (repository == null) return result;

        Path repositoryPath = Path.of(repository).toAbsolutePath().normalize();
        result.addProperty("repositoryPath", repositoryPath.toString());
        String commonDir = git(repositoryPath, "rev-parse", "--git-common-dir");
        if (commonDir != null) {
            Path common = Path.of(commonDir);
            result.addProperty("gitCommonDir", (common.isAbsolute() ? common : repositoryPath.resolve(common)).normalize().toString());
        }
        addOptional(result, "remoteUrl", git(repositoryPath, "remote", "get-url", "origin"));
        addOptional(result, "headCommit", git(repositoryPath, "rev-parse", "HEAD"));
        addOptional(result, "branch", git(repositoryPath, "branch", "--show-current"));
        return result;
    }

    static SourceSnapshot captureSource(Editor editor) {
        if (editor == null) return null;
        VirtualFile file = FileDocumentManager.getInstance().getFile(editor.getDocument());
        if (file == null || !file.isInLocalFileSystem()) return null;

        Document document = editor.getDocument();
        int startOffset = editor.getSelectionModel().hasSelection()
                ? editor.getSelectionModel().getSelectionStart()
                : editor.getCaretModel().getOffset();
        int endOffset = editor.getSelectionModel().hasSelection()
                ? editor.getSelectionModel().getSelectionEnd()
                : startOffset;
        String selection = editor.getSelectionModel().hasSelection() ? editor.getSelectionModel().getSelectedText() : null;
        if (selection != null && selection.getBytes(StandardCharsets.UTF_8).length > 64 * 1024) {
            throw new IllegalArgumentException("Select no more than 64 KiB of text to send to EDI.");
        }
        Position start = position(document, startOffset);
        Position end = position(document, endOffset);
        return new SourceSnapshot(file.getPath(), file.getFileType().getName().toLowerCase(), selection, start, end);
    }

    static JsonObject source(SourceSnapshot snapshot, JsonObject project) {
        if (snapshot == null) return null;
        String base = project.has("repositoryPath") ? project.get("repositoryPath").getAsString() : project.get("workspacePath").getAsString();
        String relative = null;
        try {
            Path root = Path.of(base).toAbsolutePath().normalize();
            Path source = Path.of(snapshot.filePath()).toAbsolutePath().normalize();
            if (source.startsWith(root)) relative = root.relativize(source).toString().replace('\\', '/');
        } catch (RuntimeException ignored) {
        }

        JsonObject result = new JsonObject();
        result.addProperty("filePath", snapshot.filePath());
        if (relative != null && !relative.isBlank()) result.addProperty("workspaceRelativePath", relative);
        result.addProperty("languageId", snapshot.languageId());
        JsonObject range = new JsonObject();
        if (snapshot.selection() != null) range.addProperty("text", snapshot.selection());
        range.add("start", point(snapshot.start()));
        range.add("end", point(snapshot.end()));
        result.add("selection", range);
        return result;
    }

    private static Position position(Document document, int offset) {
        int line = document.getLineNumber(offset);
        return new Position(line, offset - document.getLineStartOffset(line));
    }

    private static JsonObject point(Position position) {
        JsonObject result = new JsonObject();
        result.addProperty("line", position.line());
        result.addProperty("character", position.character());
        return result;
    }

    private static String git(Path workingDirectory, String... args) {
        try {
            Process process = new ProcessBuilder(concat("git", args)).directory(workingDirectory.toFile())
                    .redirectErrorStream(true).start();
            boolean completed = process.waitFor(3, TimeUnit.SECONDS);
            if (!completed) {
                process.destroyForcibly();
                return null;
            }
            if (process.exitValue() != 0) return null;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String output = reader.lines().limit(2).reduce((first, second) -> second).orElse("").trim();
                return output.isEmpty() ? null : output;
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String[] concat(String first, String[] rest) {
        String[] result = new String[rest.length + 1];
        result[0] = first;
        System.arraycopy(rest, 0, result, 1, rest.length);
        return result;
    }

    private static void addOptional(JsonObject object, String key, String value) {
        if (value != null) object.addProperty(key, value);
    }

    record SourceSnapshot(String filePath, String languageId, String selection, Position start, Position end) {}
    private record Position(int line, int character) {}
}
