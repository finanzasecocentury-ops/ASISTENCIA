/**
 * Asistencia Ecocentury – Servidor en Google Sheets (Apps Script)  ·  versión 2.0
 *
 * 1. Cambia la CLAVE de abajo por una clave tuya (la misma se pone en la app).
 * 2. Implementar > Nueva implementación > Aplicación web
 *    - Ejecutar como: Yo      - Quién tiene acceso: Cualquier persona
 * 3. Copia la URL que termina en /exec y pégala en la app (Administración > Conexión a la nube).
 * 4. Recarga la hoja y usa el menú "Asistencia > Preparar hojas".
 */

const CLAVE = 'CAMBIA-ESTA-CLAVE';
const CARPETA_FOTOS = 'Asistencia Ecocentury - Fotos';

const TIPOS_SOL = ['PERMISO', 'VACACIONES', 'JUSTIFICACIÓN', 'HORAS EXTRA', 'CAMBIO DE TURNO', 'CORRECCIÓN DE MARCA'];
const ESTADOS_SOL = ['PENDIENTE', 'APROBADO', 'RECHAZADO'];

const H_MARC = ['ID', 'Fecha', 'Hora', 'DNI', 'Nombre', 'Tipo', 'Tardanza (min)', 'Foto', 'Equipo', 'Día (clave)',
  'Registrado', 'Sede', 'Latitud', 'Longitud', 'Precisión (m)', 'Distancia a sede (m)', 'Ubicación'];
const H_SOL = ['ID', 'Fecha de solicitud', 'DNI', 'Nombre', 'Tipo', 'Desde', 'Hasta', 'Detalle', 'Motivo',
  'Estado', 'Respuesta del jefe', 'Fecha de respuesta'];

const CONFIG_DEF = [
  ['Razón social', ''],
  ['RUC', ''],
  ['Turno por defecto', 'Administrativo'],
  ['Mínimo de horas extra (min)', '30'],
  ['Horas extra requieren aprobación (SI/NO)', 'SI'],
];

const HOJAS = [
  { n: 'Trabajadores', h: ['DNI', 'Nombre', 'Activo (SI/NO)', 'Sede', 'Turno', 'Cargo', 'Clave personal'],
    w: [11, 30, 13, 22, 18, 18, 13], filas: [] },
  { n: 'Sedes', h: ['Sede', 'Latitud', 'Longitud', 'Radio (m)', 'Validar ubicación (SI/NO)'],
    w: [24, 13, 13, 10, 22], filas: [['Oficina principal', '', '', '200', 'NO']] },
  { n: 'Turnos', h: ['Turno', 'Entrada', 'Salida', 'Tolerancia (min)', 'Refrigerio (min)', 'Días laborables'],
    w: [18, 9, 9, 14, 14, 16], filas: [
      ['Administrativo', '08:00', '17:00', '10', '60', 'LMXJV'],
      ['Obra', '07:00', '16:00', '10', '60', 'LMXJVS'],
      ['Noche', '22:00', '06:00', '10', '30', 'LMXJV']] },
  { n: 'Programación', h: ['DNI', 'Fecha (dd/mm/aaaa)', 'Turno (o DESCANSO)'], w: [11, 17, 20], filas: [] },
  { n: 'Feriados', h: ['Fecha (dd/mm/aaaa)', 'Descripción'], w: [17, 34], filas: [
      ['08/12/2026', 'Inmaculada Concepción'], ['09/12/2026', 'Batalla de Ayacucho'], ['25/12/2026', 'Navidad'],
      ['01/01/2027', 'Año Nuevo'], ['25/03/2027', 'Jueves Santo'], ['26/03/2027', 'Viernes Santo'],
      ['01/05/2027', 'Día del Trabajo'], ['07/06/2027', 'Batalla de Arica'], ['29/06/2027', 'San Pedro y San Pablo'],
      ['23/07/2027', 'Día de la Fuerza Aérea'], ['28/07/2027', 'Fiestas Patrias'], ['29/07/2027', 'Fiestas Patrias'],
      ['06/08/2027', 'Batalla de Junín'], ['30/08/2027', 'Santa Rosa de Lima'], ['08/10/2027', 'Combate de Angamos'],
      ['01/11/2027', 'Todos los Santos'], ['08/12/2027', 'Inmaculada Concepción'], ['09/12/2027', 'Batalla de Ayacucho'],
      ['25/12/2027', 'Navidad']] },
  { n: 'Marcaciones', h: H_MARC, w: [24, 11, 9, 11, 28, 10, 13, 34, 18, 11, 18, 18, 11, 11, 11, 15, 11], filas: [] },
  { n: 'Correcciones', h: ['DNI', 'Fecha (dd/mm/aaaa)', 'Hora (HH:mm)', 'Tipo (ENTRADA/SALIDA)', 'Motivo',
      'Registrado por', 'Fecha de registro'], w: [11, 17, 12, 20, 34, 24, 18], filas: [] },
  { n: 'Solicitudes', h: H_SOL, w: [16, 18, 11, 28, 20, 11, 11, 24, 34, 12, 30, 18], filas: [] },
  { n: 'Configuración', h: ['Parámetro', 'Valor'], w: [40, 22], filas: CONFIG_DEF },
];

