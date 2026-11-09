package pe.ecocentury.asistencia;

import java.io.IOException;
import java.io.OutputStream;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Arma el Excel de asistencia (Java puro). */
public final class Report {
    private Report() {}

    public static void write(OutputStream os, List<Calc.Worker> workers, List<Calc.Mark> marks,
                             Calc.Schedule s, LocalDate from, LocalDate to, LocalDateTime now) throws IOException {
        List<Calc.DayRow> rows = Calc.summarize(workers, marks, s, from, to, now, false);
        XlsxWriter x = new XlsxWriter();

        XlsxWriter.Sheet res = x.addSheet("Resumen diario", 12, 12, 30, 9, 9, 14, 12, 14, 22);
        res.row("Fecha", "DNI", "Nombre", "Entrada", "Salida", "Horas trabajadas", "Horas (h:mm)", "Tardanza (min)", "Estado");
        for (Calc.DayRow r : rows) {
            res.row(Calc.showDay(r.day), r.dni, r.name, Calc.fmtTime(r.in), Calc.fmtTime(r.out),
                    r.workedMin >= 0 ? (Object) Calc.hours(r.workedMin) : null,
                    Calc.fmtMin(r.workedMin), r.lateMin, r.status);
        }

        XlsxWriter.Sheet tot = x.addSheet("Totales", 12, 30, 14, 9, 11, 16, 16);
        tot.row("DNI", "Nombre", "Días asistidos", "Faltas", "Tardanzas", "Min. tardanza", "Horas trabajadas");
        for (Calc.Total t : Calc.totals(rows)) {
            tot.row(t.dni, t.name, t.days, t.absences, t.lates, t.lateMin, Calc.hours(t.workedMin));
        }

        // Tardanza solo en la primera entrada del día
        Map<String, Boolean> firstIn = new HashMap<>();
        XlsxWriter.Sheet det = x.addSheet("Marcaciones", 12, 10, 12, 30, 10, 14, 28);
        det.row("Fecha", "Hora", "DNI", "Nombre", "Tipo", "Tardanza (min)", "Foto");
        for (Calc.Mark m : marks) {
            Object late = null;
            if (Calc.IN.equals(m.type) && firstIn.put(m.day + "|" + m.dni, true) == null) {
                late = Calc.lateMinutes(Calc.toLocal(m.ts).toLocalTime().withSecond(0).withNano(0), s);
            }
            det.row(Calc.showDay(m.day), Calc.toLocal(m.ts).toLocalTime().format(Calc.HMS), m.dni, m.name,
                    m.type, late, m.photo == null ? "" : m.photo);
        }

        XlsxWriter.Sheet cfg = x.addSheet("Parámetros", 26, 22);
        cfg.row("Parámetro", "Valor");
        cfg.row("Desde", from.format(Calc.DAY_SHOW));
        cfg.row("Hasta", to.format(Calc.DAY_SHOW));
        cfg.row("Hora de entrada", Calc.fmtTime(s.start));
        cfg.row("Hora de salida", Calc.fmtTime(s.end));
        cfg.row("Tolerancia (min)", s.tolerance);
        cfg.row("Refrigerio descontado (min)", s.breakMin);
        cfg.row("Sábado laborable", s.saturdays ? "Sí" : "No");
        cfg.row("Generado", now.format(Calc.DAY_SHOW) + " " + now.toLocalTime().format(Calc.HM));

        x.write(os);
    }
}
