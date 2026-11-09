package pe.ecocentury.asistencia;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.File;
import java.util.List;

/** Últimas marcaciones; al tocar una se ve la foto. */
public class HistoryActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Historial de marcaciones");
        LinearLayout root = Ui.screen(this);
        List<Calc.Mark> ms = Db.get(this).recent(300);
        Ui.add(root, Ui.text(this, ms.isEmpty() ? "Aún no hay marcaciones."
                : "Últimas " + ms.size() + " marcaciones. Toca una para ver la foto.", 14, Ui.MUTED), 0);
        for (Calc.Mark m : ms) {
            LinearLayout c = (LinearLayout) Ui.card(this);
            LinearLayout top = Ui.hbox(this);
            TextView n = Ui.bold(this, m.name, 16, Ui.TEXT);
            top.addView(n, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
            top.addView(Ui.bold(this, m.type, 14, Calc.IN.equals(m.type) ? Ui.GREEN : Ui.BLUE));
            c.addView(top);
            c.addView(Ui.text(this, Calc.showDay(m.day) + "  " + Calc.toLocal(m.ts).toLocalTime().format(Calc.HMS)
                    + "   ·   DNI " + m.dni, 14, Ui.MUTED));
            c.setOnClickListener(v -> showPhoto(m));
            Ui.add(root, c, 8);
        }
    }

    private void showPhoto(Calc.Mark m) {
        Bitmap bmp = m.photo == null ? null
                : PhotoProvider.loadScaled(new File(PhotoProvider.photoDir(this), m.photo), 1000);
        AlertDialog.Builder d = new AlertDialog.Builder(this)
                .setTitle(m.name + " · " + m.type)
                .setPositiveButton("Cerrar", null);
        if (bmp == null) {
            d.setMessage("Esta marcación no tiene foto.");
        } else {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(bmp);
            iv.setAdjustViewBounds(true);
            int p = Ui.dp(this, 12);
            iv.setPadding(p, p, p, p);
            d.setView(iv);
        }
        d.show();
    }
}
