package hu.webarticum.gitchord.gui.intellij.services

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.ui.content.Content
import com.intellij.ui.content.ContentFactory
import hu.webarticum.gitchord.gui.intellij.model.CommandResultPayload
import hu.webarticum.gitchord.gui.intellij.model.PageIntent
import hu.webarticum.gitchord.gui.intellij.model.PageOpenRequest
import hu.webarticum.gitchord.gui.intellij.model.PanelGroup
import hu.webarticum.gitchord.gui.intellij.model.WebviewMessage
import hu.webarticum.gitchord.gui.intellij.settings.GitChordSettings
import hu.webarticum.gitchord.gui.intellij.toolWindow.GitChordPanel
import java.io.File
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@Service(Service.Level.PROJECT)
class GitChordService(private val project: Project) {

    private val gson = Gson()

    private val panels = linkedMapOf<String, PanelRecord>()

    private var toolWindow: ToolWindow? = null

    fun attachToolWindow(toolWindow: ToolWindow) {
        runOnUiThread {
            this.toolWindow = toolWindow
            if (toolWindow.contentManager.contentCount == 0) {
                openPageInToolWindow(toolWindow, PanelGroup.global(), "/about", null)
            }
        }
    }

    fun openGlobalPage(path: String) {
        openPage(PanelGroup.global(), path, null)
    }

    fun openCurrentRepoPage(path: String = "/", intent: PageIntent? = null) {
        runInBackground {
            val repoRoot = resolveCurrentRepoRoot()
            invokeLater {
                if (repoRoot == null) {
                    showError("No Git repository context found.")
                    openPage(PanelGroup.global(), if (path == "/") "/repo-state" else path, intent)
                } else {
                    openPage(PanelGroup.repo(repoRoot), path, intent)
                }
            }
        }
    }

    fun openRepoStateForFile(file: VirtualFile?) {
        val candidatePath = file?.let { candidatePathForVirtualFile(it) }
        if (candidatePath == null) {
            showError("No file or directory selected.")
            return
        }

        runInBackground {
            val repoRoot = resolveRepoRootForPath(candidatePath)
            invokeLater {
                if (repoRoot == null) {
                    showError("The selected item is not inside a Git repository.")
                } else {
                    openPage(PanelGroup.repo(repoRoot), "/")
                }
            }
        }
    }

    fun handlePanelMessage(panel: GitChordPanel, rawMessage: String) {
        val message = try {
            gson.fromJson(rawMessage, WebviewMessage::class.java)
        } catch (e: JsonSyntaxException) {
            return
        } ?: return

        when (message.type) {
            "requestInitialState" -> panel.sendInitialState(initialRepoRoot(panel.group), language())
            "requestRepoContext" -> refreshPanelRepoContext(panel)
            "openPage" -> handleOpenPageRequest(panel, message.request)
            "setLanguage" -> handleSetLanguage(message.language)
            "openCommit" -> handleOpenCommit(panel.group, message.commitId)
            "exec" -> handleExec(panel, message)
        }
    }

    fun refreshAllLanguages() {
        val language = language()
        panels.values.forEach { it.panel.postMessage(mapOf("type" to "language", "language" to language)) }
    }

    private fun openPage(group: PanelGroup, path: String, intent: PageIntent? = null) {
        runOnUiThread {
            val toolWindow = toolWindow ?: ToolWindowManager.getInstance(project).getToolWindow(TOOL_WINDOW_ID)
            if (toolWindow == null) {
                showError("Git Chord tool window is not available.")
                return@runOnUiThread
            }

            this.toolWindow = toolWindow
            toolWindow.activate({ openPageInToolWindow(toolWindow, group, path, intent) }, true)
        }
    }

    private fun openPageInToolWindow(toolWindow: ToolWindow, group: PanelGroup, path: String, intent: PageIntent?) {
        val key = group.key()
        val existingRecord = panels[key]
        if (existingRecord != null) {
            toolWindow.contentManager.setSelectedContent(existingRecord.content)
            existingRecord.panel.navigate(path, intent)
            refreshPanelRepoContext(existingRecord.panel)
            existingRecord.panel.postMessage(mapOf("type" to "language", "language" to language()))
            return
        }

        val panel = GitChordPanel(this, group, path, intent)
        val content = ContentFactory.getInstance().createContent(panel.component, group.displayName(), false)
        val record = PanelRecord(group, panel, content)
        panels[key] = record
        content.setDisposer {
            panels.remove(key)
            Disposer.dispose(panel)
        }
        toolWindow.contentManager.addContent(content)
        toolWindow.contentManager.setSelectedContent(content)
    }

