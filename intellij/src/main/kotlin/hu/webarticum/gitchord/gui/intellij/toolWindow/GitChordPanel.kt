package hu.webarticum.gitchord.gui.intellij.toolWindow

import com.google.gson.Gson
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.util.Disposer
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPanel
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.jcef.JBCefBrowser
import hu.webarticum.gitchord.gui.intellij.model.PageIntent
import hu.webarticum.gitchord.gui.intellij.model.PanelGroup
import hu.webarticum.gitchord.gui.intellij.services.GitChordService
import hu.webarticum.gitchord.gui.intellij.util.WebViewSchemeHandlerFactory
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.browser.CefMessageRouter
import org.cef.callback.CefQueryCallback
import org.cef.handler.CefMessageRouterHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JComponent

class GitChordPanel(
    private val service: GitChordService,
    val group: PanelGroup,
    initialPath: String,
    initialIntent: PageIntent?,
) : Disposable {

    val component: JComponent

    private val gson = Gson()

    private val browser: JBCefBrowser?

    private var path = initialPath

    private var intent = initialIntent

    private var disposed = false

    init {
        val createdBrowser = if (JBCefApp.isSupported()) {
            createBrowser()
        } else {
            null
        }

        if (createdBrowser == null) {
            browser = null
            component = fallbackComponent("Git Chord needs the IntelliJ JCEF browser, but JCEF is not available.")
        } else {
            browser = createdBrowser
            component = createdBrowser.component
        }
    }

    private fun createBrowser(): JBCefBrowser? {
        return try {
            WebViewSchemeHandlerFactory.registerOnce()
            val createdBrowser = JBCefBrowser()
            val router = CefMessageRouter.create()
            router.addHandler(object : CefMessageRouterHandlerAdapter() {
                override fun onQuery(
                    browser: CefBrowser?,
                    frame: CefFrame?,
                    queryId: Long,
                    request: String,
                    persistent: Boolean,
                    callback: CefQueryCallback,
                ): Boolean {
                    return try {
                        service.handlePanelMessage(this@GitChordPanel, request)
                        callback.success("accepted")
                        true
                    } catch (e: Exception) {
                        callback.failure(1, e.message ?: e::class.java.simpleName)
                        true
                    }
                }
            }, true)
            createdBrowser.jbCefClient.cefClient.addMessageRouter(router)
            Disposer.register(this, createdBrowser)
            createdBrowser.loadURL(WebViewSchemeHandlerFactory.INDEX_URL)
            createdBrowser
        } catch (e: ThreadDeath) {
            throw e
        } catch (e: VirtualMachineError) {
            throw e
        } catch (e: Throwable) {
            LOG.warn("Could not initialize Git Chord JCEF panel.", e)
            null
        }
    }

    private fun fallbackComponent(message: String): JComponent {
        return JBPanel<JBPanel<*>>(BorderLayout()).apply {
            add(JBLabel(message), BorderLayout.CENTER)
        }
    }

    fun sendInitialState(currentRepoRoot: String?, language: String) {
        postMessage(mapOf(
            "type" to "initialState",
            "group" to group.toPayload(),
            "path" to path,
            "intent" to intent,
            "currentRepoRoot" to currentRepoRoot,
            "language" to language,
        ))
    }

    fun navigate(path: String, intent: PageIntent?) {
        this.path = path
        this.intent = intent
        postMessage(mapOf("type" to "navigate", "path" to path, "intent" to intent))
    }

    fun postMessage(message: Any) {
        if (disposed) {
            return
        }

        val browser = browser ?: return
        val json = gson.toJson(message)
        ApplicationManager.getApplication().invokeLater {
            if (!disposed) {
                browser.cefBrowser.executeJavaScript(
                    "window.__GIT_CHORD_INTELLIJ_RECEIVE__ && window.__GIT_CHORD_INTELLIJ_RECEIVE__($json);",
                    browser.cefBrowser.url,
                    0,
                )
            }
        }
    }

    override fun dispose() {
        disposed = true
    }

    companion object {
        private val LOG = Logger.getInstance(GitChordPanel::class.java)
    }
}
