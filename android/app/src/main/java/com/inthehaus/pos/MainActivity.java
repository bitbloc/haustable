package com.inthehaus.pos;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;
import android.app.Presentation;
import android.content.Context;
import android.view.Display;
import android.hardware.display.DisplayManager;

public class MainActivity extends BridgeActivity {
    
    private SecondaryDisplayPresentation presentation;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
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
    }

    private static class SecondaryDisplayPresentation extends Presentation {
        public SecondaryDisplayPresentation(Context outerContext, Display display) {
            super(outerContext, display);
        }

        @Override
        protected void onCreate(Bundle savedInstanceState) {
            super.onCreate(savedInstanceState);
            
            WebView webView = new WebView(getContext());
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
