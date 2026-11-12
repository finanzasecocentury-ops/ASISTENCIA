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
