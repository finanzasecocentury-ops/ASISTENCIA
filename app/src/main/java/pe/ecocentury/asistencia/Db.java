package pe.ecocentury.asistencia;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import java.util.ArrayList;
import java.util.List;

/** Base de datos local (SQLite). */
public final class Db extends SQLiteOpenHelper {
    private static Db inst;

    public static synchronized Db get(Context c) {
        if (inst == null) inst = new Db(c.getApplicationContext());
        return inst;
    }

    private Db(Context c) { super(c, "asistencia.db", null, 4); }

    /** Sede de trabajo con su ubicación. lat/lng null si no se configuró. */
    public static final class Sede {
        public String name;
        public Double lat, lng;
        public int radius;
        public boolean validate;
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE workers(dni TEXT PRIMARY KEY, name TEXT NOT NULL)");
        db.execSQL("CREATE TABLE marks(id INTEGER PRIMARY KEY AUTOINCREMENT, dni TEXT NOT NULL, "
                + "name TEXT NOT NULL, type TEXT NOT NULL, ts INTEGER NOT NULL, day TEXT NOT NULL, photo TEXT, "
                + "synced INTEGER NOT NULL DEFAULT 0)");
        db.execSQL("CREATE INDEX idx_marks_day ON marks(day, dni)");
        onUpgrade(db, 2, 4);
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldV, int newV) {
        if (oldV < 2) db.execSQL("ALTER TABLE marks ADD COLUMN synced INTEGER NOT NULL DEFAULT 0");
        if (oldV < 3) {
            db.execSQL("ALTER TABLE workers ADD COLUMN sede TEXT");
            db.execSQL("ALTER TABLE workers ADD COLUMN shift TEXT");
            db.execSQL("ALTER TABLE workers ADD COLUMN start TEXT");
            db.execSQL("ALTER TABLE workers ADD COLUMN tol INTEGER NOT NULL DEFAULT -1");
            db.execSQL("ALTER TABLE workers ADD COLUMN workday INTEGER NOT NULL DEFAULT 1");
            db.execSQL("ALTER TABLE marks ADD COLUMN lat REAL");
            db.execSQL("ALTER TABLE marks ADD COLUMN lng REAL");
            db.execSQL("ALTER TABLE marks ADD COLUMN acc REAL");
            db.execSQL("ALTER TABLE marks ADD COLUMN dist INTEGER");
            db.execSQL("ALTER TABLE marks ADD COLUMN loc TEXT");
            db.execSQL("ALTER TABLE marks ADD COLUMN sede TEXT");
            db.execSQL("CREATE TABLE IF NOT EXISTS sedes(name TEXT PRIMARY KEY, lat REAL, lng REAL, "
                    + "radius INTEGER NOT NULL DEFAULT 200, validate INTEGER NOT NULL DEFAULT 0)");
        }
        if (oldV < 4) {
            // Última marca conocida en la nube (para que ENTRADA/SALIDA coincida con la web)
            db.execSQL("ALTER TABLE workers ADD COLUMN last_type TEXT");
            db.execSQL("ALTER TABLE workers ADD COLUMN last_ms INTEGER NOT NULL DEFAULT 0");
            db.execSQL("ALTER TABLE workers ADD COLUMN last_day TEXT");
            db.execSQL("ALTER TABLE workers ADD COLUMN area TEXT");
        }
    }

    // ---------- Trabajadores ----------




    private static final String WCOLS = "dni,name,sede,shift,start,tol,workday,last_type,last_ms,last_day,area";

    private static Calc.Worker readWorker(Cursor c) {
        Calc.Worker w = new Calc.Worker(c.getString(0), c.getString(1));
        w.sede = c.isNull(2) ? null : c.getString(2);
        w.shift = c.isNull(3) ? null : c.getString(3);
        w.start = c.isNull(4) ? null : c.getString(4);
        w.tol = (int) c.getLong(5);
        w.workday = c.getLong(6) != 0;
        w.lastType = c.isNull(7) ? null : c.getString(7);
        w.lastMs = c.getLong(8);
        w.lastDay = c.isNull(9) ? null : c.getString(9);
        w.area = c.isNull(10) ? null : c.getString(10);
        return w;
    }

