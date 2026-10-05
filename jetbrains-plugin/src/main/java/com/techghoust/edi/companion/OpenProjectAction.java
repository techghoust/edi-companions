package com.techghoust.edi.companion;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.Project;
import org.jetbrains.annotations.NotNull;

public final class OpenProjectAction extends AnAction {
    @Override
    public void update(@NotNull AnActionEvent event) {
        event.getPresentation().setEnabled(event.getProject() != null);
    }

    @Override
    public void actionPerformed(@NotNull AnActionEvent event) {
        Project project = event.getProject();
        if (project == null) return;
        EdiActionSupport.run(project, "Opening project in EDI…", () -> {
            var result = EdiIntegrationClient.openProject(EdiActionSupport.projectContext(project));
            return result.has("needsLink") && result.get("needsLink").getAsBoolean()
                    ? "EDI opened the project form. Link or create this project there."
                    : "Project opened in EDI.";
        });
    }
}
