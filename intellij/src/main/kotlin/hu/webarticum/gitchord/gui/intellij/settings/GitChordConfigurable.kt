package hu.webarticum.gitchord.gui.intellij.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.options.SearchableConfigurable
import com.intellij.openapi.ui.ComboBox
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import javax.swing.JComponent
import javax.swing.JPanel

class GitChordConfigurable : SearchableConfigurable {

    private var panel: JPanel? = null
    private var commandPathField: JBTextField? = null
    private var languageComboBox: ComboBox<LanguageOption>? = null
    private var openOnStartupCheckBox: JBCheckBox? = null

    override fun getId(): String {
        return "hu.webarticum.gitchord.gui.intellij.settings"
    }

    override fun getDisplayName(): String {
        return "Git Chord"
    }

    override fun createComponent(): JComponent {
        val commandPathField = JBTextField()
        val languageComboBox = ComboBox(LANGUAGES.toTypedArray())
        val openOnStartupCheckBox = JBCheckBox("Open About page on startup")

        this.commandPathField = commandPathField
        this.languageComboBox = languageComboBox
        this.openOnStartupCheckBox = openOnStartupCheckBox

        val panel = JPanel(GridBagLayout())
        this.panel = panel

        addRow(panel, 0, JBLabel("Git Chord executable:"), commandPathField)
        addRow(panel, 1, JBLabel("Language:"), languageComboBox)
        addRow(panel, 2, JBLabel("Startup:"), openOnStartupCheckBox)

        reset()
        return panel
    }

    override fun isModified(): Boolean {
        val state = settings().state
        return commandPathField?.text?.trim() != state.commandPath ||
            selectedLanguage() != state.language ||
            openOnStartupCheckBox?.isSelected != state.openOnStartup
    }

    override fun apply() {
        val state = settings().state
        state.commandPath = commandPathField?.text?.trim() ?: ""
        state.language = GitChordSettings.normalizeLanguage(selectedLanguage())
        state.openOnStartup = openOnStartupCheckBox?.isSelected ?: false
    }

    override fun reset() {
        val state = settings().state
        commandPathField?.text = state.commandPath
        languageComboBox?.selectedItem = LANGUAGES.firstOrNull { it.code == state.language } ?: LANGUAGES.first()
        openOnStartupCheckBox?.isSelected = state.openOnStartup
    }

    override fun disposeUIResources() {
        panel = null
        commandPathField = null
        languageComboBox = null
        openOnStartupCheckBox = null
    }

    private fun selectedLanguage(): String {
        return (languageComboBox?.selectedItem as? LanguageOption)?.code ?: GitChordSettings.DEFAULT_LANGUAGE
    }

    private fun settings(): GitChordSettings {
        return ApplicationManager.getApplication().service()
    }

    private fun addRow(panel: JPanel, row: Int, label: JComponent, field: JComponent) {
        val labelConstraints = GridBagConstraints().apply {
            gridx = 0
            gridy = row
            anchor = GridBagConstraints.WEST
            insets.set(4, 0, 4, 12)
        }
        panel.add(label, labelConstraints)

        val fieldConstraints = GridBagConstraints().apply {
            gridx = 1
            gridy = row
            weightx = 1.0
            fill = GridBagConstraints.HORIZONTAL
            insets.set(4, 0, 4, 0)
        }
        panel.add(field, fieldConstraints)
    }

    private data class LanguageOption(
        val code: String,
        val label: String,
    ) {
        override fun toString(): String {
            return label
        }
    }

    companion object {
        private val LANGUAGES = listOf(
            LanguageOption("en-US", "English (US)"),
            LanguageOption("hu-HU", "Magyar"),
        )
    }
}

