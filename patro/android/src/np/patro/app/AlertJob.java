package np.patro.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * Checks the admin's alerts (content/alerts.json) every 15 minutes, even
 * when Patro is closed, and shows a phone notification for each new one.
 * Android decides the exact timing; with no server, this is how breaking
 * news reaches the phone.
 */
public class AlertJob extends JobService {

    private static final int JOB_ID = 4201;
    private static final long PERIOD_MS = 15 * 60 * 1000L;
    private static final String[] URLS = {
        "https://raw.githubusercontent.com/santoshshah35/js/main/patro/content/alerts.json",
        "https://raw.githubusercontent.com/santoshshah35/js/claude/new-session-94tzzd/patro/content/alerts.json"
    };
    private static final long FRESH_MS = 24 * 3600 * 1000L;
    private static final int MAX_BYTES = 256 * 1024;
    private static final String CHANNEL = "breaking";
    static final String PREFS = "patro.alerts";
    static final String PREF_ENABLED = "enabled";
    static final String PREF_LANG = "lang";
    private static final String PREF_SEEN = "seen";

    /** Starts the periodic check; safe to call every time the app opens. */
    static void schedule(Context context) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (scheduler == null) return;
        for (JobInfo job : scheduler.getAllPendingJobs()) {
            if (job.getId() == JOB_ID) return;
        }
        JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(context, AlertJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(PERIOD_MS)
                .setPersisted(true)
                .build();
        scheduler.schedule(info);
    }

    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    check(getApplicationContext());
                } catch (Throwable e) {
                    // Try again at the next check.
                } finally {
                    jobFinished(params, false);
                }
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    /** Fetches the alerts and notifies the fresh ones not shown before. */
    static void check(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(PREF_ENABLED, true)) return;
        String body = null;
        for (String url : URLS) {
            try {
                body = fetch(url);
                break;
            } catch (Exception e) {
                // Try the next copy.
            }
        }
        if (body == null) return;
        try {
            JSONArray alerts = new JSONObject(body).getJSONArray("alerts");
            Set<String> seen = new HashSet<String>(prefs.getStringSet(PREF_SEEN, new HashSet<String>()));
            boolean nepali = !"en".equals(prefs.getString(PREF_LANG, "ne"));
            long now = System.currentTimeMillis();
            for (int i = 0; i < alerts.length() && i < 20; i++) {
                JSONObject a = alerts.getJSONObject(i);
                String id = a.optString("id", "");
                long sentAt = parseTime(a.optString("sentAt", ""));
                if (id.isEmpty() || seen.contains(id) || sentAt <= 0 || now - sentAt > FRESH_MS) continue;
                String title = pick(a.optJSONObject("title"), nepali);
                if (title == null) continue;
                notify(context, id, a.optString("level", "breaking"), title, pick(a.optJSONObject("body"), nepali),
                        a.optString("link", ""), nepali);
                seen.add(id);
            }
            // Ids of alerts no longer in the file can be forgotten.
            Set<String> current = new HashSet<String>();
            for (int i = 0; i < alerts.length(); i++) current.add(alerts.getJSONObject(i).optString("id", ""));
            seen.retainAll(current);
            prefs.edit().putStringSet(PREF_SEEN, seen).apply();
        } catch (Exception e) {
            // A malformed file shows nothing; the admin panel checks it first.
        }
    }

    private static String pick(JSONObject pair, boolean nepali) {
        if (pair == null) return null;
        String first = pair.optString(nepali ? "ne" : "en", "").trim();
        String other = pair.optString(nepali ? "en" : "ne", "").trim();
        return !first.isEmpty() ? first : (!other.isEmpty() ? other : null);
    }

    // "2026-10-26T12:00:00.000Z" (the admin panel writes UTC times).
    private static long parseTime(String iso) {
        if (iso.length() < 19) return -1;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            return f.parse(iso.substring(0, 19)).getTime();
        } catch (Exception e) {
            return -1;
        }
    }

    private static void notify(Context context, String id, String level, String title, String text,
                               String link, boolean nepali) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Intent open = link.startsWith("https://")
                ? new Intent(Intent.ACTION_VIEW, Uri.parse(link))
                : new Intent(context, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(context, id.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String label;
        if ("important".equals(level)) label = nepali ? "महत्वपूर्ण" : "Important";
        else if ("info".equals(level)) label = nepali ? "सूचना" : "Notice";
        else label = nepali ? "ब्रेकिङ" : "Breaking";

        Notification.Builder b = builder(context, nm);
        b.setSmallIcon(R.drawable.ic_notify)
                .setColor(0xFFC8102E)
                .setContentTitle(label + ": " + title)
                .setAutoCancel(true)
                .setContentIntent(tap)
                .setPriority(Notification.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL);
        if (text != null) {
            b.setContentText(text).setStyle(new Notification.BigTextStyle().bigText(text));
        }
        nm.notify(id.hashCode(), b.build());
    }

    /**
     * Android 8+ needs a notification channel. The app is built against an
     * older SDK, so the channel classes are reached by reflection.
     */
    @SuppressWarnings("deprecation")
    private static Notification.Builder builder(Context context, NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                Class<?> channelClass = Class.forName("android.app.NotificationChannel");
                Object channel = channelClass.getConstructor(String.class, CharSequence.class, int.class)
                        .newInstance(CHANNEL, "ब्रेकिङ न्युज / Breaking news", 4 /* IMPORTANCE_HIGH */);
                NotificationManager.class.getMethod("createNotificationChannel", channelClass).invoke(nm, channel);
                return (Notification.Builder) Notification.Builder.class
                        .getConstructor(Context.class, String.class).newInstance(context, CHANNEL);
            } catch (Exception e) {
                // Fall through to the plain builder.
            }
        }
        return new Notification.Builder(context);
    }

    private static String fetch(String address) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(address).openConnection();
        try {
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(20000);
            conn.setUseCaches(false);
            if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
            InputStream in = conn.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                if (out.size() > MAX_BYTES) throw new Exception("Too large");
            }
            in.close();
            return out.toString("UTF-8");
        } finally {
            conn.disconnect();
        }
    }
}
