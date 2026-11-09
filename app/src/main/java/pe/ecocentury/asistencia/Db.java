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

    private Db(Context c) { super(c, "asistencia.db", null, 1); }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE workers(dni TEXT PRIMARY KEY, name TEXT NOT NULL)");
        db.execSQL("CREATE TABLE marks(id INTEGER PRIMARY KEY AUTOINCREMENT, dni TEXT NOT NULL, "
                + "name TEXT NOT NULL, type TEXT NOT NULL, ts INTEGER NOT NULL, day TEXT NOT NULL, photo TEXT)");
        db.execSQL("CREATE INDEX idx_marks_day ON marks(day, dni)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldV, int newV) { }

    // ---------- Trabajadores ----------

    public boolean addWorker(String dni, String name) {
        ContentValues v = new ContentValues();
        v.put("dni", dni);
        v.put("name", name);
        return getWritableDatabase().insert("workers", null, v) != -1;
    }

    public void updateWorker(String dni, String name) {
        ContentValues v = new ContentValues();
        v.put("name", name);
        getWritableDatabase().update("workers", v, "dni=?", new String[]{dni});
    }

    public void deleteWorker(String dni) {
        getWritableDatabase().delete("workers", "dni=?", new String[]{dni});
    }

    public Calc.Worker worker(String dni) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT dni,name FROM workers WHERE dni=?", new String[]{dni})) {
            return c.moveToFirst() ? new Calc.Worker(c.getString(0), c.getString(1)) : null;
        }
    }

    public List<Calc.Worker> workers() {
        List<Calc.Worker> out = new ArrayList<>();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT dni,name FROM workers ORDER BY name COLLATE NOCASE", null)) {
            while (c.moveToNext()) out.add(new Calc.Worker(c.getString(0), c.getString(1)));
        }
        return out;
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
        m.id = getWritableDatabase().insert("marks", null, v);
        return m.id;
    }

    private static final String COLS = "id,dni,name,type,ts,day,photo";

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
                out.add(m);
            }
        }
        return out;
    }

    public List<Calc.Mark> marksOf(String dni, String day) {
        return query("SELECT " + COLS + " FROM marks WHERE dni=? AND day=? ORDER BY ts", new String[]{dni, day});
    }

    public List<Calc.Mark> marksBetween(String fromDay, String toDay) {
        return query("SELECT " + COLS + " FROM marks WHERE day>=? AND day<=? ORDER BY ts", new String[]{fromDay, toDay});
    }

    public List<Calc.Mark> recent(int limit) {
        return query("SELECT " + COLS + " FROM marks ORDER BY ts DESC LIMIT " + limit, null);
    }
}
