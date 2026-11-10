# Guía del sistema de asistencia: Google Sheets + app (versión 2.0)

## A. Instalar o actualizar el script (una sola vez)

**Si es la primera vez:**

1. Entra a https://sheets.google.com con la cuenta de la empresa y crea una hoja en blanco llamada **Asistencia Ecocentury**.
2. Abre **Extensiones > Apps Script**, borra lo que haya y pega todo el contenido de **Codigo.gs**.
3. Cambia `CAMBIA-ESTA-CLAVE` por una clave tuya y guarda.
4. En **Configuración del proyecto** (el engranaje), verifica que la zona horaria sea **(GMT-05:00) Lima**.
5. Entra a **Implementar > Nueva implementación > Aplicación web** y configúrala así:
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier persona
6. Haz clic en **Implementar** y autoriza el acceso. Si aparece "Google no verificó esta app", entra a **Configuración avanzada > Ir a… > Permitir**.
7. Copia la URL que termina en `/exec`.

**Si ya tenías la versión 1.1:**

1. En Apps Script, reemplaza todo el código por el nuevo **Codigo.gs** y vuelve a poner tu clave.
2. Entra a **Implementar > Gestionar implementaciones**, haz clic en el **lápiz**, elige **Versión: Nueva versión** y luego **Implementar**. Así la URL no cambia.

**En ambos casos**, recarga la hoja (F5) y haz clic en el menú **Asistencia > Preparar hojas**.

---

## B. Configurar las hojas

### Sedes
Una fila por cada lugar de trabajo (oficina, obra, almacén).

| Columna | Qué poner |
|---|---|
| Sede | Nombre, por ejemplo "Obra Callao" |
| Latitud / Longitud | En Google Maps, mantén presionado el lugar y copia los números que aparecen, por ejemplo `-12.0464, -77.0428` |
| Radio (m) | Distancia máxima permitida para marcar. Recomendado: entre 100 y 300 |
| Validar ubicación | **SI**: no se puede marcar fuera del radio, sin GPS o con GPS falso. **NO**: se registra la ubicación, pero se permite marcar |

### Turnos
| Columna | Ejemplo |
|---|---|
| Turno | Administrativo |
| Entrada / Salida | 08:00 / 17:00. Para un turno nocturno: 22:00 / 06:00 |
| Tolerancia (min) | 10 |
| Refrigerio (min) | 60. Se descuenta de las horas trabajadas |
| Días laborables | `LMXJV` (lunes a viernes), `LMXJVS` (lunes a sábado) o `L-S` |

Las letras de los días son: L = lunes, M = martes, X = miércoles, J = jueves, V = viernes, S = sábado, D = domingo.

### Trabajadores
DNI, nombre, **Activo** (SI o NO), **Sede**, **Turno** (se eligen de una lista), cargo y **clave personal**.

La clave personal sirve para que el trabajador entre a "Mi espacio". Si la dejas vacía, la clave son los **4 últimos dígitos del DNI**. Se recomienda poner una clave propia.

### Programación (turnos rotativos)
Solo se usa cuando un día es distinto al turno normal. Por cada caso, escribe DNI, fecha y el turno, o **DESCANSO** para un día libre.

### Feriados
Ya vienen cargados los feriados nacionales de 2026 y 2027. Revísalos y agrega los feriados regionales o los días no laborables que dé el gobierno.

### Configuración
- **Razón social y RUC:** aparecen en el Registro SUNAFIL.
- **Turno por defecto:** se usa para los trabajadores que no tienen turno asignado.
- **Mínimo de horas extra (min):** por ejemplo, con 30, una salida 20 minutos después de la hora no cuenta como hora extra.
- **Horas extra requieren aprobación:** con **SI**, las horas extra solo cuentan si el jefe aprueba la solicitud.

---

## C. Uso diario

### Trabajador (en la app)
- **Marcar asistencia:** ingresa su DNI. La app toma la **ubicación** y luego la **selfie**. Funciona sin internet y envía los datos cuando vuelve la señal.
- **Mi espacio:** con su DNI y su clave personal puede ver sus marcas de los últimos 31 días y hacer solicitudes:
  - Permiso
  - Vacaciones
  - Justificar una falta o una tardanza
  - Horas extra
  - Cambio de turno
  - Corregir una marcación

### Jefe o RRHH (en la hoja)
- **Aprobar solicitudes:** en la pestaña **Solicitudes**, cambia el **Estado** a **APROBADO** o **RECHAZADO** y, si quieres, escribe una respuesta. El trabajador ve el resultado en la app. Al aprobar:
  - **Vacaciones y permisos:** ese día no cuenta como falta.
  - **Justificación:** la tardanza no se cuenta.
  - **Horas extra:** se aprueban las horas extra de ese día.
  - **Cambio de turno:** se aplica el turno solicitado.
  - **Corrección de marca:** se agrega la marca corregida.
- **Corregir marcas directamente:** en la pestaña **Correcciones** escribe DNI, fecha, hora, tipo y motivo. Se guarda quién la registró y cuándo. **Nunca edites la pestaña Marcaciones**: es el registro original y sirve como evidencia.
- **Panel en tiempo real:** usa el menú **Asistencia > Actualizar panel de hoy**, o **Activar panel automático** para que se actualice cada 10 minutos. Muestra por sede quién está trabajando, quién ya salió, pendientes, faltas y tardanzas.
- **Resumen del día en la app:** se abre con el botón **Resumen del día (supervisor)**, protegido con PIN.

### Reportes (menú Asistencia > Generar reportes por fechas)
| Pestaña | Contenido |
|---|---|
| R-Resumen diario | Cada trabajador por día: turno, entrada, salida, horas, tardanza, horas extra, estado y alertas |
| R-Totales | Por trabajador: asistencias, faltas, tardanzas, permisos, vacaciones, horas, horas extra al 25% y al 35%, % de puntualidad y % de ausentismo |
| R-Por sede | Los mismos indicadores agrupados por sede |
| R-Horas extra | Detalle de las horas extra y si están aprobadas o por aprobar |
| R-Alertas ubicación | Marcas fuera de la sede, sin GPS o con ubicación falsa, con enlace al mapa y a la foto |
| R-Registro SUNAFIL | Registro de control de asistencia: empleador, RUC, trabajador, fecha, hora de ingreso y de salida, sobretiempo y observaciones |

Para guardar o enviar un reporte, entra a **Archivo > Descargar > Microsoft Excel o PDF**.

---

## D. Recomendaciones legales

El sistema guarda la información que suele exigirse en un registro de control de asistencia:

- hora de ingreso y de salida
- sobretiempo
- la marca original sin modificar
- las correcciones, con quién las hizo y por qué
- acceso del trabajador a sus propios registros, desde "Mi espacio"

Aun así, se recomienda que tu asesor laboral revise el formato y que guardes los registros el tiempo que exige la norma. Lo más sencillo es no borrar nunca la hoja ni la carpeta de fotos.

El recargo de horas extra que aparece en los reportes (25% las 2 primeras horas y 35% las siguientes) es **referencial**. Verifica los porcentajes con tu asesor laboral.

## E. Capacidad
Funciona bien hasta unos 200 trabajadores. Cada año, haz una copia de la hoja como archivo histórico (**Archivo > Hacer una copia**). Luego, en la hoja original, borra las filas antiguas de **Marcaciones** para que siga rápida.
