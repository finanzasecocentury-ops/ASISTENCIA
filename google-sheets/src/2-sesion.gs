
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
