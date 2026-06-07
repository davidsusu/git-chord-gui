package hu.webarticum.gitchordgui.eclipse.util;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

public final class JsonUtil {

	private JsonUtil() {
		// Utility class.
	}

	public static Object parse(String source) {
		return new Parser(source).parse();
	}

	@SuppressWarnings("unchecked")
	public static Map<String, Object> parseObject(String source) {
		Object value = parse(source);
		return value instanceof Map<?, ?> ? (Map<String, Object>) value : new LinkedHashMap<>();
	}

	public static String stringify(Object value) {
		if (value == null) {
			return "null";
		}

		if (value instanceof String) {
			return quote((String) value);
		}

		if (value instanceof Number || value instanceof Boolean) {
			return String.valueOf(value);
		}

		if (value instanceof Map<?, ?>) {
			StringBuilder result = new StringBuilder("{");
			boolean first = true;
			for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
				if (!first) {
					result.append(',');
				}
				first = false;
				result.append(quote(String.valueOf(entry.getKey())));
				result.append(':');
				result.append(stringify(entry.getValue()));
			}
			return result.append('}').toString();
		}

		if (value instanceof Collection<?>) {
			StringBuilder result = new StringBuilder("[");
			boolean first = true;
			for (Object item : (Collection<?>) value) {
				if (!first) {
					result.append(',');
				}
				first = false;
				result.append(stringify(item));
			}
			return result.append(']').toString();
		}

		return quote(String.valueOf(value));
	}

	private static String quote(String value) {
		StringBuilder result = new StringBuilder("\"");
		for (int i = 0; i < value.length(); i++) {
			char c = value.charAt(i);
			switch (c) {
				case '"':
					result.append("\\\"");
					break;
				case '\\':
					result.append("\\\\");
					break;
				case '\b':
					result.append("\\b");
					break;
				case '\f':
					result.append("\\f");
					break;
				case '\n':
					result.append("\\n");
					break;
				case '\r':
					result.append("\\r");
					break;
				case '\t':
					result.append("\\t");
					break;
				default:
					if (c < 0x20) {
						result.append(String.format("\\u%04x", (int) c));
					} else {
						result.append(c);
					}
					break;
			}
		}
		return result.append('"').toString();
	}

	private static final class Parser {

		private final String source;

		private int index = 0;

		private Parser(String source) {
			this.source = source == null ? "" : source;
		}

		private Object parse() {
			Object value = parseValue();
			skipWhitespace();
			return value;
		}

		private Object parseValue() {
			skipWhitespace();
			if (index >= source.length()) {
				return null;
			}

			char c = source.charAt(index);
			if (c == '"') {
				return parseString();
			}
			if (c == '{') {
				return parseObjectValue();
			}
			if (c == '[') {
				return parseArray();
			}
			if (source.startsWith("true", index)) {
				index += 4;
				return Boolean.TRUE;
			}
			if (source.startsWith("false", index)) {
				index += 5;
				return Boolean.FALSE;
			}
			if (source.startsWith("null", index)) {
				index += 4;
				return null;
			}

			return parseNumber();
		}

		private Map<String, Object> parseObjectValue() {
			Map<String, Object> result = new LinkedHashMap<>();
			index++;
			skipWhitespace();
			if (consume('}')) {
				return result;
			}

			while (index < source.length()) {
				String key = parseString();
				skipWhitespace();
				consume(':');
				result.put(key, parseValue());
				skipWhitespace();
				if (consume('}')) {
					break;
				}
				consume(',');
			}
			return result;
		}

		private ArrayList<Object> parseArray() {
			ArrayList<Object> result = new ArrayList<>();
			index++;
			skipWhitespace();
			if (consume(']')) {
				return result;
			}

			while (index < source.length()) {
				result.add(parseValue());
				skipWhitespace();
				if (consume(']')) {
					break;
				}
				consume(',');
			}
			return result;
		}

		private String parseString() {
			StringBuilder result = new StringBuilder();
			consume('"');
			while (index < source.length()) {
				char c = source.charAt(index++);
				if (c == '"') {
					break;
				}
				if (c != '\\' || index >= source.length()) {
					result.append(c);
					continue;
				}

				char escaped = source.charAt(index++);
				switch (escaped) {
					case '"':
					case '\\':
					case '/':
						result.append(escaped);
						break;
					case 'b':
						result.append('\b');
						break;
					case 'f':
						result.append('\f');
						break;
					case 'n':
						result.append('\n');
						break;
					case 'r':
						result.append('\r');
						break;
					case 't':
						result.append('\t');
						break;
					case 'u':
						result.append(parseUnicodeEscape());
						break;
					default:
						result.append(escaped);
						break;
				}
			}
			return result.toString();
		}

		private char parseUnicodeEscape() {
			if (index + 4 > source.length()) {
				return '?';
			}

			String hex = source.substring(index, index + 4);
			index += 4;
			try {
				return (char) Integer.parseInt(hex, 16);
			} catch (NumberFormatException e) {
				return '?';
			}
		}

		private Number parseNumber() {
			int start = index;
			while (index < source.length()) {
				char c = source.charAt(index);
				if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') {
					index++;
				} else {
					break;
				}
			}

			String number = source.substring(start, index);
			try {
				if (number.contains(".") || number.contains("e") || number.contains("E")) {
					return Double.valueOf(number);
				}
				return Long.valueOf(number);
			} catch (NumberFormatException e) {
				return 0;
			}
		}

		private boolean consume(char expected) {
			skipWhitespace();
			if (index < source.length() && source.charAt(index) == expected) {
				index++;
				return true;
			}
			return false;
		}

		private void skipWhitespace() {
			while (index < source.length() && Character.isWhitespace(source.charAt(index))) {
				index++;
			}
		}

	}

}
