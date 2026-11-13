package pe.ecocentury.asistencia;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

import java.io.OutputStream;

/**
 * Portal de usuario: inicio de sesión, Mi espacio y administración según el rol.
 * Muestra las mismas pantallas que la versión web (la hoja de Google decide qué ve cada rol)
 * y conecta algunas acciones con el celular: marcar, guardar archivos, conexión y sincronización.
 */
public class PortalActivity extends Activity {
    static final String EXTRA_MESSAGE = "mensaje";
    private static final int REQ_FILE = 30, REQ_SAVE = 31, REQ_LOCATION = 32;

    /**
     * Cierra automáticamente el aviso gris de Google ("Un usuario de Google Apps Script creó esta aplicación"),
     * igual que si el usuario tocara su X. Busca el aviso por su texto, pulsa su botón de cerrar y lo oculta.
     */
    private static final String CERRAR_AVISO_GOOGLE =
            "(function(){function f(){var h=false,a=document.querySelectorAll('body *');"
            + "for(var i=0;i<a.length;i++){var e=a[i];if(e.tagName==='IFRAME'||e.querySelector('iframe'))continue;"
            + "var t=e.textContent||'';if(t.length<400&&/Google Apps Script/.test(t)){var n=e;"
            + "while(n.parentElement&&n.parentElement!==document.body&&!n.parentElement.querySelector('iframe'))n=n.parentElement;"
            + "var b=n.querySelectorAll('[role=button],button,[aria-label]');for(var j=0;j<b.length;j++){"
            + "var l=(b[j].getAttribute('aria-label')||'')+' '+(b[j].textContent||'');"
            + "if(/cerrar|close|descartar|dismiss/i.test(l)){try{b[j].click();}catch(x){}}}"
            + "n.style.display='none';h=true;}}return h;}"
            + "var k=0,id=setInterval(function(){if(f()||++k>24)clearInterval(id);},250);})();";

    private WebView web;
    private ProgressBar loading;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSave;
    private GeolocationPermissions.Callback geoCallback;
    private String geoOrigin;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        setTitle("Asistencia Ecocentury");
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Ui.BG);
        web = new WebView(this);
        frame.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        loading = new ProgressBar(this);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(Ui.dp(this, 48), Ui.dp(this, 48));
        lp.gravity = android.view.Gravity.CENTER;
        frame.addView(loading, lp);
        setContentView(frame);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.setBackgroundColor(Color.parseColor("#F3F6F3"));
        // La página de Google Apps Script se muestra dentro de un marco de otro dominio: necesita cookies de terceros
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView v, String url) {
                loading.setVisibility(View.GONE);
                v.evaluateJavascript(CERRAR_AVISO_GOOGLE, null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                boolean propio = host.endsWith("script.google.com") || host.endsWith("googleusercontent.com")
                        || host.endsWith("accounts.google.com");
                if (propio && !"maps.google.com".equals(host)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
                return true;   // mapas y otros enlaces se abren fuera de la app
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "application/pdf"});
                try {
                    startActivityForResult(Intent.createChooser(i, "Elegir archivo"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    cb.invoke(origin, true, false);
                } else {
                    geoCallback = cb;
                    geoOrigin = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
                }
            }
        });
        if (b != null) web.restoreState(b);
        else web.loadUrl(Settings.cloudUrl(this));
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req != REQ_LOCATION || geoCallback == null) return;
        boolean ok = false;
        for (int r : res) if (r == PackageManager.PERMISSION_GRANTED) ok = true;
        geoCallback.invoke(geoOrigin, ok, false);
        geoCallback = null;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE) {
            Uri[] r = null;
            if (res == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
            if (fileCallback != null) fileCallback.onReceiveValue(r);
            fileCallback = null;
        } else if (req == REQ_SAVE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (res != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            Uri uri = data.getData();
            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                if (os == null) throw new IllegalStateException("sin salida");
                os.write(bytes);
            } catch (Exception e) {
                Ui.toast(this, "No se pudo guardar: " + e.getMessage());
                return;
            }
            new AlertDialog.Builder(this)
                    .setTitle("Archivo guardado")
                    .setMessage("¿Deseas compartirlo (WhatsApp, correo, etc.)?")
                    .setPositiveButton("Compartir", (d, w) -> {
                        Intent s = new Intent(Intent.ACTION_SEND);
                        s.setType(getContentResolver().getType(uri) != null ? getContentResolver().getType(uri) : "*/*");
                        s.putExtra(Intent.EXTRA_STREAM, uri);
                        s.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(s, "Compartir"));
                    })
                    .setNegativeButton("Cerrar", null)
                    .show();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this)
                .setMessage("¿Cerrar sesión y salir?")
                .setPositiveButton("Salir", (d, w) -> close(null))
                .setNegativeButton("Seguir aquí", null)
                .show();
    }

    @Override
    protected void onDestroy() {
        if (isFinishing()) {
            try { web.evaluateJavascript("window.appLogout && window.appLogout()", null); } catch (Exception ignored) { }
        }
        web.destroy();
        super.onDestroy();
    }

    private void close(String message) {
        try { web.evaluateJavascript("window.appLogout && window.appLogout()", null); } catch (Exception ignored) { }
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (message != null && !message.isEmpty()) i.putExtra(EXTRA_MESSAGE, message);
        startActivity(i);
        finish();
    }

    /** Funciones que la página puede llamar como window.AndroidApp.* */
    private final class Bridge {
        @JavascriptInterface
        public void cerrar(String message) { runOnUiThread(() -> close(message)); }

        @JavascriptInterface
        public void marcar(String documento) {
            runOnUiThread(() -> startActivity(new Intent(PortalActivity.this, MarkActivity.class)
                    .putExtra(MarkActivity.EXTRA_DOC, documento)));
        }

        @JavascriptInterface
        public void guardarArchivo(String name, String mime, String base64) {
            final byte[] bytes;
            try { bytes = Base64.decode(base64, Base64.DEFAULT); } catch (IllegalArgumentException e) { return; }
            runOnUiThread(() -> {
                pendingSave = bytes;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "*/*" : mime);
                i.putExtra(Intent.EXTRA_TITLE, name == null ? "archivo" : name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (ActivityNotFoundException e) {
                    pendingSave = null;
                    Ui.toast(PortalActivity.this, "No se pudo abrir el selector de archivos.");
                }
            });
        }

        @JavascriptInterface
        public void configurarConexion() {
            runOnUiThread(() -> startActivity(new Intent(PortalActivity.this, SetupActivity.class)));
        }

        @JavascriptInterface
        public void sincronizar() {
            runOnUiThread(() -> {
                Ui.toast(PortalActivity.this, "Sincronizando…");
                Cloud.syncAsync(PortalActivity.this, (msg, err) -> Ui.toast(PortalActivity.this,
                        err != null ? "No se pudo sincronizar: " + err.getMessage()
                                : "Sincronizado: " + msg + ". Pendientes: " + Db.get(PortalActivity.this).pendingCount()));
            });
        }
    }
}
