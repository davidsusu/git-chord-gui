package hu.webarticum.gitchord.gui.intellij.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

@Service(Service.Level.APP)
@State(name = "GitChordSettings", storages = [Storage("git-chord.xml")])
class GitChordSettings : PersistentStateComponent<GitChordSettings.SettingsState> {

    private var state = SettingsState()

    override fun getState(): SettingsState {
        return state
    }

    override fun loadState(state: SettingsState) {
        this.state = state
    }

    fun effectiveCommandPath(): String {
        return firstNonBlank(
            System.getProperty("gitChord.commandPath"),
            System.getenv("GIT_CHORD_COMMAND_PATH"),
            state.commandPath,
        )
    }

    fun effectiveLanguage(): String {
        return normalizeLanguage(firstNonBlank(
            System.getProperty("gitChord.language"),
            System.getenv("GIT_CHORD_LANGUAGE"),
            state.language,
        ))
    }

    fun setLanguage(language: String) {
        state.language = normalizeLanguage(language)
    }

    fun shouldOpenOnStartup(): Boolean {
        return parseBoolean(System.getProperty("gitChord.openOnStartup"))
            ?: parseBoolean(System.getenv("GIT_CHORD_OPEN_ON_STARTUP"))
            ?: state.openOnStartup
    }

    private fun firstNonBlank(vararg values: String?): String {
        return values.firstOrNull { !it.isNullOrBlank() }?.trim() ?: ""
    }

    private fun parseBoolean(value: String?): Boolean? {
        return when (value?.trim()?.lowercase()) {
            "1", "true", "yes", "on" -> true
            "0", "false", "no", "off" -> false
            else -> null
        }
    }

    class SettingsState {
        var commandPath: String = ""
        var language: String = DEFAULT_LANGUAGE
        var openOnStartup: Boolean = false
    }

    companion object {
        const val DEFAULT_LANGUAGE = "en-US"

        fun normalizeLanguage(language: String?): String {
            return when (language?.trim()) {
                "hu-HU" -> "hu-HU"
                else -> DEFAULT_LANGUAGE
            }
        }
    }
}

