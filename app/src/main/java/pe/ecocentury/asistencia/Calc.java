package pe.ecocentury.asistencia;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Lógica de asistencia (Java puro, sin dependencias de Android). */
public final class Calc {
    private Calc() {}

    public static final String IN = "ENTRADA";
    public static final String OUT = "SALIDA";

    public static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    public static final DateTimeFormatter DAY_SHOW = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    public static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");
    public static final DateTimeFormatter HM_PARSE = DateTimeFormatter.ofPattern("H:mm");
    public static final DateTimeFormatter HMS = DateTimeFormatter.ofPattern("HH:mm:ss");

    public static final class Worker {
        public final String dni;
        public final String name;
        /** Datos que llegan de la nube (pueden ser null en modo sin nube). */
        public String sede, shift, start, area;
        public int tol = -1;
        public boolean workday = true;
        /** Última marca registrada en la nube (desde cualquier celular o la web). */
        public String lastType, lastDay;
        public long lastMs;
        public Worker(String dni, String name) { this.dni = dni; this.name = name; }
    }

    public static final class Mark {
        public long id;
        public String dni, name, type, day, photo;
        public long ts;
        /** Ubicación: loc = DENTRO, FUERA, SIN GPS, FALSA o SIN SEDE. */
        public Double lat, lng;
        public Float acc;
        public Integer dist;
        public String loc, sede;
        public Mark() {}
        public Mark(String dni, String name, String type, long ts, String photo) {
            this.dni = dni; this.name = name; this.type = type; this.ts = ts; this.photo = photo;
            this.day = dayOf(ts);
        }
    }

    public static final class Schedule {
        public LocalTime start = LocalTime.of(8, 0);
        public LocalTime end = LocalTime.of(17, 0);
        public int tolerance = 10;   // minutos de tolerancia
        public int breakMin = 0;     // minutos de refrigerio que se descuentan
        public boolean saturdays = false;

        public boolean isWorkday(LocalDate d) {
            DayOfWeek w = d.getDayOfWeek();
            if (w == DayOfWeek.SUNDAY) return false;
            if (w == DayOfWeek.SATURDAY) return saturdays;
            return true;
        }
    }

    public static final class DayRow {
        public String day, dni, name, status;
        public LocalTime in, out;
        public long workedMin = -1;
        public long lateMin;
        public boolean absent, pending;
    }

    public static final class Total {
        public String dni, name;
        public int days, absences, lates;
        public long lateMin, workedMin;
    }

    public static LocalDateTime toLocal(long ts) {
        return LocalDateTime.ofInstant(Instant.ofEpochMilli(ts), ZoneId.systemDefault());
    }

    public static String dayOf(long ts) { return toLocal(ts).toLocalDate().format(DAY); }

    /** Siguiente tipo de marcación según las marcas del día (ordenadas por hora). */
    public static String nextType(List<Mark> marksSortedAsc) {
        if (marksSortedAsc == null || marksSortedAsc.isEmpty()) return IN;
        return IN.equals(marksSortedAsc.get(marksSortedAsc.size() - 1).type) ? OUT : IN;
    }

    /** Horas máximas que puede durar una jornada abierta para que la siguiente marca sea SALIDA. */
    public static final long MAX_SHIFT_MS = 16L * 60 * 60 * 1000;

    /**
     * Decide tipo y día de jornada de una nueva marca a partir de la última marca del trabajador.
     * Devuelve {tipo, día}. Si hay una ENTRADA abierta de menos de 16 h, es SALIDA de esa jornada.
     */
    /** Igual que nextTypeAndDay pero considerando también la última marca conocida en la nube. */
    public static String[] nextTypeAndDay(Mark localLast, Worker w, long now) {
        Mark last = localLast;
        if (w != null && w.lastMs > 0 && w.lastType != null && (last == null || w.lastMs > last.ts)) {
            Mark r = new Mark();
            r.type = w.lastType;
            r.ts = w.lastMs;
            r.day = w.lastDay != null && !w.lastDay.isEmpty() ? w.lastDay : dayOf(w.lastMs);
            last = r;
        }
        return nextTypeAndDay(last, now);
    }

    public static String[] nextTypeAndDay(Mark last, long now) {
        if (last != null && IN.equals(last.type) && now - last.ts >= 0 && now - last.ts < MAX_SHIFT_MS) {
            return new String[]{OUT, last.day};
        }
        return new String[]{IN, dayOf(now)};
    }

