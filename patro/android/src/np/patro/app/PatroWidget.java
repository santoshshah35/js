package np.patro.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: today's Bikram Sambat date, tithi and the next
 * festival. The text comes from the app (ui/widget.js), which saves rows for
 * the coming days; this picks today's row by Nepal's date.
 */
public class PatroWidget extends AppWidgetProvider {

    static final String PREFS = "patro_widget";
    static final String KEY_DATA = "data";
    private static final long DAY_MS = 86400000L;
    private static final long NEPAL_OFFSET_MS = (5 * 60 + 45) * 60000L;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        updateAll(context);
    }

    /** Redraws every Patro widget; also called when the app saves new data. */
    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, PatroWidget.class));
        if (ids.length == 0) return;
        RemoteViews views = build(context);
        for (int id : ids) manager.updateAppWidget(id, views);
        scheduleMidnight(context);
    }

    private static long nepalDay(long ms) {
        return (ms + NEPAL_OFFSET_MS) / DAY_MS;
    }

    private static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget);
        JSONArray row = todayRow(context);
        if (row != null) {
            views.setTextViewText(R.id.widget_day, row.optString(1));
            views.setTextViewText(R.id.widget_month, row.optString(2));
            views.setTextViewText(R.id.widget_weekday, row.optString(3));
            views.setTextViewText(R.id.widget_tithi, row.optString(4));
            String event = row.optString(5);
            views.setTextViewText(R.id.widget_event, event);
            views.setViewVisibility(R.id.widget_event, event.isEmpty() ? View.GONE : View.VISIBLE);
            views.setViewVisibility(R.id.widget_tithi, View.VISIBLE);
        } else {
            views.setTextViewText(R.id.widget_day, "पा");
            views.setTextViewText(R.id.widget_month, context.getString(R.string.app_name));
            views.setTextViewText(R.id.widget_weekday, context.getString(R.string.widget_open_app));
            views.setViewVisibility(R.id.widget_tithi, View.GONE);
            views.setViewVisibility(R.id.widget_event, View.GONE);
        }
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(R.id.widget_root,
                PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return views;
    }

    private static JSONArray todayRow(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String data = prefs.getString(KEY_DATA, null);
        if (data == null) return null;
        try {
            JSONArray rows = new JSONObject(data).getJSONArray("rows");
            long today = nepalDay(System.currentTimeMillis());
            for (int i = 0; i < rows.length(); i++) {
                JSONArray row = rows.getJSONArray(i);
                if (row.getLong(0) == today) return row;
            }
        } catch (Exception e) {
            // Unreadable data: show the "open the app" state.
        }
        return null;
    }

    /** Redraw just after the next midnight in Nepal so the date turns over. */
    private static void scheduleMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        long nextMidnight = (nepalDay(System.currentTimeMillis()) + 1) * DAY_MS - NEPAL_OFFSET_MS + 60000L;
        Intent tick = new Intent(context, PatroWidget.class);
        tick.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        PendingIntent pending = PendingIntent.getBroadcast(context, 1, tick,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.set(AlarmManager.RTC, nextMidnight, pending);
    }

    /** Called by MainActivity's bridge with the JSON from ui/widget.js. */
    static void save(Context context, String json) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_DATA, json).apply();
        updateAll(context);
    }
}
