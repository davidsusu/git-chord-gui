package hu.webarticum.gitchord.gui.intellij.model

import java.io.File

data class PanelGroup(
    val type: String,
    val repoRoot: String? = null,
) {

    fun key(): String {
        return if (type == TYPE_REPO && !repoRoot.isNullOrBlank()) {
            "repo:$repoRoot"
        } else {
            TYPE_GLOBAL
        }
    }

    fun displayName(): String {
        if (type != TYPE_REPO || repoRoot.isNullOrBlank()) {
            return "General"
        }

        return File(repoRoot).name.ifBlank { repoRoot }
    }

    fun toPayload(): Map<String, String> {
        return if (type == TYPE_REPO && !repoRoot.isNullOrBlank()) {
            mapOf("type" to TYPE_REPO, "repoRoot" to repoRoot)
        } else {
            mapOf("type" to TYPE_GLOBAL)
        }
    }

    companion object {
        const val TYPE_GLOBAL = "global"
        const val TYPE_REPO = "repo"

        fun global(): PanelGroup = PanelGroup(TYPE_GLOBAL)

        fun repo(repoRoot: String): PanelGroup = PanelGroup(TYPE_REPO, repoRoot)
    }
}

data class PageIntent(
    val type: String? = null,
)

data class PageOpenRequest(
    val type: String? = null,
    val path: String? = null,
    val repoRoot: String? = null,
    val intent: PageIntent? = null,
)

data class WebviewMessage(
    val type: String? = null,
    val id: String? = null,
    val command: List<String>? = null,
    val commitIds: List<String>? = null,
    val request: PageOpenRequest? = null,
    val language: String? = null,
    val commitId: String? = null,
)

data class CommandResultPayload(
    val status: Int,
    val stdout: String,
    val stderr: String,
)
