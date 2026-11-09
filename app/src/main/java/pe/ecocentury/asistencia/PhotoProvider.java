package pe.ecocentury.asistencia;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Proveedor mínimo para que la app de cámara guarde la foto en un archivo temporal de esta app
 * (equivalente a FileProvider, sin dependencias externas).
 */
public final class PhotoProvider extends ContentProvider {
    static final String AUTHORITY = "pe.ecocentury.asistencia.fotos";
    static final String TEMP_NAME = "captura.jpg";

    static Uri tempUri() { return Uri.parse("content://" + AUTHORITY + "/" + TEMP_NAME); }

    static File tempFile(android.content.Context c) {
        File dir = new File(c.getCacheDir(), "camara");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return new File(dir, TEMP_NAME);
    }

    static File photoDir(android.content.Context c) {
        File dir = new File(c.getFilesDir(), "fotos");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return dir;
    }

    @Override public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!TEMP_NAME.equals(uri.getLastPathSegment())) throw new FileNotFoundException(uri.toString());
        File f = tempFile(getContext());
        int m = ParcelFileDescriptor.parseMode(mode);
        if (mode.contains("w")) m |= ParcelFileDescriptor.MODE_CREATE;
        return ParcelFileDescriptor.open(f, m);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String sel, String[] args, String sort) {
        File f = tempFile(getContext());
        String[] cols = projection != null ? projection : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor c = new MatrixCursor(cols, 1);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = TEMP_NAME;
            else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = f.length();
        }
        c.addRow(row);
        return c;
    }

    @Override public String getType(Uri uri) { return "image/jpeg"; }
    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }

    // ---------- Utilidades de imagen ----------

    /** Carga una imagen reducida a maxPx y corrige la rotación EXIF. Devuelve null si falla. */
    static Bitmap loadScaled(File f, int maxPx) {
        if (f == null || !f.exists() || f.length() == 0) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(f.getAbsolutePath(), o);
        if (o.outWidth <= 0 || o.outHeight <= 0) return null;
        int sample = 1;
        while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= maxPx) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        Bitmap b = BitmapFactory.decodeFile(f.getAbsolutePath(), o2);
        if (b == null) return null;
        int deg = 0;
        try {
            int ori = new ExifInterface(f.getAbsolutePath())
                    .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            if (ori == ExifInterface.ORIENTATION_ROTATE_90) deg = 90;
            else if (ori == ExifInterface.ORIENTATION_ROTATE_180) deg = 180;
            else if (ori == ExifInterface.ORIENTATION_ROTATE_270) deg = 270;
        } catch (IOException ignored) { }
        float scale = Math.min(1f, (float) maxPx / Math.max(b.getWidth(), b.getHeight()));
        if (deg != 0 || scale < 1f) {
            Matrix mx = new Matrix();
            mx.postScale(scale, scale);
            mx.postRotate(deg);
            Bitmap r = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), mx, true);
            if (r != b) b.recycle();
            b = r;
        }
        return b;
    }

    static boolean saveJpeg(Bitmap b, File dest) {
        try (FileOutputStream fo = new FileOutputStream(dest)) {
            return b.compress(Bitmap.CompressFormat.JPEG, 85, fo);
        } catch (IOException e) {
            return false;
        }
    }
}
