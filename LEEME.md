# Asistencia Ecocentury – App Android

App de control de asistencia que funciona sin internet. Cada trabajador marca su entrada y su salida con su DNI y una selfie, y todos los datos se guardan en el celular.

## Versión 3.0

- **Marcar asistencia:** con documento (DNI o CE), selfie y GPS. Funciona sin internet y detecta GPS falso.
- **Iniciar sesión:** cada persona entra con su documento y su contraseña. Los menús cambian según el rol: Trabajador, Administrador de área o Administrador general.
- **Administración desde la app o la web:**
  - personal y roles
  - solicitudes (con adjuntos y quién aprobó)
  - programación de turnos
  - correcciones
  - reportes en Excel
  - áreas, cargos, sedes, turnos y feriados
- **Versión web** para iPhone y Android: la misma URL `/exec`, con las mismas funciones.

Instalación, actualización y uso: **`google-sheets/GUIA-V3.md`**.
El script de la hoja es `google-sheets/Codigo.gs`. Se genera con `python3 google-sheets/construir.py` a partir de `google-sheets/src/` y `Web.html`.

Requiere Android 8.0 o superior.

---

## Opción A: compilar con GitHub (sin instalar nada)

1. Crea una cuenta en https://github.com si no tienes una.
2. Crea un repositorio nuevo, por ejemplo `asistencia-ecocentury`. Puede ser privado.
3. Entra a **Add file > Upload files** y arrastra **todo el contenido** de esta carpeta. La carpeta oculta `.github` también debe subirse.
   - Si el navegador no sube la carpeta `.github`, créala a mano: entra a **Add file > Create new file**, escribe el nombre `.github/workflows/compilar-apk.yml` y pega el contenido de ese archivo.
4. Abre la pestaña **Actions**. Verás que se ejecuta "Compilar APK", que tarda unos 3 a 5 minutos.
5. Cuando aparezca el check verde, entra a esa ejecución y descarga **AsistenciaEcocentury-apk** desde la sección *Artifacts*. Es un .zip que contiene el APK.

## Opción B: compilar con Android Studio

1. Instala Android Studio desde https://developer.android.com/studio.
2. Elige **File > Open** y selecciona esta carpeta. Espera a que termine de sincronizar, la primera vez descarga varias cosas.
3. Si Android Studio sugiere actualizar Gradle o el plugin de Android, puedes aceptar.
4. Elige **Build > Build App Bundle(s) / APK(s) > Build APK(s)**.
5. El archivo queda en `app/build/outputs/apk/debug/app-debug.apk`.

## Instalar en los celulares

1. Envía el APK al celular por WhatsApp, correo, cable o Drive.
2. Ábrelo. Android pedirá permitir "Instalar apps desconocidas" para la app desde la que lo abriste. Acepta.
3. Si aparece un aviso de Play Protect, elige **Instalar de todas formas**. El aviso sale porque la app no está publicada en Play Store.

## Primer uso

1. Entra a **Administración** con el PIN 1234 y cámbialo en **Horario y PIN**.
2. Configura el horario y registra a los trabajadores.
3. Para recibir la información de todos, pide a cada trabajador que envíe su Excel por WhatsApp o correo.

## Notas

- Las fotos no se incluyen dentro del Excel. Se ven en el Historial y en el Excel aparece el nombre del archivo.
- Si se desinstala la app, se borran sus datos. Exporta el Excel antes de desinstalarla.
- Este APK es de tipo *debug*. Sirve para instalarlo directamente, pero para publicarlo en Play Store hay que firmarlo como *release*.
