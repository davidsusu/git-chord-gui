package hu.webarticum.gitchordgui.eclipse.model;

import java.util.Map;

public final class PageOpenRequest {

	private final String type;

	private final String path;

	private final String repoRoot;

	private final PageIntent intent;

	public PageOpenRequest(String type, String path, String repoRoot, PageIntent intent) {
		this.type = type;
		this.path = path;
		this.repoRoot = repoRoot;
		this.intent = intent;
	}

	public String type() {
		return type;
	}

	public String path() {
		return path;
	}

	public String repoRoot() {
		return repoRoot;
	}

	public PageIntent intent() {
		return intent;
	}

	public static PageOpenRequest fromPayload(Object payload) {
		if (!(payload instanceof Map<?, ?>)) {
			return null;
		}

		Map<?, ?> map = (Map<?, ?>) payload;
		return new PageOpenRequest(
			asString(map.get("type")),
			asString(map.get("path")),
			asString(map.get("repoRoot")),
			PageIntent.fromPayload(map.get("intent"))
		);
	}

	private static String asString(Object value) {
		return value instanceof String ? (String) value : null;
	}

}
