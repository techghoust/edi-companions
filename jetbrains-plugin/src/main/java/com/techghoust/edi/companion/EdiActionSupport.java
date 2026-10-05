package com.techghoust.edi.companion;

import com.google.gson.JsonObject;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.progress.ProgressIndicator;
import com.intellij.openapi.progress.Task;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import org.jetbrains.annotations.NotNull;

final class EdiActionSupport {
    @FunctionalInterface
    interface Work {
        String run() throws Exception;
    }

    private EdiActionSupport() {}

    static void run(Project project, String title, Work work) {
        new Task.Backgroundable(project, title, true) {
            @Override
            public void run(@NotNull ProgressIndicator indicator) {
                try {
                    String message = work.run();
                    ApplicationManager.getApplication().invokeLater(() -> {
                        if (!project.isDisposed() && message != null && !message.isBlank()) {
                            Messages.showInfoMessage(project, message, "EDI Developer Journal Companion");
                        }
                    });
                } catch (Exception error) {
                    String message = error.getMessage() == null ? "EDI request failed." : error.getMessage();
                    ApplicationManager.getApplication().invokeLater(() -> {
                        if (!project.isDisposed()) Messages.showErrorDialog(project, message, "EDI Developer Journal Companion");
                    });
                }
            }
        }.queue();
    }

    static JsonObject projectContext(Project project) {
        return EdiRequestContext.project(project);
    }
}
