
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
