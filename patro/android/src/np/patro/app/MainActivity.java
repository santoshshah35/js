package np.patro.app;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Shows the Patro web app bundled in assets/www and gives it a small native
 * HTTP bridge for the forex and gold rates, which browsers would block.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/www/index.html";
    private static final Set<String> ALLOWED_HOSTS = new HashSet<String>(Arrays.asList(
            "www.nrb.org.np", "nrb.org.np", "www.fenegosida.org", "fenegosida.org",
            "noc.org.np", "www.noc.org.np"));
    // Market-rate fallback (lib/rates.js) when NRB can't be reached.
    private static final String MARKET_CDN_HOST = "cdn.jsdelivr.net";
    private static final String MARKET_CDN_PATH = "/npm/@fawazahmed0/currency-api";
    private static final String MARKET_MIRROR_HOST = "latest.currency-api.pages.dev";
    // Admin feed (lib/feed.js): only this repository's files on GitHub.
    private static final String FEED_HOST = "raw.githubusercontent.com";
    private static final String FEED_PATH = "/santoshshah35/js/";
    private static final int MAX_BYTES = 2 * 1024 * 1024;

    private final ExecutorService pool = Executors.newFixedThreadPool(2);
    // Sent with rate requests so the sites treat them like the phone's browser.
    private static volatile String userAgent = "Mozilla/5.0 (Linux; Android) Patro/1.3";
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings();
        try {
            userAgent = WebSettings.getDefaultUserAgent(this);
        } catch (RuntimeException e) {
            // Keep the fallback user agent.
        }
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        web.addJavascriptInterface(new Bridge(), "PatroNative");
        web.setWebViewClient(new WebViewClient() {
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:///android_asset/")) return false;
                // Links to other sites open in the browser, not inside the app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (ActivityNotFoundException e) {
                    // No app can open the link; stay on the calendar.
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    // Back closes the settings sheet if it is open, and otherwise leaves the
    // app; it never steps back through the tabs.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__patroBack ? window.__patroBack() : false", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) finish();
            }
        });
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        web.destroy();
        super.onDestroy();
    }

    /** Status bar colours to match the page's light or dark theme. */
    private void applyBars(String mode) {
        boolean dark;
        if ("dark".equals(mode)) dark = true;
        else if ("light".equals(mode)) dark = false;
        else dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        getWindow().setStatusBarColor(dark ? Color.rgb(0x1D, 0x1C, 0x1A) : Color.WHITE);
        getWindow().setNavigationBarColor(dark ? Color.rgb(0x1D, 0x1C, 0x1A) : Color.WHITE);
        if (Build.VERSION.SDK_INT >= 23) {
            View decor = getWindow().getDecorView();
            int flags = decor.getSystemUiVisibility();
            flags = dark ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
                    : flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            decor.setSystemUiVisibility(flags);
        }
    }

    /** Called from the page's JavaScript as PatroNative.*. */
    private final class Bridge {
        /** ui/shell.js: "system", "light" or "dark". */
        @JavascriptInterface
        public void setThemeMode(final String mode) {
            main.post(new Runnable() {
                @Override
                public void run() {
                    applyBars(mode);
                }
            });
        }

        /** ui/widget.js: text for the home-screen widget's coming days. */
        @JavascriptInterface
        public void saveWidgetData(final String json) {
            if (json == null || json.length() > 1024 * 1024) return;
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    PatroWidget.save(getApplicationContext(), json);
                }
            });
        }

        /** lib/rates.js: fetch an allowed page and hand it back to __patroNativeDone. */
        @JavascriptInterface
        public void httpGet(final String id, final String url) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    String body;
                    boolean ok;
                    try {
                        body = fetch(url);
                        ok = true;
                    } catch (Exception e) {
                        body = String.valueOf(e.getMessage());
                        ok = false;
                    }
                    deliver(id, ok, body);
                }
            });
        }
    }

    private static String fetch(String address) throws Exception {
        URL url = new URL(address);
        String host = url.getHost();
        boolean feed = FEED_HOST.equals(host) && url.getPath().startsWith(FEED_PATH);
        boolean market = (MARKET_CDN_HOST.equals(host) && url.getPath().startsWith(MARKET_CDN_PATH))
                || MARKET_MIRROR_HOST.equals(host);
        if (!"https".equals(url.getProtocol()) || !(feed || market || ALLOWED_HOSTS.contains(host))) {
            throw new SecurityException("Host not allowed: " + url.getHost());
        }
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setRequestProperty("User-Agent", userAgent);
            conn.setRequestProperty("Accept", "application/json, text/html;q=0.9, */*;q=0.8");
            conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9,ne;q=0.8");
            int code = conn.getResponseCode();
            if (code != 200) throw new Exception("HTTP " + code);
            InputStream in = conn.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                if (out.size() > MAX_BYTES) throw new Exception("Response too large");
            }
            in.close();
            return out.toString("UTF-8");
        } finally {
            conn.disconnect();
        }
    }

    private void deliver(final String id, final boolean ok, final String body) {
        final String js = "window.__patroNativeDone && window.__patroNativeDone("
                + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(body) + ")";
        main.post(new Runnable() {
            @Override
            public void run() {
                if (!isFinishing()) web.evaluateJavascript(js, null);
            }
        });
    }
}
