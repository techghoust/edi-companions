package com.techghoust.edi.companion;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.fileChooser.FileChooser;
import com.intellij.openapi.fileChooser.FileChooserDescriptor;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import org.jetbrains.annotations.NotNull;

public final class ConfigureExecutableAction extends AnAction {
    @Override
    public void update(@NotNull AnActionEvent event) {
        event.getPresentation().setEnabled(event.getProject() != null);
    }

    @Override
    public void actionPerformed(@NotNull AnActionEvent event) {
        Project project = event.getProject();
        if (project == null) return;
        boolean mac = System.getProperty("os.name", "").toLowerCase().contains("mac");
        FileChooserDescriptor descriptor = new FileChooserDescriptor(true, mac, false, false, false, false)
                .withTitle(mac ? "Select EDI app bundle or executable" : "Select EDI executable");
        var selected = FileChooser.chooseFile(descriptor, project, null);
        if (selected == null) return;
        EdiIntegrationClient.rememberExecutable(selected.toNioPath());
        Messages.showInfoMessage(project, "EDI path saved. Run the EDI command again.", "EDI Developer Journal Companion");
    }
}
