package hu.webarticum.gitchordgui.eclipse.services;

import hu.webarticum.gitchordgui.eclipse.model.CommandResultPayload;
import hu.webarticum.gitchordgui.eclipse.model.PageIntent;
import hu.webarticum.gitchordgui.eclipse.model.PageOpenRequest;
import hu.webarticum.gitchordgui.eclipse.model.PanelGroup;
import hu.webarticum.gitchordgui.eclipse.model.PanelState;
import hu.webarticum.gitchordgui.eclipse.preferences.GitChordPreferences;
import hu.webarticum.gitchordgui.eclipse.util.JsonUtil;
import hu.webarticum.gitchordgui.eclipse.views.GitChordGui;
import java.io.File;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.eclipse.core.filesystem.EFS;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.core.runtime.IAdaptable;
import org.eclipse.core.runtime.IPath;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.swt.widgets.Display;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.IPathEditorInput;
import org.eclipse.ui.IURIEditorInput;
import org.eclipse.ui.IViewPart;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.IWorkbenchWindow;
import org.eclipse.ui.PartInitException;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.ide.IDE;

public final class GitChordService {

	private static final String GLOBAL_SECONDARY_ID = "";
	private static final long COMMAND_TIMEOUT_MILLIS = 30_000L;
	private static final long COMMIT_TIMEOUT_MILLIS = 30_000L;
	private static final long REPO_RESOLVE_TIMEOUT_MILLIS = 5_000L;
	private static final Pattern COMMIT_ID_PATTERN = Pattern.compile("^[0-9a-fA-F]{7,40}$");

	private static final GitChordService INSTANCE = new GitChordService();

	private final ExecutorService executorService = Executors.newCachedThreadPool();

	private final Map<String, PanelState> statesBySecondaryId = new LinkedHashMap<>();

	private final Map<String, GitChordGui> viewsByGroupKey = new LinkedHashMap<>();

	private GitChordService() {
		// Singleton.
	}

	public static GitChordService getInstance() {
		return INSTANCE;
	}

	public synchronized PanelState attachView(GitChordGui view, String secondaryId) {
		String normalizedSecondaryId = normalizeSecondaryId(secondaryId);
		PanelState state = statesBySecondaryId.computeIfAbsent(
			normalizedSecondaryId,
			id -> new PanelState(PanelGroup.global(), "/about", null)
		);
		viewsByGroupKey.put(state.group().key(), view);
		return state;
	}

	public synchronized void detachView(GitChordGui view) {
		viewsByGroupKey.values().removeIf(candidate -> candidate == view);
	}

	public void openGlobalPage(String path) {
		openPage(PanelGroup.global(), path, null);
	}

	public void openCurrentRepoPage(String path) {
		openCurrentRepoPage(path, null);
	}

	public void openCurrentRepoPage(String path, PageIntent intent) {
		runInBackground(() -> {
			String repoRoot = resolveCurrentRepoRoot();
			runOnUiThread(() -> {
				if (repoRoot == null) {
					showError("No Git repository context found.");
					openPage(PanelGroup.global(), "/".equals(path) ? "/repo-state" : path, intent);
				} else {
					openPage(PanelGroup.repo(repoRoot), path, intent);
				}
			});
		});
	}

	public void openRepoStateForSelection(ISelection selection) {
		String candidatePath = candidatePathForSelection(selection);
		if (candidatePath == null) {
			showError("No file-system resource was selected.");
			return;
		}

		runInBackground(() -> {
			String repoRoot = resolveRepoRootForPath(candidatePath);
			runOnUiThread(() -> {
				if (repoRoot == null) {
					showError("No Git repository found for the selected resource.");
				} else {
					openPage(PanelGroup.repo(repoRoot), "/", null);
				}
			});
		});
	}

	public void handleViewMessage(GitChordGui view, String rawMessage) {
		Map<String, Object> message = JsonUtil.parseObject(rawMessage);
		String type = asString(message.get("type"));
		if (type == null) {
			return;
		}

		switch (type) {
			case "requestInitialState":
				view.sendInitialState(initialRepoRoot(view.group()), GitChordPreferences.effectiveLanguage());
				break;
			case "requestRepoContext":
				refreshViewRepoContext(view);
				break;
			case "openPage":
				handleOpenPageRequest(view, PageOpenRequest.fromPayload(message.get("request")));
				break;
			case "setLanguage":
				handleSetLanguage(asString(message.get("language")));
				break;
			case "openCommit":
				handleOpenCommit(view.group(), asString(message.get("commitId")));
				break;
			case "exec":
				handleExec(view, asString(message.get("id")), asStringList(message.get("command")));
				break;
			default:
				break;
		}
	}

