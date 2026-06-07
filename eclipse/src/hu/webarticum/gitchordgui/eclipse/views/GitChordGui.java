package hu.webarticum.gitchordgui.eclipse.views;

import hu.webarticum.gitchordgui.eclipse.model.PageIntent;
import hu.webarticum.gitchordgui.eclipse.model.PanelGroup;
import hu.webarticum.gitchordgui.eclipse.model.PanelState;
import hu.webarticum.gitchordgui.eclipse.services.GitChordService;
import hu.webarticum.gitchordgui.eclipse.util.JsonUtil;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.eclipse.swt.SWT;
import org.eclipse.swt.SWTError;
import org.eclipse.swt.browser.Browser;
import org.eclipse.swt.browser.BrowserFunction;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Label;
import org.eclipse.ui.IViewSite;
import org.eclipse.ui.PartInitException;
import org.eclipse.ui.part.ViewPart;

public class GitChordGui extends ViewPart {

	public static final String ID = "hu.webarticum.gitchordgui.eclipse.views.GitChordGui";

	private static final String JS_FILE = "index.js";
	private static final String HTML_FILE = "index.html";
	private static final String JS_PLACEHOLDER = "{JS_CONTENT}";

	private final GitChordService service = GitChordService.getInstance();

	private Browser browser;

	private BrowserFunction browserFunction;

	private PanelState state = new PanelState(PanelGroup.global(), "/about", null);

	private String secondaryId;

	@Override
	public void init(IViewSite site) throws PartInitException {
		super.init(site);
		secondaryId = site.getSecondaryId();
		state = service.attachView(this, secondaryId);
		setPartName(state.group().displayName());
	}

	@Override
	public void createPartControl(Composite parent) {
		try {
			browser = new Browser(parent, SWT.NONE);
			browserFunction = new BrowserFunction(browser, "gitChordEclipsePost") {
				@Override
				public Object function(Object[] arguments) {
					if (arguments.length > 0 && arguments[0] instanceof String) {
						service.handleViewMessage(GitChordGui.this, (String) arguments[0]);
					}
					return "accepted";
				}
			};
			browser.setText(getContent());
		} catch (SWTError | RuntimeException e) {
			Label label = new Label(parent, SWT.WRAP);
			label.setText("Git Chord needs the Eclipse SWT Browser, but the browser could not be initialized.");
		}
	}

	@Override
	public void setFocus() {
		if (browser != null && !browser.isDisposed()) {
			browser.setFocus();
		}
	}

	public PanelGroup group() {
		return state.group();
	}

	public void applyState(PanelState nextState) {
		state = nextState;
		setPartName(state.group().displayName());
		navigate(state.path(), state.intent());
	}

	public void navigate(String path, PageIntent intent) {
		state = state.withPath(path, intent);
		postMessage(mapOf("type", "navigate", "path", path, "intent", payloadForIntent(intent)));
	}

	public void sendInitialState(String currentRepoRoot, String language) {
		postMessage(mapOf(
			"type", "initialState",
			"group", state.group().toPayload(),
			"path", state.path(),
			"intent", payloadForIntent(state.intent()),
			"currentRepoRoot", currentRepoRoot,
			"language", language
		));
	}

	public void postMessage(Map<String, Object> message) {
		if (browser == null || browser.isDisposed()) {
			return;
		}

		String json = JsonUtil.stringify(message);
		browser.getDisplay().asyncExec(() -> {
			if (browser == null || browser.isDisposed()) {
				return;
			}
			browser.execute("window.__GIT_CHORD_ECLIPSE_RECEIVE__ && window.__GIT_CHORD_ECLIPSE_RECEIVE__(" + json + ");");
		});
	}

	public String getContent() {
		String javascriptContent = getResourceContent(JS_FILE);
		String htmlTemplate = getResourceContent(HTML_FILE);
		return htmlTemplate.replace(JS_PLACEHOLDER, javascriptContent);
	}

	private String getResourceContent(String filename) {
		try (InputStream inputStream = getClass().getResourceAsStream(filename)) {
			if (inputStream == null) {
				return "";
			}
			return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException e) {
			return "";
		}
	}

	private Map<String, Object> mapOf(Object... items) {
		Map<String, Object> result = new LinkedHashMap<>();
		for (int i = 0; i + 1 < items.length; i += 2) {
			result.put(String.valueOf(items[i]), items[i + 1]);
		}
		return result;
	}

	private Object payloadForIntent(PageIntent intent) {
		return intent == null ? null : intent.toPayload();
	}

	@Override
	public void dispose() {
		service.detachView(this);
		if (browserFunction != null) {
			browserFunction.dispose();
		}
		super.dispose();
	}

}
