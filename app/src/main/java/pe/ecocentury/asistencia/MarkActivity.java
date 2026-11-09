package pe.ecocentury.asistencia;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.provider.MediaStore;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.File;
import java.util.List;

/** Pantalla para marcar entrada/salida con DNI + selfie. */
public class MarkActivity extends Activity {
    private static final int REQ_CAMERA = 10;

    private EditText dni;
    private TextView info;
    private String pendingDni;
    private long pendingTs;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Marcar asistencia");
        if (b != null) {
            pendingDni = b.getString("pendingDni");
            pendingTs = b.getLong("pendingTs");
        }
        LinearLayout root = Ui.screen(this);

        Ui.add(root, Ui.bold(this, "Ingresa tu DNI", 20, Ui.TEXT), 8);
        dni = Ui.edit(this, "DNI", InputType.TYPE_CLASS_NUMBER);
        dni.setFilters(new InputFilter[]{new InputFilter.LengthFilter(12)});
        dni.setTextSize(28);
        dni.setGravity(Gravity.CENTER);
        Ui.add(root, dni, 8);

        info = Ui.text(this, "", 18, Ui.MUTED);
        info.setGravity(Gravity.CENTER);
        Ui.add(root, info, 12);

        Ui.add(root, Ui.button(this, "Tomar selfie y marcar", Ui.GREEN, v -> startMark()), 20);
        Ui.add(root, Ui.text(this, "Se abrirá la cámara. Toma una foto de tu rostro para registrar la marcación. "
                + "La app detecta sola si corresponde ENTRADA o SALIDA.", 14, Ui.MUTED), 16);

        dni.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void onTextChanged(CharSequence s, int a, int c, int d) { }
            @Override public void afterTextChanged(Editable s) { refreshInfo(); }
        });
    }

    private void refreshInfo() {
        String d = dni.getText().toString().trim();
        if (d.length() < 8) { info.setText(""); return; }
        Calc.Worker w = Db.get(this).worker(d);
        if (w == null) {
            info.setTextColor(Ui.RED);
            info.setText("DNI no registrado");
            return;
        }
        String next = Calc.nextType(Db.get(this).marksOf(d, Calc.dayOf(System.currentTimeMillis())));
        info.setTextColor(Calc.IN.equals(next) ? Ui.GREEN : Ui.BLUE);
        info.setText(w.name + "\nSe registrará: " + next);
    }

    private void startMark() {
        String d = dni.getText().toString().trim();
        Calc.Worker w = Db.get(this).worker(d);
        if (w == null) { Ui.toast(this, "DNI no registrado. Pide al administrador que te registre."); return; }

        List<Calc.Mark> today = Db.get(this).marksOf(d, Calc.dayOf(System.currentTimeMillis()));
        if (!today.isEmpty()) {
            long diff = System.currentTimeMillis() - today.get(today.size() - 1).ts;
            if (diff >= 0 && diff < 60_000) {
                Ui.toast(this, "Ya marcaste hace menos de un minuto.");
                return;
            }
        }

        File tmp = PhotoProvider.tempFile(this);
        //noinspection ResultOfMethodCallIgnored
        tmp.delete();
        pendingDni = d;
        pendingTs = System.currentTimeMillis();

        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        i.putExtra(MediaStore.EXTRA_OUTPUT, PhotoProvider.tempUri());
        i.setClipData(ClipData.newRawUri("foto", PhotoProvider.tempUri()));
        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        // Pedir cámara frontal (no todas las apps de cámara lo respetan)
        i.putExtra("android.intent.extras.CAMERA_FACING", 1);
        i.putExtra("android.intent.extras.LENS_FACING_FRONT", 1);
        i.putExtra("android.intent.extra.USE_FRONT_CAMERA", true);
        try {
            startActivityForResult(i, REQ_CAMERA);
        } catch (ActivityNotFoundException e) {
            pendingDni = null;
            Ui.toast(this, "No se encontró una app de cámara en este equipo.");
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req != REQ_CAMERA) return;
        String d = pendingDni;
        pendingDni = null;
        if (res != RESULT_OK || d == null) {
            Ui.toast(this, "Marcación cancelada: se necesita la foto.");
            return;
        }
        Bitmap photo = PhotoProvider.loadScaled(PhotoProvider.tempFile(this), 800);
        if (photo == null && data != null && data.getExtras() != null) {
            Object o = data.getExtras().get("data"); // miniatura de respaldo
            if (o instanceof Bitmap) photo = (Bitmap) o;
        }
        if (photo == null) {
            Ui.toast(this, "No se pudo obtener la foto. Intenta de nuevo.");
            return;
        }
        Calc.Worker w = Db.get(this).worker(d);
        if (w == null) { Ui.toast(this, "DNI no registrado"); return; }

        long ts = pendingTs > 0 ? pendingTs : System.currentTimeMillis();
        String fname = d + "_" + ts + ".jpg";
        String photoName = PhotoProvider.saveJpeg(photo, new File(PhotoProvider.photoDir(this), fname)) ? fname : null;
        //noinspection ResultOfMethodCallIgnored
        PhotoProvider.tempFile(this).delete();

        String day = Calc.dayOf(ts);
        String type = Calc.nextType(Db.get(this).marksOf(d, day));
        Calc.Mark m = new Calc.Mark(d, w.name, type, ts, photoName);
        Db.get(this).addMark(m);
        showConfirmation(m, photo);
        dni.setText("");
    }

    private void showConfirmation(Calc.Mark m, Bitmap photo) {
        LinearLayout box = Ui.dialogBox(this);
        box.setGravity(Gravity.CENTER_HORIZONTAL);
        ImageView iv = new ImageView(this);
        iv.setImageBitmap(photo);
        iv.setAdjustViewBounds(true);
        iv.setMaxHeight(Ui.dp(this, 220));
        box.addView(iv);
        TextView t1 = Ui.bold(this, m.type, 26, Calc.IN.equals(m.type) ? Ui.GREEN : Ui.BLUE);
        t1.setGravity(Gravity.CENTER);
        Ui.add(box, t1, 8);
        String hour = Calc.toLocal(m.ts).toLocalTime().format(Calc.HMS);
        TextView t2 = Ui.text(this, m.name + "\n" + Calc.showDay(m.day) + "  " + hour, 18, Ui.TEXT);
        t2.setGravity(Gravity.CENTER);
        Ui.add(box, t2, 4);
        if (Calc.IN.equals(m.type) && Db.get(this).marksOf(m.dni, m.day).size() == 1) {
            long late = Calc.lateMinutes(Calc.toLocal(m.ts).toLocalTime().withSecond(0).withNano(0),
                    Settings.schedule(this));
            TextView t3 = Ui.bold(this, late > 0 ? "Tardanza: " + late + " min" : "A tiempo", 18,
                    late > 0 ? Ui.ORANGE : Ui.GREEN);
            t3.setGravity(Gravity.CENTER);
            Ui.add(box, t3, 6);
        }
        new AlertDialog.Builder(this)
                .setTitle("Marcación registrada")
                .setView(box)
                .setPositiveButton("Aceptar", null)
                .show();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString("pendingDni", pendingDni);
        out.putLong("pendingTs", pendingTs);
    }
}
