package pe.ecocentury.asistencia;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Configuración de la conexión con Google Sheets.
 * Aparece sola la primera vez; después solo el administrador general la abre desde su menú.
 */
public class SetupActivity extends Activity {
    static final String EXTRA_FIRST = "first";

    private EditText url, key;
    private TextView status;
    private Button save;
    private boolean first;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        first = getIntent().getBooleanExtra(EXTRA_FIRST, false);
        setTitle(first ? "Configuración inicial" : "Conexión de este celular");
        LinearLayout root = Ui.screen(this);

        TextView title = Ui.bold(this, first ? "Bienvenido" : "Conexión con Google Sheets", 22, Ui.GREEN);
        Ui.add(root, title, 4);
        Ui.add(root, Ui.text(this, first
                ? "Este celular aún no está conectado al sistema. Pide al administrador la URL (termina en /exec) y la clave del servidor."
                : "Cambia la URL o la clave solo si el administrador del sistema te lo indica.", 15, Ui.MUTED), 8);

        Ui.add(root, Ui.text(this, "URL de la aplicación web", 14, Ui.MUTED), 16);
        url = Ui.edit(this, "https://script.google.com/macros/s/…/exec", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        url.setSingleLine(false);
        url.setMaxLines(4);
        url.setTextSize(15);
        url.setText(Settings.cloudUrl(this));
        Ui.add(root, url, 4);

        Ui.add(root, Ui.text(this, "Clave del servidor", 14, Ui.MUTED), 12);
        key = Ui.edit(this, "Clave", InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        key.setText(Settings.cloudKey(this));
        Ui.add(root, key, 4);

        save = Ui.button(this, "Probar y guardar", Ui.GREEN, v -> testAndSave());
        Ui.add(root, save, 20);
        status = Ui.text(this, "", 15, Ui.MUTED);
        status.setGravity(Gravity.CENTER);
        Ui.add(root, status, 12);
        if (!first) Ui.add(root, Ui.button(this, "Cancelar", Ui.GRAY, v -> finish()), 12);
    }

    private void testAndSave() {
        String u = url.getText().toString().trim();
        String k = key.getText().toString();
        if (!u.startsWith("https://")) { status.setTextColor(Ui.RED); status.setText("La URL debe empezar con https://"); return; }
        if (k.isEmpty()) { status.setTextColor(Ui.RED); status.setText("Escribe la clave del servidor."); return; }
        save.setEnabled(false);
        status.setTextColor(Ui.MUTED);
        status.setText("Probando conexión…");
        Cloud.async(() -> Cloud.test(this, u, k), (n, err) -> {
            if (isFinishing()) return;
            save.setEnabled(true);
            if (err != null) {
                status.setTextColor(Ui.RED);
                status.setText("No se pudo conectar: " + err.getMessage());
                return;
            }
            Settings.saveCloud(this, u, k);
            Ui.toast(this, "Conectado. " + n + " trabajador(es) descargado(s).");
            if (first) {
                startActivity(new Intent(this, MainActivity.class));
            }
            finish();
        });
    }
}
