/**
 * Asistencia Ecocentury – Servidor en Google Sheets (Apps Script)  ·  versión 3.0
 *
 * 1. Cambia la CLAVE de abajo por una clave tuya (la misma se pone en la app al configurarla).
 * 2. Implementar > Gestionar implementaciones > ✏️ > Versión: Nueva versión > Implementar
 *    (primera vez: Implementar > Nueva implementación > Aplicación web · Ejecutar como: Yo · Acceso: Cualquier persona)
 * 3. En la hoja: menú Asistencia > Preparar hojas. Luego escribe el DNI del administrador principal en Configuración.
 *
 * Este archivo se genera con construir.py a partir de src/*.gs y Web.html. No edites aquí la parte web.
 */

const CLAVE = 'CAMBIA-ESTA-CLAVE';
const VERSION = '3.0';
const CARPETA_FOTOS = 'Asistencia Ecocentury - Fotos';
const CARPETA_ADJUNTOS = 'Asistencia Ecocentury - Adjuntos';
const CARPETA_RESPALDOS = 'Asistencia Ecocentury - Respaldos';
const CLAVE_TEMPORAL = '1234';
const MINUTOS_SESION = 5;

const ROL_TRAB = 'Trabajador';
const ROL_AREA = 'Administrador de área';
const ROL_GEN = 'Administrador general';
const ROLES = [ROL_TRAB, ROL_AREA, ROL_GEN];

const TIPOS_SOL = ['PERMISO', 'VACACIONES', 'JUSTIFICACIÓN', 'HORAS EXTRA', 'CAMBIO DE TURNO', 'CORRECCIÓN DE MARCA',
  'DESCANSO MÉDICO', 'LICENCIA CON GOCE', 'LICENCIA SIN GOCE', 'COMISIÓN DE SERVICIO'];
const ESTADOS_SOL = ['PENDIENTE', 'APROBADO', 'RECHAZADO'];
/** Solicitudes que cubren un día sin marcas (en orden de prioridad) y su etiqueta en reportes. */
const AUSENCIAS = [
  ['VACACIONES', 'Vacaciones'], ['DESCANSO MEDICO', 'Descanso médico'], ['LICENCIA CON GOCE', 'Licencia con goce'],
  ['LICENCIA SIN GOCE', 'Licencia sin goce'], ['COMISION DE SERVICIO', 'Comisión de servicio'],
  ['PERMISO', 'Permiso'], ['JUSTIFICACION', 'Justificado'],
];

const H_TRAB = ['Tipo de documento', 'Documento', 'Nombre completo', 'Área', 'Sede', 'Turno', 'Cargo', 'Rol', 'Estado',
  'Fecha de ingreso (dd/mm/aaaa)', 'Áreas a cargo', 'Creado por', 'Fecha de creación', 'Modificado por', 'Fecha de modificación'];
const H_MARC = ['ID', 'Fecha', 'Hora', 'DNI', 'Nombre', 'Tipo', 'Tardanza (min)', 'Foto', 'Equipo', 'Día (clave)',
  'Registrado', 'Sede', 'Latitud', 'Longitud', 'Precisión (m)', 'Distancia a sede (m)', 'Ubicación'];
const H_SOL = ['ID', 'Fecha de solicitud', 'DNI', 'Nombre', 'Tipo', 'Desde', 'Hasta', 'Detalle', 'Motivo',
  'Estado', 'Respuesta', 'Fecha de respuesta', 'Respondido por', 'Adjunto'];
const H_CORR = ['DNI', 'Fecha (dd/mm/aaaa)', 'Hora (HH:mm)', 'Tipo (ENTRADA/SALIDA)', 'Motivo', 'Registrado por',
  'Fecha de registro', 'ID', 'Estado', 'Anulado por', 'Motivo de anulación'];
const H_PROG = ['DNI', 'Fecha (dd/mm/aaaa)', 'Turno (o DESCANSO / HABITUAL)', 'Registrado por', 'Fecha de registro'];
const H_CRED = ['Documento', 'Salt', 'Hash', 'Debe cambiar', 'Último cambio', 'Última revisión de solicitudes'];
const H_AUD = ['Fecha', 'Usuario', 'Acción', 'Detalle'];

const CONFIG_DEF = [
  ['Razón social', ''],
  ['RUC', ''],
  ['Turno por defecto', 'Administrativo'],
  ['Mínimo de horas extra (min)', '30'],
  ['Horas extra requieren aprobación (SI/NO)', 'SI'],
  ['Fecha de inicio del sistema (dd/mm/aaaa)', ''],
  ['DNI del administrador principal', ''],
  ['Restablecer contraseña del principal (SI/NO)', 'NO'],
];

const HOJAS = [
  { n: 'Trabajadores', h: H_TRAB, w: [12, 12, 30, 18, 20, 16, 18, 20, 10, 16, 22, 22, 17, 22, 17], filas: [] },
  { n: 'Áreas', h: ['Área', 'Estado'], w: [26, 10], filas: [['General', 'Activo']] },
  { n: 'Cargos', h: ['Cargo', 'Estado'], w: [26, 10], filas: [['Asistente', 'Activo']] },
  { n: 'Sedes', h: ['Sede', 'Latitud', 'Longitud', 'Radio (m)', 'Validar ubicación (SI/NO)', 'Estado'],
    w: [24, 13, 13, 10, 22, 10], filas: [['Oficina principal', '', '', '200', 'NO', 'Activo']] },
  { n: 'Turnos', h: ['Turno', 'Entrada', 'Salida', 'Tolerancia (min)', 'Refrigerio (min)', 'Días laborables', 'Estado'],
    w: [18, 9, 9, 14, 14, 16, 10], filas: [
      ['Administrativo', '08:00', '17:00', '10', '60', 'LMXJV', 'Activo'],
      ['Obra', '07:00', '16:00', '10', '60', 'LMXJVS', 'Activo'],
      ['Noche', '22:00', '06:00', '10', '30', 'LMXJV', 'Activo']] },
  { n: 'Programación', h: H_PROG, w: [12, 17, 26, 22, 18], filas: [] },
  { n: 'Feriados', h: ['Fecha (dd/mm/aaaa)', 'Descripción'], w: [17, 34], filas: [
      ['08/12/2026', 'Inmaculada Concepción'], ['09/12/2026', 'Batalla de Ayacucho'], ['25/12/2026', 'Navidad'],
      ['01/01/2027', 'Año Nuevo'], ['25/03/2027', 'Jueves Santo'], ['26/03/2027', 'Viernes Santo'],
      ['01/05/2027', 'Día del Trabajo'], ['07/06/2027', 'Batalla de Arica'], ['29/06/2027', 'San Pedro y San Pablo'],
      ['23/07/2027', 'Día de la Fuerza Aérea'], ['28/07/2027', 'Fiestas Patrias'], ['29/07/2027', 'Fiestas Patrias'],
      ['06/08/2027', 'Batalla de Junín'], ['30/08/2027', 'Santa Rosa de Lima'], ['08/10/2027', 'Combate de Angamos'],
      ['01/11/2027', 'Todos los Santos'], ['08/12/2027', 'Inmaculada Concepción'], ['09/12/2027', 'Batalla de Ayacucho'],
      ['25/12/2027', 'Navidad']] },
  { n: 'Marcaciones', h: H_MARC, w: [24, 11, 9, 11, 28, 10, 13, 34, 18, 11, 18, 18, 11, 11, 11, 15, 11], filas: [] },
  { n: 'Correcciones', h: H_CORR, w: [12, 17, 12, 20, 34, 26, 18, 18, 11, 26, 30], filas: [] },
  { n: 'Solicitudes', h: H_SOL, w: [16, 18, 12, 28, 20, 11, 11, 24, 34, 12, 30, 18, 28, 34], filas: [] },
  { n: 'Configuración', h: ['Parámetro', 'Valor'], w: [40, 22], filas: CONFIG_DEF },
  { n: 'Auditoría', h: H_AUD, w: [18, 30, 30, 80], filas: [] },
  { n: 'Credenciales', h: H_CRED, w: [12, 18, 40, 12, 18, 22], filas: [], protegida: true },
];

// ================================================================ Utilidades

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz_() { return ss_().getSpreadsheetTimeZone(); }
function hoja_(n) { return ss_().getSheetByName(n); }
function pad_(n) { return String(n).padStart(2, '0'); }
function num_(v, d) { const n = parseInt(v, 10); return isNaN(n) || n < 0 ? d : n; }
function si_(v) { return String(v || '').trim().toUpperCase().startsWith('S'); }
function norm_(s) { return String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function ahoraTxt_() { return Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm:ss'); }
function activo_(v) { return norm_(v) !== 'INACTIVO' && norm_(v) !== 'NO'; }

/** Documento normalizado: DNI numérico se completa a 8 dígitos; CE en mayúsculas. */
function dni_(v) {
  let s = String(v == null ? '' : v).trim().toUpperCase().replace(/\s/g, '');
  if (/^\d+$/.test(s) && s.length < 8) s = s.padStart(8, '0');
  return s;
}

function rol_(v) {
  const n = norm_(v);
  if (n.indexOf('GENERAL') >= 0) return ROL_GEN;
  if (n.indexOf('AREA') >= 0 || n.indexOf('ADMIN') === 0) return ROL_AREA;
  return ROL_TRAB;
}

function hora_(v, def) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'HH:mm');
  const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? pad_(m[1]) + ':' + m[2] : def;
}

function minutos_(h) {
  const m = String(h || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
}

function horaTxt_(min) { min = ((min % 1440) + 1440) % 1440; return pad_(Math.floor(min / 60)) + ':' + pad_(min % 60); }
function dur_(min) { return min == null ? '' : Math.floor(min / 60) + ':' + pad_(min % 60); }
function horas_(min) { return min == null ? '' : Math.round(min / 60 * 100) / 100; }

function fechaIso_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + pad_(m[2]) + '-' + pad_(m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function isoAFecha_(iso) { if (!iso) return ''; const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

function sumarDias_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1) + '-' + pad_(d.getUTCDate());
}

function difDias_(a, b) {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}

function diaSemana_(iso) {
  const p = iso.split('-').map(Number);
  return 'DLMXJVS'[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
}

function dias_(v) {
  const s = norm_(v).replace(/\s/g, '');
  const orden = 'LMXJVSD';
  const r = s.match(/^([LMXJVSD])-([LMXJVSD])$/);
  if (r) return orden.substring(orden.indexOf(r[1]), orden.indexOf(r[2]) + 1);
  return s ? s.replace(/[^LMXJVSD]/g, '') : 'LMXJV';
}

function hoyIso_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function ahoraMin_() { return minutos_(Utilities.formatDate(new Date(), tz_(), 'HH:mm')); }

function filas_(nombre, ncol) {
  const sh = hoja_(nombre);
  const n = sh ? sh.getLastRow() - 1 : 0;
  return n > 0 ? sh.getRange(2, 1, n, ncol).getValues() : [];
}

function fechaHoraMs_(fecha, hora) {
  try {
    const h = String(hora).length === 5 ? hora + ':00' : String(hora);
    return Utilities.parseDate(String(fecha) + ' ' + h, tz_(), 'dd/MM/yyyy HH:mm:ss').getTime();
  } catch (e) { return null; }
}

function idNuevo_(pref) {
  return pref + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100);
}

function error_(msg) { throw new Error(msg); }

// ================================================================ Caché (rapidez a la hora de entrada)

function cache_() { return CacheService.getScriptCache(); }

function verCache_() {
  const c = cache_();
  let v = c.get('ver');
  if (!v) { v = String(Date.now()); c.put('ver', v, 21600); }
  return v;
}

/** Se llama después de cualquier cambio en trabajadores, listas o programación. */
function invalidar_() {
  try { cache_().put('ver', String(Date.now()) + String(Math.random()).substring(2, 6), 21600); } catch (e) { }
}

function cacheado_(clave, ttl, fn) {
  const k = verCache_() + ':' + clave;
  try { const hit = cache_().get(k); if (hit) return JSON.parse(hit); } catch (e) { }
  const v = fn();
  try { const s = JSON.stringify(v); if (s.length < 95000) cache_().put(k, s, ttl); } catch (e) { }
  return v;
}

// ================================================================ Hojas y migración

function asegurarHojas_() {
  if (cache_().get('hojasOk:' + VERSION)) return;
  const ss = ss_();
  const migrados = migrarV2_();
  HOJAS.forEach(def => {
    let sh = ss.getSheetByName(def.n);
    if (!sh) {
      sh = ss.insertSheet(def.n);
      sh.getRange(1, 1, Math.max(1000, sh.getMaxRows ? sh.getMaxRows() : 1000), def.h.length).setNumberFormat('@');
      encabezado_(sh, def.h, def.w);
      if (def.filas.length) sh.getRange(2, 1, def.filas.length, def.h.length).setValues(def.filas);
      validaciones_(def.n, sh);
      if (def.protegida) proteger_(sh);
    } else {
      const actual = sh.getRange(1, 1, 1, def.h.length).getValues()[0];
      let falta = false;
      def.h.forEach((t, i) => { if (String(actual[i] || '') === '') falta = true; });
      if (falta) {
        const filas = Math.max(2, sh.getLastRow());
        def.h.forEach((t, i) => { if (String(actual[i] || '') === '') sh.getRange(1, i + 1, filas, 1).setNumberFormat('@'); });
        encabezado_(sh, def.h, def.w);
        if (def.n === 'Sedes' || def.n === 'Turnos') {
          const n = sh.getLastRow() - 1;
          const col = def.h.length;
          if (n > 0) {
            const vals = sh.getRange(2, col, n, 1).getValues().map(r => [r[0] || 'Activo']);
            sh.getRange(2, col, n, 1).setValues(vals);
          }
        }
      }
      if (def.n === 'Configuración') {
        const tiene = filas_('Configuración', 1).map(r => String(r[0]).trim());
        const faltan = CONFIG_DEF.filter(c => tiene.indexOf(c[0]) < 0);
        if (faltan.length) sh.getRange(sh.getLastRow() + 1, 1, faltan.length, 2).setValues(faltan);
      }
    }
  });
  // Listas desplegables actualizadas en hojas que ya existían (ej. tipos de solicitud nuevos), una vez por versión
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('validaciones') !== VERSION) {
    HOJAS.forEach(def => { const sh = ss.getSheetByName(def.n); if (sh) validaciones_(def.n, sh); });
    props.setProperty('validaciones', VERSION);
  }
  // Correcciones antiguas sin ID
  const corr = filas_('Correcciones', H_CORR.length);
  corr.forEach((r, i) => {
    if (String(r[0]).trim() && !String(r[7]).trim()) {
      hoja_('Correcciones').getRange(i + 2, 8, 1, 2).setValues([['C-ANT-' + (i + 2), 'VIGENTE']]);
    }
  });
  const h1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Hoja1') || ss.getSheetByName('Sheet1');
  if (h1 && h1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(h1);
  if (migrados !== null) {
    auditar_('Sistema', 'Migración a versión 3', migrados + ' trabajadores migrados con contraseña temporal ' + CLAVE_TEMPORAL);
    invalidar_();
  }
  try { cache_().put('hojasOk:' + VERSION, '1', 600); } catch (e) { }
}

/** Convierte la hoja Trabajadores de la v2 (DNI | Nombre | Activo | Sede | Turno | Cargo | Clave) al formato v3. */
function migrarV2_() {
  const sh = hoja_('Trabajadores');
  if (!sh) return null;
  const h = sh.getRange(1, 1, 1, 3).getValues()[0];
  if (norm_(h[0]) !== 'DNI' || norm_(h[2]).indexOf('ACTIVO') !== 0) return null;
  const n = sh.getLastRow() - 1;
  const viejas = n > 0 ? sh.getRange(2, 1, n, 7).getValues() : [];
  const ahora = ahoraTxt_();
  // Cargos: se unen las variantes de mayúsculas/minúsculas ("Obrero" y "obrero" son el mismo)
  const cargos = {};
  const canon = v => {
    const t = String(v || '').trim().replace(/\s+/g, ' ');
    if (!t) return '';
    const k = norm_(t);
    if (!cargos[k]) cargos[k] = t.charAt(0).toUpperCase() + t.slice(1);
    return cargos[k];
  };
  const nuevas = viejas.filter(r => String(r[0]).trim() && String(r[1]).trim()).map(r => {
    const doc = dni_(r[0]);
    return [/^\d{8}$/.test(doc) ? 'DNI' : 'CE', doc, String(r[1]).trim(), 'General', String(r[3] || '').trim(),
      String(r[4] || '').trim(), canon(r[5]), ROL_TRAB, norm_(r[2]) === 'NO' ? 'Inactivo' : 'Activo',
      '', '', 'Migración a v3', ahora, '', ''];
  });
  // 1) Copia de seguridad de la pestaña original antes de convertirla
  try {
    const copia = sh.copyTo(ss_());
    try { copia.setName('Trabajadores v2 (respaldo)'); } catch (e) { }
    copia.hideSheet();
  } catch (e) { }
  // 2) Quitar las listas desplegables antiguas (ej. SI/NO en la columna C) ANTES de escribir
  try { sh.getRange(1, 1, sh.getMaxRows(), Math.max(sh.getMaxColumns(), H_TRAB.length)).clearDataValidations(); } catch (e) { }
  sh.clear();
  sh.getRange(1, 1, Math.max(1000, nuevas.length + 10), H_TRAB.length).setNumberFormat('@');
  encabezado_(sh, H_TRAB, HOJAS[0].w);
  if (nuevas.length) sh.getRange(2, 1, nuevas.length, H_TRAB.length).setValues(nuevas);
  validaciones_('Trabajadores', sh);
  // Cargos usados pasan a la lista de cargos
  let shC = hoja_('Cargos');
  if (!shC) {
    shC = ss_().insertSheet('Cargos');
    shC.getRange(1, 1, 1000, 2).setNumberFormat('@');
    encabezado_(shC, ['Cargo', 'Estado'], [26, 10]);
  }
  const lista = Object.keys(cargos).map(k => [cargos[k], 'Activo']);
  if (lista.length) shC.getRange(shC.getLastRow() + 1, 1, lista.length, 2).setValues(lista);
  return nuevas.length;
}

function encabezado_(sh, headers, widths) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#2e7d32');
  sh.setFrozenRows(1);
  (widths || []).forEach((w, i) => sh.setColumnWidth(i + 1, w * 7));
}

function proteger_(sh) {
  try {
    const p = sh.protect().setDescription('Solo el sistema. No editar.');
    p.removeEditors(p.getEditors());
    if (p.canDomainEdit()) p.setDomainEdit(false);
    sh.hideSheet();
  } catch (e) { /* sin protección */ }
}

function lista_(sh, a1, valores) {
  try {
    sh.getRange(a1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(valores, true).setAllowInvalid(false).build());
  } catch (e) { }
}

function listaRango_(sh, a1, origen) {
  try {
    sh.getRange(a1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(origen, true).setAllowInvalid(true).build());
  } catch (e) { }
}

function validaciones_(nombre, sh) {
  const ss = ss_();
  if (nombre === 'Trabajadores') {
    lista_(sh, 'A2:A', ['DNI', 'CE']);
    if (ss.getSheetByName('Áreas')) listaRango_(sh, 'D2:D', ss.getSheetByName('Áreas').getRange('A2:A'));
    if (ss.getSheetByName('Sedes')) listaRango_(sh, 'E2:E', ss.getSheetByName('Sedes').getRange('A2:A'));
    if (ss.getSheetByName('Turnos')) listaRango_(sh, 'F2:F', ss.getSheetByName('Turnos').getRange('A2:A'));
    if (ss.getSheetByName('Cargos')) listaRango_(sh, 'G2:G', ss.getSheetByName('Cargos').getRange('A2:A'));
    lista_(sh, 'H2:H', ROLES);
    lista_(sh, 'I2:I', ['Activo', 'Inactivo']);
  }
  if (nombre === 'Áreas' || nombre === 'Cargos') lista_(sh, 'B2:B', ['Activo', 'Inactivo']);
  if (nombre === 'Sedes') { lista_(sh, 'E2:E', ['SI', 'NO']); lista_(sh, 'F2:F', ['Activo', 'Inactivo']); }
  if (nombre === 'Turnos') lista_(sh, 'G2:G', ['Activo', 'Inactivo']);
  if (nombre === 'Correcciones') lista_(sh, 'D2:D', ['ENTRADA', 'SALIDA']);
  if (nombre === 'Solicitudes') { lista_(sh, 'J2:J', ESTADOS_SOL); lista_(sh, 'E2:E', TIPOS_SOL); }
}

// ================================================================ Auditoría

function auditar_(usuario, accion, detalle) {
  try {
    const sh = hoja_('Auditoría');
    if (!sh) return;
    sh.getRange(sh.getLastRow() + 1, 1, 1, 4).setValues([[ahoraTxt_(), String(usuario || ''), String(accion || ''),
      String(detalle || '').substring(0, 5000)]]);
  } catch (e) { }
}

function quien_(s) { return s.w.nombre + ' (' + s.w.dni + ')'; }

const HOJAS_AUDITADAS = ['Trabajadores', 'Áreas', 'Cargos', 'Sedes', 'Turnos', 'Programación', 'Feriados',
  'Correcciones', 'Solicitudes', 'Configuración'];

/** Registra en Auditoría las ediciones hechas a mano en la hoja. */
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    const nombre = sh.getName();
    if (HOJAS_AUDITADAS.indexOf(nombre) < 0 || e.range.getRow() < 2) return;
    let quien = '';
    try { quien = (e.user && e.user.getEmail && e.user.getEmail()) || Session.getActiveUser().getEmail() || ''; } catch (x) { }
    const unaCelda = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
    const det = e.range.getA1Notation() + (unaCelda ? ': "' + (e.oldValue === undefined ? '' : e.oldValue) + '" → "' +
      (e.value === undefined ? '' : e.value) + '"' : ' (varias celdas)');
    auditar_((quien || 'Editor de la hoja') + ' [hoja]', 'Edición manual en ' + nombre, det);
    if (nombre === 'Correcciones' && e.range.getColumn() <= 5) {
      const fila = e.range.getRow();
      const v = sh.getRange(fila, 6, 1, 4).getValues()[0];
      if (!v[1]) sh.getRange(fila, 6, 1, 4).setValues([[quien || 'Editor de la hoja', ahoraTxt_(), v[2] || idNuevo_('C'), v[3] || 'VIGENTE']]);
    }
    if (nombre === 'Solicitudes' && e.range.getColumn() === 10) {
      sh.getRange(e.range.getRow(), 12, 1, 2).setValues([[ahoraTxt_(), (quien || 'Editor de la hoja') + ' [hoja]']]);
    }
    invalidar_();
  } catch (err) { }
}