// ================================================================ Web app

function doGet() {
  return json_({ ok: true, mensaje: 'Servidor de asistencia activo', version: 2 });
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, error: 'Solicitud inválida' }); }
  if (String(b.clave || '') !== CLAVE) return json_({ ok: false, error: 'Clave incorrecta' });
  try {
    asegurarHojas_();
    switch (b.accion) {
      case 'datos': return json_(datos_());
      case 'marcar': return json_(marcar_(b.marcas || []));
      case 'marcas': return json_({ ok: true, marcas: marcasRango_(String(b.dia), String(b.dia)) });
      case 'resumen': return json_(resumenDia_(String(b.dia || hoyIso_())));
      case 'mi_resumen': return json_(miResumen_(b));
      case 'solicitar': return json_(solicitar_(b));
      case 'mis_solicitudes': return json_(misSolicitudes_(b));
      default: return json_({ ok: false, error: 'Acción desconocida' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ================================================================ Utilidades

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tz_() { return ss_().getSpreadsheetTimeZone(); }
function hoja_(n) { return ss_().getSheetByName(n); }
function pad_(n) { return String(n).padStart(2, '0'); }
function num_(v, d) { const n = parseInt(v, 10); return isNaN(n) || n < 0 ? d : n; }
function si_(v) { return String(v || '').trim().toUpperCase().startsWith('S'); }
function norm_(s) { return String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function dni_(v) {
  let s = String(v == null ? '' : v).trim();
  if (/^\d+$/.test(s) && s.length < 8) s = s.padStart(8, '0');
  return s;
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
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + pad_(m[2]) + '-' + pad_(m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : '';
}

function isoAFecha_(iso) { const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

function sumarDias_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.getUTCFullYear() + '-' + pad_(d.getUTCMonth() + 1) + '-' + pad_(d.getUTCDate());
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

// ================================================================ Hojas

function asegurarHojas_() {
  const ss = ss_();
  HOJAS.forEach(def => {
    let sh = ss.getSheetByName(def.n);
    if (!sh) {
      sh = ss.insertSheet(def.n);
      sh.getRange(1, 1, Math.max(1000, sh.getMaxRows ? sh.getMaxRows() : 1000), def.h.length).setNumberFormat('@');
      encabezado_(sh, def.h, def.w);
      if (def.filas.length) sh.getRange(2, 1, def.filas.length, def.h.length).setValues(def.filas);
      validaciones_(def.n, sh);
    } else {
      // Agrega columnas nuevas de versiones anteriores
      const actual = sh.getRange(1, 1, 1, def.h.length).getValues()[0];
      def.h.forEach((t, i) => {
        if (String(actual[i] || '') === '') {
          sh.getRange(1, i + 1, Math.max(2, sh.getLastRow()), 1).setNumberFormat('@');
          encabezado_(sh, def.h, def.w);
        }
      });
      if (def.n === 'Configuración') {
        const tiene = filas_('Configuración', 1).map(r => String(r[0]).trim());
        const faltan = CONFIG_DEF.filter(c => tiene.indexOf(c[0]) < 0);
        if (faltan.length) sh.getRange(sh.getLastRow() + 1, 1, faltan.length, 2).setValues(faltan);
      }
    }
  });
  const h1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Hoja1') || ss.getSheetByName('Sheet1');
  if (h1 && h1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(h1);
}

function encabezado_(sh, headers, widths) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#2e7d32');
  sh.setFrozenRows(1);
  (widths || []).forEach((w, i) => sh.setColumnWidth(i + 1, w * 7));
}

function lista_(sh, a1, valores) {
  try {
    sh.getRange(a1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(valores, true).setAllowInvalid(false).build());
  } catch (e) { /* sin validación */ }
}

function listaRango_(sh, a1, origen) {
  try {
    sh.getRange(a1).setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(origen, true).setAllowInvalid(true).build());
  } catch (e) { /* sin validación */ }
}

function validaciones_(nombre, sh) {
  const ss = ss_();
  if (nombre === 'Trabajadores') {
    lista_(sh, 'C2:C', ['SI', 'NO']);
    if (ss.getSheetByName('Sedes')) listaRango_(sh, 'D2:D', ss.getSheetByName('Sedes').getRange('A2:A'));
    if (ss.getSheetByName('Turnos')) listaRango_(sh, 'E2:E', ss.getSheetByName('Turnos').getRange('A2:A'));
  }
  if (nombre === 'Sedes') lista_(sh, 'E2:E', ['SI', 'NO']);
  if (nombre === 'Correcciones') lista_(sh, 'D2:D', ['ENTRADA', 'SALIDA']);
  if (nombre === 'Solicitudes') { lista_(sh, 'J2:J', ESTADOS_SOL); lista_(sh, 'E2:E', TIPOS_SOL); }
}

/** Completa datos automáticos al editar a mano. */
function onEdit(e) {
  try {
    const sh = e.range.getSheet();
    const fila = e.range.getRow();
    if (fila < 2) return;
    const ahora = Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm:ss');
    let quien = '';
    try { quien = (e.user && e.user.getEmail && e.user.getEmail()) || Session.getActiveUser().getEmail() || ''; } catch (x) { }
    if (sh.getName() === 'Correcciones' && e.range.getColumn() <= 5) {
      if (!sh.getRange(fila, 7).getValue()) sh.getRange(fila, 6, 1, 2).setValues([[quien || '(editor)', ahora]]);
    }
    if (sh.getName() === 'Solicitudes' && e.range.getColumn() === 10) {
      sh.getRange(fila, 12).setValue(ahora);
    }
  } catch (err) { /* nada */ }
}

// ================================================================ Lectura de datos

function config_() {
  const m = {};
  filas_('Configuración', 2).forEach(r => { m[String(r[0]).trim()] = r[1]; });
  return {
    razon: String(m['Razón social'] || ''),
    ruc: String(m['RUC'] || ''),
    turnoDef: String(m['Turno por defecto'] || 'Administrativo').trim(),
    heMin: num_(m['Mínimo de horas extra (min)'], 30),
    heAprob: m['Horas extra requieren aprobación (SI/NO)'] === undefined ? true : si_(m['Horas extra requieren aprobación (SI/NO)']),
  };
}

function trabajadoresTodos_() {
  return filas_('Trabajadores', 7)
    .filter(r => String(r[0]).trim() !== '' && String(r[1]).trim() !== '')
    .map(r => ({
      dni: dni_(r[0]), nombre: String(r[1]).trim(), activo: norm_(r[2]) !== 'NO',
      sede: String(r[3] || '').trim(), turno: String(r[4] || '').trim(), cargo: String(r[5] || '').trim(),
      claveP: String(r[6] || '').trim(),
    }));
}

function solicitudes_() {
  return filas_('Solicitudes', H_SOL.length).map((r, i) => ({
    fila: i + 2, id: String(r[0]), fecha: String(r[1] instanceof Date ? Utilities.formatDate(r[1], tz_(), 'dd/MM/yyyy HH:mm') : r[1]),
    dni: dni_(r[2]), nombre: String(r[3]), tipo: norm_(r[4]), tipoTxt: String(r[4]),
    desde: fechaIso_(r[5]), hasta: fechaIso_(r[6]) || fechaIso_(r[5]), detalle: String(r[7] || ''),
    motivo: String(r[8] || ''), estado: norm_(r[9]) || 'PENDIENTE', respuesta: String(r[10] || ''),
  })).filter(s => s.dni && s.desde);
}

function contexto_() {
  const turnos = {};
  filas_('Turnos', 6).forEach(r => {
    const n = String(r[0]).trim();
    const e = minutos_(hora_(r[1], '')), s = minutos_(hora_(r[2], ''));
    if (!n || e === null || s === null) return;
    turnos[norm_(n)] = { nombre: n, ent: e, sal: s, tol: num_(r[3], 10), ref: num_(r[4], 0), dias: dias_(r[5]) };
  });
  const sedes = {};
  filas_('Sedes', 5).forEach(r => {
    const n = String(r[0]).trim();
    if (!n) return;
    const lat = parseFloat(String(r[1]).replace(',', '.')), lng = parseFloat(String(r[2]).replace(',', '.'));
    sedes[norm_(n)] = { nombre: n, lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng,
      radio: num_(r[3], 200), validar: si_(r[4]) };
  });
  const prog = {};
  filas_('Programación', 3).forEach(r => {
    const d = dni_(r[0]), f = fechaIso_(r[1]);
    if (d && f && String(r[2]).trim()) prog[d + '|' + f] = String(r[2]).trim();
  });
  const feriados = {};
  filas_('Feriados', 2).forEach(r => { const f = fechaIso_(r[0]); if (f) feriados[f] = String(r[1] || 'Feriado'); });
  const aprobadas = solicitudes_().filter(s => s.estado === 'APROBADO');
  const corr = [];
  filas_('Correcciones', 5).forEach(r => {
    const d = dni_(r[0]), f = fechaIso_(r[1]), h = hora_(r[2], ''), t = norm_(r[3]);
    if (d && f && h && (t === 'ENTRADA' || t === 'SALIDA')) corr.push({ dni: d, dia: f, min: minutos_(h), tipo: t, origen: 'Corrección: ' + String(r[4] || '') });
  });
  aprobadas.filter(s => s.tipo === 'CORRECCION DE MARCA').forEach(s => {
    const m = norm_(s.detalle).match(/(ENTRADA|SALIDA)\D*(\d{1,2}:\d{2})/);
    if (m) corr.push({ dni: s.dni, dia: s.desde, min: minutos_(m[2]), tipo: m[1], origen: 'Solicitud aprobada: ' + s.motivo });
  });
  return { cfg: config_(), turnos, sedes, trab: trabajadoresTodos_(), prog, feriados, aprobadas, corr,
    hoy: hoyIso_(), ahora: ahoraMin_() };
}

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
      fecha: String(r[1]), hora: String(r[2]), dni: dni_(r[3]), nombre: String(r[4]), tipo: norm_(r[5]),
      dia: String(r[9]), foto: String(r[7] || ''), sede: String(r[11] || ''), lat: String(r[12] || ''),
      lng: String(r[13] || ''), dist: String(r[15] || ''), ubic: String(r[16] || ''),
    }));
}

// ================================================================ Cálculo de un día

function calcDia_(ctx, w, dia, marcas) {
  const t = turnoDe_(ctx, w, dia);
  const fer = ctx.feriados[dia] || '';
  const laborable = !t.descanso && t.dias.indexOf(diaSemana_(dia)) >= 0 && !fer;
  const ms = marcas.slice().sort((a, b) => a.min - b.min);
  let ent = null, sal = null, corr = false;
  const alertas = [];
  ms.forEach(m => {
    if (m.origen) corr = true;
    if (m.ubic && ['FUERA', 'SIN GPS', 'FALSA'].indexOf(m.ubic) >= 0) alertas.push(m.tipo + ' ' + m.ubic);
    if (m.tipo === 'ENTRADA') { if (ent === null) ent = m.min; } else sal = m.min;
  });
  if (ent !== null && sal !== null && sal < ent) sal += 1440; // turno que cruza medianoche

  const r = {
    dia, fecha: isoAFecha_(dia), dni: w.dni, nombre: w.nombre, sede: w.sede || '', turno: t.nombre,
    horario: t.descanso ? '' : horaTxt_(t.ent) + '-' + horaTxt_(t.sal),
    ent: ent === null ? '' : horaTxt_(ent), sal: sal === null ? '' : horaTxt_(sal),
    trab: null, tarde: 0, tardeJust: false, he: 0, he25: 0, he35: 0, heEstado: '',
    estado: '', alerta: alertas.join('; '), correccion: corr, falta: false, laborable,
    asistio: ent !== null, enJornada: false, vacaciones: false, permiso: false,
  };
  const just = solDe_(ctx, w.dni, dia, 'PERMISO') || solDe_(ctx, w.dni, dia, 'JUSTIFICACION');
  const vac = solDe_(ctx, w.dni, dia, 'VACACIONES');

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
    if (vac) { r.estado = 'Vacaciones'; r.vacaciones = true; }
    else if (fer) r.estado = 'Feriado: ' + fer;
    else if (!laborable) r.estado = 'Descanso';
    else if (just) { r.estado = 'Permiso / justificado'; r.permiso = true; }
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

/** Filas por día y trabajador. soloDni: opcional. */
function resumenRango_(ctx, desde, hasta, soloDni) {
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
  const ws = ctx.trab.slice();
  Object.keys(nombres).forEach(d => {
    if (!ws.some(w => w.dni === d)) ws.push({ dni: d, nombre: nombres[d], activo: false, sede: '', turno: '' });
  });
  ws.sort((a, b) => (a.sede + a.nombre).localeCompare(b.sede + b.nombre));
  const filas = [];
  const fin = hasta < ctx.hoy ? hasta : ctx.hoy;
  for (let dia = desde; dia <= fin; dia = sumarDias_(dia, 1)) {
    ws.forEach(w => {
      if (soloDni && w.dni !== soloDni) return;
      const ms = porClave[dia + '|' + w.dni] || [];
      if (!ms.length && !w.activo) return;
      filas.push(calcDia_(ctx, w, dia, ms));
    });
  }
  return filas;
}

// ================================================================ Acciones de la app

function datos_() {
  const ctx = contexto_();
  const trabajadores = ctx.trab.filter(w => w.activo).map(w => {
    const t = turnoDe_(ctx, w, ctx.hoy);
    const lab = !t.descanso && t.dias.indexOf(diaSemana_(ctx.hoy)) >= 0 && !ctx.feriados[ctx.hoy];
    return { dni: w.dni, nombre: w.nombre, sede: w.sede, turno: t.nombre,
      entrada: t.descanso ? '' : horaTxt_(t.ent), tolerancia: t.tol, laborable: lab };
  });
  const sedes = Object.keys(ctx.sedes).map(k => ctx.sedes[k]);
  return { ok: true, fecha: ctx.hoy, trabajadores, sedes };
}

function carpeta_() {
  const it = DriveApp.getFoldersByName(CARPETA_FOTOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_FOTOS);
}

function marcar_(marcas) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_('Marcaciones');
    const n = sh.getLastRow() - 1;
    const existentes = new Set(n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(r => String(r[0])) : []);
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
          if (!carpeta) carpeta = carpeta_();
          const blob = Utilities.newBlob(Utilities.base64Decode(m.foto), 'image/jpeg',
            (m.dia || '') + '_' + String(m.hora || '').replace(/:/g, '') + '_' + m.dni + '_' + m.tipo + '.jpg');
          foto = carpeta.createFile(blob).getUrl();
        } catch (err) { foto = 'Error al guardar foto'; }
      }
      const v = x => x === undefined || x === null ? '' : String(x);
      filas.push([id, v(m.fecha), v(m.hora), dni_(m.dni), v(m.nombre), v(m.tipo), v(m.tardanza), foto, v(m.equipo),
        v(m.dia), Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm:ss'), v(m.sede), v(m.lat), v(m.lng),
        v(m.precision), v(m.distancia), v(m.ubicacion)]);
    });
    if (filas.length) sh.getRange(sh.getLastRow() + 1, 1, filas.length, H_MARC.length).setValues(filas);
    return { ok: true, ids: recibidos };
  } finally {
    lock.releaseLock();
  }
}

