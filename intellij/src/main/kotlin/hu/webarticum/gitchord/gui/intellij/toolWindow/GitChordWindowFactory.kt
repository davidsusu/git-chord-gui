package hu.webarticum.gitchord.gui.intellij.toolWindow

import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefBrowserBase
import com.intellij.ui.jcef.JBCefClient
import com.intellij.ui.jcef.JBCefJSQuery
import hu.webarticum.gitchord.gui.intellij.GitChordBundle
import hu.webarticum.gitchord.gui.intellij.services.GitChordService
import hu.webarticum.gitchord.gui.intellij.util.WebViewSchemeHandlerFactory
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefMessageRouter
import org.cef.callback.CefQueryCallback
import org.cef.handler.CefMessageRouterHandlerAdapter
import org.jdesktop.swingx.VerticalLayout
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Dimension
import javax.swing.JButton
import javax.swing.JPanel
import javax.swing.border.LineBorder


class GitChordWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val service = toolWindow.project.service<GitChordService>()

        val panel = JBPanel<JBPanel<*>>(VerticalLayout())

        val label = JBLabel(GitChordBundle.message("randomLabel", "?"))
        panel.add(label)

        val label2 = JBLabel("???")
        panel.add(label2)

        val innerPanel = JPanel(BorderLayout())
        innerPanel.preferredSize = Dimension(400, 400)
        innerPanel.border = LineBorder(Color(255, 0, 0), 5)

        val webView = JBCefBrowser()

        panel.add(JButton(GitChordBundle.message("shuffle")).apply {
            addActionListener {
                val number = service.getRandomNumber()
                label.text = GitChordBundle.message("randomLabel", number)
                webView.cefBrowser.executeJavaScript("window.document.getElementById('number').innerText='${number}';", webView.cefBrowser.url, 0)
            }
        })
        CefApp.getInstance().registerSchemeHandlerFactory("http", "myapp", WebViewSchemeHandlerFactory())
        webView.loadURL("http://myapp/index.html")

        val client: JBCefClient = webView.jbCefClient
        val router = CefMessageRouter.create()
        router.addHandler(object : CefMessageRouterHandlerAdapter() {
            override fun onQuery(
                browser: CefBrowser?,
                frame: org.cef.browser.CefFrame?,
                queryId: Long,
                request: String,
                persistent: Boolean,
                callback: CefQueryCallback
            ): Boolean {
                label2.text = "Processing in Java: $request"
                callback.success("Java processed: $request")
                return true
            }
        }, true)
        client.cefClient.addMessageRouter(router)

        Disposer.register(project, webView)
        innerPanel.add(webView.component, BorderLayout.CENTER)
        panel.add(innerPanel)

        val content = ContentFactory.getInstance().createContent(panel, null, false)
        toolWindow.contentManager.addContent(content)
    }

}
