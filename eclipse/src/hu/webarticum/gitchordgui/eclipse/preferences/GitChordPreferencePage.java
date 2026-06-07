package hu.webarticum.gitchordgui.eclipse.preferences;

import org.eclipse.jface.preference.BooleanFieldEditor;
import org.eclipse.jface.preference.ComboFieldEditor;
import org.eclipse.jface.preference.FieldEditorPreferencePage;
import org.eclipse.jface.preference.StringFieldEditor;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchPreferencePage;

import hu.webarticum.gitchordgui.eclipse.Activator;

public class GitChordPreferencePage extends FieldEditorPreferencePage implements IWorkbenchPreferencePage {

	public GitChordPreferencePage() {
		super(GRID);
		setPreferenceStore(Activator.getDefault().getPreferenceStore());
		setDescription("Git Chord GUI");
	}

	@Override
	public void init(IWorkbench workbench) {
		// No workbench-specific initialization.
	}

	@Override
	protected void createFieldEditors() {
		addField(new StringFieldEditor(
			GitChordPreferences.KEY_COMMAND_PATH,
			"Git Chord executable:",
			getFieldEditorParent()
		));
		addField(new ComboFieldEditor(
			GitChordPreferences.KEY_LANGUAGE,
			"Language:",
			new String[][] {
				{ "English (US)", "en-US" },
				{ "Magyar", "hu-HU" },
			},
			getFieldEditorParent()
		));
		addField(new StringFieldEditor(
			GitChordPreferences.KEY_CONTEXT_DIRECTORY,
			"Context directory:",
			getFieldEditorParent()
		));
		addField(new BooleanFieldEditor(
			GitChordPreferences.KEY_OPEN_ON_STARTUP,
			"Open About page on startup",
			getFieldEditorParent()
		));
	}

}
