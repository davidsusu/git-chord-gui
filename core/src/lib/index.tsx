import GitChordGui from './components/GitChordGui'
import { GlobalContext } from './components/state/context'
import CommandExecutorGitChord from './chord/CommandExecutorGitChord'
import CommandResult from './exec/CommandResult'
import MockGitChord from './chord/MockGitChord'
import './styles.css'

export type { default as CommandExecutorInterface } from './exec/CommandExecutorInterface'
export type { default as GitChordInterface } from './chord/GitChordInterface'
export type { PageGroup, PageIntent, PageOpenRequest, ThemeMode, UiControls } from './components/state/context'
export type { LanguageCode, MessageKey } from './i18n'

export {
    CommandExecutorGitChord,
    CommandResult,
    GitChordGui,
    GlobalContext as GitChordContext,
    MockGitChord,
}

export { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, normalizeLanguage, translate } from './i18n'
