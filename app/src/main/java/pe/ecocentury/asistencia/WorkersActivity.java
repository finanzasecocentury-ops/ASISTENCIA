package pe.ecocentury.asistencia;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.text.InputFilter;
import android.text.InputType;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.List;

/** Alta, edición y baja de trabajadores. */
public class WorkersActivity extends Activity {
    private LinearLayout list;
    private TextView count;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Trabajadores");
        LinearLayout root = Ui.screen(this);

        LinearLayout form = (LinearLayout) Ui.card(this);
        form.addView(Ui.bold(this, "Nuevo trabajador", 17, Ui.TEXT));
        EditText dni = Ui.edit(this, "DNI", InputType.TYPE_CLASS_NUMBER);
        dni.setFilters(new InputFilter[]{new InputFilter.LengthFilter(12)});
        Ui.add(form, dni, 8);
        EditText name = Ui.edit(this, "Nombres y apellidos",
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PERSON_NAME | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        Ui.add(form, name, 4);
        Ui.add(form, Ui.button(this, "Agregar", Ui.GREEN, v -> {
            String d = dni.getText().toString().trim();
            String n = name.getText().toString().trim();
            if (d.length() < 8) { Ui.toast(this, "El DNI debe tener al menos 8 dígitos."); return; }
            if (n.isEmpty()) { Ui.toast(this, "Ingresa el nombre."); return; }
            if (!Db.get(this).addWorker(d, n)) { Ui.toast(this, "Ese DNI ya está registrado."); return; }
            dni.setText("");
            name.setText("");
            dni.requestFocus();
            Ui.toast(this, "Trabajador agregado");
            load();
        }), 10);
        Ui.add(root, form, 4);

        count = Ui.text(this, "", 14, Ui.MUTED);
        Ui.add(root, count, 16);
        Ui.add(root, Ui.text(this, "Toca un trabajador para editar su nombre o eliminarlo.", 13, Ui.MUTED), 2);
        list = Ui.vbox(this);
        Ui.add(root, list, 4);
        load();
    }

    private void load() {
        List<Calc.Worker> ws = Db.get(this).workers();
        count.setText(ws.size() + " trabajador(es) registrado(s)");
        list.removeAllViews();
        for (Calc.Worker w : ws) {
            LinearLayout c = (LinearLayout) Ui.card(this);
            c.addView(Ui.bold(this, w.name, 17, Ui.TEXT));
            c.addView(Ui.text(this, "DNI " + w.dni, 14, Ui.MUTED));
            c.setOnClickListener(v -> edit(w));
            Ui.add(list, c, 8);
        }
    }

    private void edit(Calc.Worker w) {
        LinearLayout box = Ui.dialogBox(this);
        EditText name = Ui.edit(this, "Nombres y apellidos",
                InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_WORDS);
        name.setText(w.name);
        Ui.add(box, name, 0);
        new AlertDialog.Builder(this)
                .setTitle("DNI " + w.dni)
                .setView(box)
                .setPositiveButton("Guardar", (d, x) -> {
                    String n = name.getText().toString().trim();
                    if (n.isEmpty()) return;
                    Db.get(this).updateWorker(w.dni, n);
                    load();
                })
                .setNeutralButton("Eliminar", (d, x) -> new AlertDialog.Builder(this)
                        .setTitle("Eliminar trabajador")
                        .setMessage("¿Eliminar a " + w.name + "? Sus marcaciones anteriores se conservan.")
                        .setPositiveButton("Eliminar", (d2, x2) -> { Db.get(this).deleteWorker(w.dni); load(); })
                        .setNegativeButton("Cancelar", null)
                        .show())
                .setNegativeButton("Cancelar", null)
                .show();
    }
}
