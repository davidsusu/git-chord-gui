package hu.webarticum.gitchordgui.eclipse.model;

import java.io.File;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public final class PanelGroup {

	public static final String TYPE_GLOBAL = "global";
	public static final String TYPE_REPO = "repo";

	private final String type;

	private final String repoRoot;

	private PanelGroup(String type, String repoRoot) {
		this.type = type;
		this.repoRoot = repoRoot;
	}

	public static PanelGroup global() {
		return new PanelGroup(TYPE_GLOBAL, null);
	}

	public static PanelGroup repo(String repoRoot) {
		return new PanelGroup(TYPE_REPO, repoRoot);
	}

	public String type() {
		return type;
	}

	public String repoRoot() {
		return repoRoot;
	}

	public String key() {
		if (isRepo()) {
			return TYPE_REPO + ":" + repoRoot;
		}

		return TYPE_GLOBAL;
	}

	public String displayName() {
		if (!isRepo()) {
			return "Git Chord";
		}

		String name = new File(repoRoot).getName();
		return name.isBlank() ? repoRoot : "Git Chord: " + name;
	}

	public boolean isRepo() {
		return TYPE_REPO.equals(type) && repoRoot != null && !repoRoot.isBlank();
	}

	public Map<String, Object> toPayload() {
		Map<String, Object> result = new LinkedHashMap<>();
		if (isRepo()) {
			result.put("type", TYPE_REPO);
			result.put("repoRoot", repoRoot);
		} else {
			result.put("type", TYPE_GLOBAL);
		}
		return result;
	}

	@Override
	public boolean equals(Object other) {
		if (!(other instanceof PanelGroup)) {
			return false;
		}

		PanelGroup otherGroup = (PanelGroup) other;
		return Objects.equals(type, otherGroup.type) && Objects.equals(repoRoot, otherGroup.repoRoot);
	}

	@Override
	public int hashCode() {
		return Objects.hash(type, repoRoot);
	}

}
