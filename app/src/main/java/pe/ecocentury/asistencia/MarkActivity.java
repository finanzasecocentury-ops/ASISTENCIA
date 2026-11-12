package pe.ecocentury.asistencia;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.location.Location;
import android.os.Bundle;
import android.provider.MediaStore;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.File;
import java.time.Duration;
import java.time.LocalTime;

/** Marcar entrada/salida con DNI + ubicación GPS + selfie. */
public class MarkActivity extends Activity {
    static final String EXTRA_DOC = "documento";
    private static final int REQ_CAMERA = 10;
    private static final int REQ_LOCATION = 11;

    private EditText dni;
    private TextView info;

    // Marcación en curso (se guarda por si Android cierra la pantalla al abrir la cámara)
    private String pendingDni;
    private long pendingTs;
    private double pLat = Double.NaN, pLng = Double.NaN;
    private float pAcc = -1;
    private int pDist = -1;
    private String pLoc, pSede;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Marcar asistencia");
        if (b != null) {
            pendingDni = b.getString("pendingDni");
            pendingTs = b.getLong("pendingTs");
            pLat = b.getDouble("pLat", Double.NaN);
            pLng = b.getDouble("pLng", Double.NaN);
            pAcc = b.getFloat("pAcc", -1);
            pDist = b.getInt("pDist", -1);
            pLoc = b.getString("pLoc");
            pSede = b.getString("pSede");
        }
        LinearLayout root = Ui.screen(this);

