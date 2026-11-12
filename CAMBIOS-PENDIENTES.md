# Cambios pendientes – Asistencia Ecocentury (próxima versión)
Estado: IMPLEMENTADO en v3.0.

## 1. Fecha de inicio de asistencias
- Configuración: "Fecha de inicio del sistema". Antes de esa fecha no se cuentan faltas para nadie.
- Trabajadores: columna "Fecha de ingreso" (opcional). Sin faltas antes del primer día del trabajador.
  Si está vacía, se usa la fecha de inicio del sistema.
- Las fechas anteriores no aparecen en Mi Espacio, en el resumen del día ni en los reportes.

## 2. Registro de trabajadores desde la app
Campos: DNI (obligatorio, 8 dígitos numéricos, único, es el usuario), Nombre completo (obligatorio),
Sede (obligatorio, de las registradas), Turno (obligatorio, de los registrados), Cargo (obligatorio),
Rol (Administrador / Trabajador, por defecto Trabajador), Estado (Activo / Inactivo, por defecto Activo).

## 3. Credenciales de acceso
- Contraseña temporal 1234 al crear.
- Cambio obligatorio en el primer ingreso.
- Nueva contraseña: 6 dígitos, confirmada dos veces; no 1234, no repetidos (111111), no seguidos (123456).
- Cambio voluntario desde Mi Espacio, pidiendo la contraseña actual.
- Restablecimiento por el administrador a 1234, con cambio obligatorio después.
- Se pide solo para Mi Espacio y Solicitudes. Para marcar basta con el DNI y la selfie.
- Guardada cifrada (hash), nunca en texto plano.

## 4. Roles y permisos
Administrador: todos los módulos + Gestión de Perfiles (lista con filtros por sede, turno, cargo, rol y estado;
registrar y editar; asignar rol; activar o desactivar; restablecer contraseña; revisar, aprobar o rechazar solicitudes con respuesta).
Trabajador: marcar asistencia; ver su confirmación; Mi Espacio (solo sus marcas de 31 días + cambiar contraseña);
Solicitudes (enviar y ver estado y respuesta).

## 5. Reglas de negocio
1. Un usuario inactivo no inicia sesión, no marca y no envía solicitudes. Su historial se conserva.
2. No se eliminan trabajadores, solo se desactivan.
3. Un administrador no puede desactivarse a sí mismo ni quitarse su propio rol de administrador.
4. Siempre debe haber al menos un administrador activo.
5. Auditoría: quién creó o modificó cada perfil y cuándo.
6. Una corrección aprobada no borra la marca original; se guarda como ajuste con el motivo y el administrador que la aprobó.

## 6. Áreas y administradores por área
- Campo nuevo en el trabajador: Área (obligatorio, de una lista de áreas).
- Roles: Administrador general (todo), Administrador de área (solo sus áreas asignadas, una o varias), Trabajador.
- Administrador de área, solo dentro de sus áreas: ver la lista con filtros, ver el resumen del día y los reportes,
  aprobar o rechazar solicitudes, registrar y editar trabajadores de su área (CONFIRMADO, punto 10), restablecer contraseñas.
- Agrupación por ÁREA, no por jefe directo (CONFIRMADO, punto 9).
- No puede: ver otras áreas, crear administradores o cambiar roles, mover personal fuera de sus áreas,
  ni cambiar la configuración (sedes, turnos, áreas, conexión).
- Las solicitudes van al administrador del área; el general las ve todas. Nadie aprueba sus propias solicitudes.
  Un área sin administrador la atiende el general.
- Solo el administrador general tiene acceso a la hoja de Google. Los administradores de área usan la app,
  con reportes en Excel desde la app filtrados por área (funcionalidad nueva).

## 7. Menús según el rol (APK y web)
- Pantalla inicial pública: solo "Marcar asistencia" e "Iniciar sesión". Se quitan "Resumen del día" y "Administración".
- Después de iniciar sesión con DNI y contraseña, el menú muestra solo las opciones del rol:
  - Trabajador: Marcar asistencia, Mis marcas, Mis solicitudes, Nueva solicitud, Cambiar contraseña, Cerrar sesión.
  - Administrador de área: lo del trabajador + Resumen del día (sus áreas), Solicitudes por aprobar (sus áreas),
    Mi personal (registrar, editar, activar o desactivar, restablecer contraseña), Reportes Excel (sus áreas).
  - Administrador general: todo lo anterior para todas las áreas + Gestión de roles, Sedes/Turnos/Áreas (consulta),
    Conexión a la nube, Historial con fotos, Sincronizar.
- Dentro de cada pantalla también se ocultan los botones y filtros que no corresponden (por ejemplo, el filtro de área solo con varias áreas).
- El servidor valida el permiso en cada acción; ocultar el botón no basta como seguridad.
- La sesión se cierra sola tras 5 minutos sin uso y siempre que se vuelve a la pantalla inicial.
- Configuración inicial de un celular nuevo: pantalla única que pide la URL y la clave del servidor; luego solo el administrador general puede cambiarla.

## 8. Aviso de solicitudes dentro de la app (opción A)
- Al iniciar sesión, el administrador ve un globo con el número de solicitudes pendientes de sus áreas en el botón
  "Solicitudes por aprobar", más un aviso en el menú ("Tienes N solicitudes nuevas"). APK y web.
- Las solicitudes nuevas desde su última visita se resaltan como "Nueva".

