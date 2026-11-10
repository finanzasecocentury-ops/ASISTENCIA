package pe.ecocentury.asistencia;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DatePickerDialog;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/** Espacio del trabajador: ver su registro de asistencia y hacer solicitudes. */
public class MySpaceActivity extends Activity {
    private static final String[] TYPES = {"PERMISO", "VACACIONES", "JUSTIFICACIÓN", "HORAS EXTRA",
            "CAMBIO DE TURNO", "CORRECCIÓN DE MARCA"};
    private static final String[] TYPE_LABELS = {"Permiso", "Vacaciones", "Justificar falta o tardanza",
            "Horas extra", "Cambio de turno", "Corregir una marcación"};

    private LinearLayout root, content;
    private TextView title;
    private String dni, key, name;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Mi espacio");
        root = Ui.screen(this);
        if (!Settings.cloudOn(this)) {
            Ui.add(root, Ui.text(this, "Esta opción necesita la conexión a la nube (Google Sheets). "
                    + "Pide al administrador que la configure.", 16, Ui.MUTED), 8);
            return;
        }
        showLogin();
    }

    private void showLogin() {
        root.removeAllViews();
        Ui.add(root, Ui.bold(this, "Consulta tus marcaciones y haz solicitudes", 18, Ui.TEXT), 4);
        EditText d = Ui.edit(this, "DNI", InputType.TYPE_CLASS_NUMBER);
        d.setFilters(new InputFilter[]{new InputFilter.LengthFilter(12)});
        Ui.add(root, d, 12);
        EditText k = Ui.edit(this, "Clave personal", InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        Ui.add(root, k, 4);
        Ui.add(root, Ui.text(this, "Si no te dieron una clave, usa los 4 últimos dígitos de tu DNI.", 13, Ui.MUTED), 4);
        Ui.add(root, Ui.button(this, "Ingresar", Ui.GREEN, v -> {
            String dd = d.getText().toString().trim(), kk = k.getText().toString().trim();
            if (dd.length() < 8 || kk.isEmpty()) { Ui.toast(this, "Ingresa tu DNI y tu clave."); return; }
            Ui.toast(this, "Consultando…");
            String[] nm = new String[1];
            Cloud.async(() -> Cloud.mySummary(this, dd, kk, 31, nm), (rows, err) -> {
                if (isFinishing()) return;
                if (err != null) { Ui.toast(this, err.getMessage()); return; }
                dni = dd; key = kk; name = nm[0];
                showHome();
                renderRecords(rows);
            });
        }), 16);
    }

    private void showHome() {
        root.removeAllViews();
        title = Ui.bold(this, name, 20, Ui.TEXT);
        Ui.add(root, title, 4);
        Ui.add(root, Ui.text(this, "DNI " + dni, 14, Ui.MUTED), 0);

        LinearLayout row = Ui.hbox(this);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMargins(Ui.dp(this, 3), 0, Ui.dp(this, 3), 0);
        Button b1 = Ui.button(this, "Mis marcas", Ui.BLUE, v -> loadRecords());
        Button b2 = Ui.button(this, "Solicitudes", Ui.GRAY, v -> loadRequests());
        b1.setTextSize(15);
        b2.setTextSize(15);
        row.addView(b1, lp);
        row.addView(b2, lp);
        Ui.add(root, row, 12);
        Ui.add(root, Ui.button(this, "+ Nueva solicitud", Ui.GREEN, v -> pickType()), 8);

        content = Ui.vbox(this);
        Ui.add(root, content, 8);
    }

    // ---------- Registro de asistencia ----------

    private void loadRecords() {
        info("Cargando…");
        Cloud.async(() -> Cloud.mySummary(this, dni, key, 31, null), (rows, err) -> {
            if (isFinishing()) return;
            if (err != null) { info("No se pudo cargar: " + err.getMessage()); return; }
            renderRecords(rows);
        });
    }

    private void renderRecords(List<Cloud.Row> rows) {
        content.removeAllViews();
        int late = 0, abs = 0, lateMin = 0;
        for (Cloud.Row r : rows) {
            if (r.tardanza > 0 && !r.tardanzaJustificada) { late++; lateMin += r.tardanza; }
            if (r.falta) abs++;
        }
        Ui.add(content, Ui.text(this, "Últimos 31 días · Tardanzas: " + late + " (" + lateMin + " min) · Faltas: " + abs,
                14, Ui.TEXT), 4);
        for (Cloud.Row r : rows) {
            LinearLayout c = (LinearLayout) Ui.card(this);
            LinearLayout top = Ui.hbox(this);
            top.addView(Ui.bold(this, r.fecha, 16, Ui.TEXT),
                    new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            int color = r.falta ? Ui.RED : r.tardanza > 0 && !r.tardanzaJustificada ? Ui.ORANGE
                    : r.asistio ? Ui.GREEN : Ui.MUTED;
            top.addView(Ui.bold(this, r.estado, 14, color));
            c.addView(top);
            StringBuilder s = new StringBuilder();
            if (!r.turno.isEmpty()) s.append(r.turno).append(r.horario.isEmpty() ? "" : " " + r.horario);
            if (!r.entrada.isEmpty()) s.append("\nEntrada ").append(r.entrada);
            if (!r.salida.isEmpty()) s.append("   ·   Salida ").append(r.salida);
            if (r.tardanza > 0) s.append("\nTardanza: ").append(r.tardanza).append(" min").append(r.tardanzaJustificada ? " (justificada)" : "");
            if (!r.trabajado.isEmpty()) s.append("\nHoras trabajadas: ").append(r.trabajado);
            if (!r.horasExtra.isEmpty()) s.append("\nHoras extra: ").append(r.horasExtra).append(" (").append(r.estadoHE).append(")");
            if (s.length() > 0) Ui.add(c, Ui.text(this, s.toString().trim(), 14, Ui.MUTED), 4);
            Ui.add(content, c, 8);
        }
    }

    // ---------- Solicitudes ----------

    private void loadRequests() {
        info("Cargando…");
        Cloud.async(() -> Cloud.myRequests(this, dni, key), (list, err) -> {
            if (isFinishing()) return;
            if (err != null) { info("No se pudo cargar: " + err.getMessage()); return; }
            content.removeAllViews();
            if (list.isEmpty()) { info("Aún no tienes solicitudes."); return; }
            for (Cloud.Request r : list) {
                LinearLayout c = (LinearLayout) Ui.card(this);
                LinearLayout top = Ui.hbox(this);
                top.addView(Ui.bold(this, r.tipo, 16, Ui.TEXT),
                        new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
                int color = "APROBADO".equals(r.estado) ? Ui.GREEN : "RECHAZADO".equals(r.estado) ? Ui.RED : Ui.ORANGE;
                top.addView(Ui.bold(this, r.estado, 14, color));
                c.addView(top);
                String s = (r.desde.equals(r.hasta) ? r.desde : r.desde + " al " + r.hasta)
                        + (r.detalle.isEmpty() ? "" : "\n" + r.detalle)
                        + "\nMotivo: " + r.motivo
                        + (r.respuesta.isEmpty() ? "" : "\nRespuesta: " + r.respuesta)
                        + "\nEnviada: " + r.fecha;
                Ui.add(c, Ui.text(this, s, 14, Ui.MUTED), 4);
                Ui.add(content, c, 8);
            }
        });
    }

    private void pickType() {
        new AlertDialog.Builder(this)
                .setTitle("¿Qué deseas solicitar?")
                .setItems(TYPE_LABELS, (d, i) -> requestForm(i))
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void requestForm(int typeIdx) {
        String type = TYPES[typeIdx];
        final LocalDate[] from = {LocalDate.now()};
        final LocalDate[] to = {LocalDate.now()};
        LinearLayout box = Ui.dialogBox(this);
        boolean range = "VACACIONES".equals(type) || "PERMISO".equals(type) || "CAMBIO DE TURNO".equals(type)
                || "JUSTIFICACIÓN".equals(type);

        Ui.add(box, Ui.text(this, range ? "Desde" : "Fecha", 14, Ui.MUTED), 0);
        Button bFrom = Ui.button(this, from[0].format(Calc.DAY_SHOW), Ui.GRAY, null);
        Ui.add(box, bFrom, 4);
        Button bTo = Ui.button(this, to[0].format(Calc.DAY_SHOW), Ui.GRAY, null);
        if (range) {
            Ui.add(box, Ui.text(this, "Hasta", 14, Ui.MUTED), 10);
            Ui.add(box, bTo, 4);
        }
        bFrom.setOnClickListener(v -> new DatePickerDialog(this, (dp, y, m, d) -> {
            from[0] = LocalDate.of(y, m + 1, d);
            bFrom.setText(from[0].format(Calc.DAY_SHOW));
            if (to[0].isBefore(from[0])) { to[0] = from[0]; bTo.setText(to[0].format(Calc.DAY_SHOW)); }
        }, from[0].getYear(), from[0].getMonthValue() - 1, from[0].getDayOfMonth()).show());
        bTo.setOnClickListener(v -> new DatePickerDialog(this, (dp, y, m, d) -> {
            to[0] = LocalDate.of(y, m + 1, d);
            bTo.setText(to[0].format(Calc.DAY_SHOW));
        }, to[0].getYear(), to[0].getMonthValue() - 1, to[0].getDayOfMonth()).show());

        String hint;
        switch (type) {
            case "PERMISO": hint = "Horario del permiso (ej. 10:00 a 12:00 o día completo)"; break;
            case "JUSTIFICACIÓN": hint = "¿Qué justificas? (falta o tardanza)"; break;
            case "HORAS EXTRA": hint = "Cantidad de horas (ej. 2 horas)"; break;
            case "CAMBIO DE TURNO": hint = "Nombre del turno que necesitas (ej. Noche)"; break;
            case "CORRECCIÓN DE MARCA": hint = "ENTRADA o SALIDA y la hora correcta (ej. ENTRADA 08:00)"; break;
            default: hint = "";
        }
        EditText detail = null;
        if (!hint.isEmpty()) {
            Ui.add(box, Ui.text(this, hint, 14, Ui.MUTED), 12);
            detail = Ui.edit(this, "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
            Ui.add(box, detail, 0);
        }
        Ui.add(box, Ui.text(this, "Motivo", 14, Ui.MUTED), 12);
        EditText reason = Ui.edit(this, "", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        reason.setSingleLine(false);
        reason.setMaxLines(4);
        Ui.add(box, reason, 0);

        final EditText fDetail = detail;
        android.widget.ScrollView sv = new android.widget.ScrollView(this);
        sv.addView(box);
        new AlertDialog.Builder(this)
                .setTitle(TYPE_LABELS[typeIdx])
                .setView(sv)
                .setPositiveButton("Enviar", (d, w) -> {
                    String det = fDetail == null ? "" : fDetail.getText().toString().trim();
                    String mot = reason.getText().toString().trim();
                    if (mot.isEmpty()) { Ui.toast(this, "Escribe el motivo."); return; }
                    if ("CORRECCIÓN DE MARCA".equals(type)
                            && !det.toUpperCase(Locale.ROOT).matches(".*(ENTRADA|SALIDA)\\D*\\d{1,2}:\\d{2}.*")) {
                        Ui.toast(this, "Escribe ENTRADA o SALIDA y la hora, por ejemplo: ENTRADA 08:00");
                        return;
                    }
                    if (!hint.isEmpty() && det.isEmpty() && !"PERMISO".equals(type)) {
                        Ui.toast(this, "Completa el detalle de la solicitud.");
                        return;
                    }
                    String f = from[0].format(Calc.DAY), t = (range ? to[0] : from[0]).format(Calc.DAY);
                    Ui.toast(this, "Enviando…");
                    Cloud.async(() -> { Cloud.sendRequest(this, dni, key, type, f, t, det, mot); return true; }, (ok, err) -> {
                        if (isFinishing()) return;
                        if (err != null) { Ui.toast(this, "No se pudo enviar: " + err.getMessage()); return; }
                        Ui.toast(this, "Solicitud enviada. Tu jefe la revisará.");
                        loadRequests();
                    });
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void info(String msg) {
        content.removeAllViews();
        TextView t = Ui.text(this, msg, 15, Ui.MUTED);
        t.setGravity(Gravity.CENTER);
        Ui.add(content, t, 12);
    }
}
