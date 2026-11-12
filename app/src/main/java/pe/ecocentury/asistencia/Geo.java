package pe.ecocentury.asistencia;

import android.annotation.SuppressLint;
import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/** Obtiene una ubicación con GPS (funciona sin internet) usando solo el sistema Android. */
final class Geo {
    private Geo() {}

    interface Callback { void done(Location loc); }

    static final String DENTRO = "DENTRO", FUERA = "FUERA", SIN_GPS = "SIN GPS", FALSA = "FALSA", SIN_SEDE = "SIN SEDE";

    static boolean enabled(Context c) {
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        try {
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) {
            return false;
        }
    }

    static boolean isMock(Location l) {
        if (l == null) return false;
        if (Build.VERSION.SDK_INT >= 31) return l.isMock();
        //noinspection deprecation
        return l.isFromMockProvider();
    }

    /**
     * Busca la ubicación hasta timeoutMs. Devuelve la primera con precisión <= 50 m,
     * o la mejor encontrada al vencer el tiempo (o null). Requiere permiso concedido.
     */
    @SuppressLint("MissingPermission")
    static void get(Context c, long timeoutMs, Callback cb) {
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        Handler h = new Handler(Looper.getMainLooper());
        if (lm == null) { h.post(() -> cb.done(null)); return; }

        final Location[] best = {null};
        final boolean[] finished = {false};

        // Ubicación reciente (menos de 1 minuto y buena precisión): se usa directamente
        for (String p : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && System.currentTimeMillis() - l.getTime() < 60_000 && l.getAccuracy() <= 50) {
                    Location fl = l;
                    h.post(() -> cb.done(fl));
                    return;
                }
            } catch (Exception ignored) { }
        }

        LocationListener listener = new LocationListener() {
            @Override public void onLocationChanged(Location l) {
                if (finished[0] || l == null) return;
                if (best[0] == null || l.getAccuracy() < best[0].getAccuracy()) best[0] = l;
                if (l.getAccuracy() <= 50) finish();
            }
            // Métodos requeridos en Android 8-10
            @Override public void onStatusChanged(String p, int s, Bundle b) { }
            @Override public void onProviderEnabled(String p) { }
            @Override public void onProviderDisabled(String p) { }

            void finish() {
                if (finished[0]) return;
                finished[0] = true;
                try { lm.removeUpdates(this); } catch (Exception ignored) { }
                cb.done(best[0]);
            }
        };

        boolean any = false;
        for (String p : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            try {
                if (lm.isProviderEnabled(p)) {
                    lm.requestLocationUpdates(p, 1000, 0f, listener, Looper.getMainLooper());
                    any = true;
                }
            } catch (Exception ignored) { }
        }
        if (!any) { h.post(() -> cb.done(null)); return; }
        h.postDelayed(() -> {
            if (finished[0]) return;
            finished[0] = true;
            try { lm.removeUpdates(listener); } catch (Exception ignored) { }
            cb.done(best[0]);
        }, timeoutMs);
    }

    /** Distancia en metros entre dos puntos. */
    static int distance(double lat1, double lng1, double lat2, double lng2) {
        float[] r = new float[1];
        Location.distanceBetween(lat1, lng1, lat2, lng2, r);
        return Math.round(r[0]);
    }
}