// ================================================================ Lectura de datos

function config_() {
  const m = {};
  filas_('Configuración', 2).forEach(r => { m[String(r[0]).trim()] = r[1]; });
  const ha = m['Horas extra requieren aprobación (SI/NO)'];
  return {
    razon: String(m['Razón social'] || ''),
    ruc: String(m['RUC'] || ''),
    turnoDef: String(m['Turno por defecto'] || 'Administrativo').trim(),
    heMin: num_(m['Mínimo de horas extra (min)'], 30),
    heAprob: ha === undefined || ha === '' ? true : si_(ha),
    inicio: fechaIso_(m['Fecha de inicio del sistema (dd/mm/aaaa)']),
    principal: dni_(m['DNI del administrador principal'] || ''),
    resetPrincipal: si_(m['Restablecer contraseña del principal (SI/NO)']),
  };
}

function trabajadoresTodos_() {
  return filas_('Trabajadores', H_TRAB.length).map((r, i) => ({
    fila: i + 2, tipo: String(r[0] || '').trim() || 'DNI', dni: dni_(r[1]), nombre: String(r[2] || '').trim(),
    area: String(r[3] || '').trim(), sede: String(r[4] || '').trim(), turno: String(r[5] || '').trim(),
    cargo: String(r[6] || '').trim(), rol: rol_(r[7]), activo: activo_(r[8]), ingreso: fechaIso_(r[9]),
    aCargo: String(r[10] || '').split(',').map(x => x.trim()).filter(String),
    creado: String(r[11] || ''), fCreado: String(r[12] || ''), modificado: String(r[13] || ''), fModificado: String(r[14] || ''),
  })).filter(w => w.dni && w.nombre);
}

function listaSimple_(hoja) {
  return filas_(hoja, 2).filter(r => String(r[0]).trim()).map(r => ({ nombre: String(r[0]).trim(), activo: activo_(r[1]) }));
}

/** Datos que casi no cambian (se guardan en caché por 2 minutos). */
function base_() {
  return cacheado_('base', 120, () => {
    const turnos = {};
    filas_('Turnos', 7).forEach(r => {
      const n = String(r[0]).trim();
      const e = minutos_(hora_(r[1], '')), s = minutos_(hora_(r[2], ''));
      if (!n || e === null || s === null) return;
      turnos[norm_(n)] = { nombre: n, ent: e, sal: s, tol: num_(r[3], 10), ref: num_(r[4], 0), dias: dias_(r[5]),
        activo: activo_(r[6]) };
    });
    const sedes = {};
    filas_('Sedes', 6).forEach(r => {
      const n = String(r[0]).trim();
      if (!n) return;
      const lat = parseFloat(String(r[1]).replace(',', '.')), lng = parseFloat(String(r[2]).replace(',', '.'));
      sedes[norm_(n)] = { nombre: n, lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng,
        radio: num_(r[3], 200), validar: si_(r[4]), activo: activo_(r[5]) };
    });
    const feriados = {};
    filas_('Feriados', 2).forEach(r => { const f = fechaIso_(r[0]); if (f) feriados[f] = String(r[1] || 'Feriado'); });
    return { cfg: config_(), turnos, sedes, feriados, trab: trabajadoresTodos_(),
      areas: listaSimple_('Áreas'), cargos: listaSimple_('Cargos') };
  });
}

function solicitudes_() {
  return filas_('Solicitudes', H_SOL.length).map((r, i) => {
    const fecha = r[1] instanceof Date ? Utilities.formatDate(r[1], tz_(), 'dd/MM/yyyy HH:mm') : String(r[1]);
    return {
      fila: i + 2, id: String(r[0]), fecha, ms: fechaHoraMs_(fecha.substring(0, 10), fecha.substring(11, 16) || '00:00'),
      dni: dni_(r[2]), nombre: String(r[3]), tipo: norm_(r[4]), tipoTxt: String(r[4]),
      desde: fechaIso_(r[5]), hasta: fechaIso_(r[6]) || fechaIso_(r[5]), detalle: String(r[7] || ''),
      motivo: String(r[8] || ''), estado: norm_(r[9]) || 'PENDIENTE', respuesta: String(r[10] || ''),
      fResp: r[11] instanceof Date ? Utilities.formatDate(r[11], tz_(), 'dd/MM/yyyy HH:mm') : String(r[11] || ''),
      respPor: String(r[12] || ''), adjunto: String(r[13] || ''),
    };
  }).filter(s => s.dni && s.desde);
}

function programacion_() {
  return cacheado_('prog', 120, () => {
    const prog = {};
    filas_('Programación', 3).forEach(r => {
      const d = dni_(r[0]), f = fechaIso_(r[1]), t = String(r[2]).trim();
      if (!d || !f || !t) return;
      if (norm_(t) === 'HABITUAL') delete prog[d + '|' + f]; else prog[d + '|' + f] = t;
    });
    return prog;
  });
}

function aprobadas_() {
  return cacheado_('aprob', 120, () => solicitudes_().filter(s => s.estado === 'APROBADO')
    .map(s => ({ dni: s.dni, tipo: s.tipo, desde: s.desde, hasta: s.hasta, detalle: s.detalle, motivo: s.motivo, respPor: s.respPor })));
}

function correcciones_() {
  const corr = [];
  filas_('Correcciones', H_CORR.length).forEach(r => {
    const d = dni_(r[0]), f = fechaIso_(r[1]), h = hora_(r[2], ''), t = norm_(r[3]);
    if (!d || !f || !h || (t !== 'ENTRADA' && t !== 'SALIDA') || norm_(r[8]) === 'ANULADA') return;
    corr.push({ dni: d, dia: f, min: minutos_(h), tipo: t,
      origen: 'Corrección de ' + (String(r[5] || '').trim() || 'la hoja') + ': ' + String(r[4] || '') });
  });
  aprobadas_().filter(s => s.tipo === 'CORRECCION DE MARCA').forEach(s => {
    const m = norm_(s.detalle).match(/(ENTRADA|SALIDA)\D*(\d{1,2}:\d{2})/);
    if (m) corr.push({ dni: s.dni, dia: s.desde, min: minutos_(m[2]), tipo: m[1],
      origen: 'Solicitud aprobada' + (s.respPor ? ' por ' + s.respPor : '') + ': ' + s.motivo });
  });
  return corr;
}

/** Contexto para cálculos. ligero = sin correcciones (para marcar). */
function contexto_(ligero) {
  const b = base_();
  return { cfg: b.cfg, turnos: b.turnos, sedes: b.sedes, feriados: b.feriados, trab: b.trab, areas: b.areas,
    cargos: b.cargos, prog: programacion_(), aprobadas: aprobadas_(), corr: ligero ? [] : correcciones_(),
    hoy: hoyIso_(), ahora: ahoraMin_() };
}

function trabajador_(ctx, dni) { const d = dni_(dni); return ctx.trab.find(w => w.dni === d) || null; }

function solDe_(ctx, dni, dia, tipo) {
  return ctx.aprobadas.find(s => s.dni === dni && s.tipo === tipo && s.desde <= dia && dia <= s.hasta) || null;
}

function turnoDe_(ctx, w, dia) {
  const cambio = solDe_(ctx, w.dni, dia, 'CAMBIO DE TURNO');
  const nombre = ctx.prog[w.dni + '|' + dia] || (cambio ? cambio.detalle : '') || w.turno || ctx.cfg.turnoDef;
  if (norm_(nombre) === 'DESCANSO') return { nombre: 'DESCANSO', descanso: true, ent: 0, sal: 0, tol: 0, ref: 0, dias: '' };
  return ctx.turnos[norm_(nombre)] || ctx.turnos[norm_(ctx.cfg.turnoDef)] ||
    { nombre: '(sin turno)', ent: 480, sal: 1020, tol: 10, ref: 60, dias: 'LMXJV' };
}

/** Primer día que cuenta para un trabajador (fecha de inicio del sistema o de ingreso). */
function inicioDe_(ctx, w) {
  const a = ctx.cfg.inicio || '', b = w.ingreso || '';
  return a > b ? a : b;
}

/** Lee las marcaciones de un rango de días (solo las filas necesarias). */
function marcasRango_(desde, hasta) {
  const sh = hoja_('Marcaciones');
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const dias = sh.getRange(2, 10, n, 1).getValues();
  let ini = -1, fin = -1;
  for (let i = 0; i < n; i++) {
    const d = String(dias[i][0]);
    if (d >= desde && d <= hasta) { if (ini < 0) ini = i; fin = i; }
  }
  if (ini < 0) return [];
  return sh.getRange(2 + ini, 1, fin - ini + 1, H_MARC.length).getValues()
    .filter(r => String(r[9]) >= desde && String(r[9]) <= hasta)
    .map(r => ({
      id: String(r[0]), fecha: String(r[1]), hora: String(r[2]), dni: dni_(r[3]), nombre: String(r[4]), tipo: norm_(r[5]),
      dia: String(r[9]), foto: String(r[7] || ''), sede: String(r[11] || ''), lat: String(r[12] || ''),
      lng: String(r[13] || ''), dist: String(r[15] || ''), ubic: String(r[16] || ''), equipo: String(r[8] || ''),
    }));
}

// ================================================================ Cálculo de un día

function calcDia_(ctx, w, dia, marcas) {
  const t = turnoDe_(ctx, w, dia);
  const fer = ctx.feriados[dia] || '';
  const laborable = !t.descanso && t.dias.indexOf(diaSemana_(dia)) >= 0 && !fer;
  const ms = marcas.slice().sort((a, b) => a.min - b.min);
  let ent = null, sal = null, corr = false;
  const alertas = [], origenes = [];
  ms.forEach(m => {
    if (m.origen) { corr = true; origenes.push(m.origen); }
    if (m.ubic && ['FUERA', 'SIN GPS', 'FALSA'].indexOf(m.ubic) >= 0) alertas.push(m.tipo + ' ' + m.ubic);
    if (m.tipo === 'ENTRADA') { if (ent === null) ent = m.min; } else sal = m.min;
  });
  if (ent !== null && sal !== null && sal < ent) sal += 1440; // turno que cruza medianoche

  const r = {
    dia, fecha: isoAFecha_(dia), dni: w.dni, nombre: w.nombre, area: w.area || '', sede: w.sede || '', turno: t.nombre,
    horario: t.descanso ? '' : horaTxt_(t.ent) + '-' + horaTxt_(t.sal),
    ent: ent === null ? '' : horaTxt_(ent), sal: sal === null ? '' : horaTxt_(sal),
    trab: null, tarde: 0, tardeJust: false, he: 0, he25: 0, he35: 0, heEstado: '',
    estado: '', alerta: alertas.join('; '), correccion: corr, origenes: origenes.join(' | '), falta: false, laborable,
    asistio: ent !== null, enJornada: false, vacaciones: false, permiso: false, ausencia: '',
  };
  let aus = null;
  for (let i = 0; i < AUSENCIAS.length && !aus; i++) {
    if (solDe_(ctx, w.dni, dia, AUSENCIAS[i][0])) aus = AUSENCIAS[i];
  }
  const just = solDe_(ctx, w.dni, dia, 'PERMISO') || solDe_(ctx, w.dni, dia, 'JUSTIFICACION');

  if (ent !== null && sal !== null) r.trab = Math.max(0, sal - ent - (laborable ? t.ref : 0));
  if (ent !== null && laborable) {
    const dif = ent - t.ent;
    if (dif > t.tol) { r.tarde = dif; r.tardeJust = !!just; }
  }
  if (r.trab !== null) {
    let prog = 0;
    if (laborable) { prog = t.sal - t.ent; if (prog < 0) prog += 1440; prog -= t.ref; }
    let extra = r.trab - prog;
    if (extra < ctx.cfg.heMin) extra = 0;
    if (extra > 0) {
      r.he = extra; r.he25 = Math.min(extra, 120); r.he35 = extra - r.he25;
      r.heEstado = !ctx.cfg.heAprob || solDe_(ctx, w.dni, dia, 'HORAS EXTRA') ? 'Aprobada' : 'Por aprobar';
    }
  }

  if (!ms.length) {
    if (aus && (laborable || aus[0] === 'VACACIONES')) {
      r.estado = aus[1]; r.ausencia = aus[1];
      if (aus[0] === 'VACACIONES') r.vacaciones = true; else r.permiso = true;
    } else if (fer) r.estado = 'Feriado: ' + fer;
    else if (!laborable) r.estado = 'Descanso';
    else if (dia > ctx.hoy || (dia === ctx.hoy && ctx.ahora <= t.ent + t.tol)) r.estado = 'Pendiente';
    else { r.estado = 'Falta'; r.falta = true; }
  } else if (ent === null) {
    r.estado = 'Sin entrada';
  } else {
    r.estado = !laborable ? (fer ? 'Trabajó en feriado' : 'Trabajó en descanso')
      : r.tarde > 0 ? (r.tardeJust ? 'Tarde justificada' : 'Tarde') : 'Puntual';
    if (sal === null) {
      const nocturno = t.sal < t.ent;
      r.enJornada = dia === ctx.hoy || (nocturno && dia === sumarDias_(ctx.hoy, -1));
      r.estado += r.enJornada ? ' · en jornada' : ' · sin salida';
    }
  }
  return r;
}

/**
 * Filas por día y trabajador. filtro(w) decide a quién incluir.
 * Solo se calcula asistencia de rol Trabajador y desde su fecha de inicio.
 */
function resumenRango_(ctx, desde, hasta, filtro) {
  const porClave = {};
  const nombres = {};
  marcasRango_(desde, hasta).forEach(m => {
    const k = m.dia + '|' + m.dni;
    (porClave[k] = porClave[k] || []).push({ tipo: m.tipo, min: minutos_(m.hora), ubic: m.ubic });
    nombres[m.dni] = m.nombre;
  });
  ctx.corr.filter(c => c.dia >= desde && c.dia <= hasta).forEach(c => {
    const k = c.dia + '|' + c.dni;
    (porClave[k] = porClave[k] || []).push({ tipo: c.tipo, min: c.min, origen: c.origen });
  });
  const ws = ctx.trab.filter(w => w.rol === ROL_TRAB);
  Object.keys(nombres).forEach(d => {
    if (!ctx.trab.some(w => w.dni === d)) ws.push({ dni: d, nombre: nombres[d], activo: false, sede: '', turno: '', area: '', rol: ROL_TRAB });
  });
  ws.sort((a, b) => (a.area + '|' + a.sede + '|' + a.nombre).localeCompare(b.area + '|' + b.sede + '|' + b.nombre));
  const filas = [];
  const fin = hasta < ctx.hoy ? hasta : ctx.hoy;
  for (let dia = desde; dia <= fin; dia = sumarDias_(dia, 1)) {
    ws.forEach(w => {
      if (filtro && !filtro(w)) return;
      const ms = porClave[dia + '|' + w.dni] || [];
      if (!ms.length && (!w.activo || dia < inicioDe_(ctx, w))) return;
      filas.push(calcDia_(ctx, w, dia, ms));
    });
  }
  return filas;
}


// ================================================================ Credenciales (contraseñas cifradas)

function hashClave_(clave, salt) {
  let h = salt + ':' + clave;
  for (let i = 0; i < 300; i++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8);
    h = bytes.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0')).join('');
  }
  return h;
}

function credencial_(dni) {
  const sh = hoja_('Credenciales');
  const n = sh.getLastRow() - 1;
  if (n < 1) return null;
  const vals = sh.getRange(2, 1, n, H_CRED.length).getValues();
  for (let i = 0; i < n; i++) {
    if (dni_(vals[i][0]) === dni) {
      return { fila: i + 2, salt: String(vals[i][1]), hash: String(vals[i][2]), cambiar: si_(vals[i][3]),
        revision: Number(vals[i][5]) || 0 };
    }
  }
  return null;
}

function guardarClave_(dni, clave, cambiar) {
  const sh = hoja_('Credenciales');
  const salt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  const fila = [dni, salt, hashClave_(clave, salt), cambiar ? 'SI' : 'NO', ahoraTxt_()];
  const c = credencial_(dni);
  if (c) sh.getRange(c.fila, 1, 1, 5).setValues([fila]);
  else sh.getRange(sh.getLastRow() + 1, 1, 1, 6).setValues([fila.concat([''])]);
}

function claveCorrecta_(dni, clave) {
  const c = credencial_(dni);
  if (!c) return { ok: String(clave) === CLAVE_TEMPORAL, cambiar: true, nueva: true };
  return { ok: hashClave_(String(clave), c.salt) === c.hash, cambiar: c.cambiar, nueva: false };
}

/** 6 dígitos; no 1234, no repetidos (111111), no seguidos (123456 / 654321). */
function validarClaveNueva_(p) {
  p = String(p || '');
  if (!/^\d{6}$/.test(p)) return 'La contraseña debe tener exactamente 6 números.';
  if (p === CLAVE_TEMPORAL) return 'No puedes usar la contraseña temporal.';
  if (/^(\d)\1{5}$/.test(p)) return 'No uses el mismo número repetido (ej. 111111).';
  let sube = true, baja = true;
  for (let i = 1; i < 6; i++) {
    const d = p.charCodeAt(i) - p.charCodeAt(i - 1);
    if (d !== 1) sube = false;
    if (d !== -1) baja = false;
  }
  if (sube || baja) return 'No uses números seguidos (ej. 123456).';
  return '';
}

// ================================================================ Administrador principal

/** Crea o repara al administrador principal definido en Configuración. */
function asegurarPrincipal_() {
  const cfg = base_().cfg;
  const d = cfg.principal;
  if (!d) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (cfg.resetPrincipal) {
      guardarClave_(d, CLAVE_TEMPORAL, true);
      const filas = filas_('Configuración', 1);
      const i = filas.findIndex(r => String(r[0]).trim() === 'Restablecer contraseña del principal (SI/NO)');
      if (i >= 0) hoja_('Configuración').getRange(i + 2, 2).setValue('NO');
      auditar_('Sistema (Configuración)', 'Contraseña del administrador principal restablecida', d);
      invalidar_();
    }
    const todos = trabajadoresTodos_();
    const w = todos.find(x => x.dni === d);
    const sh = hoja_('Trabajadores');
    if (!w) {
      sh.getRange(sh.getLastRow() + 1, 1, 1, H_TRAB.length).setValues([[/^\d{8}$/.test(d) ? 'DNI' : 'CE', d,
        'Administrador principal', '', '', '', '', ROL_GEN, 'Activo', '', '', 'Sistema (Configuración)', ahoraTxt_(), '', '']]);
      auditar_('Sistema', 'Administrador principal creado', d);
      invalidar_();
    } else if (w.rol !== ROL_GEN || !w.activo) {
      sh.getRange(w.fila, 8, 1, 2).setValues([[ROL_GEN, 'Activo']]);
      sh.getRange(w.fila, 14, 1, 2).setValues([['Sistema (Configuración)', ahoraTxt_()]]);
      auditar_('Sistema', 'Administrador principal restablecido', d);
      invalidar_();
    }
  } finally {
    lock.releaseLock();
  }
}

// ================================================================ Sesiones (5 minutos sin uso)

const ERR_SESION = '[SESION] Tu sesión terminó. Vuelve a iniciar sesión.';

function crearSesion_(dni, cambiar) {
  const t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  cache_().put('ses:' + t, JSON.stringify({ dni, cambiar: !!cambiar }), MINUTOS_SESION * 60);
  return t;
}

/** Valida la sesión, la renueva y devuelve el usuario con sus permisos actuales. */
function sesion_(token, permitirCambio) {
  if (!token) error_(ERR_SESION);
  const k = 'ses:' + token;
  const raw = cache_().get(k);
  if (!raw) error_(ERR_SESION);
  const d = JSON.parse(raw);
  const ctx = contexto_(true);
  const w = trabajador_(ctx, d.dni);
  if (!w || !w.activo) { cache_().remove(k); error_('[SESION] Tu usuario está inactivo. Consulta con tu administrador.'); }
  if (d.cambiar && !permitirCambio) error_('[CAMBIAR] Debes cambiar tu contraseña antes de continuar.');
  cache_().put(k, raw, MINUTOS_SESION * 60);
  return { token, k, d, w, ctx, doc: w.dni, rol: w.rol, general: w.rol === ROL_GEN, admin: w.rol !== ROL_TRAB,
    areas: w.aCargo.map(norm_), cambiar: d.cambiar };
}

function requiereAdmin_(s) { if (!s.admin) error_('No tienes permiso para esta opción.'); }
function requiereGeneral_(s) { if (!s.general) error_('Solo el administrador general puede hacer esto.'); }

/** ¿Puede este administrador gestionar a este trabajador? */
function gestiona_(s, w) {
  if (!w || !s.admin) return false;
  if (s.general) return true;
  return w.rol === ROL_TRAB && s.areas.indexOf(norm_(w.area)) >= 0;
}

/** Trabajadores (rol Trabajador) cuya asistencia ve este administrador. */
function filtroAsistencia_(s) {
  return w => w.rol === ROL_TRAB && (s.general || s.areas.indexOf(norm_(w.area)) >= 0);
}

function permisos_(w) {
  const trab = w.rol === ROL_TRAB, gen = w.rol === ROL_GEN;
  return {
    marcar: trab, misMarcas: true, misSolicitudes: true, cambiarClave: true,
    resumen: !trab, aprobar: !trab, personal: !trab, programacion: !trab, correcciones: !trab,
    reportes: !trab, historial: !trab, listas: gen, roles: gen, conexion: gen,
  };
}

function datosUsuario_(w) {
  return { documento: w.dni, nombre: w.nombre, rol: w.rol, area: w.area, areas: w.aCargo, permisos: permisos_(w) };
}

