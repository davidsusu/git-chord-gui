package hu.webarticum.gitchordgui.eclipse.model;

import java.util.LinkedHashMap;
import java.util.Map;

public final class PageIntent {

	public static final PageIntent CREATE_SNAPSHOT = new PageIntent("createSnapshot");

	private final String type;

	public PageIntent(String type) {
		this.type = type;
	}

	public String type() {
		return type;
	}

	public Map<String, Object> toPayload() {
		Map<String, Object> result = new LinkedHashMap<>();
		result.put("type", type);
		return result;
	}

	public static PageIntent fromPayload(Object payload) {
		if (!(payload instanceof Map<?, ?>)) {
			return null;
		}

		Object type = ((Map<?, ?>) payload).get("type");
		return type instanceof String ? new PageIntent((String) type) : null;
	}

}