    /** Minutos de tardanza: se cuentan desde la hora de entrada si se supera la tolerancia. */
    public static long lateMinutes(LocalTime in, Schedule s) {
        if (in == null) return 0;
        long d = Duration.between(s.start, in).toMinutes();
        return d > s.tolerance ? d : 0;
    }

    static DayRow build(String day, String dni, String name, List<Mark> ms, Schedule s) {
        DayRow r = new DayRow();
        r.day = day; r.dni = dni; r.name = name;
        for (Mark m : ms) {
            LocalTime t = toLocal(m.ts).toLocalTime().withSecond(0).withNano(0);
            if (IN.equals(m.type)) {
                if (r.in == null) r.in = t;
            } else {
                r.out = t;
            }
        }
        if (r.in != null && r.out != null) {
            long raw = Duration.between(r.in, r.out).toMinutes();
            if (raw < 0) raw += 24 * 60; // turno que cruza medianoche
            r.workedMin = Math.max(0, raw - s.breakMin);
        }
        r.lateMin = lateMinutes(r.in, s);
        if (r.in == null) {
            r.status = "Sin entrada";
        } else {
            r.status = r.lateMin > 0 ? "Tarde" : "Puntual";
            if (r.out == null) r.status += " (sin salida)";
        }
        return r;
    }

    /**
     * Resumen por día y trabajador entre dos fechas (incluye faltas en días laborables).
     * @param marks marcas del rango, ordenadas por hora
     * @param includePending si es true, para hoy muestra "Pendiente" a quien aún está en hora
     */
    public static List<DayRow> summarize(List<Worker> workers, List<Mark> marks, Schedule s,
                                         LocalDate from, LocalDate to, LocalDateTime now,
                                         boolean includePending) {
        Map<String, List<Mark>> byKey = new HashMap<>();
        Map<String, Worker> all = new LinkedHashMap<>();
        Set<String> current = new HashSet<>();
        for (Worker w : workers) { all.put(w.dni, w); current.add(w.dni); }
        for (Mark m : marks) {
            byKey.computeIfAbsent(m.day + "|" + m.dni, k -> new ArrayList<>()).add(m);
            if (!all.containsKey(m.dni)) all.put(m.dni, new Worker(m.dni, m.name));
        }
        LocalDate today = now.toLocalDate();
        LocalTime limit = s.start.plusMinutes(s.tolerance);
        List<DayRow> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            String ds = d.format(DAY);
            for (Worker w : all.values()) {
                List<Mark> ms = byKey.get(ds + "|" + w.dni);
                if (ms != null) {
                    out.add(build(ds, w.dni, w.name, ms, s));
                } else if (current.contains(w.dni) && s.isWorkday(d) && !d.isAfter(today)) {
                    boolean stillOnTime = d.equals(today) && !now.toLocalTime().isAfter(limit);
                    if (stillOnTime && !includePending) continue;
                    DayRow r = new DayRow();
                    r.day = ds; r.dni = w.dni; r.name = w.name;
                    if (stillOnTime) { r.pending = true; r.status = "Pendiente"; }
                    else { r.absent = true; r.status = "Falta"; }
                    out.add(r);
                }
            }
        }
        return out;
    }

    public static List<Total> totals(List<DayRow> rows) {
        Map<String, Total> map = new LinkedHashMap<>();
        for (DayRow r : rows) {
            Total t = map.get(r.dni);
            if (t == null) { t = new Total(); t.dni = r.dni; t.name = r.name; map.put(r.dni, t); }
            if (r.absent) t.absences++;
            else if (r.in != null) t.days++;
            if (r.lateMin > 0) { t.lates++; t.lateMin += r.lateMin; }
            if (r.workedMin > 0) t.workedMin += r.workedMin;
        }
        return new ArrayList<>(map.values());
    }

    public static String fmtTime(LocalTime t) { return t == null ? "" : t.format(HM); }

    public static String fmtMin(long m) {
        if (m < 0) return "";
        return String.format(Locale.US, "%d:%02d", m / 60, m % 60);
    }

    public static double hours(long m) { return m < 0 ? 0 : Math.round(m / 60.0 * 100) / 100.0; }

    public static String showDay(String day) {
        try { return LocalDate.parse(day, DAY).format(DAY_SHOW); } catch (Exception e) { return day; }
    }
}