function login_(b) {
  asegurarPrincipal_();
  const dni = dni_(b.documento);
  const ctx = contexto_(true);
  const w = trabajador_(ctx, dni);
  const v = w ? claveCorrecta_(dni, b.clave) : { ok: false };
  if (!w || !v.ok) { Utilities.sleep(700); error_('Documento o contraseña incorrectos.'); }
  if (!w.activo) error_('Tu usuario está inactivo. Consulta con tu administrador.');
  if (v.nueva) guardarClave_(dni, CLAVE_TEMPORAL, true);
  const token = crearSesion_(dni, v.cambiar);
  const res = { ok: true, token, debeCambiar: v.cambiar, usuario: datosUsuario_(w) };
  if (!v.cambiar && w.rol !== ROL_TRAB) {
    const s = { w, doc: dni, rol: w.rol, general: w.rol === ROL_GEN, admin: true, areas: w.aCargo.map(norm_), ctx };
    res.avisos = contarPendientes_(s);
  }
  return res;
}

function logout_(b) { if (b.token) cache_().remove('ses:' + b.token); return { ok: true }; }

function menu_(b) {
  const s = sesion_(b.token);
  return { ok: true, usuario: datosUsuario_(s.w), avisos: s.admin ? contarPendientes_(s) : null };
}

function cambiarClave_(b) {
  const s = sesion_(b.token, true);
  if (!claveCorrecta_(s.doc, b.actual).ok) error_('La contraseña actual no es correcta.');
  if (String(b.nueva) !== String(b.confirmacion)) error_('Las contraseñas nuevas no coinciden.');
  const msg = validarClaveNueva_(b.nueva);
  if (msg) error_(msg);
  guardarClave_(s.doc, String(b.nueva), false);
  cache_().put(s.k, JSON.stringify({ dni: s.doc, cambiar: false }), MINUTOS_SESION * 60);
  auditar_(quien_(s), 'Cambio de contraseña', s.cambiar ? 'Primer ingreso' : 'Cambio voluntario');
  const res = { ok: true, usuario: datosUsuario_(s.w) };
  if (s.admin) res.avisos = contarPendientes_(s);
  return res;
}


// ================================================================ Marcación (APK y web)

function carpeta_(nombre) {
  const it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}

/** Última marca de cada documento: primero en caché, si no, en las últimas 5000 filas. */
function ultimas_(dnis) {
  const res = {};
  const keys = dnis.map(d => 'um:' + d);
  let hit = {};
  try { hit = cache_().getAll(keys) || {}; } catch (e) { }
  const faltan = [];
  dnis.forEach(d => { if (hit['um:' + d]) res[d] = JSON.parse(hit['um:' + d]); else faltan.push(d); });
  if (faltan.length) {
    const sh = hoja_('Marcaciones');
    const last = sh.getLastRow();
    const set = {};
    faltan.forEach(d => { set[d] = true; });
    if (last > 1) {
      const ini = Math.max(2, last - 4999);
      const vals = sh.getRange(ini, 1, last - ini + 1, 10).getValues();
      for (let i = vals.length - 1; i >= 0; i--) {
        const d = dni_(vals[i][3]);
        if (!set[d] || res[d]) continue;
        const ms = fechaHoraMs_(String(vals[i][1]), String(vals[i][2]));
        res[d] = { tipo: norm_(vals[i][5]), dia: String(vals[i][9]), ms };
      }
    }
    const put = {};
    faltan.forEach(d => { put['um:' + d] = JSON.stringify(res[d] || { tipo: '', dia: '', ms: 0 }); if (!res[d]) res[d] = { tipo: '', dia: '', ms: 0 }; });
    try { cache_().putAll(put, 21600); } catch (e) { }
  }
  return res;
}

function recordarUltima_(dni, u) {
  try {
    const prev = cache_().get('um:' + dni);
    const p = prev ? JSON.parse(prev) : null;
    if (!p || !p.ms || (u.ms || 0) >= p.ms) cache_().put('um:' + dni, JSON.stringify(u), 21600);
  } catch (e) { }
}

/** Si hay una ENTRADA abierta de menos de 16 h, toca SALIDA de esa jornada. */
function siguienteMarca_(dni, ctx) {
  const u = ultimas_([dni])[dni];
  const ahora = new Date().getTime();
  if (u && u.tipo === 'ENTRADA' && u.ms && ahora - u.ms >= 0 && ahora - u.ms < 16 * 3600 * 1000) {
    return { tipo: 'SALIDA', dia: u.dia || ctx.hoy, ultima: u };
  }
  return { tipo: 'ENTRADA', dia: ctx.hoy, ultima: u && u.ms ? u : null };
}

/** Para el APK (con CLAVE): trabajadores que marcan, sedes y última marca de cada uno. */
function datos_() {
  const ctx = contexto_(true);
  const marcan = ctx.trab.filter(w => w.activo && w.rol === ROL_TRAB);
  const ult = ultimas_(marcan.map(w => w.dni));
  const trabajadores = marcan.map(w => {
    const t = turnoDe_(ctx, w, ctx.hoy);
    const lab = !t.descanso && t.dias.indexOf(diaSemana_(ctx.hoy)) >= 0 && !ctx.feriados[ctx.hoy];
    const u = ult[w.dni];
    return { dni: w.dni, nombre: w.nombre, sede: w.sede, area: w.area, turno: t.nombre,
      entrada: t.descanso ? '' : horaTxt_(t.ent), tolerancia: t.tol, laborable: lab,
      ultimaTipo: u && u.ms ? u.tipo : '', ultimaMs: u && u.ms ? u.ms : 0, ultimaDia: u && u.ms ? u.dia : '' };
  });
  const sedes = Object.keys(ctx.sedes).map(k => ctx.sedes[k]).filter(s => s.activo);
  return { ok: true, version: VERSION, fecha: ctx.hoy, trabajadores, sedes };
}

function marcar_(marcas) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return marcarSinBloqueo_(marcas);
  } finally {
    lock.releaseLock();
  }
}

function marcarSinBloqueo_(marcas) {
  const sh = hoja_('Marcaciones');
  const n = sh.getLastRow() - 1;
  const ids = n > 0 ? sh.getRange(Math.max(2, n + 1 - 20000), 1, Math.min(n, 20000), 1).getValues().map(r => String(r[0])) : [];
  const existentes = new Set(ids);
  const recibidos = [], filas = [];
  let carpeta = null;
  marcas.forEach(m => {
    const id = String(m.id || '');
    if (!id) return;
    recibidos.push(id);
    if (existentes.has(id)) return;
    existentes.add(id);
    let foto = '';
    if (m.foto) {
      try {
        if (!carpeta) carpeta = carpeta_(CARPETA_FOTOS);
        const blob = Utilities.newBlob(Utilities.base64Decode(m.foto), 'image/jpeg',
          (m.dia || '') + '_' + String(m.hora || '').replace(/:/g, '') + '_' + m.dni + '_' + m.tipo + '.jpg');
        foto = carpeta.createFile(blob).getUrl();
      } catch (err) { foto = 'Error al guardar foto'; }
    }
    const v = x => x === undefined || x === null ? '' : String(x);
    filas.push([id, v(m.fecha), v(m.hora), dni_(m.dni), v(m.nombre), v(m.tipo), v(m.tardanza), foto, v(m.equipo),
      v(m.dia), ahoraTxt_(), v(m.sede), v(m.lat), v(m.lng), v(m.precision), v(m.distancia), v(m.ubicacion)]);
    recordarUltima_(dni_(m.dni), { tipo: norm_(m.tipo), dia: v(m.dia), ms: fechaHoraMs_(v(m.fecha), v(m.hora)) || Date.now() });
  });
  if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, H_MARC.length).setValues(filas);
  return { ok: true, ids: recibidos };
}

function distancia_(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function trabajadorQueMarca_(ctx, dni) {
  const w = trabajador_(ctx, dni);
  if (!w) error_('Documento no registrado. Pide a tu administrador que te registre.');
  if (!w.activo) error_('Tu usuario está inactivo. No puedes marcar asistencia.');
  if (w.rol !== ROL_TRAB) error_('Los administradores no registran asistencia.');
  return w;
}

/** Web: datos al escribir el documento. */
function infoMarca_(b) {
  const ctx = contexto_(true);
  const w = trabajadorQueMarca_(ctx, b.documento);
  const sig = siguienteMarca_(w.dni, ctx);
  const t = turnoDe_(ctx, w, ctx.hoy);
  const s = ctx.sedes[norm_(w.sede)] || null;
  return {
    ok: true, nombre: w.nombre, siguiente: sig.tipo,
    turno: t.descanso ? 'Descanso' : t.nombre + ' (' + horaTxt_(t.ent) + ' - ' + horaTxt_(t.sal) + ')',
    sede: s ? { nombre: s.nombre, validar: s.validar } : (w.sede ? { nombre: w.sede, validar: false } : null),
  };
}

/** Web: registra la marca. Hora, tipo y validación de sede los decide el servidor. */
function marcarWeb_(p) {
  const ctx = contexto_(true);
  const w = trabajadorQueMarca_(ctx, p.documento);
  const foto = String(p.foto || '');
  if (foto.length < 1000) error_('Falta la selfie. Intenta de nuevo.');
  if (foto.length > 4000000) error_('La foto es muy grande. Intenta de nuevo.');
  const s = ctx.sedes[norm_(w.sede)] || null;
  const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
  const conGps = !isNaN(lat) && !isNaN(lng);
  let ubic, dist = '';
  if (!conGps) ubic = 'SIN GPS';
  else if (!s || s.lat === null || s.lng === null) ubic = 'SIN SEDE';
  else { dist = Math.round(distancia_(lat, lng, s.lat, s.lng)); ubic = dist <= s.radio ? 'DENTRO' : 'FUERA'; }
  if (s && s.validar) {
    if (ubic === 'SIN GPS') return { ok: false, ubicacion: true,
      error: 'No se pudo obtener tu ubicación. Activa la ubicación del celular, permite el acceso al navegador e intenta de nuevo.' };
    if (ubic === 'FUERA') error_('Estás a ' + dist + ' m de la sede "' + s.nombre + '". Debes estar a menos de ' + s.radio + ' m para marcar.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sig = siguienteMarca_(w.dni, ctx);
    const ahora = new Date();
    if (sig.ultima && sig.ultima.ms && ahora.getTime() - sig.ultima.ms < 60000) error_('Ya marcaste hace menos de un minuto.');
    const fecha = Utilities.formatDate(ahora, tz_(), 'dd/MM/yyyy');
    const hora = Utilities.formatDate(ahora, tz_(), 'HH:mm:ss');
    let tardanza = null;
    if (sig.tipo === 'ENTRADA' && !(sig.ultima && sig.ultima.dia === sig.dia)) {
      const t = turnoDe_(ctx, w, sig.dia);
      const lab = !t.descanso && t.dias.indexOf(diaSemana_(sig.dia)) >= 0 && !ctx.feriados[sig.dia];
      if (lab) { const dif = minutos_(hora) - t.ent; tardanza = dif > t.tol ? dif : 0; }
    }
    marcarSinBloqueo_([{
      id: 'WEB-' + Utilities.getUuid().substring(0, 13), dni: w.dni, nombre: w.nombre, tipo: sig.tipo, dia: sig.dia,
      fecha, hora, foto, equipo: ('Web ' + String(p.equipo || '')).substring(0, 60), sede: w.sede,
      lat: conGps ? lat.toFixed(6) : '', lng: conGps ? lng.toFixed(6) : '',
      precision: isNaN(parseFloat(p.precision)) ? '' : Math.round(parseFloat(p.precision)),
      distancia: dist, ubicacion: ubic,
    }]);
    return { ok: true, tipo: sig.tipo, nombre: w.nombre, fecha, hora: hora.substring(0, 5), tardanza,
      ubicacion: ubic, distancia: dist, sede: s ? s.nombre : w.sede };
  } finally {
    lock.releaseLock();
  }
}

// ================================================================ Trabajador: Mi Espacio y solicitudes

function filaApp_(r) {
  return { fecha: r.fecha, dia: r.dia, dni: r.dni, nombre: r.nombre, area: r.area, sede: r.sede, turno: r.turno,
    horario: r.horario, entrada: r.ent, salida: r.sal, trabajado: dur_(r.trab), tardanza: r.tarde,
    tardanzaJustificada: r.tardeJust, horasExtra: r.he ? dur_(r.he) : '', estadoHE: r.heEstado, estado: r.estado,
    alerta: r.alerta, falta: r.falta, enJornada: r.enJornada, asistio: r.asistio, correccion: r.origenes || '' };
}

function miResumen_(b) {
  const s = sesion_(b.token);
  const ctx = contexto_();
  if (s.rol !== ROL_TRAB) return { ok: true, nombre: s.w.nombre, filas: [], aviso: 'Los administradores no registran asistencia.' };
  const desde = sumarDias_(ctx.hoy, -31);
  const filas = resumenRango_(ctx, desde, ctx.hoy, w => w.dni === s.doc).reverse();
  return { ok: true, nombre: s.w.nombre, filas: filas.map(filaApp_) };
}

function solicitudApp_(x, ctx, revision) {
  const w = ctx ? trabajador_(ctx, x.dni) : null;
  return { id: x.id, fecha: x.fecha, dni: x.dni, nombre: x.nombre, area: w ? w.area : '', tipo: x.tipoTxt,
    desde: isoAFecha_(x.desde), hasta: isoAFecha_(x.hasta), detalle: x.detalle, motivo: x.motivo, estado: x.estado,
    respuesta: x.respuesta, fechaRespuesta: x.fResp, respondidoPor: x.respPor, tieneAdjunto: !!x.adjunto,
    nueva: revision !== undefined && x.estado === 'PENDIENTE' && (x.ms || 0) > revision };
}

function misSolicitudes_(b) {
  const s = sesion_(b.token);
  const lista = solicitudes_().filter(x => x.dni === s.doc).slice(-40).reverse().map(x => solicitudApp_(x, null));
  return { ok: true, solicitudes: lista };
}

function solicitar_(b) {
  const s = sesion_(b.token);
  const tipo = TIPOS_SOL.find(t => norm_(t) === norm_(b.tipo));
  if (!tipo) error_('Tipo de solicitud no válido.');
  const desde = fechaIso_(b.desde), hasta = fechaIso_(b.hasta) || desde;
  if (!desde || hasta < desde) error_('Revisa las fechas.');
  if (difDias_(desde, hasta) > 366) error_('El rango de fechas es demasiado largo.');
  const motivo = String(b.motivo || '').trim();
  if (!motivo) error_('Escribe el motivo.');
  const detalle = String(b.detalle || '').trim();
  const nt = norm_(tipo);
  if (nt === 'CORRECCION DE MARCA' && !/(ENTRADA|SALIDA)\D*\d{1,2}:\d{2}/.test(norm_(detalle))) {
    error_('Escribe ENTRADA o SALIDA y la hora, por ejemplo: ENTRADA 08:00');
  }
  if (nt === 'CAMBIO DE TURNO' && !s.ctx.turnos[norm_(detalle)]) {
    error_('Escribe el nombre exacto de un turno: ' + Object.keys(s.ctx.turnos).map(k => s.ctx.turnos[k].nombre).join(', '));
  }
  let adjunto = '';
  if (b.adjunto) {
    const a = String(b.adjunto);
    if (a.length > 6000000) error_('El adjunto es muy grande.');
    const ext = /pdf/i.test(String(b.adjuntoTipo || '')) ? 'pdf' : 'jpg';
    const blob = Utilities.newBlob(Utilities.base64Decode(a), ext === 'pdf' ? 'application/pdf' : 'image/jpeg',
      'Solicitud_' + s.doc + '_' + desde + '_' + Date.now() + '.' + ext);
    adjunto = carpeta_(CARPETA_ADJUNTOS).createFile(blob).getUrl();
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_('Solicitudes');
    const id = idNuevo_('S');
    sh.getRange(sh.getLastRow() + 1, 1, 1, H_SOL.length).setValues([[id,
      Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm'), s.doc, s.w.nombre, tipo, isoAFecha_(desde),
      isoAFecha_(hasta), detalle.substring(0, 200), motivo.substring(0, 500), 'PENDIENTE', '', '', '', adjunto]]);
    return { ok: true, id };
  } finally {
    lock.releaseLock();
  }
}

// ================================================================ Administración: solicitudes

/** ¿Este administrador atiende esta solicitud? Nadie atiende las suyas. Las de administradores van al general. */
function atiende_(s, sol, ctx) {
  if (!s.admin || sol.dni === s.doc) return false;
  const w = trabajador_(ctx, sol.dni);
  if (s.general) return true;
  return !!w && gestiona_(s, w);
}

function contarPendientes_(s) {
  const ctx = s.ctx || contexto_(true);
  const c = credencial_(s.doc);
  const rev = c ? c.revision : 0;
  let pend = 0, nuevas = 0;
  solicitudes_().forEach(x => {
    if (x.estado !== 'PENDIENTE' || !atiende_(s, x, ctx)) return;
    pend++;
    if ((x.ms || 0) > rev) nuevas++;
  });
  return { pendientes: pend, nuevas };
}

function solicitudesAdmin_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = s.ctx;
  const c = credencial_(s.doc);
  const rev = c ? c.revision : 0;
  let lista = solicitudes_().filter(x => atiende_(s, x, ctx));
  lista = b.todas ? lista.slice(-80) : lista.filter(x => x.estado === 'PENDIENTE');
  const out = lista.reverse().map(x => solicitudApp_(x, ctx, rev));
  if (!b.todas) {
    const sh = hoja_('Credenciales');
    if (c) sh.getRange(c.fila, 6).setValue(String(Date.now()));
  }
  return { ok: true, solicitudes: out };
}

function responder_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const estado = norm_(b.estado);
  if (estado !== 'APROBADO' && estado !== 'RECHAZADO') error_('Estado no válido.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sol = solicitudes_().find(x => x.id === String(b.id || ''));
    if (!sol) error_('No se encontró la solicitud.');
    if (sol.dni === s.doc) error_('No puedes responder tus propias solicitudes.');
    if (!atiende_(s, sol, s.ctx)) error_('Esta solicitud no corresponde a tus áreas.');
    if (sol.estado !== 'PENDIENTE') error_('Esta solicitud ya fue respondida (' + sol.estado + ').');
    hoja_('Solicitudes').getRange(sol.fila, 10, 1, 4).setValues([[estado, String(b.respuesta || '').substring(0, 300),
      Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm'), quien_(s)]]);
    invalidar_();
    auditar_(quien_(s), 'Solicitud ' + estado.toLowerCase(), sol.id + ' · ' + sol.tipoTxt + ' · ' + sol.nombre + ' (' + sol.dni + ')');
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function archivoDrive_(url) {
  const m = String(url || '').match(/[-\w]{25,}/);
  if (!m) error_('No hay archivo.');
  const blob = DriveApp.getFileById(m[0]).getBlob();
  return { base64: Utilities.base64Encode(blob.getBytes()), tipo: blob.getContentType() };
}

function adjunto_(b) {
  const s = sesion_(b.token);
  const sol = solicitudes_().find(x => x.id === String(b.id || ''));
  if (!sol || !sol.adjunto) error_('Esta solicitud no tiene adjunto.');
  if (sol.dni !== s.doc && !atiende_(s, sol, s.ctx)) error_('No tienes permiso para ver este adjunto.');
  const a = archivoDrive_(sol.adjunto);
  return { ok: true, base64: a.base64, tipo: a.tipo };
}

// ================================================================ Administración: resumen, marcaciones y fotos

function resumen_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = contexto_();
  const dia = fechaIso_(b.dia) || ctx.hoy;
  return { ok: true, filas: resumenRango_(ctx, dia, dia, filtroAsistencia_(s)).map(filaApp_) };
}

function marcasDia_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = s.ctx;
  const dia = fechaIso_(b.dia) || ctx.hoy;
  const f = filtroAsistencia_(s);
  const lista = marcasRango_(dia, dia).filter(m => { const w = trabajador_(ctx, m.dni); return w ? f(w) : s.general; })
    .map(m => ({ id: m.id, fecha: m.fecha, hora: m.hora, dni: m.dni, nombre: m.nombre, tipo: m.tipo, sede: m.sede,
      ubicacion: m.ubic, distancia: m.dist, tieneFoto: /drive\.google|^https?:/.test(m.foto), equipo: m.equipo,
      mapa: m.lat && m.lng ? 'https://maps.google.com/?q=' + m.lat + ',' + m.lng : '' }));
  lista.sort((a, b2) => a.hora < b2.hora ? -1 : 1);
  return { ok: true, marcas: lista };
}

function foto_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const sh = hoja_('Marcaciones');
  const n = sh.getLastRow() - 1;
  if (n < 1) error_('No encontrada.');
  const ids = sh.getRange(2, 1, n, 1).getValues();
  for (let i = n - 1; i >= 0; i--) {
    if (String(ids[i][0]) !== String(b.id)) continue;
    const r = sh.getRange(i + 2, 1, 1, 8).getValues()[0];
    const w = trabajador_(s.ctx, r[3]);
    if (!(w ? filtroAsistencia_(s)(w) : s.general)) error_('No tienes permiso para ver esta foto.');
    const a = archivoDrive_(r[7]);
    return { ok: true, base64: a.base64, tipo: a.tipo };
  }
  error_('No encontrada.');
}

// ================================================================ Administración: personal

function perfilApp_(w) {
  return { tipoDoc: w.tipo, documento: w.dni, nombre: w.nombre, area: w.area, sede: w.sede, turno: w.turno,
    cargo: w.cargo, rol: w.rol, estado: w.activo ? 'Activo' : 'Inactivo', ingreso: w.ingreso, areasACargo: w.aCargo,
    creadoPor: w.creado, fechaCreacion: w.fCreado, modificadoPor: w.modificado, fechaModificacion: w.fModificado };
}

function personalVer_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const lista = s.ctx.trab.filter(w => gestiona_(s, w)).sort((a, c) => a.nombre.localeCompare(c.nombre)).map(perfilApp_);
  return { ok: true, personal: lista };
}

function personalGuardar_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const p = b.perfil || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const todos = trabajadoresTodos_();
    const b0 = base_();
    const tipo = norm_(p.tipoDoc !== undefined ? p.tipoDoc : (existente_tipo_(p) || 'DNI')) === 'CE' ? 'CE' : 'DNI';
    const doc = dni_(p.documento);
    const existente = todos.find(w => w.dni === doc) || null;
    const nuevo = !!p.nuevo;
    if (nuevo && existente) error_('Ya existe un usuario con el documento ' + doc + '.');
    if (!nuevo && !existente) error_('No se encontró el usuario.');
    const crudo = String(p.documento || '').trim().toUpperCase();
    if (nuevo && tipo === 'DNI' && !/^\d{8}$/.test(crudo)) error_('El DNI debe tener 8 números.');
    if (nuevo && tipo === 'CE' && !/^[A-Z0-9]{9,12}$/.test(crudo)) error_('El carné de extranjería debe tener de 9 a 12 letras o números.');

    const ex = existente || {};
    const v = {
      nombre: String(p.nombre !== undefined ? p.nombre : ex.nombre || '').trim(),
      area: String(p.area !== undefined ? p.area : ex.area || '').trim(),
      sede: String(p.sede !== undefined ? p.sede : ex.sede || '').trim(),
      turno: String(p.turno !== undefined ? p.turno : ex.turno || '').trim(),
      cargo: String(p.cargo !== undefined ? p.cargo : ex.cargo || '').trim(),
      rol: p.rol !== undefined ? rol_(p.rol) : (existente ? existente.rol : ROL_TRAB),
      activo: p.estado !== undefined ? activo_(p.estado) : (existente ? existente.activo : true),
      ingreso: p.ingreso !== undefined ? fechaIso_(p.ingreso) : (existente ? existente.ingreso : ''),
      aCargo: p.areasACargo !== undefined ? (p.areasACargo || []).map(x => String(x).trim()).filter(String) : (existente ? existente.aCargo : []),
    };
    // Permisos
    if (!s.general) {
      if (v.rol !== ROL_TRAB) error_('Solo el administrador general puede asignar roles de administrador.');
      if (s.areas.indexOf(norm_(v.area)) < 0) error_('Solo puedes registrar personal de tus áreas.');
      if (existente && !gestiona_(s, existente)) error_('Este usuario no pertenece a tus áreas.');
    }
    if (existente && existente.dni === s.doc) {
      if (v.rol !== existente.rol) error_('No puedes cambiar tu propio rol.');
      if (!v.activo) error_('No puedes desactivarte a ti mismo.');
    }
    if (existente && existente.rol === ROL_GEN && existente.activo && (v.rol !== ROL_GEN || !v.activo)) {
      const otros = todos.filter(w => w.dni !== existente.dni && w.rol === ROL_GEN && w.activo).length;
      if (!otros) error_('Debe quedar al menos un administrador general activo.');
    }

    const activa = (lista, n) => lista.some(x => x.activo && norm_(x.nombre) === norm_(n));
    if (!v.nombre) error_('Escribe el nombre completo.');
    if (!activa(b0.areas, v.area)) error_('Elige un área válida.');
    if (!activa(b0.cargos, v.cargo)) error_('Elige un cargo válido.');
    if (v.rol === ROL_TRAB) {
      if (!b0.sedes[norm_(v.sede)] || !b0.sedes[norm_(v.sede)].activo) error_('Elige una sede válida.');
      if (!b0.turnos[norm_(v.turno)] || !b0.turnos[norm_(v.turno)].activo) error_('Elige un turno válido.');
    }
    if (v.rol === ROL_AREA) {
      if (!v.aCargo.length) error_('Elige al menos un área a cargo para el administrador de área.');
      v.aCargo.forEach(a => { if (!activa(b0.areas, a)) error_('Área a cargo no válida: ' + a); });
    } else v.aCargo = [];

    const sh = hoja_('Trabajadores');
    const fila = [tipo, doc, v.nombre, v.area, v.rol === ROL_TRAB ? v.sede : (v.sede || ''), v.rol === ROL_TRAB ? v.turno : (v.turno || ''),
      v.cargo, v.rol, v.activo ? 'Activo' : 'Inactivo', isoAFecha_(v.ingreso), v.aCargo.join(', ')];
    if (nuevo) {
      sh.getRange(sh.getLastRow() + 1, 1, 1, H_TRAB.length).setValues([fila.concat([quien_(s), ahoraTxt_(), '', ''])]);
      guardarClave_(doc, CLAVE_TEMPORAL, true);
      auditar_(quien_(s), 'Usuario creado', doc + ' · ' + v.nombre + ' · ' + v.rol + ' · ' + v.area);
    } else {
      const antes = [existente.tipo, existente.dni, existente.nombre, existente.area, existente.sede, existente.turno,
        existente.cargo, existente.rol, existente.activo ? 'Activo' : 'Inactivo', isoAFecha_(existente.ingreso), existente.aCargo.join(', ')];
      const cambios = [];
      fila.forEach((x, i) => { if (String(x) !== String(antes[i])) cambios.push(H_TRAB[i] + ': "' + antes[i] + '" → "' + x + '"'); });
      if (!cambios.length) return { ok: true, sinCambios: true };
      sh.getRange(existente.fila, 1, 1, 11).setValues([fila]);
      sh.getRange(existente.fila, 14, 1, 2).setValues([[quien_(s), ahoraTxt_()]]);
      auditar_(quien_(s), 'Usuario modificado', doc + ' · ' + cambios.join(' | '));
    }
    invalidar_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function existente_tipo_(p) {
  const w = trabajadoresTodos_().find(x => x.dni === dni_(p.documento));
  return w ? w.tipo : '';
}

function resetClave_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const w = trabajador_(contexto_(true), b.documento);
  if (!w) error_('No se encontró el usuario.');
  if (w.dni === s.doc) error_('Para tu propia contraseña usa "Cambiar mi contraseña".');
  if (!gestiona_(s, w)) error_('Este usuario no pertenece a tus áreas.');
  guardarClave_(w.dni, CLAVE_TEMPORAL, true);
  auditar_(quien_(s), 'Contraseña restablecida', w.dni + ' · ' + w.nombre);
  return { ok: true };
}

