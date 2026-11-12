# Asistencia Ecocentury v3.0: guía de instalación y uso

## Novedades de la versión 3.0

- **Cada persona entra con su documento (DNI o carné de extranjería) y su contraseña.** Se elimina el PIN 1234 compartido.
- **Tres roles con menús distintos:** Trabajador, Administrador de área y Administrador general.
- **Administradores por área:** cada jefe ve y gestiona solo al personal de sus áreas.
- **Todo se hace desde la app o la web:**
  - Registrar personal.
  - Aprobar solicitudes, que ahora registran quién las aprobó.
  - Programar turnos y descansos.
  - Corregir marcas.
  - Descargar reportes en Excel.
  - Administrar áreas, cargos, sedes, turnos y feriados.
- **Nuevos tipos de solicitud con adjunto:** descanso médico, licencia con goce, licencia sin goce y comisión de servicio.
- **Fecha de inicio del sistema y fecha de ingreso de cada trabajador:** no se cuentan faltas antes de esas fechas.
- **Contraseñas cifradas** en una pestaña protegida, **auditoría** de todos los cambios y **copia de seguridad semanal**.
- **Marcación más rápida** cuando muchas personas marcan a la vez, y ENTRADA/SALIDA coherente entre el APK y la web.

---

## 1. Actualizar el script de la hoja (lo hace el dueño de la hoja)

1. Abre tu hoja de Google y entra a **Extensiones > Apps Script**.
2. Borra todo el código (Ctrl + A y luego Supr) y pega el nuevo **Codigo.gs**.
3. En la línea `const CLAVE = '...'`, vuelve a poner **tu misma clave**. Guarda con Ctrl + S.
4. Entra a **Implementar > Gestionar implementaciones**, haz clic en el **lápiz ✏️**, elige **Versión: Nueva versión** y luego **Implementar**. Acepta los permisos nuevos si Google los pide.
   - Esta versión usa permisos adicionales para crear el Excel de los reportes y la copia de seguridad. Si aparece "Google no verificó esta app", entra a **Configuración avanzada > Ir a… > Permitir**.
5. Vuelve a la hoja, presiona **F5** y entra a **Asistencia > Preparar hojas**.

**Qué pasa con tus datos actuales:**

- La pestaña **Trabajadores** se convierte al nuevo formato. Todos quedan en el área **"General"**, con rol Trabajador y la contraseña temporal **1234**.
- Los cargos que ya usabas pasan a la lista **Cargos**.
- Las marcaciones, solicitudes y correcciones se conservan.

## 2. Crear al administrador principal

1. En la pestaña **Configuración**, escribe el DNI en **"DNI del administrador principal"**.
2. Opcional: llena también **"Fecha de inicio del sistema"**, por ejemplo `10/11/2026`. Antes de esa fecha no se contarán faltas.
3. Esa persona entra a la app o a la web con **Iniciar sesión**, usando su DNI y la contraseña **1234**. El sistema le pedirá crear una contraseña nueva de 6 números.
4. Desde **Mi personal**, completa sus datos: nombre, área y cargo. Luego:
   - Crea las **áreas** y los **cargos** en **Áreas, cargos, sedes, turnos y feriados**.
   - Asigna el área a cada trabajador migrado.
   - Registra a los **administradores de área** y marca sus áreas a cargo.

**Si el administrador principal olvida su contraseña:** en **Configuración**, cambia **"Restablecer contraseña del principal"** a **SI**. En su siguiente ingreso, la contraseña vuelve a ser **1234** y la opción regresa sola a NO. Si además perdió el rol de administrador general o quedó inactivo, el sistema se lo devuelve automáticamente porque su DNI está en Configuración.

## 3. Actualizar el APK

1. Sube el contenido del ZIP **encima** del repositorio de GitHub, con **Add file > Upload files**.
2. Descarga el APK desde **Actions > Artifacts**.
3. Instálalo encima de la versión anterior. No hace falta desinstalar.

Al abrirlo, el celular sigue conectado a la misma URL. Los celulares nuevos muestran una pantalla de **configuración inicial** donde se ingresan la URL y la clave del servidor.

## 4. Qué ve cada rol

| Opción | Trabajador | Adm. de área | Adm. general |
|---|:---:|:---:|:---:|
| Marcar asistencia (sin contraseña: documento y selfie) | ✅ | ❌ | ❌ |
| Mis marcas, Mis solicitudes, Cambiar mi contraseña | ✅ | ✅ | ✅ |
| Solicitudes por aprobar (con aviso de pendientes) | ❌ | Sus áreas | Todas |
| Resumen del día | ❌ | Sus áreas | Todas |
| Mi personal (registrar, editar, activar o desactivar, restablecer contraseña) | ❌ | Sus áreas (solo trabajadores) | Todos, incluidos los roles |
| Programar turnos y descansos | ❌ | Sus áreas | Todas |
| Corregir marcas | ❌ | Sus áreas | Todas |
| Marcaciones y fotos | ❌ | Sus áreas | Todas |
| Reportes en Excel | ❌ | Sus áreas | Todas |
| Áreas, cargos, sedes, turnos y feriados | ❌ | ❌ | ✅ |
| Conexión y sincronización del celular (solo APK) | ❌ | ❌ | ✅ |

**Reglas importantes:**

- **Sesión:** se cierra sola después de **5 minutos sin uso**.
- **Usuarios inactivos:** no pueden iniciar sesión ni marcar. Su historial se conserva y nadie se elimina.
- **Solicitudes propias:** nadie aprueba las suyas. Las de los administradores de área las aprueba el general.
- **Administradores generales:** debe haber siempre al menos uno activo. Nadie puede quitarse su propio rol ni desactivarse a sí mismo.
- **Contraseñas:** 6 números, no 1234, no repetidos (111111) ni seguidos (123456). Si alguien la olvida, su administrador la **restablece a 1234**.

## 5. La hoja de Google

- **Trabajadores:** se puede editar a mano. Cada edición manual queda registrada en **Auditoría**.
- **Credenciales:** guarda las contraseñas cifradas. Está **oculta y protegida**; no la modifiques.
- **Marcaciones:** es el registro original. No lo edites. Para corregir, usa **Corregir marcas** en la app o en la web.
- **Menú Asistencia:**
  - **Generar reportes por fechas:** reportes de todas las áreas.
  - **Actualizar panel de hoy.**
  - **Activar copia de seguridad semanal:** cada lunes a las 2 a. m. se guarda una copia en la carpeta de Drive "Asistencia Ecocentury - Respaldos". Se conservan las últimas 12.
- **Acceso a la hoja:** compártela **solo con el administrador general**. Quien tenga acceso a la hoja ve los datos de todas las áreas.

## 6. Notas

- El APK muestra las pantallas de "Iniciar sesión" con el mismo diseño que la versión web, así que funcionan igual en Android y en iPhone. **Marcar asistencia en el APK sigue siendo nativo:** funciona sin internet y detecta GPS falso.
- Los porcentajes de horas extra (25% y 35%) y el formato del Registro SUNAFIL son **referenciales**. Valídalos con tu asesor laboral.
- **Espacio en Drive:** cada selfie ocupa unos 100 KB. Revisa el espacio de la cuenta de Google cada cierto tiempo.