    private fun handleOpenPageRequest(sourcePanel: GitChordPanel, request: PageOpenRequest?) {
        val path = request?.path?.takeIf { it.isNotBlank() } ?: "/"
        when (request?.type) {
            "global" -> openPage(PanelGroup.global(), path, request.intent)
            "repo" -> {
                val repoRoot = request.repoRoot
                if (repoRoot.isNullOrBlank()) {
                    showError("No repository path was provided.")
                } else {
                    openPage(PanelGroup.repo(repoRoot), path, request.intent)
                }
            }
            "currentRepo" -> openCurrentRepoPage(path, request.intent)
            else -> sourcePanel.navigate(path, request?.intent)
        }
    }

    private fun handleSetLanguage(language: String?) {
        settings().setLanguage(language ?: GitChordSettings.DEFAULT_LANGUAGE)
        refreshAllLanguages()
    }

    private fun handleExec(panel: GitChordPanel, message: WebviewMessage) {
        val id = message.id ?: return
        val command = message.command ?: return
        if (!isGitChordCommand(command)) {
            panel.postMessage(execResultMessage(id, CommandResultPayload(
                1,
                "",
                "Rejected command: only git chord commands can be executed.",
            )))
            return
        }

        runInBackground {
            val result = runGitChordCommand(command, workingDirectory(panel.group))
            panel.postMessage(execResultMessage(id, result))
        }
    }

    private fun refreshPanelRepoContext(panel: GitChordPanel) {
        if (panel.group.type == PanelGroup.TYPE_REPO) {
            panel.postMessage(mapOf("type" to "repoContext", "repoRoot" to panel.group.repoRoot))
            return
        }

        runInBackground {
            val repoRoot = resolveCurrentRepoRoot()
            panel.postMessage(mapOf("type" to "repoContext", "repoRoot" to repoRoot))
        }
    }

    private fun initialRepoRoot(group: PanelGroup): String? {
        return if (group.type == PanelGroup.TYPE_REPO) {
            group.repoRoot
        } else {
            null
        }
    }

    private fun handleOpenCommit(group: PanelGroup, commitId: String?) {
        if (commitId == null || !COMMIT_ID_PATTERN.matches(commitId)) {
            showError("Invalid commit id.")
            return
        }

        runInBackground {
            val repoRoot = if (group.type == PanelGroup.TYPE_REPO) group.repoRoot else resolveCurrentRepoRoot()
            if (repoRoot == null) {
                invokeLater {
                    showError("No Git repository context found.")
                }
                return@runInBackground
            }

            val result = runProcess(
                listOf(
                    "git",
                    "-C",
                    repoRoot,
                    "show",
                    "--stat",
                    "--patch",
                    "--find-renames",
                    "--find-copies",
                    "--color=never",
                    commitId,
                ),
                null,
                COMMIT_TIMEOUT_MILLIS,
            )
            invokeLater {
                if (result.status == 0) {
                    openCommitDocument(commitId, result.stdout)
                } else {
                    showError(result.stderr.ifBlank { "Could not open commit." })
                }
            }
        }
    }

    private fun openCommitDocument(commitId: String, content: String) {
        val tempFile = Files.createTempFile("git-chord-${commitId.take(12)}-", ".diff")
        tempFile.toFile().deleteOnExit()
        Files.writeString(tempFile, content)

        val virtualFile = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(tempFile)
        if (virtualFile == null) {
            showError("Could not create commit preview.")
            return
        }

        FileEditorManager.getInstance(project).openFile(virtualFile, true)
    }

    private fun runGitChordCommand(command: List<String>, cwd: String?): CommandResultPayload {
        val configuredCommandPath = settings().effectiveCommandPath()
        val resolvedCommand = if (configuredCommandPath.isNotBlank()) {
            listOf(configuredCommandPath) + command.drop(2)
        } else {
            command
        }
        return runProcess(resolvedCommand, cwd, COMMAND_TIMEOUT_MILLIS)
    }

