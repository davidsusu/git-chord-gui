package hu.webarticum.gitchordgui.eclipse.model;

public final class PanelState {

	private final PanelGroup group;

	private final String path;

	private final PageIntent intent;

	public PanelState(PanelGroup group, String path, PageIntent intent) {
		this.group = group;
		this.path = path;
		this.intent = intent;
	}

	public PanelGroup group() {
		return group;
	}

	public String path() {
		return path;
	}

	public PageIntent intent() {
		return intent;
	}

	public PanelState withPath(String path, PageIntent intent) {
		return new PanelState(group, path, intent);
	}

}
