package pe.ecocentury.asistencia;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.OutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/** Menú de administración (protegido con PIN). */
public class AdminActivity extends Activity {
    private static final int REQ_EXPORT = 20;
    private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private LocalDate from = LocalDate.now().withDayOfMonth(1);
    private LocalDate to = LocalDate.now();

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Administración");
        if (b != null && b.getString("from") != null) {
            from = LocalDate.parse(b.getString("from"), Calc.DAY);
            to = LocalDate.parse(b.getString("to"), Calc.DAY);
        }
        LinearLayout root = Ui.screen(this);
        Ui.add(root, Ui.button(this, "Trabajadores", Ui.GREEN,
                v -> startActivity(new Intent(this, WorkersActivity.class))), 8);
        Ui.add(root, Ui.button(this, "Exportar a Excel", Ui.BLUE, v -> exportDialog()), 12);
        Ui.add(root, Ui.button(this, "Historial de marcaciones", Ui.GRAY,
                v -> startActivity(new Intent(this, HistoryActivity.class))), 12);
        Ui.add(root, Ui.button(this, "Horario y PIN", Ui.GRAY, v -> settingsDialog()), 12);
        Ui.add(root, Ui.button(this, "Conexión a la nube (Google Sheets)", Ui.ORANGE, v -> cloudDialog()), 12);
        Ui.add(root, Ui.button(this, "Sincronizar ahora", Ui.ORANGE, v -> syncNow()), 12);
        cloudInfo = Ui.text(this, "", 14, Ui.MUTED);
        Ui.add(root, cloudInfo, 16);
    }

    private TextView cloudInfo;

    @Override
    protected void onResume() {
        super.onResume();
        refreshCloudInfo();
    }

    private void refreshCloudInfo() {
        if (!Settings.cloudOn(this)) {
            cloudInfo.setText("Nube: no configurada. Los datos solo quedan en este celular.");
            return;
        }
        String last = Settings.lastSync(this);
        cloudInfo.setText("Nube: configurada\nÚltima sincronización: " + (last.isEmpty() ? "nunca" : last)
                + "\nMarcaciones por enviar: " + Db.get(this).pendingCount()
                + "\nEquipo: " + Settings.deviceName(this));
    }

    // ---------- Nube ----------

    private void syncNow() {
        if (!Settings.cloudOn(this)) { Ui.toast(this, "Primero configura la conexión a la nube."); return; }
        Ui.toast(this, "Sincronizando…");
        Cloud.async(() -> Cloud.sync(this), (msg, err) -> {
            if (isFinishing()) return;
            Ui.toast(this, err != null ? "No se pudo sincronizar: " + err.getMessage() : "Sincronizado: " + msg);
            refreshCloudInfo();
        });
    }

    private void cloudDialog() {
        LinearLayout box = Ui.dialogBox(this);
        Ui.add(box, Ui.text(this, "Pega la URL de la aplicación web de Google (termina en /exec) "
                + "y la clave que pusiste en el script.", 14, Ui.MUTED), 0);
        EditText url = field(box, "URL", Settings.cloudUrl(this),
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        url.setSingleLine(false);
        url.setMaxLines(4);
        EditText key = field(box, "Clave", Settings.cloudKey(this),
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);

        AlertDialog.Builder d = new AlertDialog.Builder(this)
                .setTitle("Conexión a la nube")
                .setView(wrap(box))
                .setPositiveButton("Probar y guardar", (dlg, w) -> {
                    String u = url.getText().toString().trim();
                    String k = key.getText().toString();
                    if (!u.startsWith("https://")) { Ui.toast(this, "La URL debe empezar con https://"); return; }
                    Ui.toast(this, "Probando conexión…");
                    Cloud.async(() -> Cloud.test(this, u, k), (n, err) -> {
                        if (isFinishing()) return;
                        if (err != null) {
                            Ui.toast(this, "No se pudo conectar: " + err.getMessage());
                            return;
                        }
                        Settings.saveCloud(this, u, k);
                        Ui.toast(this, "Conectado. " + n + " trabajador(es) descargado(s).");
                        syncNow();
                    });
                })
                .setNegativeButton("Cancelar", null);
        if (Settings.cloudOn(this)) {
            d.setNeutralButton("Desconectar", (dlg, w) -> {
                Settings.saveCloud(this, "", "");
                Ui.toast(this, "Nube desconectada. Los datos quedan solo en este celular.");
                refreshCloudInfo();
            });
        }
        d.show();
    }

    // ---------- Exportar ----------

    private void exportDialog() {
        LinearLayout box = Ui.dialogBox(this);
        Ui.add(box, Ui.text(this, "Desde", 14, Ui.MUTED), 0);
        Button bFrom = Ui.button(this, from.format(Calc.DAY_SHOW), Ui.GRAY, null);
        Ui.add(box, bFrom, 4);
        Ui.add(box, Ui.text(this, "Hasta", 14, Ui.MUTED), 12);
        Button bTo = Ui.button(this, to.format(Calc.DAY_SHOW), Ui.GRAY, null);
        Ui.add(box, bTo, 4);
        bFrom.setOnClickListener(v -> new DatePickerDialog(this, (dp, y, m, d) -> {
            from = LocalDate.of(y, m + 1, d);
            bFrom.setText(from.format(Calc.DAY_SHOW));
        }, from.getYear(), from.getMonthValue() - 1, from.getDayOfMonth()).show());
        bTo.setOnClickListener(v -> new DatePickerDialog(this, (dp, y, m, d) -> {
            to = LocalDate.of(y, m + 1, d);
            bTo.setText(to.format(Calc.DAY_SHOW));
        }, to.getYear(), to.getMonthValue() - 1, to.getDayOfMonth()).show());

        new AlertDialog.Builder(this)
                .setTitle("Exportar a Excel")
                .setView(box)
                .setPositiveButton("Exportar", (d, w) -> {
                    if (to.isBefore(from)) { Ui.toast(this, "La fecha final es anterior a la inicial."); return; }
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(XLSX);
                    i.putExtra(Intent.EXTRA_TITLE, "asistencia_" + from.format(Calc.DAY) + "_al_" + to.format(Calc.DAY) + ".xlsx");
                    try {
                        startActivityForResult(i, REQ_EXPORT);
                    } catch (Exception e) {
                        Ui.toast(this, "No se pudo abrir el selector de archivos.");
                    }
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_EXPORT || res != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
            if (os == null) throw new IllegalStateException("sin salida");
            Db db = Db.get(this);
            Report.write(os, db.workers(), db.marksBetween(from.format(Calc.DAY), to.format(Calc.DAY)),
                    Settings.schedule(this), from, to, LocalDateTime.now());
        } catch (Exception e) {
            Ui.toast(this, "Error al exportar: " + e.getMessage());
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Excel generado")
                .setMessage("El archivo se guardó correctamente. ¿Deseas compartirlo (WhatsApp, correo, etc.)?")
                .setPositiveButton("Compartir", (d, w) -> {
                    Intent s = new Intent(Intent.ACTION_SEND);
                    s.setType(XLSX);
                    s.putExtra(Intent.EXTRA_STREAM, uri);
                    s.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(Intent.createChooser(s, "Compartir Excel"));
                })
                .setNegativeButton("Cerrar", null)
                .show();
    }

    // ---------- Configuración ----------

    private void settingsDialog() {
        Calc.Schedule s = Settings.schedule(this);
        LinearLayout box = Ui.dialogBox(this);
        if (Settings.cloudOn(this)) {
            Ui.add(box, Ui.bold(this, "Con la nube activa, los horarios se manejan en la hoja \"Turnos\" de Google Sheets "
                    + "y este horario solo se usa sin conexión. El PIN sí se guarda aquí.",
                    14, Ui.ORANGE), 0);
        }
        EditText start = field(box, "Hora de entrada (HH:mm)", Calc.fmtTime(s.start), InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_TIME);
        EditText end = field(box, "Hora de salida (HH:mm)", Calc.fmtTime(s.end), InputType.TYPE_CLASS_DATETIME | InputType.TYPE_DATETIME_VARIATION_TIME);
        EditText tol = field(box, "Tolerancia (minutos)", String.valueOf(s.tolerance), InputType.TYPE_CLASS_NUMBER);
        EditText brk = field(box, "Refrigerio a descontar (minutos)", String.valueOf(s.breakMin), InputType.TYPE_CLASS_NUMBER);
        CheckBox sat = new CheckBox(this);
        sat.setText("El sábado es día laborable");
        sat.setChecked(s.saturdays);
        Ui.add(box, sat, 8);
        EditText pin = field(box, "Nuevo PIN (dejar vacío para no cambiar)", "",
                InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);

        new AlertDialog.Builder(this)
                .setTitle("Horario y PIN")
                .setView(wrap(box))
                .setPositiveButton("Guardar", (d, w) -> {
                    LocalTime st = Settings.parseTime(start.getText().toString());
                    LocalTime en = Settings.parseTime(end.getText().toString());
                    if (st == null || en == null) { Ui.toast(this, "Hora no válida. Usa el formato 08:00"); return; }
                    s.start = st;
                    s.end = en;
                    s.tolerance = intOr(tol, 0);
                    s.breakMin = intOr(brk, 0);
                    s.saturdays = sat.isChecked();
                    Settings.saveSchedule(this, s);
                    String p = pin.getText().toString().trim();
                    if (!p.isEmpty()) {
                        if (p.length() < 4) { Ui.toast(this, "Horario guardado. El PIN debe tener al menos 4 dígitos."); return; }
                        Settings.savePin(this, p);
                    }
                    Ui.toast(this, "Configuración guardada");
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private android.view.View wrap(LinearLayout box) {
        android.widget.ScrollView sv = new android.widget.ScrollView(this);
        sv.addView(box);
        return sv;
    }

    private EditText field(LinearLayout box, String label, String value, int type) {
        TextView l = Ui.text(this, label, 14, Ui.MUTED);
        Ui.add(box, l, 10);
        EditText e = Ui.edit(this, "", type);
        e.setText(value);
        Ui.add(box, e, 0);
        return e;
    }

    private static int intOr(EditText e, int def) {
        try { return Math.max(0, Integer.parseInt(e.getText().toString().trim())); } catch (Exception x) { return def; }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString("from", from.format(Calc.DAY));
        out.putString("to", to.format(Calc.DAY));
    }
}
