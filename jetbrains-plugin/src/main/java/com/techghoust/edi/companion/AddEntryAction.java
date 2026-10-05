package com.techghoust.edi.companion;

import com.google.gson.JsonObject;
import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.actionSystem.CommonDataKeys;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import org.jetbrains.annotations.NotNull;

abstract class AddEntryAction extends AnAction {
    private final String type;
    private final String label;
    private final String prompt;

    AddEntryAction(String type, String label, String prompt) {
        this.type = type;
        this.label = label;
        this.prompt = prompt;
    }

    @Override
    public void update(@NotNull AnActionEvent event) {
        event.getPresentation().setEnabled(event.getProject() != null);
    }

    @Override
    public void actionPerformed(@NotNull AnActionEvent event) {
        Project project = event.getProject();
        if (project == null) return;

        Editor editor = event.getData(CommonDataKeys.EDITOR);
        EdiRequestContext.SourceSnapshot source;
        try {
            source = EdiRequestContext.captureSource(editor);
        } catch (IllegalArgumentException error) {
            Messages.showErrorDialog(project, error.getMessage(), "EDI Developer Journal Companion");
            return;
        }

        String title = Messages.showInputDialog(project, "Enter a title (1–200 characters).", "EDI: Add " + label, Messages.getQuestionIcon());
        if (title == null) return;
        title = title.trim();
        if (title.isEmpty() || title.length() > 200) {
            Messages.showErrorDialog(project, "Use a title from 1 to 200 characters.", "EDI Developer Journal Companion");
            return;
        }
        String comment = Messages.showInputDialog(project, prompt, "EDI: Add " + label, Messages.getQuestionIcon(), "", null);
        if (comment == null) return;
        comment = comment.trim();
        if (comment.length() > 10_000) {
            Messages.showErrorDialog(project, "Use no more than 10,000 characters.", "EDI Developer Journal Companion");
            return;
        }

        final String entryTitle = title;
        final String entryComment = comment;
        EdiActionSupport.run(project, "Saving " + label + " to EDI…", () -> {
            JsonObject projectRef = EdiActionSupport.projectContext(project);
            JsonObject sourceContext = EdiRequestContext.source(source, projectRef);
            JsonObject result = EdiIntegrationClient.createEntry(projectRef, sourceContext, type, entryTitle, entryComment);
            return result.has("duplicate") && result.get("duplicate").getAsBoolean()
                    ? "This entry was already saved."
                    : label + " saved to EDI.";
        });
    }
}
