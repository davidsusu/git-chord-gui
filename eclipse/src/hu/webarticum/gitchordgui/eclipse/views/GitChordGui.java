package hu.webarticum.gitchordgui.eclipse.views;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.eclipse.swt.SWT;
import org.eclipse.swt.browser.Browser;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.ui.part.ViewPart;

public class GitChordGui extends ViewPart {

	public static final String ID = "hu.webarticum.gitchordgui.eclipse.views.GitChordGui";

	private static final String JS_FILE = "index.js";
	private static final String HTML_FILE = "index.html";
	private static final String JS_PLACEHOLDER = "{JS_CONTENT}";
	
	private Browser browser;

	@Override
	public void createPartControl(Composite parent) {
		browser = new Browser(parent, SWT.WEBKIT);
		browser.setText(getContent());
	}

	@Override
	public void setFocus() {
		browser.setFocus();
	}

	public String getContent() {
		String javascriptContent = getResourceContent(JS_FILE);
		String htmlTemplate = getResourceContent(HTML_FILE);
		return htmlTemplate.replace(JS_PLACEHOLDER, javascriptContent);
	}

	private String getResourceContent(String filename) {
		try (InputStream inputStream = getClass().getResourceAsStream(filename)) {
			return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException e) {
			return "";
		}
	}

	@Override
	public void dispose() {
		super.dispose();
	}
}
