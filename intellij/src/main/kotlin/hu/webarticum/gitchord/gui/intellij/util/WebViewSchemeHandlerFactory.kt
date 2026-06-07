package hu.webarticum.gitchord.gui.intellij.util

import com.intellij.ui.jcef.JBCefApp
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.callback.CefSchemeHandlerFactory
import org.cef.handler.CefLoadHandler
import org.cef.handler.CefResourceHandler
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean

class WebViewSchemeHandlerFactory : CefSchemeHandlerFactory {

    override fun create(
        cefBrowser: CefBrowser?,
        cefFrame: CefFrame?,
        schemeName: String?,
        request: CefRequest?,
    ): CefResourceHandler {
        return WebViewResourceHandler()
    }

    companion object {
        private const val SCHEME = "http"
        private const val DOMAIN = "git-chord.intellij"
        private const val RESOURCE_ROOT = "webview"
        const val INDEX_URL = "$SCHEME://$DOMAIN/index.html"

        private val registered = AtomicBoolean(false)

        fun registerOnce() {
            if (registered.compareAndSet(false, true)) {
                try {
                    JBCefApp.getInstance()
                    CefApp.getInstance().registerSchemeHandlerFactory(SCHEME, DOMAIN, WebViewSchemeHandlerFactory())
                } catch (e: Throwable) {
                    registered.set(false)
                    throw e
                }
            }
        }

        fun resourceNameForUrl(url: String): String {
            val path = URI.create(url).path.trimStart('/').ifBlank { "index.html" }
            return "$RESOURCE_ROOT/$path"
        }

        fun mimeTypeForResource(resourceName: String): String {
            return when {
                resourceName.endsWith(".html") -> "text/html"
                resourceName.endsWith(".js") -> "text/javascript"
                resourceName.endsWith(".css") -> "text/css"
                resourceName.endsWith(".map") -> "application/json"
                resourceName.endsWith(".svg") -> "image/svg+xml"
                else -> "application/octet-stream"
            }
        }
    }
}

private class WebViewResourceHandler : CefResourceHandler {

    private var response: ResourceResponse? = null

    private var offset = 0

    override fun processRequest(cefRequest: CefRequest, cefCallback: CefCallback): Boolean {
        val url = cefRequest.url ?: return false
        val resourceName = try {
            WebViewSchemeHandlerFactory.resourceNameForUrl(url)
        } catch (e: IllegalArgumentException) {
            return false
        }

        val bytes = javaClass.classLoader.getResourceAsStream(resourceName)?.use { it.readBytes() }
            ?: return false

        response = ResourceResponse(
            bytes,
            WebViewSchemeHandlerFactory.mimeTypeForResource(resourceName),
        )
        offset = 0
        cefCallback.Continue()
        return true
    }

    override fun getResponseHeaders(cefResponse: CefResponse, responseLength: IntRef, redirectUrl: StringRef) {
        val response = response
        if (response == null) {
            cefResponse.error = CefLoadHandler.ErrorCode.ERR_FILE_NOT_FOUND
            cefResponse.status = 404
            responseLength.set(0)
            return
        }

        cefResponse.status = 200
        cefResponse.mimeType = response.mimeType
        responseLength.set(response.bytes.size)
    }

    override fun readResponse(dataOut: ByteArray, designedBytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
        val response = response ?: return false
        if (offset >= response.bytes.size) {
            bytesRead.set(0)
            return false
        }

        val bytesToRead = minOf(designedBytesToRead, response.bytes.size - offset)
        response.bytes.copyInto(dataOut, 0, offset, offset + bytesToRead)
        offset += bytesToRead
        bytesRead.set(bytesToRead)
        return true
    }

    override fun cancel() {
        response = null
        offset = 0
    }

    private data class ResourceResponse(
        val bytes: ByteArray,
        val mimeType: String,
    )
}
