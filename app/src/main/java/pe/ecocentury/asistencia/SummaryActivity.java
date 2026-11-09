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

/** Resumen del día: quién marcó, quién llegó tarde y quién faltó. */
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
            TextView name = Ui.bold(this, r.name, 17, Ui.TEXT);
            top.addView(name, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
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
            String msg = Db.get(this).workers().isEmpty() ? "No hay trabajadores registrados."
                    : s.isWorkday(day) ? "Sin registros para este día." : "Día no laborable, sin marcaciones.";
            TextView t = Ui.text(this, msg, 16, Ui.MUTED);
            t.setGravity(Gravity.CENTER);
            Ui.add(list, t, 16);
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
