package hu.webarticum.gitchord.gui.intellij.startup

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.StartupActivity
import hu.webarticum.gitchord.gui.intellij.services.GitChordService
import hu.webarticum.gitchord.gui.intellij.settings.GitChordSettings

class GitChordStartupActivity : StartupActivity.DumbAware {

    override fun runActivity(project: Project) {
        val settings = ApplicationManager.getApplication().service<GitChordSettings>()
        if (settings.shouldOpenOnStartup()) {
            project.service<GitChordService>().openGlobalPage("/about")
        }
    }
}

