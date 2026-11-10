package pe.ecocentury.asistencia;

import android.app.Activity;
import android.app.DatePickerDialog;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Resumen del día: quién está trabajando, quién llegó tarde y quién faltó. */
public class SummaryActivity extends Activity {
    private LocalDate day = LocalDate.now();
    private LinearLayout list;
    private TextView header, counters;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Resumen del día");
        if (b != null && b.getString("day") != null) day = LocalDate.parse(b.getString("day"), Calc.DAY);
        LinearLayout root = Ui.screen(this);

        header = Ui.bold(this, "", 20, Ui.TEXT);
        header.setGravity(Gravity.CENTER);
        Ui.add(root, header, 4);

        LinearLayout nav = Ui.hbox(this);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMargins(Ui.dp(this, 4), 0, Ui.dp(this, 4), 0);
        nav.addView(Ui.button(this, "◀", Ui.GRAY, v -> { day = day.minusDays(1); load(); }), lp);
        nav.addView(Ui.button(this, "Fecha", Ui.GRAY, v -> pickDate()), lp);
        nav.addView(Ui.button(this, "▶", Ui.GRAY, v -> { day = day.plusDays(1); load(); }), lp);
        Ui.add(root, nav, 10);

        counters = Ui.text(this, "", 16, Ui.TEXT);
        counters.setGravity(Gravity.CENTER);
        Ui.add(root, counters, 12);

