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

/** Pantalla inicial: solo "Marcar asistencia" e "Iniciar sesión". */
public class MainActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView clock, date, notice, cloud;
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
        if (!Settings.cloudOn(this)) {
            startActivity(new Intent(this, SetupActivity.class).putExtra(SetupActivity.EXTRA_FIRST, true));
            finish();
            return;
        }
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

        notice = Ui.text(this, "", 15, Ui.ORANGE);
        notice.setGravity(Gravity.CENTER);
        Ui.add(root, notice, 12);

        Ui.add(root, Ui.button(this, "Marcar asistencia", Ui.GREEN,
                v -> startActivity(new Intent(this, MarkActivity.class))), 16);
        Ui.add(root, Ui.button(this, "Iniciar sesión", Ui.BLUE,
                v -> startActivity(new Intent(this, PortalActivity.class))), 12);
        TextView hint = Ui.text(this, "Inicia sesión para ver tus marcas, hacer solicitudes o administrar.", 14, Ui.MUTED);
        hint.setGravity(Gravity.CENTER);
        Ui.add(root, hint, 8);

        cloud = Ui.text(this, "", 13, Ui.MUTED);
        cloud.setGravity(Gravity.CENTER);
        Ui.add(root, cloud, 24);
        showNotice(getIntent());
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        showNotice(i);
    }

    private void showNotice(Intent i) {
        String msg = i != null ? i.getStringExtra(PortalActivity.EXTRA_MESSAGE) : null;
        if (notice != null) notice.setText(msg == null ? "" : msg);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (clock == null) return;
        handler.post(tick);
        cloud.setText("Sincronizando…");
        Cloud.syncAsync(this, (msg, err) -> {
            if (isFinishing()) return;
            int pend = Db.get(this).pendingCount();
            if (err != null) {
                cloud.setText("Sin conexión con la nube (" + err.getMessage() + ")"
                        + (pend > 0 ? "\n" + pend + " marcación(es) por enviar. Se enviarán cuando haya internet." : ""));
            } else {
                cloud.setText("Conectado · " + msg + " · " + Settings.lastSync(this));
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(tick);
    }
}