## 9. Quién aprobó cada solicitud
- Solicitudes: columnas nuevas "Respondido por" (nombre y documento del administrador) y "Fecha de respuesta".
- El trabajador ve en Mi Espacio quién aprobó o rechazó, la fecha y la respuesta.
- Los administradores lo ven en "Solicitudes por aprobar > Todas".
- Las correcciones aprobadas guardan el mismo dato (regla 5.6), y el reporte R-Registro SUNAFIL lo muestra en Observaciones.

## 10. Más tipos de solicitud con adjunto
- Tipos nuevos: Descanso médico, Licencia con goce, Licencia sin goce, Comisión de servicio.
- Adjuntar foto (por ejemplo, certificado médico) desde la cámara o la galería, en el APK y en la web.
- El adjunto se guarda en la carpeta de Drive "Asistencia Ecocentury - Adjuntos"; el enlace queda en Solicitudes.
- El administrador ve el adjunto al revisar la solicitud en la app.
- Al aprobarse, esos días no cuentan como falta (igual que permiso o vacaciones) y el reporte indica el tipo.

## 11. Copia de seguridad automática semanal
- Cada semana se guarda una copia completa de la hoja en la carpeta de Drive "Asistencia Ecocentury - Respaldos".
- Se conservan las últimas 12 copias (unos 3 meses); las más antiguas se borran solas.
- Se activa una sola vez desde el menú Asistencia > Activar copia de seguridad semanal.

## 12. Programar turnos rotativos y descansos desde la app
- Pantalla "Programación": elegir trabajador(es), rango de fechas y turno o DESCANSO.
- Vista por semana del personal con el turno de cada día; los días programados se distinguen del turno habitual.
- Asignación masiva: varios trabajadores y varias fechas a la vez (por ejemplo, rol de fin de semana).
- Quitar una programación devuelve al trabajador a su turno habitual.
- Permisos: el administrador general programa a todos; el administrador de área, solo a su personal.
- Auditoría: quién programó y cuándo.

## 13. Corregir marcas directamente desde la app
- El administrador agrega una marca faltante (ENTRADA o SALIDA, fecha, hora) con motivo obligatorio.
- La marca original nunca se modifica ni se borra; la corrección queda como ajuste en la hoja Correcciones,
  con el nombre del administrador y la fecha.
- Anular una corrección hecha por error (queda registrada como anulada, no se borra).
- Permisos: el general corrige a todos; el de área, solo a su personal. Nadie corrige sus propias marcas.
- En reportes y en el Registro SUNAFIL se indica "Incluye corrección" con motivo y responsable.

## 14. Administrar listas desde la app (solo administrador general)
- Áreas: crear, renombrar, activar o desactivar.
- Cargos: crear, renombrar, activar o desactivar.
- Sedes: nombre, coordenadas, radio y validación GPS; botón "Usar mi ubicación actual" para tomar las coordenadas en el lugar.
- Turnos: nombre, entrada, salida, tolerancia, refrigerio y días laborables.
- Feriados: agregar o quitar fechas.
- Un elemento en uso no se elimina, solo se desactiva (no aparece para nuevos registros).
- Aviso al editar un turno: el cambio también recalcula días pasados; para no alterar el historial, crear un turno nuevo.
- Todo cambio queda en Auditoría.

## Decisiones del usuario
1. Administradores entran con DNI y contraseña; se elimina el PIN compartido. ✅
2. Se aceptan extranjeros: tipo de documento DNI (8 dígitos) o Carné de Extranjería (CE). ✅
3. Menús por rol y Gestión de Perfiles también en la versión web (iPhone). ✅
4. Cargo se elige de una lista (nueva hoja "Cargos"). ✅
5. [CAMBIADO] La hoja Trabajadores NO se bloquea: se puede editar en Google Sheets y desde la app. Las contraseñas (hash) van en una hoja aparte "Credenciales", protegida. Las ediciones a mano se registran en la hoja "Auditoría". ✅
6. Sin bloqueo por intentos fallidos (omitido). ✅
7. Trabajadores actuales migran con contraseña 1234 y cambio obligatorio. ✅
8. Se incluyen: optimización por saturación a la hora de entrada + ENTRADA/SALIDA consistente entre el APK y la web.
   NO se incluyen: hora del celular ni espacio en Drive. ✅
9. Agrupar por área. ✅
10. El administrador de área registra y edita a su personal. ✅
11. RRHH: por definir. El usuario principal (administrador general) se definirá después. ✅
12. Los administradores no marcan asistencia ni tienen faltas. ✅
13. Cierre de sesión a los 5 minutos. ✅
- Correos: descartados. Alertas: solo la opción A (dentro de la app); sin notificaciones del sistema, Teams ni Telegram.

## Aclaraciones confirmadas
- Hoja Trabajadores: SIN bloqueo (decisión posterior). ✅
- Primer administrador: campo "DNI del administrador principal" en Configuración; el sistema lo crea como administrador general con contraseña 1234. ✅
- Carné de Extranjería: de 9 a 12 caracteres alfanuméricos. ✅

- Contraseñas en la hoja aparte "Credenciales" (protegida; solo el sistema escribe). Trabajadores queda editable. ✅ CONFIRMADO (opción 2)

ESTADO: IMPLEMENTADO en la versión 3.0 (visto bueno recibido).

Recomendaciones 1-3 INCLUIDAS (cambios 12, 13 y 14). Recomendación 4 (aviso de datos personales): no incluida.
