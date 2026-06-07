package hu.webarticum.gitchordgui.eclipse.startup;

import hu.webarticum.gitchordgui.eclipse.preferences.GitChordPreferences;
import hu.webarticum.gitchordgui.eclipse.services.GitChordService;
import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.IStartup;

public class GitChordStartup implements IStartup {

	@Override
	public void earlyStartup() {
		if (!GitChordPreferences.shouldOpenOnStartup()) {
			return;
		}

		Display.getDefault().asyncExec(() -> GitChordService.getInstance().openGlobalPage("/about"));
	}

}
