package hu.webarticum.gitchordgui.eclipse.model;

import java.util.LinkedHashMap;
import java.util.Map;

public final class CommandResultPayload {

	private final int status;

	private final String stdout;

	private final String stderr;

	public CommandResultPayload(int status, String stdout, String stderr) {
		this.status = status;
		this.stdout = stdout == null ? "" : stdout;
		this.stderr = stderr == null ? "" : stderr;
	}

	public int status() {
		return status;
	}

	public String stdout() {
		return stdout;
	}

	public String stderr() {
		return stderr;
	}

	public Map<String, Object> toPayload() {
		Map<String, Object> result = new LinkedHashMap<>();
		result.put("status", status);
		result.put("stdout", stdout);
		result.put("stderr", stderr);
		return result;
	}

}
