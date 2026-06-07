package hu.webarticum.gitchordgui.eclipse.actions;

import hu.webarticum.gitchordgui.eclipse.model.PageIntent;
import hu.webarticum.gitchordgui.eclipse.services.GitChordService;
import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.ui.handlers.HandlerUtil;

public class GitChordCommandHandler extends AbstractHandler {

	public static final String COMMAND_ABOUT = "hu.webarticum.gitchordgui.eclipse.commands.about";
	public static final String COMMAND_CLI_HELP = "hu.webarticum.gitchordgui.eclipse.commands.cliHelp";
	public static final String COMMAND_REPO_STATE = "hu.webarticum.gitchordgui.eclipse.commands.repoState";
	public static final String COMMAND_CREATE_SNAPSHOT = "hu.webarticum.gitchordgui.eclipse.commands.createSnapshot";
	public static final String COMMAND_REPO_STATE_FROM_SELECTION =
		"hu.webarticum.gitchordgui.eclipse.commands.repoStateFromSelection";

	@Override
	public Object execute(ExecutionEvent event) throws ExecutionException {
		GitChordService service = GitChordService.getInstance();
		switch (event.getCommand().getId()) {
			case COMMAND_ABOUT:
				service.openGlobalPage("/about");
				break;
			case COMMAND_CLI_HELP:
				service.openGlobalPage("/cli-help");
				break;
			case COMMAND_REPO_STATE:
				service.openCurrentRepoPage("/");
				break;
			case COMMAND_CREATE_SNAPSHOT:
				service.openCurrentRepoPage("/", PageIntent.CREATE_SNAPSHOT);
				break;
			case COMMAND_REPO_STATE_FROM_SELECTION:
				ISelection selection = HandlerUtil.getCurrentSelection(event);
				service.openRepoStateForSelection(selection);
				break;
			default:
				break;
		}
		return null;
	}

}
