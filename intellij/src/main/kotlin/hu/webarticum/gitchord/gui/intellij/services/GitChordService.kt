package hu.webarticum.gitchord.gui.intellij.services

import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import hu.webarticum.gitchord.gui.intellij.GitChordBundle

@Service(Service.Level.PROJECT)
class GitChordService(project: Project) {

    init {
        thisLogger().info(GitChordBundle.message("projectService", project.name))
        thisLogger().warn("Don't forget to remove all non-needed sample code files with their corresponding registration entries in `plugin.xml`.")
    }

    fun getRandomNumber() = (1..100).random()
}