	public void refreshAllLanguages() {
		String language = GitChordPreferences.effectiveLanguage();
		for (GitChordGui view : snapshotViews()) {
			view.postMessage(mapOf("type", "language", "language", language));
		}
	}

	private void openPage(PanelGroup group, String path, PageIntent intent) {
		runOnUiThread(() -> {
			IWorkbenchWindow window = activeWorkbenchWindow();
			if (window == null) {
				showError("No active Eclipse workbench window found.");
				return;
			}

			IWorkbenchPage page = window.getActivePage();
			if (page == null) {
				showError("No active Eclipse workbench page found.");
				return;
			}

			String secondaryId = secondaryIdForGroup(group);
			PanelState nextState = new PanelState(group, normalizePath(path), intent);
			synchronized (this) {
				statesBySecondaryId.put(normalizeSecondaryId(secondaryId), nextState);
			}

			try {
				IViewPart part = group.isRepo()
					? page.showView(GitChordGui.ID, secondaryId, IWorkbenchPage.VIEW_ACTIVATE)
					: page.showView(GitChordGui.ID);
				if (part instanceof GitChordGui) {
					((GitChordGui) part).applyState(nextState);
				}
			} catch (PartInitException e) {
				showError(e.getMessage());
			}
		});
	}

	private void handleOpenPageRequest(GitChordGui sourceView, PageOpenRequest request) {
		String path = normalizePath(request == null ? null : request.path());
		String type = request == null ? null : request.type();
		if ("global".equals(type)) {
			openPage(PanelGroup.global(), path, request.intent());
		} else if ("repo".equals(type)) {
			String repoRoot = request.repoRoot();
			if (repoRoot == null || repoRoot.isBlank()) {
				showError("No repository path was provided.");
			} else {
				openPage(PanelGroup.repo(repoRoot), path, request.intent());
			}
		} else if ("currentRepo".equals(type)) {
			openCurrentRepoPage(path, request.intent());
		} else {
			sourceView.navigate(path, request == null ? null : request.intent());
		}
	}

	private void handleSetLanguage(String language) {
		GitChordPreferences.setLanguage(language);
		refreshAllLanguages();
	}

	private void handleExec(GitChordGui view, String id, List<String> command) {
		if (id == null || command == null) {
			return;
		}

		if (!isGitChordCommand(command)) {
			view.postMessage(execResultMessage(id, new CommandResultPayload(
				1,
				"",
				"Rejected command: only git chord commands can be executed."
			)));
			return;
		}

		runInBackground(() -> {
			CommandResultPayload result = runGitChordCommand(command, workingDirectory(view.group()));
			view.postMessage(execResultMessage(id, result));
		});
	}

	private void refreshViewRepoContext(GitChordGui view) {
		if (view.group().isRepo()) {
			view.postMessage(mapOf("type", "repoContext", "repoRoot", view.group().repoRoot()));
			return;
		}

		runInBackground(() -> {
			String repoRoot = resolveCurrentRepoRoot();
			view.postMessage(mapOf("type", "repoContext", "repoRoot", repoRoot));
		});
	}

	private String initialRepoRoot(PanelGroup group) {
		return group.isRepo() ? group.repoRoot() : null;
	}

	private void handleOpenCommit(PanelGroup group, String commitId) {
		if (commitId == null || !COMMIT_ID_PATTERN.matcher(commitId).matches()) {
			showError("Invalid commit id.");
			return;
		}

		runInBackground(() -> {
			String repoRoot = group.isRepo() ? group.repoRoot() : resolveCurrentRepoRoot();
			if (repoRoot == null) {
				showError("No Git repository context found.");
				return;
			}

			CommandResultPayload result = runProcess(
				List.of(
					"git",
					"-C",
					repoRoot,
					"show",
					"--stat",
					"--patch",
					"--find-renames",
					"--find-copies",
					"--color=never",
					commitId
				),
				null,
				COMMIT_TIMEOUT_MILLIS
			);
			if (result.status() == 0) {
				openCommitDocument(commitId, result.stdout());
			} else {
				showError(result.stderr().isBlank() ? "Could not open commit." : result.stderr());
			}
		});
	}

