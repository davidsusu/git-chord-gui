package hu.webarticum.gitchord.gui.intellij.util

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
import java.io.IOException
import java.io.InputStream
import java.net.URLConnection

class WebViewSchemeHandlerFactory : CefSchemeHandlerFactory {
    override fun create(
        cefBrowser: CefBrowser?,
        cefFrame: CefFrame?,
        schemeName: String?,
        request: CefRequest?
    ): CefResourceHandler {
        return WebViewResourceHandler()
    }
}

private class WebViewResourceHandler : CefResourceHandler {
    private var connectionState: ConnectionState = ClosedConnectionState

    override fun processRequest(cefRequest: CefRequest, cefCallback: CefCallback): Boolean {
        val url = cefRequest.url ?: return false
        val pathToResource = url.replace("http://myapp", "webview/")
        val newUrl = this::class.java.classLoader.getResource(pathToResource) ?: return false
        connectionState = OpenedConnectionState(newUrl.openConnection())
        cefCallback.Continue()
        return true
    }

    override fun getResponseHeaders(cefResponse: CefResponse, responseLength: IntRef, redirectUrl: StringRef) {
        connectionState.getResponseHeaders(cefResponse, responseLength, redirectUrl)
    }

    override fun readResponse(dataOut: ByteArray, designedBytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
        return connectionState.readResponse(dataOut, designedBytesToRead, bytesRead, callback)
    }

    override fun cancel() {
        connectionState.close()
        connectionState = ClosedConnectionState
    }
}

private sealed interface ConnectionState {
    fun getResponseHeaders(cefResponse: CefResponse, responseLength: IntRef, redirectUrl: StringRef)
    fun readResponse(dataOut: ByteArray, designedBytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean
    fun close()
}

private class OpenedConnectionState(private val connection: URLConnection) : ConnectionState {
    private val inputStream: InputStream by lazy { connection.getInputStream() }

    override fun getResponseHeaders(cefResponse: CefResponse, responseLength: IntRef, redirectUrl: StringRef) {
        try {
            val mimeType = when {
                connection.url.toString().contains("css") -> "text/css"
                connection.url.toString().contains("js") -> "text/javascript"
                connection.url.toString().contains("html") -> "text/html"
                else -> connection.contentType
            }
            cefResponse.mimeType = mimeType
            responseLength.set(inputStream.available())
            cefResponse.status = 200
        } catch (e: IOException) {
            cefResponse.error = CefLoadHandler.ErrorCode.ERR_FILE_NOT_FOUND
            cefResponse.statusText = e.localizedMessage
            cefResponse.status = 404
        }
    }

    override fun readResponse(dataOut: ByteArray, designedBytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
        val availableSize = inputStream.available()
        return if (availableSize > 0) {
            val maxBytesToRead = minOf(availableSize, designedBytesToRead)
            val realNumberOfReadBytes = inputStream.read(dataOut, 0, maxBytesToRead)
            bytesRead.set(realNumberOfReadBytes)
            true
        } else {
            inputStream.close()
            false
        }
    }

    override fun close() {
        inputStream.close()
    }
}

private data object ClosedConnectionState : ConnectionState {
    override fun getResponseHeaders(cefResponse: CefResponse, responseLength: IntRef, redirectUrl: StringRef) {
        cefResponse.status = 404
    }

    override fun readResponse(dataOut: ByteArray, designedBytesToRead: Int, bytesRead: IntRef, callback: CefCallback): Boolean {
        return false
    }

    override fun close() {
    }
}
