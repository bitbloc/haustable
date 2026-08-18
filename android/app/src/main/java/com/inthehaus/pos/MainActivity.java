package com.inthehaus.pos;

import android.os.Bundle;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import android.app.Presentation;
import android.content.Context;
import android.view.Display;
import android.hardware.display.DisplayManager;

import android.media.AudioManager;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;

public class MainActivity extends BridgeActivity {
    
    private SecondaryDisplayPresentation presentation;
    private ServerSocket wmaServerSocket;
    private Thread wmaServerThread;

    private static MainActivity instance;

    public static MainActivity getInstance() {
        return instance;
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
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
                webView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
                settings.setEnableSmoothTransition(true);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Auto display Customer Facing Display (CFD) on the secondary screen
        try {
            DisplayManager displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
            Display[] displays = displayManager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
            if (displays != null && displays.length > 0) {
                presentation = new SecondaryDisplayPresentation(MainActivity.this, displays[0]);
                presentation.show();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Start native WMA ESC/POS Virtual Printer Bridge Server on Port 9100
        startWmaBridgeServer();
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
    public void onDestroy() {
        if (instance == this) {
            instance = null;
        }
        try {
            if (wmaServerSocket != null) {
                wmaServerSocket.close();
                wmaServerSocket = null;
            }
            if (wmaServerThread != null) {
                wmaServerThread.interrupt();
                wmaServerThread = null;
            }
        } catch (Exception e) {}
        super.onDestroy();
    }

    private static class SecondaryDisplayPresentation extends Presentation {
        public SecondaryDisplayPresentation(Context outerContext, Display display) {
            super(outerContext, display);
        }

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            
            WebView webView = new WebView(getContext());
            webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
            webView.setBackgroundColor(android.graphics.Color.TRANSPARENT);
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            }
            
            webView.setWebViewClient(new WebViewClient());
            webView.loadUrl("https://haustable.vercel.app/pos/cfd");
            setContentView(webView);
        }
    }
}
