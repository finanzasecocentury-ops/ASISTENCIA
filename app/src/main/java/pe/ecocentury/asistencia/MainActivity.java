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
    private TextView clock, date, hint;
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
        Ui.add(root, Ui.button(this, "Resumen de hoy", Ui.BLUE,
                v -> startActivity(new Intent(this, SummaryActivity.class))), 12);
        Ui.add(root, Ui.button(this, "Administración", Ui.GRAY,
                v -> Ui.askPin(this, () -> startActivity(new Intent(this, AdminActivity.class)))), 12);

        hint = Ui.text(this, "", 14, Ui.ORANGE);
        hint.setGravity(Gravity.CENTER);
        Ui.add(root, hint, 20);
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(tick);
        boolean noWorkers = Db.get(this).workers().isEmpty();
        hint.setText(noWorkers
                ? "Primero registra a los trabajadores en Administración."
                  + ("1234".equals(Settings.pin(this)) ? "\nPIN inicial: 1234" : "")
                : "");
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(tick);
    }
}
