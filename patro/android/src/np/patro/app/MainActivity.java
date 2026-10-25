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
    private static final int MAX_BYTES = 2 * 1024 * 1024;

    private final ExecutorService pool = Executors.newFixedThreadPool(2);
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings();
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

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
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
        if (!"https".equals(url.getProtocol()) || !ALLOWED_HOSTS.contains(url.getHost())) {
            throw new SecurityException("Host not allowed: " + url.getHost());
        }
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setRequestProperty("User-Agent", "Patro/1.0 (Android)");
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
