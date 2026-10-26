package np.patro.app;

import android.accounts.AccountManager;
import android.app.Activity;
import android.content.SharedPreferences;
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
import android.content.pm.PackageManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Shows the Patro web app bundled in assets/www and gives it a small native
 * bridge: HTTP for the rates and news sites (which browsers would block),
 * sign-in, sharing, the widget and the status bar colours.
 */
public class MainActivity extends Activity {

    private static final String START_URL = "file:///android_asset/www/index.html";
    private static final Set<String> ALLOWED_HOSTS = new HashSet<String>(Arrays.asList(
            "www.nrb.org.np", "nrb.org.np", "www.fenegosida.org", "fenegosida.org", "api.fenegosida.org",
            "noc.org.np", "www.noc.org.np"));
    // Market-rate fallback (lib/rates.js) when NRB can't be reached.
    private static final String MARKET_CDN_HOST = "cdn.jsdelivr.net";
    private static final String MARKET_CDN_PATH = "/npm/@fawazahmed0/currency-api";
    private static final String MARKET_MIRROR_HOST = "latest.currency-api.pages.dev";
    // Admin feed (lib/feed.js): only this repository's files on GitHub.
    private static final String FEED_HOST = "raw.githubusercontent.com";
    private static final String FEED_PATH = "/santoshshah35/js/";
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private static final int REQUEST_GOOGLE_ACCOUNT = 1;
    private static final int REQUEST_PHOTO = 2;
    private static final int REQUEST_NOTIFICATIONS = 3;
    private static final String POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS";
    // Facebook's sign-in page; it returns through auth.html and patro://auth.
    private static final String FACEBOOK_AUTH = "https://www.facebook.com/";
    private static final String PREFS = "patro.auth";
    private static final String PREF_NONCE = "nonce";
    // The last crash, saved so the next launch can show it and start safely.
    private static final String CRASH_PREFS = "patro.crash";
    private static final String PREF_CRASH = "last";
    private static boolean crashHandlerSet = false;

