package pe.ecocentury.asistencia;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Sincronización con Google Sheets (Apps Script). Todas las llamadas de red van en segundo plano. */
final class Cloud {
    private Cloud() {}

    interface Result<T> { void done(T value, Exception error); }

    private static final ExecutorService EX = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    /** Ejecuta una tarea en segundo plano y entrega el resultado en el hilo principal. */
    static <T> void async(Callable<T> task, Result<T> cb) {
        EX.execute(() -> {
            T v = null;
            Exception err = null;
            try { v = task.call(); } catch (Exception e) { err = e; }
            final T fv = v;
            final Exception fe = err;
            if (cb != null) MAIN.post(() -> cb.done(fv, fe));
        });
    }

    // ---------- HTTP ----------

    static JSONObject call(String url, String key, JSONObject body) throws IOException {
        try {
            body.put("clave", key);
        } catch (JSONException e) {
            throw new IOException(e.getMessage());
        }
        byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
        HttpURLConnection con = open(url);
        con.setRequestMethod("POST");
        con.setDoOutput(true);
        con.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        con.setFixedLengthStreamingMode(data.length);
        try (OutputStream os = con.getOutputStream()) { os.write(data); }
        int code = con.getResponseCode();
        // Apps Script responde con una redirección: se sigue con GET
        int hops = 0;
        while (code >= 300 && code < 400 && hops++ < 5) {
            String loc = con.getHeaderField("Location");
            con.disconnect();
            if (loc == null) break;
            con = open(loc);
            code = con.getResponseCode();
        }
        String text;
        try (InputStream in = code >= 400 ? con.getErrorStream() : con.getInputStream()) {
            text = in == null ? "" : readAll(in);
        } finally {
            con.disconnect();
        }
        if (code != 200) throw new IOException("El servidor respondió con error " + code + ". Revisa la URL.");
        JSONObject o;
        try {
            o = new JSONObject(text);
        } catch (JSONException e) {
            throw new IOException("Respuesta no válida. Verifica que la URL termine en /exec y que el acceso sea \"Cualquier persona\".");
        }
        if (!o.optBoolean("ok", false)) throw new IOException(o.optString("error", "Error del servidor"));
        return o;
    }

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setInstanceFollowRedirects(false);
        con.setConnectTimeout(15000);
        con.setReadTimeout(60000);
        return con;
    }

    private static String readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return new String(bo.toByteArray(), StandardCharsets.UTF_8);
    }

    private static JSONObject req(String action) throws IOException {
        try {
            return new JSONObject().put("accion", action);
        } catch (JSONException e) {
            throw new IOException(e.getMessage());
        }
    }

    // ---------- Operaciones ----------

    /** Prueba la conexión y devuelve el número de trabajadores encontrados. */
    static int test(Context c, String url, String key) throws IOException {
        JSONObject o = call(url, key, req("datos"));
        applyData(c, o);
        return o.optJSONArray("trabajadores") == null ? 0 : o.optJSONArray("trabajadores").length();
    }

    /** Envía las marcaciones pendientes y descarga trabajadores y horario. */
    static synchronized String sync(Context c) throws IOException {
        if (!Settings.cloudOn(c)) return "Sin conexión a la nube configurada";
        int sent = push(c);
        JSONObject o = call(Settings.cloudUrl(c), Settings.cloudKey(c), req("datos"));
        applyData(c, o);
        Settings.saveLastSync(c, LocalDateTime.now().format(Calc.DAY_SHOW) + " " + LocalTime.now().format(Calc.HM));
        return sent > 0 ? sent + " marcación(es) enviada(s)" : "Todo al día";
    }

    /** Sincroniza en segundo plano; cb puede ser null. */
    static void syncAsync(Context c, Result<String> cb) {
        Context app = c.getApplicationContext();
        if (!Settings.cloudOn(app)) return;
        async(() -> sync(app), cb);
    }

    private static void applyData(Context c, JSONObject o) {
        JSONArray ws = o.optJSONArray("trabajadores");
        if (ws == null) return;
        List<Calc.Worker> list = new ArrayList<>();
        for (int i = 0; i < ws.length(); i++) {
            JSONObject j = ws.optJSONObject(i);
            if (j == null) continue;
            String dni = j.optString("dni", "").trim();
            String name = j.optString("nombre", "").trim();
            if (dni.isEmpty() || name.isEmpty()) continue;
            Calc.Worker w = new Calc.Worker(dni, name);
            w.sede = j.optString("sede", "");
            w.shift = j.optString("turno", "");
            w.start = j.optString("entrada", "");
            w.tol = j.optInt("tolerancia", -1);
            w.workday = j.optBoolean("laborable", true);
            list.add(w);
        }
        List<Db.Sede> sedes = null;
        JSONArray ss = o.optJSONArray("sedes");
        if (ss != null) {
            sedes = new ArrayList<>();
            for (int i = 0; i < ss.length(); i++) {
                JSONObject j = ss.optJSONObject(i);
                if (j == null) continue;
                Db.Sede s = new Db.Sede();
                s.name = j.optString("nombre", "").trim();
                if (s.name.isEmpty()) continue;
                s.lat = j.isNull("lat") ? null : j.optDouble("lat");
                s.lng = j.isNull("lng") ? null : j.optDouble("lng");
                if (s.lat != null && s.lat.isNaN()) s.lat = null;
                if (s.lng != null && s.lng.isNaN()) s.lng = null;
                s.radius = j.optInt("radio", 200);
                s.validate = j.optBoolean("validar", false);
                sedes.add(s);
            }
        }
        Db.get(c).replaceCloudData(list, sedes);
        String day = o.optString("fecha", "");
        if (!day.isEmpty()) Settings.saveCloudDay(c, day);
    }

    private static int push(Context c) throws IOException {
        Db db = Db.get(c);
        String dev = Settings.deviceId(c);
        String devName = Settings.deviceName(c);
        int total = 0;
        while (true) {
            List<Calc.Mark> pend = db.pending(5);
            if (pend.isEmpty()) break;
            JSONArray arr = new JSONArray();
            try {
                for (Calc.Mark m : pend) {
                    LocalDateTime t = Calc.toLocal(m.ts);
                    JSONObject j = new JSONObject();
                    j.put("id", dev + "-" + m.id);
                    j.put("dni", m.dni);
                    j.put("nombre", m.name);
                    j.put("tipo", m.type);
                    j.put("dia", m.day);
                    j.put("fecha", t.toLocalDate().format(Calc.DAY_SHOW));
                    j.put("hora", t.toLocalTime().format(Calc.HMS));
                    j.put("equipo", devName);
                    String b64 = photoBase64(c, m.photo);
                    if (b64 != null) j.put("foto", b64);
                    if (m.sede != null) j.put("sede", m.sede);
                    if (m.lat != null) { j.put("lat", m.lat); j.put("lng", m.lng); }
                    if (m.acc != null) j.put("precision", Math.round(m.acc));
                    if (m.dist != null) j.put("distancia", m.dist);
                    if (m.loc != null) j.put("ubicacion", m.loc);
                    arr.put(j);
                }
            } catch (JSONException e) {
                throw new IOException(e.getMessage());
            }
            JSONObject body = req("marcar");
            try { body.put("marcas", arr); } catch (JSONException e) { throw new IOException(e.getMessage()); }
            JSONObject res = call(Settings.cloudUrl(c), Settings.cloudKey(c), body);
            JSONArray ids = res.optJSONArray("ids");
            Set<String> ok = new HashSet<>();
            if (ids != null) for (int i = 0; i < ids.length(); i++) ok.add(ids.optString(i));
            int done = 0;
            for (Calc.Mark m : pend) {
                if (ok.contains(dev + "-" + m.id)) { db.setSynced(m.id); done++; }
            }
            if (done == 0) throw new IOException("El servidor no confirmó las marcaciones");
            total += done;
        }
        return total;
    }

    private static String photoBase64(Context c, String name) {
        if (name == null) return null;
        File f = new File(PhotoProvider.photoDir(c), name);
        if (!f.exists()) return null;
        try (FileInputStream in = new FileInputStream(f)) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            return Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
        } catch (IOException e) {
            return null;
        }
    }

    // ---------- Resumen, Mi espacio y solicitudes ----------

    /** Fila de resumen calculada en la hoja. */
    static final class Row {
        String fecha, dni, nombre, sede, turno, horario, entrada, salida, trabajado, horasExtra, estadoHE, estado, alerta;
        int tardanza;
        boolean tardanzaJustificada, falta, enJornada, asistio;
    }

    /** Solicitud de un trabajador. */
    static final class Request {
        String fecha, tipo, desde, hasta, detalle, motivo, estado, respuesta;
    }

    private static List<Row> rows(JSONArray arr) {
        List<Row> out = new ArrayList<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject j = arr.optJSONObject(i);
            if (j == null) continue;
            Row r = new Row();
            r.fecha = j.optString("fecha", "");
            r.dni = j.optString("dni", "");
            r.nombre = j.optString("nombre", "");
            r.sede = j.optString("sede", "");
            r.turno = j.optString("turno", "");
            r.horario = j.optString("horario", "");
            r.entrada = j.optString("entrada", "");
            r.salida = j.optString("salida", "");
            r.trabajado = j.optString("trabajado", "");
            r.horasExtra = j.optString("horasExtra", "");
            r.estadoHE = j.optString("estadoHE", "");
            r.estado = j.optString("estado", "");
            r.alerta = j.optString("alerta", "");
            r.tardanza = j.optInt("tardanza", 0);
            r.tardanzaJustificada = j.optBoolean("tardanzaJustificada", false);
            r.falta = j.optBoolean("falta", false);
            r.enJornada = j.optBoolean("enJornada", false);
            r.asistio = j.optBoolean("asistio", false);
            out.add(r);
        }
        return out;
    }

    private static JSONObject body(String action, Object... kv) throws IOException {
        JSONObject b = req(action);
        try {
            for (int i = 0; i + 1 < kv.length; i += 2) b.put((String) kv[i], kv[i + 1]);
        } catch (JSONException e) {
            throw new IOException(e.getMessage());
        }
        return b;
    }

    private static JSONObject callCfg(Context c, JSONObject b) throws IOException {
        if (!Settings.cloudOn(c)) throw new IOException("Configura primero la conexión a la nube (Administración).");
        return call(Settings.cloudUrl(c), Settings.cloudKey(c), b);
    }

    /** Resumen de un día de todos los trabajadores, calculado en la hoja. */
    static List<Row> summary(Context c, String day) throws IOException {
        return rows(callCfg(c, body("resumen", "dia", day)).optJSONArray("filas"));
    }

    /** Registro del propio trabajador (últimos días). Devuelve nombre en [0] y filas. */
    static List<Row> mySummary(Context c, String dni, String key, int days, String[] nameOut) throws IOException {
        JSONObject o = callCfg(c, body("mi_resumen", "dni", dni, "clavePersonal", key, "dias", days));
        if (nameOut != null && nameOut.length > 0) nameOut[0] = o.optString("nombre", "");
        return rows(o.optJSONArray("filas"));
    }

    static void sendRequest(Context c, String dni, String key, String type, String from, String to,
                            String detail, String reason) throws IOException {
        callCfg(c, body("solicitar", "dni", dni, "clavePersonal", key, "tipo", type, "desde", from, "hasta", to,
                "detalle", detail, "motivo", reason));
    }

    static List<Request> myRequests(Context c, String dni, String key) throws IOException {
        JSONArray arr = callCfg(c, body("mis_solicitudes", "dni", dni, "clavePersonal", key)).optJSONArray("solicitudes");
        List<Request> out = new ArrayList<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject j = arr.optJSONObject(i);
            if (j == null) continue;
            Request r = new Request();
            r.fecha = j.optString("fecha", "");
            r.tipo = j.optString("tipo", "");
            r.desde = j.optString("desde", "");
            r.hasta = j.optString("hasta", "");
            r.detalle = j.optString("detalle", "");
            r.motivo = j.optString("motivo", "");
            r.estado = j.optString("estado", "");
            r.respuesta = j.optString("respuesta", "");
            out.add(r);
        }
        return out;
    }
}