// ================================================================ Administración: listas (áreas, cargos, sedes, turnos, feriados)

function catalogos_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const b0 = base_();
  const sedes = Object.keys(b0.sedes).map(k => b0.sedes[k]);
  const turnos = Object.keys(b0.turnos).map(k => {
    const t = b0.turnos[k];
    return { nombre: t.nombre, entrada: horaTxt_(t.ent), salida: horaTxt_(t.sal), tolerancia: t.tol, refrigerio: t.ref,
      dias: t.dias, activo: t.activo };
  });
  const feriados = Object.keys(b0.feriados).sort().map(f => ({ fecha: f, descripcion: b0.feriados[f] }));
  let areas = b0.areas;
  if (!s.general) areas = areas.filter(a => s.areas.indexOf(norm_(a.nombre)) >= 0);
  return { ok: true, areas, todasLasAreas: s.general ? b0.areas : areas, cargos: b0.cargos, sedes, turnos, feriados,
    roles: s.general ? ROLES : [ROL_TRAB], esGeneral: s.general };
}

const CATALOGOS = {
  areas: { hoja: 'Áreas', cols: 2, colTrab: 4 },
  cargos: { hoja: 'Cargos', cols: 2, colTrab: 7 },
  sedes: { hoja: 'Sedes', cols: 6, colTrab: 5 },
  turnos: { hoja: 'Turnos', cols: 7, colTrab: 6 },
};

function catalogoGuardar_(b) {
  const s = sesion_(b.token);
  requiereGeneral_(s);
  const def = CATALOGOS[b.tipo];
  if (!def) error_('Lista no válida.');
  const d = b.datos || {};
  const nombre = String(d.nombre || '').trim();
  if (!nombre) error_('Escribe el nombre.');
  const estado = d.activo === false ? 'Inactivo' : 'Activo';
  let fila;
  if (b.tipo === 'areas' || b.tipo === 'cargos') fila = [nombre, estado];
  if (b.tipo === 'sedes') {
    const lat = d.lat === '' || d.lat == null ? '' : Number(d.lat), lng = d.lng === '' || d.lng == null ? '' : Number(d.lng);
    if ((lat !== '' && (isNaN(lat) || lat < -90 || lat > 90)) || (lng !== '' && (isNaN(lng) || lng < -180 || lng > 180))) error_('Coordenadas no válidas.');
    const radio = num_(d.radio, 0);
    if (radio < 20 || radio > 5000) error_('El radio debe estar entre 20 y 5000 metros.');
    if (d.validar && (lat === '' || lng === '')) error_('Para validar la ubicación, la sede necesita coordenadas.');
    fila = [nombre, lat === '' ? '' : String(lat), lng === '' ? '' : String(lng), String(radio), d.validar ? 'SI' : 'NO', estado];
  }
  if (b.tipo === 'turnos') {
    const e = hora_(d.entrada, ''), sa = hora_(d.salida, '');
    if (!e || !sa) error_('Escribe la hora de entrada y de salida (ej. 08:00).');
    const dias = dias_(d.dias);
    if (!dias) error_('Elige al menos un día laborable.');
    fila = [nombre, e, sa, String(num_(d.tolerancia, 0)), String(num_(d.refrigerio, 0)), dias, estado];
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_(def.hoja);
    const vals = filas_(def.hoja, def.cols);
    const original = String(b.original || '').trim();
    const idx = original ? vals.findIndex(r => norm_(r[0]) === norm_(original)) : -1;
    if (original && idx < 0) error_('No se encontró "' + original + '".');
    const dup = vals.findIndex(r => norm_(r[0]) === norm_(nombre));
    if (dup >= 0 && dup !== idx) error_('Ya existe "' + nombre + '".');
    if (idx >= 0) {
      const antes = vals[idx].map(String);
      sh.getRange(idx + 2, 1, 1, def.cols).setValues([fila]);
      // Renombrar: actualizar a los trabajadores (y programación si es turno)
      if (norm_(original) !== norm_(nombre) || original !== nombre) {
        const trab = filas_('Trabajadores', H_TRAB.length);
        trab.forEach((r, i) => {
          if (norm_(r[def.colTrab - 1]) === norm_(original)) hoja_('Trabajadores').getRange(i + 2, def.colTrab).setValue(nombre);
          if (b.tipo === 'areas' && String(r[10]).trim()) {
            const lista = String(r[10]).split(',').map(x => x.trim());
            if (lista.some(x => norm_(x) === norm_(original))) {
              hoja_('Trabajadores').getRange(i + 2, 11).setValue(lista.map(x => norm_(x) === norm_(original) ? nombre : x).join(', '));
            }
          }
        });
        if (b.tipo === 'turnos') {
          filas_('Programación', 3).forEach((r, i) => {
            if (norm_(r[2]) === norm_(original)) hoja_('Programación').getRange(i + 2, 3).setValue(nombre);
          });
        }
      }
      auditar_(quien_(s), 'Lista ' + def.hoja + ' modificada', JSON.stringify(antes) + ' → ' + JSON.stringify(fila));
    } else {
      sh.getRange(sh.getLastRow() + 1, 1, 1, def.cols).setValues([fila]);
      auditar_(quien_(s), 'Lista ' + def.hoja + ': nuevo', JSON.stringify(fila));
    }
    invalidar_();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function feriadoGuardar_(b) {
  const s = sesion_(b.token);
  requiereGeneral_(s);
  const f = fechaIso_(b.fecha);
  if (!f) error_('Fecha no válida.');
  const sh = hoja_('Feriados');
  const vals = filas_('Feriados', 2);
  const idx = vals.findIndex(r => fechaIso_(r[0]) === f);
  if (b.accion === 'quitar') {
    if (idx < 0) error_('Ese feriado no existe.');
    sh.deleteRow(idx + 2);
    auditar_(quien_(s), 'Feriado quitado', isoAFecha_(f) + ' · ' + vals[idx][1]);
  } else {
    const desc = String(b.descripcion || '').trim() || 'Feriado';
    if (idx >= 0) sh.getRange(idx + 2, 2).setValue(desc);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 2).setValues([[isoAFecha_(f), desc]]);
    auditar_(quien_(s), 'Feriado agregado', isoAFecha_(f) + ' · ' + desc);
  }
  invalidar_();
  return { ok: true };
}

// ================================================================ Administración: programación de turnos

function programacionVer_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = contexto_(true);
  const desde = fechaIso_(b.desde) || ctx.hoy;
  const dias = Math.min(Math.max(num_(b.dias, 7), 1), 14);
  const f = filtroAsistencia_(s);
  const personal = ctx.trab.filter(w => w.activo && f(w)).sort((a, c) => (a.area + a.nombre).localeCompare(c.area + c.nombre)).map(w => {
    const d = [];
    for (let i = 0; i < dias; i++) {
      const dia = sumarDias_(desde, i);
      const t = turnoDe_(ctx, w, dia);
      d.push({ fecha: dia, turno: t.nombre, horario: t.descanso ? '' : horaTxt_(t.ent) + '-' + horaTxt_(t.sal),
        descanso: !!t.descanso || t.dias.indexOf(diaSemana_(dia)) < 0, programado: !!ctx.prog[w.dni + '|' + dia],
        feriado: ctx.feriados[dia] || '' });
    }
    return { documento: w.dni, nombre: w.nombre, area: w.area, turnoHabitual: w.turno, dias: d };
  });
  return { ok: true, desde, personal };
}

function programacionGuardar_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = s.ctx;
  const desde = fechaIso_(b.desde), hasta = fechaIso_(b.hasta) || desde;
  if (!desde || hasta < desde) error_('Revisa las fechas.');
  if (difDias_(desde, hasta) > 62) error_('Programa como máximo 2 meses a la vez.');
  const turno = String(b.turno || '').trim();
  let valor;
  if (norm_(turno) === 'DESCANSO') valor = 'DESCANSO';
  else if (norm_(turno) === 'HABITUAL') valor = 'HABITUAL';
  else {
    const t = ctx.turnos[norm_(turno)];
    if (!t || !t.activo) error_('Turno no válido.');
    valor = t.nombre;
  }
  const docs = (b.documentos || []).map(dni_);
  if (!docs.length) error_('Elige al menos un trabajador.');
  const f = filtroAsistencia_(s);
  docs.forEach(d => { const w = trabajador_(ctx, d); if (!w || !f(w)) error_('No puedes programar a ' + d + '.'); });
  const filas = [];
  const q = quien_(s), ahora = ahoraTxt_();
  for (let dia = desde; dia <= hasta; dia = sumarDias_(dia, 1)) docs.forEach(d => filas.push([d, isoAFecha_(dia), valor, q, ahora]));
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_('Programación');
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, 5).setValues(filas);
  } finally {
    lock.releaseLock();
  }
  invalidar_();
  auditar_(q, 'Programación de turnos', valor + ' · ' + isoAFecha_(desde) + ' al ' + isoAFecha_(hasta) + ' · ' + docs.join(', '));
  return { ok: true, registros: filas.length };
}

// ================================================================ Administración: correcciones de marcas

function correccionesVer_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = s.ctx;
  const hasta = fechaIso_(b.hasta) || ctx.hoy;
  const desde = fechaIso_(b.desde) || sumarDias_(hasta, -31);
  const f = filtroAsistencia_(s);
  const lista = [];
  filas_('Correcciones', H_CORR.length).forEach(r => {
    const dia = fechaIso_(r[1]);
    if (!dia || dia < desde || dia > hasta) return;
    const w = trabajador_(ctx, r[0]);
    if (!(w ? f(w) : s.general)) return;
    lista.push({ id: String(r[7]), documento: dni_(r[0]), nombre: w ? w.nombre : '', fecha: isoAFecha_(dia), hora: hora_(r[2], ''),
      tipo: norm_(r[3]), motivo: String(r[4]), registradoPor: String(r[5]), fechaRegistro: String(r[6]),
      estado: norm_(r[8]) || 'VIGENTE', anuladoPor: String(r[9] || ''), motivoAnulacion: String(r[10] || '') });
  });
  return { ok: true, correcciones: lista.reverse() };
}

function correccionAgregar_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = s.ctx;
  const w = trabajador_(ctx, b.documento);
  if (!w || !filtroAsistencia_(s)(w)) error_('No puedes corregir marcas de este trabajador.');
  if (w.dni === s.doc) error_('No puedes corregir tus propias marcas.');
  const dia = fechaIso_(b.fecha);
  if (!dia || dia > ctx.hoy) error_('Fecha no válida.');
  const hora = hora_(b.hora, '');
  if (!hora) error_('Hora no válida (ej. 08:00).');
  const tipo = norm_(b.tipo);
  if (tipo !== 'ENTRADA' && tipo !== 'SALIDA') error_('Elige ENTRADA o SALIDA.');
  const motivo = String(b.motivo || '').trim();
  if (!motivo) error_('El motivo es obligatorio.');
  const id = idNuevo_('C');
  const sh = hoja_('Correcciones');
  sh.getRange(sh.getLastRow() + 1, 1, 1, H_CORR.length).setValues([[w.dni, isoAFecha_(dia), hora, tipo, motivo.substring(0, 300),
    quien_(s), ahoraTxt_(), id, 'VIGENTE', '', '']]);
  auditar_(quien_(s), 'Corrección de marca', id + ' · ' + w.nombre + ' (' + w.dni + ') · ' + tipo + ' ' + isoAFecha_(dia) + ' ' + hora + ' · ' + motivo);
  return { ok: true, id };
}

function correccionAnular_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const motivo = String(b.motivo || '').trim();
  if (!motivo) error_('Escribe el motivo de la anulación.');
  const vals = filas_('Correcciones', H_CORR.length);
  const idx = vals.findIndex(r => String(r[7]) === String(b.id));
  if (idx < 0) error_('No se encontró la corrección.');
  const r = vals[idx];
  const w = trabajador_(s.ctx, r[0]);
  if (!(w ? filtroAsistencia_(s)(w) : s.general)) error_('No tienes permiso sobre esta corrección.');
  if (norm_(r[8]) === 'ANULADA') error_('Ya estaba anulada.');
  hoja_('Correcciones').getRange(idx + 2, 9, 1, 3).setValues([['ANULADA', quien_(s) + ' · ' + ahoraTxt_(), motivo.substring(0, 300)]]);
  auditar_(quien_(s), 'Corrección anulada', String(b.id) + ' · ' + motivo);
  return { ok: true };
}


// ================================================================ Reportes en Excel