function filaApp_(r) {
  return { fecha: r.fecha, dni: r.dni, nombre: r.nombre, sede: r.sede, turno: r.turno, horario: r.horario,
    entrada: r.ent, salida: r.sal, trabajado: dur_(r.trab), tardanza: r.tarde, tardanzaJustificada: r.tardeJust,
    horasExtra: r.he ? dur_(r.he) : '', estadoHE: r.heEstado, estado: r.estado, alerta: r.alerta,
    falta: r.falta, enJornada: r.enJornada, asistio: r.asistio };
}

function resumenDia_(dia) {
  const ctx = contexto_();
  const filas = resumenRango_(ctx, dia, dia);
  return { ok: true, filas: filas.map(filaApp_) };
}

function verificarTrabajador_(b) {
  const d = dni_(b.dni);
  const w = trabajadoresTodos_().find(x => x.dni === d && x.activo);
  const esperada = w ? (w.claveP || d.slice(-4)) : null;
  if (!w || String(b.clavePersonal || '').trim() !== esperada) throw new Error('DNI o clave personal incorrectos');
  return w;
}

function miResumen_(b) {
  const w = verificarTrabajador_(b);
  const ctx = contexto_();
  const desde = sumarDias_(ctx.hoy, -Math.min(num_(b.dias, 31), 62));
  const filas = resumenRango_(ctx, desde, ctx.hoy, w.dni).reverse();
  return { ok: true, nombre: w.nombre, filas: filas.map(filaApp_) };
}