        Ui.add(root, Ui.bold(this, "Ingresa tu DNI o carné de extranjería", 20, Ui.TEXT), 8);
        dni = Ui.edit(this, "Documento", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS
                | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        dni.setFilters(new InputFilter[]{new InputFilter.LengthFilter(12)});
        dni.setTextSize(28);
        dni.setGravity(Gravity.CENTER);
        Ui.add(root, dni, 8);

        info = Ui.text(this, "", 18, Ui.MUTED);
        info.setGravity(Gravity.CENTER);
        Ui.add(root, info, 12);

        Ui.add(root, Ui.button(this, "Marcar (ubicación + selfie)", Ui.GREEN, v -> startMark()), 20);
        Ui.add(root, Ui.text(this, "La app toma tu ubicación y luego abre la cámara para la selfie. "
                + "Detecta sola si corresponde ENTRADA o SALIDA.", 14, Ui.MUTED), 16);

        dni.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void onTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void afterTextChanged(Editable s) { refreshInfo(); }
        });
        String pre = getIntent().getStringExtra(EXTRA_DOC);
        if (pre != null && b == null) dni.setText(pre);
    }

    private void refreshInfo() {
        String d = doc();
        if (d.length() < 8) { info.setText(""); return; }
        Calc.Worker w = Db.get(this).worker(d);
        if (w == null) {
            info.setTextColor(Ui.RED);
            info.setText(NOT_FOUND);
            return;
        }
        String next = Calc.nextTypeAndDay(Db.get(this).lastMark(d), w, System.currentTimeMillis())[0];
        info.setTextColor(Calc.IN.equals(next) ? Ui.GREEN : Ui.BLUE);
        String extra = "";
        if (w.sede != null && !w.sede.isEmpty()) extra += "\nSede: " + w.sede;
        if (w.shift != null && !w.shift.isEmpty() && todayInfoValid()) {
            extra += "\nTurno: " + w.shift + (w.workday && w.start != null && !w.start.isEmpty() ? " (" + w.start + ")" : " · día libre");
        }
        info.setText(w.name + "\nSe registrará: " + next + extra);
    }

    private static final String NOT_FOUND = "Documento no registrado o inactivo.\n(Los administradores no marcan asistencia.)";

    private String doc() {
        String d = dni.getText().toString().trim().toUpperCase(java.util.Locale.ROOT).replaceAll("\\s", "");
        if (d.matches("\\d{1,7}")) d = String.format(java.util.Locale.ROOT, "%8s", d).replace(' ', '0');
        return d;
    }

    /** Los datos de turno descargados corresponden a hoy. */
    private boolean todayInfoValid() {
        return Calc.dayOf(System.currentTimeMillis()).equals(Settings.cloudDay(this));
    }

    // ---------- Paso 1: validar y pedir ubicación ----------

    private void startMark() {
        String d = doc();
        Calc.Worker w = Db.get(this).worker(d);
        if (w == null) { Ui.toast(this, NOT_FOUND.replace("\n", " ")); return; }

        Calc.Mark last = Db.get(this).lastMark(d);
        long lastTs = Math.max(last != null ? last.ts : 0, w.lastMs);
        if (lastTs > 0) {
            long diff = System.currentTimeMillis() - lastTs;
            if (diff >= 0 && diff < 60_000) { Ui.toast(this, "Ya marcaste hace menos de un minuto."); return; }
        }
        pendingDni = d;
        pendingTs = System.currentTimeMillis();
        resetLocation();

        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
        } else {
            locate(true);
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req != REQ_LOCATION || pendingDni == null) return;
        boolean ok = false;
        for (int r : res) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
        locate(ok);
    }

    private void resetLocation() {
        pLat = Double.NaN; pLng = Double.NaN; pAcc = -1; pDist = -1; pLoc = null; pSede = null;
    }

    private void locate(boolean permitted) {
        Calc.Worker w = Db.get(this).worker(pendingDni);
        if (w == null) return;
        Db.Sede sede = Db.get(this).sede(w.sede);
        pSede = sede != null ? sede.name : w.sede;
        boolean validate = sede != null && sede.validate;

        if (!permitted) {
            if (validate) { block("Para marcar en tu sede debes permitir el acceso a la ubicación."); return; }
            evaluate(null, sede);
            return;
        }
        if (!Geo.enabled(this)) {
            if (validate) { block("Activa la ubicación (GPS) del celular e intenta de nuevo."); return; }
            evaluate(null, sede);
            return;
        }
        AlertDialog wait = new AlertDialog.Builder(this)
                .setTitle("Obteniendo ubicación…")
                .setMessage("Espera unos segundos. Si estás bajo techo, acércate a una ventana.")
                .setCancelable(false)
                .show();
        Geo.get(this, 20_000, loc -> {
            try { wait.dismiss(); } catch (Exception ignored) { }
            if (isFinishing()) return;
            evaluate(loc, sede);
        });
    }

    private void evaluate(Location loc, Db.Sede sede) {
        if (loc == null) {
            pLoc = Geo.SIN_GPS;
        } else {
            pLat = loc.getLatitude();
            pLng = loc.getLongitude();
            pAcc = loc.getAccuracy();
            if (Geo.isMock(loc)) {
                pLoc = Geo.FALSA;
            } else if (sede == null || sede.lat == null || sede.lng == null) {
                pLoc = Geo.SIN_SEDE;
            } else {
                pDist = Geo.distance(pLat, pLng, sede.lat, sede.lng);
                pLoc = pDist <= sede.radius ? Geo.DENTRO : Geo.FUERA;
            }
        }
        if (sede != null && sede.validate) {
            if (Geo.FALSA.equals(pLoc)) { block("Se detectó una ubicación falsa. Desactiva las apps de ubicación simulada."); return; }
            if (Geo.SIN_GPS.equals(pLoc)) { block("No se pudo obtener tu ubicación. Sal a un lugar abierto e intenta de nuevo."); return; }
            if (Geo.FUERA.equals(pLoc)) {
                block("Estás a " + pDist + " m de la sede \"" + sede.name + "\". Debes estar a menos de "
                        + sede.radius + " m para marcar.");
                return;
            }
        }
        openCamera();
    }

    private void block(String msg) {
        pendingDni = null;
        new AlertDialog.Builder(this).setTitle("No se puede marcar").setMessage(msg)
                .setPositiveButton("Aceptar", null).show();
    }

    // ---------- Paso 2: selfie ----------

    private void openCamera() {
        File tmp = PhotoProvider.tempFile(this);
        //noinspection ResultOfMethodCallIgnored
        tmp.delete();
        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        i.putExtra(MediaStore.EXTRA_OUTPUT, PhotoProvider.tempUri());
        i.setClipData(ClipData.newRawUri("foto", PhotoProvider.tempUri()));
        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        i.putExtra("android.intent.extras.CAMERA_FACING", 1);
        i.putExtra("android.intent.extras.LENS_FACING_FRONT", 1);
        i.putExtra("android.intent.extra.USE_FRONT_CAMERA", true);
        try {
            startActivityForResult(i, REQ_CAMERA);
        } catch (ActivityNotFoundException e) {
            pendingDni = null;
            Ui.toast(this, "No se encontró una app de cámara en este equipo.");
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_CAMERA) return;
        String d = pendingDni;
        pendingDni = null;
        if (res != RESULT_OK || d == null) {
            Ui.toast(this, "Marcación cancelada: se necesita la foto.");
            return;
        }
        Bitmap photo = PhotoProvider.loadScaled(PhotoProvider.tempFile(this), 800);
        if (photo == null && data != null && data.getExtras() != null) {
            Object o = data.getExtras().get("data");
            if (o instanceof Bitmap) photo = (Bitmap) o;
        }
        if (photo == null) { Ui.toast(this, "No se pudo obtener la foto. Intenta de nuevo."); return; }
        Calc.Worker w = Db.get(this).worker(d);
        if (w == null) { Ui.toast(this, "DNI no registrado"); return; }

        long ts = pendingTs > 0 ? pendingTs : System.currentTimeMillis();
        String fname = d + "_" + ts + ".jpg";
        String photoName = PhotoProvider.saveJpeg(photo, new File(PhotoProvider.photoDir(this), fname)) ? fname : null;
        //noinspection ResultOfMethodCallIgnored
        PhotoProvider.tempFile(this).delete();

        String[] td = Calc.nextTypeAndDay(Db.get(this).lastMark(d), w, ts);
        Calc.Mark m = new Calc.Mark(d, w.name, td[0], ts, photoName);
        m.day = td[1];
        if (!Double.isNaN(pLat)) { m.lat = pLat; m.lng = pLng; }
        if (pAcc >= 0) m.acc = pAcc;
        if (pDist >= 0) m.dist = pDist;
        m.loc = pLoc;
        m.sede = pSede;
        Db.get(this).addMark(m);
        showConfirmation(m, w, photo);
        dni.setText("");
        Cloud.syncAsync(this, null);
    }

    private void showConfirmation(Calc.Mark m, Calc.Worker w, Bitmap photo) {
        LinearLayout box = Ui.dialogBox(this);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        ImageView iv = new ImageView(this);
        iv.setImageBitmap(photo);
        iv.setAdjustViewBounds(true);
        iv.setMaxHeight(Ui.dp(this, 220));
        box.addView(iv);
        TextView t1 = Ui.bold(this, m.type, 26, Calc.IN.equals(m.type) ? Ui.GREEN : Ui.BLUE);
        t1.setGravity(Gravity.CENTER);
        Ui.add(box, t1, 8);
        String hour = Calc.toLocal(m.ts).toLocalTime().format(Calc.HMS);
        TextView t2 = Ui.text(this, m.name + "\n" + Calc.showDay(Calc.dayOf(m.ts)) + "  " + hour, 18, Ui.TEXT);
        t2.setGravity(Gravity.CENTER);
        Ui.add(box, t2, 4);

        long late = lateFor(m, w);
        if (late >= 0) {
            TextView t3 = Ui.bold(this, late > 0 ? "Tardanza: " + late + " min" : "A tiempo", 18,
                    late > 0 ? Ui.ORANGE : Ui.GREEN);
            t3.setGravity(Gravity.CENTER);
            Ui.add(box, t3, 6);
        }
        String locTxt = locationText(m);
        if (!locTxt.isEmpty()) {
            TextView t4 = Ui.text(this, locTxt, 14, Geo.DENTRO.equals(m.loc) ? Ui.GREEN : Ui.MUTED);
            t4.setGravity(Gravity.CENTER);
            Ui.add(box, t4, 6);
        }
        new AlertDialog.Builder(this)
                .setTitle("Marcación registrada")
                .setView(box)
                .setPositiveButton("Aceptar", null)
                .show();
    }

    /** Minutos de tardanza de una ENTRADA, o -1 si no aplica o no se sabe. */
    private long lateFor(Calc.Mark m, Calc.Worker w) {
        if (!Calc.IN.equals(m.type) || Db.get(this).marksOf(m.dni, m.day).size() != 1) return -1;
        if (w.lastMs > 0 && m.day.equals(w.lastDay)) return -1;   // ya tenía marcas hoy en otro celular o en la web
        LocalTime t = Calc.toLocal(m.ts).toLocalTime().withSecond(0).withNano(0);
        if (!todayInfoValid() || !w.workday || w.start == null || w.start.isEmpty()) return -1;
        LocalTime st = Settings.parseTime(w.start);
        if (st == null) return -1;
        long dif = Duration.between(st, t).toMinutes();
        return dif > Math.max(0, w.tol) ? dif : 0;
    }

    static String locationText(Calc.Mark m) {
        if (m.loc == null) return "";
        switch (m.loc) {
            case Geo.DENTRO: return "Ubicación: dentro de " + m.sede + (m.dist != null ? " (" + m.dist + " m)" : "");
            case Geo.FUERA: return "Ubicación: fuera de " + m.sede + (m.dist != null ? " (a " + m.dist + " m)" : "");
            case Geo.SIN_GPS: return "Ubicación: no disponible";
            case Geo.FALSA: return "Ubicación: posible ubicación falsa";
            default: return m.lat != null ? "Ubicación registrada" : "";
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString("pendingDni", pendingDni);
        out.putLong("pendingTs", pendingTs);
        out.putDouble("pLat", pLat);
        out.putDouble("pLng", pLng);
        out.putFloat("pAcc", pAcc);
        out.putInt("pDist", pDist);
        out.putString("pLoc", pLoc);
        out.putString("pSede", pSede);
    }
}