    private fun runProcess(command: List<String>, cwd: String?, timeoutMillis: Long): CommandResultPayload {
        return try {
            val processBuilder = ProcessBuilder(command)
            if (!cwd.isNullOrBlank()) {
                processBuilder.directory(File(cwd))
            }

            val process = processBuilder.start()
            val executor = Executors.newFixedThreadPool(2)
            try {
                val stdoutFuture = executor.submit(Callable { readStream(process.inputStream) })
                val stderrFuture = executor.submit(Callable { readStream(process.errorStream) })
                val finished = process.waitFor(timeoutMillis, TimeUnit.MILLISECONDS)
                if (!finished) {
                    process.destroyForcibly()
                    return CommandResultPayload(1, stdoutFuture.safeGet(), "Command timed out.")
                }

                CommandResultPayload(process.exitValue(), stdoutFuture.safeGet(), stderrFuture.safeGet())
            } finally {
                executor.shutdownNow()
            }
        } catch (e: Exception) {
            CommandResultPayload(1, "", e.message ?: e::class.java.simpleName)
        }
    }

    private fun readStream(inputStream: InputStream): String {
        return inputStream.bufferedReader().use { it.readText() }
    }

    private fun <T> java.util.concurrent.Future<T>.safeGet(): T {
        return get(1, TimeUnit.SECONDS)
    }

    private fun isGitChordCommand(command: List<String>): Boolean {
        return command.size >= 2 && command[0] == "git" && command[1] == "chord"
    }

    private fun resolveCurrentRepoRoot(): String? {
        val editorFile = FileEditorManager.getInstance(project).selectedFiles.firstOrNull()
        val editorPath = editorFile?.let { candidatePathForVirtualFile(it) }
        if (editorPath != null) {
            resolveRepoRootForPath(editorPath)?.let { return it }
        }

        return project.basePath?.let { resolveRepoRootForPath(it) }
    }

    private fun resolveRepoRootForPath(path: String): String? {
        val candidatePath = normalizeCandidatePath(path) ?: return null
        val result = runProcess(
            listOf("git", "-C", candidatePath, "rev-parse", "--show-toplevel"),
            null,
            REPO_RESOLVE_TIMEOUT_MILLIS,
        )
        return if (result.status == 0) result.stdout.trim().takeIf { it.isNotBlank() } else null
    }

    private fun candidatePathForVirtualFile(file: VirtualFile): String {
        return if (file.isDirectory) file.path else file.parent?.path ?: file.path
    }

    private fun normalizeCandidatePath(path: String): String? {
        val candidate = Path.of(path)
        return when {
            Files.isDirectory(candidate) -> candidate.toString()
            candidate.parent != null -> candidate.parent.toString()
            else -> null
        }
    }

    private fun workingDirectory(group: PanelGroup): String? {
        return if (group.type == PanelGroup.TYPE_REPO) group.repoRoot else project.basePath
    }

    private fun execResultMessage(id: String, result: CommandResultPayload): Map<String, Any> {
        return mapOf("type" to "execResult", "id" to id, "result" to result)
    }

    private fun language(): String {
        return settings().effectiveLanguage()
    }

    private fun settings(): GitChordSettings {
        return ApplicationManager.getApplication().service()
    }

    private fun runInBackground(action: () -> Unit) {
        ApplicationManager.getApplication().executeOnPooledThread(action)
    }

    private fun invokeLater(action: () -> Unit) {
        ApplicationManager.getApplication().invokeLater(action)
    }

    private fun runOnUiThread(action: () -> Unit) {
        val application = ApplicationManager.getApplication()
        if (application.isDispatchThread) {
            action()
        } else {
            application.invokeLater(action)
        }
    }

    private fun showError(message: String) {
        runOnUiThread {
            Messages.showErrorDialog(project, message, "Git Chord")
        }
    }

    private data class PanelRecord(
        val group: PanelGroup,
        val panel: GitChordPanel,
        val content: Content,
    )

    companion object {
        const val TOOL_WINDOW_ID = "GitChordWindow"
        private const val COMMAND_TIMEOUT_MILLIS = 30_000L
        private const val COMMIT_TIMEOUT_MILLIS = 30_000L
        private const val REPO_RESOLVE_TIMEOUT_MILLIS = 5_000L
        private val COMMIT_ID_PATTERN = Regex("^[0-9a-fA-F]{7,40}$")
    }
}