    private final ExecutorService pool = Executors.newFixedThreadPool(2);
    // Sent with rate requests so the sites treat them like the phone's browser.
    private static volatile String userAgent = "Mozilla/5.0 (Linux; Android) Patro/1.3";
    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;
    // The profile photo picker's answer goes back to the page through this.
    private ValueCallback<Uri[]> photoCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        catchCrashes();
        boolean crashedLastTime = getSharedPreferences(CRASH_PREFS, MODE_PRIVATE).getString(PREF_CRASH, null) != null;
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
        // The profile photo picker returns content:// addresses the page reads.
        settings.setAllowContentAccess(true);

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

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (photoCallback != null) photoCallback.onReceiveValue(null);
                photoCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(pick, null), REQUEST_PHOTO);
                    return true;
                } catch (ActivityNotFoundException e) {
                    photoCallback = null;
                    return false;
                }
            }
        });

        // After a crash, start without the extras so the page can open and
        // show what went wrong.
        if (!crashedLastTime) startAlerts();

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
        // Opened by the patro://auth link after Facebook sign-in.
        if (savedInstanceState == null) handleAuthLink(getIntent(), true);
    }

    /** Breaking news from the admin: checked now and every 15 minutes. */
    private void startAlerts() {
        try {
            AlertJob.schedule(this);
        } catch (Throwable e) {
            // Background checks unavailable on this phone; alerts still show in the app.
        }
        pool.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    AlertJob.check(getApplicationContext());
                } catch (Throwable e) {
                    // Nothing to show this time.
                }
            }
        });
        try {
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] {POST_NOTIFICATIONS}, REQUEST_NOTIFICATIONS);
            }
        } catch (Throwable e) {
            // The phone's own settings can still turn notifications on.
        }
    }

    /** Saves any crash's details for the next launch, then lets Android close the app. */
    private void catchCrashes() {
        if (crashHandlerSet) return;
        crashHandlerSet = true;
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        final android.content.Context app = getApplicationContext();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable error) {
                try {
                    StringWriter trace = new StringWriter();
                    error.printStackTrace(new PrintWriter(trace));
                    String report = "Patro " + versionName() + ", Android " + Build.VERSION.RELEASE
                            + " (" + Build.VERSION.SDK_INT + "), " + Build.MANUFACTURER + " " + Build.MODEL
                            + "\n" + trace.toString();
                    app.getSharedPreferences(CRASH_PREFS, MODE_PRIVATE).edit()
                            .putString(PREF_CRASH, report.length() > 6000 ? report.substring(0, 6000) : report)
                            .commit();
                } catch (Throwable ignored) {
                    // Nothing more can be done here.
                }
                if (previous != null) previous.uncaughtException(thread, error);
            }
        });
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAuthLink(intent, false);
    }

    /**
     * patro://auth?provider=facebook&id=..&name=..&state=<nonce> from
     * auth.html. Accepted only with the nonce this app sent, so a link from
     * anywhere else can't sign anyone in.
     */
    private void handleAuthLink(Intent intent, final boolean waitForPage) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"patro".equals(data.getScheme()) || !"auth".equals(data.getHost())) return;
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String expected = prefs.getString(PREF_NONCE, null);
        prefs.edit().remove(PREF_NONCE).apply();
        String state = data.getQueryParameter("state");
        if (expected == null || !expected.equals(state)) return;
        final JSONObject user = new JSONObject();
        try {
            user.put("provider", data.getQueryParameter("provider"));
            user.put("id", data.getQueryParameter("id"));
            user.put("name", data.getQueryParameter("name"));
            user.put("email", data.getQueryParameter("email"));
            user.put("picture", data.getQueryParameter("picture"));
        } catch (org.json.JSONException e) {
            return;
        }
        // On a cold start the page needs a moment to load first.
        main.postDelayed(new Runnable() {
            @Override
            public void run() {
                callPage("__patroAuthDone", user.toString());
            }
        }, waitForPage ? 1500 : 0);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_PHOTO) {
            if (photoCallback != null) {
                photoCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                photoCallback = null;
            }
            return;
        }
        if (requestCode != REQUEST_GOOGLE_ACCOUNT) return;
        String email = data == null ? null : data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
        if (resultCode != RESULT_OK || email == null) {
            callPage("__patroAuthFailed", "cancelled");
            return;
        }
        JSONObject user = new JSONObject();
        try {
            user.put("provider", "google");
            user.put("id", email);
            user.put("email", email);
        } catch (org.json.JSONException e) {
            return;
        }
        callPage("__patroAuthDone", user.toString());
    }

    private void callPage(String function, String argument) {
        if (isFinishing()) return;
        web.evaluateJavascript("window." + function + " && window." + function + "("
                + JSONObject.quote(argument) + ")", null);
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

        /** ui/account.js: the phone's own Google account picker. */
        @JavascriptInterface
        public void signInGoogle() {
            main.post(new Runnable() {
                @Override
                @SuppressWarnings("deprecation")
                public void run() {
                    Intent pick = AccountManager.newChooseAccountIntent(null, null,
                            new String[] {"com.google"}, true, null, null, null, null);
                    try {
                        startActivityForResult(pick, REQUEST_GOOGLE_ACCOUNT);
                    } catch (ActivityNotFoundException e) {
                        callPage("__patroAuthFailed", "no Google account picker on this phone");
                    }
                }
            });
        }

        /** ui/account.js: Facebook's sign-in page in the phone's browser. */
        @JavascriptInterface
        public void openAuth(final String url, final String nonce) {
            if (url == null || !url.startsWith(FACEBOOK_AUTH) || nonce == null || nonce.length() < 16) return;
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(PREF_NONCE, nonce).apply();
            main.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (ActivityNotFoundException e) {
                        callPage("__patroAuthFailed", "no browser on this phone");
                    }
                }
            });
        }

        /** ui/alerts.js: notifications on or off, and their language. */
        @JavascriptInterface
        public void setNotifications(boolean enabled, String lang) {
            getSharedPreferences(AlertJob.PREFS, MODE_PRIVATE).edit()
                    .putBoolean(AlertJob.PREF_ENABLED, enabled)
                    .putString(AlertJob.PREF_LANG, "en".equals(lang) ? "en" : "ne")
                    .apply();
        }

        /** ui/shell.js: the last crash's details (once), or null. */
        @JavascriptInterface
        public String takeCrashReport() {
            SharedPreferences prefs = getSharedPreferences(CRASH_PREFS, MODE_PRIVATE);
            String report = prefs.getString(PREF_CRASH, null);
            prefs.edit().remove(PREF_CRASH).apply();
            return report;
        }

        /** ui/news.js: the phone's share menu. */
        @JavascriptInterface
        public void share(final String text) {
            if (text == null || text.length() > 4000) return;
            main.post(new Runnable() {
                @Override
                public void run() {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(Intent.EXTRA_TEXT, text);
                    try {
                        startActivity(Intent.createChooser(send, null));
                    } catch (ActivityNotFoundException e) {
                        // Nothing can share text; ignore.
                    }
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
        boolean news = NewsHosts.HOSTS.contains(host);
        if (!"https".equals(url.getProtocol()) || !(feed || market || news || ALLOWED_HOSTS.contains(host))) {
            throw new SecurityException("Host not allowed: " + url.getHost());
        }
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        try {
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setRequestProperty("User-Agent", userAgent);
            conn.setRequestProperty("Accept", "application/json, application/rss+xml, application/xml;q=0.9, text/html;q=0.9, */*;q=0.8");
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
