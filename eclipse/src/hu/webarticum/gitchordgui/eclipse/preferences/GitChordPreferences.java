package hu.webarticum.gitchordgui.eclipse.preferences;

import hu.webarticum.gitchordgui.eclipse.Activator;
import org.eclipse.jface.preference.IPreferenceStore;

public final class GitChordPreferences {

	public static final String KEY_COMMAND_PATH = "commandPath";
	public static final String KEY_LANGUAGE = "language";
	public static final String KEY_OPEN_ON_STARTUP = "openOnStartup";
	public static final String KEY_CONTEXT_DIRECTORY = "contextDirectory";

	public static final String DEFAULT_LANGUAGE = "en-US";

	private GitChordPreferences() {
		// Utility class.
	}

	public static void initializeDefaults(IPreferenceStore store) {
		store.setDefault(KEY_COMMAND_PATH, "");
		store.setDefault(KEY_LANGUAGE, DEFAULT_LANGUAGE);
		store.setDefault(KEY_OPEN_ON_STARTUP, false);
		store.setDefault(KEY_CONTEXT_DIRECTORY, "");
	}

	public static String effectiveCommandPath() {
		return firstNonBlank(
			System.getProperty("gitChord.commandPath"),
			System.getenv("GIT_CHORD_COMMAND_PATH"),
			store().getString(KEY_COMMAND_PATH)
		);
	}

	public static String effectiveLanguage() {
		return normalizeLanguage(firstNonBlank(
			System.getProperty("gitChord.language"),
			System.getenv("GIT_CHORD_LANGUAGE"),
			store().getString(KEY_LANGUAGE)
		));
	}

	public static void setLanguage(String language) {
		store().setValue(KEY_LANGUAGE, normalizeLanguage(language));
	}

	public static boolean shouldOpenOnStartup() {
		Boolean externalValue = parseBoolean(firstNonBlank(
			System.getProperty("gitChord.openOnStartup"),
			System.getenv("GIT_CHORD_OPEN_ON_STARTUP")
		));
		return externalValue != null ? externalValue.booleanValue() : store().getBoolean(KEY_OPEN_ON_STARTUP);
	}

	public static String effectiveContextDirectory() {
		return firstNonBlank(
			System.getProperty("gitChord.contextDirectory"),
			System.getenv("GIT_CHORD_CONTEXT_DIRECTORY"),
			store().getString(KEY_CONTEXT_DIRECTORY)
		);
	}

	public static String normalizeLanguage(String language) {
		return "hu-HU".equals(language == null ? "" : language.trim()) ? "hu-HU" : DEFAULT_LANGUAGE;
	}

	private static IPreferenceStore store() {
		return Activator.getDefault().getPreferenceStore();
	}

	private static String firstNonBlank(String... values) {
		for (String value : values) {
			if (value != null && !value.trim().isEmpty()) {
				return value.trim();
			}
		}
		return "";
	}

	private static Boolean parseBoolean(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}

		switch (value.trim().toLowerCase()) {
			case "1":
			case "true":
			case "yes":
			case "on":
				return Boolean.TRUE;
			case "0":
			case "false":
			case "no":
			case "off":
				return Boolean.FALSE;
			default:
				return null;
		}
	}

}