	private void openCommitDocument(String commitId, String content) {
		runOnUiThread(() -> {
			try {
				Path tempFile = Files.createTempFile("git-chord-" + commitId.substring(0, Math.min(12, commitId.length())) + "-", ".diff");
				tempFile.toFile().deleteOnExit();
				Files.writeString(tempFile, content, StandardCharsets.UTF_8);
				IWorkbenchWindow window = activeWorkbenchWindow();
				if (window == null || window.getActivePage() == null) {
					showError("No active Eclipse workbench page found.");
					return;
				}
				IDE.openEditorOnFileStore(
					window.getActivePage(),
					EFS.getLocalFileSystem().fromLocalFile(tempFile.toFile())
				);
			} catch (Exception e) {
				showError(e.getMessage() == null ? "Could not create commit preview." : e.getMessage());
			}
		});
	}

	private CommandResultPayload runGitChordCommand(List<String> command, String cwd) {
		String configuredCommandPath = GitChordPreferences.effectiveCommandPath();
		List<String> resolvedCommand = new ArrayList<>();
		if (!configuredCommandPath.isBlank()) {
			resolvedCommand.add(configuredCommandPath);
			resolvedCommand.addAll(command.subList(2, command.size()));
		} else {
			resolvedCommand.addAll(command);
		}
		return runProcess(resolvedCommand, cwd, COMMAND_TIMEOUT_MILLIS);
	}

