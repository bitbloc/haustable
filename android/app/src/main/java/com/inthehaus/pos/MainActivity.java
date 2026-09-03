package com.inthehaus.pos;

import android.app.Presentation;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.view.Display;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;

public class MainActivity extends BridgeActivity {
    
    private SecondaryDisplayPresentation presentation;
    private DisplayManager.DisplayListener displayListener;
    private ServerSocket wmaServerSocket;
    private Thread wmaServerThread;

    private static MainActivity instance;

    public static MainActivity getInstance() {
        return instance;
    }

    private synchronized void initSecondaryDisplay() {
        try {
            DisplayManager displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
            if (displayManager != null) {
                Display[] displays = displayManager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
                if (displays != null && displays.length > 0) {
                    if (presentation != null && presentation.isShowing()) {
                        return;
                    }
                    if (presentation != null) {
                        try {
                            presentation.dismiss();
                        } catch (Exception ignored) {}
                        presentation = null;
                    }
                    presentation = new SecondaryDisplayPresentation(MainActivity.this, displays[0]);
                    presentation.show();
                    Log.i("MainActivity", "📺 Sunmi D2s Plus Dual-Screen CFD initialized successfully.");
                }
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Secondary display initialization error", e);
        }
    }

    public class AndroidCfdBridge {
        @JavascriptInterface
        public void sendCfdEvent(String jsonPayload) {
            dispatchCfdEventToSecondary(jsonPayload);
        }

        @JavascriptInterface
        public boolean isNotificationServiceEnabled() {
            try {
                String pkgName = getPackageName();
                final String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
                if (flat != null && !flat.isEmpty()) {
                    final String[] names = flat.split(":");
                    for (String name : names) {
                        final ComponentName cn = ComponentName.unflattenFromString(name);
                        if (cn != null && cn.getPackageName().equals(pkgName)) {
                            return true;
                        }
                    }
                }
            } catch (Exception ignored) {}
            return false;
        }

        @JavascriptInterface
        public void openNotificationListenerSettings() {
            try {
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception e) {
                Log.e("MainActivity", "Cannot open notification settings", e);
            }
        }

        @JavascriptInterface
        public boolean isSecondaryDisplayConnected() {
            return presentation != null && presentation.isShowing();
        }
    }

    // Alias for compatibility
    public class AndroidPosBridge extends AndroidCfdBridge {}

    public static void dispatchCfdEventToSecondary(final String jsonPayload) {
        if (instance != null && instance.presentation != null) {
            final SecondaryDisplayPresentation pres = instance.presentation;
            pres.setLastEventJson(jsonPayload);
            instance.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        pres.evaluateCfdEvent(jsonPayload);
                    } catch (Exception e) {
                        Log.e("MainActivity", "Failed to dispatch CFD event to secondary display", e);
                    }
                }
            });
        }
    }

    public static void dispatchWmaNotification(final String title, final String text, final String pkg) {
        if (instance != null) {
            instance.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView webView = instance.getBridge() != null ? instance.getBridge().getWebView() : null;
                        if (webView != null) {
                            String encodedTitle = Base64.encodeToString(title != null ? title.getBytes("UTF-8") : new byte[0], Base64.NO_WRAP);
                            String encodedText = Base64.encodeToString(text != null ? text.getBytes("UTF-8") : new byte[0], Base64.NO_WRAP);
                            String encodedPkg = Base64.encodeToString(pkg != null ? pkg.getBytes("UTF-8") : new byte[0], Base64.NO_WRAP);

                            String js = String.format("try { var _data = { title: decodeURIComponent(escape(atob('%s'))), text: decodeURIComponent(escape(atob('%s'))), pkg: decodeURIComponent(escape(atob('%s'))) }; if (window.onWmaNotificationOrder) { window.onWmaNotificationOrder(_data); } window.dispatchEvent(new CustomEvent('wma_notification_order', { detail: _data })); window.dispatchEvent(new CustomEvent('wmaNotification', { detail: _data })); } catch (e) { console.error(e); }", encodedTitle, encodedText, encodedPkg);
                            webView.evaluateJavascript(js, null);
                        }
                    } catch (Exception e) {
                        Log.e("MainActivity", "Failed to dispatch WMA notification to WebView", e);
                    }
                }
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        
        try {
            setVolumeControlStream(AudioManager.STREAM_MUSIC);
            getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            hideSystemBars();
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setEnableSmoothTransition(true);
                
                // Expose Native CFD and POS bridge to WebView JavaScript
                AndroidCfdBridge bridge = new AndroidCfdBridge();
                webView.addJavascriptInterface(bridge, "AndroidCfdBridge");
                webView.addJavascriptInterface(bridge, "AndroidPosBridge");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Auto display Customer Facing Display (CFD) on secondary screen (Sunmi D2s Plus Dual-Screen Hardware)
        initSecondaryDisplay();
        try {
            DisplayManager displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
            if (displayManager != null) {
                displayListener = new DisplayManager.DisplayListener() {
                    @Override
                    public void onDisplayAdded(int displayId) {
                        Log.i("MainActivity", "Secondary display connected (id: " + displayId + "), initializing presentation...");
                        initSecondaryDisplay();
                    }

                    @Override
                    public void onDisplayRemoved(int displayId) {
                        Log.i("MainActivity", "Secondary display disconnected (id: " + displayId + ")");
                        if (presentation != null) {
                            try {
                                presentation.dismiss();
                            } catch (Exception ignored) {}
                            presentation = null;
                        }
                    }

                    @Override
                    public void onDisplayChanged(int displayId) {
                        if (presentation == null || !presentation.isShowing()) {
                            initSecondaryDisplay();
                        }
                    }
                };
                displayManager.registerDisplayListener(displayListener, null);
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error registering display listener", e);
        }

        // Start native WMA ESC/POS Virtual Printer Bridge Server on Port 9100
        startWmaBridgeServer();
    }

    @Override
    public void onResume() {
        super.onResume();
        initSecondaryDisplay();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        try {
            View decorView = getWindow().getDecorView();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
            } else {
                decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                );
            }
        } catch (Exception e) {
            Log.w("MainActivity", "hideSystemBars error: " + e.getMessage());
        }
    }

    private void startWmaBridgeServer() {
        wmaServerThread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    wmaServerSocket = new ServerSocket();
                    wmaServerSocket.setReuseAddress(true);
                    wmaServerSocket.bind(new java.net.InetSocketAddress(9100));
                    Log.i("WmaBridge", "🚀 WMA Virtual Printer Bridge listening on Port 9100");
                    
                    while (!Thread.currentThread().isInterrupted() && wmaServerSocket != null && !wmaServerSocket.isClosed()) {
                        try {
                            final Socket clientSocket = wmaServerSocket.accept();
                            new Thread(new Runnable() {
                                @Override
                                public void run() {
                                    handleWmaClientSocket(clientSocket);
                                }
                            }).start();
                        } catch (Exception e) {
                            if (wmaServerSocket != null && !wmaServerSocket.isClosed()) {
                                Log.w("WmaBridge", "Socket accept warning: " + e.getMessage());
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e("WmaBridge", "Could not open ServerSocket on Port 9100: " + e.getMessage());
                }
            }
        });
        wmaServerThread.start();
    }

    private void handleWmaClientSocket(Socket socket) {
        try {
            // Initial timeout: wait up to 5000ms for the client to start sending print data
            socket.setSoTimeout(5000);
            InputStream in = socket.getInputStream();
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] temp = new byte[1024];
            int read;
            
            try {
                read = in.read(temp);
                if (read != -1) {
                    buffer.write(temp, 0, read);
                    // Once print stream starts, set 1200ms inter-packet timeout to capture all chunks
                    socket.setSoTimeout(1200);
                    while ((read = in.read(temp)) != -1) {
                        buffer.write(temp, 0, read);
                    }
                }
            } catch (SocketTimeoutException ste) {
                // Stream packet completed
            }

            final byte[] rawBytes = buffer.toByteArray();
            Log.i("WmaBridge", "📥 Received WMA print stream payload: " + rawBytes.length + " bytes");
            
            if (rawBytes.length > 0) {
                final String base64Data = Base64.encodeToString(rawBytes, Base64.NO_WRAP);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                            if (webView != null) {
                                String js = "if (window.onWmaRawPrintStream) { window.onWmaRawPrintStream('" + base64Data + "'); } else { window.dispatchEvent(new CustomEvent('wma_raw_print_stream', { detail: '" + base64Data + "' })); }";
                                webView.evaluateJavascript(js, null);
                            }
                        } catch (Exception e) {
                            Log.e("WmaBridge", "Error dispatching raw print stream to WebView: " + e.getMessage());
                        }
                    }
                });
            }
            try {
                socket.close();
            } catch (Exception ignored) {}
        } catch (Exception e) {
            Log.w("WmaBridge", "Client handling error: " + e.getMessage());
        }
    }

    @Override
    public void onBackPressed() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                String currentUrl = webView.getUrl();
                if (currentUrl != null && currentUrl.contains("/pos")) {
                    webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('pos_hardware_back_pressed'));", null);
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
            }
        } catch (Exception ignored) {}
        super.onBackPressed();
    }

    @Override
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        try {
            if (displayListener != null) {
                DisplayManager displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
                if (displayManager != null) {
                    displayManager.unregisterDisplayListener(displayListener);
                }
                displayListener = null;
            }
            if (presentation != null) {
                presentation.dismiss();
                presentation = null;
            }
            if (wmaServerSocket != null) {
                wmaServerSocket.close();
                wmaServerSocket = null;
            }
            if (wmaServerThread != null) {
                wmaServerThread.interrupt();
                wmaServerThread = null;
            }
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    private static class SecondaryDisplayPresentation extends Presentation {
        private WebView webView;
        private String lastEventJson;
        private boolean isPageLoaded = false;

        public SecondaryDisplayPresentation(Context outerContext, Display display) {
            super(outerContext, display);
        }

        public WebView getWebView() {
            return webView;
        }

        public void setLastEventJson(String json) {
            this.lastEventJson = json;
        }

        public void evaluateCfdEvent(final String jsonPayload) {
            if (webView == null || !isPageLoaded || jsonPayload == null) {
                return;
            }
            try {
                String base64Data = Base64.encodeToString(jsonPayload.getBytes("UTF-8"), Base64.NO_WRAP);
                String js = String.format("try { var _raw = atob('%s'); var _data = JSON.parse(decodeURIComponent(escape(_raw))); if (window.onCfdNativeEvent) { window.onCfdNativeEvent(_data); } else { window.dispatchEvent(new CustomEvent('pos_cfd_native_event', { detail: _data })); } } catch (e) { console.error('CFD Dispatch error', e); }", base64Data);
                webView.evaluateJavascript(js, null);
            } catch (Exception e) {
                Log.e("SecondaryDisplay", "evaluateCfdEvent error", e);
            }
        }

        @Override
        public void dismiss() {
            try {
                if (webView != null) {
                    webView.stopLoading();
                    webView.loadUrl("about:blank");
                    webView.clearHistory();
                    webView.removeAllViews();
                    webView.destroy();
                    webView = null;
                }
            } catch (Exception ignored) {}
            super.dismiss();
        }

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);

            if (getWindow() != null) {
                getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN);

                View decorView = getWindow().getDecorView();
                if (decorView != null) {
                    decorView.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                    );
                }
            }
            
            webView = new WebView(getContext());
            webView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setEnableSmoothTransition(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            settings.setTextZoom(100); // Strict 100% zoom prevents layout breaking on Sunmi OS font scales
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }

            if (instance != null) {
                AndroidCfdBridge bridge = instance.new AndroidCfdBridge();
                webView.addJavascriptInterface(bridge, "AndroidCfdBridge");
                webView.addJavascriptInterface(bridge, "AndroidPosBridge");
            }
            
            webView.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    try {
                        if (instance != null && instance.getBridge() != null && instance.getBridge().getLocalServer() != null) {
                            WebResourceResponse res = instance.getBridge().getLocalServer().shouldInterceptRequest(request);
                            if (res != null) {
                                return res;
                            }
                        }
                    } catch (Exception e) {
                        Log.w("SecondaryDisplay", "LocalServer intercept exception: " + e.getMessage());
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    isPageLoaded = true;
                    if (lastEventJson != null) {
                        evaluateCfdEvent(lastEventJson);
                    }
                }

                @Override
                public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                    Log.w("MainActivity", "Secondary WebView error: " + description + " for " + failingUrl);
                    if (failingUrl != null && failingUrl.startsWith("http://localhost")) {
                        Log.w("MainActivity", "Local CFD load failed, falling back to online CFD URL: " + description);
                        view.loadUrl("https://haustable.vercel.app/pos/cfd");
                    }
                }
            });

            // Fast local 0ms load directly from Capacitor local web server
            webView.loadUrl("http://localhost/pos/cfd");
            setContentView(webView);
        }
    }
}