    public Calc.Worker worker(String dni) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT " + WCOLS + " FROM workers WHERE dni=?", new String[]{dni})) {
            return c.moveToFirst() ? readWorker(c) : null;
        }
    }

    public List<Calc.Worker> workers() {
        List<Calc.Worker> out = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT " + WCOLS + " FROM workers ORDER BY name COLLATE NOCASE", null)) {
            while (c.moveToNext()) out.add(readWorker(c));
        }
        return out;
    }

    /** Reemplaza trabajadores y sedes con lo descargado de la nube. */
    public void replaceCloudData(List<Calc.Worker> ws, List<Sede> sedes) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("workers", null, null);
            for (Calc.Worker w : ws) {
                ContentValues v = new ContentValues();
                v.put("dni", w.dni);
                v.put("name", w.name);
                v.put("sede", w.sede);
                v.put("shift", w.shift);
                v.put("start", w.start);
                v.put("tol", (long) w.tol);
                v.put("workday", w.workday ? 1L : 0L);
                v.put("last_type", w.lastType);
                v.put("last_ms", w.lastMs);
                v.put("last_day", w.lastDay);
                v.put("area", w.area);
                db.insertWithOnConflict("workers", null, v, SQLiteDatabase.CONFLICT_REPLACE);
            }
            if (sedes != null) {
                db.delete("sedes", null, null);
                for (Sede s : sedes) {
                    ContentValues v = new ContentValues();
                    v.put("name", s.name);
                    v.put("lat", s.lat);
                    v.put("lng", s.lng);
                    v.put("radius", (long) s.radius);
                    v.put("validate", s.validate ? 1L : 0L);
                    db.insertWithOnConflict("sedes", null, v, SQLiteDatabase.CONFLICT_REPLACE);
                }
            }
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }

    public Sede sede(String name) {
        if (name == null || name.trim().isEmpty()) return null;
        try (Cursor c = getReadableDatabase().rawQuery(
                "SELECT name,lat,lng,radius,validate FROM sedes WHERE name=? COLLATE NOCASE", new String[]{name.trim()})) {
            if (!c.moveToFirst()) return null;
            Sede s = new Sede();
            s.name = c.getString(0);
            s.lat = c.isNull(1) ? null : c.getDouble(1);
            s.lng = c.isNull(2) ? null : c.getDouble(2);
            s.radius = (int) c.getLong(3);
            s.validate = c.getLong(4) != 0;
            return s;
        }
    }

    // ---------- Marcaciones ----------

    public long addMark(Calc.Mark m) {
        ContentValues v = new ContentValues();
        v.put("dni", m.dni);
        v.put("name", m.name);
        v.put("type", m.type);
        v.put("ts", m.ts);
        v.put("day", m.day);
        v.put("photo", m.photo);
        v.put("lat", m.lat);
        v.put("lng", m.lng);
        v.put("acc", m.acc == null ? null : (double) m.acc);
        v.put("dist", m.dist == null ? null : (long) m.dist);
        v.put("loc", m.loc);
        v.put("sede", m.sede);
        m.id = getWritableDatabase().insert("marks", null, v);
        return m.id;
    }

    private static final String COLS = "id,dni,name,type,ts,day,photo,lat,lng,acc,dist,loc,sede";

    private List<Calc.Mark> query(String sql, String[] args) {
        List<Calc.Mark> out = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery(sql, args)) {
            while (c.moveToNext()) {
                Calc.Mark m = new Calc.Mark();
                m.id = c.getLong(0);
                m.dni = c.getString(1);
                m.name = c.getString(2);
                m.type = c.getString(3);
                m.ts = c.getLong(4);
                m.day = c.getString(5);
                m.photo = c.isNull(6) ? null : c.getString(6);
                m.lat = c.isNull(7) ? null : c.getDouble(7);
                m.lng = c.isNull(8) ? null : c.getDouble(8);
                m.acc = c.isNull(9) ? null : (float) c.getDouble(9);
                m.dist = c.isNull(10) ? null : (int) c.getLong(10);
                m.loc = c.isNull(11) ? null : c.getString(11);
                m.sede = c.isNull(12) ? null : c.getString(12);
                out.add(m);
            }
        }
        return out;
    }

    public List<Calc.Mark> marksOf(String dni, String day) {
        return query("SELECT " + COLS + " FROM marks WHERE dni=? AND day=? ORDER BY ts", new String[]{dni, day});
    }

    public Calc.Mark lastMark(String dni) {
        List<Calc.Mark> l = query("SELECT " + COLS + " FROM marks WHERE dni=? ORDER BY ts DESC LIMIT 1", new String[]{dni});
        return l.isEmpty() ? null : l.get(0);
    }

    public List<Calc.Mark> marksBetween(String fromDay, String toDay) {
        return query("SELECT " + COLS + " FROM marks WHERE day>=? AND day<=? ORDER BY ts", new String[]{fromDay, toDay});
    }

    public List<Calc.Mark> pending(int limit) {
        return query("SELECT " + COLS + " FROM marks WHERE synced=0 ORDER BY ts LIMIT " + limit, null);
    }

    public int pendingCount() {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT COUNT(*) FROM marks WHERE synced=0", null)) {
            return c.moveToFirst() ? (int) c.getLong(0) : 0;
        }
    }

    public void setSynced(long id) {
        ContentValues v = new ContentValues();
        v.put("synced", 1L);
        getWritableDatabase().update("marks", v, "id=?", new String[]{String.valueOf(id)});
    }

    public List<Calc.Mark> recent(int limit) {
        return query("SELECT " + COLS + " FROM marks ORDER BY ts DESC LIMIT " + limit, null);
    }
}