/** Escribe una tabla. tipos: t=texto, n=número, d=decimal, p=porcentaje. */
function tabla_(ss, nombre, titulo, headers, tipos, filas, widths) {
  const sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
  sh.clear();
  let fila0 = 1;
  if (titulo && titulo.length) {
    sh.getRange(1, 1, titulo.length, 1).setNumberFormat('@');
    sh.getRange(1, 1, titulo.length, 1).setValues(titulo.map(t => [t]));
    sh.getRange(1, 1).setFontWeight('bold').setFontSize(13);
    fila0 = titulo.length + 2;
  }
  sh.getRange(fila0, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#2e7d32');
  sh.setFrozenRows(fila0);
  (widths || []).forEach((w, i) => sh.setColumnWidth(i + 1, w * 7));
  if (filas.length) {
    tipos.forEach((t, i) => {
      const fmt = t === 'n' ? '0' : t === 'd' ? '0.00' : t === 'p' ? '0.0%' : '@';
      sh.getRange(fila0 + 1, i + 1, filas.length, 1).setNumberFormat(fmt);
    });
    sh.getRange(fila0 + 1, 1, filas.length, headers.length).setValues(filas);
  }
  return sh;
}

function escribirReportes_(ss, ctx, desde, hasta, filas, marcas, alcance) {
  const periodo = 'Del ' + isoAFecha_(desde) + ' al ' + isoAFecha_(hasta) + (alcance ? '   ·   ' + alcance : '');

  tabla_(ss, 'R-Resumen diario', null,
    ['Fecha', 'DNI', 'Nombre', 'Área', 'Sede', 'Turno', 'Horario', 'Entrada', 'Salida', 'Horas trabajadas', 'Horas (decimal)',
      'Tardanza (min)', 'Horas extra', 'HE 25% (h)', 'HE 35% (h)', 'Estado HE', 'Estado', 'Alerta de ubicación', 'Corrección'],
    ['t', 't', 't', 't', 't', 't', 't', 't', 't', 't', 'd', 'n', 't', 'd', 'd', 't', 't', 't', 't'],
    filas.map(r => [r.fecha, r.dni, r.nombre, r.area, r.sede, r.turno, r.horario, r.ent, r.sal, dur_(r.trab), horas_(r.trab),
      r.tarde, r.he ? dur_(r.he) : '', r.he ? horas_(r.he25) : '', r.he ? horas_(r.he35) : '', r.heEstado, r.estado,
      r.alerta, r.origenes || '']),
    [11, 11, 28, 16, 18, 14, 12, 8, 8, 14, 13, 13, 11, 10, 10, 12, 24, 22, 40]);

  const tot = {};
  filas.forEach(r => {
    const t = tot[r.dni] = tot[r.dni] || { dni: r.dni, nombre: r.nombre, area: r.area, sede: r.sede, prog: 0, asis: 0, faltas: 0,
      tard: 0, tardMin: 0, tardJ: 0, perm: 0, vac: 0, trab: 0, he25: 0, he35: 0, hePend: 0 };
    if (r.laborable) t.prog++;
    if (r.asistio) t.asis++;
    if (r.falta) t.faltas++;
    if (r.tarde > 0) { if (r.tardeJust) t.tardJ++; else { t.tard++; t.tardMin += r.tarde; } }
    if (r.permiso) t.perm++;
    if (r.vacaciones) t.vac++;
    if (r.trab) t.trab += r.trab;
    if (r.he) { if (r.heEstado === 'Aprobada') { t.he25 += r.he25; t.he35 += r.he35; } else t.hePend += r.he; }
  });
  const T = Object.keys(tot).map(k => tot[k]);
  tabla_(ss, 'R-Totales', ['TOTALES POR TRABAJADOR', periodo],
    ['DNI', 'Nombre', 'Área', 'Sede', 'Días programados', 'Asistencias', 'Faltas', 'Tardanzas', 'Min. tardanza',
      'Tardanzas justificadas', 'Permisos y licencias', 'Vacaciones', 'Horas trabajadas', 'HE 25% aprobadas (h)',
      'HE 35% aprobadas (h)', 'HE por aprobar (h)', '% Puntualidad', '% Ausentismo'],
    ['t', 't', 't', 't', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'd', 'd', 'd', 'd', 'p', 'p'],
    T.map(t => [t.dni, t.nombre, t.area, t.sede, t.prog, t.asis, t.faltas, t.tard, t.tardMin, t.tardJ, t.perm, t.vac,
      horas_(t.trab), horas_(t.he25), horas_(t.he35), horas_(t.hePend),
      t.asis ? (t.asis - t.tard) / t.asis : 0, t.prog ? t.faltas / t.prog : 0]),
    [11, 28, 16, 18, 15, 11, 8, 10, 12, 18, 17, 10, 15, 18, 18, 16, 13, 12]);

  const grupo = (clave, titulo, hoja) => {
    const g = {};
    T.forEach(t => {
      const k = t[clave] || '(sin ' + clave + ')';
      const x = g[k] = g[k] || { n: 0, prog: 0, asis: 0, faltas: 0, tard: 0, he: 0, trab: 0 };
      x.n++; x.prog += t.prog; x.asis += t.asis; x.faltas += t.faltas; x.tard += t.tard; x.he += t.he25 + t.he35; x.trab += t.trab;
    });
    tabla_(ss, hoja, [titulo, periodo],
      [clave === 'area' ? 'Área' : 'Sede', 'Trabajadores', 'Días programados', 'Asistencias', 'Faltas', 'Tardanzas',
        'Horas trabajadas', 'HE aprobadas (h)', '% Puntualidad', '% Ausentismo'],
      ['t', 'n', 'n', 'n', 'n', 'n', 'd', 'd', 'p', 'p'],
      Object.keys(g).map(k => { const x = g[k]; return [k, x.n, x.prog, x.asis, x.faltas, x.tard, horas_(x.trab), horas_(x.he),
        x.asis ? (x.asis - x.tard) / x.asis : 0, x.prog ? x.faltas / x.prog : 0]; }),
      [24, 12, 15, 11, 8, 10, 15, 15, 13, 12]);
  };
  grupo('area', 'RESUMEN POR ÁREA', 'R-Por área');
  grupo('sede', 'RESUMEN POR SEDE', 'R-Por sede');

  tabla_(ss, 'R-Horas extra', ['HORAS EXTRA (SOBRETIEMPO)', periodo,
    'Referencia: primeras 2 horas con recargo mínimo de 25% y las siguientes con 35% (verificar con su asesor laboral).'],
    ['Fecha', 'DNI', 'Nombre', 'Área', 'Turno', 'Horario', 'Entrada', 'Salida', 'Horas extra', 'HE 25% (h)', 'HE 35% (h)', 'Estado'],
    ['t', 't', 't', 't', 't', 't', 't', 't', 't', 'd', 'd', 't'],
    filas.filter(r => r.he > 0).map(r => [r.fecha, r.dni, r.nombre, r.area, r.turno, r.horario, r.ent, r.sal, dur_(r.he),
      horas_(r.he25), horas_(r.he35), r.heEstado]),
    [11, 11, 28, 16, 14, 12, 8, 8, 11, 10, 10, 12]);

  tabla_(ss, 'R-Alertas ubicación', ['MARCACIONES FUERA DE SEDE O SIN GPS', periodo],
    ['Fecha', 'Hora', 'DNI', 'Nombre', 'Tipo', 'Sede', 'Ubicación', 'Distancia (m)', 'Mapa'],
    ['t', 't', 't', 't', 't', 't', 't', 't', 't'],
    marcas.filter(m => ['FUERA', 'SIN GPS', 'FALSA'].indexOf(m.ubic) >= 0).map(m => [m.fecha, m.hora, m.dni, m.nombre, m.tipo,
      m.sede, m.ubic, m.dist, m.lat && m.lng ? 'https://maps.google.com/?q=' + m.lat + ',' + m.lng : '']),
    [11, 9, 11, 28, 10, 18, 11, 13, 40]);

  const reg = filas.filter(r => r.asistio || r.falta || r.vacaciones || r.permiso || r.estado === 'Sin entrada');
  let i = 0;
  tabla_(ss, 'R-Registro SUNAFIL', ['REGISTRO DE CONTROL DE ASISTENCIA',
    'Empleador: ' + (ctx.cfg.razon || '(completar Razón social en Configuración)') + '   RUC: ' + (ctx.cfg.ruc || '(completar)'),
    periodo + '   ·   Generado: ' + Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm')],
    ['N°', 'DNI', 'Apellidos y nombres', 'Fecha', 'Hora de ingreso', 'Hora de salida', 'Sobretiempo (h:mm)', 'Observaciones'],
    ['n', 't', 't', 't', 't', 't', 't', 't'],
    reg.map(r => [++i, r.dni, r.nombre, r.fecha, r.ent, r.sal, r.he && r.heEstado === 'Aprobada' ? dur_(r.he) : '',
      [r.estado === 'Puntual' ? '' : r.estado, r.origenes ? 'Incluye corrección — ' + r.origenes : ''].filter(String).join(' · ')]),
    [6, 11, 32, 11, 14, 14, 17, 60]);
}

/** Reporte para la app: crea un Excel temporal con los datos que le corresponden al administrador. */
function reporte_(b) {
  const s = sesion_(b.token);
  requiereAdmin_(s);
  const ctx = contexto_();
  const desde = fechaIso_(b.desde), hasta = fechaIso_(b.hasta);
  if (!desde || !hasta || hasta < desde) error_('Revisa las fechas.');
  if (difDias_(desde, hasta) > 92) error_('El rango máximo es de 3 meses.');
  const f = filtroAsistencia_(s);
  const filas = resumenRango_(ctx, desde, hasta, f);
  const marcas = marcasRango_(desde, hasta).filter(m => { const w = trabajador_(ctx, m.dni); return w ? f(w) : s.general; });
  const alcance = s.general ? 'Todas las áreas' : 'Áreas: ' + s.w.aCargo.join(', ');
  const tmp = SpreadsheetApp.create('Reporte asistencia (temporal) ' + Date.now());
  try {
    escribirReportes_(tmp, ctx, desde, hasta, filas, marcas, alcance);
    const primera = tmp.getSheets()[0];
    if (primera.getName().indexOf('R-') !== 0) tmp.deleteSheet(primera);
    SpreadsheetApp.flush();
    const resp = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) error_('No se pudo generar el Excel (' + resp.getResponseCode() + ').');
    auditar_(quien_(s), 'Reporte descargado', isoAFecha_(desde) + ' al ' + isoAFecha_(hasta) + ' · ' + alcance);
    return { ok: true, nombre: 'asistencia_' + desde + '_al_' + hasta + '.xlsx',
      base64: Utilities.base64Encode(resp.getBlob().getBytes()), filas: filas.length };
  } finally {
    try { DriveApp.getFileById(tmp.getId()).setTrashed(true); } catch (e) { }
  }
}

// ================================================================ Menú de la hoja, panel y respaldos

function esEditor_() {
  try { return !!Session.getActiveUser().getEmail(); } catch (e) { return false; }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Asistencia')
    .addItem('Generar reportes por fechas', 'generarReportes')
    .addItem('Actualizar panel de hoy', 'actualizarPanel')
    .addItem('Activar panel automático (cada 10 min)', 'activarPanelAutomatico')
    .addSeparator()
    .addItem('Hacer copia de seguridad ahora', 'respaldoManual')
    .addItem('Activar copia de seguridad semanal', 'activarRespaldoSemanal')
    .addSeparator()
    .addItem('Preparar hojas', 'prepararHojas')
    .addToUi();
}

function prepararHojas() {
  try { cache_().remove('hojasOk:' + VERSION); } catch (e) { }
  asegurarHojas_();
  HOJAS.forEach(d => { const sh = hoja_(d.n); if (sh) validaciones_(d.n, sh); if (sh && d.protegida) proteger_(sh); });
  invalidar_();
  asegurarPrincipal_();
  SpreadsheetApp.getUi().alert('Listo. Escribe el "DNI del administrador principal" en la pestaña Configuración. ' +
    'Esa persona entra a la app con su DNI y la contraseña temporal ' + CLAVE_TEMPORAL + ', y desde ahí registra al resto.');
}

function activarPanelAutomatico() {
  if (!esEditor_()) return;
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'actualizarPanel').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('actualizarPanel').timeBased().everyMinutes(10).create();
  actualizarPanel();
  SpreadsheetApp.getUi().alert('El panel "Panel hoy" se actualizará automáticamente cada 10 minutos.');
}

