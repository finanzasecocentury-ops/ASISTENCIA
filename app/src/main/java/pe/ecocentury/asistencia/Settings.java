package pe.ecocentury.asistencia;

import android.content.Context;
import android.content.SharedPreferences;

import java.time.LocalTime;

/** Configuración guardada en el equipo. */
final class Settings {
    private Settings() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("config", Context.MODE_PRIVATE);
    }

    static Calc.Schedule schedule(Context c) {
        SharedPreferences p = prefs(c);
        Calc.Schedule s = new Calc.Schedule();
        LocalTime st = parseTime(p.getString("start", "08:00"));
        LocalTime en = parseTime(p.getString("end", "17:00"));
        if (st != null) s.start = st;
        if (en != null) s.end = en;
        s.tolerance = p.getInt("tol", 10);
        s.breakMin = p.getInt("break", 0);
        s.saturdays = p.getBoolean("sat", false);
        return s;
    }

    static void saveSchedule(Context c, Calc.Schedule s) {
        prefs(c).edit()
                .putString("start", Calc.fmtTime(s.start))
                .putString("end", Calc.fmtTime(s.end))
                .putInt("tol", s.tolerance)
                .putInt("break", s.breakMin)
                .putBoolean("sat", s.saturdays)
                .apply();
    }

    static String pin(Context c) { return prefs(c).getString("pin", "1234"); }

    static void savePin(Context c, String pin) { prefs(c).edit().putString("pin", pin).apply(); }

    // ---------- Nube (Google Sheets) ----------

    static String cloudUrl(Context c) { return prefs(c).getString("url", "").trim(); }

    static String cloudKey(Context c) { return prefs(c).getString("key", ""); }

    static boolean cloudOn(Context c) { return !cloudUrl(c).isEmpty(); }

    static void saveCloud(Context c, String url, String key) {
        prefs(c).edit().putString("url", url.trim()).putString("key", key).apply();
    }

    static String lastSync(Context c) { return prefs(c).getString("lastSync", ""); }

    static void saveLastSync(Context c, String s) { prefs(c).edit().putString("lastSync", s).apply(); }

    /** Fecha (yyyy-MM-dd) a la que corresponden los turnos descargados. */
    static String cloudDay(Context c) { return prefs(c).getString("cloudDay", ""); }

    static void saveCloudDay(Context c, String d) { prefs(c).edit().putString("cloudDay", d).apply(); }

    /** Identificador corto y fijo de este celular. */
    static String deviceId(Context c) {
        String id = prefs(c).getString("device", "");
        if (id.isEmpty()) {
            id = java.util.UUID.randomUUID().toString().substring(0, 8);
            prefs(c).edit().putString("device", id).apply();
        }
        return id;
    }

    static String deviceName(Context c) {
        return android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL + " (" + deviceId(c) + ")";
    }

    /** Devuelve null si el texto no es una hora válida (ej. 8:00 o 08:00). */
    static LocalTime parseTime(String s) {
        try { return LocalTime.parse(s.trim(), Calc.HM_PARSE); } catch (Exception e) { return null; }
    }
}
