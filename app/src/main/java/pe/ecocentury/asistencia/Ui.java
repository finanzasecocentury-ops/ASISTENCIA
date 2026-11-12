package pe.ecocentury.asistencia;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** Utilidades para construir pantallas sin archivos XML. */
final class Ui {
    private Ui() {}

    static final int GREEN = 0xFF2E7D32;
    static final int BLUE = 0xFF1565C0;
    static final int ORANGE = 0xFFEF6C00;
    static final int RED = 0xFFC62828;
    static final int GRAY = 0xFF546E7A;
    static final int TEXT = 0xFF212121;
    static final int MUTED = 0xFF616161;
    static final int BG = 0xFFF4F6F4;

    static int dp(Context c, int v) {
        return Math.round(v * c.getResources().getDisplayMetrics().density);
    }

    /** Contenedor vertical con scroll como contenido de la pantalla; devuelve el contenedor. */
    static LinearLayout screen(Activity a) {
        ScrollView sv = new ScrollView(a);
        sv.setBackgroundColor(BG);
        sv.setFillViewport(true);
        LinearLayout root = vbox(a);
        int p = dp(a, 16);
        root.setPadding(p, p, p, p);
        sv.addView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        a.setContentView(sv);
        return root;
    }

    static LinearLayout vbox(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    static LinearLayout hbox(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }

    static TextView text(Context c, String s, float sp, int color) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    static TextView bold(Context c, String s, float sp, int color) {
        TextView t = text(c, s, sp, color);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    static Button button(Context c, String s, int color, View.OnClickListener l) {
        Button b = new Button(c);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(18);
        b.setTextColor(Color.WHITE);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(c, 12));
        b.setBackground(g);
        int p = dp(c, 14);
        b.setPadding(p, p, p, p);
        b.setOnClickListener(l);
        return b;
    }

    static View card(Context c) {
        LinearLayout l = vbox(c);
        GradientDrawable g = new GradientDrawable();
        g.setColor(Color.WHITE);
        g.setCornerRadius(dp(c, 12));
        g.setStroke(dp(c, 1), 0xFFDDE3DD);
        l.setBackground(g);
        int p = dp(c, 14);
        l.setPadding(p, p, p, p);
        return l;
    }

    static EditText edit(Context c, String hint, int inputType) {
        EditText e = new EditText(c);
        e.setHint(hint);
        e.setInputType(inputType);
        e.setSingleLine(true);
        e.setTextSize(18);
        return e;
    }

    static void add(LinearLayout parent, View v, int topDp) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = dp(parent.getContext(), topDp);
        parent.addView(v, p);
    }

    static void toast(Context c, String s) {
        Toast.makeText(c, s, Toast.LENGTH_LONG).show();
    }

    static LinearLayout dialogBox(Context c) {
        LinearLayout l = vbox(c);
        int p = dp(c, 20);
        l.setPadding(p, dp(c, 8), p, 0);
        return l;
    }
}
