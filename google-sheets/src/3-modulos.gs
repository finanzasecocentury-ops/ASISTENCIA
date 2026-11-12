
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
