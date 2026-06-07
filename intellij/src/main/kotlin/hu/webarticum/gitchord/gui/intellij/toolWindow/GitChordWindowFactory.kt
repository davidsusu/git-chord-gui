package hu.webarticum.gitchord.gui.intellij.toolWindow

import com.intellij.openapi.components.service
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import hu.webarticum.gitchord.gui.intellij.services.GitChordService

class GitChordWindowFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        project.service<GitChordService>().attachToolWindow(toolWindow)
    }
}