function actualizarPanel() {
  if (cache_().get('panelReciente')) return;
  cache_().put('panelReciente', '1', 90);
  asegurarHojas_();
  const ctx = contexto_();
  const filas = resumenRango_(ctx, ctx.hoy, ctx.hoy);
  const g = {};
  filas.forEach(r => {
    const k = (r.area || '(sin área)') + ' · ' + (r.sede || '(sin sede)');
    const x = g[k] = g[k] || [k, 0, 0, 0, 0, 0, 0];
    x[1]++; if (r.enJornada) x[2]++; if (r.asistio && r.sal) x[3]++; if (r.estado === 'Pendiente') x[4]++;
    if (r.falta) x[5]++; if (r.tarde > 0 && !r.tardeJust) x[6]++;
  });
  const res = Object.keys(g).map(k => g[k]);
  const ss = ss_();
  const sh = tabla_(ss, 'Panel hoy', ['PANEL DE ASISTENCIA – ' + isoAFecha_(ctx.hoy), 'Actualizado: ' + Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm')],
    ['Área · Sede', 'Programados', 'Trabajando ahora', 'Ya salieron', 'Pendientes', 'Faltas', 'Tardanzas'],
    ['t', 'n', 'n', 'n', 'n', 'n', 'n'], res, [32, 12, 16, 12, 12, 10, 11]);
  const ini = 4 + res.length + 3;
  const det = filas.map(r => [r.area, r.sede, r.nombre, r.dni, r.turno, r.horario, r.ent, r.sal, r.tarde, r.estado, r.alerta]);
  const hdr = ['Área', 'Sede', 'Nombre', 'DNI', 'Turno', 'Horario', 'Entrada', 'Salida', 'Tardanza (min)', 'Estado', 'Alerta de ubicación'];
  sh.getRange(ini, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1565c0');
  if (det.length) {
    sh.getRange(ini + 1, 1, det.length, hdr.length).setNumberFormat('@');
    sh.getRange(ini + 1, 9, det.length, 1).setNumberFormat('0');
    sh.getRange(ini + 1, 1, det.length, hdr.length).setValues(det);
  }
}

function pedirFecha_(ui, texto) {
  const r = ui.prompt('Reportes de asistencia', texto, ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return null;
  return fechaIso_(r.getResponseText()) || '';
}

function generarReportes() {
  const ui = SpreadsheetApp.getUi();
  asegurarHojas_();
  const desde = pedirFecha_(ui, 'Fecha inicial (dd/mm/aaaa):');
  if (desde === null) return;
  const hasta = pedirFecha_(ui, 'Fecha final (dd/mm/aaaa):');
  if (hasta === null) return;
  if (!desde || !hasta || hasta < desde) { ui.alert('Fechas no válidas. Usa el formato 01/11/2026.'); return; }
  const ctx = contexto_();
  escribirReportes_(ss_(), ctx, desde, hasta, resumenRango_(ctx, desde, hasta), marcasRango_(desde, hasta), 'Todas las áreas');
  ui.alert('Reportes generados: R-Resumen diario, R-Totales, R-Por área, R-Por sede, R-Horas extra, R-Alertas ubicación y R-Registro SUNAFIL.');
}

/** Activador semanal. Se protege para que no pueda ejecutarse más de una vez cada 6 días. */
function respaldoSemanal() {
  const last = Number(PropertiesService.getScriptProperties().getProperty('ultimoRespaldo') || 0);
  if (Date.now() - last < 6 * 86400000) return;
  hacerRespaldo_();
}

function hacerRespaldo_() {
  PropertiesService.getScriptProperties().setProperty('ultimoRespaldo', String(Date.now()));
  const ss = ss_();
  const carpeta = carpeta_(CARPETA_RESPALDOS);
  DriveApp.getFileById(ss.getId()).makeCopy('Respaldo ' + ss.getName() + ' ' +
    Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH.mm'), carpeta);
  const archivos = [];
  const it = carpeta.getFiles();
  while (it.hasNext()) archivos.push(it.next());
  archivos.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  archivos.slice(12).forEach(f => f.setTrashed(true));
  auditar_('Sistema', 'Copia de seguridad', 'Copias conservadas: ' + Math.min(archivos.length, 12));
}

function respaldoManual() {
  if (!esEditor_()) return;
  hacerRespaldo_();
  SpreadsheetApp.getUi().alert('Copia guardada en la carpeta "' + CARPETA_RESPALDOS + '" de tu Google Drive.');
}

function activarRespaldoSemanal() {
  if (!esEditor_()) return;
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'respaldoSemanal').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('respaldoSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(2).create();
  hacerRespaldo_();
  SpreadsheetApp.getUi().alert('Listo: cada lunes a las 2 a. m. se guardará una copia en "' + CARPETA_RESPALDOS +
    '". Se conservan las últimas 12 copias.');
}

// ================================================================ Entrada: APK (POST con CLAVE) y web (google.script.run)

const ACCIONES = {
  login: login_, logout: logout_, menu: menu_, cambiar_clave: cambiarClave_,
  mi_resumen: miResumen_, mis_solicitudes: misSolicitudes_, solicitar: solicitar_,
  resumen: resumen_, solicitudes: solicitudesAdmin_, responder: responder_, adjunto: adjunto_,
  marcas_dia: marcasDia_, foto: foto_,
  personal: personalVer_, personal_guardar: personalGuardar_, reset_clave: resetClave_,
  catalogos: catalogos_, catalogo_guardar: catalogoGuardar_, feriado_guardar: feriadoGuardar_,
  programacion: programacionVer_, programacion_guardar: programacionGuardar_,
  correcciones: correccionesVer_, correccion_agregar: correccionAgregar_, correccion_anular: correccionAnular_,
  reporte: reporte_,
};

function ejecutar_(accion, b) {
  const fn = ACCIONES[accion];
  if (!fn) return { ok: false, error: 'Acción desconocida: ' + accion + '. ¿Actualizaste la app?' };
  try {
    asegurarHojas_();
    return fn(b || {});
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'Solicitud inválida' }); }
  if (String(b.clave || '') !== CLAVE) return json_({ ok: false, error: 'Clave del servidor incorrecta' });
  try {
    asegurarHojas_();
    if (b.accion === 'datos') return json_(datos_());
    if (b.accion === 'marcar') return json_(marcar_(b.marcas || []));
    if (b.accion === 'version') return json_({ ok: true, version: VERSION });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
  return json_(ejecutar_(b.accion, b));
}

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return json_({ ok: true, mensaje: 'Servidor de asistencia activo', version: VERSION });
  return HtmlService.createHtmlOutput(WEB_HTML)
    .setTitle('Asistencia Ecocentury')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

/** Punto de entrada de la versión web. */
function web(accion, b) {
  b = b || {};
  if (accion === 'info') { try { asegurarHojas_(); return infoMarca_(b); } catch (err) { return { ok: false, error: String(err.message || err) }; } }
  if (accion === 'marcar') { try { asegurarHojas_(); return marcarWeb_(b); } catch (err) { return { ok: false, error: String(err.message || err) }; } }
  return ejecutar_(accion, b);
}

// La página web completa (se genera desde Web.html con construir.py)

const WEB_HTML = String.raw`<!DOCTYPE html>
<html lang="es">
<head>
<base target="_top">
<meta charset="utf-8">
<title>Asistencia Ecocentury</title>
<style>
  :root {
    --green: #2e7d32; --green-dark: #1b5e20; --green-soft: #e8f5e9;
    --blue: #1565c0; --blue-soft: #e3f2fd;
    --orange: #e65100; --orange-soft: #fff3e0;
    --red: #c62828; --red-soft: #ffebee;
    --text: #1d2a1f; --muted: #5f6b62; --line: #dde5de; --bg: #f3f6f3; --card: #ffffff;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 16px; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 14px 16px 48px; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 0 8px; }
  .brand { display: inline-flex; align-items: center; gap: 10px; }
  .logo { width: 38px; height: 38px; border-radius: 11px; background: var(--green); display: grid; place-items: center; flex: none; }
  .brand h1 { font-size: 20px; margin: 0; color: var(--green-dark); letter-spacing: -0.3px; line-height: 1.1; }
  .brand small { display: block; font-size: 12.5px; color: var(--muted); font-weight: 500; }
  .who { text-align: right; font-size: 12.5px; color: var(--muted); line-height: 1.3; }
  .who b { color: var(--text); font-size: 13.5px; display: block; }
  .clock { font-size: 44px; font-weight: 700; letter-spacing: -1px; margin: 10px 0 0; text-align: center; font-variant-numeric: tabular-nums; }
  .date { color: var(--muted); font-size: 15px; margin-top: 2px; text-align: center; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 18px; margin-top: 14px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
  h2 { font-size: 21px; margin: 6px 0 2px; letter-spacing: -0.2px; }
  h3 { font-size: 17px; margin: 0 0 6px; }
  label { display: block; font-weight: 600; font-size: 14.5px; margin-bottom: 6px; }
  input, select, textarea { width: 100%; font: inherit; font-size: 16px; padding: 12px; border-radius: 12px; border: 1.5px solid var(--line);
    background: #fff; color: var(--text); outline: none; min-width: 0; }
  input:focus, select:focus, textarea:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(46,125,50,.15); }
  input.big { font-size: 28px; text-align: center; letter-spacing: 2px; font-weight: 600; padding: 12px; text-transform: uppercase; }
  textarea { min-height: 80px; resize: vertical; }
  .field { margin-top: 12px; }
  .grid2 { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 10px; }
  .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
  button { font: inherit; border: 0; cursor: pointer; }
  .btn { width: 100%; padding: 15px; border-radius: 14px; font-size: 17px; font-weight: 700; color: #fff; background: var(--green);
    display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 14px; }
  .btn:active { transform: scale(.985); }
  .btn[disabled] { background: #a5b5a7; }
  .btn.blue { background: var(--blue); } .btn.red { background: var(--red); } .btn.orange { background: var(--orange); }
  .btn.ghost { background: #eef2ee; color: var(--text); }
  .btn.sm { padding: 10px 12px; font-size: 15px; margin-top: 8px; border-radius: 11px; }
  .row-btns { display: flex; gap: 8px; } .row-btns .btn { margin-top: 10px; }
  .link { background: none; color: var(--green-dark); font-weight: 600; font-size: 15px; padding: 12px 4px; width: 100%; text-decoration: underline; }
  .back { background: none; color: var(--green-dark); font-weight: 600; font-size: 15.5px; padding: 6px 0; }
  .hint { font-size: 13px; color: var(--muted); line-height: 1.45; margin-top: 8px; }
  .center { text-align: center; }
  .err { color: var(--red); font-weight: 600; font-size: 14px; margin-top: 8px; }
  .hidden { display: none !important; }
  .info { min-height: 64px; margin-top: 12px; text-align: center; color: var(--muted); }
  .info .name { font-size: 19px; font-weight: 700; color: var(--text); }
  .pill { display: inline-block; padding: 4px 11px; border-radius: 999px; font-weight: 700; font-size: 13px; }
  .p-green { background: var(--green-soft); color: var(--green-dark); } .p-blue { background: var(--blue-soft); color: var(--blue); }
  .p-orange { background: var(--orange-soft); color: var(--orange); } .p-red { background: var(--red-soft); color: var(--red); }
  .p-gray { background: #eceff1; color: #455a64; }
  .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
  .tile { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 14px; text-align: left; min-height: 92px;
    display: flex; flex-direction: column; justify-content: space-between; position: relative; color: var(--text); }
  .tile .ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: var(--green-soft); color: var(--green-dark); }
  .tile b { font-size: 14.5px; line-height: 1.25; margin-top: 10px; display: block; }
  .tile.wide { grid-column: 1 / -1; min-height: 64px; flex-direction: row; align-items: center; gap: 12px; justify-content: flex-start; }
  .tile.wide b { margin-top: 0; }
  .badge { position: absolute; top: 10px; right: 10px; background: var(--red); color: #fff; font-weight: 700; font-size: 13px; min-width: 24px; height: 24px;
    padding: 0 7px; border-radius: 12px; display: grid; place-items: center; }
  .alert { background: var(--orange-soft); color: var(--orange); border-radius: 14px; padding: 12px 14px; font-weight: 600; margin-top: 12px; font-size: 14.5px; }
  .item { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin-top: 10px; }
  .item .top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .item .top b { font-size: 15.5px; }
  .item .sub { font-size: 13.5px; color: var(--muted); margin-top: 4px; line-height: 1.5; white-space: pre-line; }
  .item.click { cursor: pointer; }
  .group { font-size: 13px; font-weight: 700; color: var(--green-dark); text-transform: uppercase; letter-spacing: .4px; margin: 18px 2px 0; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; margin-top: 12px; }
  .stat { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 10px 6px; text-align: center; }
  .stat b { display: block; font-size: 22px; } .stat span { font-size: 11.5px; color: var(--muted); }
  .tabs { display: flex; gap: 6px; background: #e6ece6; padding: 4px; border-radius: 13px; margin-top: 12px; overflow-x: auto; }
  .tabs button { flex: 1; padding: 9px 10px; border-radius: 10px; background: transparent; font-weight: 600; font-size: 13.5px; color: var(--muted); white-space: nowrap; }
  .tabs button.on { background: #fff; color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .filters { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-top: 10px; }
  .filters select, .filters input { padding: 9px 10px; font-size: 14px; border-radius: 10px; }
  .nav { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
  .nav button { padding: 10px 14px; border-radius: 11px; background: #eef2ee; font-weight: 700; }
  .nav input { flex: 1; text-align: center; }
  .chk { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-bottom: 1px solid var(--line); font-size: 15px; }
  .chk input { width: 22px; height: 22px; flex: none; }
  .sched { overflow-x: auto; margin-top: 10px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
  .sched table { border-collapse: collapse; font-size: 12.5px; min-width: 100%; }
  .sched th, .sched td { padding: 7px 6px; border-bottom: 1px solid var(--line); text-align: center; white-space: nowrap; }
  .sched th:first-child, .sched td:first-child { text-align: left; position: sticky; left: 0; background: #fff; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
  .sched td.prog { background: var(--blue-soft); color: var(--blue); font-weight: 700; }
  .sched td.off { color: #9aa59c; }
  .overlay { position: fixed; inset: 0; background: rgba(243,246,243,.94); display: grid; place-items: center; z-index: 30; padding: 24px; }
  .spinner { width: 50px; height: 50px; border-radius: 50%; border: 5px solid var(--green-soft); border-top-color: var(--green);
    animation: spin .9s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .overlay p { font-size: 17px; font-weight: 600; text-align: center; margin: 0; }
  .modal { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: end center; z-index: 25; }
  .sheet { background: #fff; width: 100%; max-width: 560px; border-radius: 20px 20px 0 0; padding: 20px 18px 26px; max-height: 92vh; overflow-y: auto; }
  .sheet img { width: 100%; border-radius: 12px; margin-top: 10px; }
  .result { text-align: center; }
  .result .icon { width: 72px; height: 72px; border-radius: 50%; display: grid; place-items: center; margin: 4px auto 10px; }
  .result h2 { font-size: 28px; }
  .result img { width: 116px; height: 116px; object-fit: cover; border-radius: 16px; margin: 12px auto 4px; display: block; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
  .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: #263238; color: #fff; padding: 12px 18px; border-radius: 12px;
    font-size: 14.5px; z-index: 40; max-width: 90%; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
  .muted { color: var(--muted); } .c-green { color: var(--green-dark); } .c-orange { color: var(--orange); } .c-red { color: var(--red); } .c-blue { color: var(--blue); }
  .empty { text-align: center; color: var(--muted); padding: 26px 10px; font-size: 15px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <div class="logo" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <div><h1>Asistencia</h1><small>Ecocentury</small></div>
    </div>
    <div class="who hidden" id="who"></div>
  </header>
  <main id="app"></main>
</div>
<div class="overlay hidden" id="wait"><div><div class="spinner"></div><p id="waitTxt">Un momento…</p></div></div>
<div class="modal hidden" id="modal"><div class="sheet" id="sheet"></div></div>
<input type="file" id="photo" accept="image/*" capture="user" class="hidden">

<script>
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var app = $("app");
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var DCORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var TIPOS = [["PERMISO", "Permiso"], ["VACACIONES", "Vacaciones"], ["DESCANSO MÉDICO", "Descanso médico"],
    ["LICENCIA CON GOCE", "Licencia con goce"], ["LICENCIA SIN GOCE", "Licencia sin goce"], ["COMISIÓN DE SERVICIO", "Comisión de servicio"],
    ["JUSTIFICACIÓN", "Justificar falta o tardanza"], ["HORAS EXTRA", "Horas extra"], ["CAMBIO DE TURNO", "Cambio de turno"],
    ["CORRECCIÓN DE MARCA", "Corregir una marcación"]];
  var S = { token: null, user: null, avisos: null, last: Date.now(), cat: null };
  var MAX_IDLE = 5 * 60 * 1000;
  var APP = window.AndroidApp || null; // dentro del APK de Android
  var clockTimer = null, backTimer = null, infoTimer = null;

  // ---------------------------------------------------------------- utilidades
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function addDays(s, n) { var p = s.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return iso(d); }
  function showDate(s) { if (!s) return ""; var p = s.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function dayName(s) { var p = s.split("-"); return DCORTO[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; }
  function wait(t) { if (t) { $("waitTxt").textContent = t; $("wait").classList.remove("hidden"); } else $("wait").classList.add("hidden"); }
  function toast(t) { var d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200); }
  function cleanErr(e) { return String(e || "Error").replace(/^\[(SESION|CAMBIAR)\]\s*/, ""); }
  function opt(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(t == null ? v : t) + "</option>"; }
  function val(id) { var e = $(id); return e ? e.value.trim() : ""; }
  function on(id, ev, fn) { var e = $(id); if (e) e.addEventListener(ev, fn); }
  function closeModal() { $("modal").classList.add("hidden"); $("sheet").innerHTML = ""; }
  function openModal(html) { $("sheet").innerHTML = html; $("modal").classList.remove("hidden"); }
  $("modal").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
  function stopTimers() { clearInterval(clockTimer); clearInterval(backTimer); clearTimeout(infoTimer); }

  // ---------------------------------------------------------------- servidor
  function call(name) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (resolve, reject) {
      var r = google.script.run
        .withSuccessHandler(function (res) { resolve(res); })
        .withFailureHandler(function (e) { reject(new Error((e && e.message) || "Sin conexión. Revisa tu internet.")); });
      r[name].apply(r, args);
    });
  }
  function api(accion, p, waitText) {
    p = p || {};
    if (S.token) p.token = S.token;
    S.last = Date.now();
    if (waitText) wait(waitText);
    return call("web", accion, p).then(function (r) {
      if (waitText) wait();
      if (!r) throw new Error("Sin respuesta del servidor.");
      if (!r.ok) { var e = new Error(cleanErr(r.error)); e.raw = String(r.error || ""); e.res = r; throw e; }
      return r;
    }, function (e) { if (waitText) wait(); throw e; }).catch(function (e) {
      if (e.raw && e.raw.indexOf("[SESION]") === 0) { endSession(cleanErr(e.raw)); e.handled = true; }
      else if (e.raw && e.raw.indexOf("[CAMBIAR]") === 0) { viewChange(true); e.handled = true; }
      throw e;
    });
  }
  function fail(e, el) { if (e && e.handled) return; if (el && $(el)) $(el).textContent = e.message; else toast(e.message); }

  // ---------------------------------------------------------------- sesión
  function setWho() {
    if (!S.user) { $("who").classList.add("hidden"); return; }
    $("who").innerHTML = "<b>" + esc(S.user.nombre) + "</b>" + esc(S.user.rol);
    $("who").classList.remove("hidden");
  }
  function endSession(msg) {
    if (S.token) { var t = S.token; S.token = null; call("web", "logout", { token: t }).catch(function () {}); }
    S.token = null; S.user = null; S.avisos = null; S.cat = null;
    setWho(); closeModal();
    if (APP) { APP.cerrar(msg || ""); viewLogin(msg); return; }
    viewHome(msg);
  }
  ["click", "keydown", "touchstart"].forEach(function (ev) { document.addEventListener(ev, function () { S.last = Date.now(); }, true); });
  setInterval(function () {
    if (S.token && Date.now() - S.last > MAX_IDLE) endSession("Tu sesión se cerró por 5 minutos sin uso.");
  }, 15000);

  // ---------------------------------------------------------------- INICIO: marcar
  function viewHome(msg) {
    stopTimers();
    var html = (S.token ? '<button class="back" id="toMenu">‹ Volver al menú</button>' : "") +
      '<div class="clock" id="clock">--:--</div><div class="date" id="date"></div>' +
      (msg ? '<div class="alert">' + esc(msg) + "</div>" : "") +
      '<div class="card"><label for="doc">Ingresa tu DNI o carné de extranjería</label>' +
      '<input id="doc" class="big" autocomplete="off" maxlength="12" placeholder="00000000" value="' + esc(S.token && S.user && S.user.permisos.marcar ? S.user.documento : "") + '">' +
      '<div class="info" id="info"></div>' +
      '<button class="btn" id="btnMark" disabled><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Marcar con selfie</button>' +
      '<p class="hint center">Se abrirá la cámara para tu selfie y luego se registrará tu ubicación.</p></div>' +
      (S.token ? "" : '<button class="btn blue" id="goLogin">Iniciar sesión</button><p class="hint center">Para ver tus marcas, hacer solicitudes o administrar.</p>') +
      '<button class="link" id="goHelp">¿Cómo dejar esta página como app en el celular?</button>';
    app.innerHTML = html;
    tick(); clockTimer = setInterval(tick, 1000);
    on("toMenu", "click", viewMenu);
    on("goLogin", "click", viewLogin);
    on("goHelp", "click", showHelp);
    on("doc", "input", onDoc);
    on("btnMark", "click", function () { if (!S.info) return; $("photo").value = ""; $("photo").click(); });
    S.info = null;
    if ($("doc").value) onDoc.call($("doc"));
    window.scrollTo(0, 0);
  }
  function tick() {
    if (!$("clock")) return;
    var d = new Date();
    $("clock").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    var t = DIAS[d.getDay()] + " " + d.getDate() + " de " + MESES[d.getMonth()];
    $("date").textContent = t.charAt(0).toUpperCase() + t.slice(1);
  }
  function onDoc() {
    var v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (v !== this.value) this.value = v;
    S.info = null; $("btnMark").disabled = true; clearTimeout(infoTimer);
    if (v.length < 8) { $("info").innerHTML = ""; return; }
    $("info").innerHTML = '<div class="muted">Buscando…</div>';
    infoTimer = setTimeout(function () {
      call("web", "info", { documento: v }).then(function (r) {
        if (!$("doc") || v !== $("doc").value) return;
        if (!r || !r.ok) { $("info").innerHTML = '<div class="err">' + esc(r && r.error) + "</div>"; return; }
        S.info = r; S.info.documento = v;
        $("info").innerHTML = '<div class="name">' + esc(r.nombre) + '</div><span class="pill ' + (r.siguiente === "ENTRADA" ? "p-green" : "p-blue") + '">Te toca: ' + esc(r.siguiente) + "</span>" +
          '<div class="hint">' + (r.turno ? "Turno: " + esc(r.turno) + "<br>" : "") + (r.sede ? "Sede: " + esc(r.sede.nombre) + (r.sede.validar ? " · debes estar en la sede" : "") : "") + "</div>";
        $("btnMark").disabled = false;
      }).catch(function (e) { if ($("info")) $("info").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
    }, 350);
  }
  $("photo").addEventListener("change", function () {
    var file = this.files && this.files[0];
    if (!file || !S.info) return;
    var doc = S.info.documento, photo = "";
    wait("Procesando foto…");
    resizeImage(file, 800).then(function (d) { photo = d; wait("Obteniendo ubicación…"); return getLocation(); })
      .then(function (loc) {
        wait("Registrando marcación…");
        return call("web", "marcar", { documento: doc, foto: photo.split(",")[1], lat: loc ? loc.lat : "", lng: loc ? loc.lng : "",
          precision: loc ? loc.acc : "", equipo: deviceName() });
      }).then(function (r) { wait(); if (!r || !r.ok) markError(r ? r.error : "Error", r && r.ubicacion); else markResult(r, photo); })
      .catch(function (e) { wait(); markError(e.message || "No se pudo registrar. Revisa tu internet."); });
  });
  function resizeImage(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen. Intenta de nuevo.")); };
      img.src = url;
    });
  }
  function getLocation() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) { resolve(null); return; }
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 20000);
      navigator.geolocation.getCurrentPosition(function (p) { if (done) return; done = true; clearTimeout(t); resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); },
        function () { if (done) return; done = true; clearTimeout(t); resolve(null); }, { enableHighAccuracy: true, timeout: 18000, maximumAge: 0 });
    });
  }
  function deviceName() {
    var ua = navigator.userAgent || "";
    if (/iPhone/.test(ua)) return "iPhone"; if (/iPad/.test(ua)) return "iPad";
    var m = ua.match(/Android [\d.]+; ([^;)]+)/); if (m) return "Android " + m[1].trim();
    return /Android/.test(ua) ? "Android" : "Navegador";
  }
  function markResult(r, photo) {
    stopTimers();
    var isIn = r.tipo === "ENTRADA", color = isIn ? "var(--green)" : "var(--blue)";
    var u = { "DENTRO": "Dentro de la sede" + (r.distancia !== "" ? " (" + r.distancia + " m)" : ""), "FUERA": "Fuera de la sede (a " + r.distancia + " m)",
      "SIN GPS": "Sin ubicación", "SIN SEDE": "Ubicación registrada" }[r.ubicacion] || "";
    var html = '<div class="card result"><div class="icon" style="background:' + color + '"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h2 style="color:' + color + '">' + esc(r.tipo) + '</h2><div style="font-size:18px;font-weight:600">' + esc(r.nombre) + '</div><div class="muted">' + esc(r.fecha) + " · " + esc(r.hora) + "</div>" +
      '<img alt="" src="' + photo + '">' +
      (r.tardanza !== null && r.tardanza !== undefined ? (r.tardanza > 0 ? '<span class="pill p-orange" style="font-size:15px;margin-top:8px">Tardanza: ' + r.tardanza + " min</span>" : '<span class="pill p-green" style="font-size:15px;margin-top:8px">A tiempo</span>') : "") +
      (u ? '<p class="hint">📍 ' + esc(u) + "</p>" : "") + '</div><button class="btn" id="done">Listo</button><p class="hint center" id="autoBack"></p>';
    app.innerHTML = html;
    var left = 12;
    $("autoBack").textContent = "Volviendo en " + left + " s";
    backTimer = setInterval(function () { left--; if ($("autoBack")) $("autoBack").textContent = "Volviendo en " + left + " s"; if (left <= 0) back(); }, 1000);
    function back() { clearInterval(backTimer); if (S.token) viewMenu(); else viewHome(); }
    on("done", "click", back);
  }
  function markError(msg, isLoc) {
    stopTimers();
    app.innerHTML = '<div class="card result"><div class="icon" style="background:var(--red)"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg></div>' +
      '<h2 class="c-red" style="font-size:23px">No se registró</h2><p style="line-height:1.5">' + esc(msg) + "</p>" +
      (isLoc ? '<p class="hint" style="text-align:left">En iPhone: <b>Ajustes › Privacidad y seguridad › Localización</b>, actívala y en <b>Safari</b> elige "Al usar la app". En Android: activa la <b>Ubicación</b> y permite el acceso a Chrome.</p>' : "") +
      '</div><button class="btn" id="done">Volver</button>';
    on("done", "click", function () { viewHome(); });
  }
  function showHelp() {
    openModal('<h3>Dejarla como app</h3><b>iPhone (Safari)</b><ol style="line-height:1.7;padding-left:20px"><li>Toca <b>Compartir</b> (cuadro con flecha hacia arriba).</li><li>Elige <b>Agregar a pantalla de inicio</b>.</li></ol>' +
      '<b>Android (Chrome)</b><ol style="line-height:1.7;padding-left:20px"><li>Toca el menú <b>⋮</b>.</li><li>Elige <b>Agregar a la pantalla principal</b>.</li></ol>' +
      '<p class="hint">La primera vez que marques, permite el acceso a la <b>cámara</b> y a la <b>ubicación</b>.</p><button class="btn" id="mClose">Entendido</button>');
    on("mClose", "click", closeModal);
  }

  // ---------------------------------------------------------------- LOGIN y contraseña
  function viewLogin(msg) {
    stopTimers();
    app.innerHTML = '<button class="back" id="bk">‹ Volver</button><div class="card"><h2>Iniciar sesión</h2>' +
      (typeof msg === "string" && msg ? '<div class="alert">' + esc(msg) + "</div>" : "") +
      '<div class="field"><label for="lDoc">DNI o carné de extranjería</label><input id="lDoc" autocomplete="username" maxlength="12" style="text-transform:uppercase"></div>' +
      '<div class="field"><label for="lKey">Contraseña</label><input id="lKey" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12"></div>' +
      '<button class="btn" id="lGo">Ingresar</button><div class="err" id="lErr"></div>' +
      '<p class="hint">¿Primera vez? Tu contraseña temporal es <b>1234</b>. Si la olvidaste, pide a tu administrador que la restablezca.</p></div>';
    on("bk", "click", function () { if (APP) APP.cerrar(""); else viewHome(); });
    on("lKey", "keydown", function (e) { if (e.key === "Enter") doLogin(); });
    on("lGo", "click", doLogin);
  }
  function doLogin() {
    var d = val("lDoc").toUpperCase(), k = val("lKey");
    $("lErr").textContent = "";
    if (d.length < 8 || !k) { $("lErr").textContent = "Ingresa tu documento y tu contraseña."; return; }
    api("login", { documento: d, clave: k }, "Ingresando…").then(function (r) {
      S.token = r.token; S.user = r.usuario; S.avisos = r.avisos || null; S.last = Date.now(); setWho();
      if (r.debeCambiar) viewChange(true); else viewMenu();
    }).catch(function (e) { fail(e, "lErr"); });
  }
  function viewChange(forced) {
    stopTimers();
    app.innerHTML = (forced ? "" : '<button class="back" id="bk">‹ Menú</button>') + '<div class="card"><h2>' + (forced ? "Crea tu contraseña" : "Cambiar mi contraseña") + "</h2>" +
      (forced ? '<p class="hint">Es tu primer ingreso o tu contraseña fue restablecida. Crea una nueva para continuar.</p>' : "") +
      '<div class="field"><label for="cA">Contraseña actual</label><input id="cA" type="password" inputmode="numeric" maxlength="12"></div>' +
      '<div class="field"><label for="cN">Nueva contraseña (6 números)</label><input id="cN" type="password" inputmode="numeric" maxlength="6"></div>' +
      '<div class="field"><label for="cC">Repite la nueva contraseña</label><input id="cC" type="password" inputmode="numeric" maxlength="6"></div>' +
      '<p class="hint">No puede ser 1234, ni números repetidos (111111) o seguidos (123456).</p>' +
      '<button class="btn" id="cGo">Guardar contraseña</button><div class="err" id="cErr"></div>' +
      (forced ? '<button class="link" id="cOut">Cancelar y salir</button>' : "") + "</div>";
    on("bk", "click", viewMenu);
    on("cOut", "click", function () { endSession(); });
    on("cGo", "click", function () {
      var a = val("cA"), n = val("cN"), c = val("cC");
      $("cErr").textContent = "";
      if (!/^\d{6}$/.test(n)) { $("cErr").textContent = "La nueva contraseña debe tener 6 números."; return; }
      if (n !== c) { $("cErr").textContent = "Las contraseñas nuevas no coinciden."; return; }
      api("cambiar_clave", { actual: a, nueva: n, confirmacion: c }, "Guardando…").then(function (r) {
        S.user = r.usuario; S.avisos = r.avisos || null; setWho(); toast("Contraseña actualizada"); viewMenu();
      }).catch(function (e) { fail(e, "cErr"); });
    });
  }

  // ---------------------------------------------------------------- MENÚ por rol
  var ICONS = {
    marcar: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    misMarcas: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    misSolicitudes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',
    aprobar: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    resumen: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    personal: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 5.5a3 3 0 010 5.5M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    programacion: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3v3H8z"/>',
    correcciones: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    historial: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-8 8"/>',
    reportes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 17v-3M12 17v-6M15 17v-4"/>',
    listas: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    cambiarClave: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
    conexionApp: '<path d="M5 12.5a10 10 0 0114 0M8 15.5a5.5 5.5 0 018 0"/><circle cx="12" cy="19" r="1"/>',
    sincronizar: '<path d="M20 11a8 8 0 00-14.3-4.9L4 8M4 13a8 8 0 0014.3 4.9L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/>',
    salir: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>'
  };
  var TILES = [
    ["marcar", "Marcar asistencia", function () { if (APP) APP.marcar(S.user.documento); else viewHome(); }],
    ["misMarcas", "Mis marcas", viewMyMarks],
    ["misSolicitudes", "Mis solicitudes", viewMyReqs],
    ["aprobar", "Solicitudes por aprobar", viewApprove],
    ["resumen", "Resumen del día", viewSummary],
    ["personal", "Mi personal", viewPeople],
    ["programacion", "Programar turnos", viewSchedule],
    ["correcciones", "Corregir marcas", viewCorr],
    ["historial", "Marcaciones y fotos", viewMarks],
    ["reportes", "Reportes en Excel", viewReport],
    ["listas", "Áreas, cargos, sedes, turnos y feriados", viewLists],
    ["cambiarClave", "Cambiar mi contraseña", function () { viewChange(false); }],
    ["conexionApp", "Conexión de este celular", function () { APP.configurarConexion(); }],
    ["sincronizar", "Sincronizar este celular", function () { APP.sincronizar(); }]
  ];
  function icon(k, color) { return '<span class="ic"' + (color ? ' style="background:' + color + '"' : "") + '><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[k] || "") + "</svg></span>"; }
  function viewMenu() {
    stopTimers();
    if (!S.user) { viewHome(); return; }
    var p = S.user.permisos, av = S.avisos;
    var html = '<h2>Hola, ' + esc(S.user.nombre.split(" ")[0]) + "</h2>" +
      '<div class="muted" style="font-size:14px">' + esc(S.user.rol) + (S.user.areas && S.user.areas.length ? " · " + esc(S.user.areas.join(", ")) : (S.user.area ? " · " + esc(S.user.area) : "")) + "</div>";
    if (av && av.pendientes) html += '<div class="alert" id="avisoSol" style="cursor:pointer">🔔 Tienes ' + av.pendientes + " solicitud" + (av.pendientes > 1 ? "es" : "") + " por revisar" + (av.nuevas ? " (" + av.nuevas + " nueva" + (av.nuevas > 1 ? "s" : "") + ")" : "") + " ›</div>";
    html += '<div class="tiles">';
    TILES.forEach(function (t, i) {
      var permitido = t[0] === "conexionApp" || t[0] === "sincronizar" ? (APP && p.conexion) : p[t[0]];
      if (!permitido) return;
      var wide = t[0] === "listas" || t[0] === "cambiarClave" || t[0] === "conexionApp" || t[0] === "sincronizar";
      html += '<button class="tile' + (wide ? " wide" : "") + '" data-i="' + i + '">' + icon(t[0]) + "<b>" + esc(t[1]) + "</b>" +
        (t[0] === "aprobar" && av && av.pendientes ? '<span class="badge">' + av.pendientes + "</span>" : "") + "</button>";
    });
    html += '<button class="tile wide" id="logout">' + icon("salir", "var(--red-soft);color:var(--red)") + "<b>Cerrar sesión</b></button></div>";
    app.innerHTML = html;
    Array.prototype.forEach.call(app.querySelectorAll(".tile[data-i]"), function (b) { b.addEventListener("click", function () { TILES[+b.getAttribute("data-i")][2](); }); });
    on("logout", "click", function () { endSession(); });
    on("avisoSol", "click", viewApprove);
    window.scrollTo(0, 0);
    if (S.user.rol !== "Trabajador") api("menu").then(function (r) { S.avisos = r.avisos; var b = app.querySelector(".tile[data-i='3'] .badge"); if (r.avisos && (r.avisos.pendientes || 0) !== ((av && av.pendientes) || 0)) viewMenu(); }).catch(function () {});
  }
  function head(t, sub) { return '<button class="back" id="bk">‹ Menú</button><h2>' + esc(t) + "</h2>" + (sub ? '<div class="muted" style="font-size:14px">' + sub + "</div>" : ""); }
  function backMenu() { on("bk", "click", viewMenu); }
  function loadingInto(id) { $(id).innerHTML = '<div class="empty"><div class="spinner" style="width:30px;height:30px;border-width:4px"></div></div>'; }
  function catalog() { if (S.cat) return Promise.resolve(S.cat); return api("catalogos").then(function (r) { S.cat = r; return r; }); }

  // ---------------------------------------------------------------- Trabajador: mis marcas y solicitudes
  function rowDay(r, showName) {
    var cls = r.falta ? "p-red" : (r.tardanza > 0 && !r.tardanzaJustificada) ? "p-orange" : r.asistio ? "p-green" : "p-gray";
    var sub = [];
    if (showName) sub.push("DNI " + r.dni + (r.turno ? "  ·  " + r.turno + (r.horario ? " " + r.horario : "") : ""));
    else if (r.turno) sub.push(r.turno + (r.horario ? " " + r.horario : ""));
    if (r.entrada || r.salida) sub.push("Entrada " + (r.entrada || "—") + "  ·  Salida " + (r.salida || "—"));
    if (r.tardanza > 0) sub.push("Tardanza: " + r.tardanza + " min" + (r.tardanzaJustificada ? " (justificada)" : ""));
    if (r.trabajado) sub.push("Horas trabajadas: " + r.trabajado);
    if (r.horasExtra) sub.push("Horas extra: " + r.horasExtra + " (" + r.estadoHE + ")");
    if (r.correccion) sub.push("Corrección: " + r.correccion);
    return '<div class="item"><div class="top"><b>' + esc(showName ? r.nombre : (dayName(r.dia) + " " + r.fecha)) + '</b><span class="pill ' + cls + '">' + esc(r.estado) + "</span></div>" +
      (sub.length ? '<div class="sub">' + esc(sub.join("\n")) + "</div>" : "") + (r.alerta ? '<div class="sub c-red">⚠ ' + esc(r.alerta) + "</div>" : "") + "</div>";
  }
  function viewMyMarks() {
    app.innerHTML = head("Mis marcas", "Últimos 31 días") + '<div id="list"></div>'; backMenu(); loadingInto("list");
    api("mi_resumen").then(function (r) {
      if (r.aviso) { $("list").innerHTML = '<div class="empty">' + esc(r.aviso) + "</div>"; return; }
      var late = 0, lm = 0, abs = 0;
      r.filas.forEach(function (f) { if (f.tardanza > 0 && !f.tardanzaJustificada) { late++; lm += f.tardanza; } if (f.falta) abs++; });
      $("list").innerHTML = '<div class="stats"><div class="stat"><b>' + r.filas.filter(function (f) { return f.asistio; }).length + '</b><span>Asistencias</span></div><div class="stat"><b class="c-orange">' + late +
        '</b><span>Tardanzas</span></div><div class="stat"><b class="c-orange">' + lm + '</b><span>Min. tarde</span></div><div class="stat"><b class="c-red">' + abs + "</b><span>Faltas</span></div></div>" +
        (r.filas.length ? r.filas.map(function (f) { return rowDay(f, false); }).join("") : '<div class="empty">Aún no hay registros.</div>');
    }).catch(function (e) { fail(e); if ($("list")) $("list").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
  }
  function reqItem(s, admin) {
    var cls = s.estado === "APROBADO" ? "p-green" : s.estado === "RECHAZADO" ? "p-red" : "p-orange";
    var sub = (admin ? "DNI " + s.dni + (s.area ? " · " + s.area : "") + "\n" : "") + (s.desde === s.hasta ? s.desde : s.desde + " al " + s.hasta) + (s.detalle ? "\n" + s.detalle : "") + "\nMotivo: " + s.motivo +
      "\nEnviada: " + s.fecha;
    var resp = s.estado !== "PENDIENTE" ? '<div class="sub ' + (s.estado === "APROBADO" ? "c-green" : "c-red") + '"><b>' + (s.estado === "APROBADO" ? "✓ Aprobado" : "✗ Rechazado") +
      (s.respondidoPor ? " por " + esc(s.respondidoPor) : "") + (s.fechaRespuesta ? " el " + esc(s.fechaRespuesta) : "") + "</b>" + (s.respuesta ? "\nRespuesta: " + esc(s.respuesta) : "") + "</div>" : "";
    return '<div class="item"><div class="top"><b>' + esc(admin ? s.nombre : s.tipo) + (s.nueva ? ' <span class="pill p-red" style="font-size:11px">Nueva</span>' : "") + '</b><span class="pill ' + cls + '">' + esc(s.estado) + "</span></div>" +
      (admin ? '<div class="sub c-blue"><b>' + esc(s.tipo) + "</b></div>" : "") + '<div class="sub">' + esc(sub) + "</div>" + resp +
      (s.tieneAdjunto ? '<button class="btn ghost sm" data-adj="' + esc(s.id) + '">📎 Ver adjunto</button>' : "") +
      (admin && s.estado === "PENDIENTE" ? '<div class="row-btns"><button class="btn sm" data-ok="' + esc(s.id) + '">Aprobar</button><button class="btn red sm" data-no="' + esc(s.id) + '">Rechazar</button></div>' : "") + "</div>";
  }
  function bindAdj(list) {
    Array.prototype.forEach.call(app.querySelectorAll("[data-adj]"), function (b) {
      b.addEventListener("click", function () {
        api("adjunto", { id: b.getAttribute("data-adj") }, "Abriendo adjunto…").then(function (r) { showFile(r.base64, r.tipo, "Adjunto"); }).catch(fail);
      });
    });
  }
  function saveFile(name, mime, b64) {
    if (APP) { APP.guardarArchivo(name, mime, b64); return null; }
    var bytes = atob(b64), arr = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mime }));
  }
  function showFile(b64, tipo, title) {
    if (/pdf/i.test(tipo) && APP) { saveFile("adjunto.pdf", "application/pdf", b64); return; }
    if (/pdf/i.test(tipo)) {
      var bytes = atob(b64), arr = new Uint8Array(bytes.length);
      for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([arr], { type: "application/pdf" }));
      openModal("<h3>" + esc(title) + '</h3><a class="btn" href="' + url + '" target="_blank" download="adjunto.pdf">Abrir PDF</a><button class="btn ghost" id="mClose">Cerrar</button>');
    } else openModal("<h3>" + esc(title) + '</h3><img alt="" src="data:' + esc(tipo) + ";base64," + b64 + '"><button class="btn ghost" id="mClose">Cerrar</button>');
    on("mClose", "click", closeModal);
  }
  function viewMyReqs() {
    app.innerHTML = head("Mis solicitudes") + '<button class="btn" id="new">+ Nueva solicitud</button><div id="list"></div>'; backMenu();
    on("new", "click", viewNewReq); loadingInto("list");
    api("mis_solicitudes").then(function (r) {
      $("list").innerHTML = r.solicitudes.length ? r.solicitudes.map(function (s) { return reqItem(s, false); }).join("") : '<div class="empty">Aún no tienes solicitudes.</div>';
      bindAdj();
    }).catch(function (e) { fail(e); });
  }
  var HINTS = { "PERMISO": "Horario del permiso (ej. 10:00 a 12:00 o día completo)", "JUSTIFICACIÓN": "¿Qué justificas? (falta o tardanza)",
    "HORAS EXTRA": "Cantidad de horas (ej. 2 horas)", "CAMBIO DE TURNO": "Nombre del turno que necesitas", "CORRECCIÓN DE MARCA": "ENTRADA o SALIDA y la hora (ej. ENTRADA 08:00)",
    "DESCANSO MÉDICO": "Detalle (opcional)", "COMISIÓN DE SERVICIO": "Lugar o tarea de la comisión" };
  var ONE_DAY = { "HORAS EXTRA": 1, "CORRECCIÓN DE MARCA": 1 };
  function viewNewReq() {
    var html = '<button class="back" id="bk2">‹ Mis solicitudes</button><h2>Nueva solicitud</h2><div class="card">' +
      '<div class="field" style="margin-top:0"><label for="nT">¿Qué deseas solicitar?</label><select id="nT">' + TIPOS.map(function (t) { return opt(t[0], t[1]); }).join("") + "</select></div>" +
      '<div class="grid2 field"><div><label for="nF" id="nFl">Desde</label><input id="nF" type="date" value="' + today() + '"></div><div id="nTw"><label for="nH">Hasta</label><input id="nH" type="date" value="' + today() + '"></div></div>' +
      '<div class="field" id="nDw"><label for="nD" id="nDl">Detalle</label><input id="nD" autocomplete="off"></div>' +
      '<div class="field"><label for="nM">Motivo</label><textarea id="nM"></textarea></div>' +
      '<div class="field"><label for="nA">Adjunto (opcional)</label><input id="nA" type="file" accept="image/*,application/pdf"><p class="hint">Por ejemplo, foto del certificado médico.</p></div>' +
      '<button class="btn" id="nGo">Enviar solicitud</button><div class="err" id="nErr"></div></div>';
    app.innerHTML = html;
    on("bk2", "click", viewMyReqs);
    function upd() {
      var t = val("nT");
      $("nTw").classList.toggle("hidden", !!ONE_DAY[t]);
      $("nFl").textContent = ONE_DAY[t] ? "Fecha" : "Desde";
      $("nDw").classList.toggle("hidden", !HINTS[t]);
      $("nDl").textContent = HINTS[t] || "Detalle";
    }
    on("nT", "change", upd); upd();
    on("nF", "change", function () { if (val("nH") < val("nF")) $("nH").value = val("nF"); });
    on("nGo", "click", function () {
      var t = val("nT"), d = val("nD"), m = val("nM"), f = val("nF"), h = ONE_DAY[t] ? f : val("nH");
      $("nErr").textContent = "";
      if (!f || !h || h < f) { $("nErr").textContent = "Revisa las fechas."; return; }
      if ((t === "CORRECCIÓN DE MARCA" || t === "HORAS EXTRA" || t === "CAMBIO DE TURNO" || t === "JUSTIFICACIÓN" || t === "COMISIÓN DE SERVICIO") && !d) { $("nErr").textContent = "Completa el detalle."; return; }
      if (!m) { $("nErr").textContent = "Escribe el motivo."; return; }
      var file = $("nA").files && $("nA").files[0];
      var prep = !file ? Promise.resolve(null) : (/pdf/i.test(file.type) ? readB64(file) : resizeImage(file, 1400).then(function (x) { return x.split(",")[1]; }));
      wait("Enviando solicitud…");
      prep.then(function (b64) {
        if (b64 && b64.length > 6000000) throw new Error("El adjunto es muy grande (máximo 4 MB).");
        return api("solicitar", { tipo: t, desde: f, hasta: h, detalle: d, motivo: m, adjunto: b64 || "", adjuntoTipo: file ? file.type : "" });
      }).then(function () { wait(); toast("Solicitud enviada"); viewMyReqs(); }).catch(function (e) { wait(); fail(e, "nErr"); });
    });
  }
  function readB64(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(",")[1]); }; r.onerror = function () { rej(new Error("No se pudo leer el archivo.")); }; r.readAsDataURL(file); });
  }

  // ---------------------------------------------------------------- Administrador: solicitudes
  function viewApprove(all) {
    all = all === true;
    app.innerHTML = head("Solicitudes") + '<div class="tabs"><button id="tP" class="' + (all ? "" : "on") + '">Pendientes</button><button id="tA" class="' + (all ? "on" : "") + '">Todas (recientes)</button></div><div id="list"></div>';
    backMenu(); on("tP", "click", function () { viewApprove(false); }); on("tA", "click", function () { viewApprove(true); });
    loadingInto("list");
    api("solicitudes", { todas: all }).then(function (r) {
      $("list").innerHTML = r.solicitudes.length ? r.solicitudes.map(function (s) { return reqItem(s, true); }).join("") : '<div class="empty">' + (all ? "No hay solicitudes." : "No hay solicitudes pendientes. ✔") + "</div>";
      bindAdj();
      Array.prototype.forEach.call(app.querySelectorAll("[data-ok],[data-no]"), function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-ok") || b.getAttribute("data-no"), okk = !!b.getAttribute("data-ok");
          var s = r.solicitudes.filter(function (x) { return x.id === id; })[0];
          openModal("<h3>" + (okk ? "¿Aprobar solicitud?" : "¿Rechazar solicitud?") + '</h3><div class="muted">' + esc(s.nombre) + " · " + esc(s.tipo) + "<br>" + esc(s.desde === s.hasta ? s.desde : s.desde + " al " + s.hasta) + "</div>" +
            '<div class="field"><label for="rR">Respuesta para el trabajador (opcional)</label><input id="rR"></div>' +
            '<div class="row-btns"><button class="btn ghost" id="mClose">Cancelar</button><button class="btn ' + (okk ? "" : "red") + '" id="rGo">' + (okk ? "Aprobar" : "Rechazar") + "</button></div>");
          on("mClose", "click", closeModal);
          on("rGo", "click", function () {
            api("responder", { id: id, estado: okk ? "APROBADO" : "RECHAZADO", respuesta: val("rR") }, "Guardando…").then(function () {
              closeModal(); toast(okk ? "Solicitud aprobada" : "Solicitud rechazada");
              if (S.avisos && S.avisos.pendientes) S.avisos.pendientes--;
              viewApprove(all);
            }).catch(function (e) { closeModal(); fail(e); });
          });
        });
      });
    }).catch(function (e) { fail(e); });
  }

  // ---------------------------------------------------------------- Administrador: resumen del día
  function viewSummary(day) {
    day = typeof day === "string" ? day : today();
    app.innerHTML = head("Resumen del día") + '<div class="nav"><button id="pv">◀</button><input type="date" id="dd" value="' + day + '"><button id="nx">▶</button></div><div id="list"></div>';
    backMenu();
    on("pv", "click", function () { viewSummary(addDays(val("dd"), -1)); });
    on("nx", "click", function () { viewSummary(addDays(val("dd"), 1)); });
    on("dd", "change", function () { viewSummary(val("dd")); });
    loadingInto("list");
    api("resumen", { dia: day }).then(function (r) {
      var c = { w: 0, a: 0, t: 0, f: 0 };
      r.filas.forEach(function (f) { if (f.enJornada) c.w++; if (f.asistio) c.a++; if (f.tardanza > 0 && !f.tardanzaJustificada) c.t++; if (f.falta) c.f++; });
      var html = '<div class="stats"><div class="stat"><b class="c-green">' + c.w + '</b><span>Trabajando</span></div><div class="stat"><b>' + c.a + '</b><span>Asistieron</span></div><div class="stat"><b class="c-orange">' + c.t +
        '</b><span>Tardanzas</span></div><div class="stat"><b class="c-red">' + c.f + "</b><span>Faltas</span></div></div>";
      var g = null;
      r.filas.forEach(function (f) { var k = (f.area || "Sin área") + " · " + (f.sede || "Sin sede"); if (k !== g) { html += '<div class="group">' + esc(k) + "</div>"; g = k; } html += rowDay(f, true); });
      if (!r.filas.length) html += '<div class="empty">Sin registros para este día.</div>';
      $("list").innerHTML = html;
    }).catch(function (e) { fail(e); });
  }

  // ---------------------------------------------------------------- Administrador: marcaciones y fotos
  function viewMarks(day) {
    day = typeof day === "string" ? day : today();
    app.innerHTML = head("Marcaciones y fotos") + '<div class="nav"><button id="pv">◀</button><input type="date" id="dd" value="' + day + '"><button id="nx">▶</button></div><div id="list"></div>';
    backMenu();
    on("pv", "click", function () { viewMarks(addDays(val("dd"), -1)); });
    on("nx", "click", function () { viewMarks(addDays(val("dd"), 1)); });
    on("dd", "change", function () { viewMarks(val("dd")); });
    loadingInto("list");
    api("marcas_dia", { dia: day }).then(function (r) {
      $("list").innerHTML = r.marcas.length ? r.marcas.map(function (m) {
        var ub = m.ubicacion === "DENTRO" ? "p-green" : (m.ubicacion === "FUERA" || m.ubicacion === "FALSA" || m.ubicacion === "SIN GPS") ? "p-red" : "p-gray";
        return '<div class="item"><div class="top"><b>' + esc(m.hora.substring(0, 5)) + " · " + esc(m.nombre) + '</b><span class="pill ' + (m.tipo === "ENTRADA" ? "p-green" : "p-blue") + '">' + esc(m.tipo) + "</span></div>" +
          '<div class="sub">DNI ' + esc(m.dni) + " · " + esc(m.sede || "") + " · " + esc(m.equipo || "") + '</div><div class="sub"><span class="pill ' + ub + '">' + esc(m.ubicacion || "—") + "</span>" + (m.distancia ? " " + esc(m.distancia) + " m" : "") + "</div>" +
          '<div class="row-btns">' + (m.tieneFoto ? '<button class="btn ghost sm" data-ph="' + esc(m.id) + '">Ver foto</button>' : "") + (m.mapa ? '<a class="btn ghost sm" style="text-decoration:none" target="_blank" href="' + esc(m.mapa) + '">Ver mapa</a>' : "") + "</div></div>";
      }).join("") : '<div class="empty">Sin marcaciones este día.</div>';
      Array.prototype.forEach.call(app.querySelectorAll("[data-ph]"), function (b) {
        b.addEventListener("click", function () { api("foto", { id: b.getAttribute("data-ph") }, "Cargando foto…").then(function (x) { showFile(x.base64, x.tipo, "Selfie"); }).catch(fail); });
      });
    }).catch(function (e) { fail(e); });
  }

  // ---------------------------------------------------------------- Administrador: personal
  var PF = { q: "", area: "", sede: "", turno: "", cargo: "", rol: "", estado: "" };
  function viewPeople() {
    app.innerHTML = head("Mi personal") + '<button class="btn" id="add">+ Registrar trabajador</button><div class="card" style="padding:12px"><input id="fq" placeholder="Buscar por nombre o documento" value="' + esc(PF.q) + '">' +
      '<div class="filters" id="filters"></div></div><div id="list"></div>';
    backMenu(); on("add", "click", function () { viewPerson(null); }); loadingInto("list");
    Promise.all([api("personal"), catalog()]).then(function (res) {
      var people = res[0].personal, c = res[1];
      function sel(k, label, items) { return '<select data-f="' + k + '"><option value="">' + label + ": todos</option>" + items.map(function (x) { return opt(x, x, PF[k] === x); }).join("") + "</select>"; }
      var uniq = function (k) { var o = {}; people.forEach(function (p) { if (p[k]) o[p[k]] = 1; }); return Object.keys(o).sort(); };
      $("filters").innerHTML = sel("area", "Área", uniq("area")) + sel("sede", "Sede", uniq("sede")) + sel("turno", "Turno", uniq("turno")) + sel("cargo", "Cargo", uniq("cargo")) +
        (c.esGeneral ? sel("rol", "Rol", ["Trabajador", "Administrador de área", "Administrador general"]) : "") + sel("estado", "Estado", ["Activo", "Inactivo"]);
      function draw() {
        var q = PF.q.toLowerCase();
        var list = people.filter(function (p) {
          if (q && (p.nombre + " " + p.documento).toLowerCase().indexOf(q) < 0) return false;
          return ["area", "sede", "turno", "cargo", "rol", "estado"].every(function (k) { return !PF[k] || p[k] === PF[k]; });
        });
        $("list").innerHTML = '<div class="hint">' + list.length + " de " + people.length + " usuario(s)</div>" + (list.length ? list.map(function (p, i) {
          return '<div class="item click" data-p="' + esc(p.documento) + '"><div class="top"><b>' + esc(p.nombre) + '</b><span class="pill ' + (p.estado === "Activo" ? "p-green" : "p-gray") + '">' + esc(p.estado) + "</span></div>" +
            '<div class="sub">' + esc(p.tipoDoc + " " + p.documento + "  ·  " + p.cargo + "\n" + p.area + (p.sede ? "  ·  " + p.sede : "") + (p.turno ? "  ·  " + p.turno : "")) + "</div>" +
            (p.rol !== "Trabajador" ? '<div class="sub c-blue"><b>' + esc(p.rol) + (p.areasACargo.length ? ": " + esc(p.areasACargo.join(", ")) : "") + "</b></div>" : "") + "</div>";
        }).join("") : '<div class="empty">Nadie coincide con los filtros.</div>');
        Array.prototype.forEach.call(app.querySelectorAll("[data-p]"), function (el) {
          el.addEventListener("click", function () { viewPerson(people.filter(function (p) { return p.documento === el.getAttribute("data-p"); })[0]); });
        });
      }
      Array.prototype.forEach.call(app.querySelectorAll("[data-f]"), function (s) { s.addEventListener("change", function () { PF[s.getAttribute("data-f")] = s.value; draw(); }); });
      on("fq", "input", function () { PF.q = this.value; draw(); });
      draw();
    }).catch(function (e) { fail(e); });
  }
  function viewPerson(p) {
    var nuevo = !p;
    catalog().then(function (c) {
      p = p || { tipoDoc: "DNI", documento: "", nombre: "", area: c.areas.length === 1 ? c.areas[0].nombre : "", sede: "", turno: "", cargo: "", rol: "Trabajador", estado: "Activo", ingreso: "", areasACargo: [] };
      var act = function (l, cur) { return l.filter(function (x) { return x.activo || x.nombre === cur; }); };
      var html = '<button class="back" id="bk2">‹ Mi personal</button><h2>' + (nuevo ? "Registrar trabajador" : esc(p.nombre)) + "</h2>" + (nuevo ? "" : '<div class="muted" style="font-size:13px">' + esc(p.tipoDoc + " " + p.documento) + "</div>") +
        '<div class="card"><div class="grid2"><div><label for="pT">Documento</label><select id="pT"' + (nuevo ? "" : " disabled") + ">" + opt("DNI", "DNI", p.tipoDoc === "DNI") + opt("CE", "Carné de extranjería", p.tipoDoc === "CE") + "</select></div>" +
        '<div><label for="pD">Número</label><input id="pD" maxlength="12" style="text-transform:uppercase" value="' + esc(p.documento) + '"' + (nuevo ? "" : " disabled") + "></div></div>" +
        '<div class="field"><label for="pN">Nombre completo</label><input id="pN" value="' + esc(p.nombre) + '"></div>' +
        '<div class="grid2 field"><div><label for="pA">Área</label><select id="pA"><option value="">Elegir…</option>' + act(c.areas, p.area).map(function (x) { return opt(x.nombre, x.nombre, x.nombre === p.area); }).join("") + "</select></div>" +
        '<div><label for="pC">Cargo</label><select id="pC"><option value="">Elegir…</option>' + act(c.cargos, p.cargo).map(function (x) { return opt(x.nombre, x.nombre, x.nombre === p.cargo); }).join("") + "</select></div></div>" +
        '<div class="field"><label for="pR">Rol</label><select id="pR">' + c.roles.map(function (r) { return opt(r, r, r === p.rol); }).join("") + "</select></div>" +
        '<div id="pAC" class="field"><label>Áreas a cargo</label>' + c.todasLasAreas.filter(function (x) { return x.activo || p.areasACargo.indexOf(x.nombre) >= 0; }).map(function (x) {
          return '<label class="chk" style="font-weight:500"><input type="checkbox" data-ac="' + esc(x.nombre) + '"' + (p.areasACargo.indexOf(x.nombre) >= 0 ? " checked" : "") + ">" + esc(x.nombre) + "</label>"; }).join("") + "</div>" +
        '<div class="grid2 field" id="pST"><div><label for="pS">Sede</label><select id="pS"><option value="">Elegir…</option>' + act(c.sedes, p.sede).map(function (x) { return opt(x.nombre, x.nombre, x.nombre === p.sede); }).join("") + "</select></div>" +
        '<div><label for="pU">Turno</label><select id="pU"><option value="">Elegir…</option>' + act(c.turnos, p.turno).map(function (x) { return opt(x.nombre, x.nombre + " (" + x.entrada + "-" + x.salida + ")", x.nombre === p.turno); }).join("") + "</select></div></div>" +
        '<div class="grid2 field"><div><label for="pE">Estado</label><select id="pE">' + opt("Activo", "Activo", p.estado === "Activo") + opt("Inactivo", "Inactivo", p.estado === "Inactivo") + "</select></div>" +
        '<div><label for="pI">Fecha de ingreso</label><input id="pI" type="date" value="' + esc(p.ingreso) + '"></div></div>' +
        '<button class="btn" id="pGo">' + (nuevo ? "Registrar" : "Guardar cambios") + '</button><div class="err" id="pErr"></div>' +
        (nuevo ? '<p class="hint">Se le asignará la contraseña temporal <b>1234</b>. Tendrá que cambiarla en su primer ingreso.</p>' : "") + "</div>";
      if (!nuevo) html += '<div class="card"><h3>Contraseña</h3><p class="hint" style="margin-top:0">Si la olvidó, devuélvela a 1234. Tendrá que crear una nueva al ingresar.</p><button class="btn orange" id="pRst">Restablecer contraseña a 1234</button>' +
        '<p class="hint">Creado por ' + esc(p.creadoPor || "—") + (p.fechaCreacion ? " el " + esc(p.fechaCreacion) : "") + (p.modificadoPor ? "<br>Última modificación: " + esc(p.modificadoPor) + " el " + esc(p.fechaModificacion) : "") + "</p></div>";
      app.innerHTML = html;
      on("bk2", "click", viewPeople);
      function upd() { var r = val("pR"); $("pAC").classList.toggle("hidden", r !== "Administrador de área"); }
      on("pR", "change", upd); upd();
      on("pGo", "click", function () {
        var ac = []; Array.prototype.forEach.call(app.querySelectorAll("[data-ac]"), function (x) { if (x.checked) ac.push(x.getAttribute("data-ac")); });
        var perfil = { nuevo: nuevo, tipoDoc: val("pT"), documento: val("pD").toUpperCase(), nombre: val("pN"), area: val("pA"), cargo: val("pC"), rol: val("pR"),
          sede: val("pS"), turno: val("pU"), estado: val("pE"), ingreso: val("pI"), areasACargo: ac };
        $("pErr").textContent = "";
        api("personal_guardar", { perfil: perfil }, "Guardando…").then(function (r) { toast(r.sinCambios ? "Sin cambios" : (nuevo ? "Trabajador registrado" : "Cambios guardados")); viewPeople(); }).catch(function (e) { fail(e, "pErr"); });
      });
      on("pRst", "click", function () {
        openModal("<h3>¿Restablecer contraseña?</h3><p>La contraseña de <b>" + esc(p.nombre) + "</b> volverá a ser <b>1234</b>.</p><div class=\"row-btns\"><button class=\"btn ghost\" id=\"mClose\">Cancelar</button><button class=\"btn orange\" id=\"rGo\">Restablecer</button></div>");
        on("mClose", "click", closeModal);
        on("rGo", "click", function () { api("reset_clave", { documento: p.documento }, "Restableciendo…").then(function () { closeModal(); toast("Contraseña restablecida a 1234"); }).catch(function (e) { closeModal(); fail(e); }); });
      });
    }).catch(function (e) { fail(e); });
  }

  // ---------------------------------------------------------------- Administrador: programación de turnos
  function monday(s) { var p = s.split("-"); var d = new Date(+p[0], +p[1] - 1, +p[2]); var k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); }
  function viewSchedule(desde) {
    desde = typeof desde === "string" ? desde : monday(today());
    app.innerHTML = head("Programar turnos", "Celdas azules = programado distinto al turno habitual") + '<div class="nav"><button id="pv">◀</button><input type="date" id="dd" value="' + desde + '"><button id="nx">▶</button></div><div id="grid"></div>' +
      '<div class="card" id="form"><h3>Programar</h3><div id="sWho" style="max-height:220px;overflow:auto"></div>' +
      '<div class="grid2 field"><div><label for="sF">Desde</label><input type="date" id="sF" value="' + desde + '"></div><div><label for="sH">Hasta</label><input type="date" id="sH" value="' + desde + '"></div></div>' +
      '<div class="field"><label for="sT">Turno</label><select id="sT"></select></div><button class="btn" id="sGo">Aplicar</button><div class="err" id="sErr"></div></div>';
    backMenu();
    on("pv", "click", function () { viewSchedule(addDays(val("dd"), -7)); });
    on("nx", "click", function () { viewSchedule(addDays(val("dd"), 7)); });
    on("dd", "change", function () { viewSchedule(monday(val("dd"))); });
    loadingInto("grid");
    Promise.all([api("programacion", { desde: desde, dias: 7 }), catalog()]).then(function (res) {
      var r = res[0], c = res[1];
      if (!r.personal.length) { $("grid").innerHTML = '<div class="empty">No hay personal para programar.</div>'; $("form").classList.add("hidden"); return; }
      var t = "<table><tr><th>Trabajador</th>";
      r.personal[0].dias.forEach(function (d) { t += "<th>" + dayName(d.fecha) + "<br>" + d.fecha.substring(8) + "</th>"; });
      t += "</tr>";
      r.personal.forEach(function (p) {
        t += "<tr><td>" + esc(p.nombre) + "</td>";
        p.dias.forEach(function (d) {
          var txt = d.turno === "DESCANSO" ? "Desc." : d.descanso ? "Libre" : d.turno;
          t += '<td class="' + (d.programado ? "prog" : (d.descanso ? "off" : "")) + '" title="' + esc(d.horario) + '">' + esc(d.feriado ? "Feriado" : txt) + "</td>";
        });
        t += "</tr>";
      });
      $("grid").innerHTML = '<div class="sched">' + t + "</table></div>";
      $("sWho").innerHTML = '<label class="chk" style="font-weight:700"><input type="checkbox" id="all">Todos</label>' + r.personal.map(function (p) {
        return '<label class="chk" style="font-weight:500"><input type="checkbox" data-w="' + esc(p.documento) + '">' + esc(p.nombre) + ' <span class="muted" style="font-size:12px">· ' + esc(p.area) + "</span></label>"; }).join("");
      on("all", "change", function () { var v = this.checked; Array.prototype.forEach.call(app.querySelectorAll("[data-w]"), function (x) { x.checked = v; }); });
      $("sT").innerHTML = c.turnos.filter(function (x) { return x.activo; }).map(function (x) { return opt(x.nombre, x.nombre + " (" + x.entrada + "-" + x.salida + ")"); }).join("") +
        opt("DESCANSO", "Descanso (día libre)") + opt("HABITUAL", "Quitar programación (volver al habitual)");
      on("sF", "change", function () { if (val("sH") < val("sF")) $("sH").value = val("sF"); });
      on("sGo", "click", function () {
        var docs = []; Array.prototype.forEach.call(app.querySelectorAll("[data-w]"), function (x) { if (x.checked) docs.push(x.getAttribute("data-w")); });
        $("sErr").textContent = "";
        if (!docs.length) { $("sErr").textContent = "Elige al menos un trabajador."; return; }
        api("programacion_guardar", { documentos: docs, desde: val("sF"), hasta: val("sH"), turno: val("sT") }, "Guardando…").then(function () { toast("Programación guardada"); viewSchedule(desde); }).catch(function (e) { fail(e, "sErr"); });
      });
    }).catch(function (e) { fail(e); });
  }

  // ---------------------------------------------------------------- Administrador: correcciones
  function viewCorr() {
    app.innerHTML = head("Corregir marcas", "La marca original no se modifica; la corrección queda registrada con tu nombre.") +
      '<div class="card"><h3>Agregar marca faltante</h3><div class="field" style="margin-top:0"><label for="kW">Trabajador</label><select id="kW"><option value="">Cargando…</option></select></div>' +
      '<div class="grid2 field"><div><label for="kF">Fecha</label><input type="date" id="kF" value="' + today() + '" max="' + today() + '"></div><div><label for="kH">Hora</label><input type="time" id="kH" value="08:00"></div></div>' +
      '<div class="field"><label for="kT">Tipo</label><select id="kT">' + opt("ENTRADA") + opt("SALIDA") + "</select></div>" +
      '<div class="field"><label for="kM">Motivo (obligatorio)</label><input id="kM"></div><button class="btn" id="kGo">Registrar corrección</button><div class="err" id="kErr"></div></div>' +
      '<h3 style="margin-top:20px">Últimos 31 días</h3><div id="list"></div>';
    backMenu(); loadingInto("list");
    api("personal").then(function (r) {
      var ws = r.personal.filter(function (p) { return p.rol === "Trabajador"; });
      $("kW").innerHTML = '<option value="">Elegir…</option>' + ws.map(function (p) { return opt(p.documento, p.nombre + " · " + p.documento); }).join("");
    }).catch(fail);
    function load() {
      api("correcciones").then(function (r) {
        $("list").innerHTML = r.correcciones.length ? r.correcciones.map(function (c) {
          var an = c.estado === "ANULADA";
          return '<div class="item"><div class="top"><b>' + esc(c.nombre || c.documento) + '</b><span class="pill ' + (an ? "p-gray" : "p-blue") + '">' + esc(an ? "ANULADA" : c.tipo) + "</span></div>" +
            '<div class="sub">' + esc(c.fecha + " " + c.hora + " · " + c.tipo + "\nMotivo: " + c.motivo + "\nPor: " + c.registradoPor + (an ? "\nAnulada por: " + c.anuladoPor + " — " + c.motivoAnulacion : "")) + "</div>" +
            (an ? "" : '<button class="btn ghost sm" data-an="' + esc(c.id) + '">Anular</button>') + "</div>";
        }).join("") : '<div class="empty">No hay correcciones recientes.</div>';
        Array.prototype.forEach.call(app.querySelectorAll("[data-an]"), function (b) {
          b.addEventListener("click", function () {
            openModal('<h3>Anular corrección</h3><p class="hint">Queda registrada como anulada, no se borra.</p><div class="field"><label for="aM">Motivo</label><input id="aM"></div><div class="row-btns"><button class="btn ghost" id="mClose">Cancelar</button><button class="btn red" id="aGo">Anular</button></div>');
            on("mClose", "click", closeModal);
            on("aGo", "click", function () { api("correccion_anular", { id: b.getAttribute("data-an"), motivo: val("aM") }, "Anulando…").then(function () { closeModal(); toast("Corrección anulada"); load(); }).catch(function (e) { closeModal(); fail(e); }); });
          });
        });
      }).catch(function (e) { fail(e); });
    }
    load();
    on("kGo", "click", function () {
      $("kErr").textContent = "";
      api("correccion_agregar", { documento: val("kW"), fecha: val("kF"), hora: val("kH"), tipo: val("kT"), motivo: val("kM") }, "Registrando…").then(function () {
        toast("Corrección registrada"); $("kM").value = ""; load();
      }).catch(function (e) { fail(e, "kErr"); });
    });
  }

  // ---------------------------------------------------------------- Administrador: reportes
  function viewReport() {
    var first = today().substring(0, 8) + "01";
    app.innerHTML = head("Reportes en Excel", S.user.rol === "Administrador general" ? "Todas las áreas" : "Solo tus áreas") +
      '<div class="card"><div class="grid2"><div><label for="rF">Desde</label><input type="date" id="rF" value="' + first + '"></div><div><label for="rH">Hasta</label><input type="date" id="rH" value="' + today() + '"></div></div>' +
      '<button class="btn" id="rGo">Generar Excel</button><div class="err" id="rErr"></div><div id="rOut"></div>' +
      '<p class="hint">Incluye: resumen diario, totales, por área, por sede, horas extra, alertas de ubicación y Registro SUNAFIL. Máximo 3 meses.</p></div>';
    backMenu();
    on("rGo", "click", function () {
      $("rErr").textContent = ""; $("rOut").innerHTML = "";
      api("reporte", { desde: val("rF"), hasta: val("rH") }, "Generando Excel… puede tardar unos segundos").then(function (r) {
        var url = saveFile(r.nombre, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", r.base64);
        if (!url) { $("rOut").innerHTML = '<p class="hint c-green">Elige dónde guardar el archivo.</p>'; return; }
        $("rOut").innerHTML = '<a class="btn blue" style="text-decoration:none" href="' + url + '" download="' + esc(r.nombre) + '">⬇ Descargar ' + esc(r.nombre) + "</a>";
      }).catch(function (e) { fail(e, "rErr"); });
    });
  }

  // ---------------------------------------------------------------- Administrador general: listas
  var LTAB = "areas";
  function viewLists(tab) {
    LTAB = typeof tab === "string" ? tab : LTAB;
    var tabs = [["areas", "Áreas"], ["cargos", "Cargos"], ["sedes", "Sedes"], ["turnos", "Turnos"], ["feriados", "Feriados"]];
    app.innerHTML = head("Listas del sistema") + '<div class="tabs">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (t[0] === LTAB ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<button class="btn" id="add">+ Agregar</button><div id="list"></div>';
    backMenu();
    Array.prototype.forEach.call(app.querySelectorAll("[data-t]"), function (b) { b.addEventListener("click", function () { viewLists(b.getAttribute("data-t")); }); });
    on("add", "click", function () { editItem(null); });
    loadingInto("list");
    S.cat = null;
    catalog().then(function (c) {
      var items = c[LTAB === "areas" ? "todasLasAreas" : LTAB] || [];
      var html = items.map(function (x, i) {
        var sub = "";
        if (LTAB === "sedes") sub = (x.lat !== null && x.lng !== null ? x.lat + ", " + x.lng : "Sin coordenadas") + " · radio " + x.radio + " m · " + (x.validar ? "valida ubicación" : "no valida");
        if (LTAB === "turnos") sub = x.entrada + " - " + x.salida + " · tolerancia " + x.tolerancia + " min · refrigerio " + x.refrigerio + " min · días " + x.dias;
        if (LTAB === "feriados") return '<div class="item"><div class="top"><b>' + esc(showDate(x.fecha)) + " · " + esc(x.descripcion) + '</b><button class="btn ghost sm" style="width:auto;margin:0" data-del="' + esc(x.fecha) + '">Quitar</button></div></div>';
        return '<div class="item click" data-e="' + i + '"><div class="top"><b>' + esc(x.nombre) + '</b><span class="pill ' + (x.activo ? "p-green" : "p-gray") + '">' + (x.activo ? "Activo" : "Inactivo") + "</span></div>" + (sub ? '<div class="sub">' + esc(sub) + "</div>" : "") + "</div>";
      }).join("");
      $("list").innerHTML = html || '<div class="empty">Lista vacía.</div>';
      Array.prototype.forEach.call(app.querySelectorAll("[data-e]"), function (el) { el.addEventListener("click", function () { editItem(items[+el.getAttribute("data-e")]); }); });
      Array.prototype.forEach.call(app.querySelectorAll("[data-del]"), function (b) {
        b.addEventListener("click", function () { api("feriado_guardar", { accion: "quitar", fecha: b.getAttribute("data-del") }, "Quitando…").then(function () { toast("Feriado quitado"); viewLists("feriados"); }).catch(fail); });
      });
    }).catch(function (e) { fail(e); });
  }
  function editItem(x) {
    var t = LTAB, nuevo = !x;
    x = x || { nombre: "", activo: true, lat: "", lng: "", radio: 200, validar: false, entrada: "08:00", salida: "17:00", tolerancia: 10, refrigerio: 60, dias: "LMXJV" };
    var html = "<h3>" + (nuevo ? "Agregar" : "Editar") + "</h3>";
    if (t === "feriados") {
      html += '<div class="field"><label for="eF">Fecha</label><input type="date" id="eF"></div><div class="field"><label for="eD">Descripción</label><input id="eD"></div>';
    } else {
      html += '<div class="field"><label for="eN">Nombre</label><input id="eN" value="' + esc(x.nombre) + '"></div>';
      if (t === "sedes") html += '<div class="grid2 field"><div><label for="eLa">Latitud</label><input id="eLa" inputmode="decimal" value="' + esc(x.lat === null ? "" : x.lat) + '"></div><div><label for="eLo">Longitud</label><input id="eLo" inputmode="decimal" value="' + esc(x.lng === null ? "" : x.lng) + '"></div></div>' +
        '<button class="btn ghost sm" id="eGps">📍 Usar mi ubicación actual</button><div class="grid2 field"><div><label for="eR">Radio (m)</label><input id="eR" inputmode="numeric" value="' + esc(x.radio) + '"></div><div><label for="eV">Validar ubicación</label><select id="eV">' + opt("NO", "No", !x.validar) + opt("SI", "Sí", x.validar) + "</select></div></div>";
      if (t === "turnos") {
        html += '<div class="grid2 field"><div><label for="eE">Entrada</label><input type="time" id="eE" value="' + esc(x.entrada) + '"></div><div><label for="eS">Salida</label><input type="time" id="eS" value="' + esc(x.salida) + '"></div></div>' +
          '<div class="grid2 field"><div><label for="eT">Tolerancia (min)</label><input id="eT" inputmode="numeric" value="' + esc(x.tolerancia) + '"></div><div><label for="eRf">Refrigerio (min)</label><input id="eRf" inputmode="numeric" value="' + esc(x.refrigerio) + '"></div></div>' +
          '<div class="field"><label>Días laborables</label><div class="grid3">' + [["L", "Lunes"], ["M", "Martes"], ["X", "Miércoles"], ["J", "Jueves"], ["V", "Viernes"], ["S", "Sábado"], ["D", "Domingo"]].map(function (d) {
            return '<label class="chk" style="font-weight:500;border:0;padding:6px 0"><input type="checkbox" data-d="' + d[0] + '"' + (x.dias.indexOf(d[0]) >= 0 ? " checked" : "") + ">" + d[1] + "</label>"; }).join("") + "</div></div>" +
          (nuevo ? "" : '<p class="hint c-orange">Si cambias el horario, también se recalculan los días pasados. Para no alterar el historial, crea un turno nuevo.</p>');
      }
      html += '<div class="field"><label for="eA">Estado</label><select id="eA">' + opt("1", "Activo", x.activo) + opt("0", "Inactivo (no aparece para nuevos registros)", !x.activo) + "</select></div>";
    }
    html += '<div class="err" id="eErr"></div><div class="row-btns"><button class="btn ghost" id="mClose">Cancelar</button><button class="btn" id="eGo">Guardar</button></div>';
    openModal(html);
    on("mClose", "click", closeModal);
    on("eGps", "click", function () {
      wait("Obteniendo ubicación…");
      getLocation().then(function (l) { wait(); if (!l) { $("eErr").textContent = "No se pudo obtener la ubicación."; return; } $("eLa").value = l.lat.toFixed(6); $("eLo").value = l.lng.toFixed(6); toast("Precisión: " + Math.round(l.acc) + " m"); });
    });
    on("eGo", "click", function () {
      var p;
      if (t === "feriados") p = api("feriado_guardar", { accion: "agregar", fecha: val("eF"), descripcion: val("eD") }, "Guardando…");
      else {
        var d = { nombre: val("eN"), activo: val("eA") === "1" };
        if (t === "sedes") { d.lat = val("eLa"); d.lng = val("eLo"); d.radio = val("eR"); d.validar = val("eV") === "SI"; }
        if (t === "turnos") { d.entrada = val("eE"); d.salida = val("eS"); d.tolerancia = val("eT"); d.refrigerio = val("eRf"); d.dias = ""; Array.prototype.forEach.call(document.querySelectorAll("[data-d]"), function (c) { if (c.checked) d.dias += c.getAttribute("data-d"); }); }
        p = api("catalogo_guardar", { tipo: t, original: nuevo ? "" : x.nombre, datos: d }, "Guardando…");
      }
      p.then(function () { closeModal(); toast("Guardado"); viewLists(t); }).catch(function (e) { fail(e, "eErr"); });
    });
  }

  window.appLogout = function () { if (S.token) call("web", "logout", { token: S.token }).catch(function () {}); S.token = null; };
  if (APP) viewLogin(); else viewHome();
})();
</script>
</body>
</html>
`;