	private CommandResultPayload runProcess(List<String> command, String cwd, long timeoutMillis) {
		try {
			ProcessBuilder processBuilder = new ProcessBuilder(command);
			if (cwd != null && !cwd.isBlank()) {
				processBuilder.directory(new File(cwd));
			}

			Process process = processBuilder.start();
			Future<String> stdoutFuture = executorService.submit(streamReader(process.getInputStream()));
			Future<String> stderrFuture = executorService.submit(streamReader(process.getErrorStream()));
			boolean finished = process.waitFor(timeoutMillis, TimeUnit.MILLISECONDS);
			if (!finished) {
				process.destroyForcibly();
				return new CommandResultPayload(1, safeGet(stdoutFuture), "Command timed out.");
			}
			return new CommandResultPayload(process.exitValue(), safeGet(stdoutFuture), safeGet(stderrFuture));
		} catch (Exception e) {
			return new CommandResultPayload(1, "", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
		}
	}

	private Callable<String> streamReader(InputStream inputStream) {
		return () -> new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
	}

	private String safeGet(Future<String> future) {
		try {
			return future.get(1, TimeUnit.SECONDS);
		} catch (Exception e) {
			return "";
		}
	}

	private boolean isGitChordCommand(List<String> command) {
		return command.size() >= 2 && "git".equals(command.get(0)) && "chord".equals(command.get(1));
	}

	private String resolveCurrentRepoRoot() {
		String editorPath = candidatePathForActiveEditor();
		if (editorPath != null) {
			String repoRoot = resolveRepoRootForPath(editorPath);
			if (repoRoot != null) {
				return repoRoot;
			}
		}

		String contextDirectory = GitChordPreferences.effectiveContextDirectory();
		if (!contextDirectory.isBlank()) {
			String repoRoot = resolveRepoRootForPath(contextDirectory);
			if (repoRoot != null) {
				return repoRoot;
			}
		}

		String workspacePath = workspacePath();
		return workspacePath == null ? null : resolveRepoRootForPath(workspacePath);
	}

	private String resolveRepoRootForPath(String path) {
		String candidatePath = normalizeCandidatePath(path);
		if (candidatePath == null) {
			return null;
		}

		CommandResultPayload result = runProcess(
			List.of("git", "-C", candidatePath, "rev-parse", "--show-toplevel"),
			null,
			REPO_RESOLVE_TIMEOUT_MILLIS
		);
		return result.status() == 0 ? result.stdout().trim() : null;
	}

	private String candidatePathForSelection(ISelection selection) {
		if (!(selection instanceof IStructuredSelection)) {
			return null;
		}

		Object firstElement = ((IStructuredSelection) selection).getFirstElement();
		return candidatePathForObject(firstElement);
	}

	private String candidatePathForObject(Object object) {
		if (object instanceof IResource) {
			return pathForResource((IResource) object);
		}

		if (object instanceof IAdaptable) {
			IResource resource = ((IAdaptable) object).getAdapter(IResource.class);
			if (resource != null) {
				return pathForResource(resource);
			}
		}

		if (object instanceof File) {
			return ((File) object).getAbsolutePath();
		}

		return null;
	}

	private String pathForResource(IResource resource) {
		IPath location = resource.getLocation();
		return location == null ? null : location.toOSString();
	}

	private String candidatePathForActiveEditor() {
		IWorkbenchWindow window = activeWorkbenchWindow();
		IWorkbenchPage page = window == null ? null : window.getActivePage();
		IEditorPart editor = page == null ? null : page.getActiveEditor();
		IEditorInput input = editor == null ? null : editor.getEditorInput();
		if (input == null) {
			return null;
		}

		IResource resource = input.getAdapter(IResource.class);
		if (resource != null) {
			return pathForResource(resource);
		}

		if (input instanceof IPathEditorInput) {
			IPath path = ((IPathEditorInput) input).getPath();
			return path == null ? null : path.toOSString();
		}

		if (input instanceof IURIEditorInput) {
			URI uri = ((IURIEditorInput) input).getURI();
			if (uri != null && "file".equals(uri.getScheme())) {
				return Path.of(uri).toString();
			}
		}

		return null;
	}

	private String normalizeCandidatePath(String path) {
		if (path == null || path.isBlank()) {
			return null;
		}

		Path candidate = Path.of(path);
		if (Files.isDirectory(candidate)) {
			return candidate.toString();
		}
		Path parent = candidate.getParent();
		return parent == null ? null : parent.toString();
	}

	private String workspacePath() {
		try {
			IPath workspaceLocation = ResourcesPlugin.getWorkspace().getRoot().getLocation();
			return workspaceLocation == null ? null : workspaceLocation.toOSString();
		} catch (Exception e) {
			return null;
		}
	}

	private String workingDirectory(PanelGroup group) {
		if (group.isRepo()) {
			return group.repoRoot();
		}

		String contextDirectory = GitChordPreferences.effectiveContextDirectory();
		return contextDirectory.isBlank() ? workspacePath() : contextDirectory;
	}

	private synchronized List<GitChordGui> snapshotViews() {
		return new ArrayList<>(viewsByGroupKey.values());
	}

	private IWorkbenchWindow activeWorkbenchWindow() {
		if (!PlatformUI.isWorkbenchRunning()) {
			return null;
		}

		IWorkbenchWindow window = PlatformUI.getWorkbench().getActiveWorkbenchWindow();
		if (window != null) {
			return window;
		}

		IWorkbenchWindow[] windows = PlatformUI.getWorkbench().getWorkbenchWindows();
		return windows.length == 0 ? null : windows[0];
	}

	private void runInBackground(Runnable runnable) {
		executorService.submit(runnable);
	}

	private void runOnUiThread(Runnable runnable) {
		Display display = Display.getDefault();
		if (display == null || display.isDisposed()) {
			return;
		}

		if (display.getThread() == Thread.currentThread()) {
			runnable.run();
		} else {
			display.asyncExec(runnable);
		}
	}

	private void showError(String message) {
		runOnUiThread(() -> {
			IWorkbenchWindow window = activeWorkbenchWindow();
			MessageDialog.openError(window == null ? null : window.getShell(), "Git Chord", message);
		});
	}

	private Map<String, Object> execResultMessage(String id, CommandResultPayload result) {
		return mapOf("type", "execResult", "id", id, "result", result.toPayload());
	}

	private Map<String, Object> mapOf(Object... items) {
		Map<String, Object> result = new LinkedHashMap<>();
		for (int i = 0; i + 1 < items.length; i += 2) {
			result.put(String.valueOf(items[i]), items[i + 1]);
		}
		return result;
	}

	private String normalizePath(String path) {
		return path == null || path.isBlank() ? "/" : path;
	}

	private String asString(Object value) {
		return value instanceof String ? (String) value : null;
	}

	private List<String> asStringList(Object value) {
		if (!(value instanceof List<?>)) {
			return null;
		}

		List<String> result = new ArrayList<>();
		for (Object item : (List<?>) value) {
			if (!(item instanceof String)) {
				return null;
			}
			result.add((String) item);
		}
		return result;
	}

	private String secondaryIdForGroup(PanelGroup group) {
		if (!group.isRepo()) {
			return null;
		}

		return "repo-" + sha256(group.repoRoot()).substring(0, 16);
	}

	private String normalizeSecondaryId(String secondaryId) {
		return secondaryId == null ? GLOBAL_SECONDARY_ID : secondaryId;
	}

	private String sha256(String value) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
			StringBuilder result = new StringBuilder();
			for (byte b : bytes) {
				result.append(String.format("%02x", b));
			}
			return result.toString();
		} catch (NoSuchAlgorithmException e) {
			return Integer.toHexString(value.hashCode());
		}
	}

}
