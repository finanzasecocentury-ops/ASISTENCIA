package pe.ecocentury.asistencia;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView clock, date, hint, cloud;
    private static final DateTimeFormatter DATE_LONG =
            DateTimeFormatter.ofPattern("EEEE d 'de' MMMM 'de' yyyy", new Locale("es", "PE"));

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            LocalDateTime now = LocalDateTime.now();
            clock.setText(now.toLocalTime().format(Calc.HMS));
            String d = now.format(DATE_LONG);
            date.setText(d.substring(0, 1).toUpperCase(Locale.ROOT) + d.substring(1));
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        LinearLayout root = Ui.screen(this);

        TextView title = Ui.bold(this, "Control de Asistencia", 26, Ui.GREEN);
        title.setGravity(Gravity.CENTER);
        Ui.add(root, title, 8);
        TextView sub = Ui.text(this, "Ecocentury", 16, Ui.MUTED);
        sub.setGravity(Gravity.CENTER);
        Ui.add(root, sub, 0);

        LinearLayout card = (LinearLayout) Ui.card(this);
        clock = Ui.bold(this, "", 48, Ui.TEXT);
        clock.setGravity(Gravity.CENTER);
        date = Ui.text(this, "", 16, Ui.MUTED);
        date.setGravity(Gravity.CENTER);
        card.addView(clock);
        card.addView(date);
        Ui.add(root, card, 20);

        Ui.add(root, Ui.button(this, "Marcar asistencia", Ui.GREEN,
                v -> startActivity(new Intent(this, MarkActivity.class))), 24);
        Ui.add(root, Ui.button(this, "Mi espacio (mis marcas y solicitudes)", Ui.BLUE,
                v -> startActivity(new Intent(this, MySpaceActivity.class))), 12);
        Ui.add(root, Ui.button(this, "Resumen del día (supervisor)", Ui.GRAY,
                v -> Ui.askPin(this, () -> startActivity(new Intent(this, SummaryActivity.class)))), 12);
        Ui.add(root, Ui.button(this, "Administración", Ui.GRAY,
                v -> Ui.askPin(this, () -> startActivity(new Intent(this, AdminActivity.class)))), 12);

        hint = Ui.text(this, "", 14, Ui.ORANGE);
        hint.setGravity(Gravity.CENTER);
        Ui.add(root, hint, 20);

        cloud = Ui.text(this, "", 13, Ui.MUTED);
        cloud.setGravity(Gravity.CENTER);
        Ui.add(root, cloud, 12);
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(tick);
        refreshHint();
        if (Settings.cloudOn(this)) {
            cloud.setText("Nube: sincronizando…");
            Cloud.syncAsync(this, (msg, err) -> {
                if (isFinishing()) return;
                refreshHint();
                int pend = Db.get(this).pendingCount();
                if (err != null) {
                    cloud.setText("Nube: no se pudo sincronizar (" + err.getMessage() + ")"
                            + (pend > 0 ? "\n" + pend + " marcación(es) por enviar. Se enviarán cuando haya internet." : ""));
                } else {
                    cloud.setText("Nube: conectado · " + msg + " · " + Settings.lastSync(this));
                }
            });
        } else {
            cloud.setText("Modo sin nube: los datos quedan en este celular.");
        }
    }

    private void refreshHint() {
        boolean noWorkers = Db.get(this).workers().isEmpty();
        String h = "";
        if (noWorkers) {
            h = Settings.cloudOn(this)
                    ? "No hay trabajadores. Regístralos en la hoja \"Trabajadores\" de Google Sheets."
                    : "Primero registra a los trabajadores en Administración."
                      + ("1234".equals(Settings.pin(this)) ? "\nPIN inicial: 1234" : "");
        }
        hint.setText(h);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(tick);
    }
}