function solicitar_(b) {
  const w = verificarTrabajador_(b);
  const tipo = TIPOS_SOL.find(t => norm_(t) === norm_(b.tipo));
  if (!tipo) throw new Error('Tipo de solicitud no válido');
  const desde = fechaIso_(b.desde), hasta = fechaIso_(b.hasta) || desde;
  if (!desde || hasta < desde) throw new Error('Fechas no válidas');
  if (!String(b.motivo || '').trim()) throw new Error('Escribe el motivo');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = hoja_('Solicitudes');
    const id = 'S' + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    sh.getRange(sh.getLastRow() + 1, 1, 1, H_SOL.length).setValues([[id,
      Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm'), w.dni, w.nombre, tipo, isoAFecha_(desde),
      isoAFecha_(hasta), String(b.detalle || '').substring(0, 200), String(b.motivo).substring(0, 500), 'PENDIENTE', '', '']]);
    return { ok: true, id };
  } finally {
    lock.releaseLock();
  }
}

function misSolicitudes_(b) {
  const w = verificarTrabajador_(b);
  const lista = solicitudes_().filter(s => s.dni === w.dni).slice(-30).reverse().map(s => ({
    id: s.id, fecha: s.fecha, tipo: s.tipoTxt, desde: isoAFecha_(s.desde), hasta: isoAFecha_(s.hasta),
    detalle: s.detalle, motivo: s.motivo, estado: s.estado, respuesta: s.respuesta,
  }));
  return { ok: true, solicitudes: lista };
}