        list = Ui.vbox(this);
        Ui.add(root, list, 8);
    }

    @Override
    protected void onResume() {
        super.onResume();
        load();
    }

    private void pickDate() {
        new DatePickerDialog(this, (dp, y, m, d) -> { day = LocalDate.of(y, m + 1, d); load(); },
                day.getYear(), day.getMonthValue() - 1, day.getDayOfMonth()).show();
    }

    private void load() {
        header.setText((day.equals(LocalDate.now()) ? "Hoy, " : "") + day.format(Calc.DAY_SHOW));
        String ds = day.format(Calc.DAY);
        if (!Settings.cloudOn(this)) { renderLocal(ds); return; }

        list.removeAllViews();
        counters.setText("Cargando datos de todos los celulares…");
        final LocalDate requested = day;
        Cloud.async(() -> Cloud.summary(this, ds), (rows, err) -> {
            if (isFinishing() || !requested.equals(day)) return;
            if (err != null) {
                renderLocal(ds);
                counters.setText(counters.getText() + "\nSin conexión: solo se muestran las marcaciones de este celular.");
            } else {
                renderCloud(rows);
            }
        });
    }

    // ---------- Datos de la nube (calculados en la hoja con turnos, permisos, etc.) ----------

    private void renderCloud(List<Cloud.Row> rows) {
        int working = 0, present = 0, late = 0, absent = 0, pending = 0;
        list.removeAllViews();
        String lastSede = null;
        for (Cloud.Row r : rows) {
            if (r.enJornada) working++;
            if (r.asistio) present++;
            if (r.tardanza > 0 && !r.tardanzaJustificada) late++;
            if (r.falta) absent++;
            if ("Pendiente".equals(r.estado)) pending++;

            String sede = r.sede.isEmpty() ? "(sin sede)" : r.sede;
            if (!sede.equals(lastSede)) {
                Ui.add(list, Ui.bold(this, sede, 15, Ui.GREEN), 16);
                lastSede = sede;
            }
            LinearLayout c = (LinearLayout) Ui.card(this);
            LinearLayout top = Ui.hbox(this);
            top.addView(Ui.bold(this, r.nombre, 17, Ui.TEXT),
                    new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            top.addView(Ui.bold(this, r.estado, 14, colorFor(r)));
            c.addView(top);
            StringBuilder det = new StringBuilder("DNI " + r.dni);
            if (!r.turno.isEmpty()) det.append("   ·   ").append(r.turno).append(r.horario.isEmpty() ? "" : " " + r.horario);
            if (!r.entrada.isEmpty()) det.append("\nEntrada ").append(r.entrada);
            if (!r.salida.isEmpty()) det.append("   ·   Salida ").append(r.salida);
            if (r.tardanza > 0) det.append("\nTardanza: ").append(r.tardanza).append(" min").append(r.tardanzaJustificada ? " (justificada)" : "");
            if (!r.trabajado.isEmpty()) det.append("\nHoras trabajadas: ").append(r.trabajado);
            if (!r.horasExtra.isEmpty()) det.append("\nHoras extra: ").append(r.horasExtra).append(" (").append(r.estadoHE).append(")");
            Ui.add(c, Ui.text(this, det.toString(), 14, Ui.MUTED), 4);
            if (!r.alerta.isEmpty()) Ui.add(c, Ui.text(this, "⚠ " + r.alerta, 13, Ui.RED), 4);
            Ui.add(list, c, 8);
        }
        if (rows.isEmpty()) empty("Sin registros para este día.");
        String cnt = "Trabajando ahora: " + working + "   Asistieron: " + present
                + "\nTardanzas: " + late + "   Faltas: " + absent + (pending > 0 ? "   Pendientes: " + pending : "")
                + "\nDatos de todos los celulares (Google Sheets)";
        counters.setText(cnt);
    }

    private static int colorFor(Cloud.Row r) {
        if (r.falta || r.estado.startsWith("Sin entrada")) return Ui.RED;
        if (r.estado.startsWith("Tarde") && !r.tardanzaJustificada) return Ui.ORANGE;
        if (r.estado.startsWith("Puntual") || r.estado.startsWith("Trabajó")) return Ui.GREEN;
        return Ui.MUTED;
    }

    private void empty(String msg) {
        TextView t = Ui.text(this, msg, 16, Ui.MUTED);
        t.setGravity(Gravity.CENTER);
        Ui.add(list, t, 16);
    }

    // ---------- Solo este celular ----------

    private void renderLocal(String ds) {
        Calc.Schedule s = Settings.schedule(this);
        List<Calc.DayRow> rows = Calc.summarize(Db.get(this).workers(), Db.get(this).marksBetween(ds, ds),
                s, day, day, LocalDateTime.now(), true);
        int present = 0, late = 0, absent = 0, pending = 0;
        list.removeAllViews();
        for (Calc.DayRow r : rows) {
            if (r.absent) absent++;
            else if (r.pending) pending++;
            else if (r.in != null) present++;
            if (r.lateMin > 0) late++;

            LinearLayout c = (LinearLayout) Ui.card(this);
            LinearLayout top = Ui.hbox(this);
            top.addView(Ui.bold(this, r.name, 17, Ui.TEXT),
                    new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            int color = r.absent ? Ui.RED : r.pending ? Ui.MUTED : r.lateMin > 0 ? Ui.ORANGE : Ui.GREEN;
            top.addView(Ui.bold(this, r.status, 15, color));
            c.addView(top);
            String det = "DNI " + r.dni;
            if (r.in != null) det += "   ·   Entrada " + Calc.fmtTime(r.in);
            if (r.out != null) det += "   ·   Salida " + Calc.fmtTime(r.out);
            if (r.lateMin > 0) det += "\nTardanza: " + r.lateMin + " min";
            if (r.workedMin >= 0) det += "\nHoras trabajadas: " + Calc.fmtMin(r.workedMin);
            Ui.add(c, Ui.text(this, det, 14, Ui.MUTED), 4);
            Ui.add(list, c, 8);
        }
        if (rows.isEmpty()) {
            empty(Db.get(this).workers().isEmpty() ? "No hay trabajadores registrados."
                    : s.isWorkday(day) ? "Sin registros para este día." : "Día no laborable, sin marcaciones.");
        }
        String cnt = "Asistieron: " + present + "   Tardanzas: " + late + "   Faltas: " + absent;
        if (pending > 0) cnt += "   Pendientes: " + pending;
        counters.setText(cnt);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString("day", day.format(Calc.DAY));
    }
}
