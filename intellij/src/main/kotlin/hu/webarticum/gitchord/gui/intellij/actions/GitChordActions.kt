package hu.webarticum.gitchord.gui.intellij.actions

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.components.service
import hu.webarticum.gitchord.gui.intellij.model.PageIntent
import hu.webarticum.gitchord.gui.intellij.services.GitChordService

class GitChordAboutAction : GitChordProjectAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.service<GitChordService>()?.openGlobalPage("/about")
    }
}

class GitChordCliHelpAction : GitChordProjectAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.service<GitChordService>()?.openGlobalPage("/cli-help")
    }
}

class GitChordRepoStateAction : GitChordProjectAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.service<GitChordService>()?.openCurrentRepoPage("/")
    }
}

class GitChordCreateSnapshotAction : GitChordProjectAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.service<GitChordService>()?.openCurrentRepoPage("/", PageIntent("createSnapshot"))
    }
}

class GitChordRepoStateFromContextAction : GitChordProjectAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
            ?: e.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY)?.firstOrNull()
        e.project?.service<GitChordService>()?.openRepoStateForFile(file)
    }

    override fun update(e: AnActionEvent) {
        super.update(e)
        if (e.project == null) {
            return
        }

        val hasFile = e.getData(CommonDataKeys.VIRTUAL_FILE) != null ||
            !e.getData(CommonDataKeys.VIRTUAL_FILE_ARRAY).isNullOrEmpty()
        e.presentation.isEnabledAndVisible = hasFile
    }
}

abstract class GitChordProjectAction : AnAction() {

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }

    override fun getActionUpdateThread(): ActionUpdateThread {
        return ActionUpdateThread.BGT
    }
}