// ================================================================ Menú, panel y reportes

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Asistencia')
    .addItem('Generar reportes por fechas', 'generarReportes')
    .addItem('Actualizar panel de hoy', 'actualizarPanel')
    .addItem('Activar panel automático (cada 10 min)', 'activarPanelAutomatico')
    .addSeparator()
    .addItem('Preparar hojas', 'prepararHojas')
    .addToUi();
}

function prepararHojas() {
  asegurarHojas_();
  HOJAS.forEach(d => { const sh = hoja_(d.n); if (sh) validaciones_(d.n, sh); });
  SpreadsheetApp.getUi().alert('Listo. Completa las hojas Sedes, Turnos y Trabajadores. Revisa también Configuración y Feriados.');
}

function activarPanelAutomatico() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'actualizarPanel')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('actualizarPanel').timeBased().everyMinutes(10).create();
  actualizarPanel();
  SpreadsheetApp.getUi().alert('El panel "Panel hoy" se actualizará automáticamente cada 10 minutos.');
}

/** Escribe una tabla. tipos: t=texto, n=número, d=decimal, p=porcentaje. */
function tabla_(nombre, titulo, headers, tipos, filas, widths) {
  const ss = ss_();
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

function actualizarPanel() {
  asegurarHojas_();
  const ctx = contexto_();
  const filas = resumenRango_(ctx, ctx.hoy, ctx.hoy);
  const sedes = {};
  filas.forEach(r => {
    const s = sedes[r.sede || '(sin sede)'] = sedes[r.sede || '(sin sede)'] || [r.sede || '(sin sede)', 0, 0, 0, 0, 0, 0];
    s[1]++;
    if (r.enJornada) s[2]++;
    if (r.asistio && r.sal) s[3]++;
    if (r.estado === 'Pendiente') s[4]++;
    if (r.falta) s[5]++;
    if (r.tarde > 0) s[6]++;
  });
  const res = Object.keys(sedes).map(k => sedes[k]);
  const ahora = Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm');
  const sh = tabla_('Panel hoy', ['PANEL DE ASISTENCIA – ' + isoAFecha_(ctx.hoy), 'Actualizado: ' + ahora],
    ['Sede', 'Programados', 'Trabajando ahora', 'Ya salieron', 'Pendientes', 'Faltas', 'Tardanzas'],
    ['t', 'n', 'n', 'n', 'n', 'n', 'n'], res, [24, 12, 16, 12, 12, 10, 11]);
  const ini = 4 + res.length + 3;
  const det = filas.map(r => [r.sede, r.nombre, r.dni, r.turno, r.horario, r.ent, r.sal, r.tarde, r.estado, r.alerta]);
  const hdr = ['Sede', 'Nombre', 'DNI', 'Turno', 'Horario', 'Entrada', 'Salida', 'Tardanza (min)', 'Estado', 'Alerta de ubicación'];
  sh.getRange(ini, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1565c0');
  if (det.length) {
    sh.getRange(ini + 1, 1, det.length, hdr.length).setNumberFormat('@');
    sh.getRange(ini + 1, 8, det.length, 1).setNumberFormat('0');
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
  const filas = resumenRango_(ctx, desde, hasta);
  escribirReportes_(ctx, desde, hasta, filas, marcasRango_(desde, hasta));
  ui.alert('Reportes generados: R-Resumen diario, R-Totales, R-Por sede, R-Horas extra, R-Alertas ubicación y R-Registro SUNAFIL.');
}

function escribirReportes_(ctx, desde, hasta, filas, marcas) {
  const periodo = 'Del ' + isoAFecha_(desde) + ' al ' + isoAFecha_(hasta);

  // 1. Resumen diario
  tabla_('R-Resumen diario', null,
    ['Fecha', 'DNI', 'Nombre', 'Sede', 'Turno', 'Horario', 'Entrada', 'Salida', 'Horas trabajadas', 'Horas (decimal)',
      'Tardanza (min)', 'Horas extra', 'HE 25% (h)', 'HE 35% (h)', 'Estado HE', 'Estado', 'Alerta de ubicación', 'Con corrección'],
    ['t', 't', 't', 't', 't', 't', 't', 't', 't', 'd', 'n', 't', 'd', 'd', 't', 't', 't', 't'],
    filas.map(r => [r.fecha, r.dni, r.nombre, r.sede, r.turno, r.horario, r.ent, r.sal, dur_(r.trab), horas_(r.trab),
      r.tarde, r.he ? dur_(r.he) : '', r.he ? horas_(r.he25) : '', r.he ? horas_(r.he35) : '', r.heEstado, r.estado,
      r.alerta, r.correccion ? 'SI' : '']),
    [11, 11, 28, 18, 14, 12, 8, 8, 14, 13, 13, 11, 10, 10, 12, 24, 22, 13]);

  // 2. Totales por trabajador
  const tot = {};
  filas.forEach(r => {
    const t = tot[r.dni] = tot[r.dni] || { dni: r.dni, nombre: r.nombre, sede: r.sede, prog: 0, asis: 0, faltas: 0, tard: 0,
      tardMin: 0, tardJ: 0, perm: 0, vac: 0, trab: 0, he25: 0, he35: 0, hePend: 0 };
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
  tabla_('R-Totales', ['TOTALES POR TRABAJADOR', periodo],
    ['DNI', 'Nombre', 'Sede', 'Días programados', 'Asistencias', 'Faltas', 'Tardanzas', 'Min. tardanza',
      'Tardanzas justificadas', 'Permisos', 'Vacaciones', 'Horas trabajadas', 'HE 25% aprobadas (h)', 'HE 35% aprobadas (h)',
      'HE por aprobar (h)', '% Puntualidad', '% Ausentismo'],
    ['t', 't', 't', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'n', 'd', 'd', 'd', 'd', 'p', 'p'],
    T.map(t => [t.dni, t.nombre, t.sede, t.prog, t.asis, t.faltas, t.tard, t.tardMin, t.tardJ, t.perm, t.vac,
      horas_(t.trab), horas_(t.he25), horas_(t.he35), horas_(t.hePend),
      t.asis ? (t.asis - t.tard) / t.asis : 0, t.prog ? t.faltas / t.prog : 0]),
    [11, 28, 18, 15, 11, 8, 10, 12, 18, 9, 10, 15, 18, 18, 16, 13, 12]);

  // 3. Por sede
  const sed = {};
  T.forEach(t => {
    const s = sed[t.sede || '(sin sede)'] = sed[t.sede || '(sin sede)'] || { n: 0, prog: 0, asis: 0, faltas: 0, tard: 0, he: 0, trab: 0 };
    s.n++; s.prog += t.prog; s.asis += t.asis; s.faltas += t.faltas; s.tard += t.tard; s.he += t.he25 + t.he35; s.trab += t.trab;
  });
  tabla_('R-Por sede', ['RESUMEN POR SEDE', periodo],
    ['Sede', 'Trabajadores', 'Días programados', 'Asistencias', 'Faltas', 'Tardanzas', 'Horas trabajadas',
      'HE aprobadas (h)', '% Puntualidad', '% Ausentismo'],
    ['t', 'n', 'n', 'n', 'n', 'n', 'd', 'd', 'p', 'p'],
    Object.keys(sed).map(k => { const s = sed[k]; return [k, s.n, s.prog, s.asis, s.faltas, s.tard, horas_(s.trab), horas_(s.he),
      s.asis ? (s.asis - s.tard) / s.asis : 0, s.prog ? s.faltas / s.prog : 0]; }),
    [24, 12, 15, 11, 8, 10, 15, 15, 13, 12]);

  // 4. Horas extra
  tabla_('R-Horas extra', ['HORAS EXTRA (SOBRETIEMPO)', periodo,
    'Referencia: primeras 2 horas con recargo mínimo de 25% y las siguientes con 35% (verificar con su asesor laboral).'],
    ['Fecha', 'DNI', 'Nombre', 'Sede', 'Turno', 'Horario', 'Entrada', 'Salida', 'Horas extra', 'HE 25% (h)', 'HE 35% (h)', 'Estado'],
    ['t', 't', 't', 't', 't', 't', 't', 't', 't', 'd', 'd', 't'],
    filas.filter(r => r.he > 0).map(r => [r.fecha, r.dni, r.nombre, r.sede, r.turno, r.horario, r.ent, r.sal, dur_(r.he),
      horas_(r.he25), horas_(r.he35), r.heEstado]),
    [11, 11, 28, 18, 14, 12, 8, 8, 11, 10, 10, 12]);

  // 5. Alertas de ubicación
  tabla_('R-Alertas ubicación', ['MARCACIONES FUERA DE SEDE O SIN GPS', periodo],
    ['Fecha', 'Hora', 'DNI', 'Nombre', 'Tipo', 'Sede', 'Ubicación', 'Distancia (m)', 'Mapa', 'Foto'],
    ['t', 't', 't', 't', 't', 't', 't', 't', 't', 't'],
    marcas.filter(m => ['FUERA', 'SIN GPS', 'FALSA'].indexOf(m.ubic) >= 0).map(m => [m.fecha, m.hora, m.dni, m.nombre, m.tipo,
      m.sede, m.ubic, m.dist, m.lat && m.lng ? 'https://maps.google.com/?q=' + m.lat + ',' + m.lng : '', m.foto]),
    [11, 9, 11, 28, 10, 18, 11, 13, 40, 40]);

  // 6. Registro de control de asistencia (formato para inspección)
  const reg = filas.filter(r => r.asistio || r.falta || r.vacaciones || r.permiso || r.estado === 'Sin entrada');
  let i = 0;
  tabla_('R-Registro SUNAFIL', ['REGISTRO DE CONTROL DE ASISTENCIA',
    'Empleador: ' + (ctx.cfg.razon || '(completar Razón social en Configuración)') + '   RUC: ' + (ctx.cfg.ruc || '(completar)'),
    periodo + '   ·   Generado: ' + Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy HH:mm')],
    ['N°', 'DNI', 'Apellidos y nombres', 'Fecha', 'Hora de ingreso', 'Hora de salida', 'Sobretiempo (h:mm)', 'Observaciones'],
    ['n', 't', 't', 't', 't', 't', 't', 't'],
    reg.map(r => [++i, r.dni, r.nombre, r.fecha, r.ent, r.sal, r.he && r.heEstado === 'Aprobada' ? dur_(r.he) : '',
      [r.estado === 'Puntual' ? '' : r.estado, r.correccion ? 'Incluye corrección registrada' : ''].filter(String).join(' · ')]),
    [6, 11, 32, 11, 14, 14, 17, 40]);
}
