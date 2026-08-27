// ===================== SUPABASE =====================

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ===================== NAVIGATION =====================

const allPages = ['inicio','progreso','horario','planes','pagos','historial','contrato','notificaciones','noticias-usuario','admin-dashboard','admin-usuarios','admin-financiero','admin-checkin','admin-horarios','admin-comunicacion','admin-contratos','admin-personal','admin-inventario','admin-proveedores','admin-noticias','admin-boveda','admin-legales','admin-solicitudes','cronograma','employee-perfil','instructor-dashboard','instructor-clases','instructor-asistencia','instructor-perfil','instructor-pagos','instructor-solicitudes','instructor-docs','user-clases','instructor-resumen-clases','boveda-legal-readonly','redes-sociales','admin-sistemas','manuales','personal-directorio-readonly'];
let currentView = 'user';

// ===================== MOBILE SIDEBAR =====================

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    sidebar.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('open');
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 900) closeSidebar();
});

// Clear any stale loading spinners left by in-flight async page loads.
// Called at the start of every navigation so a slow/failed previous fetch
// cannot leave a spinner visible when the user returns to that section.
function _clearStaleLoaders() {
  ['legales-container', 'admin-solicitudes-list', 'instructor-solicitudes-list'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.querySelector('.thor-loader')) el.innerHTML = '';
  });
}

function showPage(pageId) {
  _clearStaleLoaders();
  closeSidebar();
  allPages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.classList.remove('active');
  });
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.add('active');
    if (pageId === 'progreso')          loadProgresoPage(currentUser?.id);
    if (pageId === 'horario')           loadHorarioPage(currentUser?.id);
    if (pageId === 'planes')            loadPlanesPage();
    if (pageId === 'pagos')             loadPagosPage(currentUser?.id);
    if (pageId === 'admin-dashboard') { loadAdminDashboard(); loadBirthdayWidget(); }
    if (pageId === 'admin-horarios') { _horariosWeekOffset = 0; loadAdminHorariosPage(); }
    if (pageId === 'admin-checkin')    loadCheckinPage();
    if (pageId === 'contrato')          renderContractPage();
    if (pageId === 'admin-usuarios')    loadAdminUsuariosPage();
    if (pageId === 'admin-contratos')   renderAdminContractsPage();
    if (pageId === 'admin-personal')    renderPersonalList();
    if (pageId === 'admin-inventario')   loadInventario();
    if (pageId === 'admin-proveedores')  loadProveedoresPage();
    if (pageId === 'admin-financiero')  loadFinancieroPage();
    if (pageId === 'admin-comunicacion')  loadComunicacionPage();
    if (pageId === 'notificaciones')      loadNotificacionesPage();
    if (pageId === 'noticias-usuario')    loadNoticiasUsuarioPage();
    if (pageId === 'admin-noticias')      loadAdminNoticiasPage();
    if (pageId === 'employee-perfil')      renderEmployeeSelfProfile();
    if (pageId === 'instructor-dashboard') loadInstructorDashboard();
    if (pageId === 'instructor-clases')   loadInstructorClasesPage();
    if (pageId === 'instructor-asistencia') loadInstructorAsistencia();
    if (pageId === 'instructor-perfil')    renderEmployeeSelfProfile('instructor-self-container');
    if (pageId === 'instructor-pagos')     loadInstructorPagosPage();
    if (pageId === 'user-clases')          loadUserClasesPage();
    if (pageId === 'admin-boveda')         loadVaultDocs();
    if (pageId === 'admin-legales')        loadLegalDocsPage();
    if (pageId === 'admin-solicitudes')    loadAdminSolicitudesPage();
    if (pageId === 'instructor-solicitudes') loadInstructorSolicitudesPage();
    if (pageId === 'instructor-docs')        loadInstructorDocsPage();
    if (pageId === 'boveda-legal-readonly')  loadBovedaLegalReadOnly();
    if (pageId === 'redes-sociales')         loadRedesSocialesPage();
    if (pageId === 'admin-sistemas')         loadSistemasAdminPage();
    if (pageId === 'manuales')               loadManualesReadOnly();
    if (pageId === 'instructor-resumen-clases') loadInstructorResumenClasesPage();
    if (pageId === 'cronograma')             loadCronogramaPage();
    if (pageId === 'personal-directorio-readonly') loadPersonalDirectorioReadOnly();
  }

  document.querySelectorAll(`[onclick="showPage('${pageId}')"]`).forEach(el => el.classList.add('active'));
}

// ===================== AUTH =====================

let currentUser = null;
let _suppressSignoutRedirect = false; // guards the onAuthStateChange handler during intentional sign-outs

// ---- Supabase auth ----

async function _fetchProfile(userId) {
  const { data, error } = await db
    .from('users')
    .select('*, memberships!user_id(status, plans(name))')
    .eq('id', userId)
    .single();
  if (error) return null;
  data.plan = data.memberships?.[0]?.plans?.name || 'Thor Training';
  return data;
}

async function checkSession() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const profile = await _fetchProfile(session.user.id);
  if (!profile) return null;
  if (profile.is_active === false) {
    _suppressSignoutRedirect = true;
    await db.auth.signOut();
    _suppressSignoutRedirect = false;
    return { _inactive: true };
  }
  return profile;
}

// ---- UI handlers ----

async function doLogin() {
  let identifier = (document.getElementById('login-email').value    || '').trim();
  const password  = (document.getElementById('login-password').value || '').trim();
  const errEl     = document.getElementById('login-error');
  const card      = document.getElementById('login-card');
  const btn       = document.querySelector('.login-btn');

  if (!identifier || !password) {
    errEl.textContent = 'Por favor ingresa tus datos';
    triggerShake(card);
    return;
  }

  errEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = 'Ingresando...'; }

  try {
    // Si el identificador parece una cédula (solo dígitos), buscar el email correspondiente.
    // Se usa un RPC con SECURITY DEFINER para evitar que una llamada anónima
    // dispare la política RLS sobre users (lo que causaría recursión infinita).
    //
    // Bug fijo 2026-07-06: esto antes forzaba authPassword = identifier (la cédula),
    // ignorando por completo lo que el usuario escribió en el campo de contraseña. Eso
    // solo funcionaba mientras la cuenta nunca había sido restablecida (la contraseña
    // inicial de un miembro nuevo SÍ es su cédula — ver guardarNuevoUsuario()); en cuanto
    // un admin restablece la contraseña desde Credenciales, el login por cédula quedaba
    // roto para siempre para esa cuenta, aunque el login por email siguiera funcionando
    // con la misma contraseña nueva. La cédula solo debe resolver el email — nunca
    // sustituir la contraseña que el usuario realmente escribió.
    const isCedula = /^\d+$/.test(identifier);
    const authPassword = password;
    if (isCedula) {
      const { data: foundEmail, error: lookupError } = await db
        .rpc('get_email_by_identification', { p_id: identifier });
      if (lookupError || !foundEmail) throw new Error('No se encontró un usuario con esa cédula');
      identifier = foundEmail;
    }

    const email = identifier.toLowerCase();
    const { data, error } = await db.auth.signInWithPassword({ email, password: authPassword });
    if (error) throw error;

    const profile = await _fetchProfile(data.user.id);
    if (!profile) throw new Error('No se encontró tu perfil');

    if (profile.is_active === false) {
      _suppressSignoutRedirect = true;
      await db.auth.signOut();
      _suppressSignoutRedirect = false;
      throw new Error('Tu cuenta ha sido desactivada. Contacta al administrador.');
    }

    enterApp(profile);
  } catch (err) {
    const msg = err.message === 'Invalid login credentials'
      ? 'Credenciales incorrectas'
      : (err.message || 'Error al iniciar sesión');
    errEl.textContent = msg;
    triggerShake(card);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ INGRESAR'; }
  }
}

async function doLogout() {
  if (_solicitudesChannel) { db.removeChannel(_solicitudesChannel); _solicitudesChannel = null; }
  await db.auth.signOut();
  showLogin();
}

// ---- App shell ----

function enterApp(profile) {
  currentUser = profile;
  initNotifications(profile.id);

  // Preload master data (fire-and-forget — available before any modal opens)
  db.from('class_types').select('id, name').eq('is_active', true).order('name')
    .then(({ data }) => { if (data) _classTypes = data; })
    .catch(() => {});
  _loadCustomDocCategories();

  const initials = (profile.full_name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('sidebar-name').textContent = profile.full_name || '';
  document.getElementById('sidebar-plan').textContent = profile.plan || 'Thor Training';
  document.getElementById('user-pill').style.display  = 'flex';

  document.getElementById('user-nav').style.display        = 'none';
  document.getElementById('admin-nav').style.display       = 'none';
  document.getElementById('employee-nav').style.display    = 'none';
  document.getElementById('instructor-nav').style.display  = 'none';
  document.getElementById('reception-nav').style.display   = 'none';

  if (profile.role === 'admin') {
    document.getElementById('admin-nav').style.display     = 'block';
    document.getElementById('sidebar-avatar').textContent  = 'A';
    document.querySelector('.user-avatar').style.background = 'var(--orange)';
    _refreshSolicitudesBadge();
    _subscribeToSolicitudesRealtime();
    _refreshPendingReviewBadge();
    _subscribePendingReviewRealtime();
  } else if (profile.role === 'reception') {
    // Task D: reception previously had no nav branch at all and fell through to the
    // member-portal "else" below, unable to reach Check-in/Horarios/Personal.
    document.getElementById('reception-nav').style.display = 'block';
    document.getElementById('sidebar-avatar').textContent  = initials;
    document.querySelector('.user-avatar').style.background = 'var(--cyan)';
    _refreshPendingReviewBadge();
    _subscribePendingReviewRealtime();
    // Fase 3.4 (2026-08-20) — reception can be granted the 'evaluaciones' exception the
    // same way an employee can (see STAFF_GRANTABLE_MODULES); nothing else in this registry
    // applies to reception (their own nav has no nav-emp-* ids), so this call is otherwise a
    // no-op for them.
    _applyEmployeeExtraPermissions();
  } else if (profile.role === 'instructor') {
    document.getElementById('instructor-nav').style.display = 'block';
    document.getElementById('sidebar-avatar').textContent   = initials;
    document.querySelector('.user-avatar').style.background  = 'var(--purple)';
    _applyInstructorPermissions(profile);
    // Poll every 60 s as a fallback alongside the realtime channel
    _notifPollInterval = setInterval(async () => {
      if (!currentUser) return;
      const { count } = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('read', false);
      if (count != null) _setNotifBadge(count);
    }, 60000);
  } else if (profile.role === 'employee') {
    document.getElementById('employee-nav').style.display  = 'block';
    document.getElementById('sidebar-avatar').textContent  = initials;
    document.querySelector('.user-avatar').style.background = 'var(--cyan)';
    _applyEmployeeExtraPermissions();
    _applyBillingNavVisibility(profile, 'nav-emp-pagos');
    _applySSTRestrictions(profile);
  } else {
    document.getElementById('user-nav').style.display      = 'block';
    document.getElementById('sidebar-avatar').textContent  = initials;
    document.querySelector('.user-avatar').style.background = 'var(--cyan)';
  }

  const loginScreen = document.getElementById('login-screen');
  const appRoot     = document.getElementById('app-root');

  loginScreen.classList.add('fade-out');
  setTimeout(() => {
    loginScreen.style.display = 'none';
    appRoot.classList.add('visible');
    if (profile.role === 'admin') {
      showPage('admin-dashboard');
    } else if (profile.role === 'reception') {
      showPage('admin-checkin');
    } else if (profile.role === 'instructor') {
      showPage('instructor-clases');
    } else if (profile.role === 'employee') {
      showPage('employee-perfil');
    } else {
      showPage('inicio');

      // Saludo personalizado: usa name, o la parte antes del @ del email como fallback
      const greetingEl = document.getElementById('dashboard-greeting');
      if (greetingEl) {
        const displayName = profile.full_name
          ? profile.full_name.split(' ')[0]
          : (profile.email || '').split('@')[0];
        if (displayName) {
          greetingEl.textContent = displayName.toUpperCase();
          greetingEl.style.display = 'block';
        }
      }
      const dateSubEl = document.getElementById('dashboard-date-sub');
      if (dateSubEl) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
        dateSubEl.textContent = `${dateStr} · MÉTODO · DISCIPLINA · RESULTADOS`;
      }

      // Retorno desde Wompi checkout — params: ?id=...&status=APPROVED&reference=THOR-...
      const _wParams = new URLSearchParams(window.location.search);
      if (_wParams.has('id') && _wParams.has('status')) {
        const _wStatus = _wParams.get('status');
        history.replaceState({}, '', window.location.pathname);
        setTimeout(() => {
          showPage('pagos');
          if (_wStatus === 'APPROVED') {
            toast('¡Pago aprobado! 💪', 'Tu membresía ha sido renovada');
          } else if (_wStatus === 'DECLINED') {
            toast('Pago rechazado', 'Intenta con otro método de pago');
          }
        }, 600);
      }

      loadUserDashboard(profile);
      updateContractBanner();
      updateContractNavBadge();
      _loadNoticiasCTA();
    }
  }, 400);
}

// True for "Prestación de servicios" contractors. Null/unset/"Otro" fall through as
// false (treated like vinculado) — the safer default, since PS-only restrictions
// should never kick in unprompted. Shared by nav visibility, doc categories, and the
// evaluaciones read-permission gate — see 20260708_evaluaciones_vinculado_only.sql.
function _isPSContract(contractType) {
  return /prestaci[oó]n\s+de\s+servicios/i.test(contractType || '');
}

// ── SST (Seguridad y Salud en el Trabajo) collaborator detection ────────────
// This app has no dedicated `role` value per job type — SST, like contadora/dev/redes
// sociales, is a role='employee' account distinguished only by the free-text
// specialty/position fields (see STAFF_GRANTABLE_MODULES comment above and
// 20260714_staff_extra_permissions.sql). There is no separate role to gate on, so this
// checks both fields for an "SST" token or the full "Seguridad y Salud en el Trabajo"
// title, matched as a whole word/phrase (not a bare substring) to avoid false positives.
function _isSSTProfile(profile) {
  const spec = (profile?.specialty || '').trim();
  const pos  = (profile?.position  || '').trim();
  const isSST = (s) => /\bSST\b/i.test(s) || /seguridad\s+y\s+salud\s+en\s+el\s+trabajo/i.test(s);
  return isSST(spec) || isSST(pos);
}

// ── SST-specific nav restrictions ────────────────────────────────────────────
// Called in enterApp after employee-nav is shown. SST does not teach/attend classes, so
// unlike other role=employee collaborators (contadora, dev, redes sociales) — for whom the
// class schedule stays visible — SST should not see "Calendario" (horario de clases,
// page-admin-horarios). Kept separate from _applyEmployeeExtraPermissions() (which only
// manages the generic STAFF_GRANTABLE_MODULES grant/hide toggles) since this is an
// unconditional restriction based on job type, not an admin-granted permission.
function _applySSTRestrictions(profile) {
  if (!_isSSTProfile(profile)) return;
  const el = document.getElementById('nav-emp-calendario');
  if (el) el.style.display = 'none';
}

// ── Instructor sidebar permissions ───────────────────────────────────────────
// Called in enterApp after the instructor-nav is shown.
// Hides nav items the instructor is not authorised to see based on contract_type.
async function _applyInstructorPermissions(profile) {
  const ct = profile.contract_type;

  // Fase 3.3/3.4 (2026-08-20) — needed for the 'agendar_cronograma'/'evaluaciones'
  // per-instructor exception grants below. Awaited so the evaluaciones nav-hide decision
  // (which now depends on this set for PS instructors) is made with fresh data.
  await _loadMyExtraPermissions();

  // Check-in is hidden for ALL instructor types
  const hide = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  hide('nav-inst-checkin');
  // Evaluaciones is exclusive to entrenador vinculado by default (Andrea's requirement,
  // 2026-07-08) — PS freelancers don't get this, not even read-only, UNLESS an admin has
  // granted them the 'evaluaciones' exception (Fase 3.4, staff_extra_permissions). A
  // vinculado trainer (or an exception-granted PS one) can still be individually hidden via
  // evaluaciones_hidden (20260713_evaluaciones_hidden_state.sql). See
  // _canAccessEvaluacionesModule() for the single source of truth this composes.
  _applyEvaluacionesNav();

  if (ct === 'Prestación de servicios') {
    // PS freelancers: Horarios + Cuenta de cobro + Solicitudes + Mi Perfil
    // (Task I: Solicitudes is now available to PS instructors too, not just vinculado)
    hide('nav-inst-clases');
    // Resumen de Clases (Phase 4.7, 2026-07-14) — PS-only, since they bill per class taught
    // rather than payroll and need a full past/upcoming history, not just today's roster.
    const resumenNav = document.getElementById('nav-inst-resumen-clases');
    if (resumenNav) resumenNav.style.display = '';
  }
  // Staff on payroll (Término indefinido/fijo) or unknown contract_type: no Cuenta de cobro —
  // see _applyBillingNavVisibility().
  _applyBillingNavVisibility(profile, 'nav-inst-pagos');
}

// Cuenta de cobro is a PS (Prestación de Servicios) billing concept, not tied to any one
// job role — an employee (dev, contadora, redes sociales, etc.) under a PS contract bills
// the same way an instructor does. Shared by both instructor-nav (nav-inst-pagos) and
// employee-nav (nav-emp-pagos) so the gate is contract_type, never role.
function _applyBillingNavVisibility(profile, navId) {
  const el = document.getElementById(navId);
  if (el) el.style.display = _isPSContract(profile.contract_type) ? '' : 'none';
}

// ── External collaborator extra permissions (Phase 4.5, 2026-07-14; generalized Phase 4.8) ──
// role='employee' accounts (contadora, software dev, redes sociales, SST, etc. — this app
// has no separate role per job type, see staff_extra_permissions migration) always get
// Solicitudes/Notificaciones/Calendario (already unconditional in the employee-nav HTML) —
// those are intentionally NOT in this registry.
//
// Central registry of grantable modules for role='employee' accounts. One entry per
// staff_extra_permissions.permission_key. Adding a new grantable module = add one entry
// here (+ a hidden nav-item in employee-nav with matching navId, + RLS if the underlying
// data is sensitive, following the boveda_legal policies in
// 20260714_staff_extra_permissions.sql) — permission_key has no CHECK constraint by design,
// so no schema migration is needed just to introduce a new key.
//
// The admin "Bóveda" (openVaultAuth, storage bucket 'vault', password re-auth) is a
// distinct, higher-sensitivity feature from "Bóveda Legal" (legal_documents /
// legal_document_files, the existing boveda_legal key) and is intentionally NOT
// grantable here.
// `roles` lists which profile roles this entry is offered for in the admin's "Permisos
// adicionales" grant UI (_renderPerfilExtraPermisosToggles filters by it) — defaults to
// ['employee'] when omitted, preserving the original scope of the first 7 entries below.
const STAFF_GRANTABLE_MODULES = [
  { key: 'personal',       label: 'Personal',                                icon: 'user',      navId: 'nav-emp-personal',     pageId: 'admin-personal' },
  { key: 'contratos',      label: 'Contratos',                               icon: 'file-text', navId: 'nav-emp-contratos',    pageId: 'admin-contratos' },
  // Fase post-deploy 3.2 (2026-08-24) — widened from employee-only to also cover role=reception.
  // navId is null (not a single id) because the nav item id differs per role (nav-emp-boveda vs
  // nav-rec-boveda) — same reason evaluaciones/agendar_cronograma above can't use the generic
  // forEach toggle. See _applyBovedaLegalNav(). RLS underneath (legal_document_files_collaborator_
  // select / legal_documents_collaborator_select) already keys off permission_key alone, not role,
  // so no RLS change was needed to extend this — closes the last reason reception staff were
  // reaching for the role='admin' workaround (ver usuarios + cronograma already worked before this).
  { key: 'boveda_legal',   label: 'Bóveda Legal (solo lectura)',             icon: 'shield',    navId: null,       pageId: 'boveda-legal-readonly', roles: ['employee', 'reception'] },
  { key: 'inventario',     label: 'Inventario',                              icon: 'package',   navId: 'nav-emp-inventario',   pageId: 'admin-inventario' },
  { key: 'proveedores',    label: 'Proveedores',                             icon: 'truck',     navId: 'nav-emp-proveedores',  pageId: 'admin-proveedores' },
  { key: 'comunicacion',   label: 'Comunicación',                            icon: 'megaphone', navId: 'nav-emp-comunicacion', pageId: 'admin-comunicacion' },
  { key: 'redes_sociales', label: 'Redes Sociales (subir/eliminar piezas)',  icon: 'image',     navId: 'nav-emp-redes',        pageId: 'redes-sociales' },
  // Sistemas (Fase 3.2, 2026-08-20) — write access (upload/delete manuals) for Sebastián.
  // READ visibility of each individual manual is governed separately by the per-file
  // `visible_roles` column on system_manuals (see 20260820_system_manuals.sql) — this grant
  // only unlocks the manage page itself, same "who can manage" vs "who reads what" split
  // already used by redes_sociales/inventario.
  { key: 'sistemas',       label: 'Sistemas (subir manuales)',               icon: 'book-open', navId: 'nav-emp-sistemas',     pageId: 'admin-sistemas' },
  // Fase 3.3 (2026-08-20) — configurable "quién puede agendar en Cronograma General".
  // Admin/reception could already create/edit/delete any event (calendar_events_staff_write
  // RLS); this grants the SAME create-access, scoped server-side to only the grantee's own
  // events (created_by = auth.uid()), to specific people — e.g. SST agenda capacitaciones,
  // mantenimiento agenda sus mantenimientos, para que recepción/admin vea cuándo se hace cada
  // cosa. See 20260820_cronograma_agendar_permission.sql. No navId: Cronograma's nav item is
  // already unconditional for every staff role — this only unlocks the "+ Nuevo evento"
  // control and the day-cell "+" (see _cronoCanCreate in loadCronogramaPage()).
  { key: 'agendar_cronograma', label: 'Agendar en Cronograma General', icon: 'calendar-plus', navId: null, pageId: 'cronograma', roles: ['employee', 'instructor'] },
  // Fase 3.4 (2026-08-20) — configurable "quién ve/edita el proceso de evaluación de
  // usuarios" (evaluaciones cineantropométricas de miembros). Vinculado instructors keep
  // their existing unconditional access (unchanged, not gated by this key). This key covers
  // the two NEW cases: an explicit exception for a specific PS ("prestación de servicios")
  // instructor, or access for an employee/reception profile. Once granted, the EXISTING
  // evaluaciones_hidden/can_edit_evaluations tri-state (perfil-evaluaciones-acceso dropdown)
  // decides ver/editar/ocultar for that person — this key only decides whether that
  // tri-state applies to them at all. No single navId — the nav item id differs per role
  // (nav-inst-/-emp-/-rec-evaluaciones), handled by _applyEvaluacionesNav(), not the generic
  // forEach below. See 20260820_evaluaciones_role_configurable.sql and
  // _canAccessEvaluacionesModule().
  { key: 'evaluaciones', label: 'Evaluaciones (proceso de usuarios)', icon: 'trending-up', navId: null, pageId: 'progreso', roles: ['employee', 'instructor', 'reception'] },
  // Fase post-deploy 3.2 (2026-08-21) — reception's "ver usuarios" gap. Deliberately NOT the
  // 'personal' key above (admin-personal exposes bank_account_number/id_number/birth_date/
  // address/emergency_contact_* — the exact fields 20260703_reception_users_rls_narrow.sql
  // locked out of reception's DB access). This is a separate, narrower grant backed by
  // get_staff_directory_safe() (20260821_reception_staff_directory.sql), a SECURITY DEFINER
  // RPC that only ever returns name/role/position/specialty/email/phone/active/created_at —
  // no sensitive HR/bank columns exist in its result regardless of grant. Solicitudes
  // (préstamos/vacaciones) stay untouched by this key — that access was already fully
  // revoked for reception in 20260703 and has no code path here.
  { key: 'personal_directorio', label: 'Personal (directorio básico, sin datos bancarios/HR)', icon: 'users', navId: 'nav-rec-personal', pageId: 'personal-directorio-readonly', roles: ['reception'] },
];

let _myExtraPermissions = new Set();

// Fetches + caches the CALLING user's own staff_extra_permissions grants. Shared by
// _applyEmployeeExtraPermissions() (role=employee/reception — also drives the generic
// nav-toggle for employee-nav module ids) and _applyInstructorPermissions() (role=instructor
// — only needs this for the 'agendar_cronograma'/'evaluaciones' exception checks). Widened
// Fase 3.3/3.4 (2026-08-20) beyond its original employee-only scope.
async function _loadMyExtraPermissions() {
  try {
    const { data, error } = await db.from('staff_extra_permissions').select('permission_key').eq('user_id', currentUser.id);
    if (error) throw error;
    _myExtraPermissions = new Set((data || []).map(r => r.permission_key));
  } catch (_) {
    _myExtraPermissions = new Set();
  }
  return _myExtraPermissions;
}

async function _applyEmployeeExtraPermissions() {
  await _loadMyExtraPermissions();
  STAFF_GRANTABLE_MODULES.forEach(m => {
    if (!m.navId) return;
    const navEl = document.getElementById(m.navId);
    if (navEl) navEl.style.display = _myExtraPermissions.has(m.key) ? '' : 'none';
  });
  _applyEvaluacionesNav();
  _applyBovedaLegalNav();
}

// Bóveda Legal's nav item id differs per role (nav-emp-boveda vs nav-rec-boveda), so it can't
// use the generic STAFF_GRANTABLE_MODULES forEach toggle above — same reason as
// _applyEvaluacionesNav().
function _applyBovedaLegalNav() {
  const role = currentUser?.role;
  const navId = role === 'reception' ? 'nav-rec-boveda'
              : role === 'employee'  ? 'nav-emp-boveda'
              : null;
  if (!navId) return;
  const el = document.getElementById(navId);
  if (el) el.style.display = _myExtraPermissions.has('boveda_legal') ? '' : 'none';
}

// ── Evaluaciones access — generalized Fase 3.4 (ver/editar/ocultar por rol o persona) ──
// Composes two layers, reusing existing plumbing rather than adding a parallel mechanism:
//   1. Module-level gate ("does this person have Evaluaciones at all"):
//      - admin: always full access.
//      - instructor, NOT PS (prestación de servicios): always (existing unconditional
//        default since 2026-07-06/08 — left unchanged; flipping this default would silently
//        affect every existing vinculado instructor).
//      - instructor, PS: only via an explicit 'evaluaciones' grant in
//        staff_extra_permissions — the "exception for a specific non-planta instructor" case.
//      - employee / reception: only via an explicit 'evaluaciones' grant — opt-in, same
//        default-false-means-hidden shape as every other STAFF_GRANTABLE_MODULES entry, so
//        shipping this does NOT silently expose member evaluation data to every existing
//        employee/reception account.
//   2. Per-person fine-tune (unchanged plumbing, now usable by any role that passes layer 1):
//      evaluaciones_hidden (temporary pause) and can_edit_evaluations (view vs edit), both
//      already on `users` — see 20260706/20260708/20260713 migrations.
// Mirrors can_access_evaluaciones() in 20260820_evaluaciones_role_configurable.sql — keep in
// sync if that logic ever changes.
function _canAccessEvaluacionesModule() {
  const role = currentUser?.role;
  if (role === 'admin') return true;
  if (currentUser?.evaluaciones_hidden) return false;
  if (role === 'instructor') {
    return !_isPSContract(currentUser?.contract_type) || _myExtraPermissions.has('evaluaciones');
  }
  if (role === 'employee' || role === 'reception') {
    return _myExtraPermissions.has('evaluaciones');
  }
  return false;
}

// Evaluaciones' nav item id differs per role (nav-inst-/-emp-/-rec-evaluaciones) so it can't
// use the generic STAFF_GRANTABLE_MODULES forEach toggle above (single navId per entry).
function _applyEvaluacionesNav() {
  const role = currentUser?.role;
  const navId = role === 'instructor' ? 'nav-inst-evaluaciones'
              : role === 'reception'  ? 'nav-rec-evaluaciones'
              : role === 'employee'   ? 'nav-emp-evaluaciones'
              : null;
  if (!navId) return;
  const el = document.getElementById(navId);
  if (el) el.style.display = _canAccessEvaluacionesModule() ? '' : 'none';
}

// Read-only render of the admin legal-docs vault (legal_documents + legal_document_files) —
// same data as loadLegalDocsPage()/admin-legales, but no upload/delete actions, for a
// collaborator granted 'boveda_legal' (RLS: SELECT-only via staff_extra_permissions).
async function loadBovedaLegalReadOnly() {
  const container = document.getElementById('boveda-legal-readonly-container');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const [{ data: cats, error: e1 }, { data: files, error: e2 }] = await Promise.all([
      db.from('legal_documents').select('*').order('document_name'),
      db.from('legal_document_files').select('*').order('uploaded_at', { ascending: false }),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const filesByType = {};
    (files || []).forEach(f => { (filesByType[f.document_type] = filesByType[f.document_type] || []).push(f); });
    const allCats = (cats || []);
    if (!allCats.length) {
      container.innerHTML = '<div class="card" style="color:var(--muted);padding:24px;text-align:center;">No hay documentos disponibles.</div>';
      return;
    }
    // SST write access (Fase post-deploy 1.1, 2026-08-21) — scoped to exactly one category
    // ('sst') and one grantee (Yuleidy, via the 'boveda_legal_sst_write' permission_key,
    // confirmed with María Paulina as the intended scope — NOT a general boveda_legal write
    // permission, and not extended to other grantees of the read-only 'boveda_legal' key).
    // See 20260821_yuleidy_boveda_legal_sst_write.sql for the matching RLS.
    const canWriteSst = _myExtraPermissions.has('boveda_legal_sst_write');

    container.innerHTML = allCats.map(c => {
      const docs = filesByType[c.document_type] || [];
      const canWriteThis = canWriteSst && c.document_type === 'sst';
      const filesHtml = docs.length
        ? docs.map(f => `<div style="margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <a href="${f.file_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">Ver ${_escHtml(f.file_name)}</a>
            ${canWriteThis ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteLegalDocFile('${f.id}','${(f.file_url || '').replace(/'/g, "\\'")}')">Eliminar</button>` : ''}
          </div>`).join('')
        : `<div style="font-size:12px;color:var(--muted);margin-top:3px;">Sin documentos.</div>`;
      const uploadBtn = canWriteThis
        ? `<div style="margin-top:8px;"><button class="btn btn-ghost btn-sm" onclick="uploadLegalDoc('${c.document_type}')">${docs.length ? '+ Subir otro' : 'Subir'}</button></div>`
        : '';
      return `<div class="card mb-sm" style="padding:16px 20px;">
        <div style="font-weight:600;font-size:14px;">${_escHtml(c.document_name)}</div>
        ${filesHtml}
        ${uploadBtn}
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red);padding:20px;">Error al cargar documentos.<br><small>${err?.message || ''}</small></div>`;
  }
}

// Safe staff directory (Fase post-deploy 3.2, 2026-08-21) — reception's "ver usuarios" gap,
// granted via 'personal_directorio' (STAFF_GRANTABLE_MODULES). Calls get_staff_directory_safe()
// (20260821_reception_staff_directory.sql), a SECURITY DEFINER RPC whose RETURNS TABLE only
// ever includes name/role/position/specialty/email/phone/active/created_at — no bank/HR
// columns exist in the response regardless of grant, so there is nothing here to
// accidentally over-render. Empty result set (not an error) for anyone ungranted.
async function loadPersonalDirectorioReadOnly() {
  const container = document.getElementById('personal-directorio-readonly-container');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const { data, error } = await db.rpc('get_staff_directory_safe');
    if (error) throw error;
    const staff = data || [];
    if (!staff.length) {
      container.innerHTML = '<div class="card" style="color:var(--muted);padding:24px;text-align:center;">No hay personal para mostrar.</div>';
      return;
    }
    container.innerHTML = staff.map(u => {
      const grupo = _effectiveGroup(u);
      const estado = u.is_active === false
        ? `<span class="badge badge-muted">Inactivo</span>`
        : `<span class="badge badge-green">Activo</span>`;
      return `<div class="card mb-sm" style="padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:600;font-size:14px;">${_escHtml(u.full_name || '—')} ${estado}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${_escHtml(grupo)}${u.position ? ' · ' + _escHtml(u.position) : ''}</div>
        </div>
        <div style="font-size:12px;color:var(--muted);text-align:right;">
          ${u.email ? _escHtml(u.email) + '<br>' : ''}${u.phone ? _escHtml(u.phone) : ''}
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red);padding:20px;">Error al cargar el directorio.<br><small>${err?.message || ''}</small></div>`;
  }
}

// Read-only render of system_manuals (Fase 3.2, 2026-08-20) — shared by instructor-nav
// and user-nav's "Manuales" item (#page-manuales). No client-side role filtering needed:
// the system_manuals_select_by_role RLS policy already returns only the rows this
// viewer's role is allowed to see (admin/reception see everything; anyone else sees rows
// with visible_roles NULL/empty or containing their own role) — same "trust RLS, just
// render what comes back" pattern as loadBovedaLegalReadOnly() above.
async function loadManualesReadOnly() {
  const container = document.getElementById('manuales-readonly-container');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const { data, error } = await db.from('system_manuals').select('*').order('uploaded_at', { ascending: false });
    if (error) throw error;
    const manuals = data || [];
    if (!manuals.length) {
      container.innerHTML = '<div class="card" style="color:var(--muted);padding:24px;text-align:center;">No hay manuales disponibles.</div>';
      return;
    }
    container.innerHTML = manuals.map(m => {
      const dateStr = new Date(m.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `<div class="card mb-sm" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:600;font-size:14px;">${_escHtml(m.title)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">${_escHtml(m.file_name)} · ${dateStr}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="viewSistemaManual('${m.id}')">Ver</button>
      </div>`;
    }).join('');
    // Cache for viewSistemaManual() to resolve id → storage path without a second round-trip.
    _sistemasManualsData = manuals;
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red);padding:20px;">Error al cargar manuales.<br><small>${err?.message || ''}</small></div>`;
  }
}

// ── Redes Sociales module (Phase 4.6, 2026-07-14; gallery + comments redesign 2026-07-28) ──
// Content gallery of graphic pieces tied to a date/campaign, with a per-piece comment
// thread. Accessible to admin/reception and any collaborator granted 'redes_sociales'
// (RLS in 20260714_redes_sociales.sql enforces the same gate server-side for the posts
// table/storage; comment access is broader — see 20260728_redes_sociales_comments.sql).
let _redesSocialesPosts = [];
let _redesSocialesCommentCounts = {};   // { post_id: liveCommentCount }
let _redesSocialesFilter = 'all';       // 'all' | 'YYYY-MM'
let _redesSocialesActivePostId = null;  // post currently open in the detail modal

async function loadRedesSocialesPage() {
  const container = document.getElementById('redes-sociales-list-container');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const [{ data: posts, error: postsErr }, { data: comments, error: commentsErr }] = await Promise.all([
      db.from('redes_sociales_posts').select('*').order('fecha', { ascending: false }),
      db.from('redes_sociales_comments').select('post_id').is('deleted_at', null),
    ]);
    if (postsErr) throw postsErr;
    if (commentsErr) throw commentsErr;
    _redesSocialesPosts = posts || [];
    _redesSocialesCommentCounts = {};
    (comments || []).forEach(c => {
      _redesSocialesCommentCounts[c.post_id] = (_redesSocialesCommentCounts[c.post_id] || 0) + 1;
    });
    _renderRedesFilterChips();
    _renderRedesSocialesList();
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--red);padding:20px;">Error al cargar piezas.<br><small>${err?.message || ''}</small></div>`;
  }
}

// Chips group by month — "Campaña / título" is freeform text on redes_sociales_posts,
// not a structured tag/category column, so there's nothing clean to group by there yet.
// FLAG: if a real campaign/tag field gets added to redes_sociales_posts later, swap this
// grouping to use it instead of the fecha-derived month buckets below.
function _renderRedesFilterChips() {
  const row = document.getElementById('redes-filter-chips-row');
  if (!row) return;
  const monthKeys = [...new Set(_redesSocialesPosts.map(p => p.fecha?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const monthLabel = key => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }).replace('.', '');
  };
  const chips = [{ key: 'all', label: 'Todas' }, ...monthKeys.map(key => ({ key, label: monthLabel(key) }))];
  row.innerHTML = chips.map(c => `
    <div class="redes-filter-chip${_redesSocialesFilter === c.key ? ' active' : ''}" onclick="_redesSocialesSetFilter('${c.key}')">${_escHtml(c.label)}</div>
  `).join('');
}

function _redesSocialesSetFilter(key) {
  _redesSocialesFilter = key;
  _renderRedesFilterChips();
  _renderRedesSocialesList();
}

// PDFs can't render inside an <img> — the browser has nothing to paint, so the existing
// onerror="this.style.display='none'" just leaves a blank gap where the thumbnail should
// be. Detect by extension (file_name is the original upload name; file_url falls back to
// the same extension since guardarPiezaRedes() only sanitizes disallowed characters, never
// strips the extension) and render a placeholder instead of an <img> for those.
function _isPdfFile(post) {
  return /\.pdf(\?|$)/i.test(post.file_name || post.file_url || '');
}

function _redesThumbHtml(post) {
  if (_isPdfFile(post)) {
    return `<div class="redes-card-thumb" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:8px;text-align:center;">
      <i data-lucide="file-text" style="width:28px;height:28px;color:var(--muted2);"></i>
      <span style="font-size:10px;color:var(--muted);word-break:break-word;line-height:1.3;">${_escHtml(post.file_name || 'PDF')}</span>
    </div>`;
  }
  return `<img class="redes-card-thumb" src="${post.file_url}" alt="${_escHtml(post.titulo)}" onerror="this.style.display='none'">`;
}

function _renderRedesSocialesList() {
  const container = document.getElementById('redes-sociales-list-container');
  if (!container) return;
  const posts = _redesSocialesFilter === 'all'
    ? _redesSocialesPosts
    : _redesSocialesPosts.filter(p => p.fecha?.slice(0, 7) === _redesSocialesFilter);
  if (!posts.length) {
    container.innerHTML = '<div class="card" style="color:var(--muted);padding:24px;text-align:center;">Sin piezas subidas todavía.</div>';
    return;
  }
  container.innerHTML = `<div class="redes-gallery-grid">${posts.map(p => `
    <div class="card redes-card">
      ${_redesThumbHtml(p)}
      <div class="redes-card-title">${_escHtml(p.titulo)}</div>
      <div class="redes-card-meta">
        <span>${p.fecha}</span>
        <span class="redes-card-comment-count"><i data-lucide="message-circle"></i> ${_redesSocialesCommentCounts[p.id] || 0}</span>
      </div>
      <div class="redes-card-actions">
        <div class="redes-card-action-btn" onclick="verPiezaRedes('${p.id}')"><i data-lucide="eye"></i> Ver</div>
        <div class="redes-card-action-btn danger" onclick="deleteRedesSocialesPost('${p.id}')"><i data-lucide="trash-2"></i> Eliminar</div>
      </div>
    </div>`).join('')}</div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function verPiezaRedes(id) {
  const post = _redesSocialesPosts.find(p => p.id === id);
  if (!post) return;
  _redesSocialesActivePostId = id;
  const imgEl = document.getElementById('redes-detalle-img');
  const pdfEl = document.getElementById('redes-detalle-pdf');
  const isPdf = _isPdfFile(post);
  if (imgEl) { imgEl.style.display = isPdf ? 'none' : ''; imgEl.src = isPdf ? '' : post.file_url; }
  if (pdfEl) {
    pdfEl.style.display = isPdf ? 'flex' : 'none';
    const nameEl = document.getElementById('redes-detalle-pdf-name');
    if (nameEl) nameEl.textContent = post.file_name || 'PDF';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
  document.getElementById('redes-detalle-img-link').href = post.file_url;
  document.getElementById('redes-detalle-titulo').textContent = post.titulo;
  document.getElementById('redes-detalle-fecha').textContent = post.fecha;
  document.getElementById('redes-comment-input').value = '';
  openModal('redes-pieza-detalle');
  await _loadRedesComments(id);
}

async function _loadRedesComments(postId) {
  const list = document.getElementById('redes-comment-list');
  if (!list) return;
  list.innerHTML = _loader();
  try {
    const { data, error } = await db
      .from('redes_sociales_comments')
      .select('id, author_id, body, created_at, users(full_name)')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    _renderRedesComments(data || []);
  } catch (err) {
    list.innerHTML = `<div style="color:var(--red);font-size:12px;">Error al cargar comentarios.<br><small>${err?.message || ''}</small></div>`;
  }
}

function _renderRedesComments(comments) {
  const list = document.getElementById('redes-comment-list');
  if (!list) return;
  if (!comments.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:12px;text-align:center;padding:8px;">Sin comentarios todavía.</div>';
    return;
  }
  const canModerate = currentUser?.role === 'admin' || currentUser?.role === 'reception';
  list.innerHTML = comments.map(c => {
    const canDelete = canModerate || c.author_id === currentUser?.id;
    return `<div class="redes-comment-item">
      <span class="redes-comment-author">${_escHtml(c.users?.full_name || 'Usuario')}</span>
      <span class="redes-comment-time">${_tiempoRelativo(c.created_at)}</span>
      <div class="redes-comment-body">${_escHtml(c.body)}</div>
      ${canDelete ? `<span class="redes-comment-delete" onclick="eliminarComentarioRedes('${c.id}')">Eliminar</span>` : ''}
    </div>`;
  }).join('');
}

async function enviarComentarioRedes() {
  const input = document.getElementById('redes-comment-input');
  const body = input?.value?.trim();
  const postId = _redesSocialesActivePostId;
  if (!body || !postId || !currentUser?.id) return;
  try {
    const { error } = await db.from('redes_sociales_comments').insert({
      post_id: postId, author_id: currentUser.id, body,
    });
    if (error) throw error;
    input.value = '';
    await _loadRedesComments(postId);
    _redesSocialesCommentCounts[postId] = (_redesSocialesCommentCounts[postId] || 0) + 1;
    _renderRedesSocialesList();
  } catch (err) {
    // 23503 = FK violation on redes_sociales_comments.post_id — the piece this modal was
    // opened for got deleted elsewhere (another session, or a stale background render)
    // while it was still open here. _redesSocialesActivePostId has no way to know that on
    // its own, so this is the one place that finds out — close out gracefully instead of
    // surfacing the raw constraint error.
    if (err.code === '23503') {
      toast('Pieza eliminada', 'Esta pieza fue eliminada y ya no admite comentarios');
      closeModal('modal-redes-pieza-detalle');
      await loadRedesSocialesPage();
      return;
    }
    toast('Error al comentar', err.message || 'Intenta de nuevo');
  }
}

async function eliminarComentarioRedes(commentId) {
  if (!confirm('¿Eliminar este comentario?')) return;
  const postId = _redesSocialesActivePostId;
  try {
    const { data: updated, error } = await db
      .from('redes_sociales_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)
      .select('id');
    if (error) throw error;
    if (!updated || updated.length === 0) {
      throw new Error('Sin permiso para eliminar este comentario.');
    }
    await _loadRedesComments(postId);
    if (_redesSocialesCommentCounts[postId]) _redesSocialesCommentCounts[postId]--;
    _renderRedesSocialesList();
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
  }
}

// Normalizes a Google Drive folder link copied from the MOBILE app's share sheet
// (drive.google.com/drive/u/{n}/mobile/folders/{id}?usp=sharing_eip_se_dm&ts=...&pli=1) into
// the canonical desktop share format (drive.google.com/drive/folders/{id}). The mobile
// variant's /u/{n}/ account-slot prefix + tracking params make it redirect to a Google
// sign-in/"request access" page for anyone not logged into that exact account slot in that
// browser — this read as "el link no abre" (TAREA 4, 2026-08-24; confirmed live with
// Playwright that the click handler itself fired correctly — the URL was the actual problem).
// Applied at the point the constant is defined AND again at click-time, so pasting a new
// mobile-style link in here later still self-corrects instead of reintroducing this bug.
function _normalizeDriveFolderUrl(url) {
  if (!url) return url;
  const m = url.match(/drive\.google\.com\/drive\/u\/\d+\/mobile\/folders\/([^/?]+)/);
  return m ? `https://drive.google.com/drive/folders/${m[1]}` : url;
}

const REDES_SOCIALES_DRIVE_URL = _normalizeDriveFolderUrl('https://drive.google.com/drive/u/3/mobile/folders/1Gl4EyHFpbJ-cHDpmcwJuijpAmKGmAq9n?usp=sharing_eip_se_dm&ts=6a87baa5&pli=1');

function abrirDriveRedesSociales() {
  if (!REDES_SOCIALES_DRIVE_URL) {
    toast('Enlace pendiente', 'Falta configurar la URL del Drive de redes sociales');
    return;
  }
  window.open(_normalizeDriveFolderUrl(REDES_SOCIALES_DRIVE_URL), '_blank', 'noopener');
}

function abrirNuevaPiezaRedes() {
  const formEl = document.getElementById('redes-sociales-form-container');
  if (!formEl) return;
  document.getElementById('redes-titulo').value = '';
  document.getElementById('redes-fecha').value = _bogotaToday();
  document.getElementById('redes-archivo').value = '';
  formEl.style.display = 'block';
}

function cancelarPiezaRedes() {
  const formEl = document.getElementById('redes-sociales-form-container');
  if (formEl) formEl.style.display = 'none';
}

async function guardarPiezaRedes() {
  const titulo = document.getElementById('redes-titulo')?.value?.trim();
  const fecha  = document.getElementById('redes-fecha')?.value;
  const file   = document.getElementById('redes-archivo')?.files?.[0];
  if (!titulo) { toast('Campo requerido', 'Ingresa el título/campaña'); return; }
  if (!fecha)  { toast('Campo requerido', 'Selecciona la fecha'); return; }
  if (!file)   { toast('Campo requerido', 'Selecciona un archivo'); return; }

  const btn = document.querySelector('#redes-sociales-form-container .btn-primary');
  if (btn) { btn.textContent = 'Subiendo…'; btn.disabled = true; }

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `posts/${Date.now()}_${safeName}`;
    const { error: upErr } = await db.storage.from('redes-sociales').upload(path, file, { upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = db.storage.from('redes-sociales').getPublicUrl(path);
    const { error } = await db.from('redes_sociales_posts').insert({
      titulo, fecha, file_url: pub.publicUrl, file_name: file.name, uploaded_by: currentUser?.id,
    });
    if (error) throw error;
    toast('Guardado', 'Pieza subida');
    cancelarPiezaRedes();
    await loadRedesSocialesPage();
  } catch (err) {
    toast('Error al subir', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Guardar'; btn.disabled = false; }
  }
}

async function deleteRedesSocialesPost(id) {
  if (!confirm('¿Eliminar esta pieza?')) return;
  const post = _redesSocialesPosts.find(p => p.id === id);
  try {
    const { error } = await db.from('redes_sociales_posts').delete().eq('id', id);
    if (error) throw error;
    // Deleting the row alone left the file behind in storage forever (that's exactly
    // how the orphaned posts/1785267042260_politicas_sst.pdf and posts/..._Foto_para_
    // Carnet_.jpg files ended up in the redes-sociales bucket with no matching DB row —
    // see the 2026-07-28 investigation). Clean up the storage object too now.
    const marker = '/redes-sociales/';
    const idx = post?.file_url?.indexOf(marker) ?? -1;
    if (idx !== -1) {
      const storagePath = post.file_url.slice(idx + marker.length);
      await db.storage.from('redes-sociales').remove([storagePath]).catch(() => {});
    }
    await loadRedesSocialesPage();
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
  }
}

// Returns the doc categories visible for a given contract type.
// PS freelancers only see the six documents relevant to their engagement.
// Vinculado staff (Término indefinido/fijo) see the payroll-oriented set instead.
// "Otro" and null/unset default to the vinculado set — the safer default, since
// PS-only items (e.g. the PS-worded contract label) should never show unprompted.
function _getVisibleDocCategories(contractType, role) {
  const isPS = _isPSContract(contractType);
  let result;

  if (isPS) {
    // cuenta_cobro added 2026-07-06 — PS-only, reuses this same category/upload system
    // (docCategories + uploadDoc()) rather than a separate section, so it inherits the
    // exact same storage RLS, admin visibility, and contract-type gating for free.
    //
    // seguridad_social removed from this generic reception/admin-uploaded folder list
    // 2026-07-08 (Andrea's requirement) — PS instructors upload it themselves every month
    // via the dedicated self-service flow (seguridad_social_submissions /
    // loadSeguridadSocialHistorial), so the duplicate folder here was redundant/confusing.
    const psKeys = new Set(['hoja_vida', 'cedula', 'certificado_bancario', 'contrato', 'cuenta_cobro', 'otros']);
    result = docCategories
      .filter(c => psKeys.has(c.key))
      .map(c => c.key === 'contrato' ? { ...c, label: 'Contrato de prestación de servicios' } : c);
  } else {
    // Vinculado (Término indefinido / Término fijo) and the "Otro"/unset fallback
    const vinculadoKeys = new Set(['hoja_vida', 'cedula', 'certificado_bancario', 'contrato', 'eps', 'caja', 'arl', 'certificado_medico', 'tarjeta_entrenador', 'otros']);
    // "Otro" (e.g. contadora working under a non-PS, non-payroll arrangement) also gets
    // cuenta_cobro — Phase 0 audit finding, 2026-07-13: this profile type was expected to
    // have it per Andrea's requirements but the PS-only gate above excluded it.
    if (contractType === 'Otro') vinculadoKeys.add('cuenta_cobro');
    result = docCategories
      .filter(c => vinculadoKeys.has(c.key))
      .map(c => c.key === 'contrato' ? { ...c, label: 'Contrato de vinculación' } : c);
  }

  // tarjeta_entrenador (carnet de entrenador deportivo) only applies to instructors —
  // admin/reception staff with a vinculado contract shouldn't see it.
  if (role && role !== 'instructor') {
    result = result.filter(c => c.key !== 'tarjeta_entrenador');
  }

  // Phase 3.4 (2026-07-13): fixed/built-in categories are now deletable too, same as
  // custom ones — extends the document_categories override table to also carry
  // is_active=false rows for built-in keys (created on demand by
  // eliminarCarpetaDocumento(), since built-ins have no row here until first deleted).
  // A built-in with a matching disabled override row is excluded here; deleting it
  // does not touch employee_documents, so previously-uploaded files are unaffected.
  const disabledBuiltinKeys = new Set(
    (_customDocCategories || []).filter(c => c.is_active === false).map(c => c.key)
  );
  result = result.filter(c => !disabledBuiltinKeys.has(c.key));

  // Task B: merge in admin-defined custom folders. contract_types = null means visible to
  // everyone by default; otherwise it must literally include this contractType value.
  const customVisible = (_customDocCategories || []).filter(c =>
    c.is_active !== false && (!c.contract_types || c.contract_types.length === 0 || c.contract_types.includes(contractType))
  );
  return result.concat(customVisible.map(c => ({ key: c.key, label: c.label, isCustom: true })));
}
// ─────────────────────────────────────────────────────────────────────────────

function showLogin() {
  _teardownNotifications();
  currentUser = null;
  const loginScreen = document.getElementById('login-screen');
  const appRoot     = document.getElementById('app-root');

  document.getElementById('user-nav').style.display        = 'none';
  document.getElementById('admin-nav').style.display       = 'none';
  document.getElementById('employee-nav').style.display    = 'none';
  document.getElementById('instructor-nav').style.display  = 'none';
  document.getElementById('user-pill').style.display       = 'none';

  appRoot.classList.remove('visible');
  loginScreen.style.display = 'flex';
  loginScreen.classList.remove('fade-out');

  document.getElementById('login-email').value         = '';
  document.getElementById('login-password').value      = '';
  document.getElementById('login-error').textContent   = '';
}

function triggerShake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

// ===================== MODALS =====================

function openModal(id) {
  document.getElementById('modal-' + id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showCredencialesModal(email, password) {
  document.getElementById('cred-email').textContent    = email    || '—';
  document.getElementById('cred-password').textContent = password || '—';
  openModal('credenciales');
  if (window.lucide) lucide.createIcons();
}

function copiarCredenciales() {
  const email    = document.getElementById('cred-email')?.textContent    || '';
  const password = document.getElementById('cred-password')?.textContent || '';
  const text     = `Usuario: ${email}\nContraseña: ${password}`;
  navigator.clipboard.writeText(text)
    .then(() => toast('Copiado al portapapeles', 'Listo para compartir'))
    .catch(() => toast('No se pudo copiar', 'Copia manualmente: ' + text));
}

function openReservaModal(clase, info, spots) {
  document.getElementById('modal-clase-nombre').textContent = clase;
  document.getElementById('modal-clase-info').textContent = info + ' · ' + spots + ' cupos disponibles';
  openModal('reservar');
}

function confirmarReserva() {
  closeModal('modal-reservar');
  toast('¡Reserva confirmada!', 'Recuerda cancelar con 2h de anticipación');
}

document.querySelectorAll('.modal-bg').forEach(bg => {
  bg.addEventListener('click', e => {
    if (e.target === bg) bg.classList.remove('open');
  });
});

// ===================== TOAST =====================

let toastTimer;
function toast(title, msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-msg').textContent = msg || '';
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ===================== CHART.JS CONFIG =====================

const chartDefaults = {
  maintainAspectRatio: false,
  color: '#555',
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#555', font: { family: 'Outfit', size: 11 } },
      border: { display: false }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#555', font: { family: 'Outfit', size: 11 } },
      border: { display: false }
    }
  },
  animation: { duration: 800, easing: 'easeInOutQuart' }
};

function initCharts() {
  // Peso
  new Chart(document.getElementById('chartPeso'), {
    type: 'line',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr'],
      datasets: [{
        data: [82, 81.2, 80.1, 78.5],
        borderColor: '#00D4E8',
        backgroundColor: 'rgba(0,212,232,0.08)',
        tension: 0.4,
        fill: true,
        borderWidth: 2,
        pointBackgroundColor: '#00D4E8',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, min: 76, max: 84 } } }
  });

  // Composición corporal
  new Chart(document.getElementById('chartComposicion'), {
    type: 'line',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr'],
      datasets: [
        {
          label: '% Grasa',
          data: [22.1, 21.0, 19.5, 18.2],
          borderColor: '#FF3B5C',
          backgroundColor: 'rgba(255,59,92,0.06)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointBackgroundColor: '#FF3B5C',
          pointRadius: 4
        },
        {
          label: 'Masa muscular (kg)',
          data: [58.5, 59.2, 60.3, 61.4],
          borderColor: '#39FF7A',
          backgroundColor: 'rgba(57,255,122,0.06)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointBackgroundColor: '#39FF7A',
          pointRadius: 4
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#666', font: { family: 'Outfit', size: 11 }, boxWidth: 12 }
        }
      }
    }
  });

  // Medidas corporales
  new Chart(document.getElementById('chartMedidas'), {
    type: 'bar',
    data: {
      labels: ['Pecho', 'Cintura', 'Cadera', 'Brazo D', 'Brazo I', 'Muslo'],
      datasets: [
        {
          label: 'Ene',
          data: [93, 87, 97, 32, 31, 53],
          backgroundColor: 'rgba(0,212,232,0.2)',
          borderColor: 'rgba(0,212,232,0.4)',
          borderWidth: 1,
          borderRadius: 3
        },
        {
          label: 'Actual (Abr)',
          data: [96, 82, 95, 34, 33, 56],
          backgroundColor: 'rgba(0,212,232,0.7)',
          borderColor: '#00D4E8',
          borderWidth: 1,
          borderRadius: 3
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#666', font: { family: 'Outfit', size: 11 }, boxWidth: 12 }
        }
      }
    }
  });

  // Asistencia mensual
  new Chart(document.getElementById('chartAsistencia'), {
    type: 'bar',
    data: {
      labels: ['Ene', 'Feb', 'Mar', 'Abr'],
      datasets: [
        {
          label: 'Funcional',
          data: [18, 20, 15, 12],
          backgroundColor: 'rgba(0,212,232,0.6)',
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Pilates',
          data: [2, 2, 1, 3],
          backgroundColor: 'rgba(155,89,255,0.6)',
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'Cycling',
          data: [4, 3, 5, 2],
          backgroundColor: 'rgba(255,107,53,0.6)',
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      ...chartDefaults,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#666', font: { family: 'Outfit', size: 11 }, boxWidth: 12 }
        }
      }
    }
  });

  // Radar
  new Chart(document.getElementById('chartRadar'), {
    type: 'radar',
    data: {
      labels: ['Resistencia', 'Fuerza', 'Flexibilidad', 'Cardio', 'Coordinación', 'Constancia'],
      datasets: [{
        data: [78, 65, 55, 72, 60, 85],
        borderColor: '#00D4E8',
        backgroundColor: 'rgba(0,212,232,0.12)',
        pointBackgroundColor: '#00D4E8',
        borderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      animation: { duration: 800 },
      plugins: { legend: { display: false } },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          ticks: { display: false },
          pointLabels: { color: '#666', font: { family: 'Outfit', size: 11 } },
          min: 0, max: 100
        }
      }
    }
  });
}

let _adminChart = null;

const _PLAN_COLORS = [
  { bg: 'rgba(0,207,232,0.80)',   bd: '#00CFE8' },
  { bg: 'rgba(155,89,255,0.80)',  bd: '#9B59FF' },
  { bg: 'rgba(255,107,53,0.80)',  bd: '#FF6B35' },
  { bg: 'rgba(57,255,122,0.75)', bd: '#39FF7A' },
  { bg: 'rgba(255,184,0,0.80)',   bd: '#FFB800' },
  { bg: 'rgba(255,56,96,0.75)',  bd: '#FF3860' },
  { bg: 'rgba(0,181,255,0.80)',   bd: '#00B5FF' },
  { bg: 'rgba(200,230,0,0.75)',   bd: '#C8E600' },
];

function initAdminCharts(labels, data) {
  const adminCanvas = document.getElementById('chartAdmin');
  if (!adminCanvas) return;

  const chartLabels = labels?.length ? labels.map(l => l.length > 22 ? l.slice(0, 20) + '…' : l) : ['Sin datos'];
  const chartData   = data?.length   ? data   : [1];
  const total       = chartData.reduce((s, v) => s + v, 0);

  const bgColors = chartLabels.map((_, i) => _PLAN_COLORS[i % _PLAN_COLORS.length].bg);
  const bdColors = chartLabels.map((_, i) => _PLAN_COLORS[i % _PLAN_COLORS.length].bd);

  const opts = {
    cutout: '62%',
    maintainAspectRatio: false,
    layout: { padding: { top: 4, bottom: 4 } },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#bbb',
          font: { family: 'Outfit', size: 11 },
          boxWidth: 11,
          padding: 14,
          usePointStyle: true,
          pointStyleWidth: 9,
        }
      },
      tooltip: {
        callbacks: {
          label: ctx => {
            const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
            return `  ${ctx.parsed} miembros · ${pct}%`;
          }
        }
      }
    },
    animation: { duration: 600 }
  };

  if (_adminChart) {
    _adminChart.data.labels = chartLabels;
    _adminChart.data.datasets[0].data            = chartData;
    _adminChart.data.datasets[0].backgroundColor = bgColors;
    _adminChart.data.datasets[0].borderColor     = bdColors;
    Object.assign(_adminChart.options, opts);
    _adminChart.update();
    return;
  }

  _adminChart = new Chart(adminCanvas, {
    type: 'doughnut',
    data: {
      labels: chartLabels,
      datasets: [{ data: chartData, backgroundColor: bgColors, borderColor: bdColors, borderWidth: 2, hoverOffset: 8 }]
    },
    options: opts
  });
}


// ── BI Dashboard chart instances ───────────────────────────
let _revenueChart    = null;
let _growthChart     = null;
let _attendanceChart = null;

function _barChartOpts(yTickCb) {
  return {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(10,10,10,0.92)',
        titleColor: '#888',
        bodyColor: '#fff',
        borderColor: '#252525',
        borderWidth: 1,
        padding: 10,
        titleFont: { family: 'Outfit', size: 10 },
        bodyFont: { family: 'Outfit', size: 13, weight: '700' },
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#555', font: { family: 'Outfit', size: 10 } },
        border: { color: 'transparent' },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#555',
          font: { family: 'Outfit', size: 10 },
          ...(yTickCb ? { callback: yTickCb } : {})
        },
        border: { color: 'transparent' },
        beginAtZero: true,
      }
    },
    animation: { duration: 500 }
  };
}

function _initRevenueChart(labels, data) {
  const canvas = document.getElementById('chartRevenue');
  if (!canvas) return;
  const last = labels.length - 1;
  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ingresos',
        data,
        backgroundColor: labels.map((_, i) =>
          i === last ? 'rgba(0,207,255,0.55)' : 'rgba(0,207,255,0.22)'),
        borderColor: '#00CFFF',
        borderWidth: 2,
        borderRadius: 6,
        hoverBackgroundColor: 'rgba(0,207,255,0.70)',
      }]
    },
    options: _barChartOpts(v =>
      v >= 1000000 ? '$' + (v / 1000000).toFixed(1) + 'M' :
      v >= 1000    ? '$' + (v / 1000).toFixed(0) + 'K'    : '$' + v
    )
  };
  if (_revenueChart) { _revenueChart.data = cfg.data; _revenueChart.update(); return; }
  _revenueChart = new Chart(canvas, cfg);
}

function _initGrowthChart(labels, newData, churnData) {
  const canvas = document.getElementById('chartGrowth');
  if (!canvas) return;
  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Nuevos',
          data: newData,
          backgroundColor: 'rgba(57,255,122,0.50)',
          borderColor: '#39FF7A',
          borderWidth: 1.5,
          borderRadius: 5,
        },
        {
          label: 'Desertores',
          data: churnData,
          backgroundColor: 'rgba(255,56,96,0.42)',
          borderColor: '#FF3860',
          borderWidth: 1.5,
          borderRadius: 5,
        }
      ]
    },
    options: {
      ..._barChartOpts(),
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#777',
            font: { family: 'Outfit', size: 10 },
            boxWidth: 10,
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: _barChartOpts().plugins.tooltip
      }
    }
  };
  if (_growthChart) { _growthChart.data = cfg.data; _growthChart.update(); return; }
  _growthChart = new Chart(canvas, cfg);
}

function _initAttendanceChart(labels, data) {
  const canvas = document.getElementById('chartAttendance');
  if (!canvas) return;
  const last = labels.length - 1;
  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Check-ins',
        data,
        backgroundColor: labels.map((_, i) =>
          i === last ? 'rgba(155,89,255,0.65)' : 'rgba(155,89,255,0.32)'),
        borderColor: '#9B59FF',
        borderWidth: 2,
        borderRadius: 5,
        hoverBackgroundColor: 'rgba(155,89,255,0.80)',
      }]
    },
    options: _barChartOpts()
  };
  if (_attendanceChart) { _attendanceChart.data = cfg.data; _attendanceChart.update(); return; }
  _attendanceChart = new Chart(canvas, cfg);
}

// ===================== FINANCIERO =====================

let _finChart = null;
const _MESES_ABR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function _finFmt(amount) {
  if (Math.abs(amount) >= 1000000) return '$' + (amount / 1000000).toFixed(1) + 'M';
  return '$' + Math.abs(amount).toLocaleString('es-CO');
}

function _finSetEl(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function _finSkeleton() {
  const dash = '<span style="color:var(--muted)">—</span>';
  _finSetEl('fin-kpi-ingresos-val', dash);
  _finSetEl('fin-kpi-ingresos-chg', '');
  _finSetEl('fin-kpi-egresos-val', dash);
  _finSetEl('fin-kpi-egresos-chg', '');
  _finSetEl('fin-kpi-nuevos-val', dash);
  _finSetEl('fin-kpi-nuevos-chg', '');
  _finSetEl('fin-kpi-renov-val', dash);
  _finSetEl('fin-kpi-renov-chg', '');
  _finSetEl('fin-plan-dist', _loader());
  _finSetEl('fin-txn-tbody', _loaderRow(5));
}

// Reporte financiero por método de pago (parte 7 del módulo de facturación) — lee
// directo de `payments`, deliberadamente separado de `cash_movements` (el libro de
// caja manual que alimenta el resto de esta página): son dos registros de dinero
// independientes que no necesariamente van a cuadrar entre sí, ver memoria del
// proyecto. Solo cuenta pagos 'approved' — lo que ya entró, no lo pendiente.
async function consultarIngresosPorMetodo() {
  const desde = document.getElementById('fin-metodo-desde')?.value;
  const hasta = document.getElementById('fin-metodo-hasta')?.value;
  const el = document.getElementById('fin-metodo-resultado');
  if (!el) return;
  if (!desde || !hasta) { toast('Rango requerido', 'Selecciona fecha desde y hasta'); return; }
  if (desde > hasta) { toast('Rango inválido', '"Desde" no puede ser después de "Hasta"'); return; }

  el.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';

  const { data, error } = await db
    .from('payments')
    .select('amount_cop, method')
    .eq('status', 'approved')
    .in('method', ['efectivo', 'transferencia'])
    .gte('paid_at', desde + 'T00:00:00')
    .lte('paid_at', hasta + 'T23:59:59');

  if (error) {
    el.innerHTML = `<div style="color:var(--red);font-size:13px;">${error.message}</div>`;
    return;
  }

  const rows = data || [];
  const efectivo = rows.filter(r => r.method === 'efectivo');
  const transferencia = rows.filter(r => r.method === 'transferencia');
  const sum = arr => arr.reduce((s, r) => s + (r.amount_cop || 0), 0);
  const totalEfectivo = sum(efectivo);
  const totalTransferencia = sum(transferencia);
  const totalGeneral = totalEfectivo + totalTransferencia;

  const card = (label, value, count, color) => `
    <div class="stat-card" style="flex:1;min-width:150px;">
      <div class="stat-label">${label}</div>
      <div class="stat-value" style="font-size:22px;${color ? `color:${color};` : ''}">${_formatCOPFull(value)}</div>
      <div class="stat-change">${count} pago${count !== 1 ? 's' : ''}</div>
    </div>`;

  el.innerHTML =
    card('Efectivo', totalEfectivo, efectivo.length) +
    card('Transferencia', totalTransferencia, transferencia.length) +
    card('Total', totalGeneral, rows.length, 'var(--cyan)');
}

async function loadFinancieroPage() {
  _finSkeleton();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const pad = n => String(n).padStart(2, '0');
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEndDate = new Date(year, month, 0);
  const monthEnd = `${year}-${pad(month)}-${pad(monthEndDate.getDate())}`;
  const nextMonthDate = new Date(year, month, 1);
  const nextMonthStart = `${nextMonthDate.getFullYear()}-${pad(nextMonthDate.getMonth() + 1)}-01`;

  const prevMonthNum = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthStart = `${prevYear}-${pad(prevMonthNum)}-01`;
  const prevMonthEndDate = new Date(prevYear, prevMonthNum, 0);
  const prevMonthEnd = `${prevYear}-${pad(prevMonthNum)}-${pad(prevMonthEndDate.getDate())}`;

  const sixMonthsAgoDate = new Date(year, month - 7, 1);
  const sixMonthsAgoStr = `${sixMonthsAgoDate.getFullYear()}-${pad(sixMonthsAgoDate.getMonth() + 1)}-01`;

  try {
    const [ingR, prevIngR, egrR, newMemR, chartMovR, planDistR, txnR] = await Promise.all([
      db.from('cash_movements').select('amount_cop')
        .eq('movement_type', 'Ingreso').gte('movement_date', monthStart).lte('movement_date', monthEnd),

      db.from('cash_movements').select('amount_cop')
        .eq('movement_type', 'Ingreso').gte('movement_date', prevMonthStart).lte('movement_date', prevMonthEnd),

      db.from('cash_movements').select('amount_cop, id')
        .eq('movement_type', 'Egreso').gte('movement_date', monthStart).lte('movement_date', monthEnd),

      db.from('memberships').select('user_id')
        .gte('created_at', monthStart).lt('created_at', nextMonthStart),

      db.from('cash_movements').select('movement_date, amount_cop')
        .eq('movement_type', 'Ingreso').gte('movement_date', sixMonthsAgoStr)
        .order('movement_date', { ascending: true }),

      db.from('memberships').select('plan_id, plans(name, price_cop)')
        .eq('status', 'active'),

      db.from('cash_movements').select('*')
        .order('movement_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(20)
    ]);

    const errored = [ingR, prevIngR, egrR, newMemR, chartMovR, planDistR, txnR].find(r => r.error);
    if (errored) throw new Error(errored.error.message);

    // Reporte por método de pago (parte 7, módulo de facturación) — precarga el mes
    // actual y consulta de una vez, igual que las demás KPIs de esta página.
    const desdeEl = document.getElementById('fin-metodo-desde');
    const hastaEl = document.getElementById('fin-metodo-hasta');
    if (desdeEl && !desdeEl.value) desdeEl.value = monthStart;
    if (hastaEl && !hastaEl.value) hastaEl.value = monthEnd;
    consultarIngresosPorMetodo();

    // KPI 1 — Ingresos
    const totalIngresos = (ingR.data || []).reduce((s, r) => s + r.amount_cop, 0);
    const totalPrevIngresos = (prevIngR.data || []).reduce((s, r) => s + r.amount_cop, 0);
    const pct = totalPrevIngresos > 0
      ? Math.round(((totalIngresos - totalPrevIngresos) / totalPrevIngresos) * 100)
      : 0;
    const ingValEl = document.getElementById('fin-kpi-ingresos-val');
    const ingChgEl = document.getElementById('fin-kpi-ingresos-chg');
    if (ingValEl) ingValEl.textContent = _finFmt(totalIngresos);
    if (ingChgEl) {
      ingChgEl.textContent = `${pct >= 0 ? '↑ +' : '↓ '}${Math.abs(pct)}% vs. ${_MESES_ABR[prevMonthNum - 1]}`;
      ingChgEl.className = 'stat-change ' + (pct >= 0 ? 'up' : 'down');
    }

    // KPI 2 — Egresos
    const totalEgresos = (egrR.data || []).reduce((s, r) => s + r.amount_cop, 0);
    const egrCount = (egrR.data || []).length;
    const egrValEl = document.getElementById('fin-kpi-egresos-val');
    const egrChgEl = document.getElementById('fin-kpi-egresos-chg');
    if (egrValEl) egrValEl.textContent = _finFmt(totalEgresos);
    if (egrChgEl) egrChgEl.textContent = `${egrCount} transacción${egrCount !== 1 ? 'es' : ''} de egreso`;

    // KPIs 3 & 4 — Nuevos / Renovaciones
    const newUserIds = [...new Set((newMemR.data || []).map(m => m.user_id))];
    let nuevos = newUserIds.length;
    let renovaciones = 0;

    if (newUserIds.length > 0) {
      const { data: priorData } = await db.from('memberships')
        .select('user_id')
        .in('user_id', newUserIds)
        .lt('created_at', monthStart);
      const withPrior = new Set((priorData || []).map(m => m.user_id));
      renovaciones = newUserIds.filter(uid => withPrior.has(uid)).length;
      nuevos = newUserIds.length - renovaciones;
    }

    const nuevosValEl = document.getElementById('fin-kpi-nuevos-val');
    const nuevosChgEl = document.getElementById('fin-kpi-nuevos-chg');
    if (nuevosValEl) nuevosValEl.textContent = nuevos;
    if (nuevosChgEl) { nuevosChgEl.textContent = '↑ membresías nuevas'; nuevosChgEl.className = 'stat-change up'; }

    const renovValEl = document.getElementById('fin-kpi-renov-val');
    const renovChgEl = document.getElementById('fin-kpi-renov-chg');
    if (renovValEl) renovValEl.textContent = renovaciones;
    if (renovChgEl) {
      const total = nuevos + renovaciones;
      const tasa = total > 0 ? Math.round((renovaciones / total) * 100) : 0;
      renovChgEl.textContent = `↑ tasa ${tasa}%`;
      renovChgEl.className = 'stat-change up';
    }

    // Chart — 6 meses
    const chartMovements = chartMovR.data || [];
    const chartLabels = [];
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      chartLabels.push(_MESES_ABR[d.getMonth()]);
      const mStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const sum = chartMovements
        .filter(m => m.movement_date.startsWith(mStr))
        .reduce((s, m) => s + m.amount_cop, 0);
      chartData.push(sum);
    }

    const finCanvas = document.getElementById('chartFinanciero');
    if (finCanvas) {
      if (_finChart) {
        _finChart.data.labels = chartLabels;
        _finChart.data.datasets[0].data = chartData;
        _finChart.update();
      } else {
        _finChart = new Chart(finCanvas, {
          type: 'bar',
          data: {
            labels: chartLabels,
            datasets: [{
              data: chartData,
              backgroundColor: 'rgba(0,212,232,0.25)',
              borderColor: '#00D4E8',
              borderWidth: 1.5,
              borderRadius: 5,
              borderSkipped: false,
              hoverBackgroundColor: 'rgba(0,212,232,0.5)'
            }]
          },
          options: {
            ...chartDefaults,
            scales: {
              ...chartDefaults.scales,
              y: {
                ...chartDefaults.scales.y,
                ticks: {
                  ...chartDefaults.scales.y.ticks,
                  callback: v => '$' + (v / 1000000).toFixed(1) + 'M'
                }
              }
            }
          }
        });
      }
    }

    // Plan distribution
    const planMap = {};
    for (const m of (planDistR.data || [])) {
      const pid = m.plan_id;
      if (!planMap[pid]) planMap[pid] = { name: m.plans?.name || 'Sin plan', price: m.plans?.price_cop || 0, count: 0 };
      planMap[pid].count++;
    }
    const planItems = Object.values(planMap)
      .map(p => ({ ...p, revenue: p.price * p.count }))
      .sort((a, b) => b.revenue - a.revenue);
    const maxRevenue = planItems.length > 0 ? planItems[0].revenue : 1;
    const planDistEl = document.getElementById('fin-plan-dist');
    if (planDistEl) {
      planDistEl.innerHTML = planItems.length === 0
        ? '<div style="color:var(--muted);font-size:12px;padding:10px 0;">Sin membresías activas</div>'
        : planItems.map(p => {
            const pct2 = Math.round((p.revenue / maxRevenue) * 100);
            return `<div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
                <span>${p.name}</span><span style="color:var(--cyan);">${p.count} · ${_finFmt(p.revenue)}</span>
              </div>
              <div class="progress-bar" style="height:8px;"><div class="progress-fill" style="width:${pct2}%;"></div></div>
            </div>`;
          }).join('');
    }

    // Transactions
    const txns = txnR.data || [];
    const tbody = document.getElementById('fin-txn-tbody');
    if (tbody) {
      tbody.innerHTML = txns.length === 0
        ? '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px;">Sin transacciones</td></tr>'
        : txns.map(t => {
            const notes = t.notes || '—';
            const displayNotes = notes.length > 30 ? notes.slice(0, 30) + '…' : notes;
            const isIngreso = t.movement_type === 'Ingreso';
            const amtColor = isIngreso ? 'var(--green)' : 'var(--red)';
            const amtStr = (isIngreso ? '+' : '-') + _finFmt(t.amount_cop);
            const parts = (t.movement_date || '').split('-');
            const dateLabel = parts.length === 3 ? `${parseInt(parts[2])} ${_MESES_ABR[parseInt(parts[1]) - 1]}` : '—';
            const badge = isIngreso
              ? '<span class="badge badge-green">CONFIRMADO</span>'
              : '<span class="badge" style="background:rgba(150,150,150,0.12);color:#888;">EGRESO</span>';
            return `<tr>
              <td>${displayNotes}</td>
              <td>${t.concept}</td>
              <td style="color:${amtColor};font-family:'Outfit';font-weight:700;font-size:16px;">${amtStr}</td>
              <td style="color:var(--muted);">${dateLabel}</td>
              <td>${badge}</td>
            </tr>`;
          }).join('');
    }

  } catch (err) {
    console.error('loadFinancieroPage:', err);
    const tbody = document.getElementById('fin-txn-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--red);padding:20px;">Error cargando datos financieros. Intenta de nuevo.</td></tr>`;
  }
}

// ===================== PAGOS =====================

function toggleDebito() {
  const checked = document.getElementById('toggle-debito').checked;
  const desc = document.getElementById('debito-desc');
  const notice = document.getElementById('debito-notice');
  if (checked) {
    desc.textContent = 'El cobro se realizará automáticamente el día 1 de cada mes.';
    notice.style.display = 'none';
  } else {
    desc.textContent = 'Activa el débito automático para no perder tu cupo.';
    notice.style.display = 'flex';
  }
}

function guardarTarjeta() {
  closeModal('modal-agregar-pago');
  const authCheck = document.getElementById('auth-debito');
  const toggle = document.getElementById('toggle-debito');
  if (authCheck && authCheck.checked && toggle) {
    toggle.checked = true;
    toggleDebito();
  }
  authCheck && (authCheck.checked = false);
  toast('Tarjeta guardada', 'Débito automático activado');
}

// ===================== CHECK-IN =====================

const ciColorBg   = { cyan:'rgba(0,212,232,0.15)', purple:'rgba(155,89,255,0.15)', orange:'rgba(255,107,53,0.15)', red:'rgba(255,59,92,0.15)' };
const ciColorFg   = { cyan:'var(--cyan)', purple:'var(--purple)', orange:'var(--orange)', red:'var(--red)' };
const ciColorKeys = ['cyan', 'purple', 'orange', 'red'];

let checkinSelectedMember    = null;
let _checkinRefreshTimer     = null;
let _checkinGymCountChannel  = null;
let _gymCount                = 0;
let _checkinTableDebounce    = null;
let _gymSettings             = { auto_checkout_minutes: 120 }; // default, overwritten by loadGymSettings()

// status: memberships.status real (opcional) — si es 'suspended' (VOIDED de Wompi,
// ver void_payment_and_suspend_membership()), pisa cualquier cálculo por fecha: una
// membresía suspendida por fraude/reversión NO debe volver a mostrarse como Activa
// solo porque su end_date todavía no ha pasado.
function _membershipStatus(endDateStr, status) {
  if (status === 'suspended') return 'Suspendida';
  if (!endDateStr) return 'Sin membresía';
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const endDate = parseLocalDate(endDateStr);
  const ago7    = new Date(today); ago7.setDate(ago7.getDate() - 7);
  const in5     = new Date(today); in5.setDate(in5.getDate() + 5);
  if (endDate < ago7) return 'Desertor';
  if (endDate < today) return 'Vencido';
  if (endDate <= in5)  return 'Por vencer';
  return 'Activo';
}

// Picks the canonical "current" membership among possibly-multiple rows for a user —
// the one with the latest end_date. Renewals can leave more than one row behind and
// nothing in the app ever demotes an old row's `status` away from 'active', so
// `status === 'active'` (or just taking the first array entry) cannot be trusted to
// disambiguate; the most-recent end_date is the only reliable signal.
function _pickCurrentMembership(mems) {
  if (!mems || !mems.length) return null;
  return mems.reduce((best, m) => (!best || (m.end_date && m.end_date > best.end_date)) ? m : best, null);
}

// `identification` is stored digits-only (e.g. "32296056"), but staff routinely type
// cédulas with dots/dashes/spaces ("32.296.056", "32-296-056"). ilike-matching the raw
// query against that column then silently returns zero rows. When the query contains any
// digits, match on the digit-only version against `identification`; name matching still
// uses the raw query untouched.
function _memberSearchOrFilter(q) {
  const qDigits = q.replace(/\D/g, '');
  const idFilter = qDigits ? `identification.ilike.%${qDigits}%` : `identification.ilike.%${q}%`;
  return `full_name.ilike.%${q}%,${idFilter}`;
}

function _statusBadgeClass(statusLabel) {
  if (statusLabel === 'Activo')      return 'badge-green';
  if (statusLabel === 'Por vencer')  return 'badge-amber';
  if (statusLabel === 'Vencido')     return 'badge-red';
  if (statusLabel === 'Desertor')    return 'badge-desertor';
  if (statusLabel === 'Suspendida')  return 'badge-red';
  return 'badge-muted';
}

function _userToCheckinMember(u) {
  const membership = _pickCurrentMembership(u.memberships);
  const colorKey   = ciColorKeys[(u.full_name || '?').charCodeAt(0) % ciColorKeys.length];
  const estado     = membership ? _membershipStatus(membership.end_date, membership.status) : 'Sin membresía';
  return {
    id:         u.id,
    nombre:     u.full_name || '—',
    documento:  u.identification || null,
    plan:       membership?.plans?.name || 'Sin plan',
    estado,
    avatar:     (u.full_name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    color:      colorKey
  };
}

function _methodBadge(method) {
  if (method == null)  return '<span class="badge badge-muted">Manual</span>';
  if (method === 6)    return '<span class="badge badge-cyan">Huella</span>';
  if (method === 15)   return '<span class="badge badge-purple">Cara</span>';
  return '<span class="badge badge-blue">Biométrico</span>';
}

// Returns an inline membership-status badge for the check-in table row.
// endDateStr: YYYY-MM-DD string from the memberships join (null → no membership).
function _ciMembershipBadge(endDateStr) {
  const status = _membershipStatus(endDateStr);
  if (status === 'Activo') {
    return '<span class="badge badge-green">Membresía activa</span>';
  }
  if (status === 'Por vencer') {
    const [y, m, d] = endDateStr.split('-').map(Number);
    const label = new Date(y, m - 1, d)
      .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
      .toUpperCase();
    return `<span class="badge badge-amber">Vence pronto · ${label}</span>`;
  }
  if (status === 'Vencido' || status === 'Desertor') {
    return '<span class="badge badge-red ci-badge-pulse">Membresía inactiva</span>';
  }
  return '<span class="badge badge-muted">Sin membresía</span>';
}

// Bogotá is UTC-5 year-round (Colombia never observes DST) — these two are inverses of
// each other and are the single source of truth for that offset. Any other timestamp/date
// conversion in this file should go through one of these two instead of hardcoding
// "- 5 * 60 * 60 * 1000" or "T05:00:00Z" again.

// Converts any timestamp (Date, ISO string, or epoch ms) to its Bogotá-local calendar
// date as YYYY-MM-DD. Use this instead of `ts.split('T')[0]` on a raw UTC timestamp —
// truncating UTC directly can land on the wrong calendar date (or, right at a Dec 31/Jan 1
// boundary, the wrong year) for any timestamp between 19:00 and 23:59 Bogotá time.
function _bogotaDateOf(ts) {
  return new Date(new Date(ts).getTime() - 5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// Anchors a Bogotá calendar date (YYYY-MM-DD, e.g. from a <input type="date">) to that
// day's midnight expressed in UTC, safe to store in a timestamptz column — the inverse
// of _bogotaDateOf(). A bare "YYYY-MM-DD" sent to a timestamptz column is ambiguous and
// can shift to the wrong calendar date/year depending on the DB session timezone.
function _bogotaMidnightUTC(bogotaDate) {
  return bogotaDate + 'T05:00:00Z';
}

// Today's date as YYYY-MM-DD in Bogotá local time.
function _bogotaToday() {
  return _bogotaDateOf(Date.now());
}

// Returns [startUTC, endUTC] for a given Bogotá calendar date (YYYY-MM-DD).
// Defaults to today if no date provided.
function _bogotaDayRange(bogotaDate) {
  const dateStr = bogotaDate || _bogotaToday();
  const start   = new Date(_bogotaMidnightUTC(dateStr));
  const end     = new Date(start.getTime() + 86400000);
  return [start.toISOString(), end.toISOString()];
}

// Fase 4.5 — cancellation-deadline rule ("mínimo 2 horas antes de la clase"). Combines a
// Bogotá calendar date (YYYY-MM-DD) and a time-of-day (HH:MM or HH:MM:SS) into the UTC
// instant that wall-clock moment represents — same fixed UTC-5 offset _bogotaMidnightUTC()
// above anchors a bare date to, just extended to also cover time-of-day (which that helper
// doesn't). Used only by _isLateCancellation() below.
function _bogotaDateTimeToUTC(bogotaDate, timeStr) {
  const hhmmss = (timeStr || '00:00:00').length === 5 ? timeStr + ':00' : timeStr;
  return new Date(`${bogotaDate}T${hhmmss}-05:00`);
}

// True when fewer than 2 hours (Bogotá time) remain before a class's start, or the class has
// already started/passed — the cancellation-deadline rule from Fase 4.5. classDate/startTime
// come straight off a `schedule` row (class_date, start_time). This function only decides
// whether to WARN at cancel time; the actual "does this still count against the member's
// allowance" charge is recomputed independently and authoritatively by
// seal_past_class_occurrences() from bookings.cancelled_at, so the warning and the real
// charge can never disagree (see supabase/migrations/20260820_class_allowance_tracking.sql).
function _isLateCancellation(classDate, startTime) {
  if (!classDate || !startTime) return false;
  const classStartUTC = _bogotaDateTimeToUTC(classDate, startTime);
  return (classStartUTC.getTime() - Date.now()) < 2 * 60 * 60 * 1000;
}

function _updateGymCounter(n) {
  _gymCount = n;
  const el = document.getElementById('gym-count-text');
  if (el) el.textContent = `${n} persona${n !== 1 ? 's' : ''} en el gym ahora`;
}

async function _fetchGymCount() {
  const [start, end] = _bogotaDayRange();
  const { count, error } = await db
    .from('attendance_records')
    .select('*', { count: 'exact', head: true })
    .gte('checked_in_at', start)
    .lt('checked_in_at', end)
    .not('user_id', 'is', null)
    .is('checked_out_at', null); // only people currently present (not yet checked out)
  if (!error) _updateGymCounter(count ?? 0);
}

async function _refreshCheckinTabla() {
  const tbody = document.getElementById('checkin-tabla');
  if (!tbody) return;

  const picker  = document.getElementById('checkin-date-picker');
  const dateVal = picker?.value || _bogotaToday();
  const isToday = dateVal === _bogotaToday();

  // Keep page subtitle in sync with the selected date
  const subEl = document.getElementById('checkin-date-sub');
  if (subEl) {
    const [y, m, d] = dateVal.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
    }).toUpperCase();
    subEl.textContent = `Registro de asistencia · ${label}`;
  }

  const [startUTC, endUTC] = _bogotaDayRange(dateVal);

  const { data, error } = await db
    .from('attendance_records')
    .select('id, checked_in_at, checked_out_at, checkout_method, method, status, documento, users(id, full_name, memberships!user_id(end_date))')
    .gte('checked_in_at', startUTC)
    .lt('checked_in_at', endUTC)
    .order('checked_in_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--red);">Error al cargar: ${error.message}</td></tr>`;
    return;
  }

  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted);">Sin check-ins ${isToday ? 'registrados hoy' : 'para este día'}</td></tr>`;
    return;
  }

  // Possible-duplicate detection (biometric device can enroll the same physical person
  // under a second `users` row): for any check-in whose matched account has no current
  // membership, see whether the same `documento` also belongs to a DIFFERENT account that
  // DOES have one. We only ever surface a hint here — never touch attendance_records or
  // the matcher itself. See _pickCurrentMembership() for why end_date, not status, decides
  // "current".
  const docsToCheck = [...new Set(
    data
      .filter(a => a.documento && !_pickCurrentMembership(a.users?.memberships))
      .map(a => a.documento)
  )];
  let dupByDoc = {};
  if (docsToCheck.length) {
    const { data: dupCandidates } = await db
      .from('users')
      .select('id, identification, full_name, memberships!user_id(end_date)')
      .in('identification', docsToCheck);
    (dupCandidates || []).forEach(u => {
      const current = _pickCurrentMembership(u.memberships);
      if (current) dupByDoc[u.identification] = { id: u.id, name: u.full_name };
    });
  }

  tbody.innerHTML = data.map(a => {
    const isUnknown = !a.users;
    const doc       = a.documento || null;
    const name      = a.users?.full_name ?? (doc ? `Doc: ${doc}` : 'Desconocido');
    const initials  = isUnknown ? '?' : name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const colorKey  = isUnknown ? null : ciColorKeys[name.charCodeAt(0) % ciColorKeys.length];
    const avatarBg  = isUnknown ? 'var(--surface2)' : ciColorBg[colorKey];
    const avatarFg  = isUnknown ? 'var(--muted)'    : ciColorFg[colorKey];
    const time      = new Date(a.checked_in_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const addBtn    = isUnknown && doc
      ? `<button onclick="abrirNuevoUsuarioConDoc('${doc}')" title="Crear usuario con este documento" style="margin-left:4px;padding:0 6px;height:20px;font-size:11px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--cyan);cursor:pointer;line-height:1;">+</button>`
      : '';

    // Pick the membership with the latest end_date among all rows returned
    const endDate = _pickCurrentMembership(a.users?.memberships)?.end_date || null;
    const dup     = doc ? dupByDoc[doc] : null;
    const dupHint = (dup && dup.id !== a.users?.id)
      ? ` <span class="badge badge-amber" title="El documento ${doc} también está registrado en la cuenta de ${dup.name} (con membresía vigente) — posible duplicado del dispositivo biométrico">⚠ Posible duplicado</span>`
      : '';
    const membershipBadge = (isUnknown
      ? '<span class="badge badge-muted">✓ Registrado</span>'
      : _ciMembershipBadge(endDate)) + dupHint;

    // Checkout column: show time + badge if checked out; button if still in (today only); dash for past days
    let salidaTd;
    if (a.checked_out_at) {
      const outTime    = new Date(a.checked_out_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      const autoBadge  = a.checkout_method === 'auto'
        ? `<span style="font-size:10px;background:rgba(139,92,246,0.18);color:#c4b5fd;border:1px solid rgba(139,92,246,0.35);border-radius:4px;padding:1px 6px;margin-left:5px;letter-spacing:.3px;">auto</span>`
        : '';
      salidaTd = `<td style="color:var(--muted);font-family:'Outfit',sans-serif;font-weight:500;letter-spacing:1px;white-space:nowrap;">${outTime}${autoBadge}</td>`;
    } else if (isToday) {
      salidaTd = `<td><button onclick="marcarSalida('${a.id}')" style="font-size:11px;padding:3px 10px;border:1px solid rgba(255,255,255,0.15);border-radius:5px;background:transparent;color:var(--muted2);cursor:pointer;letter-spacing:.3px;" title="Marcar salida manual">↩ Salida</button></td>`;
    } else {
      salidaTd = `<td style="color:var(--muted);font-size:12px;">—</td>`;
    }

    return `<tr>
      <td style="color:var(--muted);font-family:'Outfit',sans-serif;font-weight:500;letter-spacing:1px;">${time}</td>
      <td><div style="display:flex;align-items:center;gap:8px;">
        <div style="width:28px;height:28px;font-size:11px;background:${avatarBg};color:${avatarFg};font-family:'Outfit',sans-serif;font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>
        ${name}${addBtn}</div></td>
      <td>${_methodBadge(a.method)}</td>
      <td>${membershipBadge}</td>
      ${salidaTd}
    </tr>`;
  }).join('');
}

function abrirNuevoUsuarioConDoc(doc) {
  openNuevoUsuarioModal(doc);
}

async function buscarMiembro() {
  const q         = (document.getElementById('checkin-search').value || '').trim();
  const container = document.getElementById('checkin-resultados');
  container.innerHTML = '';
  if (!q) return;

  container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:10px 0;">Buscando...</div>';

  const { data, error } = await db
    .from('users')
    .select('id, full_name, identification, memberships!user_id(status, end_date, plans(name))')
    .eq('role', 'user')
    .or(_memberSearchOrFilter(q))
    .limit(10);

  container.innerHTML = '';

  if (error) {
    console.error('[buscarMiembro] Supabase error:', error);
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:10px 0;">No se encontraron miembros.</div>';
    return;
  }
  if (!data?.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:10px 0;">No se encontraron miembros.</div>';
    return;
  }

  data.map(_userToCheckinMember).forEach(m => {
    const isSelected = checkinSelectedMember && checkinSelectedMember.id === m.id;
    const card = document.createElement('div');
    card.className = 'member-result-card' + (isSelected ? ' selected' : '');
    card.innerHTML = `
      <div style="width:34px;height:34px;font-size:13px;background:${ciColorBg[m.color]};color:${ciColorFg[m.color]};font-family:'Outfit',sans-serif;font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${m.avatar}</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${m.nombre}</div>
        <div style="font-size:11px;color:var(--muted);">${m.plan}</div>
      </div>
      <span class="badge ${_statusBadgeClass(m.estado)}">${m.estado}</span>`;
    card.onclick = () => seleccionarMiembro(m);
    container.appendChild(card);
  });
}

function seleccionarMiembro(m) {
  checkinSelectedMember = m;
  document.getElementById('sel-avatar').textContent      = m.avatar;
  document.getElementById('sel-avatar').style.background = ciColorBg[m.color];
  document.getElementById('sel-avatar').style.color      = ciColorFg[m.color];
  document.getElementById('sel-nombre').textContent      = m.nombre;
  document.getElementById('sel-plan').textContent        = m.plan;
  document.getElementById('sel-estado').className        = 'badge ' + _statusBadgeClass(m.estado);
  document.getElementById('sel-estado').textContent      = m.estado;
  document.getElementById('checkin-seleccionado').style.display = 'block';
  buscarMiembro();
}

async function registrarCheckin() {
  if (!checkinSelectedMember) {
    toast('Selecciona un miembro', 'Busca y selecciona un miembro primero');
    return;
  }
  const m = checkinSelectedMember;

  // Único estado que bloquea el check-in de verdad (a diferencia de Vencido/Por
  // vencer/Desertor, que hoy dejan pasar de todas formas a criterio de recepción) —
  // una membresía suspendida por un VOIDED de Wompi es una señal de fraude/reversión,
  // no un simple atraso de pago. Reactivar es una acción explícita del admin desde el
  // perfil del usuario, nunca automática por volver a intentar el check-in.
  if (m.estado === 'Suspendida') {
    toast('Acceso bloqueado', `${m.nombre} tiene la membresía suspendida — revisa su perfil antes de dejarlo entrar`);
    return;
  }

  const { error } = await db
    .from('attendance_records')
    .insert({
      user_id:       m.id,
      documento:     m.documento,
      device_rec_no: null,
      checked_in_at: new Date().toISOString(),
      method:        null,
      status:        1
    });

  if (error) {
    toast('Error al registrar', error.message);
    return;
  }

  toast('Check-in registrado', m.nombre);
  checkinSelectedMember = null;
  document.getElementById('checkin-seleccionado').style.display = 'none';
  document.getElementById('checkin-search').value = '';
  document.getElementById('checkin-resultados').innerHTML = '';
  await _refreshCheckinTabla();
}

async function loadCheckinPage() {
  if (_checkinRefreshTimer) { clearInterval(_checkinRefreshTimer); _checkinRefreshTimer = null; }
  if (_checkinGymCountChannel) { db.removeChannel(_checkinGymCountChannel); _checkinGymCountChannel = null; }

  // Load configurable settings; show config UI for admins
  await loadGymSettings();
  const cfgEl  = document.getElementById('auto-checkout-cfg');
  const minEl  = document.getElementById('auto-checkout-min');
  if (cfgEl) cfgEl.style.display = (currentUser?.role === 'admin') ? 'flex' : 'none';
  if (minEl)  minEl.value = _gymSettings.auto_checkout_minutes;

  // Client-side auto-checkout fallback: triggers the same logic as the pg_cron job.
  // Runs every time this page loads so the feature works even when pg_cron is not enabled.
  _clientAutoCheckout().catch(() => {});  // fire-and-forget; errors don't block page load

  // Initialize date picker to today in Bogotá (only on first load)
  const picker = document.getElementById('checkin-date-picker');
  if (picker && !picker.value) picker.value = _bogotaToday();

  const today = _bogotaToday();

  // Class selector always shows today's classes (used for registrations, not for history)
  const select = document.getElementById('checkin-clase');
  if (select) {
    select.innerHTML = '<option value="">Cargando clases...</option>';
    const { data: slots, error: sErr } = await db
      .from('schedule')
      .select('id, start_time, classes(name, type)')
      .eq('class_date', today)
      .eq('is_cancelled', false)
      .order('start_time');

    if (sErr || !slots?.length) {
      select.innerHTML = '<option value="">Sin clases programadas hoy</option>';
    } else {
      select.innerHTML = slots.map(s => {
        const cls       = s.classes || {};
        const t         = new Date(`2000-01-01T${s.start_time}`);
        const timeLabel = t.toLocaleTimeString('es-CO', { hour:'numeric', minute:'2-digit', hour12:true }).toUpperCase();
        return `<option value="${s.id}" data-name="${cls.name || '—'} ${timeLabel}" data-type="${cls.type || ''}">${cls.name || '—'} · ${timeLabel}</option>`;
      }).join('');
    }
  }

  // Fetch initial gym count and subscribe to real-time inserts and checkouts
  await _fetchGymCount();
  _checkinGymCountChannel = db
    .channel('gym-count')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_records' }, payload => {
      const row = payload.new;
      const [start, end] = _bogotaDayRange();
      if (row.checked_in_at >= start && row.checked_in_at < end) {
        if (row.user_id) _updateGymCounter(_gymCount + 1);
        clearTimeout(_checkinTableDebounce);
        _checkinTableDebounce = setTimeout(_refreshCheckinTabla, 400);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'attendance_records' }, payload => {
      // Decrement counter whenever a checkout is recorded (manual or auto)
      if (payload.new.checked_out_at && !payload.old.checked_out_at) {
        _fetchGymCount(); // re-fetch exact count; don't decrement blindly (pg_cron may update many rows at once)
        clearTimeout(_checkinTableDebounce);
        _checkinTableDebounce = setTimeout(_refreshCheckinTabla, 400);
      }
    })
    .subscribe();

  const tbody = document.getElementById('checkin-tabla');
  if (tbody) tbody.innerHTML = _loaderRow(5);
  await _refreshCheckinTabla();

  // Only auto-refresh the table for today — historical views don't need polling
  if (!picker?.value || picker.value === _bogotaToday()) {
    _checkinRefreshTimer = setInterval(_refreshCheckinTabla, 60000);
  }
}

// Client-side fallback for auto-checkout — mirrors auto_checkout_stale_sessions() in SQL.
// Runs on every Check-in page load so the feature works even when pg_cron is not enabled.
// When pg_cron IS enabled, this is harmlessly redundant (the SQL guard prevents double-checkout).
async function _clientAutoCheckout() {
  const windowMin = _gymSettings.auto_checkout_minutes || 120;
  const cutoff    = new Date(Date.now() - windowMin * 60 * 1000).toISOString();
  const since24h  = new Date(Date.now() - 86400000).toISOString();
  const { data: stale } = await db
    .from('attendance_records')
    .select('id')
    .is('checked_out_at', null)
    .gte('checked_in_at', since24h)
    .lt('checked_in_at', cutoff);
  if (!stale?.length) return;
  await db
    .from('attendance_records')
    .update({ checked_out_at: new Date().toISOString(), checkout_method: 'auto' })
    .in('id', stale.map(r => r.id));
  // Counter and table will self-correct on next refresh; trigger it now if on today's view
  await _fetchGymCount();
  clearTimeout(_checkinTableDebounce);
  _checkinTableDebounce = setTimeout(_refreshCheckinTabla, 300);
}

// Reads auto_checkout_minutes from gym_settings; silently falls back to default on error
async function loadGymSettings() {
  try {
    const { data, error } = await db.from('gym_settings').select('auto_checkout_minutes').eq('id', 1).single();
    if (!error && data) _gymSettings.auto_checkout_minutes = data.auto_checkout_minutes;
  } catch (_) { /* keep default */ }
}

// Manual checkout — reception or admin marks a specific record as checked out
async function marcarSalida(recordId) {
  const { error } = await db
    .from('attendance_records')
    .update({ checked_out_at: new Date().toISOString(), checkout_method: 'manual' })
    .eq('id', recordId)
    .is('checked_out_at', null); // guard: only update if not already checked out
  if (error) {
    toast('Error al registrar salida', error.message);
    return;
  }
  await _fetchGymCount();
  await _refreshCheckinTabla();
}

// Admin saves the configurable auto-checkout window
async function saveAutoCheckoutMinutes() {
  const el  = document.getElementById('auto-checkout-min');
  const val = parseInt(el?.value, 10);
  if (!val || val < 15 || val > 480) {
    toast('Valor inválido', 'Ingresa un valor entre 15 y 480 minutos');
    return;
  }
  const { error } = await db.from('gym_settings').update({ auto_checkout_minutes: val }).eq('id', 1);
  if (error) {
    toast('Error al guardar', error.message);
    return;
  }
  _gymSettings.auto_checkout_minutes = val;
  toast('Configuración guardada', `Salida automática: ${val} minutos`);
}

// Handles date picker change: reload table and cancel auto-refresh for past dates
async function _onCheckinDateChange() {
  if (_checkinRefreshTimer) { clearInterval(_checkinRefreshTimer); _checkinRefreshTimer = null; }
  const tbody = document.getElementById('checkin-tabla');
  if (tbody) tbody.innerHTML = _loaderRow(5);
  await _refreshCheckinTabla();
  const picker = document.getElementById('checkin-date-picker');
  if (!picker?.value || picker.value === _bogotaToday()) {
    _checkinRefreshTimer = setInterval(_refreshCheckinTabla, 60000);
  }
}

// ===================== HORARIOS ADMIN =====================

let _classTypes             = [];
let _clasesInstructorCache  = [];

// Fix 1: populate datalist for free-text class name input
function buildClassTypeDatalist() {
  const dl = document.getElementById('class-type-datalist');
  if (!dl) return;
  dl.innerHTML = _classTypes.map(t => `<option value="${_escHtml(t.name)}">`).join('');
}

function buildInstructorOptions(selectedId = null) {
  const base = '<option value="">Sin asignación</option>';
  return base + _clasesInstructorCache.map(u =>
    `<option value="${u.id}"${u.id === selectedId ? ' selected' : ''}>${u.full_name}</option>`
  ).join('');
}

// Entry point for the ✏️ icon on a schedule card. A recurring class occurrence has two
// meaningfully different, easy-to-confuse actions behind it: cancel just the date being
// viewed, or edit the pattern that governs every future week. Rather than dropping straight
// into the edit form (whose "Guardar cambios" silently applies to the whole series — see
// guardarClase()'s EDIT MODE branch), ask explicitly first. Non-recurring (puntual) classes
// have no such ambiguity — a single occurrence IS the whole class — so they skip straight to
// the form as before.
let _pendingEditClaseArgs = null;

function abrirEditarClaseIntent(classId, nombre, fechaOcurrencia, hora, capacidad, instructorId, isRecurring, dayOfWeekArr, precioCop, scheduleId) {
  if (!classId || !isRecurring) {
    abrirEditarClase(classId, nombre, fechaOcurrencia, hora, capacidad, instructorId, isRecurring, dayOfWeekArr, precioCop, scheduleId);
    return;
  }
  _pendingEditClaseArgs = [classId, nombre, fechaOcurrencia, hora, capacidad, instructorId, isRecurring, dayOfWeekArr, precioCop, scheduleId];
  const nombreEl = document.getElementById('clase-accion-nombre');
  if (nombreEl) nombreEl.textContent = nombre || 'esta clase';
  const fechaEl = document.getElementById('clase-accion-fecha');
  if (fechaEl) fechaEl.textContent = fechaOcurrencia || '';
  openModal('clase-accion');
}

function _claseAccionCancelarFecha() {
  if (!_pendingEditClaseArgs) return;
  const [, , fechaOcurrencia, , , , , , , scheduleId] = _pendingEditClaseArgs;
  closeModal('modal-clase-accion');
  _pendingEditClaseArgs = null;
  cancelarOcurrencia(scheduleId, fechaOcurrencia);
}

function _claseAccionEditarSerie() {
  if (!_pendingEditClaseArgs) return;
  const args = _pendingEditClaseArgs;
  closeModal('modal-clase-accion');
  _pendingEditClaseArgs = null;
  abrirEditarClase(...args);
}

async function abrirEditarClase(classId, nombre, fechaOcurrencia, hora, capacidad, instructorId, isRecurring, dayOfWeekArr, precioCop, scheduleId) {
  const tit = document.getElementById('modal-clase-titulo');
  if (tit) tit.textContent = !classId ? 'NUEVA CLASE' : (isRecurring ? 'EDITAR SERIE COMPLETA' : 'EDITAR CLASE');

  // Show Eliminar only in edit mode; hide in create mode (class doesn't exist yet)
  const eliminarBtn = document.querySelector('#modal-editar-clase .btn-danger');
  if (eliminarBtn) eliminarBtn.style.display = classId ? '' : 'none';
  const guardarBtn = document.querySelector('#modal-editar-clase .btn-primary');
  if (guardarBtn) guardarBtn.textContent = classId ? 'Guardar cambios' : 'Crear clase';

  // Reinforce scope when arriving via "Editar la serie completa" — Guardar cambios here
  // applies to every future occurrence, not just the date this modal happened to open from.
  const serieNotice = document.getElementById('clase-serie-notice');
  if (serieNotice) serieNotice.style.display = (classId && isRecurring) ? '' : 'none';

  const idEl = document.getElementById('edit-clase-id');
  if (idEl) idEl.value = classId || '';

  // "Cancelar solo esta fecha" — scoped to the exact occurrence this modal was opened from
  // (the schedule row's own id), calling cancelarOcurrencia() directly instead of routing
  // an admin who wants to cancel just today's class toward the whole-series "Eliminar"
  // button below. Only offered when we actually have a specific occurrence to scope to.
  const cancelarFechaBtn = document.getElementById('btn-cancelar-esta-fecha');
  if (cancelarFechaBtn) {
    if (classId && scheduleId && fechaOcurrencia) {
      cancelarFechaBtn.style.display = '';
      cancelarFechaBtn.onclick = () => { closeModal('modal-editar-clase'); cancelarOcurrencia(scheduleId, fechaOcurrencia); };
    } else {
      cancelarFechaBtn.style.display = 'none';
      cancelarFechaBtn.onclick = null;
    }
  }

  // Lazy-load class types if not yet fetched (fallback in case preload hasn't resolved)
  if (!_classTypes.length) {
    try {
      const { data } = await db.from('class_types').select('id, name').eq('is_active', true).order('name');
      _classTypes = data || [];
    } catch (e) { console.error('[Thor] class types:', e); }
  }
  // Fix 1: text input with datalist — set value directly and refresh datalist options
  buildClassTypeDatalist();
  const sNombre = document.getElementById('edit-clase-nombre');
  // Strip historical time suffix before showing (old classes stored "PILATES 8:00 A.M." in name field)
  if (sNombre) sNombre.value = nombre ? nombre.replace(/\s+\d{1,2}:\d{2}\s*[AP]\.?M\.?$/i, '').trim() : '';

  // Populate multi-day checkboxes from classes.day_of_week (integer[])
  const dows = Array.isArray(dayOfWeekArr)
    ? dayOfWeekArr.map(d => parseInt(d, 10))
    : (classId ? [] : []);
  document.querySelectorAll('.edit-dia-cb').forEach(cb => {
    cb.checked = dows.includes(parseInt(cb.value, 10));
  });

  const sFecha = document.getElementById('edit-clase-fecha-unica');
  if (sFecha) sFecha.value = fechaOcurrencia || '';

  // hora arrives as DB value "HH:MM" — matches the native time input directly
  const sHora = document.getElementById('edit-clase-hora');
  if (sHora) sHora.value = hora || '';

  const sCap = document.getElementById('edit-clase-capacidad');
  if (sCap) sCap.value = capacidad || '';

  const sPrecio = document.getElementById('edit-clase-precio');
  if (sPrecio) sPrecio.value = precioCop || '';

  const togAct = document.getElementById('toggle-clase-activa');
  if (togAct) { togAct.checked = true; toggleClaseActiva(); }

  const togRec = document.getElementById('toggle-clase-recurrente');
  if (togRec) { togRec.checked = isRecurring !== false; toggleClaseRecurrente(); }

  // Instructor dropdown — re-fetch on every open to stay fresh
  const instrSel = document.getElementById('edit-clase-instructor');
  if (instrSel) {
    instrSel.innerHTML = '<option value="">Cargando...</option>';
    try {
      const { data } = await db.from('users')
        .select('id, full_name')
        .eq('role', 'instructor')
        .eq('is_active', true)
        .order('full_name');
      _clasesInstructorCache = data || [];
    } catch (e) { console.error('[Thor] instructor list:', e); }
    instrSel.innerHTML = buildInstructorOptions(instructorId);
  }

  openModal('editar-clase');
}

function toggleClaseActiva() {
  const checked = document.getElementById('toggle-clase-activa')?.checked;
  const lbl = document.getElementById('clase-activa-label');
  if (lbl) lbl.textContent = checked ? 'Clase activa · visible en el horario' : 'Clase inactiva · oculta del horario';
}

function toggleClaseRecurrente() {
  const checked = document.getElementById('toggle-clase-recurrente')?.checked;
  const lbl = document.getElementById('clase-recurrente-label');
  if (lbl) lbl.textContent = checked
    ? 'Se genera automáticamente cada semana'
    : 'Puntual — se agenda solo para la fecha elegida';
  const diasWrap  = document.getElementById('edit-clase-dias-wrap');
  const fechaWrap = document.getElementById('edit-clase-fecha-wrap');
  if (diasWrap)  diasWrap.style.display  = checked ? '' : 'none';
  if (fechaWrap) fechaWrap.style.display = checked ? 'none' : '';
}

// Convert display hour ("5 AM") back to DB format ("05:00")
function _hourToDb(disp) {
  if (!disp) return null;
  const m = String(disp).trim().match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (!m) return disp; // already HH:MM or unknown format
  let h = parseInt(m[1]);
  if (m[2].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[2].toUpperCase() === 'AM' && h === 12)  h  = 0;
  return `${String(h).padStart(2, '0')}:00`;
}

// Phase 3: recompute spots_available for all future schedule rows of a class
// after its template capacity changes. spots_available = new_capacity - confirmed_bookings.
async function _reconcileFutureSlots(classId, newCapacity) {
  const today = _bogotaToday();
  const { data: slots, error: sErr } = await db
    .from('schedule')
    .select('id')
    .eq('class_id', classId)
    .gte('class_date', today)
    .eq('is_cancelled', false);
  if (sErr || !slots?.length) return;

  const slotIds = slots.map(s => s.id);
  const { data: bookings } = await db
    .from('bookings')
    .select('schedule_id')
    .in('schedule_id', slotIds)
    .eq('status', 'confirmed');

  const bookingCount = {};
  (bookings || []).forEach(b => {
    bookingCount[b.schedule_id] = (bookingCount[b.schedule_id] || 0) + 1;
  });

  const updates = slotIds.map(id =>
    db.from('schedule')
      .update({ spots_available: Math.max(0, newCapacity - (bookingCount[id] || 0)) })
      .eq('id', id)
  );
  await Promise.all(updates);
}

async function guardarClase() {
  const classId      = document.getElementById('edit-clase-id')?.value?.trim();
  const nombre       = (document.getElementById('edit-clase-nombre')?.value || '').trim();
  const horaDisp     = document.getElementById('edit-clase-hora')?.value;
  const capacidad    = parseInt(document.getElementById('edit-clase-capacidad')?.value) || null;
  const precioCop    = parseInt(document.getElementById('edit-clase-precio')?.value) || null;
  const instructorId = document.getElementById('edit-clase-instructor')?.value || null;
  const isRecurring  = document.getElementById('toggle-clase-recurrente')?.checked ?? true;
  const dayOfWeek    = Array.from(document.querySelectorAll('.edit-dia-cb:checked')).map(cb => parseInt(cb.value, 10));
  const fechaUnica   = document.getElementById('edit-clase-fecha-unica')?.value?.trim();

  // classId is intentionally empty in create mode — do NOT guard on it here
  if (!nombre)  { toast('Nombre requerido', 'Escribe o selecciona el tipo de clase'); return; }
  if (!horaDisp) { toast('Hora requerida', 'Indica la hora de la clase'); return; }
  if (isRecurring && dayOfWeek.length === 0) { toast('Días requeridos', 'Selecciona al menos un día de la semana'); return; }
  if (!isRecurring && !fechaUnica) { toast('Fecha requerida', 'Indica la fecha exacta de la clase'); return; }
  // The gym is closed Sundays. The recurring day checkboxes no longer offer "Dom" (removed
  // 2026-07-10 — it produced schedule rows that saved silently but never rendered, since the
  // Gestión Horarios grid/query only ever cover Monday–Saturday), but the puntual "Fecha
  // exacta" date input has no way to exclude a day-of-week, so it still needs this guard.
  if (!isRecurring && fechaUnica && new Date(fechaUnica + 'T12:00:00').getDay() === 0) {
    toast('Domingo no disponible', 'El gimnasio permanece cerrado los domingos — elige otra fecha');
    return;
  }

  const dow = isRecurring ? dayOfWeek : [new Date(fechaUnica + 'T12:00:00').getDay()];

  // Auto-insert new class type into class_types so it appears in future datalists
  const alreadyExists = _classTypes.some(t => t.name.toLowerCase() === nombre.toLowerCase());
  if (!alreadyExists) {
    const { data: newType } = await db.from('class_types').insert({ name: nombre, is_active: true }).select('id, name').single();
    if (newType) _classTypes.push(newType);
  }

  const btn = document.querySelector('#modal-editar-clase .btn-primary');
  if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }

  try {
    if (!classId) {
      // ── CREATE MODE ──────────────────────────────────────────
      const { data: newClass, error } = await db.from('classes').insert({
        name:          nombre,
        type:          nombre,   // NOT NULL — drives CSS class detection (sch-pilates, sch-riding, sch-func)
        start_time:    _hourToDb(horaDisp),
        capacity:      capacidad,
        day_of_week:   dow,
        instructor_id: instructorId,
        is_recurring:  isRecurring,
        price_cop:     precioCop,
      }).select('id').single();
      if (error) throw error;

      const dbTime = _hourToDb(horaDisp);
      // classes and schedule are two separate inserts with no DB transaction tying them
      // together, so a failure in the second one must not leave the first stranded. Wrap the
      // schedule insert(s) and, on failure, delete the classes row we just created before
      // re-throwing — the outer catch still shows the same error toast either way.
      try {
        if (isRecurring) {
          // Generate 4 weeks of schedule slots for the new class inline
          // (mirrors generateWeeklySchedule but scoped to this one class)
          if (dow.length && capacidad) {
            const mondayStr = _getMonday();
            const startMs   = new Date(mondayStr + 'T12:00:00').getTime();
            const slots     = [];
            for (const d of dow) {
              for (let w = 0; w < 4; w++) {
                const offset  = d === 0 ? 6 : d - 1;
                const dateStr = new Date(startMs + w * 7 * 86400000 + offset * 86400000).toISOString().split('T')[0];
                slots.push({ class_id: newClass.id, class_date: dateStr, start_time: dbTime, spots_available: capacidad, is_cancelled: false });
              }
            }
            // Was previously fire-and-forget (result discarded) — a rejected insert (bad date,
            // constraint, RLS, anything) left `classes` created with zero schedule rows and no
            // error shown anywhere: "Clase creada" toast, then the class never appears in the
            // grid. Checking the error here surfaces that failure instead of swallowing it.
            if (slots.length) {
              const { error: schErr } = await db.from('schedule').insert(slots);
              if (schErr) throw schErr;
            }
          }
        } else if (capacidad) {
          // Puntual — una sola ocurrencia en la fecha exacta elegida
          const { error: schErr } = await db.from('schedule').insert({
            class_id: newClass.id, class_date: fechaUnica, start_time: dbTime,
            spots_available: capacidad, is_cancelled: false,
          });
          if (schErr) throw schErr;
        }
      } catch (schedErr) {
        const { error: rollbackErr } = await db.from('classes').delete().eq('id', newClass.id);
        if (rollbackErr) {
          // Rollback itself failed — surface both so the orphan can be cleaned up manually
          // instead of silently leaving a template with zero schedule rows behind.
          console.error('[Thor] orphaned class row — rollback failed:', newClass.id, rollbackErr.message);
        }
        throw schedErr;
      }

      // Notify the assigned instructor — fire-and-forget so it never blocks the success flow
      if (instructorId) {
        const cuando = isRecurring ? 'cada semana' : `el ${fechaUnica}`;
        db.from('notifications').insert({
          user_id: instructorId,
          title:   'Nueva clase asignada',
          body:    `Se te ha asignado "${nombre}" ${cuando} a las ${_fmtHour(dbTime)}`,
        }).then(({ error: ne }) => { if (ne) console.warn('Notif. instructor:', ne.message); });
      }

      closeModal('modal-editar-clase');
      toast('Clase creada', nombre + ' aparece en el horario');
      localStorage.removeItem('thor_sched_gen_date');
      await loadAdminHorariosPage();
    } else {
      // ── EDIT MODE ────────────────────────────────────────────
      const newDbTime = _hourToDb(horaDisp);
      const { error } = await db.from('classes').update({
        name:          nombre,
        start_time:    newDbTime,
        capacity:      capacidad,
        day_of_week:   dow,
        instructor_id: instructorId,
        is_recurring:  isRecurring,
        price_cop:     precioCop,
      }).eq('id', classId);
      if (error) throw error;

      // Changing the recurring day/time pattern leaves the OLD-pattern future `schedule`
      // rows behind — remove future, unbooked, non-exception rows that no longer match the
      // new pattern; the regeneration below (thor_sched_gen_date cleared → generateWeeklySchedule)
      // fills in the correct new-pattern rows. See _reconcileStaleScheduleRows() — the same
      // cleanup also runs unconditionally inside generateWeeklySchedule() (and its SQL/cron
      // mirror, generate_weekly_schedule()) now, so a pattern change self-heals on the next
      // daily generation even for classes nobody manually re-saves.
      if (isRecurring) await _reconcileStaleScheduleRows(classId, dow, newDbTime);

      // Reconcile future schedule rows so spots_available reflects the new capacity
      if (capacidad) await _reconcileFutureSlots(classId, capacidad);
      // Reconcile future (not-yet-occurred) class_occurrences rows to match the edited
      // template — past/completed occurrences are never touched (enforced independently by
      // that table's own RLS UPDATE policy, not just this filter).
      await _reconcileFutureClassOccurrences(classId);

      closeModal('modal-editar-clase');
      toast('Clase actualizada', 'Los cambios se reflejan en el horario');
      localStorage.removeItem('thor_sched_gen_date');
      await loadAdminHorariosPage();
    }
  } catch (err) {
    toast('Error al guardar', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = classId ? 'Guardar cambios' : 'Crear clase'; btn.disabled = false; }
  }
}

// Propagates an edited class template (instructor, time, capacity, price, name, type) onto
// future class_occurrences rows only. occurrence_date < today or status = 'completed' rows are
// left untouched — the latter is also structurally enforced by class_occurrences' own RLS
// UPDATE policy, so this filter is belt-and-suspenders, not the only guard.
async function _reconcileFutureClassOccurrences(classId) {
  const today = _bogotaToday();
  const { data: cls } = await db.from('classes')
    .select('name, type, instructor_id, capacity, duration_min, price_cop, start_time, users(full_name)')
    .eq('id', classId)
    .single();
  if (!cls) return;

  await db.from('class_occurrences')
    .update({
      class_name:        cls.name,
      class_type:        cls.type,
      instructor_id:     cls.instructor_id,
      instructor_name:   cls.users?.full_name || null,
      capacity_at_time:  cls.capacity,
      duration_min:      cls.duration_min,
      price_cop_at_time: cls.price_cop,
      start_time:        cls.start_time,
    })
    .eq('class_id', classId)
    .gte('occurrence_date', today)
    .neq('status', 'completed');
}

// Ends a recurring class's series completely: removes every future occurrence (not just the
// date whatever caller happened to be looking at) and deactivates the template so
// generateWeeklySchedule() stops regenerating it. Shared by the "Editar serie completa →
// Eliminar" button and the "Eliminar definitivamente" option in the grid/summary-table
// delete-choice modal (see confirmarEliminarClaseModal()).
//
// Booking-safety note: confirmed live (2026-08-26, pg_constraint.confdeltype) that BOTH
// bookings.schedule_id and attendance.schedule_id are ON DELETE CASCADE against schedule(id)
// — hard-deleting a schedule row silently destroys any booking/attendance row pointing at it,
// no FK error, no trace. (class_occurrences.schedule_id is ON DELETE SET NULL — safe either
// way, already handled below by nulling its status first.) So future rows that still have a
// confirmed booking OR a recorded attendance are soft-cancelled instead (same effect as
// "Cancelar esta fecha") and left in place; only rows with neither are hard-deleted. Members
// are NOT auto-notified — no notification channel is wired up for this — so if that's needed,
// it's a manual follow-up (e.g. WhatsApp) for whoever runs the deletion.
async function eliminarClaseDefinitivamente(classId, clsName) {
  if (!classId) { toast('Error', 'No se encontró el ID de la clase'); return false; }
  const nombre = clsName || 'esta clase';

  const typed = prompt(`Esto elimina TODAS las semanas futuras de "${nombre}" (clase recurrente completa), no solo la fecha que estás viendo.\n\nPara cancelar únicamente una fecha puntual, usa "Eliminar solo esta semana" en su lugar.\n\nSi realmente quieres eliminar la clase recurrente completa, escribe el nombre exacto para confirmar:`);
  if (typed === null) return false;
  if (typed.trim().toLowerCase() !== nombre.toLowerCase()) {
    toast('No coincide', 'El nombre escrito no coincide — no se eliminó nada');
    return false;
  }

  try {
    const today = _bogotaToday();
    // Only future/today occurrences are removed — past rows are preserved for nómina and
    // are also blocked at the database level (prevent_past_schedule_delete trigger), so this
    // filter is the fast path, not the only guard.
    const { data: futureSlots } = await db.from('schedule')
      .select('id')
      .eq('class_id', classId)
      .gte('class_date', today);

    if (futureSlots?.length) {
      const ids = futureSlots.map(s => s.id);
      const [{ data: activeBookings }, { data: attendanceRows }] = await Promise.all([
        db.from('bookings').select('schedule_id').in('schedule_id', ids).eq('status', 'confirmed'),
        db.from('attendance').select('schedule_id').in('schedule_id', ids),
      ]);
      const protectedIds = new Set([
        ...(activeBookings || []).map(b => b.schedule_id),
        ...(attendanceRows || []).map(a => a.schedule_id),
      ]);
      const freeIds = ids.filter(id => !protectedIds.has(id));

      await db.from('class_occurrences').update({ status: 'cancelled' }).in('schedule_id', ids);
      if (protectedIds.size) {
        await db.from('schedule').update({ is_cancelled: true, is_exception: true }).in('id', [...protectedIds]);
      }
      if (freeIds.length) {
        await db.from('schedule').delete().in('id', freeIds);
      }
    }

    // Soft-delete the template — never hard-deleted, so class_occurrences.class_id and its
    // denormalized name/instructor snapshot stay meaningful for past history indefinitely.
    const { error } = await db.from('classes')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('id', classId);
    if (error) throw error;

    toast('Clase eliminada', 'La clase fue removida del horario');
    localStorage.removeItem('thor_sched_gen_date');
    await loadAdminHorariosPage();
    return true;
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
    return false;
  }
}

async function eliminarClase() {
  const classId = document.getElementById('edit-clase-id')?.value?.trim();
  const clsName = (document.getElementById('edit-clase-nombre')?.value || 'esta clase').trim();
  const btn = document.querySelector('#modal-editar-clase .btn-danger');
  if (btn) { btn.textContent = 'Eliminando…'; btn.disabled = true; }

  const ok = await eliminarClaseDefinitivamente(classId, clsName);
  if (ok) {
    closeModal('modal-editar-clase');
  } else if (btn) {
    btn.textContent = 'Eliminar clase recurrente completa';
    btn.disabled = false;
  }
}

// ===================== LOADER HELPERS =====================

function _loader(label) {
  const span = label ? `<span>${label}</span>` : '';
  return `<div class="thor-loader"><img src="img/preloader.gif" alt="">${span}</div>`;
}
function _loaderRow(cols) {
  return `<tr><td colspan="${cols}" class="thor-loader-cell"><img src="img/preloader.gif" alt=""></td></tr>`;
}

// ===================== SCHEDULE UTILITIES =====================

function _fmtHour(t) {
  const [h, m] = (t || '00:00').split(':').map(Number);
  const p  = h >= 12 ? 'PM' : 'AM';
  const dh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return m > 0 ? `${dh}:${String(m).padStart(2,'0')} ${p}` : `${dh} ${p}`;
}

function _schCssClass(cls) {
  const t = ((cls?.type || cls?.name) || '').toLowerCase();
  if (t.includes('pilates')) return 'sch-pilates';
  if (t.includes('riding') || t.includes('cycling')) return 'sch-riding';
  return 'sch-func';
}

function _shortClassName(cls) {
  // Falls back to type when name is blank — legacy data (pre-2026-06-30 BUG4 fix) can have
  // classes.name empty while classes.type holds the real class name; without this fallback
  // the schedule grid renders a blank, unidentifiable card for those rows.
  const n = (cls?.name && cls.name.trim()) || cls?.type || '';
  if (n.toLowerCase().includes('funcional')) return 'Func.';
  if (n.toLowerCase().includes('pilates'))   return 'Pilates';
  if (n.toLowerCase().includes('cycling') || n.toLowerCase().includes('riding'))    return 'Cycling';
  return n.length > 7 ? n.substring(0, 6) + '.' : n;
}

function _classBadgeColor(cls) {
  const t = ((cls?.type || cls?.name) || '').toLowerCase();
  if (t.includes('pilates')) return 'badge-purple';
  if (t.includes('riding') || t.includes('cycling')) return 'badge-orange';
  return 'badge-cyan';
}

function _classBarStyle(cls) {
  const t = ((cls?.type || cls?.name) || '').toLowerCase();
  if (t.includes('pilates')) return { bar: 'var(--purple)', fill: 'purple', card: '' };
  if (t.includes('riding') || t.includes('cycling')) return { bar: 'var(--orange)', fill: 'orange', card: '' };
  const c = cls?.color || 'var(--cyan)';
  return { bar: c, fill: '', card: ' card-cyan' };
}

function _jsDowToLabel(dow) {
  // JS day: 0=Sun,1=Mon,...,6=Sat → display label
  return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][dow] || '?';
}

function _formatDayPattern(dowSet) {
  const sorted = [...dowSet].sort((a, b) => a - b);
  if (sorted.join() === '1,2,3,4,5') return 'Lun – Vie';
  if (sorted.join() === '1,2,3,4,5,6') return 'Lun – Sáb';
  return sorted.map(_jsDowToLabel).join(' / ');
}

// Infer recurring (dow, start_time) slots for each class from all existing schedule rows.
// Logs inferred patterns and attempts to persist day_of_week/start_time onto classes
// (silently skips if those columns don't exist yet).
// Returns: { classId: { cls, slots: [{dow, time}] } }
async function backfillClassPatterns() {
  const { data: rows, error } = await db
    .from('schedule')
    .select('class_id, class_date, start_time, classes(id, name, type, color, capacity, duration_min)')
    .order('class_date');

  if (error || !rows || rows.length === 0) return {};

  const byClass = {};
  rows.forEach(r => {
    if (!r.class_id || !r.class_date || !r.start_time) return;
    const dow = new Date(r.class_date + 'T12:00:00').getDay();
    if (!byClass[r.class_id]) byClass[r.class_id] = { cls: r.classes || {}, slots: [] };
    const exists = byClass[r.class_id].slots.some(s => s.dow === dow && s.time === r.start_time);
    if (!exists) byClass[r.class_id].slots.push({ dow, time: r.start_time });
  });

  console.group('Thor Training · Inferred class patterns from schedule');
  for (const [classId, info] of Object.entries(byClass)) {
    const days  = [...new Set(info.slots.map(s => s.dow))].sort((a, b) => a - b);
    const times = [...new Set(info.slots.map(s => s.time))].sort();
    console.log(`${info.cls?.name || classId}: days=[${days.map(_jsDowToLabel).join(',')}] times=[${times.join(',')}]`);
    // Attempt to persist — silently fails if columns don't exist
    const { error: upErr } = await db.from('classes').update({ day_of_week: days, start_time: times[0] }).eq('id', classId);
    if (upErr) console.warn(`  → could not persist day_of_week/start_time: ${upErr.message}`);
  }
  console.groupEnd();

  return byClass;
}

// Removes future, unbooked, non-exception `schedule` rows for classId that no longer match
// (dow, dbTime). Shared by guardarClase()'s edit branch and generateWeeklySchedule() — the
// latter call is what makes this self-healing on a daily cadence (via the auto-run below and
// its SQL/cron mirror generate_weekly_schedule()) instead of only firing when an admin
// happens to manually re-save the exact class whose pattern is wrong. Rows with an active
// booking, or a manual per-date exception, are never touched.
async function _reconcileStaleScheduleRows(classId, dow, dbTime) {
  const todayForClean = _bogotaToday();
  const { data: staleCandidates } = await db.from('schedule')
    .select('id, class_date, start_time, is_exception')
    .eq('class_id', classId)
    .gte('class_date', todayForClean);
  const stale = (staleCandidates || []).filter(s => {
    if (s.is_exception) return false;
    const rowDow = new Date(s.class_date + 'T12:00:00').getDay();
    return !dow.includes(rowDow) || s.start_time !== dbTime;
  });
  if (!stale.length) return;

  const { data: existingBookings } = await db.from('bookings')
    .select('schedule_id')
    .in('schedule_id', stale.map(s => s.id))
    .neq('status', 'cancelled');
  const bookedIds     = new Set((existingBookings || []).map(b => b.schedule_id));
  const removableIds  = stale.filter(s => !bookedIds.has(s.id)).map(s => s.id);
  if (removableIds.length) {
    await db.from('class_occurrences').update({ status: 'cancelled' }).in('schedule_id', removableIds);
    await db.from('schedule').delete().in('id', removableIds);
  }
}

// Removes future, unbooked, non-exception `schedule` rows belonging to any is_active=false
// class — same guard rails as _reconcileStaleScheduleRows (never touches booked or past
// rows), but for classes that were deactivated entirely rather than ones whose pattern just
// changed. Added 2026-08-25 alongside the is_active fix in generateWeeklySchedule() above.
async function _cleanupInactiveClassSchedule() {
  const { data: inactiveClasses, error } = await db.from('classes').select('id').eq('is_active', false);
  if (error || !inactiveClasses?.length) return;

  const todayForClean = _bogotaToday();
  const ids = inactiveClasses.map(c => c.id);
  const { data: futureRows } = await db.from('schedule')
    .select('id, is_exception')
    .in('class_id', ids)
    .gte('class_date', todayForClean);
  const candidates = (futureRows || []).filter(s => !s.is_exception);
  if (!candidates.length) return;

  const { data: existingBookings } = await db.from('bookings')
    .select('schedule_id')
    .in('schedule_id', candidates.map(s => s.id))
    .neq('status', 'cancelled');
  const bookedIds    = new Set((existingBookings || []).map(b => b.schedule_id));
  const removableIds = candidates.filter(s => !bookedIds.has(s.id)).map(s => s.id);
  if (!removableIds.length) return;

  await db.from('class_occurrences').update({ status: 'cancelled' }).in('schedule_id', removableIds);
  await db.from('schedule').delete().in('id', removableIds);
}

// Generate schedule rows for weeksAhead weeks starting from the current Monday.
// Reads day_of_week and start_time directly from the classes table — no backfill needed.
// Idempotent: skips rows that already exist in the database.
async function generateWeeklySchedule(weeksAhead = 4) {
  // Only auto-generate entries for recurring, ACTIVE classes. Fallback to no is_active filter
  // if that column doesn't exist yet (matches the pre-existing is_recurring fallback below).
  // Bug fixed 2026-08-25: this used to only check is_recurring, never is_active — so a class
  // "eliminada" via eliminarClase() (which only sets is_active=false, never is_recurring)
  // kept silently regenerating future schedule rows forever, both here and in this function's
  // SQL/cron mirror generate_weekly_schedule() (see 20260825_generate_weekly_schedule_
  // respect_is_active.sql for that side of the same fix). Confirmed live: 4 already-inactive
  // Pilates/Step rows from an earlier cleanup attempt each still had future rows dated weeks out.
  let { data: classes, error: clsErr } = await db
    .from('classes')
    .select('id, name, capacity, day_of_week, start_time, is_recurring')
    .eq('is_recurring', true)
    .eq('is_active', true);

  if (clsErr?.message?.includes('is_active') || clsErr?.message?.includes('is_recurring')) {
    ({ data: classes, error: clsErr } = await db
      .from('classes')
      .select('id, name, capacity, day_of_week, start_time'));
  }

  if (clsErr || !classes || classes.length === 0) {
    console.warn('Thor Training · generateWeeklySchedule: no classes found', clsErr?.message);
    return;
  }

  // Reconcile every recurring class's future rows against its current pattern before
  // generating — this is what makes pattern drift self-heal on this function's normal daily
  // cadence instead of only when an admin happens to re-save that one class.
  for (const cls of classes) {
    const days = (cls.day_of_week || []).map(d => parseInt(d, 10)).filter(d => !isNaN(d));
    if (days.length && cls.start_time) {
      await _reconcileStaleScheduleRows(cls.id, days, cls.start_time);
    }
  }

  // A class that's now inactive (not in `classes` above at all, since it was just excluded
  // by the is_active filter) needs its own future, unbooked rows swept away too — otherwise
  // they just sit there forever instead of being cleaned up, same gap as pattern-drift
  // reconcile above but for "deactivated" rather than "pattern changed". Mirrors Pass 1b of
  // generate_weekly_schedule() in Postgres.
  await _cleanupInactiveClassSchedule();

  const mondayStr = _getMonday();
  const startMs   = new Date(mondayStr + 'T12:00:00').getTime();
  const endDate   = new Date(startMs + weeksAhead * 7 * 86400000);
  const endStr    = endDate.toISOString().split('T')[0];

  const { data: existing } = await db
    .from('schedule')
    .select('class_id, class_date, start_time')
    .gte('class_date', mondayStr)
    .lte('class_date', endStr);

  const seen = new Set((existing || []).map(r => `${r.class_id}|${r.class_date}|${r.start_time}`));

  const toInsert = [];
  for (const cls of classes) {
    const days = (cls.day_of_week || []).map(d => parseInt(d, 10)).filter(d => !isNaN(d));
    const time = cls.start_time;
    if (!time || days.length === 0) continue;

    const capacity = cls.capacity || 15;
    for (const dow of days) {
      for (let w = 0; w < weeksAhead; w++) {
        const weekMonMs = startMs + w * 7 * 86400000;
        // JS getDay(): Sun=0, Mon=1…Sat=6 → offset from Monday
        const offset  = dow === 0 ? 6 : dow - 1;
        const dateStr = new Date(weekMonMs + offset * 86400000).toISOString().split('T')[0];
        const key     = `${cls.id}|${dateStr}|${time}`;
        if (!seen.has(key)) {
          toInsert.push({ class_id: cls.id, class_date: dateStr, start_time: time, spots_available: capacity, is_cancelled: false });
          seen.add(key);
        }
      }
    }
  }

  if (toInsert.length === 0) {
    console.log('Thor Training · Schedule already up to date');
    return;
  }
  console.log(`Thor Training · Inserting ${toInsert.length} schedule rows`);
  const { error: insErr } = await db.from('schedule').insert(toInsert);
  if (insErr) console.error('generateWeeklySchedule insert error:', insErr.message);
  else console.log(`Thor Training · Schedule generation complete (${toInsert.length} rows added)`);
}

// Opens the class-slot detail modal and loads bookings + attendance for that schedule row.
async function openClaseDetalle(scheduleId, clsName, dispTime) {
  const modal     = document.getElementById('modal-clase-detalle');
  const titleEl   = document.getElementById('clase-detalle-title');
  const contentEl = document.getElementById('clase-detalle-content');
  if (!modal) return;

  if (titleEl) titleEl.textContent = `${(clsName || '').toUpperCase()} · ${dispTime}`;
  if (contentEl) contentEl.innerHTML = _loader();
  modal.classList.add('open');

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'reception';

  try {
    // No email/phone in these selects — instructors (including PS) reach this modal via
    // Gestión Horarios, and nothing here gates by role/contract_type. Only what's actually
    // rendered (name) should ever be in the response.
    const [schedRes, bookRes, attRes] = await Promise.all([
      db.from('schedule').select('class_date, start_time, classes(capacity, instructor_id)').eq('id', scheduleId).single(),
      db.from('bookings').select('id, status, users!user_id(id, full_name)').eq('schedule_id', scheduleId).neq('status', 'cancelled'),
      db.from('attendance').select('checked_in_at, users(id, full_name)').eq('schedule_id', scheduleId).order('checked_in_at')
    ]);

    const slot = schedRes.data;
    let instructorName = '';
    if (slot?.classes?.instructor_id) {
      const { data: instr } = await db.from('users').select('full_name').eq('id', slot.classes.instructor_id).single();
      instructorName = instr?.full_name || '';
    }

    const booked   = bookRes.data || [];
    const attended = attRes.data  || [];
    const checkedIds = new Set(attended.map(a => a.users?.id).filter(Boolean));

    // Merge into unified list
    const allUsers = {};
    booked.forEach(b => {
      const u = b.users;
      if (!u?.id) return;
      allUsers[u.id] = { name: u.full_name || '—', booked: true, attended: checkedIds.has(u.id), bookingId: b.id };
    });
    attended.forEach(a => {
      const u = a.users;
      if (!u?.id) return;
      if (!allUsers[u.id]) allUsers[u.id] = { name: u.full_name || '—', booked: false, attended: true, bookingId: null };
      allUsers[u.id].attended = true;
    });

    const rows         = Object.values(allUsers);
    const totalBooked  = rows.filter(r => r.booked).length;
    const totalAttended = rows.filter(r => r.attended).length;
    const attPct       = totalBooked > 0 ? Math.round(totalAttended / totalBooked * 100) : 0;
    const capacity     = slot?.classes?.capacity || 0;

    // Summary header: date, day of week, instructor, capacity. No payment-status field exists
    // at the booking/reservation level (payments are tied to memberships, not classes) — see
    // Phase 1 audit — so it is intentionally not shown here.
    const summaryHtml = `
      <div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:18px;font-size:12px;color:var(--muted);">
        ${slot?.class_date ? `<span>📅 ${_formatFullWeekday(slot.class_date)}</span>` : ''}
        ${instructorName   ? `<span>👤 ${_escHtml(instructorName)}</span>` : ''}
        ${capacity > 0     ? `<span>🎯 ${totalBooked}/${capacity} cupos</span>` : ''}
      </div>`;

    if (rows.length === 0) {
      contentEl.innerHTML = summaryHtml + '<div style="color:var(--muted);font-size:13px;text-align:center;padding:28px 0;">Sin reservas ni check-ins para esta clase.</div>';
      return;
    }

    contentEl.innerHTML = summaryHtml + `
      <div style="display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap;">
        <div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Reservas</div>
          <div class="stat-value" style="font-size:26px;">${totalBooked}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Check-ins</div>
          <div class="stat-value" style="font-size:26px;color:var(--green);">${totalAttended}</div>
        </div>
        <div class="stat-card" style="flex:1;min-width:100px;padding:12px 16px;">
          <div class="stat-label">Asistencia</div>
          <div class="stat-value" style="font-size:26px;">${attPct}%</div>
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>Miembro</th><th>Reserva</th><th>Check-in</th>${canManage ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${rows.map(r => {
            const initials = (r.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
            const safeName = (r.name || '').replace(/'/g, '');
            const safeCls  = (clsName || '').replace(/'/g, '');
            const cancelCell = canManage
              ? `<td>${r.bookingId ? `<span onclick="cancelarReservaAdmin('${r.bookingId}','${scheduleId}','${safeCls}','${dispTime}','${safeName}')" title="Cancelar reserva" style="cursor:pointer;color:var(--red);font-weight:700;">✕</span>` : ''}</td>`
              : '';
            return `<tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:28px;height:28px;font-size:11px;background:rgba(0,212,232,0.12);color:var(--cyan);font-family:'Outfit',sans-serif;font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>
                  ${_escHtml(r.name)}
                </div>
              </td>
              <td>${r.booked ? '<span class="badge badge-cyan">Sí</span>' : '<span class="badge badge-muted">Walk-in</span>'}</td>
              <td>${r.attended ? '<span class="badge badge-green">✓</span>' : '<span class="badge badge-muted">—</span>'}</td>
              ${cancelCell}
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    console.error('openClaseDetalle error:', err);
    if (contentEl) contentEl.innerHTML = '<div style="color:var(--amber);text-align:center;padding:28px 0;">Error al cargar la lista.</div>';
  }
}

// ===================== ADMIN CLASES =====================

async function loadAdminClasesPage() {
  const today    = new Date();
  const todayStr = _bogotaToday();
  const DIAS     = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  const MESES    = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  const subEl = document.getElementById('admin-clases-sub');
  if (subEl) subEl.textContent = `Reservas y capacidad · Hoy ${DIAS[today.getDay()]} ${today.getDate()} ${MESES[today.getMonth()]}`;

  const list = document.getElementById('admin-clases-list');
  if (!list) return;
  list.innerHTML = _loader();

  try {
    const schedRes = await db
      .from('schedule')
      .select('id, start_time, spots_available, classes(id, name, type, color, capacity, duration_min, instructor_id)')
      .eq('class_date', todayStr)
      .eq('is_cancelled', false)
      .order('start_time');

    const schedules = schedRes.data || [];
    if (schedules.length === 0) {
      list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px;text-align:center;">No hay clases programadas para hoy.</div>';
      return;
    }

    const ids = schedules.map(s => s.id);
    const [bookRes, attRes] = await Promise.all([
      db.from('bookings').select('schedule_id').eq('status', 'confirmed').in('schedule_id', ids),
      db.from('attendance').select('schedule_id').in('schedule_id', ids)
        .gte('checked_in_at', todayStr + 'T00:00:00')
        .lte('checked_in_at', todayStr + 'T23:59:59')
    ]);

    const bookingCount = {};
    (bookRes.data || []).forEach(b => { bookingCount[b.schedule_id] = (bookingCount[b.schedule_id] || 0) + 1; });
    const attendCount = {};
    (attRes.data || []).forEach(a => { attendCount[a.schedule_id] = (attendCount[a.schedule_id] || 0) + 1; });

    const nowMins = today.getHours() * 60 + today.getMinutes();

    list.innerHTML = schedules.map(s => {
      const cls      = s.classes || {};
      const capacity = cls.capacity    || 0;
      const duration = cls.duration_min || 60;
      const booked   = bookingCount[s.id] || 0;
      const attended = attendCount[s.id]  || 0;
      const free     = capacity - booked;
      const [h, m]   = (s.start_time || '00:00').split(':').map(Number);
      const startMins = h * 60 + m;
      const endMins   = startMins + duration;
      const pct       = capacity > 0 ? Math.round(booked / capacity * 100) : 0;
      const dispTime  = _fmtHour(s.start_time);
      const st        = _classBarStyle(cls);

      // safe name for use inside onclick string attribute
      const safeName = (cls.name || '').replace(/'/g, '');

      let statusBadge, actionBtns;
      if (nowMins >= endMins) {
        statusBadge = '<span class="badge badge-muted">Completado</span>';
        actionBtns  = `<button class="btn btn-ghost btn-sm" onclick="openClaseDetalle('${s.id}','${safeName}','${dispTime}')">Reporte</button>`;
      } else if (nowMins >= startMins) {
        statusBadge = '<span class="badge badge-green">En Curso</span>';
        actionBtns  = `<button class="btn btn-ghost btn-sm" onclick="openClaseDetalle('${s.id}','${safeName}','${dispTime}')">Asistencia</button>
          <button class="btn btn-outline btn-sm" onclick="openClaseDetalle('${s.id}','${safeName}','${dispTime}')">Reservas (${booked})</button>`;
      } else if (nowMins >= startMins - 30) {
        statusBadge = '<span class="badge badge-amber">Próximo</span>';
        const isRiding = ['cycling', 'riding'].some(k => (cls.type || cls.name || '').toLowerCase().includes(k));
        actionBtns = (isRiding
          ? `<button class="btn btn-ghost btn-sm" onclick="openClaseDetalle('${s.id}','${safeName}','${dispTime}')">Bicicletas</button>`
          : '')
          + `<button class="btn btn-outline btn-sm" onclick="openClaseDetalle('${s.id}','${safeName}','${dispTime}')">Reservas (${booked})</button>`;
      } else {
        statusBadge = '<span class="badge badge-muted">Programado</span>';
        actionBtns  = `<button class="btn btn-ghost btn-sm" onclick="openClaseDetalle('${s.id}','${safeName}','${dispTime}')">Reservas (${booked})</button>`;
      }

      let subInfo = `${dispTime} · ${booked} / ${capacity} inscritos`;
      if (free > 0 && nowMins < startMins) subInfo += ` · ${free} cupos libres`;

      return `<div class="card${st.card}" style="padding:18px 22px;cursor:pointer;" onclick="openClaseDetalle('${s.id}','${safeName}','${dispTime}')">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="width:4px;height:50px;background:${st.bar};border-radius:2px;box-shadow:0 0 10px ${st.bar}40;"></div>
            <div>
              <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:20px;letter-spacing:2px;color:${st.bar};">${cls.name || 'Clase'}</div>
              <div style="font-size:12px;color:var(--muted);">${subInfo}</div>
              <div class="progress-bar" style="width:min(180px,100%);max-width:100%;margin-top:6px;"><div class="progress-fill ${st.fill}" style="width:${pct}%;"></div></div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;" onclick="event.stopPropagation()">
            ${statusBadge}
            ${actionBtns}
          </div>
        </div>
      </div>`;
    }).join('');

  } catch (err) {
    console.error('loadAdminClasesPage error:', err);
    list.innerHTML = '<div style="color:var(--amber);font-size:13px;padding:20px;text-align:center;">Error al cargar clases del día.</div>';
  }
}

// ===================== ADMIN HORARIOS =====================

// How many weeks ahead generateWeeklySchedule() keeps populated (0 = this week) — navigation
// is clamped to this range since further weeks don't have schedule rows yet.
const HORARIOS_MAX_WEEK_OFFSET = 3;
let _horariosWeekOffset = 0;
// Bumped on every call to loadAdminHorariosPage() so an in-flight call whose fetches
// resolve after a newer one (e.g. clicking Anterior/Hoy/Siguiente again before the
// previous request finished) can detect it's stale and skip rendering — otherwise the
// slower, older response can land last and silently overwrite the correct newer week
// with the previous week's classes, even though the date label (set within that same
// newer call) already updated correctly.
let _horariosLoadToken = 0;

function cambiarSemanaHorarios(delta) {
  _horariosWeekOffset = delta === 0
    ? 0
    : Math.max(0, Math.min(HORARIOS_MAX_WEEK_OFFSET, _horariosWeekOffset + delta));
  loadAdminHorariosPage();
}

async function loadAdminHorariosPage() {
  const myToken = ++_horariosLoadToken;
  const isInstructor = currentUser?.role === 'instructor';
  // Task D: reception can now reach this page (view roster + book on behalf), but schedule
  // editing (create/edit/cancel/delete classes and slots) stays admin-only — narrower than
  // what reception was originally scoped for.
  const isFullAdmin  = currentUser?.role === 'admin';
  const editBtns = document.getElementById('horarios-edit-btns');
  if (editBtns) editBtns.style.display = isFullAdmin ? 'flex' : 'none';

  const grid  = document.getElementById('admin-horarios-grid');
  const tbody = document.getElementById('admin-horarios-tbody');
  if (grid)  grid.innerHTML  = `<div style="grid-column:1/-1">${_loader()}</div>`;
  if (tbody) tbody.innerHTML = _loaderRow(8);

  try {
    // Auto-generate schedule at most once per day to avoid feedback-loop growth.
    // Admin can force-regenerate with the "Regenerar" button.
    const _genKey   = 'thor_sched_gen_date';
    const _today    = _bogotaToday();
    if (localStorage.getItem(_genKey) !== _today) {
      await generateWeeklySchedule(4);
      localStorage.setItem(_genKey, _today);
    }

    const DIAS_H   = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
    const MESES_H  = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const todayH   = new Date();
    const todayStr = _bogotaToday();

    const monday   = _getMonday(_horariosWeekOffset);
    const satDate  = new Date(monday + 'T12:00:00');
    satDate.setDate(satDate.getDate() + 5);
    const saturday = satDate.toISOString().split('T')[0];
    const mondayMs = new Date(monday + 'T12:00:00').getTime();

    const subEl = document.getElementById('admin-clases-sub');
    if (subEl) {
      const weekLabel = _horariosWeekOffset === 0
        ? 'Semana actual'
        : `Semana del ${_formatDate(monday, { day: 'numeric', month: 'short' })}`;
      subEl.textContent = `Hoy ${DIAS_H[todayH.getDay()]} ${todayH.getDate()} ${MESES_H[todayH.getMonth()]} · ${weekLabel}`;
    }
    const prevBtn = document.getElementById('horarios-prev-week');
    const nextBtn = document.getElementById('horarios-next-week');
    if (prevBtn) prevBtn.disabled = _horariosWeekOffset <= 0;
    if (nextBtn) nextBtn.disabled = _horariosWeekOffset >= HORARIOS_MAX_WEEK_OFFSET;

    // Fetch schedule, attendance, and (for admin/reception) confirmed bookings in parallel
    // Note: cancelled occurrences are NOT filtered out here (unlike before) — the summary
    // table needs to see them to render a real Estado (Activa/Parcial/Cancelada) instead of
    // silently dropping a class whose only occurrence this week was cancelled.
    const [schRes, attRes, bookRes, instrRes] = await Promise.all([
      db.from('schedule')
        .select('id, class_date, start_time, spots_available, is_cancelled, classes(id, name, type, color, capacity, day_of_week, duration_min, instructor_id, is_recurring, price_cop)')
        .gte('class_date', monday)
        .lte('class_date', saturday)
        .order('start_time'),
      db.from('attendance')
        .select('schedule_id')
        .gte('checked_in_at', monday + 'T00:00:00')
        .lte('checked_in_at', saturday + 'T23:59:59'),
      isInstructor
        ? Promise.resolve({ data: [] })
        : db.from('bookings')
            .select('id, schedule_id, users!user_id(full_name), schedule!inner(class_date)')
            .eq('status', 'confirmed')
            .gte('schedule.class_date', monday)
            .lte('schedule.class_date', saturday),
      isInstructor
        ? Promise.resolve({ data: [] })
        : db.from('users').select('id, full_name').eq('role', 'instructor')
    ]);

    // A newer call (another week-nav click) started and will render instead — bail out
    // so this call's now-stale response can't overwrite it.
    if (myToken !== _horariosLoadToken) return;

    if (schRes.error) throw schRes.error;
    const instrNameById = {};
    (instrRes?.data || []).forEach(u => { instrNameById[u.id] = u.full_name; });
    // Instructors only see their own classes; admins see everything
    const weekSch = isInstructor && currentUser?.id
      ? (schRes.data || []).filter(s => s.classes?.instructor_id === currentUser.id)
      : (schRes.data || []);

    // attendance count per schedule slot (this week)
    const attBySlot = {};
    (attRes.data || []).forEach(a => { attBySlot[a.schedule_id] = (attBySlot[a.schedule_id] || 0) + 1; });

    // confirmed bookings per slot — id+name for the collapsible list (name for display,
    // id so each row can be individually cancelled), count for occupancy badge
    const bookingsBySlot    = {};
    const bookingCountBySlot = {};
    (bookRes?.data || []).forEach(b => {
      const sid  = b.schedule_id;
      const name = b.users?.full_name;
      if (!bookingsBySlot[sid]) bookingsBySlot[sid] = [];
      if (name) bookingsBySlot[sid].push({ id: b.id, name });
      bookingCountBySlot[sid] = (bookingCountBySlot[sid] || 0) + 1;
    });

    // Build grid: lookup[time][dayIdx] = [schedule rows]
    // Cancelled occurrences are excluded from the calendar grid (same as before, when the
    // query itself filtered them out) — they still appear in the summary table below.
    const timesSet = new Set();
    const lookup   = {};
    weekSch.filter(s => !s.is_cancelled).forEach(s => {
      const dayIdx = Math.round((new Date(s.class_date + 'T12:00:00').getTime() - mondayMs) / 86400000);
      if (dayIdx < 0 || dayIdx > 5) return;
      timesSet.add(s.start_time);
      if (!lookup[s.start_time])         lookup[s.start_time] = {};
      if (!lookup[s.start_time][dayIdx]) lookup[s.start_time][dayIdx] = [];
      lookup[s.start_time][dayIdx].push(s);
    });

    const DIAS        = ['LUN','MAR','MIÉ','JUE','VIE','SÁB'];
    const sortedTimes = [...timesSet].sort();

    // ---- Render grid ----
    if (grid) {
      let html = `<div class="sch-head"></div>${DIAS.map(d => `<div class="sch-head">${d}</div>`).join('')}`;
      if (sortedTimes.length === 0) {
        html += `<div style="grid-column:1/-1;color:var(--muted);font-size:12px;padding:16px;text-align:center;">Sin clases esta semana</div>`;
      } else {
        sortedTimes.forEach(time => {
          html += `<div class="sch-time">${_fmtHour(time)}</div>`;
          for (let d = 0; d < 6; d++) {
            const slots = lookup[time]?.[d] || [];
            if (slots.length === 0) {
              html += `<div class="sch-cell"></div>`;
            } else {
              const cells = slots.map(s => {
                // Phase 2: use template capacity (classes.capacity), never the decremented spots_available
                const capacity = s.classes?.capacity || 0;
                const clsId    = s.classes?.id            || '';
                const clsName  = ((s.classes?.name?.trim()) || s.classes?.type || '').replace(/'/g, '');
                const clsInstr = s.classes?.instructor_id  || '';
                const clsRec   = !!s.classes?.is_recurring;
                const clsDows  = JSON.stringify(s.classes?.day_of_week || []);
                const clsPrice = s.classes?.price_cop ?? 'null';

                if (isInstructor) {
                  return `<div class="sch-class ${_schCssClass(s.classes)}" style="position:relative;">${_shortClassName(s.classes)}</div>`;
                }

                // Admin / reception — show occupancy and collapsible booker list
                const booked  = bookingCountBySlot[s.id] || 0;
                const isFull  = capacity > 0 && booked >= capacity;
                const badge   = capacity > 0
                  ? (isFull
                      ? `<span style="padding:0 3px;border-radius:3px;font-size:8px;font-weight:800;background:var(--red);color:#fff;flex-shrink:0;">LLENO</span>`
                      : `<span style="padding:0 3px;border-radius:3px;font-size:8px;font-weight:800;background:#22c55e;color:#000;flex-shrink:0;">Disponible</span>`)
                  : '';
                const ocuLine = capacity > 0
                  ? `<span style="display:flex;align-items:center;gap:3px;font-size:9px;opacity:0.9;margin-top:2px;">${booked}/${capacity} ${badge}</span>`
                  : '';
                const instrName = instrNameById[clsInstr] || '';
                const instrLine = instrName
                  ? `<span style="display:block;font-size:9px;opacity:0.75;margin-top:1px;">👤 ${_escHtml(instrName)}</span>`
                  : '';
                // Phase 2: pass classes.capacity (template value) and day_of_week array to editor
                // Task D: schedule editing stays admin-only — reception gets roster view + book-on-behalf only
                const editIcon  = isFullAdmin
                  ? `<span class="sch-edit" title="${clsRec ? 'Modificar esta clase (serie recurrente)' : 'Editar esta clase'}" onclick="event.stopPropagation();abrirEditarClaseIntent('${clsId}','${clsName}','${s.class_date}','${s.start_time}',${capacity},'${clsInstr}',${clsRec},${clsDows},${clsPrice},'${s.id}')">✏️</span>`
                  : '';
                const cancelBtn = isFullAdmin
                  ? (clsRec
                      ? `<span onclick="event.stopPropagation();confirmarEliminarClaseModal('${s.id}','${s.class_date}','${clsId}','${clsName}')" title="Eliminar esta clase" style="position:absolute;top:1px;right:2px;cursor:pointer;font-size:10px;opacity:0.6;line-height:1;z-index:2;">✕</span>`
                      : `<span onclick="event.stopPropagation();cancelarOcurrencia('${s.id}','${s.class_date}')" title="Cancelar esta clase" style="position:absolute;top:1px;right:2px;cursor:pointer;font-size:10px;opacity:0.6;line-height:1;z-index:2;">✕</span>`)
                  : '';
                // Only for non-recurring (puntual) classes — for a recurring class, deleting the
                // row without marking it an exception would just have it silently reappear on the
                // next daily schedule generation (see _reconcileStaleScheduleRows()), which never
                // touches is_exception rows but has no reason to skip a row that was hard-deleted
                // and matches the pattern again. "✕ Cancelar esta clase" (is_exception=true) is
                // the correct — and now only — one-occurrence action for recurring classes.
                const deleteBtn = (isFullAdmin && !clsRec)
                  ? `<span onclick="event.stopPropagation();eliminarSlot('${s.id}')" title="Eliminar del horario" style="position:absolute;top:1px;left:2px;cursor:pointer;font-size:9px;opacity:0.55;line-height:1;z-index:2;">🗑</span>`
                  : '';
                // F3: "book on behalf of user" — only shown when there is capacity
                const bookBtn  = !isFull
                  ? `<span onclick="event.stopPropagation();abrirReservarPorUsuario('${s.id}',${s.spots_available})" title="Reservar por usuario" style="position:absolute;bottom:2px;right:2px;cursor:pointer;font-size:10px;opacity:0.75;line-height:1;z-index:2;">👤+</span>`
                  : '';
                // Toggles the collapsible booker list below the card — separate from the card's
                // own click, which now opens the full detail modal (Reservas y Capacidad ask).
                const toggleBtn = `<span onclick="event.stopPropagation();toggleOcupanciaSlot('${s.id}')" title="Ver reservas" style="position:absolute;bottom:2px;left:2px;cursor:pointer;font-size:10px;opacity:0.75;line-height:1;z-index:2;">👥</span>`;

                const bookers  = bookingsBySlot[s.id] || [];
                const dispTime = _fmtHour(s.start_time);
                const listRows = bookers.length
                  ? bookers.map(b => `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:1px 0;">
                      <span>· ${_escHtml(b.name)}</span>
                      <span onclick="event.stopPropagation();cancelarReservaAdmin('${b.id}','${s.id}','${clsName}','${dispTime}','${(b.name || '').replace(/'/g, '')}')" title="Cancelar reserva" style="cursor:pointer;color:var(--red);font-weight:700;flex-shrink:0;">✕</span>
                    </div>`).join('')
                  : `<div style="color:var(--muted);">Sin reservas confirmadas</div>`;
                const panel = `<div id="ocu-${s.id}" style="display:none;margin-top:2px;padding:4px 6px;background:rgba(0,0,0,0.55);border-radius:0 0 4px 4px;font-size:10px;color:var(--text);max-height:110px;overflow-y:auto;line-height:1.5;">${listRows}</div>`;

                const card = `<div class="sch-class ${_schCssClass(s.classes)}" style="position:relative;flex-direction:column;align-items:flex-start;justify-content:flex-start;padding-top:5px;cursor:pointer;" onclick="openClaseDetalle('${s.id}','${clsName}','${dispTime}')">${_shortClassName(s.classes)}${instrLine}${ocuLine}${editIcon}${cancelBtn}${deleteBtn}${toggleBtn}${bookBtn}</div>`;
                return card + panel;
              }).join('');
              html += `<div class="sch-cell">${cells}</div>`;
            }
          }
        });
      }
      grid.innerHTML = html;
    }

    // ---- Phase 5: warn about classes with no day_of_week configured ----
    const missingDays = [...new Map(
      weekSch
        .filter(s => s.classes?.id && !(s.classes?.day_of_week?.length))
        .map(s => [s.classes.id, s.classes.name?.trim() || s.classes.type])
    ).entries()];
    const warningBanner = document.getElementById('horarios-missing-days-banner');
    if (warningBanner) {
      if (missingDays.length) {
        warningBanner.innerHTML = `<span style="font-weight:700;">⚠ Clases sin días configurados</span> — no se generarán automáticamente: ${missingDays.map(([,n]) => `<strong>${n}</strong>`).join(', ')}. Edítalas y selecciona al menos un día.`;
        warningBanner.style.display = 'block';
      } else {
        warningBanner.style.display = 'none';
      }
    }

    // ---- Render summary table ----
    if (tbody) {
      // Phase 5: group by class_id + start_time.
      // Days come from classes.day_of_week (template), not from which schedule rows happen to exist.
      // Inscritos come from confirmed bookings count, not from stale spots_available arithmetic.
      // Every occurrence (cancelled or not) is tracked per group so a class whose only
      // occurrence this week was cancelled still shows up — with Estado = Cancelada —
      // instead of silently vanishing from the table.
      const summary = {};
      weekSch.forEach(s => {
        const cls = s.classes;
        if (!cls?.id) return;
        const key = `${cls.id}|${s.start_time}`;
        if (!summary[key]) {
          // Seed dows from the template so missing schedule rows don't blank out the day column
          const templateDows = new Set((cls.day_of_week || []).map(d => parseInt(d, 10)));
          summary[key] = { cls, time: s.start_time, dows: templateDows, bookedSum: 0, attSum: 0, count: 0, todayId: null, occurrences: [] };
        }
        summary[key].occurrences.push({ id: s.id, date: s.class_date, cancelled: !!s.is_cancelled });
        // Cancelled occurrences don't count toward occupancy stats or "clase hoy" reporting
        if (!s.is_cancelled) {
          summary[key].bookedSum += bookingCountBySlot[s.id] || 0;
          summary[key].attSum    += attBySlot[s.id] || 0;
          summary[key].count++;
          if (s.class_date === todayStr) summary[key].todayId = s.id;
        }
      });

      const rows = Object.values(summary).sort((a, b) => a.time.localeCompare(b.time));
      if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px;">Sin clases esta semana</td></tr>';
      } else {
        tbody.innerHTML = rows.map(r => {
          const totalCap = (r.cls.capacity || 0) * r.count;
          const pct  = totalCap > 0 ? Math.min(100, Math.round(r.bookedSum / totalCap * 100)) : 0;
          const fill = (() => { const t = (r.cls.type || r.cls.name || '').toLowerCase(); return t.includes('pilates') ? 'purple' : (t.includes('cycling') || t.includes('riding')) ? 'orange' : ''; })();
          const safeName  = (r.cls.name?.trim() || r.cls.type || '').replace(/'/g, '');
          const reportBtn = r.todayId
            ? `<button class="btn btn-ghost btn-sm" onclick="openClaseDetalle('${r.todayId}','${safeName}','${_fmtHour(r.time)}')">Reporte</button>`
            : `<span style="font-size:11px;color:var(--muted2);">Sin clase hoy</span>`;
          const dayStr = r.dows.size ? _formatDayPattern(r.dows) : '<span style="color:var(--amber);font-size:11px;">Sin días</span>';

          // ---- Task 2: exact date of the nearest occurrence (upcoming preferred, else the latest one) ----
          const occsSorted = r.occurrences.slice().sort((a, b) => a.date.localeCompare(b.date));
          const nextOcc     = occsSorted.find(o => o.date >= todayStr) || occsSorted[occsSorted.length - 1] || null;
          const dateDetail  = nextOcc
            ? `<div style="font-size:11px;color:var(--muted2);margin-top:2px;">${_formatFullWeekday(nextOcc.date)}${nextOcc.cancelled ? ' · cancelada' : ''}</div>`
            : '';

          // ---- Task 1: real Estado from this week's occurrences, not hardcoded ----
          const totalOccs     = occsSorted.length;
          const cancelledOccs = occsSorted.filter(o => o.cancelled);
          let estadoHtml;
          if (totalOccs > 0 && cancelledOccs.length === totalOccs) {
            estadoHtml = `<span class="badge badge-red" title="Todas las ocurrencias de esta semana están canceladas">Cancelada</span>`;
          } else if (cancelledOccs.length > 0) {
            const cancelledDates = cancelledOccs.map(o => _formatDate(o.date, { day: 'numeric', month: 'short' })).join(', ');
            estadoHtml = `<span class="badge badge-amber" title="Cancelada: ${cancelledDates}">Parcial</span>`;
          } else {
            estadoHtml = `<span class="badge badge-green">Activa</span>`;
          }

          // ---- Task 4: cancel the specific date shown above, right from this table ----
          // Task D: stays admin-only, same scoping as the grid's edit/cancel/delete icons above.
          const cancelDateBtn = (isFullAdmin && nextOcc && !nextOcc.cancelled)
            ? (r.cls.is_recurring
                ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="confirmarEliminarClaseModal('${nextOcc.id}','${nextOcc.date}','${r.cls.id}','${safeName}')" title="Elige cancelar solo el ${_formatFullWeekday(nextOcc.date)}, o eliminar la clase recurrente completa">Cancelar esta fecha</button>`
                : `<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="cancelarOcurrencia('${nextOcc.id}','${nextOcc.date}')" title="Cancela solo el ${_formatFullWeekday(nextOcc.date)}; el patrón semanal no se modifica">Cancelar esta fecha</button>`)
            : '';

          return `<tr>
            <td><span class="badge ${_classBadgeColor(r.cls)}">${safeName}</span></td>
            <td style="color:var(--muted);">${dayStr}${dateDetail}</td>
            <td style="font-family:'Outfit',sans-serif;font-weight:500;letter-spacing:1px;">${_fmtHour(r.time)}</td>
            <td style="font-family:'Outfit',sans-serif;font-weight:700;font-size:16px;color:var(--cyan);">${r.cls.capacity ?? '—'}</td>
            <td style="font-family:'Outfit',sans-serif;font-weight:600;">${_formatCOPFull(r.cls.price_cop)}</td>
            <td><div style="display:flex;align-items:center;gap:8px;"><div class="progress-bar" style="width:80px;height:4px;"><div class="progress-fill ${fill}" style="width:${pct}%;"></div></div><span style="font-size:12px;color:var(--muted2);">${pct}%</span></div></td>
            <td>${estadoHtml}</td>
            <td style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">${reportBtn}${cancelDateBtn}</td>
          </tr>`;
        }).join('');
      }
    }

  } catch (err) {
    console.error('loadAdminHorariosPage error:', err);
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;color:var(--amber);font-size:13px;padding:20px;text-align:center;">Error al cargar horarios.</div>';
  }
}

async function forzarRegenerarHorario() {
  localStorage.removeItem('thor_sched_gen_date');
  toast('Regenerando horario…', 'Espera un momento');
  await generateWeeklySchedule(4);
  localStorage.setItem('thor_sched_gen_date', _bogotaToday());
  await loadAdminHorariosPage();
}

// ¿Eliminar solo esta semana o la clase recurrente completa? — shown whenever the ✕ icon
// (grid) or the "Cancelar esta fecha" button (RESUMEN DE CLASES ACTIVAS) is used on a
// RECURRING class occurrence. Non-recurring (puntual) classes skip this — a single
// occurrence IS the whole class, so cancelarOcurrencia() is called directly, same as before.
let _pendingEliminarClaseArgs = null;

function confirmarEliminarClaseModal(scheduleId, classDate, classId, clsName) {
  _pendingEliminarClaseArgs = { scheduleId, classDate, classId, clsName };
  const nombreEl = document.getElementById('eliminar-clase-nombre');
  if (nombreEl) nombreEl.textContent = clsName || 'esta clase';
  const fechaEl = document.getElementById('eliminar-clase-fecha');
  if (fechaEl) fechaEl.textContent = classDate ? _formatFullWeekday(classDate) : '';
  openModal('eliminar-clase-opciones');
}

function _eliminarClaseOpcionSemana() {
  if (!_pendingEliminarClaseArgs) return;
  const { scheduleId, classDate } = _pendingEliminarClaseArgs;
  closeModal('modal-eliminar-clase-opciones');
  _pendingEliminarClaseArgs = null;
  cancelarOcurrencia(scheduleId, classDate);
}

function _eliminarClaseOpcionDefinitiva() {
  if (!_pendingEliminarClaseArgs) return;
  const { classId, clsName } = _pendingEliminarClaseArgs;
  closeModal('modal-eliminar-clase-opciones');
  _pendingEliminarClaseArgs = null;
  eliminarClaseDefinitivamente(classId, clsName);
}

async function cancelarOcurrencia(scheduleId, classDate) {
  if (!confirm(`¿Cancelar la clase del ${classDate}?\nEsta acción solo afecta esa fecha; el patrón semanal no se modifica.`)) return;

  const { error } = await db.from('schedule')
    .update({ is_cancelled: true, is_exception: true })
    .eq('id', scheduleId);

  if (error) {
    // Fallback: is_exception column may not exist yet
    if (error.message?.includes('is_exception')) {
      const { error: e2 } = await db.from('schedule')
        .update({ is_cancelled: true })
        .eq('id', scheduleId);
      if (e2) { toast('Error al cancelar', e2.message); return; }
    } else {
      toast('Error al cancelar', error.message || 'Intenta de nuevo');
      return;
    }
  }

  // Not paid: mirror the cancellation onto the matching class_occurrences row. If that row
  // is already 'completed' (sealed history), RLS silently rejects this update (0 rows
  // affected, no error) — past history is never altered, by database policy, not by this
  // function remembering to check the date itself.
  await db.from('class_occurrences').update({ status: 'cancelled' }).eq('schedule_id', scheduleId);

  toast('Clase cancelada', `Ocurrencia del ${classDate} marcada como cancelada`);
  loadAdminHorariosPage();
}

// ── Eliminar slot individual del horario ────────────────────────────

async function eliminarSlot(scheduleId) {
  if (!confirm('¿Eliminar esta clase del horario? Esta acción no se puede deshacer.')) return;
  try {
    const { data: slot } = await db.from('schedule').select('class_date').eq('id', scheduleId).single();
    if (slot && slot.class_date < _bogotaToday()) {
      toast('No permitido', 'No se pueden eliminar clases de fechas pasadas — son historial de nómina.');
      return;
    }
    // Not paid, same as cancelarOcurrencia — the row is about to disappear from `schedule`
    // entirely, so it can never be booked/attended/completed either.
    await db.from('class_occurrences').update({ status: 'cancelled' }).eq('schedule_id', scheduleId);
    const { error } = await db.from('schedule').delete().eq('id', scheduleId);
    if (error) throw error;
    toast('Clase eliminada', 'El slot fue eliminado del horario.');
    await loadAdminHorariosPage();
  } catch (e) {
    toast('Error al eliminar', e.message);
  }
}

function toggleOcupanciaSlot(scheduleId) {
  const panel = document.getElementById('ocu-' + scheduleId);
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

// Soft-cancels a single member's reservation (not the whole class occurrence) from either
// the collapsible booker list in the weekly grid or the class-detail modal. Reuses
// cancelBooking(), which does a conditional {status,cancelled_at} update — never a full-row
// overwrite — and frees the slot back onto schedule.spots_available. Fase 4.5: cancelBooking()
// itself shows a second confirm() when fewer than 2h remain before class start, warning that
// the class still counts against the member's allowance — if the admin declines that second
// prompt, cancelBooking() returns {cancelled:false} and this function bails out silently
// (no toast, no refresh) instead of reporting a cancellation that didn't happen.
async function cancelarReservaAdmin(bookingId, scheduleId, clsName, dispTime, memberName) {
  if (!confirm(`¿Cancelar la reserva de ${memberName || 'este miembro'}?`)) return;
  try {
    const result = await cancelBooking(bookingId);
    if (!result.cancelled) return;
    toast('Reserva cancelada', memberName ? `${memberName} fue removido de la clase` : 'Reserva cancelada');
    const modal = document.getElementById('modal-clase-detalle');
    if (modal?.classList.contains('open')) await openClaseDetalle(scheduleId, clsName, dispTime);
    if (document.getElementById('admin-horarios-grid')) await loadAdminHorariosPage();
  } catch (e) {
    toast('Error al cancelar', e.message || 'Intenta de nuevo');
  }
}

// ===================== COMUNICACIÓN =====================

let canalSeleccionado = 'whatsapp';
const _comCounts = { todos: 0, vencer: 0, pendientes: 0, inactivos: 0, especificos: 0 };
let _comAllUsers = [];
let _selectedUserIds = new Set();

async function loadComunicacionPage() {
  const today   = _bogotaToday();
  const plus7   = new Date(Date.now() + 7 * 86400000 - 5 * 3600 * 1000).toISOString().split('T')[0];
  const minus7  = new Date(Date.now() - 7  * 86400000).toISOString();
  const minus14 = new Date(Date.now() - 14 * 86400000).toISOString();

  const [
    activeUsersRes,
    debitoRes,
    vencerRes,
    pendientesRes,
    notifUsersRes,
    attendedUsersRes
  ] = await Promise.all([
    db.from('users').select('id, full_name, email').eq('role', 'user').eq('is_active', true),
    db.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('end_date', today).lte('end_date', plus7),
    db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('notifications').select('user_id').gte('created_at', minus7),
    db.from('attendance').select('user_id').gte('checked_in_at', minus14)
  ]);

  _comAllUsers        = (activeUsersRes.data || []).map(u => ({ id: u.id, name: u.full_name || '', email: u.email || '' }));
  _selectedUserIds    = new Set();
  const totalMembers  = _comAllUsers.length;
  const activeIds     = new Set(_comAllUsers.map(u => u.id));
  const debitoCount   = debitoRes.count ?? 0;
  const debitoPct     = totalMembers > 0 ? Math.round(debitoCount / totalMembers * 100) : 0;

  const notifIds    = new Set((notifUsersRes.data    || []).map(n => n.user_id));
  const attendedIds = new Set((attendedUsersRes.data || []).map(a => a.user_id));
  const sinNotif    = [...activeIds].filter(id => !notifIds.has(id)).length;
  const inactivos   = [...activeIds].filter(id => !attendedIds.has(id)).length;

  const vencerCount    = vencerRes.count    ?? 0;
  const pendientesCount = pendientesRes.count ?? 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('com-total-members', totalMembers);
  set('com-debito-activo', debitoCount);
  set('com-debito-pct',    `↑ ${debitoPct}% del total`);
  set('com-sin-notif',     sinNotif);
  set('com-cnt-todos',      `(${totalMembers})`);
  set('com-cnt-vencer',     `(${vencerCount})`);
  set('com-cnt-pendientes', `(${pendientesCount})`);
  set('com-cnt-inactivos',  `(${inactivos})`);

  _comCounts.todos       = totalMembers;
  _comCounts.vencer      = vencerCount;
  _comCounts.pendientes  = pendientesCount;
  _comCounts.inactivos   = inactivos;

  _renderPickerList(_comAllUsers);
  calcDestinatarios();
  loadMsgLog();
}

const _destFilters = {
  'dest-todos':        'all',
  'dest-vencer':       'expiring_7d',
  'dest-pendientes':   'pending_payment',
  'dest-inactivos':    'inactive_2w',
  'dest-especificos':  'specific'
};
const _destCountKeys = {
  'dest-todos':        'todos',
  'dest-vencer':       'vencer',
  'dest-pendientes':   'pendientes',
  'dest-inactivos':    'inactivos',
  'dest-especificos':  'especificos'
};

function selectCanal(canal) {
  canalSeleccionado = canal;
  ['whatsapp', 'app', 'email', 'ambos'].forEach(c => {
    const btn = document.getElementById('ch-' + c);
    if (btn) btn.classList.toggle('active', c === canal);
  });
  const waSection = document.getElementById('wa-template-section');
  if (waSection) waSection.style.display = (canal === 'whatsapp' || canal === 'ambos') ? '' : 'none';
}

function onWaTemplateChange() {
  const tpl = document.getElementById('wa-template')?.value;
  const fields = document.getElementById('wa-template-confirmacion-pago-fields');
  if (fields) fields.style.display = tpl === 'confirmacion_pago' ? '' : 'none';
}

async function loadMsgLog() {
  const tbody = document.getElementById('msg-log-tbody');
  if (!tbody) return;

  // Schema fixed 2026-07-06 — this used to select columns that never existed on the live
  // table (subject, recipients_count), so this query always errored and the history table
  // always showed "sin comunicaciones" regardless of real history. See
  // 20260706_fix_message_log_schema.sql.
  const { data, error } = await db
    .from('message_log')
    .select('id, subject, channel, recipients_count, status, email_sent, email_failed, whatsapp_sent, whatsapp_failed, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted);">No hay comunicaciones enviadas aún</td></tr>`;
    return;
  }

  const chBadge = {
    whatsapp: ['badge-green',  'WhatsApp'],
    email:    ['badge-blue',   'Email'],
    app:      ['badge-purple', 'App'],
    both:     ['badge-cyan',   'Ambos']
  };

  // Per-channel outcome — real, independent counts for each channel actually attempted on
  // this broadcast, instead of one collapsed status string.
  const _outcomeBadge = (sent, failed) => {
    if (sent == null && failed == null) return '<span class="badge badge-amber">PENDIENTE</span>';
    const f = failed || 0, s = sent || 0;
    if (f === 0)      return `<span class="badge badge-green">${s} entregados</span>`;
    if (s === 0)      return `<span class="badge badge-red">${f} fallidos</span>`;
    return `<span class="badge badge-amber">${s} ok · ${f} fallidos</span>`;
  };

  tbody.innerHTML = data.map(row => {
    const date                = _formatDate(row.created_at, { day: 'numeric', month: 'short', year: 'numeric' });
    const [chClass, chLabel]  = chBadge[row.channel] || ['badge-muted', row.channel || '—'];
    const recipients          = (row.recipients_count ?? '—') + ' miembros';
    const wantsEmail          = row.channel === 'email' || row.channel === 'both';
    const wantsWhatsapp       = row.channel === 'whatsapp' || row.channel === 'both';
    const outcomeParts = [];
    if (wantsEmail)    outcomeParts.push(`Email ${_outcomeBadge(row.email_sent, row.email_failed)}`);
    if (wantsWhatsapp) outcomeParts.push(`WhatsApp ${_outcomeBadge(row.whatsapp_sent, row.whatsapp_failed)}`);
    const outcome = outcomeParts.length
      ? `<div style="display:flex;flex-direction:column;gap:3px;font-size:11px;">${outcomeParts.join('')}</div>`
      : `<span class="badge badge-muted">${row.status || '—'}</span>`;
    return `<tr>
      <td style="color:var(--muted);">${date}</td>
      <td>${_escHtml(row.subject || '—')}</td>
      <td style="color:var(--muted2);font-family:'Outfit',sans-serif;font-weight:500;letter-spacing:0.5px;">${recipients}</td>
      <td><span class="badge ${chClass}">${chLabel}</span></td>
      <td>${outcome}</td>
    </tr>`;
  }).join('');
}

function onDestChange(selectedId) {
  Object.keys(_destFilters).forEach(id => {
    const el = document.getElementById(id);
    if (el && id !== selectedId) el.checked = false;
  });
  const panel = document.getElementById('dest-especificos-panel');
  if (panel) panel.classList.toggle('open', selectedId === 'dest-especificos' && document.getElementById('dest-especificos')?.checked);
  if (selectedId !== 'dest-especificos') {
    _selectedUserIds = new Set();
    _renderPickerList(_comAllUsers);
  }
  calcDestinatarios();
}

function calcDestinatarios() {
  const checkedId = Object.keys(_destFilters).find(id => document.getElementById(id)?.checked);
  let total = 0;
  if (checkedId === 'dest-especificos') {
    total = _selectedUserIds.size;
    const cnt = document.getElementById('com-cnt-especificos');
    if (cnt) cnt.textContent = `(${total} seleccionado${total !== 1 ? 's' : ''})`;
  } else if (checkedId) {
    total = _comCounts[_destCountKeys[checkedId]] ?? 0;
  }
  const el = document.getElementById('preview-total');
  if (el) el.textContent = total;
  return total;
}

function _renderPickerList(users) {
  const list = document.getElementById('picker-list');
  if (!list) return;
  if (!users.length) {
    list.innerHTML = `<div style="padding:12px;color:var(--muted);font-size:13px;text-align:center;">Sin resultados</div>`;
    return;
  }
  list.innerHTML = users.map(u => {
    const sel = _selectedUserIds.has(u.id);
    return `<div class="picker-item${sel ? ' picker-item-sel' : ''}" onclick="toggleUserSelection('${u.id}')">
      <div class="picker-check">${sel ? '✓' : ''}</div>
      <div>
        <div style="font-size:13px;color:var(--white);">${_escHtml(u.name || '—')}</div>
        <div style="font-size:11px;color:var(--muted2);">${_escHtml(u.email)}</div>
      </div>
    </div>`;
  }).join('');
}

function toggleUserSelection(id) {
  if (_selectedUserIds.has(id)) {
    _selectedUserIds.delete(id);
  } else {
    _selectedUserIds.add(id);
  }
  const query = document.getElementById('picker-search')?.value || '';
  filterUserPicker(query);
  calcDestinatarios();
}

function filterUserPicker(query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? _comAllUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    : _comAllUsers;
  _renderPickerList(filtered);
}

function actualizarPreview() {
  const pa = document.getElementById('preview-asunto');
  const pc = document.getElementById('preview-cuerpo');
  if (pa) pa.textContent = document.getElementById('msg-asunto')?.value || '—';
  if (pc) pc.textContent = document.getElementById('msg-cuerpo')?.value  || '—';
  calcDestinatarios();
}

async function enviarMensaje() {
  const subject = (document.getElementById('msg-asunto')?.value || '').trim();
  const body    = (document.getElementById('msg-cuerpo')?.value  || '').trim();

  if (!body) { toast('Campo requerido', 'Escribe el cuerpo del mensaje'); return; }

  const checkedId = Object.keys(_destFilters).find(id => document.getElementById(id)?.checked);
  if (!checkedId) { toast('Sin destinatarios', 'Selecciona al menos un grupo de destinatarios'); return; }

  const recipient_filter = _destFilters[checkedId];

  if (recipient_filter === 'specific') {
    if (_selectedUserIds.size === 0) { toast('Sin destinatarios', 'Selecciona al menos un usuario'); return; }
  }

  const channel = canalSeleccionado === 'ambos' ? 'both' : canalSeleccionado;
  const wantsWhatsapp = channel === 'whatsapp' || channel === 'both';
  const waTemplate = document.getElementById('wa-template')?.value || 'aviso_general';

  if (wantsWhatsapp && waTemplate === 'confirmacion_pago') {
    const monto = (document.getElementById('wa-monto')?.value || '').trim();
    if (!monto) { toast('Campo requerido', 'Completa Monto para esta plantilla'); return; }
    // "Confirmación de pago" states as fact that a specific payment was received — it
    // only makes sense for a hand-picked recipient whose payment was actually confirmed.
    // Sent to a broad segment (Todos / Por vencer / Pendientes de pago / Inactivos) it
    // tells people their payment was confirmed when it wasn't — e.g. picking "Pendientes
    // de pago" + this template would tell members with an UNPAID pending payment that it
    // was confirmed. Restrict it to "Específicos" so a segment pick can't combine with it.
    if (recipient_filter !== 'specific') {
      toast('Combinación inválida', 'La plantilla "Confirmación de pago" solo puede enviarse a destinatarios específicos, elegidos uno por uno — no a un grupo (Todos / Por vencer / Pendientes / Inactivos)');
      return;
    }
  }
  if (wantsWhatsapp && waTemplate === 'aviso_general' && !subject) {
    toast('Campo requerido', 'La plantilla "Aviso general" usa el Asunto como {{1}} — escríbelo');
    return;
  }

  const btn = document.getElementById('btn-enviar');
  if (btn) { btn.textContent = 'Enviando...'; btn.disabled = true; }

  const payload = { subject, body, channel, recipient_filter };
  if (recipient_filter === 'specific') payload.user_ids = [..._selectedUserIds];

  try {
    // send-message always resolves recipients (and sends email when requested), and
    // returns the resolved list (id, name, phone) so the WhatsApp loop below — which goes
    // straight to send-whatsapp-message, one call per recipient, per Meta's template-only
    // rules for a notification-only number — can reuse the same resolution instead of
    // duplicating it client-side.
    const { data, error } = await db.functions.invoke('send-message', { body: payload });
    if (error) throw error;
    if (data?.success === false) throw new Error(data?.error || 'Error al enviar');

    const broadcastId = data?.broadcast_id;
    let waSent = 0, waFailed = 0;

    if (wantsWhatsapp) {
      const waRecipients = (data?.recipients || []).filter(r => r.phone);
      const results = await Promise.all(
        waRecipients.map(r => _sendWhatsappTemplate(waTemplate, r, broadcastId, subject, body))
      );
      waSent   = results.filter(Boolean).length;
      waFailed = results.length - waSent;

      // Persist the WhatsApp outcome onto the same broadcast row send-message already
      // wrote (keyed by broadcast_id) so loadMsgLog() can show each channel's real,
      // independent outcome instead of one collapsed status.
      if (broadcastId) {
        const waUpdate = { whatsapp_sent: waSent, whatsapp_failed: waFailed };
        if (channel === 'whatsapp') {
          // send-message left status "pending" for a WhatsApp-only send since it never
          // touches WhatsApp itself — this is the only place that outcome is known.
          waUpdate.status = waFailed === 0 ? 'sent' : (waSent > 0 ? 'partial' : 'failed');
        }
        const { error: updErr } = await db.from('message_log').update(waUpdate).eq('broadcast_id', broadcastId);
        if (updErr) console.warn('message_log whatsapp update:', updErr.message);
      }
    }

    const parts = [];
    if (channel === 'email' || channel === 'both') {
      parts.push(`Email: ${data?.email_sent ?? 0} enviados${data?.email_failed ? `, ${data.email_failed} fallidos` : ''}`);
    }
    if (wantsWhatsapp) {
      parts.push(`WhatsApp: ${waSent} entregados${waFailed ? `, ${waFailed} fallidos` : ''}`);
    }
    toast('Mensaje enviado', parts.join(' · ') || 'Enviado');

    document.getElementById('msg-asunto').value = '';
    document.getElementById('msg-cuerpo').value = '';
    const montoEl = document.getElementById('wa-monto');
    if (montoEl) montoEl.value = '';
    Object.keys(_destFilters).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });
    _selectedUserIds = new Set();
    _renderPickerList(_comAllUsers);
    const panel = document.getElementById('dest-especificos-panel');
    if (panel) panel.classList.remove('open');
    actualizarPreview();
    loadMsgLog();
  } catch (err) {
    toast('Error al enviar el mensaje', err.message || 'Verifica la configuración de correo.');
  } finally {
    if (btn) { btn.innerHTML = '📣 &nbsp;Enviar mensaje'; btn.disabled = false; }
  }
}

// Sends one WhatsApp template message to one recipient via send-whatsapp-message (which
// checks Meta's real HTTP response — see that function — unlike send-message, which never
// touches WhatsApp at all). Returns true only on a genuine Meta success.
//
// Variable mapping confirmed 2026-07-06 directly against the approved copy in Meta
// Business Manager (previously a guessed placeholder — see git history):
//   aviso_general:      {{1}} = Asunto (subject)      {{2}} = Cuerpo del mensaje (body)
//   confirmacion_pago:  {{1}} = nombre del cliente    {{2}} = monto
// confirmacion_pago previously also sent a 3rd "plan/período" parameter that doesn't
// exist in the approved template at all — Meta rejects any parameter-count mismatch.
// Returns {success, error} — error is the real Supabase/Meta message on failure (not just
// a boolean) so callers that need to show it to an admin (notificarVencimiento(),
// adminNotifyAllExpiring()) can, instead of each re-implementing this same invoke call.
// montoOverride: opcional — cuando se pasa, reemplaza la lectura de #wa-monto para
// 'confirmacion_pago'. Ese campo pertenece a la página de Comunicación masiva; leerlo a
// ciegas rompería a cualquier llamador fuera de esa página (ej. registrarPagoManual(),
// que dispara esta misma plantilla desde el registro de pago manual, parte 6 del módulo
// de facturación) al mandar un monto vacío o el de un envío masivo anterior sin relación.
async function _sendWhatsappTemplateDetailed(templateName, recipient, broadcastId, subject, body, montoOverride) {
  let parameters;
  if (templateName === 'confirmacion_pago') {
    const monto = montoOverride != null ? String(montoOverride) : (document.getElementById('wa-monto')?.value || '').trim();
    parameters = [recipient.name || 'Cliente', monto];
  } else {
    parameters = [subject, body];
  }
  try {
    const { data, error } = await db.functions.invoke('send-whatsapp-message', {
      body: { to: recipient.phone, template_name: templateName, parameters, broadcast_id: broadcastId },
    });
    if (error || data?.success !== true) {
      return { success: false, error: data?.error || error?.message || 'Error desconocido enviando WhatsApp' };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || String(err) };
  }
}

// Thin boolean wrapper — kept for enviarMensaje()'s bulk-send loop, which only needs a
// pass/fail count per recipient, not each individual error's text.
async function _sendWhatsappTemplate(templateName, recipient, broadcastId, subject, body) {
  return (await _sendWhatsappTemplateDetailed(templateName, recipient, broadcastId, subject, body)).success;
}

// ===================== CONTRACTS =====================

// Fase 4.2 (2026-08-20): multiple simultaneous contract templates. `contracts` rows are
// now grouped by `template_key` — many rows can be is_current=true at once (one per
// distinct template), instead of exactly one globally. LEGACY_TEMPLATE_KEY is the
// original single-contract template: its PDFs keep living at the bucket ROOT (unchanged
// path convention, so pre-existing installs keep working without re-upload, and even
// before the migration below has run — see the "does not exist" fallbacks throughout
// this module). Any additional template an admin creates gets its own `<template_key>/`
// folder in the same `contracts` storage bucket. See
// supabase/migrations/20260820_contracts_multiple_templates.sql.
const LEGACY_TEMPLATE_KEY = 'membresia';

// One entry per current template: { dbId, templateKey, label, filename, uploadedAt,
// size, url, storageAdultPath, storageMinorPath }. Populated by _loadContractTemplates().
let _contractTemplates = [];
let _contractTemplatesReady = false;

// Legacy shape kept for the few places that still want "a" single contract's display
// info (e.g. the empty-state placeholder before any template is configured). Mirrors
// _contractTemplates[0] once loaded.
const contractState = {
  currentContract: {
    filename: 'contrato-thor-training-2025.pdf',
    uploadedAt: '2025-04-10',
    size: '245 KB',
    url: null
  }
};

let contractFilter = 'todos';
let _contractIsMinor = false;
// The pending template currently being shown/signed on renderContractPage() — set on
// every render, read by acceptContract() so it always signs the template actually on
// screen rather than "the" contract.
let _contractActiveTemplate = null;
// Admin "Estado por usuario" table is scoped to one template at a time.
let _contractsAdminTemplateKey = null;

// ---- Supabase contract functions ----

// Fetches every currently-active template row. Defensive: if template_key/label columns
// aren't migrated yet, falls back to the old single-row query (pre-4.2 schema) and the
// caller below treats the single result as the legacy template.
async function _fetchCurrentContractRows() {
  let { data, error } = await db.from('contracts').select('*').eq('is_current', true).order('template_key', { ascending: true });
  if (error && /does not exist/i.test(error.message || '')) {
    ({ data, error } = await db.from('contracts').select('*').eq('is_current', true));
  }
  if (error) return [];
  return data || [];
}

// Back-compat helper: the legacy/default template's DB row (template_key='membresia',
// or the only row when running pre-migration).
async function getCurrentContract() {
  const rows = await _fetchCurrentContractRows();
  return rows.find(r => (r.template_key || LEGACY_TEMPLATE_KEY) === LEGACY_TEMPLATE_KEY) || rows[0] || null;
}

// Lists the contracts bucket per template, identifies adult/minor PDFs by name (same
// MENOR filename heuristic as before), syncs _contractTemplates, and seeds the DB row for
// the legacy template if storage already has files but no DB row exists yet (same
// bootstrap the old _initContractState always did). Skips reloading unless force=true.
async function _loadContractTemplates(force) {
  if (_contractTemplatesReady && !force) return _contractTemplates;
  try {
    const rows = await _fetchCurrentContractRows();

    // Bootstrap: fresh install with files already sitting in the bucket root but no DB
    // row yet for the legacy template.
    let effectiveRows = rows;
    if (!rows.some(r => (r.template_key || LEGACY_TEMPLATE_KEY) === LEGACY_TEMPLATE_KEY)) {
      const { data: rootFiles } = await db.storage.from('contracts').list('', { limit: 50 });
      const rootPdfs = (rootFiles || []).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (rootPdfs.length) {
        const mainFile = rootPdfs.find(f => !f.name.toUpperCase().includes('MENOR') && f.name.toUpperCase().includes('CONSENTIMIENTO')) || rootPdfs[0];
        let inserted = null;
        let { data: ins, error: insErr } = await db.from('contracts').insert({
          version: mainFile.name, is_current: true, template_key: LEGACY_TEMPLATE_KEY, label: 'Contrato de membresía'
        }).select().single();
        if (insErr && /does not exist/i.test(insErr.message || '')) {
          ({ data: ins, error: insErr } = await db.from('contracts').insert({ version: mainFile.name, is_current: true }).select().single());
        }
        if (!insErr) inserted = ins;
        if (inserted) effectiveRows = [...rows, inserted];
      }
    }

    const templates = [];
    for (const row of effectiveRows) {
      const templateKey = row.template_key || LEGACY_TEMPLATE_KEY;
      const prefix = templateKey === LEGACY_TEMPLATE_KEY ? '' : `${templateKey}/`;
      const { data: files } = await db.storage.from('contracts').list(prefix ? templateKey : '', { limit: 50 });
      const pdfFiles  = (files || []).filter(f => f.name.toLowerCase().endsWith('.pdf'));
      const minorFile = pdfFiles.find(f => f.name.toUpperCase().includes('MENOR'));
      // Legacy template keeps the exact original CONSENTIMIENTO-based detection (bucket
      // root may hold unrelated files); a dedicated `<template_key>/` folder only ever
      // holds this template's own PDFs, so any non-MENOR file there is the adult variant.
      const adultFile = templateKey === LEGACY_TEMPLATE_KEY
        ? pdfFiles.find(f => !f.name.toUpperCase().includes('MENOR') && f.name.toUpperCase().includes('CONSENTIMIENTO'))
        : pdfFiles.find(f => !f.name.toUpperCase().includes('MENOR'));
      const mainFile = adultFile || minorFile;

      let url = null;
      if (mainFile) {
        const { data: urlData } = await db.storage.from('contracts').createSignedUrl(prefix + mainFile.name, 3600);
        url = urlData?.signedUrl || null;
      }

      const sizeKb = mainFile?.metadata?.size ? Math.round(mainFile.metadata.size / 1024) + ' KB' : '';
      const uploadedAt = mainFile?.updated_at
        ? new Date(mainFile.updated_at).toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' })
        : (row.uploaded_at ? new Date(row.uploaded_at).toLocaleDateString('es-CO') : '');

      templates.push({
        dbId:             row.id,
        templateKey,
        label:            row.label || (templateKey === LEGACY_TEMPLATE_KEY ? 'Contrato de membresía' : templateKey),
        filename:         row.version || mainFile?.name || '',
        uploadedAt,
        size:             sizeKb,
        url,
        storageAdultPath: adultFile ? prefix + adultFile.name : null,
        storageMinorPath: minorFile ? prefix + minorFile.name : null
      });
    }

    // Legacy template first, then alphabetical — stable, predictable default ordering.
    templates.sort((a, b) => {
      if (a.templateKey === LEGACY_TEMPLATE_KEY) return -1;
      if (b.templateKey === LEGACY_TEMPLATE_KEY) return 1;
      return a.label.localeCompare(b.label);
    });

    _contractTemplates = templates;
    if (templates[0]) {
      contractState.currentContract = {
        filename:         templates[0].filename || contractState.currentContract.filename,
        uploadedAt:       templates[0].uploadedAt,
        size:             templates[0].size,
        url:              templates[0].url,
        storageAdultPath: templates[0].storageAdultPath,
        storageMinorPath: templates[0].storageMinorPath,
        dbId:             templates[0].dbId
      };
    }
    if (!_contractsAdminTemplateKey || !templates.some(t => t.templateKey === _contractsAdminTemplateKey)) {
      _contractsAdminTemplateKey = templates[0]?.templateKey || null;
    }
    _contractTemplatesReady = true;
  } catch (_) { /* non-fatal — UI falls back to local/placeholder state */ }
  return _contractTemplates;
}

async function hasAcceptedContract(userId, contractId) {
  const { data } = await db
    .from('contract_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .single();
  return !!data;
}

async function acceptContractSupabase(userId, contractId, contractType, guardianData, guardianSignatureUrl, userSignatureUrl) {
  const row = { user_id: userId, contract_id: contractId, contract_type: contractType, accepted_at: new Date().toISOString() };
  if (guardianData)         row.captured_data          = guardianData;
  if (guardianSignatureUrl) row.guardian_signature_url = guardianSignatureUrl;
  if (userSignatureUrl)     row.signature_url          = userSignatureUrl;
  const { error } = await db.from('contract_acceptances').insert(row);
  if (error) throw error;
}

// ---- User side ----

async function _pendingTemplateCount() {
  await _loadContractTemplates();
  if (!_contractTemplates.length || !currentUser) return 0;
  const flags = await Promise.all(_contractTemplates.map(t => hasAcceptedContract(currentUser.id, t.dbId)));
  return flags.filter(accepted => !accepted).length;
}

async function updateContractBanner() {
  const banner = document.getElementById('contract-banner');
  if (!banner || !currentUser || currentUser.role !== 'user') {
    if (banner) banner.style.display = 'none';
    return;
  }
  const pending = await _pendingTemplateCount();
  banner.style.display = pending > 0 ? 'flex' : 'none';
}

async function updateContractNavBadge() {
  const badge = document.getElementById('contrato-badge');
  if (!badge || !currentUser) return;
  const pending = await _pendingTemplateCount();
  badge.style.display = pending > 0 ? 'inline-block' : 'none';
  badge.textContent = pending > 1 ? String(pending) : '!';
}

// Renders every currently-accepted template as a compact card, then steps the user
// through the pending ones one at a time (the first pending template gets the full
// PDF + signature UI below; closeFirmaModal() re-renders this page after each
// acceptance, which naturally advances to the next pending template until none remain).
async function renderContractPage() {
  const container = document.getElementById('contrato-content');
  if (!container || !currentUser) return;

  container.innerHTML = _loader();

  await _loadContractTemplates();

  if (!_contractTemplates.length) {
    container.innerHTML = `
      <div class="card">
        <div style="text-align:center;padding:28px 0;color:var(--muted);">
          <div style="font-size:36px;margin-bottom:12px;">📄</div>
          <div style="font-size:13px;">El administrador aún no ha configurado ningún contrato.</div>
        </div>
      </div>`;
    return;
  }

  const statuses = await Promise.all(_contractTemplates.map(async t => ({
    template: t,
    accepted: await hasAcceptedContract(currentUser.id, t.dbId)
  })));
  const acceptedList = statuses.filter(s => s.accepted);
  const pendingList  = statuses.filter(s => !s.accepted);

  const acceptedAtByTemplate = {};
  await Promise.all(acceptedList.map(async ({ template }) => {
    const { data } = await db.from('contract_acceptances')
      .select('accepted_at')
      .eq('user_id', currentUser.id)
      .eq('contract_id', template.dbId)
      .single();
    acceptedAtByTemplate[template.templateKey] = data?.accepted_at || null;
  }));

  const acceptedCardsHtml = acceptedList.map(({ template }) => {
    const acceptedAtRaw = acceptedAtByTemplate[template.templateKey];
    const dt    = acceptedAtRaw ? new Date(acceptedAtRaw) : null;
    const fecha = dt ? dt.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) : '—';
    const hora  = dt ? dt.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' }) : '';
    return `
      <div class="card card-cyan mb-md" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;padding:24px 28px;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:48px;height:48px;background:rgba(57,255,122,0.1);border:1px solid rgba(57,255,122,0.3);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">✅</div>
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--muted2);text-transform:uppercase;margin-bottom:4px;">${_escHtml(template.label)}</div>
            <span class="badge badge-green" style="font-size:12px;padding:5px 14px;margin-bottom:8px;display:inline-block;">✓ CONTRATO ACEPTADO</span>
            <div style="font-size:13px;color:var(--muted);">Aceptado el <span style="color:var(--white);font-weight:600;">${fecha}</span>${hora ? ' a las <span style="color:var(--white);font-weight:600;">' + hora + '</span>' : ''}</div>
            <div style="font-size:12px;color:var(--muted2);margin-top:4px;">Confirmación enviada a <span style="color:var(--cyan);">${currentUser.email}</span></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
          <button class="btn btn-outline btn-sm" onclick="downloadContract('${template.templateKey}')">⬇ Descargar contrato</button>
          <div style="font-size:11px;color:var(--muted2);">Versión: ${_escHtml(template.filename || '—')}</div>
        </div>
      </div>`;
  }).join('');

  if (!pendingList.length) {
    _contractActiveTemplate = null;
    container.innerHTML = acceptedCardsHtml + `
      <div class="card">
        <div style="font-size:12px;color:var(--muted);line-height:1.8;">Si tienes dudas sobre tus contratos, contacta a recepción en <span style="color:var(--cyan);">recepcion@thor.com</span> o visítanos directamente en el gimnasio.</div>
      </div>`;
  } else {
    _contractActiveTemplate = pendingList[0].template;

    // Determine minor status — same age-based check for every template (there is no
    // per-template age/plan targeting hook today, see 4.2 scoping notes).
    const birthDate = currentUser.birth_date ? parseLocalDate(currentUser.birth_date) : null;
    const age = birthDate ? (new Date().getFullYear() - birthDate.getFullYear()) : 99;
    _contractIsMinor = !!(currentUser.birth_date && age < 18);

    const progressNote = pendingList.length > 1
      ? `<div class="card mb-md" style="border-color:rgba(255,184,0,0.3);"><div style="font-size:12px;color:var(--amber);">Tienes <strong>${pendingList.length}</strong> contratos pendientes. Firmando ahora: <strong>${_escHtml(_contractActiveTemplate.label)}</strong>. Después de firmar este verás: ${pendingList.slice(1).map(p => _escHtml(p.template.label)).join(', ')}.</div></div>`
      : '';

    // Load the correct PDF from Supabase Storage for the active pending template
    let pdfSrc = '';
    try {
      const storagePath = _contractIsMinor
        ? (_contractActiveTemplate.storageMinorPath || _contractActiveTemplate.storageAdultPath)
        : (_contractActiveTemplate.storageAdultPath || _contractActiveTemplate.storageMinorPath);
      if (storagePath) {
        const { data: urlData } = await db.storage.from('contracts').createSignedUrl(storagePath, 3600);
        if (urlData?.signedUrl) pdfSrc = urlData.signedUrl;
      }
      if (!pdfSrc) pdfSrc = _contractActiveTemplate.url || '';
    } catch (_) { pdfSrc = _contractActiveTemplate.url || ''; }

    const pdfBlock = pdfSrc
      ? `<iframe src="${pdfSrc}" class="contract-pdf-frame"></iframe>`
      : `<div class="contract-pdf-placeholder">
           <div style="font-size:36px;margin-bottom:12px;">📄</div>
           <div style="font-size:14px;color:var(--muted2);margin-bottom:6px;">${_escHtml(_contractActiveTemplate.filename || _contractActiveTemplate.label)}</div>
           <div style="font-size:12px;color:var(--muted);line-height:1.7;">El administrador cargará el documento PDF pronto.<br>Podrás leerlo aquí antes de aceptar.</div>
         </div>`;

    const guardianSection = _contractIsMinor ? `
      <div class="card mb-md" id="contract-guardian-section">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--cyan);margin-bottom:16px;text-transform:uppercase;">Datos del acudiente</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 16px;">
          <div class="form-group">
            <label class="form-label">Nombre completo acudiente</label>
            <input class="form-input" id="guardian-nombre" type="text" placeholder="Nombre completo">
          </div>
          <div class="form-group">
            <label class="form-label">Cédula de ciudadanía</label>
            <input class="form-input" id="guardian-cedula" type="text" placeholder="No. de documento">
          </div>
          <div class="form-group">
            <label class="form-label">Parentesco</label>
            <input class="form-input" id="guardian-parentesco" type="text" placeholder="Ej: Madre, Padre, Tutor">
          </div>
          <div class="form-group">
            <label class="form-label">Dirección acudiente</label>
            <input class="form-input" id="guardian-direccion" type="text" placeholder="Dirección completa">
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono</label>
            <input class="form-input" id="guardian-telefono" type="tel" placeholder="Teléfono fijo">
          </div>
          <div class="form-group">
            <label class="form-label">Celular</label>
            <input class="form-input" id="guardian-celular" type="tel" placeholder="Celular">
          </div>
        </div>
        <div style="margin-top:18px;">
          <label class="form-label" style="display:block;margin-bottom:8px;">Firma acudiente</label>
          <canvas id="guardian-sig-pad"
            style="border:1px solid var(--border);border-radius:8px;background:#0d1117;display:block;width:100%;height:120px;cursor:crosshair;touch-action:none;"></canvas>
          <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px;font-size:11px;" onclick="_sigPadClear()">Limpiar firma</button>
        </div>
      </div>` : '';

    const userSigSection = !_contractIsMinor ? `
      <div class="card mb-md">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--cyan);margin-bottom:6px;text-transform:uppercase;">Tu firma</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">Dibuja tu firma con el mouse o el dedo. Es requerida para aceptar el contrato.</div>
        <canvas id="user-sig-pad"
          style="border:1px solid var(--border);border-radius:8px;background:#0d1117;display:block;width:100%;height:140px;cursor:crosshair;touch-action:none;"></canvas>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <button type="button" class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="_userSigClear()">↺ Limpiar firma</button>
          <span id="sig-required-hint" style="font-size:11px;color:var(--amber);">Firma pendiente</span>
        </div>
      </div>` : '';

    container.innerHTML = `
      ${acceptedCardsHtml}
      ${progressNote}
      <div style="margin-bottom:12px;font-size:11px;font-weight:700;letter-spacing:1px;color:var(--cyan);text-transform:uppercase;">${_escHtml(_contractActiveTemplate.label)}</div>
      <div style="margin-bottom:12px;font-size:13px;color:var(--muted);">Lee el documento completo antes de aceptar los términos.${_contractIsMinor ? ' <span style="color:var(--amber);font-weight:600;">Este contrato requiere los datos de tu acudiente.</span>' : ''}</div>
      <div class="card mb-md contract-pdf-card">${pdfBlock}</div>
      ${guardianSection}
      ${userSigSection}
      <div class="card">
        <label class="checkbox-cyan" style="margin-bottom:20px;">
          <input type="checkbox" id="contract-checkbox" onchange="toggleAcceptBtn()">
          <span class="checkbox-box"></span>
          <span style="font-size:13px;">He leído y acepto los términos y condiciones de "${_escHtml(_contractActiveTemplate.label)}".</span>
        </label>
        <button class="btn btn-primary" id="contract-accept-btn"
          style="width:100%;justify-content:center;font-size:14px;padding:14px;letter-spacing:2px;opacity:0.4;cursor:not-allowed;"
          disabled onclick="acceptContract()">✓ ACEPTAR CONTRATO</button>
      </div>`;

    if (_contractIsMinor) setTimeout(() => _sigPadInit('guardian-sig-pad'), 0);
    if (!_contractIsMinor) setTimeout(() => _userSigInit(), 0);
  }
}

function toggleAcceptBtn() {
  const cb   = document.getElementById('contract-checkbox');
  const btn  = document.getElementById('contract-accept-btn');
  const hint = document.getElementById('sig-required-hint');
  if (!cb || !btn) return;

  const sigOk = _contractIsMinor ? true : !_userSigIsEmpty();
  const ready = cb.checked && sigOk;

  btn.disabled      = !ready;
  btn.style.opacity = ready ? '1' : '0.4';
  btn.style.cursor  = ready ? 'pointer' : 'not-allowed';

  if (hint) {
    hint.textContent  = sigOk ? '✓ Firma registrada' : 'Firma pendiente';
    hint.style.color  = sigOk ? 'var(--green)' : 'var(--amber)';
  }
}

async function acceptContract() {
  if (!currentUser) return;
  const btn = document.getElementById('contract-accept-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    // The template this specific accept flow is for — set by renderContractPage() to
    // whichever pending template it last rendered the signing UI for. Not "the" global
    // contract: with multiple templates, a stale reference here would sign the wrong one.
    const activeTemplate = _contractActiveTemplate;
    if (!activeTemplate) throw new Error('No hay contrato vigente');

    let guardianData         = null;
    let guardianSignatureUrl = null;
    let userSignatureUrl     = null;

    if (_contractIsMinor) {
      const nombre     = document.getElementById('guardian-nombre')?.value?.trim()     || '';
      const cedula     = document.getElementById('guardian-cedula')?.value?.trim()     || '';
      const parentesco = document.getElementById('guardian-parentesco')?.value?.trim() || '';
      const direccion  = document.getElementById('guardian-direccion')?.value?.trim()  || '';
      const telefono   = document.getElementById('guardian-telefono')?.value?.trim()   || '';
      const celular    = document.getElementById('guardian-celular')?.value?.trim()    || '';

      if (!nombre || !cedula) throw new Error('Por favor completa el nombre y cédula del acudiente');

      guardianData = { nombre, cedula, parentesco, direccion, telefono, celular };

      if (!_sigPadIsEmpty()) {
        try {
          const dataUrl  = _sigPadGetDataUrl();
          const blob     = await (await fetch(dataUrl)).blob();
          const path     = `guardian_signatures/${currentUser.id}_${Date.now()}.png`;
          const { data: upData, error: upErr } = await db.storage
            .from('contracts').upload(path, blob, { contentType: 'image/png' });
          if (!upErr && upData) {
            const { data: urlData } = await db.storage.from('contracts').createSignedUrl(path, 365 * 24 * 3600);
            if (urlData?.signedUrl) guardianSignatureUrl = urlData.signedUrl;
          }
        } catch (_) { /* optional */ }
      }
    } else {
      // Adult: user signature is required
      if (_userSigIsEmpty()) throw new Error('Por favor dibuja tu firma antes de aceptar');

      try {
        const dataUrl = _userSigGetDataUrl();
        const blob    = await (await fetch(dataUrl)).blob();
        const path    = `signatures/${currentUser.id}_${Date.now()}.png`;
        const { data: upData, error: upErr } = await db.storage
          .from('contracts').upload(path, blob, { contentType: 'image/png' });
        if (!upErr && upData) {
          const { data: urlData } = await db.storage.from('contracts').createSignedUrl(path, 365 * 24 * 3600);
          if (urlData?.signedUrl) userSignatureUrl = urlData.signedUrl;
        }
      } catch (_) { /* non-fatal: acceptance still records even if image upload fails */ }
    }

    await acceptContractSupabase(
      currentUser.id, activeTemplate.dbId,
      _contractIsMinor ? 'minor' : 'adult',
      guardianData, guardianSignatureUrl, userSignatureUrl
    );

    const now   = new Date();
    const fecha = now.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
    const hora  = now.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
    const userName = currentUser.full_name || currentUser.name || currentUser.email;
    document.getElementById('firma-nombre').textContent  = userName;
    document.getElementById('firma-email').textContent   = currentUser.email;
    document.getElementById('firma-fecha').textContent   = fecha + ' · ' + hora;
    document.getElementById('firma-version').textContent = activeTemplate.filename || activeTemplate.label;

    // Show signature image in modal if available
    const firmaImgEl = document.getElementById('firma-img-preview');
    if (firmaImgEl) {
      if (userSignatureUrl) {
        firmaImgEl.src   = userSignatureUrl;
        firmaImgEl.style.display = 'block';
      } else if (!_contractIsMinor && !_userSigIsEmpty()) {
        firmaImgEl.src   = _userSigGetDataUrl();
        firmaImgEl.style.display = 'block';
      } else {
        firmaImgEl.style.display = 'none';
      }
    }

    // Store data for comprobante download (sigPdfDataUrl = white-bg version for PDF
    // embedding). Captures this template's own storage paths + minor flag AT THIS MOMENT
    // — by the time downloadComprobante() runs, _contractActiveTemplate may have already
    // advanced to the next pending template, so _generateSignedPDF() must not read that
    // mutable global; it reads these captured fields instead.
    window._lastAcceptance = {
      nombre:       userName,
      id:           currentUser.identification || '—',
      email:        currentUser.email,
      fecha:        fecha + ' · ' + hora,
      version:      activeTemplate.filename || activeTemplate.label,
      sigUrl:       userSignatureUrl || (_userSigIsEmpty() ? null : _userSigGetDataUrl()),
      sigPdfDataUrl: _userSigGetPdfDataUrl(),
      storageAdultPath: activeTemplate.storageAdultPath,
      storageMinorPath: activeTemplate.storageMinorPath,
      isMinor:      _contractIsMinor
    };

    document.getElementById('modal-firma').classList.add('open');
    updateContractBanner();
    updateContractNavBadge();
  } catch (err) {
    toast('Error', err.message || 'No se pudo guardar la aceptación');
    if (btn) { btn.disabled = false; btn.textContent = '✓ ACEPTAR CONTRATO'; }
  }
}


// ── Minimal canvas signature pad ─────────────────────────────────────────────
let _sigPadCanvas = null;
let _sigPadCtx    = null;
let _sigPadDirty  = false;

function _sigPadInit(canvasId) {
  _sigPadCanvas = document.getElementById(canvasId);
  if (!_sigPadCanvas) return;
  _sigPadCtx   = _sigPadCanvas.getContext('2d');
  _sigPadDirty = false;

  const dpr  = window.devicePixelRatio || 1;
  const rect = _sigPadCanvas.getBoundingClientRect();
  _sigPadCanvas.width  = rect.width  * dpr;
  _sigPadCanvas.height = rect.height * dpr;
  _sigPadCtx.scale(dpr, dpr);
  _sigPadCtx.lineWidth   = 1.8;
  _sigPadCtx.lineCap     = 'round';
  _sigPadCtx.lineJoin    = 'round';
  _sigPadCtx.strokeStyle = '#00CFFF';

  let drawing = false;
  const pos = (e) => {
    const r = _sigPadCanvas.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return { x: s.clientX - r.left, y: s.clientY - r.top };
  };

  _sigPadCanvas.addEventListener('mousedown',  e => { drawing = true; const p = pos(e); _sigPadCtx.beginPath(); _sigPadCtx.moveTo(p.x, p.y); });
  _sigPadCanvas.addEventListener('mousemove',  e => { if (!drawing) return; const p = pos(e); _sigPadCtx.lineTo(p.x, p.y); _sigPadCtx.stroke(); _sigPadDirty = true; });
  _sigPadCanvas.addEventListener('mouseup',    () => drawing = false);
  _sigPadCanvas.addEventListener('mouseleave', () => drawing = false);
  _sigPadCanvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; const p = pos(e); _sigPadCtx.beginPath(); _sigPadCtx.moveTo(p.x, p.y); }, { passive: false });
  _sigPadCanvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!drawing) return; const p = pos(e); _sigPadCtx.lineTo(p.x, p.y); _sigPadCtx.stroke(); _sigPadDirty = true; }, { passive: false });
  _sigPadCanvas.addEventListener('touchend',   () => drawing = false);
}

function _sigPadClear() {
  if (!_sigPadCtx || !_sigPadCanvas) return;
  _sigPadCtx.clearRect(0, 0, _sigPadCanvas.width, _sigPadCanvas.height);
  _sigPadDirty = false;
}

function _sigPadIsEmpty()    { return !_sigPadDirty; }
function _sigPadGetDataUrl() { return _sigPadCanvas ? _sigPadCanvas.toDataURL('image/png') : null; }

// ── User (titular) signature pad — independent from guardian pad ──────────────
let _userSigCanvas = null;
let _userSigCtx    = null;
let _userSigDirty  = false;

function _userSigInit() {
  _userSigCanvas = document.getElementById('user-sig-pad');
  if (!_userSigCanvas) return;
  _userSigCtx   = _userSigCanvas.getContext('2d');
  _userSigDirty = false;

  const dpr  = window.devicePixelRatio || 1;
  const rect = _userSigCanvas.getBoundingClientRect();
  _userSigCanvas.width  = rect.width  * dpr;
  _userSigCanvas.height = rect.height * dpr;
  _userSigCtx.scale(dpr, dpr);
  _userSigCtx.lineWidth   = 2;
  _userSigCtx.lineCap     = 'round';
  _userSigCtx.lineJoin    = 'round';
  _userSigCtx.strokeStyle = '#00CFFF';

  let drawing = false;
  const pos = e => {
    const r = _userSigCanvas.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return { x: (s.clientX - r.left), y: (s.clientY - r.top) };
  };
  const onEnd = () => { drawing = false; toggleAcceptBtn(); };

  _userSigCanvas.addEventListener('mousedown',  e => { drawing = true; const p = pos(e); _userSigCtx.beginPath(); _userSigCtx.moveTo(p.x, p.y); });
  _userSigCanvas.addEventListener('mousemove',  e => { if (!drawing) return; const p = pos(e); _userSigCtx.lineTo(p.x, p.y); _userSigCtx.stroke(); _userSigDirty = true; });
  _userSigCanvas.addEventListener('mouseup',    onEnd);
  _userSigCanvas.addEventListener('mouseleave', onEnd);
  _userSigCanvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; const p = pos(e); _userSigCtx.beginPath(); _userSigCtx.moveTo(p.x, p.y); }, { passive: false });
  _userSigCanvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!drawing) return; const p = pos(e); _userSigCtx.lineTo(p.x, p.y); _userSigCtx.stroke(); _userSigDirty = true; }, { passive: false });
  _userSigCanvas.addEventListener('touchend',   onEnd);
}

function _userSigClear() {
  if (!_userSigCtx || !_userSigCanvas) return;
  _userSigCtx.clearRect(0, 0, _userSigCanvas.width, _userSigCanvas.height);
  _userSigDirty = false;
  toggleAcceptBtn();
}

function _userSigIsEmpty()    { return !_userSigDirty; }
function _userSigGetDataUrl() { return _userSigCanvas ? _userSigCanvas.toDataURL('image/png') : null; }

// Returns the signature with white background (for PDF embedding — cyan shows as light blue on white)
function _userSigGetPdfDataUrl() {
  if (!_userSigCanvas || _userSigIsEmpty()) return null;
  const tmp = document.createElement('canvas');
  tmp.width  = _userSigCanvas.width;
  tmp.height = _userSigCanvas.height;
  const ctx  = tmp.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(_userSigCanvas, 0, 0);
  return tmp.toDataURL('image/png');
}

// Generates a signed PDF: original contract + date stamped on page 1 + certificate page at end.
// `d` carries its own storageAdultPath/storageMinorPath/isMinor (captured at
// acceptance/evidence-load time by acceptContract() and showAdminContractEvidence()) so
// this always stamps the SAME template the acceptance was actually for — reading the
// mutable _contractActiveTemplate/_contractIsMinor globals here would be wrong once the
// user has moved on to signing the next pending template.
async function _generateSignedPDF(d) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  const isMinor = d.isMinor !== undefined ? d.isMinor : _contractIsMinor;
  // Get a fresh signed URL for the source PDF
  const storagePath = isMinor
    ? (d.storageMinorPath || d.storageAdultPath || contractState.currentContract.storageMinorPath || contractState.currentContract.storageAdultPath)
    : (d.storageAdultPath || d.storageMinorPath || contractState.currentContract.storageAdultPath || contractState.currentContract.storageMinorPath);
  if (!storagePath) throw new Error('Sin PDF fuente');

  const { data: urlData } = await db.storage.from('contracts').createSignedUrl(storagePath, 300);
  if (!urlData?.signedUrl) throw new Error('No se pudo obtener el contrato');

  const pdfBytes = await fetch(urlData.signedUrl).then(r => r.arrayBuffer());
  const pdfDoc   = await PDFDocument.load(pdfBytes);
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Stamp date on page 1 ────────────────────────────────────────────────────
  const page1   = pdfDoc.getPage(0);
  const { height: p1h } = page1.getSize();
  // Use stored acceptance date if available (admin view), otherwise current date
  const fechaRef   = d.acceptedAt ? new Date(d.acceptedAt) : new Date();
  const fechaCorta = fechaRef.toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
  page1.drawText(fechaCorta, {
    x: 132, y: p1h - 118,
    size: 10, font, color: rgb(0, 0.2, 0.6)
  });

  // ── Stamp signature on last page ────────────────────────────────────────────
  const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);
  const { width: lpw, height: lph } = lastPage.getSize();

  // sigPdfDataUrl = raw canvas (user session); sigImageUrl = stored Supabase URL (admin view)
  const sigSource = d.sigPdfDataUrl || d.sigImageUrl || null;
  if (sigSource) {
    try {
      const sigBytes = await fetch(sigSource).then(r => r.arrayBuffer());
      const sigImg   = await pdfDoc.embedPng(sigBytes);
      const sigH     = 55;
      const sigW     = Math.round(sigImg.width * sigH / sigImg.height);
      lastPage.drawImage(sigImg, { x: 85, y: lph * 0.46 + 5, width: sigW, height: sigH });
    } catch (_) { /* if CORS or fetch fails, skip image — text still stamps */ }
  }
  // Name and date below signature line
  lastPage.drawText(d.nombre,      { x: 85, y: lph * 0.46 - 14, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
  lastPage.drawText(d.fecha,       { x: 85, y: lph * 0.46 - 26, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  lastPage.drawText(`CC: ${d.id}`, { x: 85, y: lph * 0.46 - 38, size: 7, font, color: rgb(0.4, 0.4, 0.4) });

  // ── Certificate page ────────────────────────────────────────────────────────
  const cert  = pdfDoc.addPage([595.28, 841.89]);
  const cw    = 595.28;
  const ch    = 841.89;
  const cyan  = rgb(0, 0.812, 1);
  const black = rgb(0, 0, 0);
  const gray  = rgb(0.45, 0.45, 0.45);
  const lgray = rgb(0.92, 0.92, 0.92);

  // Header bar
  cert.drawRectangle({ x: 0, y: ch - 70, width: cw, height: 70, color: rgb(0.04, 0.04, 0.04) });
  cert.drawRectangle({ x: 0, y: ch - 73, width: cw, height: 3,  color: cyan });
  cert.drawText('CERTIFICADO DE FIRMA DIGITAL', { x: 50, y: ch - 38, size: 15, font: fontBold, color: rgb(1,1,1) });
  cert.drawText('THOR TRAINING SAS  ·  #elbunkerdelafuerza', { x: 50, y: ch - 56, size: 9, font, color: rgb(0.6,0.8,1) });

  // Badge
  cert.drawRectangle({ x: 50, y: ch - 115, width: 190, height: 28, color: rgb(0.88,1,0.93), borderColor: rgb(0.4,0.8,0.5), borderWidth: 1 });
  cert.drawText('✓  CONTRATO ACEPTADO', { x: 60, y: ch - 106, size: 11, font: fontBold, color: rgb(0.1, 0.5, 0.2) });

  // Data rows
  const rows = [
    ['Nombre completo:',  d.nombre],
    ['Documento:',        d.id],
    ['Email:',            d.email],
    ['Fecha y hora:',     d.fecha],
    ['Versión contrato:', d.version],
  ];
  let y = ch - 155;
  for (const [label, value] of rows) {
    cert.drawRectangle({ x: 50, y: y - 5, width: cw - 100, height: 20, color: lgray });
    cert.drawText(label, { x: 58,  y, size: 9, font: fontBold, color: gray });
    cert.drawText(value, { x: 210, y, size: 9, font, color: black });
    y -= 24;
  }

  // Signature block
  y -= 20;
  cert.drawText('Firma del titular:', { x: 50, y, size: 10, font: fontBold, color: gray });
  y -= 8;
  cert.drawRectangle({ x: 50, y: y - 75, width: 260, height: 80, color: rgb(1,1,1), borderColor: rgb(0.7,0.7,0.7), borderWidth: 0.8 });
  const sigSource2 = d.sigPdfDataUrl || d.sigImageUrl || null;
  if (sigSource2) {
    try {
      const sigBytes2 = await fetch(sigSource2).then(r => r.arrayBuffer());
      const sigImg2   = await pdfDoc.embedPng(sigBytes2);
      const sH        = 68;
      const sW        = Math.round(sigImg2.width * sH / sigImg2.height);
      cert.drawImage(sigImg2, { x: 54, y: y - 72, width: Math.min(sW, 252), height: sH });
    } catch (_) { /* skip image if fetch fails */ }
  }
  y -= 90;
  cert.drawLine({ start:{x:50, y}, end:{x:310, y}, thickness: 0.5, color: rgb(0.5,0.5,0.5) });
  y -= 13;
  cert.drawText(d.nombre,    { x: 50, y, size: 8, font, color: gray });
  cert.drawText(`CC: ${d.id}`, { x: 50, y: y - 12, size: 8, font, color: gray });

  // Legal note
  cert.drawRectangle({ x: 40, y: 50, width: cw - 80, height: 55, color: rgb(0.96,0.96,0.96), borderColor: rgb(0.82,0.82,0.82), borderWidth: 0.5 });
  cert.drawText('Este documento tiene validez como firma electrónica conforme a la Ley 527 de 1999',  { x: 50, y: 92, size: 7.5, font, color: rgb(0.4,0.4,0.4) });
  cert.drawText('(Ley de Comercio Electrónico de Colombia). La aceptación fue registrada con fecha,', { x: 50, y: 80, size: 7.5, font, color: rgb(0.4,0.4,0.4) });
  cert.drawText('hora y firma digital del suscrito, almacenada en los sistemas de Thor Training SAS.', { x: 50, y: 68, size: 7.5, font, color: rgb(0.4,0.4,0.4) });
  cert.drawText(`Generado: ${new Date().toLocaleString('es-CO')}`, { x: 50, y: 56, size: 7, font, color: rgb(0.6,0.6,0.6) });

  return await pdfDoc.save();
}

async function downloadComprobante() {
  const d = window._lastAcceptance;
  if (!d) return;

  const btn = document.querySelector('[onclick="downloadComprobante()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando PDF...'; }

  try {
    if (typeof PDFLib !== 'undefined') {
      const pdfBytes = await _generateSignedPDF(d);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `contrato-firmado-thor-training-${d.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      throw new Error('pdf-lib no disponible');
    }
  } catch (err) {
    console.warn('[comprobante] PDF generation failed, falling back to print:', err);
    // HTML fallback
    const sigBlock = d.sigUrl
      ? `<div style="margin-top:24px;border-top:1px solid #ccc;padding-top:16px;">
           <div style="font-size:11px;color:#666;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">Firma del titular</div>
           <img src="${d.sigUrl}" style="max-width:260px;height:80px;object-fit:contain;border:1px solid #ddd;border-radius:6px;padding:6px;background:#fff;">
         </div>`
      : '<div style="margin-top:24px;border-top:1px solid #ccc;padding-top:16px;font-size:12px;color:#666;">Firma registrada electrónicamente</div>';
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>Comprobante — Thor Training</title>
      <style>body{font-family:Arial,sans-serif;max-width:680px;margin:40px auto;padding:0 24px;color:#111}
      h1{font-size:22px;border-bottom:2px solid #00CFFF;padding-bottom:12px}
      table{width:100%;border-collapse:collapse}td{padding:9px 12px;border-bottom:1px solid #eee;font-size:13px}
      td:first-child{color:#666;width:160px;font-weight:600}
      .footer{margin-top:32px;font-size:10px;color:#999;text-align:center;border-top:1px solid #eee;padding-top:16px}
      @media print{body{margin:20px}}</style></head><body>
      <h1>THOR TRAINING — Comprobante de Firma</h1>
      <table>
        <tr><td>Nombre</td><td>${d.nombre}</td></tr>
        <tr><td>Documento</td><td>${d.id}</td></tr>
        <tr><td>Email</td><td>${d.email}</td></tr>
        <tr><td>Fecha y hora</td><td>${d.fecha}</td></tr>
        <tr><td>Versión contrato</td><td>${d.version}</td></tr>
      </table>${sigBlock}
      <div class="footer">Firma electrónica válida bajo Ley 527 de 1999</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Descargar comprobante'; }
  }
}

// ---- Admin: evidence modal ----

function showAdminContractEvidence(userId) {
  const d = (window._adminEvidenceStore || {})[userId];
  if (!d) return;

  const dt      = d.acceptedAt ? new Date(d.acceptedAt) : null;
  const fechaFmt = dt
    ? dt.toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' }) + ' · ' + dt.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
    : '—';

  document.getElementById('admin-ev-nombre').textContent = d.nombre;
  document.getElementById('admin-ev-cedula').textContent = d.cedula;
  document.getElementById('admin-ev-email').textContent  = d.email;
  document.getElementById('admin-ev-fecha').textContent  = fechaFmt;
  document.getElementById('admin-ev-tipo').textContent   = d.contractType === 'minor' ? 'Menor de edad' : 'Mayor de edad';
  document.getElementById('admin-ev-version').textContent = d.version || '—';

  const imgEl  = document.getElementById('admin-ev-sig-img');
  const noSig  = document.getElementById('admin-ev-no-sig');
  const sigUrl = d.sigUrl || d.guardianSigUrl;
  if (sigUrl) {
    imgEl.src            = sigUrl;
    imgEl.style.display  = 'block';
    noSig.style.display  = 'none';
  } else {
    imgEl.style.display  = 'none';
    noSig.style.display  = 'block';
  }

  // Store for comprobante generation. storageAdultPath/storageMinorPath/isMinor come from
  // the SAME template this acceptance row belongs to (captured in
  // renderContractUsersTable()'s _adminEvidenceStore build) — required so
  // _generateSignedPDF() stamps the right source PDF now that several templates exist.
  window._adminComprobanteData = {
    nombre:      d.nombre,
    id:          d.cedula,
    email:       d.email,
    fecha:       fechaFmt,
    version:     d.version || '—',
    acceptedAt:  d.acceptedAt,
    sigImageUrl: sigUrl || null,
    storageAdultPath: d.storageAdultPath || null,
    storageMinorPath: d.storageMinorPath || null,
    isMinor:     d.contractType === 'minor'
  };

  document.getElementById('modal-admin-evidencia').classList.add('open');
}

function closeAdminEvidenciaModal() {
  document.getElementById('modal-admin-evidencia').classList.remove('open');
}

async function downloadAdminComprobante() {
  const d = window._adminComprobanteData;
  if (!d) return;

  const btn = document.getElementById('admin-ev-download-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando PDF...'; }

  try {
    if (typeof PDFLib !== 'undefined') {
      const pdfBytes = await _generateSignedPDF(d);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `contrato-firmado-${d.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      throw new Error('pdf-lib no disponible');
    }
  } catch (err) {
    console.warn('[admin comprobante] error:', err);
    toast('Error', 'No se pudo generar el PDF. Intenta desde el perfil del usuario.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⬇ Descargar comprobante PDF'; }
  }
}

function closeFirmaModal() {
  document.getElementById('modal-firma').classList.remove('open');
  renderContractPage();
}

function downloadContract(templateKey) {
  const t = (templateKey && _contractTemplates.find(x => x.templateKey === templateKey)) || _contractTemplates[0] || contractState.currentContract;
  if (t?.url) {
    const a    = document.createElement('a');
    a.href     = t.url;
    a.download = t.filename || contractState.currentContract.filename;
    a.click();
  } else {
    toast('Sin archivo', 'El administrador aún no ha cargado el PDF');
  }
}

// ---- Admin side ----

async function renderAdminContractsPage() {
  await _loadContractTemplates();
  renderContractTemplatesSection();
  _populateContractsTemplateSelect();
  renderContractUsersTable();
}

// Admin roster + acceptances for ONE template — Fase 4.2 scopes this whole section to
// `_contractsAdminTemplateKey` (selected via the "Plantilla" dropdown) instead of "the"
// single global contract, since several templates can now be current at once.
async function _loadContractAdminUsers() {
  const template = _contractTemplates.find(t => t.templateKey === _contractsAdminTemplateKey) || _contractTemplates[0] || null;
  const { data: usersData } = await db.from('users').select('id, full_name, email, identification, memberships!user_id(plans(name))').eq('role', 'user');
  const users = usersData || [];
  if (!template?.dbId) return { users, template: null, acceptanceMap: {} };

  const { data: acceptances } = await db
    .from('contract_acceptances')
    .select('user_id, accepted_at, signature_url, guardian_signature_url, contract_type')
    .eq('contract_id', template.dbId);

  // acceptanceMap[userId] = full acceptance record (for this template only)
  const acceptanceMap = {};
  acceptances?.forEach(a => { acceptanceMap[a.user_id] = a; });

  return { users, template, acceptanceMap };
}

// One card per current template + a "+ Nueva plantilla" action. Replaces the old
// single-contract renderContractUploadSection().
function renderContractTemplatesSection() {
  const el = document.getElementById('admin-contract-doc');
  if (!el) return;

  const cards = _contractTemplates.map(t => `
    <div class="card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:44px;height:44px;background:rgba(0,207,255,0.1);border:1px solid rgba(0,207,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">📄</div>
          <div>
            <div style="font-weight:700;font-size:11px;letter-spacing:1px;color:var(--cyan);text-transform:uppercase;">${_escHtml(t.label)}</div>
            <div style="font-weight:600;font-size:14px;margin-top:2px;">${_escHtml(t.filename || 'Sin archivo')}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">${t.uploadedAt ? 'Subido el ' + t.uploadedAt : ''}${t.size ? ' · ' + t.size : ''}</div>
            <div style="margin-top:6px;">${t.url
              ? '<span class="badge badge-green">PDF cargado</span>'
              : '<span class="badge badge-amber">Sin archivo — pendiente de carga</span>'}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${t.url ? `<button class="btn btn-outline btn-sm" onclick="openAdminPDFPreview('${t.templateKey}')">👁 Vista previa</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pdf-upload-input-${t.templateKey}').click()">
            ⬆ ${t.url ? 'Reemplazar contrato' : 'Subir contrato PDF'}
          </button>
          <input type="file" id="pdf-upload-input-${t.templateKey}" accept=".pdf" style="display:none;" onchange="handlePDFUpload(this,'${t.templateKey}')">
        </div>
      </div>
    </div>`).join('');

  el.innerHTML = (cards || '<div style="color:var(--muted);font-size:13px;margin-bottom:12px;">Sin plantillas de contrato configuradas.</div>')
    + `<button class="btn btn-ghost btn-sm" onclick="abrirNuevaPlantillaContrato()">+ Nueva plantilla de contrato</button>`;
}

function _populateContractsTemplateSelect() {
  const sel = document.getElementById('contracts-template-select');
  if (!sel) return;
  sel.innerHTML = _contractTemplates.length
    ? _contractTemplates.map(t => `<option value="${t.templateKey}" ${t.templateKey === _contractsAdminTemplateKey ? 'selected' : ''}>${_escHtml(t.label)}</option>`).join('')
    : '<option value="">Sin plantillas</option>';
}

function onContractsTemplateChange(sel) {
  _contractsAdminTemplateKey = sel.value || null;
  renderContractUsersTable(contractFilter);
}

function abrirNuevaPlantillaContrato() {
  const labelEl = document.getElementById('ncp-label');
  if (labelEl) labelEl.value = '';
  openModal('nueva-plantilla-contrato');
}

// Creates a new (initially empty) template row. Its own template_key means an admin can
// upload its PDF afterward, and later replace it, without ever touching any OTHER
// template's contract_acceptances rows (see confirmReplaceContract()).
async function guardarNuevaPlantillaContrato() {
  const label = (document.getElementById('ncp-label')?.value || '').trim();
  if (!label) { toast('Campo requerido', 'Escribe un nombre para la plantilla'); return; }

  let key = label.toLowerCase()
    .normalize('NFD').replace(new RegExp('[̀-ͯ]', 'g'), '') // strip accents
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) key = 'plantilla';
  if (key === LEGACY_TEMPLATE_KEY || _contractTemplates.some(t => t.templateKey === key)) {
    key = `${key}_${Date.now().toString(36)}`;
  }

  const btn = document.querySelector('#modal-nueva-plantilla-contrato .btn-primary');
  if (btn) { btn.textContent = 'Creando…'; btn.disabled = true; }

  try {
    const { error } = await db.from('contracts').insert({
      template_key: key, label, is_current: true, version: null
    });
    if (error && /does not exist/i.test(error.message || '')) {
      throw new Error('Esta función requiere correr la migración 20260820_contracts_multiple_templates.sql en Supabase primero.');
    }
    if (error) throw error;

    _contractTemplatesReady = false;
    await _loadContractTemplates(true);
    closeModal('modal-nueva-plantilla-contrato');
    toast('Plantilla creada', label);
    renderContractTemplatesSection();
    _populateContractsTemplateSelect();
  } catch (err) {
    toast('Error al crear plantilla', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Crear plantilla'; btn.disabled = false; }
  }
}

function handlePDFUpload(input, templateKey) {
  const file = input.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    toast('Formato inválido', 'Solo se aceptan archivos PDF');
    input.value = '';
    return;
  }
  templateKey = templateKey || LEGACY_TEMPLATE_KEY;
  const existing = _contractTemplates.find(t => t.templateKey === templateKey);
  if (existing?.url) {
    window._pendingContractFile = file;
    window._pendingContractTemplateKey = templateKey;
    const labelEl = document.getElementById('replace-contract-label');
    if (labelEl) labelEl.textContent = existing.label;
    document.getElementById('modal-replace-contract').classList.add('open');
  } else {
    applyPDFUpload(file, templateKey);
  }
  input.value = '';
}

// Uploads a template's PDF variant (adult/minor, by MENOR filename match — same
// heuristic as before) into that template's own storage prefix (root for the legacy
// template, `<template_key>/` for any other) and upserts its `contracts` row.
async function applyPDFUpload(file, templateKey) {
  templateKey = templateKey || LEGACY_TEMPLATE_KEY;
  const isMinorPdf = /menor/i.test(file.name);
  const prefix = templateKey === LEGACY_TEMPLATE_KEY ? '' : `${templateKey}/`;
  const storagePath = prefix + (isMinorPdf ? 'consentimiento-menor.pdf' : 'consentimiento-mayor.pdf');

  try {
    const { error: upErr } = await db.storage
      .from('contracts')
      .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;

    // Force re-fetch from storage on next call
    _contractTemplatesReady = false;
    await _loadContractTemplates(true);

    // Ensure this template's DB record exists and is marked current
    const existing = _contractTemplates.find(t => t.templateKey === templateKey);
    if (!existing?.dbId) {
      let { error: insErr } = await db.from('contracts').insert({
        version: file.name, is_current: true, template_key: templateKey,
        label: templateKey === LEGACY_TEMPLATE_KEY ? 'Contrato de membresía' : templateKey
      });
      if (insErr && /does not exist/i.test(insErr.message || '')) {
        ({ error: insErr } = await db.from('contracts').insert({ version: file.name, is_current: true }));
      }
      if (insErr) throw insErr;
    } else {
      const { error: updErr } = await db.from('contracts').update({ version: file.name }).eq('id', existing.dbId);
      if (updErr) throw updErr;
    }

    _contractTemplatesReady = false;
    await _loadContractTemplates(true);
    toast('Contrato subido', file.name + ' guardado en Supabase');
  } catch (err) {
    console.error('[contracts] upload error', err);
    toast('Error al subir', 'No se pudo guardar el PDF en Supabase');
  }

  renderContractTemplatesSection();
}

// THE key correctness fix for Fase 4.2: replacing a template's PDF must only invalidate
// THAT template's acceptances, never every template's. Before, with a single global
// contract row, a blanket `contract_acceptances.delete()` was correct — now that several
// templates can be current simultaneously, the same blanket delete would incorrectly
// un-sign every member's OTHER templates too (e.g. replacing "Reglamento" would have also
// wiped everyone's already-accepted "Contrato de membresía"). Scoped to
// `template.dbId` (this one template's own `contracts.id`) instead.
async function confirmReplaceContract() {
  document.getElementById('modal-replace-contract').classList.remove('open');
  const file = window._pendingContractFile;
  const templateKey = window._pendingContractTemplateKey || LEGACY_TEMPLATE_KEY;
  if (!file) return;

  const template = _contractTemplates.find(t => t.templateKey === templateKey);
  if (template?.dbId) {
    await db.from('contract_acceptances').delete().eq('contract_id', template.dbId);
  }

  await applyPDFUpload(file, templateKey);
  renderContractUsersTable();
  toast('Contrato reemplazado', `Las aceptaciones previas de "${template?.label || templateKey}" fueron invalidadas (las demás plantillas no se ven afectadas)`);
  window._pendingContractFile = null;
  window._pendingContractTemplateKey = null;
}

function cancelReplaceContract() {
  document.getElementById('modal-replace-contract').classList.remove('open');
  window._pendingContractFile = null;
  window._pendingContractTemplateKey = null;
}

function openAdminPDFPreview(templateKey) {
  const t = (templateKey && _contractTemplates.find(x => x.templateKey === templateKey)) || _contractTemplates[0];
  const frame = document.getElementById('admin-pdf-frame');
  if (frame && t?.url) {
    frame.src = t.url;
    document.getElementById('modal-pdf-preview').classList.add('open');
  }
}

async function renderContractUsersTable(filter) {
  if (filter !== undefined) contractFilter = filter;
  const tbody   = document.getElementById('contracts-tbody');
  const summary = document.getElementById('contracts-summary');
  if (!tbody) return;

  tbody.innerHTML = _loaderRow(6);

  const { users, template, acceptanceMap = {} } = await _loadContractAdminUsers();
  const colorKeys = ['cyan', 'purple', 'orange', 'red'];
  const bgMap = { cyan:'rgba(0,207,255,0.15)', purple:'rgba(155,89,255,0.15)', orange:'rgba(255,107,53,0.15)', red:'rgba(255,59,92,0.15)' };
  const fgMap = { cyan:'var(--cyan)', purple:'var(--purple)', orange:'var(--orange)', red:'var(--red)' };

  // Populate evidence store so the modal can access per-user data without inline JSON.
  // Scoped to the selected template — storageAdultPath/storageMinorPath are carried
  // along so showAdminContractEvidence() can regenerate the correct signed PDF later.
  window._adminEvidenceStore = {};
  const enriched = users.map(u => {
    const nombre  = u.full_name || u.name || u.email || '?';
    const acc     = acceptanceMap[u.id] || null;
    if (acc) {
      window._adminEvidenceStore[u.id] = {
        nombre,
        cedula:       u.identification || '—',
        email:        u.email,
        acceptedAt:   acc.accepted_at,
        sigUrl:       acc.signature_url || null,
        guardianSigUrl: acc.guardian_signature_url || null,
        contractType: acc.contract_type || 'adult',
        version:      template?.filename || '—',
        storageAdultPath: template?.storageAdultPath || null,
        storageMinorPath: template?.storageMinorPath || null
      };
    }
    return {
      id:         u.id,
      nombre,
      email:      u.email,
      plan:       u.memberships?.[0]?.plans?.name || 'Sin plan',
      avatar:     nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      color:      colorKeys[nombre.charCodeAt(0) % colorKeys.length],
      accepted:   !!acc,
      acceptedAt: acc?.accepted_at || null
    };
  });

  const total         = enriched.length;
  const totalAccepted = enriched.filter(u => u.accepted).length;
  const pct           = total ? Math.round(totalAccepted / total * 100) : 0;

  if (summary) {
    summary.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;"><span style="color:var(--cyan);font-weight:700;">${totalAccepted}</span> de <span style="font-weight:600;">${total}</span> usuarios han aceptado ${template ? '"' + _escHtml(template.label) + '"' : 'esta plantilla'}</span>
        <span style="font-size:12px;color:var(--muted2);">${pct}%</span>
      </div>
      <div class="progress-bar" style="height:8px;"><div class="progress-fill" style="width:${pct}%;transition:width 0.6s;"></div></div>`;
  }

  const filtered = enriched.filter(u => {
    if (contractFilter === 'aceptados')  return  u.accepted;
    if (contractFilter === 'pendientes') return !u.accepted;
    return true;
  });

  tbody.innerHTML = filtered.map(u => {
    const fecha = u.accepted && u.acceptedAt
      ? new Date(u.acceptedAt).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
      : '—';
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:9px;">
        <div style="width:30px;height:30px;font-size:11px;background:${bgMap[u.color]};color:${fgMap[u.color]};font-family:'Outfit';font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${u.avatar}</div>
        <span style="font-weight:500;font-size:13px;">${u.nombre}</span>
      </div></td>
      <td style="color:var(--muted);font-size:12px;">${u.email}</td>
      <td><span class="badge badge-muted">${u.plan}</span></td>
      <td>${u.accepted
        ? '<span class="badge badge-green">✓ Aceptado</span>'
        : '<span class="badge badge-amber">⏳ Pendiente</span>'}</td>
      <td style="color:var(--muted);font-size:12px;">${fecha}</td>
      <td>${u.accepted
        ? `<button class="btn btn-outline btn-sm" style="font-size:11px;padding:5px 10px;" onclick="showAdminContractEvidence('${u.id}')">🔍 Ver evidencia</button>`
        : `<button class="btn btn-ghost btn-sm" onclick="sendContractReminder('${u.id}','${u.email.replace(/'/g, "\\'")}','${u.nombre.replace(/'/g, "\\'")}')">Recordatorio</button>`}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px 0;">Sin usuarios</td></tr>';

  ['todos','aceptados','pendientes'].forEach(f => {
    const btn = document.getElementById('filter-' + f);
    if (btn) btn.classList.toggle('active', contractFilter === f);
  });
}

// Previously only did a console.log and always toasted "enviado" — never actually
// called send-message, so the reminder never really went out. Now sends for real via
// Resend and only reports success on a genuine send-message response.
async function sendContractReminder(userId, email, nombre) {
  const btn = document.querySelector(`button[onclick*="sendContractReminder('${userId}'"]`);
  if (btn) { btn.textContent = 'Enviando…'; btn.disabled = true; }
  try {
    const { data, error } = await db.functions.invoke('send-message', {
      body: {
        subject: 'Recordatorio: firma tu contrato',
        body:    `Hola ${nombre}, tienes un contrato pendiente de aceptar en tu perfil de Thor Training.`,
        channel: 'email',
        recipient_filter: 'specific',
        user_ids: [userId],
      },
    });
    if (error || data?.success === false || (data?.email_sent ?? 0) === 0) {
      throw new Error(data?.error || error?.message || 'No se pudo enviar el correo');
    }
    toast('Recordatorio enviado', nombre + ' · ' + email);
  } catch (err) {
    toast('Error al enviar', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Recordatorio'; btn.disabled = false; }
  }
}

async function exportContractsCSV() {
  const { users, template, acceptanceMap = {} } = await _loadContractAdminUsers();
  const rows = [['Nombre','Email','Plan','Estado','Fecha aceptación']];
  users.forEach(u => {
    const acc        = acceptanceMap[u.id];
    const acceptedAt = acc?.accepted_at || null;
    const fecha      = acceptedAt ? new Date(acceptedAt).toLocaleString('es-CO') : '';
    rows.push([
      u.full_name || u.name || u.email,
      u.email,
      u.memberships?.[0]?.plans?.name || 'Sin plan',
      acceptedAt ? 'Aceptado' : 'Pendiente',
      fecha
    ]);
  });
  const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `contratos-${template?.templateKey || 'thor-training'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exportado', a.download + ' descargado');
}

// ===================== PERSONAL MODULE =====================

let _personalData = [];
let _personalSpecialtyFilter = 'TODOS';
const _expandedInactiveSpecialties = new Set();

// Task B: admin-defined custom document folders, merged into _getVisibleDocCategories().
// Loaded once per session (enterApp) and refreshed after any admin add/delete action.
// Includes inactive rows too (Phase 3.4, 2026-07-13) — a disabled row against a built-in
// docCategories key is how a fixed/built-in folder gets "deleted"; _getVisibleDocCategories
// filters those out, while the merge step still only shows active custom ones.
let _customDocCategories = [];
async function _loadCustomDocCategories() {
  try {
    const { data } = await db.from('document_categories').select('id, key, label, contract_types, is_active');
    _customDocCategories = data || [];
  } catch (_) { /* table may not exist yet until the migration runs */ }
}

function abrirNuevaCarpetaDocumento() {
  const labelEl = document.getElementById('ncd-label');
  if (labelEl) labelEl.value = '';
  document.querySelectorAll('.ncd-contract-cb').forEach(cb => { cb.checked = false; });
  openModal('nueva-carpeta-doc');
}

async function guardarNuevaCarpetaDocumento() {
  const label = (document.getElementById('ncd-label')?.value || '').trim();
  if (!label) { toast('Campo requerido', 'Escribe un nombre para la carpeta'); return; }

  // Slugify to a stable key; collide-guard by appending a short suffix if needed
  let key = label.toLowerCase()
    .normalize('NFD').replace(new RegExp('[̀-ͯ]', 'g'), '') // strip accents
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) key = 'carpeta';
  if (docCategories.some(c => c.key === key) || _customDocCategories.some(c => c.key === key)) {
    key = `${key}_${Date.now().toString(36)}`;
  }

  const contractTypes = Array.from(document.querySelectorAll('.ncd-contract-cb:checked')).map(cb => cb.value);

  const modal = document.getElementById('modal-perfil-empleado');
  const userId = modal?._empId;
  const btn = document.querySelector('#modal-nueva-carpeta-doc .btn-primary');
  if (btn) { btn.textContent = 'Creando…'; btn.disabled = true; }

  try {
    const { error } = await db.from('document_categories').insert({
      key,
      label,
      contract_types: contractTypes.length ? contractTypes : null,
      created_by: currentUser?.id || null,
    });
    if (error) throw error;
    await _loadCustomDocCategories();
    closeModal('modal-nueva-carpeta-doc');
    toast('Carpeta creada', label);
    if (userId) await loadDocsTab(userId, currentUser?.role !== 'admin');
  } catch (err) {
    toast('Error al crear carpeta', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Crear carpeta'; btn.disabled = false; }
  }
}

// Soft-delete: keeps historical employee_documents rows intact, just stops the folder
// from appearing in _getVisibleDocCategories() for future uploads. Works for both custom
// folders (updates their existing document_categories row) and, since 2026-07-13 (Phase
// 3.4), built-in/fixed folders — which have no row yet, so one is created on demand with
// is_active:false so _getVisibleDocCategories can exclude that built-in key.
async function eliminarCarpetaDocumento(key, label) {
  if (!confirm(`¿Eliminar la carpeta "${label}"? Los documentos ya subidos en ella no se borran, pero la carpeta dejará de mostrarse. Puedes restaurarla luego desde "Carpetas eliminadas".`)) return;
  try {
    const existing = _customDocCategories.find(c => c.key === key);
    if (existing) {
      const { error } = await db.from('document_categories').update({ is_active: false }).eq('key', key);
      if (error) throw error;
    } else {
      const { error } = await db.from('document_categories').insert({
        key, label, contract_types: null, is_active: false, created_by: currentUser?.id || null,
      });
      if (error) throw error;
    }
    await _loadCustomDocCategories();
    toast('Carpeta eliminada', label);
    const modal = document.getElementById('modal-perfil-empleado');
    const userId = modal?._empId;
    if (userId) await loadDocsTab(userId, currentUser?.role !== 'admin');
  } catch (err) {
    toast('Error al eliminar carpeta', err.message || 'Intenta de nuevo');
  }
}

// Reactivates a previously-deleted folder (built-in or custom) — Phase 3.4, 2026-07-13.
async function restaurarCarpetaDocumento(key, label) {
  try {
    const { error } = await db.from('document_categories').update({ is_active: true }).eq('key', key);
    if (error) throw error;
    await _loadCustomDocCategories();
    toast('Carpeta restaurada', label);
    const modal = document.getElementById('modal-perfil-empleado');
    const userId = modal?._empId;
    if (userId) await loadDocsTab(userId, currentUser?.role !== 'admin');
  } catch (err) {
    toast('Error al restaurar carpeta', err.message || 'Intenta de nuevo');
  }
}

const docCategories = [
  { key: 'hoja_vida',             label: 'Hoja de vida' },
  { key: 'contrato',              label: 'Contrato de vinculación' },
  { key: 'eps',                   label: 'EPS (afiliación)' },
  { key: 'caja',                  label: 'Caja de compensación' },
  { key: 'arl',                   label: 'ARL' },
  { key: 'cedula',                label: 'Cédula de ciudadanía' },
  { key: 'certificado_medico',    label: 'Exámenes médicos' },
  { key: 'certificado_bancario',  label: 'Certificado bancario' },
  { key: 'seguridad_social',      label: 'Seguridad Social' },
  { key: 'tarjeta_entrenador',    label: 'Tarjeta de entrenador deportivo' }, // F1: vinculado only
  { key: 'cuenta_cobro',          label: 'Cuenta de cobro' }, // 2026-07-06: PS only
  { key: 'otros',                 label: 'Otros documentos' }
];

const retirementDocCategories = [
  { key: 'retiro_arl',              label: 'Retiro ARL' },
  { key: 'retiro_eps',              label: 'Retiro EPS' },
  { key: 'retiro_caja_compensacion', label: 'Retiro Caja de Compensación' },
  { key: 'liquidacion',             label: 'Liquidación' },
];

const empColors = {
  cyan:   { fg: 'var(--cyan)',   bg: 'rgba(0,207,255,0.15)'  },
  purple: { fg: 'var(--purple)', bg: 'rgba(155,89,255,0.15)' },
  orange: { fg: 'var(--orange)', bg: 'rgba(255,107,53,0.15)' },
  red:    { fg: 'var(--red)',    bg: 'rgba(255,59,92,0.15)'  }
};

const _empRoleLabel = { admin: 'Administrador', instructor: 'Instructor', employee: 'Empleado' };

function _mapDbUserToEmp(u, docsSet) {
  const name     = u.full_name || u.email || '?';
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colorKey = ciColorKeys[name.charCodeAt(0) % ciColorKeys.length];
  return {
    id:               u.id,
    nombre:           name,
    email:            u.email          || '',
    cargo:            u.position       || _empRoleLabel[u.role] || u.role,
    role:             u.role           || 'employee',
    estado:           u.is_active !== false ? 'activo' : 'inactivo',
    fechaVinculacion: u.created_at     ? _bogotaDateOf(u.created_at) : '—',
    telefono:         u.phone          || '—',
    avatar:           initials,
    color:            colorKey,
    cedula:           u.id_number      || '—',
    fechaNacimiento:  u.birth_date      ? String(u.birth_date).slice(0, 10)      : '—',
    direccion:        u.address        || '—',
    contactoEmergencia: {
      nombre:      u.emergency_contact_name         || '—',
      parentesco:  u.emergency_contact_relationship || '—',
      telefono:    u.emergency_contact_phone        || '—'
    },
    tipoContrato:    u.contract_type         || null,
    contratoFinDate: u.contract_end_date ? String(u.contract_end_date).slice(0, 10) : null,
    banco:           u.bank_name             || null,
    tipoCuenta:      u.bank_account_type     || null,
    numeroCuenta:    u.bank_account_number   || null,
    specialty:       u.specialty             || null,
    historyNote:     u.staff_history_note    || null,
    canEditEvaluations: !!u.can_edit_evaluations,
    evaluacionesHidden: !!u.evaluaciones_hidden,
    docsCount: docsSet ? docsSet.size : 0
  };
}

// Predefined sort order for specialty groups.
// Includes both explicit specialty values AND role-based fallback group names.
const _SPECIALTY_ORDER = [
  'Entrenador Cycling',
  'Entrenador Pilates',
  'Entrenador Funcional',
  'Instructores',     // fallback when role=instructor and specialty is null
  'Recepción',
  'Administración',
  'Empleados',        // fallback when role=employee and specialty is null
  'Otro',
];

// Derives the effective display group for a staff member.
// Uses specialty when it has been explicitly set; falls back to a role-based
// label so the list is grouped meaningfully even before specialty is assigned.
function _effectiveGroup(emp) {
  if (emp.specialty) return emp.specialty;
  if (emp.role === 'admin')      return 'Administración';
  if (emp.role === 'reception')  return 'Recepción';
  if (emp.role === 'instructor') return 'Instructores';
  return 'Empleados';
}

function _setPersonalSpecialtyFilter(spec) {
  _personalSpecialtyFilter = spec;
  _renderPersonalList();
}

function toggleSpecialtyInactive(spec) {
  if (_expandedInactiveSpecialties.has(spec)) {
    _expandedInactiveSpecialties.delete(spec);
  } else {
    _expandedInactiveSpecialties.add(spec);
  }
  _renderPersonalList();
}

function _renderPersonalList() {
  const container = document.getElementById('personal-list');
  if (!container) return;
  const today = _bogotaToday();

  // ── Build and render specialty filter chips ───────────────────────────────
  const specsInData = new Set(_personalData.map(_effectiveGroup));
  // Reset stale filter (e.g. 'Sin especialidad' from before the fallback was added)
  if (_personalSpecialtyFilter !== 'TODOS' && !specsInData.has(_personalSpecialtyFilter)) {
    _personalSpecialtyFilter = 'TODOS';
  }
  const orderedChips = ['TODOS',
    ..._SPECIALTY_ORDER.filter(s => specsInData.has(s)),
    ...[...specsInData].filter(s => !_SPECIALTY_ORDER.includes(s)),
  ];
  const tabsEl = document.getElementById('personal-specialty-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = orderedChips.map(spec =>
      `<button class="uf-chip uf-chip-status${_personalSpecialtyFilter === spec ? ' uf-chip-active' : ''}" onclick="_setPersonalSpecialtyFilter('${spec.replace(/'/g, "\\'")}')">
        ${spec === 'TODOS' ? 'TODOS' : spec.toUpperCase()}
      </button>`
    ).join('');
  }

  // ── Filter by selected group ──────────────────────────────────────────────
  const filtered = _personalSpecialtyFilter === 'TODOS'
    ? _personalData
    : _personalData.filter(e => _effectiveGroup(e) === _personalSpecialtyFilter);

  if (!filtered.length) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">No hay personal registrado${_personalSpecialtyFilter !== 'TODOS' ? ' en esta categoría' : ''}</div>`;
    return;
  }

  // ── Group by effective group ──────────────────────────────────────────────
  const groups = {};
  filtered.forEach(e => {
    const spec = _effectiveGroup(e);
    if (!groups[spec]) groups[spec] = { active: [], inactive: [] };
    if (e.estado === 'activo') groups[spec].active.push(e);
    else                       groups[spec].inactive.push(e);
  });

  const orderedSpecs = [
    ..._SPECIALTY_ORDER.filter(s => groups[s]),
    ...Object.keys(groups).filter(s => !_SPECIALTY_ORDER.includes(s)),
  ];

  const _staffRow = (emp) => {
    const c               = empColors[emp.color] || empColors.cyan;
    const docsOk          = emp.docsCount;
    const docsTotal       = _getVisibleDocCategories(emp.tipoContrato, emp.role).length;
    const contratoVencido = emp.contratoFinDate && emp.contratoFinDate < today;
    // Show specialty as the primary label; fall back to cargo (position/role) when not set
    const labelPrimario   = emp.specialty || emp.cargo;
    return `<div class="staff-row${emp.estado !== 'activo' ? ' staff-row-inactive' : ''}" onclick="showEmpleadoProfile('${emp.id}')">
      <div class="staff-row-avatar" style="background:${c.bg};color:${c.fg};">${emp.avatar}</div>
      <div class="staff-row-info">
        <div class="staff-row-name">${emp.nombre}${contratoVencido ? ' <span class="badge badge-red" style="font-size:10px;padding:1px 5px;vertical-align:middle;margin-left:4px;">Contrato vencido</span>' : ''}</div>
        <div class="staff-row-sub">${emp.email}${emp.historyNote ? ` · <span style="color:var(--muted);font-style:italic;">${_escHtml(emp.historyNote)}</span>` : ''}</div>
      </div>
      <div class="staff-row-cargo">${labelPrimario}</div>
      <div class="staff-row-estado"><span class="badge ${emp.estado === 'activo' ? 'badge-green' : 'badge-red'}">${emp.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></div>
      <div class="staff-row-docs" style="color:${docsOk >= docsTotal ? 'var(--green)' : 'var(--amber)'};">${docsOk}/${docsTotal}</div>
      <div class="staff-row-actions" onclick="event.stopPropagation();">
        <button class="btn btn-ghost btn-sm" onclick="showEmpleadoProfile('${emp.id}')">Ver perfil</button>
        ${_isPSContract(emp.tipoContrato) ? `<button class="btn btn-ghost btn-sm" onclick="openAdminBillingModal('${emp.id}','${emp.nombre.replace(/'/g, '')}')">Pagos</button>` : ''}
      </div>
    </div>`;
  };

  container.innerHTML = orderedSpecs.map(spec => {
    const g               = groups[spec];
    const inactiveVisible = _expandedInactiveSpecialties.has(spec);
    const specSafe        = spec.replace(/[^a-zA-Z0-9]/g, '_');
    return `<div class="staff-group" data-specialty="${_escHtml(spec)}">
      <div class="staff-group-header">
        <span class="staff-group-title">${spec}</span>
        <span class="badge badge-muted" style="font-size:11px;">${g.active.length} activo${g.active.length !== 1 ? 's' : ''}</span>
      </div>
      ${g.active.length ? g.active.map(_staffRow).join('') : '<div style="padding:10px 12px;font-size:12px;color:var(--muted);">Sin personal activo en esta categoría</div>'}
      ${g.inactive.length ? `
        <button class="btn btn-ghost btn-sm" style="margin:8px 0 4px;font-size:11px;" onclick="toggleSpecialtyInactive('${spec.replace(/'/g, "\\'")}')">
          ${inactiveVisible ? '▲ Ocultar inactivos' : `▼ Ver inactivos (${g.inactive.length})`}
        </button>
        <div id="inactive-rows-${specSafe}" style="display:${inactiveVisible ? '' : 'none'};">
          ${g.inactive.map(_staffRow).join('')}
        </div>` : ''}
    </div>`;
  }).join('');
}

async function renderPersonalList() {
  const container = document.getElementById('personal-list');
  if (!container) return;
  container.innerHTML = `<div style="padding:24px;color:var(--muted);font-size:13px;">${_loader()}</div>`;

  try {
    let staff, error;
    ({ data: staff, error } = await db
      .from('users')
      .select('id, full_name, email, phone, role, is_active, created_at, position, id_number, birth_date, address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone, contract_type, contract_end_date, bank_account_number, bank_name, bank_account_type, specialty, can_edit_evaluations, evaluaciones_hidden')
      .neq('role', 'user')
      .order('full_name'));
    if (error && error.message?.includes('does not exist')) {
      ({ data: staff, error } = await db
        .from('users')
        .select('id, full_name, email, phone, role, is_active, created_at, position, id_number, birth_date, address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone')
        .neq('role', 'user')
        .order('full_name'));
    }
    if (error) throw error;

    // Auto-deactivate staff whose contract end date has passed
    const today = _bogotaToday();
    const expired = (staff || []).filter(u =>
      u.contract_end_date && u.contract_end_date < today && u.is_active !== false
    );
    if (expired.length) {
      await db.from('users').update({ is_active: false }).in('id', expired.map(u => u.id));
      expired.forEach(u => { u.is_active = false; });
    }

    const userIds = (staff || []).map(u => u.id);
    const docCountMap = {};
    if (userIds.length) {
      const { data: docs } = await db
        .from('employee_documents')
        .select('user_id, category')
        .in('user_id', userIds);
      (docs || []).forEach(d => {
        if (!docCountMap[d.user_id]) docCountMap[d.user_id] = new Set();
        docCountMap[d.user_id].add(d.category);
      });
    }

    _personalData = (staff || []).map(u => _mapDbUserToEmp(u, docCountMap[u.id]));
    _renderPersonalList();

  } catch (err) {
    if (container) container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red);">Error al cargar personal: ${err.message || 'Intenta de nuevo'}</div>`;
  }
}

function showEmpleadoProfile(id) {
  const emp = _personalData.find(e => e.id === id);
  if (!emp) return;
  renderEmpleadoPerfil(structuredClone(emp), false);
  openModal('perfil-empleado');
}

function renderEmpleadoPerfil(emp, readOnly) {
  const c = empColors[emp.color] || empColors.cyan;
  const avatarEl = document.getElementById('perfil-avatar');
  avatarEl.style.background = c.bg;
  avatarEl.style.color      = c.fg;
  avatarEl.textContent      = emp.avatar;
  document.getElementById('perfil-nombre').textContent     = emp.nombre;
  document.getElementById('perfil-cargo-head').textContent = emp.specialty
    ? `${emp.cargo} · ${emp.specialty}`
    : emp.cargo;

  const setField = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'INPUT') { el.value = (val === '—' ? '' : val) || ''; el.readOnly = readOnly; }
    else el.textContent = val;
  };

  setField('perfil-nombre-val',   emp.nombre);
  setField('perfil-cedula',       emp.cedula);
  setField('perfil-cargo-val',    emp.cargo);
  setField('perfil-fechaNac',     emp.fechaNacimiento);
  setField('perfil-tel',          emp.telefono);
  setField('perfil-email',        emp.email);
  setField('perfil-vinc',         emp.fechaVinculacion);
  setField('perfil-dir',          emp.direccion);
  setField('perfil-emer-nombre',  emp.contactoEmergencia.nombre);
  setField('perfil-emer-paren',   emp.contactoEmergencia.parentesco);
  setField('perfil-emer-tel',     emp.contactoEmergencia.telefono);
  const rolEl = document.getElementById('perfil-rol');
  if (rolEl) { rolEl.value = emp.role || 'employee'; rolEl.disabled = readOnly; }

  const especialidadEl = document.getElementById('perfil-especialidad');
  if (especialidadEl) { especialidadEl.value = emp.specialty || ''; especialidadEl.readOnly = readOnly; }

  const historialNotaEl = document.getElementById('perfil-historial-nota');
  if (historialNotaEl) { historialNotaEl.value = emp.historyNote || ''; historialNotaEl.readOnly = readOnly; }

  // Acceso a evaluaciones — admin-only 3-state control, only meaningful for instructor
  // role. See 20260706_evaluaciones_instructor_readonly.sql / 20260713_evaluaciones_hidden_state.sql.
  const canEditEvalsWrap = document.getElementById('perfil-can-edit-evals-wrap');
  const evalAccesoEl     = document.getElementById('perfil-evaluaciones-acceso');
  // Evaluaciones edit-grant is exclusive to entrenador vinculado — PS never gets read
  // access at all (2026-07-08), so the toggle would be a no-op/confusing on PS profiles.
  // Fase 3.4 (2026-08-20): widened beyond "vinculado instructor only" so admin can also
  // fine-tune ver/editar/oculto for a PS instructor, employee, or reception profile once
  // granted the 'evaluaciones' exception below (Permisos adicionales) — this dropdown alone
  // has no effect for them until that grant exists (_canAccessEvaluacionesModule() gate).
  const showCanEditEvals = currentUser?.role === 'admin' && ['instructor', 'employee', 'reception'].includes(emp.role);
  if (canEditEvalsWrap) canEditEvalsWrap.style.display = showCanEditEvals ? 'block' : 'none';
  if (evalAccesoEl) {
    evalAccesoEl.value = emp.evaluacionesHidden ? 'hidden' : (emp.canEditEvaluations ? 'edit' : 'view');
    evalAccesoEl.disabled = readOnly;
  }

  const tipoContratoEl = document.getElementById('perfil-tipo-contrato');
  if (tipoContratoEl) { tipoContratoEl.value = emp.tipoContrato || ''; tipoContratoEl.disabled = readOnly; }

  setField('perfil-contrato-fin', emp.contratoFinDate);

  setField('perfil-banco',        emp.banco);

  const tipoCuentaEl = document.getElementById('perfil-tipo-cuenta');
  if (tipoCuentaEl) { tipoCuentaEl.value = emp.tipoCuenta || ''; tipoCuentaEl.disabled = readOnly; }

  setField('perfil-num-cuenta',   emp.numeroCuenta);

  document.querySelectorAll('.perfil-edit-btn').forEach(btn => {
    btn.style.display = readOnly ? 'none' : 'inline-flex';
  });
  // "Eliminar personal" was removed app-wide (nobody can delete/deactivate a collaborator
  // from the UI anymore) — "Reactivar personal" stays, for any account left inactive from
  // before this change or a manual DB action.
  const _reactBtn = document.getElementById('btn-reactivar-empleado');
  const _isInactive = emp.estado === 'inactivo';
  if (_reactBtn) {
    _reactBtn.style.display = (!readOnly && _isInactive) ? 'inline-flex' : 'none';
    // These buttons are single shared DOM nodes reused across every profile the modal
    // renders, so a disabled/"…ing" state left over from a previous save must be reset
    // here — otherwise the next inactive profile opened inherits a stuck, unclickable button.
    _reactBtn.disabled = false;
    _reactBtn.textContent = 'Reactivar personal';
  }

  const modal = document.getElementById('modal-perfil-empleado');
  if (modal) modal._empId = emp.id;

  // Dotación tab — visible to admin/reception viewing an instructor's profile
  const _canSeeDotacion = currentUser?.role === 'admin' || currentUser?.role === 'reception';
  const _isDotacionTarget = emp.role === 'instructor';
  const dotacionTabBtn = document.getElementById('tab-btn-dotacion');
  if (dotacionTabBtn) dotacionTabBtn.style.display = (_canSeeDotacion && _isDotacionTarget) ? '' : 'none';
  if (_canSeeDotacion && _isDotacionTarget) loadDotacionTab(emp.id);

  // Fix 4: Solicitudes tab — admin/reception can see this staff member's requests
  const _canSeeSolicitudes = currentUser?.role === 'admin' || currentUser?.role === 'reception';
  const solicitudesTabBtn = document.getElementById('tab-btn-solicitudes');
  if (solicitudesTabBtn) solicitudesTabBtn.style.display = _canSeeSolicitudes ? '' : 'none';
  if (_canSeeSolicitudes) loadPerfilSolicitudesTab(emp.id);

  // Horario de planta / horas extra / cambios de turno — admin/reception, vinculado
  // instructors only (Término indefinido/fijo). Not shown for PS (they bill per class,
  // no fixed schedule/overtime concept) or for non-instructor staff.
  const _canSeeHorarioPlanta = (currentUser?.role === 'admin' || currentUser?.role === 'reception')
    && emp.role === 'instructor' && !_isPSContract(emp.tipoContrato);
  const horarioPlantaTabBtn = document.getElementById('tab-btn-horario-planta');
  if (horarioPlantaTabBtn) horarioPlantaTabBtn.style.display = _canSeeHorarioPlanta ? '' : 'none';
  if (_canSeeHorarioPlanta) loadHorarioPlantaTab(emp.id);

  // External collaborator extra permissions — employee-role profiles, admin-managed
  // (Phase 4.5, 2026-07-14). See staff_extra_permissions / 20260714_staff_extra_permissions.sql.
  const extraPermWrap = document.getElementById('perfil-extra-permisos-wrap');
  // Widened Fase 3.3/3.4 (2026-08-20) from employee-only to also cover instructor/reception
  // targets — each STAFF_GRANTABLE_MODULES entry declares its own applicable `roles`, so
  // e.g. an instructor profile only ever sees agendar_cronograma/evaluaciones here, never
  // the employee-only Personal/Contratos/etc. toggles (see _renderPerfilExtraPermisosToggles).
  const showExtraPerm = currentUser?.role === 'admin' && ['employee', 'instructor', 'reception'].includes(emp.role);
  if (extraPermWrap) extraPermWrap.style.display = showExtraPerm ? 'block' : 'none';
  if (showExtraPerm) _loadPerfilExtraPermisos(emp.id, emp.role, readOnly);

  // Credenciales — admin-only (restored 2026-07-06, narrower than the original
  // admin+reception scope — see 20260706_credential_vault.sql)
  const _empCredSection = document.getElementById('emp-credenciales-section');
  if (_empCredSection) {
    const canSeeCred = currentUser?.role === 'admin';
    _empCredSection.style.display = canSeeCred ? '' : 'none';
    if (canSeeCred) {
      const empLoginEl = document.getElementById('emp-cred-login');
      if (empLoginEl) empLoginEl.textContent = emp.email || '—';
      _credResetSectionState('emp');
    }
  }

  loadDocsTab(emp.id, readOnly);
  showPerfilTab('datos');
}

async function loadDocsTab(userId, readOnly) {
  const container = document.getElementById('perfil-docs-container');
  if (!container) return;
  let docsMap = {}; // category -> array of doc rows (Task B: multiple files per folder)
  try {
    const { data } = await db
      .from('employee_documents')
      .select('id, category, uploaded_at, filename, url')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    (data || []).forEach(d => { (docsMap[d.category] = docsMap[d.category] || []).push(d); });
  } catch (_) { /* tabla aún no creada — muestra todo como pendiente */ }

  const _docRow = (cat, allowUpload) => {
    const docs   = docsMap[cat.key] || [];
    const loaded = docs.length > 0;
    const fileRows = docs.map(doc => {
      const date = doc.uploaded_at
        ? new Date(doc.uploaded_at).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : null;
      return `<div class="doc-file-row" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 0;">
        <span style="font-size:12px;color:var(--muted2);">${_escHtml(doc.filename || 'Ver')} · ${date}</span>
        <span style="display:flex;gap:4px;">
          ${doc.url ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${doc.url}','_blank')">Ver</button>` : ''}
          ${currentUser?.role === 'admin' ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteDoc('${userId}','${cat.key}','${doc.id}')">Eliminar</button>` : ''}
        </span>
      </div>`;
    }).join('');
    // Phase 3.4 (2026-07-13): fixed/built-in categories are deletable too, not just
    // custom ones — same soft-delete mechanism (eliminarCarpetaDocumento), extended.
    const deleteFolderBtn = (currentUser?.role === 'admin')
      ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);opacity:.6;" onclick="eliminarCarpetaDocumento('${cat.key}','${_escHtml(cat.label).replace(/'/g, "\\'")}')" title="Eliminar esta carpeta">🗑 carpeta</button>`
      : '';
    return `<div class="doc-row" style="flex-direction:column;align-items:stretch;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="doc-icon">${loaded ? '✅' : '⚠️'}</div>
        <div class="doc-info" style="flex:1;">
          <div class="doc-name">${cat.label}${cat.isCustom ? ' <span style="font-size:9px;color:var(--muted2);font-weight:400;">(personalizada)</span>' : ''}</div>
          <div class="doc-date">${loaded ? `${docs.length} documento${docs.length !== 1 ? 's' : ''}` : 'Pendiente — sin documento'}</div>
        </div>
        <div class="doc-actions">
          ${allowUpload ? `<button class="btn btn-ghost btn-sm" onclick="uploadDoc('${userId}','${cat.key}')">+ Agregar</button>` : ''}
          ${deleteFolderBtn}
        </div>
      </div>
      ${fileRows ? `<div style="padding-left:38px;margin-top:2px;">${fileRows}</div>` : ''}
    </div>`;
  };

  const empData   = _personalData.find(e => e.id === userId);
  const visibleCats = _getVisibleDocCategories(empData?.tipoContrato, empData?.role);
  const newFolderBtn = (!readOnly && currentUser?.role === 'admin')
    ? `<div style="text-align:right;margin-bottom:8px;"><button class="btn btn-outline btn-sm" onclick="abrirNuevaCarpetaDocumento()">+ Nueva carpeta</button></div>`
    : '';
  // Phase 3.4 (2026-07-13): restore list for deleted folders (built-in or custom) —
  // deletions are contract-type scoped (same as the folders themselves), not per-trainer.
  const deletedCats = (_customDocCategories || []).filter(c => c.is_active === false);
  const deletedFoldersHtml = (deletedCats.length && !readOnly && currentUser?.role === 'admin')
    ? `<details style="margin-bottom:8px;font-size:12px;color:var(--muted);">
        <summary style="cursor:pointer;">Carpetas eliminadas (${deletedCats.length})</summary>
        <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px;">
          ${deletedCats.map(c => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:var(--card);border:1px solid var(--border);border-radius:6px;">
            <span>${_escHtml(c.label)}</span>
            <button class="btn btn-ghost btn-sm" onclick="restaurarCarpetaDocumento('${c.key}','${_escHtml(c.label).replace(/'/g, "\\'")}')">Restaurar</button>
          </div>`).join('')}
        </div>
      </details>`
    : '';
  const regularHtml = newFolderBtn + deletedFoldersHtml + visibleCats.map(c => _docRow(c, !readOnly)).join('');

  // Retirement docs section — admin only, inactive staff only
  const isInactive = empData?.estado === 'inactivo';
  const isAdminViewer = currentUser?.role === 'admin';
  let retirementHtml = '';
  if (isAdminViewer && isInactive) {
    const rows = retirementDocCategories.map(c => _docRow(c, true)).join('');
    retirementHtml = `
      <div style="margin-top:20px;padding-left:14px;border-left:3px solid var(--red);">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--red);margin-bottom:10px;display:flex;align-items:center;gap:6px;">
          ⚠ Documentos de retiro
        </div>
        ${rows}
      </div>`;
  }

  // Monthly Seguridad Social history — PS instructors only, admin/reception can mark reviewed
  const isPSInstructor = _isPSContract(empData?.tipoContrato);
  let ssHtml = '';
  const ssContainerId = `ss-historial-${userId}`;
  if (isPSInstructor) {
    ssHtml = `
      <div style="margin-top:20px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--muted2);margin-bottom:10px;">
          Seguridad Social — Historial mensual
        </div>
        <div id="${ssContainerId}">${_loader()}</div>
      </div>`;
  }

  container.innerHTML = regularHtml + retirementHtml + ssHtml;

  if (isPSInstructor) {
    loadSeguridadSocialHistorial(userId, ssContainerId, currentUser?.role === 'admin');
  }
}

// Fix 4: load staff_requests for a specific staff member into the admin profile tab
async function loadPerfilSolicitudesTab(staffId) {
  const container = document.getElementById('perfil-solicitudes-list');
  if (!container) return;
  container.innerHTML = `<div style="padding:16px 0;">${_loader()}</div>`;
  try {
    const { data, error } = await db
      .from('staff_requests')
      .select('*')
      .eq('user_id', staffId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data?.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px 0;">Este colaborador no tiene solicitudes todavía.</div>';
      return;
    }
    // Reuse the same card renderer used by the instructor's own view
    container.innerHTML = data.map(req => {
      const label      = _solicitudTipoLabel?.[req.request_type] || req.request_type;
      const badgeClass = _solicitudStatusBadge?.[req.status]     || 'badge-muted';
      const statusTxt  = req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : '';
      const createdAt  = new Date(req.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
      const datesHtml  = (req.requested_start_date || req.requested_end_date)
        ? `<div style="font-size:12px;color:var(--muted2);margin-top:5px;">📅 ${req.requested_start_date ? _formatDate(req.requested_start_date) : '—'} → ${req.requested_end_date ? _formatDate(req.requested_end_date) : '—'}</div>`
        : '';
      const attachHtml = req.attachment_url
        ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="viewRequestAttachment('${req.attachment_url}')">📎 Ver adjunto</button>`
        : '';
      const respHtml = req.admin_response
        ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(0,207,255,0.06);border-left:3px solid var(--cyan);border-radius:0 6px 6px 0;font-size:12px;line-height:1.5;">
             <span style="color:var(--muted);display:block;margin-bottom:3px;font-size:11px;letter-spacing:.5px;">RESPUESTA DEL ADMINISTRADOR</span>
             ${req.admin_response}
           </div>`
        : '';
      return `<div class="card" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="badge badge-cyan" style="font-size:11px;">${label}</span>
            <span style="font-size:12px;color:var(--muted);">${createdAt}</span>
          </div>
          <span class="badge ${badgeClass}">${statusTxt}</span>
        </div>
        <div style="margin:9px 0 4px;font-size:13px;line-height:1.55;">${req.description}</div>
        ${datesHtml}${attachHtml}${respHtml}
      </div>`;
    }).join('');
  } catch (err) {
    console.error('[Thor] loadPerfilSolicitudesTab:', err);
    container.innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px 0;">Error al cargar solicitudes.<br><small>${err?.message || ''}</small></div>`;
  }
}

// ===================== ACTA DE DOTACIÓN =====================

let _dotacionEntries = [];

async function loadDotacionTab(instructorId) {
  const container = document.getElementById('dotacion-table-container');
  if (!container) return;
  container.innerHTML = `<div style="padding:12px 0;color:var(--muted);">${_loader()}</div>`;
  const formEl = document.getElementById('dotacion-form-container');
  if (formEl) formEl.style.display = 'none';
  const addBtn = document.getElementById('btn-agregar-dotacion');
  if (addBtn) addBtn.style.display = '';

  try {
    const { data, error } = await db
      .from('dotacion_entries')
      .select('*')
      .eq('instructor_id', instructorId)
      .order('fecha_entrega', { ascending: false });
    if (error) throw error;
    _dotacionEntries = data || [];
    _renderDotacionTable(instructorId);
  } catch (err) {
    if (container) container.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:12px 0;">Error al cargar dotación: ${_escHtml(err.message)}</div>`;
  }
}

function _renderDotacionTable(instructorId) {
  const container = document.getElementById('dotacion-table-container');
  if (!container) return;

  if (!_dotacionEntries.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:12px 0;">Sin registros de dotación.</div>`;
    return;
  }

  const estadoBadge = (estado) => {
    const styles = {
      'Entregado': 'background:rgba(34,197,94,0.15);color:#22c55e;',
      'Devuelto':  'background:rgba(245,158,11,0.15);color:#f59e0b;',
      'Pendiente': 'background:rgba(255,59,92,0.15);color:var(--red);',
    };
    return `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${styles[estado] || ''}">${_escHtml(estado)}</span>`;
  };

  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="data-table" style="width:100%;min-width:480px;">
        <thead>
          <tr>
            <th>Ítem</th>
            <th>Fecha entrega</th>
            <th>Estado</th>
            <th>Observaciones</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${_dotacionEntries.map(e => `
            <tr>
              <td style="font-weight:500;">${_escHtml(e.item)}</td>
              <td style="color:var(--muted);">${e.fecha_entrega}</td>
              <td>${estadoBadge(e.estado)}</td>
              <td style="color:var(--muted);font-size:12px;">${e.observaciones ? _escHtml(e.observaciones) : '—'}</td>
              <td>
                <div style="display:flex;gap:4px;">
                  <button class="btn btn-ghost btn-sm" title="Editar" onclick="openDotacionForm('${instructorId}','${e.id}')">✎</button>
                  <button class="btn btn-ghost btn-sm" title="Eliminar" style="color:var(--red);" onclick="deleteDotacionEntry('${e.id}','${instructorId}')">🗑</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function _openDotacionFormNew() {
  const modal = document.getElementById('modal-perfil-empleado');
  openDotacionForm(modal?._empId, null);
}

function openDotacionForm(instructorId, entryId) {
  const formEl = document.getElementById('dotacion-form-container');
  if (!formEl) return;
  const entry = entryId ? _dotacionEntries.find(e => e.id === entryId) : null;
  const today = _bogotaToday();

  document.getElementById('dotacion-entry-id').value      = entry?.id      || '';
  document.getElementById('dotacion-instructor-id').value = instructorId   || '';
  document.getElementById('dotacion-item').value          = entry?.item    || '';
  document.getElementById('dotacion-fecha').value         = entry?.fecha_entrega || today;
  document.getElementById('dotacion-estado').value        = entry?.estado  || 'Entregado';
  document.getElementById('dotacion-observaciones').value = entry?.observaciones || '';

  formEl.style.display = 'block';
  const addBtn = document.getElementById('btn-agregar-dotacion');
  if (addBtn) addBtn.style.display = 'none';
  document.getElementById('dotacion-item')?.focus();
}

function cancelDotacionForm() {
  const formEl = document.getElementById('dotacion-form-container');
  if (formEl) formEl.style.display = 'none';
  const addBtn = document.getElementById('btn-agregar-dotacion');
  if (addBtn) addBtn.style.display = '';
}

async function saveDotacionEntry() {
  const entryId      = (document.getElementById('dotacion-entry-id')?.value      || '').trim();
  const instructorId = (document.getElementById('dotacion-instructor-id')?.value  || '').trim();
  const item         = (document.getElementById('dotacion-item')?.value           || '').trim();
  const fecha        = (document.getElementById('dotacion-fecha')?.value          || '').trim();
  const estado       = (document.getElementById('dotacion-estado')?.value         || '').trim();
  const obs          = (document.getElementById('dotacion-observaciones')?.value  || '').trim() || null;

  if (!item)  { toast('Campo requerido', 'Ingresa el nombre del ítem'); return; }
  if (!fecha) { toast('Campo requerido', 'Selecciona la fecha de entrega'); return; }

  const btn = document.querySelector('#dotacion-form-container .btn-primary');
  if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }

  try {
    if (entryId) {
      // Build payload with only provided values to avoid null-overwriting
      const payload = { updated_at: new Date().toISOString() };
      if (item)   payload.item          = item;
      if (fecha)  payload.fecha_entrega = fecha;
      if (estado) payload.estado        = estado;
      payload.observaciones = obs;
      const { error } = await db.from('dotacion_entries').update(payload).eq('id', entryId);
      if (error) throw error;
    } else {
      const { error } = await db.from('dotacion_entries').insert({
        instructor_id: instructorId,
        item,
        fecha_entrega: fecha,
        estado,
        observaciones: obs,
      });
      if (error) throw error;
    }
    toast('Guardado', entryId ? 'Registro actualizado' : 'Entrega registrada');
    cancelDotacionForm();
    await loadDotacionTab(instructorId);
  } catch (err) {
    toast('Error al guardar', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Guardar'; btn.disabled = false; }
  }
}

// ── Horario de planta / horas extra / cambios de turno (Prompt 5, 2026-07-13) ────────
// Fixed weekly schedule + admin/reception-logged overtime and shift-change history for
// vinculado instructors. See 20260713_horario_planta_turnos_horas_extra.sql for the
// staff_horario_planta / staff_horas_extra / staff_cambios_turno tables and RLS (trainer
// read-only on own rows, admin/reception full access).
const _DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let _horasExtraEntries = [];
let _cambiosTurnoEntries = [];

async function loadHorarioPlantaTab(userId) {
  document.getElementById('horario-planta-user-id').value = userId;
  await Promise.all([
    _loadHorarioPlantaGrid(userId),
    _loadHorasExtraList(userId),
    _loadCambiosTurnoList(userId),
  ]);
}

async function _loadHorarioPlantaGrid(userId) {
  const grid = document.getElementById('horario-planta-grid');
  if (!grid) return;
  grid.innerHTML = _loader();
  try {
    const { data, error } = await db.from('staff_horario_planta').select('*').eq('user_id', userId);
    if (error) throw error;
    const byDay = {};
    (data || []).forEach(r => { byDay[r.day_of_week] = r; });
    grid.innerHTML = _DIAS_SEMANA.map((label, i) => {
      const day = i + 1;
      const row = byDay[day] || {};
      return `<div class="grid-3 gap-sm" style="align-items:center;margin-bottom:6px;">
        <div style="font-size:13px;font-weight:600;">${label}</div>
        <input class="form-input" type="time" id="hp-start-${day}" value="${row.start_time || ''}">
        <input class="form-input" type="time" id="hp-end-${day}" value="${row.end_time || ''}">
      </div>`;
    }).join('');
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--muted);font-size:13px;">Error al cargar horario: ${_escHtml(err.message)}</div>`;
  }
}

async function guardarHorarioPlanta() {
  const userId = document.getElementById('horario-planta-user-id')?.value;
  if (!userId) return;
  const rows = [];
  for (let day = 1; day <= 6; day++) {
    const start = document.getElementById(`hp-start-${day}`)?.value || null;
    const end   = document.getElementById(`hp-end-${day}`)?.value || null;
    if (start || end) {
      rows.push({ user_id: userId, day_of_week: day, start_time: start, end_time: end, updated_by: currentUser?.id, updated_at: new Date().toISOString() });
    }
  }
  try {
    if (rows.length) {
      const { error } = await db.from('staff_horario_planta').upsert(rows, { onConflict: 'user_id,day_of_week' });
      if (error) throw error;
    }
    toast('Guardado', 'Horario de planta actualizado');
  } catch (err) {
    toast('Error al guardar', err.message || 'Intenta de nuevo');
  }
}

async function _loadHorasExtraList(userId) {
  const container = document.getElementById('horas-extra-list-container');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const { data, error } = await db.from('staff_horas_extra').select('*').eq('user_id', userId).order('fecha', { ascending: false });
    if (error) throw error;
    _horasExtraEntries = data || [];
    _renderHorasExtraList(userId);
  } catch (err) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;">Error: ${_escHtml(err.message)}</div>`;
  }
}

function _renderHorasExtraList(userId) {
  const container = document.getElementById('horas-extra-list-container');
  if (!container) return;
  if (!_horasExtraEntries.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin horas extra registradas.</div>`;
    return;
  }
  container.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;">${_horasExtraEntries.map(e => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:8px;">
      <div>
        <div style="font-size:13px;font-weight:600;">${e.fecha} · ${e.horas}h</div>
        ${e.motivo ? `<div style="font-size:12px;color:var(--muted);">${_escHtml(e.motivo)}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteHorasExtra('${e.id}','${userId}')">🗑</button>
    </div>`).join('')}</div>`;
}

function _openHorasExtraFormNew() {
  const formEl = document.getElementById('horas-extra-form-container');
  if (!formEl) return;
  document.getElementById('horas-extra-fecha').value = _bogotaToday();
  document.getElementById('horas-extra-horas').value = '';
  document.getElementById('horas-extra-motivo').value = '';
  formEl.style.display = 'block';
}

function cancelHorasExtraForm() {
  const formEl = document.getElementById('horas-extra-form-container');
  if (formEl) formEl.style.display = 'none';
}

async function saveHorasExtra() {
  const userId = document.getElementById('horario-planta-user-id')?.value;
  const fecha  = document.getElementById('horas-extra-fecha')?.value;
  const horas  = parseFloat(document.getElementById('horas-extra-horas')?.value);
  const motivo = document.getElementById('horas-extra-motivo')?.value?.trim() || null;
  if (!fecha)               { toast('Campo requerido', 'Selecciona la fecha'); return; }
  if (!horas || horas <= 0) { toast('Campo requerido', 'Ingresa las horas'); return; }
  try {
    const { error } = await db.from('staff_horas_extra').insert({ user_id: userId, fecha, horas, motivo, registered_by: currentUser?.id });
    if (error) throw error;
    toast('Guardado', 'Horas extra registradas');
    cancelHorasExtraForm();
    await _loadHorasExtraList(userId);
  } catch (err) {
    toast('Error al guardar', err.message || 'Intenta de nuevo');
  }
}

async function deleteHorasExtra(id, userId) {
  if (!confirm('¿Eliminar este registro de horas extra?')) return;
  try {
    const { error } = await db.from('staff_horas_extra').delete().eq('id', id);
    if (error) throw error;
    await _loadHorasExtraList(userId);
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
  }
}

async function _loadCambiosTurnoList(userId) {
  const container = document.getElementById('cambio-turno-list-container');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const { data, error } = await db.from('staff_cambios_turno').select('*').eq('user_id', userId).order('fecha', { ascending: false });
    if (error) throw error;
    _cambiosTurnoEntries = data || [];
    _renderCambiosTurnoList(userId);
  } catch (err) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;">Error: ${_escHtml(err.message)}</div>`;
  }
}

function _renderCambiosTurnoList(userId) {
  const container = document.getElementById('cambio-turno-list-container');
  if (!container) return;
  if (!_cambiosTurnoEntries.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:13px;padding:8px 0;">Sin cambios de turno registrados.</div>`;
    return;
  }
  container.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;">${_cambiosTurnoEntries.map(e => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:8px;">
      <div>
        <div style="font-size:13px;font-weight:600;">${e.fecha} · ${e.turno_anterior ? `${_escHtml(e.turno_anterior)} → ` : ''}${_escHtml(e.turno_nuevo)}</div>
        ${e.motivo ? `<div style="font-size:12px;color:var(--muted);">${_escHtml(e.motivo)}</div>` : ''}
      </div>
      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteCambioTurno('${e.id}','${userId}')">🗑</button>
    </div>`).join('')}</div>`;
}

function _openCambioTurnoFormNew() {
  const formEl = document.getElementById('cambio-turno-form-container');
  if (!formEl) return;
  document.getElementById('cambio-turno-fecha').value = _bogotaToday();
  document.getElementById('cambio-turno-nuevo').value = '';
  document.getElementById('cambio-turno-anterior').value = '';
  document.getElementById('cambio-turno-motivo').value = '';
  formEl.style.display = 'block';
}

function cancelCambioTurnoForm() {
  const formEl = document.getElementById('cambio-turno-form-container');
  if (formEl) formEl.style.display = 'none';
}

async function saveCambioTurno() {
  const userId        = document.getElementById('horario-planta-user-id')?.value;
  const fecha          = document.getElementById('cambio-turno-fecha')?.value;
  const turnoNuevo     = document.getElementById('cambio-turno-nuevo')?.value?.trim();
  const turnoAnterior  = document.getElementById('cambio-turno-anterior')?.value?.trim() || null;
  const motivo         = document.getElementById('cambio-turno-motivo')?.value?.trim() || null;
  if (!fecha)      { toast('Campo requerido', 'Selecciona la fecha'); return; }
  if (!turnoNuevo) { toast('Campo requerido', 'Ingresa el turno nuevo'); return; }
  try {
    const { error } = await db.from('staff_cambios_turno').insert({ user_id: userId, fecha, turno_nuevo: turnoNuevo, turno_anterior: turnoAnterior, motivo, registered_by: currentUser?.id });
    if (error) throw error;
    toast('Guardado', 'Cambio de turno registrado');
    cancelCambioTurnoForm();
    await _loadCambiosTurnoList(userId);
  } catch (err) {
    toast('Error al guardar', err.message || 'Intenta de nuevo');
  }
}

async function deleteCambioTurno(id, userId) {
  if (!confirm('¿Eliminar este cambio de turno?')) return;
  try {
    const { error } = await db.from('staff_cambios_turno').delete().eq('id', id);
    if (error) throw error;
    await _loadCambiosTurnoList(userId);
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
  }
}

// Read-only self-view for the vinculado trainer's own profile — reads the same three
// tables the reception/admin "Horario / Novedades" tab writes to; RLS restricts each
// trainer to their own rows (see 20260713_horario_planta_turnos_horas_extra.sql).
async function _loadSelfHorarioPlanta(userId) {
  const gridEl = document.getElementById('self-horario-planta-grid');
  const hxEl   = document.getElementById('self-horas-extra-list');
  const ctEl   = document.getElementById('self-cambios-turno-list');

  try {
    const { data, error } = await db.from('staff_horario_planta').select('*').eq('user_id', userId);
    if (error) throw error;
    const byDay = {};
    (data || []).forEach(r => { byDay[r.day_of_week] = r; });
    const rows = _DIAS_SEMANA.map((label, i) => {
      const row = byDay[i + 1];
      const horario = row && (row.start_time || row.end_time) ? `${(row.start_time || '—').slice(0,5)} - ${(row.end_time || '—').slice(0,5)}` : '—';
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);"><span>${label}</span><span style="color:${row ? 'var(--text)' : 'var(--muted)'};">${horario}</span></div>`;
    }).join('');
    if (gridEl) gridEl.innerHTML = rows;
  } catch (err) {
    if (gridEl) gridEl.innerHTML = `<div style="color:var(--muted);">Sin horario configurado aún.</div>`;
  }

  try {
    const { data, error } = await db.from('staff_horas_extra').select('*').eq('user_id', userId).order('fecha', { ascending: false }).limit(10);
    if (error) throw error;
    if (hxEl) hxEl.innerHTML = (data && data.length)
      ? data.map(e => `<div style="padding:3px 0;">${e.fecha} · <strong>${e.horas}h</strong>${e.motivo ? ` — ${_escHtml(e.motivo)}` : ''}</div>`).join('')
      : `<div style="color:var(--muted);">Sin registros.</div>`;
  } catch (err) {
    if (hxEl) hxEl.innerHTML = `<div style="color:var(--muted);">Sin registros.</div>`;
  }

  try {
    const { data, error } = await db.from('staff_cambios_turno').select('*').eq('user_id', userId).order('fecha', { ascending: false }).limit(10);
    if (error) throw error;
    if (ctEl) ctEl.innerHTML = (data && data.length)
      ? data.map(e => `<div style="padding:3px 0;">${e.fecha} · ${e.turno_anterior ? `${_escHtml(e.turno_anterior)} → ` : ''}<strong>${_escHtml(e.turno_nuevo)}</strong>${e.motivo ? ` — ${_escHtml(e.motivo)}` : ''}</div>`).join('')
      : `<div style="color:var(--muted);">Sin registros.</div>`;
  } catch (err) {
    if (ctEl) ctEl.innerHTML = `<div style="color:var(--muted);">Sin registros.</div>`;
  }
}

async function deleteDotacionEntry(entryId, instructorId) {
  if (!confirm('¿Eliminar este registro de dotación? Esta acción no se puede deshacer.')) return;
  try {
    const { error } = await db.from('dotacion_entries').delete().eq('id', entryId);
    if (error) throw error;
    toast('Eliminado', 'Registro de dotación eliminado');
    await loadDotacionTab(instructorId);
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
  }
}

// Task B: multiple documents per category are supported — every upload ADDS a new row
// (unique storage path per file) instead of overwriting the category's single slot.
async function uploadDoc(userId, catKey) {
  const label = docCategories.find(c => c.key === catKey)?.label
             || retirementDocCategories.find(c => c.key === catKey)?.label
             || _customDocCategories.find(c => c.key === catKey)?.label
             || catKey;

  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png,.webp';

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const btn = document.querySelector(`button[onclick="uploadDoc('${userId}','${catKey}')"]`);
    if (btn) { btn.textContent = 'Subiendo…'; btn.disabled = true; }

    try {
      const ext      = file.name.split('.').pop().toLowerCase();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path     = `employees/${userId}/${catKey}/${Date.now()}_${safeName}`;

      const { error: storageError } = await db.storage
        .from('employee-docs')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (storageError) throw storageError;

      const { data: { publicUrl } } = db.storage
        .from('employee-docs')
        .getPublicUrl(path);

      const today = _bogotaToday();
      const { error: dbError } = await db
        .from('employee_documents')
        .insert({ user_id: userId, category: catKey, filename: file.name, url: publicUrl, uploaded_at: today });
      if (dbError) throw dbError;

      const emp = _personalData.find(e => e.id === userId);
      const isRegularDoc = docCategories.some(c => c.key === catKey);
      if (emp && isRegularDoc) emp.docsCount = Math.min((emp.docsCount || 0) + 1, docCategories.length);
      const isAdmin = currentUser && currentUser.role === 'admin';
      await loadDocsTab(userId, !isAdmin);
      toast('Documento subido', label);
    } catch (err) {
      toast('Error al subir', err.message || 'Intenta de nuevo');
    } finally {
      // Re-query the button since loadDocsTab re-rendered the container
      const freshBtn = document.querySelector(`button[onclick="uploadDoc('${userId}','${catKey}')"]`);
      if (freshBtn) { freshBtn.disabled = false; }
    }
  };

  input.click();
}

// F1: admin can delete a specific document from a staff member's profile.
// docId targets one specific file (a category can now hold several).
async function deleteDoc(userId, catKey, docId) {
  if (!confirm('¿Eliminar este documento? Esta acción no se puede deshacer.')) return;
  const label = docCategories.find(c => c.key === catKey)?.label
             || retirementDocCategories.find(c => c.key === catKey)?.label
             || _customDocCategories.find(c => c.key === catKey)?.label
             || catKey;
  try {
    const { data: existing } = await db
      .from('employee_documents')
      .select('id, url')
      .eq('id', docId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existing) { toast('Sin documento', 'No hay nada que eliminar'); return; }

    // Delete DB row first
    const { error: dbErr } = await db
      .from('employee_documents')
      .delete()
      .eq('id', existing.id);
    if (dbErr) throw dbErr;

    // Best-effort storage removal — path is embedded in the stored public URL
    if (existing.url) {
      const urlPath = existing.url.split('/employee-docs/')[1]; // strip bucket prefix
      if (urlPath) {
        await db.storage.from('employee-docs').remove([urlPath]);
      }
    }

    const isAdmin = currentUser?.role === 'admin';
    await loadDocsTab(userId, !isAdmin);
    toast('Documento eliminado', label);
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
  }
}

async function saveEmpleadoPerfil() {
  const modal  = document.getElementById('modal-perfil-empleado');
  const userId = modal?._empId;
  if (!userId) return;
  const rolEl = document.getElementById('perfil-rol');

  const nombreVal = (document.getElementById('perfil-nombre-val')?.value || '').trim();
  if (!nombreVal) { toast('Campo requerido', 'Ingresa el nombre completo'); return; }

  // Core fields — these columns always exist in the users table
  const updatePayload = {
    full_name:                      nombreVal,
    position:                       (document.getElementById('perfil-cargo-val')?.value  || '').trim() || null,
    phone:                          (document.getElementById('perfil-tel')?.value         || '').trim() || null,
    address:                        (document.getElementById('perfil-dir')?.value         || '').trim() || null,
    id_number:                      (document.getElementById('perfil-cedula')?.value      || '').trim() || null,
    birth_date:                     (document.getElementById('perfil-fechaNac')?.value    || '').trim() || null,
    emergency_contact_name:         (document.getElementById('perfil-emer-nombre')?.value || '').trim() || null,
    emergency_contact_relationship: (document.getElementById('perfil-emer-paren')?.value  || '').trim() || null,
    emergency_contact_phone:        (document.getElementById('perfil-emer-tel')?.value    || '').trim() || null,
    contract_type:                  (document.getElementById('perfil-tipo-contrato')?.value || '') || null,
    contract_end_date:              (document.getElementById('perfil-contrato-fin')?.value  || '') || null,
    ...(rolEl && !rolEl.disabled ? { role: rolEl.value } : {}),
  };

  // Only present (and only writable) when the control is actually shown to this admin —
  // see 20260706_evaluaciones_instructor_readonly.sql / 20260713_evaluaciones_hidden_state.sql.
  const canEditEvalsWrap = document.getElementById('perfil-can-edit-evals-wrap');
  if (canEditEvalsWrap && canEditEvalsWrap.style.display !== 'none') {
    const evalAcceso = document.getElementById('perfil-evaluaciones-acceso')?.value || 'view';
    updatePayload.evaluaciones_hidden  = evalAcceso === 'hidden';
    updatePayload.can_edit_evaluations = evalAcceso === 'edit';
  }

  // Extended fields: only add to the payload when the admin set a value OR the original
  // record already had one — prevents a null from overwriting data that was absent from
  // the SELECT fallback response when these columns did not yet exist in the DB.
  const orig        = _personalData.find(e => e.id === userId);
  const specialty   = (document.getElementById('perfil-especialidad')?.value  || '').trim() || null;
  const historyNote = (document.getElementById('perfil-historial-nota')?.value || '').trim() || null;
  const bankName    = (document.getElementById('perfil-banco')?.value         || '').trim() || null;
  const bankType    = (document.getElementById('perfil-tipo-cuenta')?.value   || '') || null;
  const bankNum     = (document.getElementById('perfil-num-cuenta')?.value    || '').trim() || null;
  if (specialty   !== null || orig?.specialty    != null) updatePayload.specialty           = specialty;
  if (historyNote !== null || orig?.historyNote  != null) updatePayload.staff_history_note  = historyNote;
  if (bankName    !== null || orig?.banco        != null) updatePayload.bank_name           = bankName;
  if (bankType    !== null || orig?.tipoCuenta   != null) updatePayload.bank_account_type   = bankType;

  // Fecha de vinculación is stored in created_at — only write it when the admin actually
  // changed it (compared against the value the profile was loaded with). created_at also
  // carries the real signup time-of-day for accounts not created through this flow;
  // writing it unconditionally on every save — even one that never touched this field —
  // would silently discard that time-of-day. When it IS changed, anchor to Bogotá
  // midnight explicitly (same technique as guardarNuevoEmpleado) so a bare "YYYY-MM-DD"
  // never gets reinterpreted in another timezone and shifted to the wrong calendar year.
  const vincVal = (document.getElementById('perfil-vinc')?.value || '').trim();
  if (vincVal && vincVal !== orig?.fechaVinculacion) updatePayload.created_at = _bogotaMidnightUTC(vincVal);
  if (bankNum   !== null || orig?.numeroCuenta != null) updatePayload.bank_account_number = bankNum;

  let { data: _savedRows, error } = await db.from('users').update(updatePayload).eq('id', userId).select('id');
  if (error && error.message?.includes('does not exist')) {
    // Extended columns not yet migrated — strip them and save core fields only
    const { specialty: _s, staff_history_note: _shn, bank_name: _bn, bank_account_type: _bt, bank_account_number: _bnum, ...corePayload } = updatePayload;
    ({ data: _savedRows, error } = await db.from('users').update(corePayload).eq('id', userId).select('id'));
    if (!error) toast('Guardado parcial', 'Corre el SQL de migración para habilitar todos los campos del perfil');
  }
  if (error) { toast('Error al guardar', error.message || 'Intenta de nuevo'); return; }
  // A silent RLS block returns no error but 0 rows — surface it instead of showing a false
  // "Cambios guardados" (same class of bug this app hit before in eliminarEmpleado()).
  if (!_savedRows || _savedRows.length === 0) {
    toast('Sin permiso para guardar', 'Verifica la política RLS de UPDATE en la tabla users');
    return;
  }

  // Extra permissions grant list — only present (and only writable) when the section is
  // shown to this admin (Phase 4.5, 2026-07-14; widened Fase 3.3/3.4, 2026-08-20). Uses
  // orig?.role (the role this profile was loaded with) rather than rolEl.value — the grant
  // checkboxes were rendered at modal-open time keyed off emp.role (_loadPerfilExtraPermisos),
  // so re-deriving from the possibly-just-changed rolEl.value here could mismatch which
  // checkboxes are actually on screen; orig?.role always matches what's rendered.
  const extraPermWrap = document.getElementById('perfil-extra-permisos-wrap');
  if (extraPermWrap && extraPermWrap.style.display !== 'none') {
    await _savePerfilExtraPermisos(userId, orig?.role || rolEl?.value);
  }

  toast('Cambios guardados', 'Perfil actualizado correctamente');
  closeModal('modal-perfil-empleado');
  renderPersonalList();
}

// DOM id for a registry entry's checkbox — matches the pre-existing convention
// (perfil-perm-boveda-legal, perfil-perm-redes-sociales: dashes, not underscores).
function _permCheckboxId(key) {
  return 'perfil-perm-' + key.replace(/_/g, '-');
}

// Entries applicable to a given target profile role — defaults to ['employee'] when a
// registry entry omits `roles`, preserving the original 7 entries' scope unchanged.
function _grantableModulesFor(targetRole) {
  return STAFF_GRANTABLE_MODULES.filter(m => (m.roles || ['employee']).includes(targetRole));
}

// Renders one checkbox per applicable STAFF_GRANTABLE_MODULES entry — called every time the
// profile modal opens so the toggle list always reflects the current registry, filtered to
// what makes sense for this target's role (Fase 3.3/3.4, 2026-08-20) — e.g. an instructor
// profile never shows the employee-only Personal/Contratos/etc. toggles.
function _renderPerfilExtraPermisosToggles(targetRole) {
  const list = document.getElementById('perfil-extra-permisos-list');
  if (!list) return;
  const applicable = _grantableModulesFor(targetRole);
  list.innerHTML = applicable.map((m, i) => `
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;${i < applicable.length - 1 ? 'margin-bottom:6px;' : ''}">
      <input type="checkbox" id="${_permCheckboxId(m.key)}"> ${m.label}
    </label>
  `).join('');
}

// Loads current grant state for all applicable registry checkboxes when opening a profile.
async function _loadPerfilExtraPermisos(userId, targetRole, readOnly) {
  _renderPerfilExtraPermisosToggles(targetRole);
  const applicable = _grantableModulesFor(targetRole);
  const checkboxes = applicable.map(m => document.getElementById(_permCheckboxId(m.key)));
  checkboxes.forEach(cb => { if (cb) cb.disabled = readOnly; });
  try {
    const { data, error } = await db.from('staff_extra_permissions').select('permission_key').eq('user_id', userId);
    if (error) throw error;
    const keys = new Set((data || []).map(r => r.permission_key));
    applicable.forEach(m => {
      const cb = document.getElementById(_permCheckboxId(m.key));
      if (cb) cb.checked = keys.has(m.key);
    });
  } catch (_) {
    checkboxes.forEach(cb => { if (cb) cb.checked = false; });
  }
}

// Diffs the applicable registry's checkboxes against the current grant rows and
// inserts/deletes accordingly. Scoped to `targetRole`'s applicable entries only, so saving
// e.g. an instructor's profile never touches employee-only keys that were never rendered
// (and so were never able to be affirmatively checked/unchecked by this admin).
async function _savePerfilExtraPermisos(userId, targetRole) {
  const wanted = {};
  _grantableModulesFor(targetRole).forEach(m => {
    wanted[m.key] = !!document.getElementById(_permCheckboxId(m.key))?.checked;
  });
  try {
    const { data } = await db.from('staff_extra_permissions').select('permission_key').eq('user_id', userId);
    const existing = new Set((data || []).map(r => r.permission_key));
    for (const [key, shouldHave] of Object.entries(wanted)) {
      const has = existing.has(key);
      if (shouldHave && !has) {
        await db.from('staff_extra_permissions').insert({ user_id: userId, permission_key: key, granted_by: currentUser?.id });
      } else if (!shouldHave && has) {
        await db.from('staff_extra_permissions').delete().eq('user_id', userId).eq('permission_key', key);
      }
    }
  } catch (err) {
    toast('Error al guardar permisos', err.message || 'Intenta de nuevo');
  }
}

async function reactivarEmpleado() {
  const modal  = document.getElementById('modal-perfil-empleado');
  const userId = modal?._empId;
  if (!userId) return;
  const emp = _personalData.find(e => e.id === userId);
  const nombre = emp?.nombre || 'este empleado';
  if (!confirm(`¿Reactivar a ${nombre}? Podrá volver a iniciar sesión.`)) return;

  const btn = document.getElementById('btn-reactivar-empleado');
  if (btn) { btn.textContent = 'Reactivando…'; btn.disabled = true; }

  // renderPersonalList() auto-deactivates any staff whose contract_end_date has already
  // passed (see its "Auto-deactivate staff" block) and it runs right after this closes
  // the modal — so a stale past end date would silently flip is_active back to false on
  // the very next list refresh. Clear it here so the reactivation actually sticks; the
  // admin can set a new end date afterwards via "Guardar cambios" if the contract renewed.
  // Note: users has no updated_at column (confirmed against the live schema —
  // only created_at exists), so it must not appear in this payload; PostgREST
  // rejects the entire update with "Could not find the 'updated_at' column" otherwise.
  const payload = { is_active: true };
  const hadExpiredContract = emp?.contratoFinDate && emp.contratoFinDate < _bogotaToday();
  if (hadExpiredContract) payload.contract_end_date = null;

  try {
    const { data: updated, error } = await db
      .from('users')
      .update(payload)
      .eq('id', userId)
      .select('is_active');
    if (error) throw error;
    // A silent RLS block returns no error but 0 rows — detect it explicitly.
    if (!updated || updated.length === 0) {
      throw new Error('Sin permiso para reactivar este usuario. Verifica la política RLS en Supabase.');
    }
    toast('Personal reactivado', hadExpiredContract
      ? `${nombre} puede volver a iniciar sesión. Se limpió la fecha de fin de contrato vencida — asigna una nueva si el contrato se renovó.`
      : `${nombre} puede volver a iniciar sesión`);
    closeModal('modal-perfil-empleado');
    await renderPersonalList();
  } catch (err) {
    toast('Error al reactivar', err.message || 'Intenta de nuevo');
    if (btn) { btn.textContent = 'Reactivar personal'; btn.disabled = false; }
  }
}

function showPerfilTab(tab) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
  const content = document.getElementById('tab-' + tab);
  const tabBtn  = document.querySelector(`.profile-tab[data-tab="${tab}"]`);
  if (content) content.classList.add('active');
  if (tabBtn)  tabBtn.classList.add('active');
}

async function guardarNuevoEmpleado() {
  const nombre      = (document.getElementById('ne-nombre')?.value       || '').trim();
  const cedula      = (document.getElementById('ne-cedula')?.value       || '').trim();
  const cargo       = (document.getElementById('ne-cargo')?.value        || '').trim() || null;
  const email       = (document.getElementById('ne-email')?.value        || '').trim().toLowerCase();
  const tel         = (document.getElementById('ne-tel')?.value          || '').trim() || null;
  const fechaNac    = (document.getElementById('ne-fechaNac')?.value     || '').trim() || null;
  const vinculacion = (document.getElementById('ne-vinculacion')?.value  || '').trim() || null;
  const dir         = (document.getElementById('ne-dir')?.value          || '').trim() || null;
  const emerNombre  = (document.getElementById('ne-emer-nombre')?.value  || '').trim() || null;
  const emerParen   = (document.getElementById('ne-emer-paren')?.value   || '').trim() || null;
  const emerTel     = (document.getElementById('ne-emer-tel')?.value     || '').trim() || null;

  if (!nombre) { toast('Campo requerido', 'Ingresa el nombre completo'); return; }
  if (!email)  { toast('Campo requerido', 'Ingresa el correo electrónico'); return; }
  if (!cedula) { toast('Campo requerido', 'Ingresa la cédula'); return; }

  const btn = document.querySelector('#modal-nuevo-empleado .btn-primary');
  if (btn) { btn.textContent = 'Creando…'; btn.disabled = true; }

  try {
    // Use non-persistent client so the admin session is not displaced
    const tempDb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    const { data: authData, error: signUpError } = await tempDb.auth.signUp({ email, password: cedula });
    if (signUpError) throw signUpError;
    if (!authData?.user?.id) throw new Error('No se pudo obtener el ID del nuevo empleado');

    const profileData = {
      id:                             authData.user.id,
      full_name:                      nombre,
      email,
      phone:                          tel,
      id_number:                      cedula,
      position:                       cargo,
      birth_date:                     fechaNac,
      address:                        dir,
      emergency_contact_name:         emerNombre,
      emergency_contact_relationship: emerParen,
      emergency_contact_phone:        emerTel,
      role:                           'employee',
      is_active:                      true
    };
    if (vinculacion) profileData.created_at = _bogotaMidnightUTC(vinculacion);

    const { error: profileError } = await db.from('users').upsert(profileData, { onConflict: 'id' });
    if (profileError) {
      // The auth account already exists at this point (and, if a DB trigger auto-provisions
      // a profile row on signup, so does an empty-named/role-less users row). Clean it up so a
      // failed attempt never leaves an invisible ghost row stuck in `public.users` — without
      // this, a retry hits "User already registered" on signUp while the employee shows up in
      // neither the Personal nor Usuarios list (see guardarNuevoUsuario()'s identical fix, 7b315bc).
      await db.from('users').delete().eq('id', authData.user.id);
      throw profileError;
    }

    // Register the initial password in the Credenciales vault so "Ver contraseña" works
    // immediately for this account, not only after a future reset. Non-fatal — the account
    // itself is already created either way.
    const { error: vaultError } = await db.rpc('store_user_credential', {
      target_user_id: authData.user.id,
      new_password:   cedula,
    });
    if (vaultError) console.warn('store_user_credential (empleado):', vaultError.message);

    ['ne-nombre', 'ne-cedula', 'ne-cargo', 'ne-email', 'ne-tel', 'ne-fechaNac', 'ne-dir', 'ne-emer-nombre', 'ne-emer-paren', 'ne-emer-tel'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const vincEl = document.getElementById('ne-vinculacion');
    if (vincEl) vincEl.value = _bogotaToday();

    closeModal('modal-nuevo-empleado');
    renderPersonalList();
    showCredencialesModal(email, cedula);
  } catch (err) {
    toast('Error al crear empleado', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Crear empleado'; btn.disabled = false; }
  }
}

async function renderEmployeeSelfProfile(containerId) {
  if (!currentUser) return;
  if (!_personalData.find(e => e.id === currentUser.id)) {
    const { data } = await db
      .from('users')
      .select('id, full_name, email, phone, role, is_active, created_at, position, id_number, birth_date, address, emergency_contact_name, emergency_contact_relationship, emergency_contact_phone')
      .eq('id', currentUser.id)
      .single();
    if (data) _personalData = [_mapDbUserToEmp(data, null), ..._personalData.filter(e => e.id !== currentUser.id)];
  }
  const emp = _personalData.find(e => e.id === currentUser.id);
  if (!emp) return;
  const c         = empColors[emp.color] || empColors.cyan;
  const container = document.getElementById(containerId || 'employee-self-container');
  if (!container) return;

  const field = (label, val) => `
    <div class="form-group">
      <label class="form-label">${label}</label>
      <div class="display-field">${val || '—'}</div>
    </div>`;

  const _missing = [
    !emp.email                                                   && 'correo',
    emp.telefono                === '—'                          && 'teléfono',
    emp.direccion               === '—'                          && 'dirección',
    emp.fechaNacimiento         === '—'                          && 'fecha de nacimiento',
    emp.contactoEmergencia.nombre   === '—'                      && 'contacto de emergencia',
    emp.contactoEmergencia.telefono === '—'                      && 'teléfono de emergencia',
  ].filter(Boolean);
  const _incompleteBanner = _missing.length
    ? `<div style="margin-bottom:16px;padding:12px 16px;background:rgba(255,193,7,0.12);border:1px solid rgba(255,193,7,0.35);border-radius:8px;font-size:13px;color:var(--amber);">⚠️ Perfil incompleto: faltan ${_missing.join(', ')}</div>`
    : '';

  // Mi horario de planta / horas extra / cambios de turno — vinculado instructors only
  // (2026-07-13). Read-only: reception/admin registers these from the Personal tab.
  const _showHorarioPlanta = currentUser?.role === 'instructor' && !_isPSContract(currentUser?.contract_type);
  const _horarioPlantaCard = _showHorarioPlanta ? `
    <div class="card mb-md">
      <div class="card-title">Mi Horario de Planta</div>
      <div id="self-horario-planta-grid" style="font-size:13px;color:var(--muted);">${_loader()}</div>
      <div style="display:flex;justify-content:space-between;margin-top:16px;">
        <div style="flex:1;">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Horas extra</div>
          <div id="self-horas-extra-list" style="font-size:13px;">${_loader()}</div>
        </div>
      </div>
      <div style="margin-top:16px;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Cambios de turno</div>
        <div id="self-cambios-turno-list" style="font-size:13px;">${_loader()}</div>
      </div>
    </div>` : '';

  container.innerHTML = `
    ${_incompleteBanner}
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding:20px;background:var(--card);border:1px solid var(--border);border-radius:12px;">
      <div style="width:52px;height:52px;border-radius:50%;background:${c.bg};color:${c.fg};display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;flex-shrink:0;">${emp.avatar}</div>
      <div>
        <div style="font-size:18px;font-weight:700;">${emp.nombre}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">${emp.cargo} · <span class="badge badge-green" style="font-size:10px;">Activo</span></div>
      </div>
    </div>
    <div class="grid-2 mb-md">
      <div class="card">
        <div class="card-title">Datos Personales</div>
        <div class="grid-2 gap-sm">
          ${field('Cédula', emp.cedula)}
          ${field('Fecha de nacimiento', emp.fechaNacimiento)}
          ${field('Teléfono', emp.telefono)}
          ${field('Email', emp.email)}
          ${field('Fecha de vinculación', emp.fechaVinculacion)}
        </div>
        ${field('Dirección', emp.direccion)}
      </div>
      <div class="card">
        <div class="card-title">Contacto de Emergencia</div>
        ${field('Nombre', emp.contactoEmergencia.nombre)}
        ${field('Parentesco', emp.contactoEmergencia.parentesco)}
        ${field('Teléfono', emp.contactoEmergencia.telefono)}
      </div>
    </div>
    ${_horarioPlantaCard}
    <div class="card">
      <div class="card-title">Mis Documentos</div>
      <div class="self-docs-rows">${_loader()}</div>
    </div>`;

  if (_showHorarioPlanta) _loadSelfHorarioPlanta(currentUser.id);

  const docsRows = container.querySelector('.self-docs-rows');
  if (docsRows) {
    let docsMap = {}; // category -> array of doc rows (Task B: multiple files per folder)
    try {
      const { data } = await db
        .from('employee_documents')
        .select('category, uploaded_at, filename, url')
        .eq('user_id', currentUser.id)
        .order('uploaded_at', { ascending: false });
      (data || []).forEach(d => { (docsMap[d.category] = docsMap[d.category] || []).push(d); });
    } catch (_) {}
    const visibleCats = _getVisibleDocCategories(currentUser?.contract_type, currentUser?.role);
    docsRows.innerHTML = visibleCats.map(cat => {
      const docs   = docsMap[cat.key] || [];
      const loaded = docs.length > 0;
      const fileLinks = docs.map(doc => {
        const date = doc.uploaded_at
          ? new Date(doc.uploaded_at).toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : null;
        return doc.url
          ? `<div><button class="btn btn-ghost btn-sm" onclick="window.open('${doc.url}','_blank')">Ver</button> <span style="font-size:11px;color:var(--muted2);">${date}</span></div>`
          : '';
      }).join('');
      return `<div class="doc-row" style="flex-direction:column;align-items:stretch;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="doc-icon">${loaded ? '✅' : '⚠️'}</div>
          <div class="doc-info">
            <div class="doc-name">${cat.label}</div>
            <div class="doc-date">${loaded ? `${docs.length} documento${docs.length !== 1 ? 's' : ''}` : 'Pendiente — contacta al administrador'}</div>
          </div>
        </div>
        ${fileLinks ? `<div class="doc-actions" style="padding-left:38px;">${fileLinks}</div>` : ''}
      </div>`;
    }).join('');
  }
}

// F2: dedicated read-only "Mis documentos" page for instructors
async function loadInstructorDocsPage() {
  const container = document.getElementById('instructor-docs-container');
  if (!container) return;
  container.innerHTML = `<div style="padding:20px 0;">${_loader()}</div>`;

  try {
    const { data, error } = await db
      .from('employee_documents')
      .select('category, filename, url, uploaded_at')
      .eq('user_id', currentUser.id)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;

    const docsMap = {}; // category -> array of doc rows (Task B: multiple files per folder)
    (data || []).forEach(d => { (docsMap[d.category] = docsMap[d.category] || []).push(d); });

    const visibleCats = _getVisibleDocCategories(currentUser?.contract_type, currentUser?.role);

    if (visibleCats.length === 0) {
      container.innerHTML = '<div class="card" style="color:var(--muted);padding:30px;text-align:center;">No hay categorías de documentos configuradas para tu tipo de contrato.</div>';
      return;
    }

    container.innerHTML = visibleCats.map(cat => {
      const docs   = docsMap[cat.key] || [];
      const loaded = docs.length > 0;

      const statusIcon  = loaded ? '✅' : '⚠️';
      const statusLabel = loaded
        ? `<span style="color:var(--green);font-weight:600;font-size:13px;">Subido${docs.length > 1 ? ` (${docs.length})` : ''}</span>`
        : `<span style="color:var(--amber);font-weight:600;font-size:13px;">Pendiente</span>`;
      const fileLines = loaded
        ? docs.map(doc => {
            const date = doc.uploaded_at
              ? new Date(doc.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
              : null;
            const link = doc.url
              ? `<a href="${doc.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-top:4px;display:inline-block;">Descargar / Ver</a>`
              : '';
            return `<div style="margin-top:4px;"><div style="font-size:12px;color:var(--muted);">${_escHtml(doc.filename || '')} · ${date}</div>${link}</div>`;
          }).join('')
        : `<div style="font-size:12px;color:var(--muted);margin-top:3px;">Este documento aún no ha sido subido por el administrador.</div>`;

      return `<div class="card mb-sm" style="display:flex;align-items:flex-start;gap:16px;padding:16px 20px;">
        <div style="font-size:22px;flex-shrink:0;">${statusIcon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${cat.label}</div>
          ${fileLines}
        </div>
        ${statusLabel}
      </div>`;
    }).join('');

    // Seguridad Social monthly history — PS instructors only (self-service upload)
    const isPSInstructor = _isPSContract(currentUser?.contract_type);
    if (isPSInstructor) {
      container.insertAdjacentHTML('beforeend', `
        <div class="card" style="margin-top:8px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div class="card-title" style="margin:0;">Seguridad Social — Registro mensual</div>
            <button class="btn btn-primary btn-sm" onclick="abrirNuevaSeguridadSocial()">+ Subir mes actual</button>
          </div>
          <div id="ss-historial-self">${_loader()}</div>
        </div>`);
      loadSeguridadSocialHistorial(currentUser.id, 'ss-historial-self', false);

      // Dotación — read-only view of items delivered to this PS trainer (Phase 2, 2026-07-13).
      // Reuses the same dotacion_entries table admin/reception manage from the Personal tab;
      // only rendered here when rows exist, per spec ("if any exist for that trainer").
      const { data: dotacionData } = await db
        .from('dotacion_entries')
        .select('*')
        .eq('instructor_id', currentUser.id)
        .order('fecha_entrega', { ascending: false });
      if (dotacionData && dotacionData.length) {
        const estadoBadge = (estado) => {
          const styles = {
            'Entregado': 'background:rgba(34,197,94,0.15);color:#22c55e;',
            'Devuelto':  'background:rgba(245,158,11,0.15);color:#f59e0b;',
            'Pendiente': 'background:rgba(255,59,92,0.15);color:var(--red);',
          };
          return `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${styles[estado] || ''}">${_escHtml(estado)}</span>`;
        };
        container.insertAdjacentHTML('beforeend', `
          <div class="card" style="margin-top:8px;">
            <div class="card-title" style="margin-bottom:12px;">Dotación entregada</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${dotacionData.map(e => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:8px;">
                  <div>
                    <div style="font-size:13px;font-weight:600;">${_escHtml(e.item)}</div>
                    <div style="font-size:12px;color:var(--muted);">${e.fecha_entrega}${e.observaciones ? ` · ${_escHtml(e.observaciones)}` : ''}</div>
                  </div>
                  ${estadoBadge(e.estado)}
                </div>`).join('')}
            </div>
          </div>`);
      }
    }
  } catch (err) {
    console.error('[Thor] loadInstructorDocsPage:', err);
    container.innerHTML = `<div class="card" style="color:var(--red);padding:20px;">Error al cargar documentos.<br><small>${err?.message || ''}</small></div>`;
  }
}

// ===================== INSTRUCTOR MODULE =====================
// NOTE: The profiles table role column must accept 'instructor' as a valid value.
// If a CHECK constraint limits the column, run in Supabase SQL editor:
//   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
//   ALTER TABLE users ADD CONSTRAINT users_role_check
//     CHECK (role IN ('admin', 'employee', 'instructor', 'user'));

async function loadInstructorDashboard() {
  const dateEl = document.getElementById('instructor-dashboard-date');
  if (dateEl) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    dateEl.textContent = `${dateStr} · VISTA INSTRUCTOR`;
  }

  const ciEl      = document.getElementById('inst-stat-checkins');
  const ciSub     = document.getElementById('inst-stat-checkins-sub');
  const previewEl = document.getElementById('instructor-checkin-preview');

  try {
    const today = _bogotaToday();
    const { data } = await db
      .from('attendance')
      .select('id, checked_in_at, notes, users(full_name)')
      .gte('checked_in_at', today)
      .order('checked_in_at', { ascending: false })
      .limit(8);

    if (ciEl)  ciEl.textContent  = data?.length ?? '—';
    if (ciSub) ciSub.textContent = 'Hoy';

    if (!previewEl) return;
    if (!data?.length) {
      previewEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px 0;text-align:center;">Sin check-ins registrados hoy</div>';
      return;
    }
    previewEl.innerHTML = data.map(a => {
      const name     = a.users?.full_name || 'Miembro';
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const time     = new Date(a.checked_in_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      return `<div class="stream-item">
        <div class="stream-avatar" style="background:rgba(0,207,255,0.15);color:var(--cyan);font-weight:700;font-size:12px;">${initials}</div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:500;">${name}</div>
          <div style="font-size:11px;color:var(--muted);">${a.notes || 'Check-in'}</div>
        </div>
        <div style="font-size:11px;color:var(--muted);">${time}</div>
      </div>`;
    }).join('');
  } catch (_) {
    if (previewEl) previewEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px 0;text-align:center;">Sin datos disponibles</div>';
  }
}

async function loadInstructorAsistencia() {
  const dateEl = document.getElementById('instructor-asistencia-date');
  if (dateEl) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
    dateEl.textContent = `Check-in de miembros · ${dateStr}`;
  }

  const tbody = document.getElementById('instructor-asistencia-tbody');
  if (!tbody) return;
  tbody.innerHTML = _loaderRow(3);

  try {
    const today = _bogotaToday();
    const { data, error } = await db
      .from('attendance')
      .select('id, checked_in_at, notes, users(full_name)')
      .gte('checked_in_at', today)
      .order('checked_in_at', { ascending: false });

    if (error) throw error;

    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--muted);">Sin asistencia registrada hoy</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(a => {
      const name     = a.users?.full_name || 'Miembro';
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const time     = new Date(a.checked_in_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      return `<tr>
        <td style="color:var(--muted);font-family:'Outfit',sans-serif;font-weight:500;letter-spacing:1px;">${time}</td>
        <td><div style="display:flex;align-items:center;gap:8px;"><div style="width:28px;height:28px;font-size:11px;background:rgba(0,212,232,0.15);color:var(--cyan);font-family:'Outfit',sans-serif;font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>${name}</div></td>
        <td>${a.notes ? `<span class="badge badge-cyan">${a.notes}</span>` : '<span class="badge badge-muted">—</span>'}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--red);">Error al cargar: ${err.message || 'Intenta de nuevo'}</td></tr>`;
  }
}

// ===================== INSTRUCTOR CLASES =====================

async function loadInstructorClasesPage() {
  const list = document.getElementById('instructor-clases-list');
  if (!list || !currentUser) return;
  list.innerHTML = _loader();

  const now = new Date();
  const today = _bogotaToday();
  const tomorrow = new Date(Date.now() + 86400000 - 5 * 3600 * 1000).toISOString().split('T')[0];

  try {
    const { data: todaySlots, error: sErr } = await db
      .from('schedule')
      .select('id, start_time, spots_available, class_id, classes(id, name, type, color, capacity, instructor_id)')
      .eq('class_date', today)
      .eq('is_cancelled', false)
      .order('start_time');

    if (sErr) throw sErr;

    const mySlots = (todaySlots || []).filter(s => s.classes?.instructor_id === currentUser.id);

    const DIAS  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
    const MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
    const subEl = document.getElementById('instructor-clases-sub');
    if (subEl) subEl.textContent = `Hoy ${DIAS[now.getDay()]} ${now.getDate()} ${MESES[now.getMonth()]} · ${mySlots.length} clase${mySlots.length !== 1 ? 's' : ''}`;

    if (mySlots.length === 0) {
      list.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--muted);">No tienes clases asignadas para hoy.</div>';
      return;
    }

    const myClassIds = [...new Set(mySlots.map(s => s.class_id))];

    const [tomorrowRes, attendanceRes] = await Promise.all([
      db.from('schedule')
        .select('id, class_id, start_time, routine_notes')
        .eq('class_date', tomorrow)
        .in('class_id', myClassIds)
        .eq('is_cancelled', false),
      // email never rendered here — stripped from the select for the same reason as
      // openClaseDetalle() above (no role gating on this query).
      db.from('attendance')
        .select('schedule_id, users(id, full_name)')
        .in('schedule_id', mySlots.map(s => s.id))
        .gte('checked_in_at', today + 'T00:00:00')
        .lte('checked_in_at', today + 'T23:59:59')
    ]);

    const tomorrowMap = {};
    (tomorrowRes.data || []).forEach(s => { tomorrowMap[s.class_id] = s; });

    const attendeesBySlot = {};
    (attendanceRes.data || []).forEach(a => {
      if (!attendeesBySlot[a.schedule_id]) attendeesBySlot[a.schedule_id] = [];
      if (a.users) attendeesBySlot[a.schedule_id].push(a.users);
    });

    list.innerHTML = mySlots.map(s => {
      const cls      = s.classes || {};
      const st       = _classBarStyle(cls);
      const dispTime = _fmtHour(s.start_time);
      const capacity = cls.capacity || 0;
      const users    = attendeesBySlot[s.id] || [];
      const tomSlot  = tomorrowMap[s.class_id];

      const usersHtml = users.length === 0
        ? '<div style="color:var(--muted);font-size:12px;padding:10px 0;text-align:center;">Sin asistencia registrada aún hoy.</div>'
        : users.map(u => {
            const initials = (u.full_name || '').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const safeId   = _esc(u.id);
            const safeName = _esc(u.full_name || '—');
            return `<div class="log-item">
              <div style="width:34px;height:34px;font-size:12px;background:rgba(0,212,232,0.12);color:var(--cyan);font-family:'Outfit',sans-serif;font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initials}</div>
              <div style="flex:1;">
                <div style="font-size:13px;font-weight:500;">${safeName}</div>
                <div style="font-size:11px;color:var(--muted);">Asistió hoy</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="openBodyProgressModal('${safeId}','${safeName}')">Progreso corporal</button>
            </div>`;
          }).join('');

      const routineSection = tomSlot
        ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
             <div style="font-size:11px;color:var(--muted2);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">Rutina del día siguiente</div>
             <textarea id="routine-${tomSlot.id}" class="form-input" rows="4" style="resize:vertical;font-size:13px;font-family:inherit;" placeholder="Describe la rutina para mañana...">${_esc(tomSlot.routine_notes || '')}</textarea>
             <div style="margin-top:8px;text-align:right;">
               <button class="btn btn-primary btn-sm" onclick="saveRoutineNotes('${tomSlot.id}','routine-${tomSlot.id}')">Guardar rutina</button>
             </div>
           </div>`
        : '';

      return `<div class="card${st.card} mb-md" id="class-card-${s.id}">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;cursor:pointer;" onclick="toggleClassExpand('${s.id}')">
          <div style="display:flex;align-items:center;gap:14px;">
            <div style="width:4px;height:50px;background:${st.bar};border-radius:2px;box-shadow:0 0 10px ${st.bar}40;flex-shrink:0;"></div>
            <div>
              <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:20px;letter-spacing:2px;color:${st.bar};">${_esc(cls.name || 'Clase')}</div>
              <div style="font-size:12px;color:var(--muted);">${dispTime} · ${users.length} / ${capacity} asistentes</div>
            </div>
          </div>
          <span class="badge badge-cyan" id="class-toggle-badge-${s.id}">Ver asistentes ▾</span>
        </div>
        <div id="class-body-${s.id}" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
          <div style="font-size:11px;color:var(--muted2);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">Asistentes hoy</div>
          ${usersHtml}
          ${routineSection}
        </div>
      </div>`;
    }).join('');

  } catch (err) {
    console.error('loadInstructorClasesPage:', err);
    list.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--red);">Error al cargar clases. Intenta de nuevo.</div>';
  }
}

function toggleClassExpand(scheduleId) {
  const body  = document.getElementById('class-body-' + scheduleId);
  const badge = document.getElementById('class-toggle-badge-' + scheduleId);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (badge) badge.textContent = isOpen ? 'Ver asistentes ▾' : 'Ocultar ▴';
}

async function saveRoutineNotes(scheduleId, textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const notes   = textarea.value.trim();
  const saveBtn = textarea.parentElement?.querySelector('.btn-primary');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

  const { error } = await db
    .from('schedule')
    .update({ routine_notes: notes || null })
    .eq('id', scheduleId);

  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar rutina'; }
  if (error) { toast('Error al guardar', error.message); return; }
  toast('Rutina guardada', 'Los alumnos la verán en su vista de Clases');
}

// Resumen de Clases — PS instructors only (Phase 4.7, 2026-07-14). All past and upcoming
// classes with valor, ocupación, and estado. Reads class_occurrences directly (existing
// per-date snapshot table, RLS already grants each instructor their own rows via
// class_occurrences_instructor_own_select — see 20260706_class_occurrences.sql) rather than
// deriving from schedule/classes like the today-only loadInstructorClasesPage() does.
//
// estado reflects class_occurrences.status (scheduled/cancelled/completed) — unchanged.
// Pago (Fase 4.4, 2026-08-20) is a SEPARATE lookup against class_occurrence_billing (see
// 20260820_class_occurrence_billing.sql) rather than a new column on class_occurrences itself —
// that table's UPDATE policy permanently blocks writes once a row is 'completed', for every
// role including admin, so payment state can never live there. A completed occurrence is
// "Pagada" once it has a matching class_occurrence_billing row (inserted when the cuenta de
// cobro covering its period is marked paid — see marcarPagadoAdmin()/subirComprobantePago()),
// otherwise "Pendiente". scheduled/cancelled rows never show a pago badge — they're not billable.
async function loadInstructorResumenClasesPage() {
  const container = document.getElementById('instructor-resumen-clases-container');
  if (!container || !currentUser) return;
  container.innerHTML = _loader();

  try {
    const { data, error } = await db
      .from('class_occurrences')
      .select('id, class_name, occurrence_date, start_time, price_cop_at_time, capacity_at_time, attendance_count, status')
      .eq('instructor_id', currentUser.id)
      .order('occurrence_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = '<div class="card" style="color:var(--muted);padding:30px;text-align:center;">No hay clases registradas todavía.</div>';
      return;
    }

    // Paid lookup — mirrors the bookingCountBySlot pattern (fetch related rows once, build a
    // Set for O(1) per-row lookup) rather than a per-row query.
    const occIds = data.map(o => o.id);
    let paidSet = new Set();
    if (occIds.length) {
      const { data: paidRows, error: paidErr } = await db
        .from('class_occurrence_billing')
        .select('occurrence_id')
        .in('occurrence_id', occIds);
      if (paidErr) throw paidErr;
      paidSet = new Set((paidRows || []).map(r => r.occurrence_id));
    }

    const estadoBadge = (status) => {
      const map = {
        scheduled: { label: 'Programada', style: 'background:rgba(0,207,255,0.15);color:var(--cyan);' },
        completed: { label: 'Dictada',    style: 'background:rgba(34,197,94,0.15);color:#22c55e;' },
        cancelled: { label: 'Cancelada',  style: 'background:rgba(255,59,92,0.15);color:var(--red);' },
      };
      const s = map[status] || { label: status, style: '' };
      return `<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${s.style}">${s.label}</span>`;
    };

    const pagoBadge = (o) => {
      if (o.status !== 'completed') return '<span style="color:var(--muted);">—</span>';
      return paidSet.has(o.id)
        ? '<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(34,197,94,0.15);color:#22c55e;">Pagada</span>'
        : '<span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:rgba(255,193,7,0.15);color:#ffc107;">Pendiente</span>';
    };

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table" style="width:100%;min-width:680px;">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Clase</th>
              <th>Valor</th>
              <th>Ocupación</th>
              <th>Estado</th>
              <th>Pago</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(o => {
              const valor = o.price_cop_at_time != null ? `$${o.price_cop_at_time.toLocaleString('es-CO')}` : '—';
              const ocup  = o.capacity_at_time ? `${o.attendance_count ?? 0} / ${o.capacity_at_time}` : (o.attendance_count ?? '—');
              return `<tr>
                <td>${o.occurrence_date} · ${_fmtHour(o.start_time)}</td>
                <td style="font-weight:500;">${_escHtml(o.class_name)}</td>
                <td>${valor}</td>
                <td>${ocup}</td>
                <td>${estadoBadge(o.status)}</td>
                <td>${pagoBadge(o)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    console.error('[Thor] loadInstructorResumenClasesPage:', err);
    container.innerHTML = `<div class="card" style="color:var(--red);padding:20px;">Error al cargar el resumen.<br><small>${err?.message || ''}</small></div>`;
  }
}

// ===================== INSTRUCTOR BILLING =====================

function _formatBillingPeriod(period) {
  if (!period) return '—';
  const [year, month] = period.split('-');
  const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[parseInt(month, 10)] || month} ${year}`;
}

async function loadInstructorPagosPage() {
  const tbody = document.getElementById('instructor-billing-tbody');
  if (!tbody || !currentUser) return;

  // Vinculados (Término indefinido/fijo) never reach this page —
  // _applyInstructorPermissions hides their nav-inst-pagos link.
  // Everyone else who lands here can upload.
  const canBill = true;
  const uploadBtn = document.querySelector('[onclick="abrirNuevaCuentaCobro()"]');
  if (uploadBtn) uploadBtn.style.display = '';

  tbody.innerHTML = _loaderRow(5);

  try {
    const { data, error } = await db
      .from('instructor_billing')
      .select('*')
      .eq('instructor_id', currentUser.id)
      .order('period', { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted);">No has subido cuentas de cobro aún.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(b => {
      const uploadDate  = b.invoice_uploaded_at ? new Date(b.invoice_uploaded_at).toLocaleDateString('es-CO') : '—';
      const shortName   = b.invoice_filename ? (b.invoice_filename.length > 22 ? b.invoice_filename.slice(0, 19) + '…' : b.invoice_filename) : 'Ver';
      const invoiceBtn  = b.invoice_url
        ? `<div style="display:flex;flex-direction:column;gap:3px;align-items:flex-start;">
             <a href="${b.invoice_url}" target="_blank" style="color:var(--cyan);font-size:12px;" title="${b.invoice_filename || ''}">${shortName}</a>
             ${canBill ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px;" onclick="reemplazarCuentaCobro('${b.period}')">Reemplazar</button>` : ''}
           </div>`
        : '<span style="color:var(--muted);font-size:12px;">—</span>';
      const statusBadge = b.status === 'paid'
        ? '<span class="badge badge-green">Pagado</span>'
        : '<span class="badge badge-amber">Pendiente</span>';
      const paymentBtn  = b.payment_url ? `<button class="btn btn-ghost btn-sm" onclick="window.open('${b.payment_url}','_blank')">Ver comprobante</button>` : '<span style="color:var(--muted);font-size:12px;">—</span>';
      return `<tr>
        <td style="font-weight:500;">${_formatBillingPeriod(b.period)}</td>
        <td style="color:var(--muted2);font-size:12px;">${uploadDate}</td>
        <td>${invoiceBtn}</td>
        <td>${statusBadge}</td>
        <td>${paymentBtn}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--red);">Error al cargar: ${err.message}</td></tr>`;
  }
}

function abrirNuevaCuentaCobro() {
  const yearSel = document.getElementById('ncc-año');
  if (yearSel) {
    yearSel.innerHTML = '';
    const curYear = new Date().getFullYear();
    for (let y = curYear; y >= curYear - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSel.appendChild(opt);
    }
  }
  const mesSel = document.getElementById('ncc-mes');
  if (mesSel) mesSel.value = String(new Date().getMonth() + 1).padStart(2, '0');
  const nameEl = document.getElementById('ncc-file-name');
  if (nameEl) nameEl.textContent = 'Haz clic para seleccionar archivo';
  const fileInput = document.getElementById('ncc-file-input');
  if (fileInput) fileInput.value = '';
  const notasEl = document.getElementById('ncc-notas');
  if (notasEl) notasEl.value = '';
  openModal('nueva-cuenta-cobro');
  _actualizarResumenCuentaCobro();
}

function reemplazarCuentaCobro(period) {
  // period = "YYYY-MM" — open the modal pre-filled so the upsert replaces the existing row
  const [year, month] = period.split('-');
  abrirNuevaCuentaCobro();          // resets form & opens modal (also loads the resumen for today's period)
  const yearSel = document.getElementById('ncc-año');
  const mesSel  = document.getElementById('ncc-mes');
  if (yearSel) yearSel.value = year;
  if (mesSel)  mesSel.value  = month;
  _actualizarResumenCuentaCobro();  // reload for the actual period being replaced
}

// [inclusive start, exclusive end) date strings (YYYY-MM-DD) for a 'YYYY-MM' billing period.
// Shared by the trainer-facing resumen below and by the admin "mark as paid" linker further
// down, so both agree exactly on which occurrence_date range counts as "this period".
function _periodDateBounds(period) {
  const [y, m] = period.split('-').map(Number);
  const start  = `${period}-01`;
  const nextY  = m === 12 ? y + 1 : y;
  const nextM  = m === 12 ? 1 : m + 1;
  const end    = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end };
}

// Read-only summary panel inside the "Nueva cuenta de cobro" modal (Fase 4.4, 2026-08-20) — the
// trainer sees, live from class_occurrences, exactly which classes the cuenta de cobro they're
// about to upload/replace should cover: date, time, class name, valor, and a total. Reuses the
// same query shape as loadInstructorResumenClasesPage(), scoped to one period and to
// status='completed' (only dictated classes are ever paid — see 20260706_class_occurrences.sql).
// Purely informational — does not write anything, does not gate the upload.
async function _actualizarResumenCuentaCobro() {
  const container = document.getElementById('ncc-resumen-clases');
  const mes = document.getElementById('ncc-mes')?.value;
  const año = document.getElementById('ncc-año')?.value;
  if (!container || !mes || !año || !currentUser) return;

  const period = `${año}-${mes}`;
  container.innerHTML = _loader();

  try {
    const { start, end } = _periodDateBounds(period);
    const { data, error } = await db
      .from('class_occurrences')
      .select('class_name, occurrence_date, start_time, price_cop_at_time')
      .eq('instructor_id', currentUser.id)
      .eq('status', 'completed')
      .gte('occurrence_date', start)
      .lt('occurrence_date', end)
      .order('occurrence_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">No hay clases dictadas registradas para este período.</div>';
      return;
    }

    const total = data.reduce((sum, o) => sum + (o.price_cop_at_time || 0), 0);

    container.innerHTML = `
      <div style="max-height:180px;overflow-y:auto;border:1px solid var(--border2);border-radius:8px;">
        <table class="data-table" style="width:100%;font-size:12px;">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Clase</th><th>Valor</th></tr></thead>
          <tbody>
            ${data.map(o => `<tr>
              <td>${o.occurrence_date}</td>
              <td>${_fmtHour(o.start_time)}</td>
              <td>${_escHtml(o.class_name)}</td>
              <td>${o.price_cop_at_time != null ? '$' + o.price_cop_at_time.toLocaleString('es-CO') : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="text-align:right;font-weight:700;margin-top:6px;font-size:13px;">Total: $${total.toLocaleString('es-CO')}</div>`;
  } catch (err) {
    console.error('[Thor] _actualizarResumenCuentaCobro:', err);
    container.innerHTML = `<div style="color:var(--red);font-size:12px;">Error al cargar el resumen: ${_escHtml(err?.message || '')}</div>`;
  }
}

function nccFileSelected(input) {
  const file = input.files?.[0];
  const nameEl = document.getElementById('ncc-file-name');
  if (nameEl) nameEl.textContent = file ? file.name : 'Haz clic para seleccionar archivo';
}

async function subirCuentaCobro() {
  const mes   = document.getElementById('ncc-mes')?.value;
  const año   = document.getElementById('ncc-año')?.value;
  const file  = document.getElementById('ncc-file-input')?.files?.[0];
  const notas = (document.getElementById('ncc-notas')?.value || '').trim() || null;

  if (!mes || !año) { toast('Campo requerido', 'Selecciona el período'); return; }
  if (!file)        { toast('Archivo requerido', 'Selecciona el archivo a subir'); return; }

  const period = `${año}-${mes}`;
  const btn    = document.querySelector('#modal-nueva-cuenta-cobro .btn-primary');
  if (btn) { btn.textContent = 'Subiendo…'; btn.disabled = true; }

  try {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `invoices/${currentUser.id}/${period}.${ext}`;

    const { error: storageErr } = await db.storage
      .from('instructor-billing')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (storageErr) throw storageErr;

    const { data: { publicUrl } } = db.storage.from('instructor-billing').getPublicUrl(path);

    const { error: dbErr } = await db.from('instructor_billing').upsert({
      instructor_id:       currentUser.id,
      period,
      invoice_url:         publicUrl,
      invoice_filename:    file.name,
      invoice_uploaded_at: new Date().toISOString(),
      notes:               notas,
      status:              'pending'
    }, { onConflict: 'instructor_id,period' });
    if (dbErr) throw dbErr;

    closeModal('modal-nueva-cuenta-cobro');
    toast('Cuenta subida', _formatBillingPeriod(period));
    _notifyAdminsAndReception(
      'Nueva cuenta de cobro',
      `${currentUser.full_name || 'Un instructor'} subió la cuenta de cobro de ${_formatBillingPeriod(period)}.`
    );
    loadInstructorPagosPage();
  } catch (err) {
    toast('Error al subir', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Subir cuenta'; btn.disabled = false; }
  }
}

async function openAdminBillingModal(instructorId, instructorName) {
  const modal = document.getElementById('modal-admin-billing');
  if (!modal) return;
  modal._instructorId = instructorId;
  const nameEl = document.getElementById('admin-billing-nombre');
  if (nameEl) nameEl.textContent = instructorName;
  openModal('admin-billing');
  await loadAdminBillingList(instructorId);
}

async function loadAdminBillingList(instructorId) {
  const tbody = document.getElementById('admin-billing-tbody');
  if (!tbody) return;
  tbody.innerHTML = _loaderRow(6);

  try {
    const { data, error } = await db
      .from('instructor_billing')
      .select('*')
      .eq('instructor_id', instructorId)
      .order('period', { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted);">Sin cuentas de cobro registradas.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(b => {
      const uploadDate  = b.invoice_uploaded_at ? new Date(b.invoice_uploaded_at).toLocaleDateString('es-CO') : '—';
      const shortInv    = b.invoice_filename
        ? (b.invoice_filename.length > 18 ? b.invoice_filename.slice(0, 15) + '…' : b.invoice_filename)
        : 'Ver archivo';
      const invoiceCell = b.invoice_url
        ? `<a href="${b.invoice_url}" target="_blank" style="color:var(--cyan);font-size:12px;display:flex;align-items:center;gap:4px;" title="${b.invoice_filename || ''}">📄 ${shortInv}</a>`
        : '<span style="color:var(--muted);font-size:12px;">—</span>';
      const statusBadge = b.status === 'paid'
        ? '<span class="badge badge-green">Pagado</span>'
        : '<span class="badge badge-amber">Pendiente</span>';
      const shortPay    = b.payment_filename
        ? (b.payment_filename.length > 16 ? b.payment_filename.slice(0, 13) + '…' : b.payment_filename)
        : 'Ver';
      const paymentCell = b.payment_url
        ? `<a href="${b.payment_url}" target="_blank" style="color:var(--cyan);font-size:12px;display:flex;align-items:center;gap:4px;" title="${b.payment_filename || ''}">📄 ${shortPay}</a>`
        : '<span style="color:var(--muted);font-size:11px;">—</span>';
      const actionCell  = b.status !== 'paid'
        ? `<div style="display:flex;gap:5px;flex-wrap:wrap;">
             <button class="btn btn-primary btn-sm" style="font-size:10px;padding:3px 10px;" onclick="marcarPagadoAdmin('${b.id}','${instructorId}')">✓ Pagado</button>
             <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 10px;" onclick="subirComprobantePago('${b.id}','${instructorId}')">↑ Desprendible</button>
           </div>`
        : `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 10px;" onclick="subirComprobantePago('${b.id}','${instructorId}')">${b.payment_url ? '↑ Reemplazar' : '↑ Desprendible'}</button>`;
      return `<tr>
        <td style="font-weight:500;">${_formatBillingPeriod(b.period)}</td>
        <td style="color:var(--muted2);font-size:12px;">${uploadDate}</td>
        <td>${invoiceCell}</td>
        <td>${statusBadge}</td>
        <td>${paymentCell}</td>
        <td>${actionCell}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);">${err.message}</td></tr>`;
  }
}

async function subirComprobantePago(billingId, instructorId) {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.pdf,.jpg,.jpeg,.png,.webp';

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const { data: billing } = await db.from('instructor_billing').select('period').eq('id', billingId).single();
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `payments/${instructorId}/${billing?.period || billingId}.${ext}`;

      const { error: storageErr } = await db.storage
        .from('instructor-billing')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (storageErr) throw storageErr;

      const { data: { publicUrl } } = db.storage.from('instructor-billing').getPublicUrl(path);

      const { error: dbErr } = await db.from('instructor_billing').update({
        payment_url:         publicUrl,
        payment_filename:    file.name,
        payment_uploaded_at: new Date().toISOString(),
        status:              'paid'
      }).eq('id', billingId);
      if (dbErr) throw dbErr;

      // This upload also flips status to 'paid' (same as the explicit "✓ Pagado" button below) —
      // sweep this instructor's dictated classes for this period into class_occurrence_billing.
      if (billing?.period) await _marcarClasesPagadasParaCuenta(billingId, instructorId, billing.period);

      toast('Comprobante subido', 'El instructor puede verlo ahora');
      loadAdminBillingList(instructorId);
    } catch (err) {
      toast('Error al subir', err.message || 'Intenta de nuevo');
    }
  };

  input.click();
}

// Populates class_occurrence_billing once a cuenta de cobro is marked 'paid' — one row per
// class_occurrences row belonging to this instructor with status='completed' whose
// occurrence_date falls inside this billing period's month (Fase 4.4, 2026-08-20).
//
// This is the ONLY write path into class_occurrence_billing, and it never touches
// class_occurrences itself — that table's RLS permanently blocks UPDATE once a row is
// 'completed' (see 20260706_class_occurrences.sql, class_occurrences_admin_update policy), so
// "paid" state is tracked exclusively in this separate join table. Idempotent: re-running for
// the same billing/period (e.g. comprobante re-uploaded after already being marked paid) simply
// no-ops on rows that already have a link, via the UNIQUE(occurrence_id) constraint +
// ignoreDuplicates.
async function _marcarClasesPagadasParaCuenta(billingId, instructorId, period) {
  try {
    const { start, end } = _periodDateBounds(period);
    const { data: occurrences, error: occErr } = await db
      .from('class_occurrences')
      .select('id')
      .eq('instructor_id', instructorId)
      .eq('status', 'completed')
      .gte('occurrence_date', start)
      .lt('occurrence_date', end);
    if (occErr) throw occErr;
    if (!occurrences?.length) return;

    const rows = occurrences.map(o => ({
      occurrence_id:         o.id,
      instructor_billing_id: billingId,
      marked_paid_at:        new Date().toISOString()
    }));

    const { error: linkErr } = await db
      .from('class_occurrence_billing')
      .upsert(rows, { onConflict: 'occurrence_id', ignoreDuplicates: true });
    if (linkErr) throw linkErr;
  } catch (err) {
    // Non-fatal: the cuenta de cobro is already marked paid at this point either way — a
    // failure here only means the per-class "Pagada" badge won't reflect it yet, not that the
    // payment itself failed. Logged so it's visible without blocking the admin's flow.
    console.error('[Thor] _marcarClasesPagadasParaCuenta:', err);
  }
}

async function marcarPagadoAdmin(billingId, instructorId) {
  try {
    const { data: billing, error: fetchErr } = await db
      .from('instructor_billing')
      .select('period')
      .eq('id', billingId)
      .single();
    if (fetchErr) throw fetchErr;

    const { error } = await db
      .from('instructor_billing')
      .update({ status: 'paid', payment_uploaded_at: new Date().toISOString() })
      .eq('id', billingId);
    if (error) throw error;

    // Trigger point: marking the cuenta de cobro 'paid' is what sweeps this instructor's
    // completed classes for `billing.period` into class_occurrence_billing.
    if (billing?.period) await _marcarClasesPagadasParaCuenta(billingId, instructorId, billing.period);

    toast('Marcado como pagado', '');
    loadAdminBillingList(instructorId);
  } catch (err) {
    toast('Error', err.message || 'Intenta de nuevo');
  }
}

// ===================== SEGURIDAD SOCIAL — REGISTRO MENSUAL (PS instructors) =====================
// Mirrors the instructor_billing cuenta-de-cobro pattern: one row per (instructor, period),
// self-uploaded by the instructor into a dedicated storage bucket, with an admin "reviewed"
// flag so history persists independently of the single-slot employee_documents overwrite.

function ssFileSelected(input) {
  const file = input.files?.[0];
  const nameEl = document.getElementById('ss-file-name');
  if (nameEl) nameEl.textContent = file ? file.name : 'Haz clic para seleccionar archivo';
}

function abrirNuevaSeguridadSocial() {
  const yearSel = document.getElementById('ss-año');
  if (yearSel) {
    yearSel.innerHTML = '';
    const curYear = new Date().getFullYear();
    for (let y = curYear; y >= curYear - 2; y--) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      yearSel.appendChild(opt);
    }
  }
  const mesSel = document.getElementById('ss-mes');
  if (mesSel) mesSel.value = String(new Date().getMonth() + 1).padStart(2, '0');
  const nameEl = document.getElementById('ss-file-name');
  if (nameEl) nameEl.textContent = 'Haz clic para seleccionar archivo';
  const fileInput = document.getElementById('ss-file-input');
  if (fileInput) fileInput.value = '';
  openModal('seguridad-social-mensual');
}

async function subirSeguridadSocialMensual() {
  const mes  = document.getElementById('ss-mes')?.value;
  const año  = document.getElementById('ss-año')?.value;
  const file = document.getElementById('ss-file-input')?.files?.[0];

  if (!mes || !año) { toast('Campo requerido', 'Selecciona el período'); return; }
  if (!file)        { toast('Archivo requerido', 'Selecciona el archivo a subir'); return; }

  const period = `${año}-${mes}`;
  const btn    = document.querySelector('#modal-seguridad-social-mensual .btn-primary');
  if (btn) { btn.textContent = 'Subiendo…'; btn.disabled = true; }

  try {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `submissions/${currentUser.id}/${period}.${ext}`;

    const { error: storageErr } = await db.storage
      .from('seguridad-social')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (storageErr) throw storageErr;

    const { data: { publicUrl } } = db.storage.from('seguridad-social').getPublicUrl(path);

    // Conditional payload: on upsert-over-existing, don't touch reviewed/reviewed_by/reviewed_at —
    // replacing the file for an already-reviewed month should not silently keep it marked reviewed
    // forever, but it also must not be forced by this insert. Re-review is an explicit admin action.
    const { error: dbErr } = await db.from('seguridad_social_submissions').upsert({
      instructor_id: currentUser.id,
      period,
      file_url:      publicUrl,
      filename:      file.name,
      uploaded_at:   new Date().toISOString(),
    }, { onConflict: 'instructor_id,period' });
    if (dbErr) throw dbErr;

    closeModal('modal-seguridad-social-mensual');
    toast('Registro subido', _formatBillingPeriod(period));
    _notifyAdminsAndReception(
      'Nuevo registro de Seguridad Social',
      `${currentUser.full_name || 'Un instructor'} subió el registro de Seguridad Social de ${_formatBillingPeriod(period)}.`
    );
    loadSeguridadSocialHistorial(currentUser.id, 'ss-historial-self', false);
  } catch (err) {
    toast('Error al subir', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Subir registro'; btn.disabled = false; }
  }
}

// canReview: true when rendered inside the admin staff-profile view (adds "Marcar revisado")
async function loadSeguridadSocialHistorial(instructorId, containerId, canReview) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const { data, error } = await db
      .from('seguridad_social_submissions')
      .select('id, period, filename, file_url, uploaded_at, reviewed')
      .eq('instructor_id', instructorId)
      .order('period', { ascending: false });
    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px 0;">Sin registros de Seguridad Social todavía.</div>';
      return;
    }

    container.innerHTML = `<table class="data-table"><thead><tr>
        <th>Período</th><th>Archivo</th><th>Subido</th><th>Estado</th>${canReview ? '<th></th>' : ''}
      </tr></thead><tbody>${data.map(s => {
        const uploadDate = s.uploaded_at ? new Date(s.uploaded_at).toLocaleDateString('es-CO') : '—';
        const fileCell = s.file_url
          ? `<a href="${s.file_url}" target="_blank" style="color:var(--cyan);font-size:12px;">📄 ${_escHtml(s.filename || 'Ver')}</a>`
          : '<span style="color:var(--muted);font-size:12px;">—</span>';
        const statusBadge = s.reviewed
          ? '<span class="badge badge-green">Revisado</span>'
          : '<span class="badge badge-amber">Pendiente revisión</span>';
        const reviewBtn = (canReview && !s.reviewed)
          ? `<button class="btn btn-ghost btn-sm" onclick="marcarRevisadaSeguridadSocial('${s.id}','${instructorId}','${containerId}')">✓ Marcar revisado</button>`
          : '';
        return `<tr>
          <td style="font-weight:500;">${_formatBillingPeriod(s.period)}</td>
          <td>${fileCell}</td>
          <td style="color:var(--muted2);font-size:12px;">${uploadDate}</td>
          <td>${statusBadge}</td>
          ${canReview ? `<td>${reviewBtn}</td>` : ''}
        </tr>`;
      }).join('')}</tbody></table>`;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--red);font-size:12px;">${err.message}</div>`;
  }
}

async function marcarRevisadaSeguridadSocial(submissionId, instructorId, containerId) {
  try {
    const { error } = await db
      .from('seguridad_social_submissions')
      .update({ reviewed: true, reviewed_by: currentUser.id, reviewed_at: new Date().toISOString() })
      .eq('id', submissionId);
    if (error) throw error;
    toast('Marcado como revisado', '');
    loadSeguridadSocialHistorial(instructorId, containerId, true);
  } catch (err) {
    toast('Error', err.message || 'Intenta de nuevo');
  }
}

// ===================== BODY PROGRESS (SHARED) =====================

function openSelfBodyProgress() {
  if (currentUser) openBodyProgressModal(currentUser.id, currentUser.full_name);
}

async function openBodyProgressModal(userId, userName) {
  const targetIdEl   = document.getElementById('bp-target-user-id');
  const targetNameEl = document.getElementById('bp-target-user-name');
  if (targetIdEl) targetIdEl.value = userId;

  if (targetNameEl) {
    if (userId !== currentUser?.id) {
      targetNameEl.textContent = 'Registrando para: ' + (userName || userId);
      targetNameEl.style.display = 'block';
    } else {
      targetNameEl.style.display = 'none';
    }
  }

  // Clear fields first
  ['bp-weight','bp-fat','bp-muscle','bp-chest','bp-waist','bp-hip','bp-arm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Pre-populate with most recent record for this user
  const { data: recent } = await db
    .from('body_progress')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .single();

  if (recent) {
    const setInput = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    setInput('bp-weight', recent.weight_kg);
    setInput('bp-fat',    recent.body_fat_pct);
    setInput('bp-muscle', recent.muscle_mass_kg);
    setInput('bp-chest',  recent.chest_cm);
    setInput('bp-waist',  recent.waist_cm);
    setInput('bp-hip',    recent.hip_cm);
    setInput('bp-arm',    recent.arm_cm);
  }

  openModal('medidas');
}

async function saveBodyProgress() {
  const userId = document.getElementById('bp-target-user-id')?.value || currentUser?.id;
  if (!userId) { toast('Error', 'No se pudo determinar el usuario'); return; }

  const btn = document.getElementById('bp-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const floatVal = id => {
    const v = parseFloat(document.getElementById(id)?.value || '');
    return isNaN(v) ? null : v;
  };

  const payload = {
    user_id:        userId,
    measured_at:    _bogotaToday(),
    weight_kg:      floatVal('bp-weight'),
    body_fat_pct:   floatVal('bp-fat'),
    muscle_mass_kg: floatVal('bp-muscle'),
    chest_cm:       floatVal('bp-chest'),
    waist_cm:       floatVal('bp-waist'),
    hip_cm:         floatVal('bp-hip'),
    arm_cm:         floatVal('bp-arm'),
  };

  const { error } = await db.from('body_progress').insert(payload);

  if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
  if (error) { toast('Error al guardar', error.message); return; }

  closeModal('modal-medidas');
  toast('Medidas guardadas', 'Registro guardado correctamente');

  if (userId === currentUser?.id && document.getElementById('page-progreso')?.classList.contains('active')) {
    loadProgresoPage(userId);
  }
}

// ===================== USER CLASES VIEW =====================

async function loadUserClasesPage() {
  const list = document.getElementById('user-clases-list');
  if (!list) return;
  list.innerHTML = _loader();

  const bogotaMs = Date.now() - 5 * 3600 * 1000;
  const todayStr = new Date(bogotaMs).toISOString().split('T')[0];
  const endStr   = new Date(bogotaMs + 6 * 86400000).toISOString().split('T')[0];

  try {
    const { data: slots, error } = await db
      .from('schedule')
      .select('id, class_date, start_time, spots_available, routine_notes, classes(id, name, type, color, capacity, instructor_id)')
      .gte('class_date', todayStr)
      .lte('class_date', endStr)
      .eq('is_cancelled', false)
      .order('class_date')
      .order('start_time');

    if (error) throw error;

    if (!slots?.length) {
      list.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--muted);">Sin clases programadas para los próximos 7 días.</div>';
      return;
    }

    const instructorIds = [...new Set((slots).map(s => s.classes?.instructor_id).filter(Boolean))];
    const instructorMap = {};
    if (instructorIds.length) {
      const { data: instructors } = await db
        .from('users')
        .select('id, full_name')
        .in('id', instructorIds);
      (instructors || []).forEach(u => { instructorMap[u.id] = u.full_name; });
    }

    const byDate = {};
    slots.forEach(s => {
      if (!byDate[s.class_date]) byDate[s.class_date] = [];
      byDate[s.class_date].push(s);
    });

    const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const tomorrowStr = new Date(bogotaMs + 86400000).toISOString().split('T')[0];

    let html = '';
    for (const [dateStr, daySlots] of Object.entries(byDate).sort()) {
      const d        = new Date(dateStr + 'T12:00:00');
      const isToday  = dateStr === todayStr;
      const isTomorrow = dateStr === tomorrowStr;
      const dayLabel = isToday ? 'HOY' : isTomorrow ? 'MAÑANA' : DIAS[d.getDay()].toUpperCase();
      const dateLabel = `${d.getDate()} ${MESES[d.getMonth()]}`;

      html += `<div style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;letter-spacing:2px;color:${isToday ? 'var(--cyan)' : 'var(--muted2)'};">${dayLabel}</span>
          <span style="font-size:12px;color:var(--muted);">${dateLabel}</span>
          <div style="flex:1;height:1px;background:var(--border);"></div>
        </div>`;

      daySlots.forEach(s => {
        const cls            = s.classes || {};
        const st             = _classBarStyle(cls);
        const dispTime       = _fmtHour(s.start_time);
        const instructorName = cls.instructor_id ? (instructorMap[cls.instructor_id] || '—') : '—';
        const spotsHtml      = s.spots_available > 0
          ? `<span style="color:var(--cyan);">${s.spots_available} cupos disponibles</span>`
          : '<span style="color:var(--red);">Sin cupos</span>';

        const routineBlock = s.routine_notes
          ? `<div style="margin-top:12px;padding:12px 14px;background:rgba(57,255,122,0.06);border:1px solid rgba(57,255,122,0.2);border-radius:8px;">
               <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:var(--green);margin-bottom:6px;">💪 RUTINA PUBLICADA</div>
               <div style="font-size:13px;color:var(--white);line-height:1.6;white-space:pre-wrap;">${_esc(s.routine_notes)}</div>
             </div>`
          : '';

        html += `<div class="card${st.card}" style="margin-bottom:10px;padding:16px 20px;">
          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
            <div style="width:4px;height:44px;background:${st.bar};border-radius:2px;box-shadow:0 0 8px ${st.bar}40;flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="font-family:'Outfit',sans-serif;font-weight:700;font-size:17px;letter-spacing:1.5px;color:${st.bar};">${_esc(cls.name || 'Clase')}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">${dispTime} · Instructor: <span style="color:var(--white);">${_esc(instructorName)}</span></div>
              <div style="font-size:12px;margin-top:2px;">${spotsHtml}</div>
            </div>
          </div>
          ${routineBlock}
        </div>`;
      });

      html += '</div>';
    }

    list.innerHTML = html;

  } catch (err) {
    console.error('loadUserClasesPage:', err);
    list.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--red);">Error al cargar clases. Intenta de nuevo.</div>';
  }
}

// ===================== INVENTARIO MODULE =====================

let inventarioData   = [];
let inventarioFilter = { categoria: 'todos', estado: 'todos', buscar: '' };
let invDetailItem    = null;
let invEditingId     = null;

const INV_CAT_LABELS = {
  cardio:           'CARDIO',
  fuerza_libre:     'FUERZA LIBRE',
  maquinas_guiadas: 'MÁQUINAS GUIADAS',
  accesorios:       'ACCESORIOS',
  electronicos:     'ELECTRÓNICOS',
  mobiliario:       'MOBILIARIO',
};

const INV_STATUS_BADGE = {
  bueno:         'badge-green',
  en_reparacion: 'badge-amber',
  dado_de_baja:  'badge-red',
};

const INV_STATUS_LABEL = {
  bueno:         'BUENO',
  en_reparacion: 'EN REPARACIÓN',
  dado_de_baja:  'DADO DE BAJA',
};

async function loadInventario() {
  const tbody = document.getElementById('inventario-tbody');
  if (tbody) {
    tbody.innerHTML = Array(5).fill(0).map(() =>
      `<tr>${Array(7).fill(0).map(() =>
        `<td><div class="skeleton" style="height:16px;border-radius:4px;"></div></td>`
      ).join('')}</tr>`
    ).join('');
  }
  const { data, error } = await db.from('inventory').select('*').order('name');
  if (error) { console.error('Inventario load error:', error); toast('Error al cargar inventario', error.message); }
  inventarioData = data || [];
  renderInventario();
}

function _invFiltered() {
  return inventarioData.filter(item => {
    if (inventarioFilter.categoria !== 'todos' && item.category !== inventarioFilter.categoria) return false;
    if (inventarioFilter.estado    !== 'todos' && item.status   !== inventarioFilter.estado)    return false;
    if (inventarioFilter.buscar && !item.name.toLowerCase().includes(inventarioFilter.buscar.toLowerCase())) return false;
    return true;
  });
}

function renderInventario() {
  const tbody = document.getElementById('inventario-tbody');
  if (!tbody) return;
  const items = _invFiltered();
  tbody.innerHTML = items.length ? items.map(item => {
    const updated = item.updated_at ? item.updated_at.split('T')[0] : '—';
    return `<tr>
      <td style="font-weight:500;font-size:13px;">${_esc(item.name)}</td>
      <td><span class="badge badge-muted">${INV_CAT_LABELS[item.category] || _esc(item.category) || '—'}</span></td>
      <td><span style="font-family:'Outfit';font-weight:700;font-size:17px;color:var(--cyan);">${item.quantity ?? '—'}</span> <span style="font-size:11px;color:var(--muted);">${_esc(item.unit || '')}</span></td>
      <td><span class="badge ${INV_STATUS_BADGE[item.status] || 'badge-muted'}">${INV_STATUS_LABEL[item.status] || _esc(item.status) || '—'}</span></td>
      <td style="font-size:12px;color:var(--muted2);">${_esc(item.location || '—')}</td>
      <td style="font-size:12px;color:var(--muted);">${updated}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="openDetalleItem('${item.id}')">Ver detalles</button></td>
    </tr>`;
  }).join('')
  : `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px 0;">Sin ítems que coincidan con los filtros</td></tr>`;
}

function filterInventario(tipo, valor) {
  inventarioFilter[tipo] = valor;
  renderInventario();
  if (tipo === 'categoria') document.querySelectorAll('.inv-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.val === valor));
  if (tipo === 'estado')    document.querySelectorAll('.inv-est-btn').forEach(b => b.classList.toggle('active', b.dataset.val === valor));
}

async function openDetalleItem(id) {
  const item = inventarioData.find(i => i.id === id);
  if (!item) return;
  invDetailItem = item;

  const fmt   = v => (v ? String(v).split('T')[0] : '—');
  const price = item.purchase_price_cop != null
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(item.purchase_price_cop)
    : '—';

  document.getElementById('detalle-item-content').innerHTML = `
    <div style="margin-bottom:18px;">
      ${item.image_url
        ? `<img src="${item.image_url}" alt="${_esc(item.name)}" style="width:100%;height:280px;object-fit:cover;border-radius:10px;border:1px solid rgba(0,207,255,0.25);box-shadow:0 0 20px rgba(0,207,255,0.1);">`
        : `<div style="width:100%;height:180px;background:#111;border-radius:10px;border:1px solid var(--border2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">
             <span style="font-size:40px;">🏋️</span>
             <span style="font-size:12px;color:var(--muted);">Sin imagen</span>
           </div>`}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      ${_idf('Nombre',          _esc(item.name))}
      ${_idf('Categoría',       INV_CAT_LABELS[item.category] || _esc(item.category) || '—')}
      ${_idf('Cantidad',        `${item.quantity ?? '—'} ${_esc(item.unit || '')}`)}
      ${_idf('Estado',          `<span class="badge ${INV_STATUS_BADGE[item.status] || 'badge-muted'}">${INV_STATUS_LABEL[item.status] || _esc(item.status) || '—'}</span>`, true)}
      ${_idf('Ubicación',       _esc(item.location || '—'))}
      ${_idf('Marca',           _esc(item.brand || '—'))}
      ${_idf('Modelo',          _esc(item.model || '—'))}
      ${_idf('Número de Serie', _esc(item.serial_number || '—'))}
      ${_idf('Fecha de Compra', fmt(item.purchase_date))}
      ${_idf('Precio de Compra', price)}
      ${_idf('Últ. Actualización', fmt(item.updated_at))}
      ${item.notes ? `<div style="grid-column:1/-1;">${_idf('Notas', _esc(item.notes))}</div>` : ''}
    </div>
    <div style="margin-top:24px;border-top:1px solid var(--border);padding-top:16px;">
      <div style="font-size:11px;letter-spacing:1px;color:var(--muted);margin-bottom:12px;">HISTORIAL DE MANTENIMIENTOS</div>
      <div id="inv-maint-list"><div style="color:var(--muted);font-size:12px;">Cargando...</div></div>
      <div style="margin-top:14px;background:rgba(0,207,255,0.04);border:1px solid rgba(0,207,255,0.15);border-radius:10px;padding:14px;">
        <div style="font-size:11px;letter-spacing:1px;color:var(--cyan);margin-bottom:10px;">REGISTRAR MANTENIMIENTO</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Fecha *</label>
            <input class="form-input" type="date" id="inv-maint-fecha" value="${_bogotaToday()}">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Realizado por</label>
            <input class="form-input" type="text" id="inv-maint-quien" placeholder="Nombre o empresa">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:10px;">
          <label class="form-label">Descripción del trabajo *</label>
          <textarea class="form-input" id="inv-maint-desc" rows="2" placeholder="Ej: Lubricación, revisión eléctrica, cambio de piezas..." style="resize:vertical;"></textarea>
        </div>
        <button class="btn btn-primary btn-sm" style="width:100%;" onclick="addMantenimiento('${item.id}')">Guardar mantenimiento</button>
      </div>
    </div>`;

  document.getElementById('detalle-item-title').textContent = item.name;
  const darBajaBtn = document.getElementById('detalle-dar-baja-btn');
  if (darBajaBtn) darBajaBtn.style.display = item.status === 'dado_de_baja' ? 'none' : '';
  openModal('detalle-item');
  loadMaintenanceHistory(item.id);
}

async function loadMaintenanceHistory(inventoryId) {
  const container = document.getElementById('inv-maint-list');
  if (!container) return;

  const { data, error } = await db
    .from('inventory_maintenance')
    .select('*')
    .eq('inventory_id', inventoryId)
    .order('maintenance_date', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="color:var(--red);font-size:12px;">Error al cargar el historial.</div>`;
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:4px 0;">Sin mantenimientos registrados.</div>`;
    return;
  }

  container.innerHTML = data.map(r => `
    <div style="border-left:2px solid rgba(0,207,255,0.3);padding:6px 0 6px 12px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:2px;">
        <span style="font-size:12px;font-weight:600;color:var(--cyan);">${_esc(r.maintenance_date)}</span>
        ${r.performed_by ? `<span style="font-size:11px;color:var(--muted2);">· ${_esc(r.performed_by)}</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text2);">${_esc(r.description)}</div>
    </div>
  `).join('');
}

async function addMantenimiento(inventoryId) {
  const fecha = document.getElementById('inv-maint-fecha')?.value;
  const desc  = (document.getElementById('inv-maint-desc')?.value  || '').trim();
  const quien = (document.getElementById('inv-maint-quien')?.value || '').trim() || null;

  if (!fecha) { toast('Campo requerido', 'Selecciona la fecha del mantenimiento'); return; }
  if (!desc)  { toast('Campo requerido', 'Ingresa la descripción del trabajo realizado'); return; }

  const { error } = await db.from('inventory_maintenance').insert({
    inventory_id:     inventoryId,
    maintenance_date: fecha,
    description:      desc,
    performed_by:     quien,
  });

  if (error) { toast('Error', error.message); return; }

  toast('Mantenimiento registrado', '');
  const descEl  = document.getElementById('inv-maint-desc');
  const quienEl = document.getElementById('inv-maint-quien');
  if (descEl)  descEl.value  = '';
  if (quienEl) quienEl.value = '';
  loadMaintenanceHistory(inventoryId);
}

function _idf(label, val, rawHtml = false) {
  return `<div>
    <div class="inv-detail-label">${label}</div>
    <div class="inv-detail-val">${rawHtml ? val : val}</div>
  </div>`;
}

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function darDeBajaFromDetalle() {
  if (!invDetailItem) return;
  const { error } = await db.from('inventory').update({ status: 'dado_de_baja' }).eq('id', invDetailItem.id);
  if (error) { toast('Error', error.message); return; }
  toast('Dado de baja', invDetailItem.name);
  closeModal('modal-detalle-item');
  await loadInventario();
}

function openNuevoItem() {
  invEditingId = null;
  document.getElementById('form-item-titulo').textContent = 'NUEVO ÍTEM';
  _clearItemForm();
  openModal('form-item');
}

function openEditarItemFromDetalle() {
  if (!invDetailItem) return;
  invEditingId = invDetailItem.id;
  document.getElementById('form-item-titulo').textContent = 'EDITAR ÍTEM';
  _populateItemForm(invDetailItem);
  closeModal('modal-detalle-item');
  openModal('form-item');
}

function _clearItemForm() {
  ['form-item-nombre','form-item-ubicacion','form-item-marca','form-item-modelo',
   'form-item-serie','form-item-precio','form-item-notas'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  _setVal('form-item-categoria',     'cardio');
  _setVal('form-item-estado',        'bueno');
  _setVal('form-item-cantidad',      '1');
  _setVal('form-item-unidad',        'unidades');
  _setVal('form-item-compra',        '');
  _setVal('form-item-current-image', '');
  const prev = document.getElementById('form-item-img-preview');
  if (prev) { prev.style.display = 'none'; prev.src = ''; }
  const img = document.getElementById('form-item-imagen');
  if (img) img.value = '';
}

function _populateItemForm(item) {
  _setVal('form-item-nombre',        item.name);
  _setVal('form-item-categoria',     item.category);
  _setVal('form-item-estado',        item.status);
  _setVal('form-item-cantidad',      item.quantity);
  _setVal('form-item-unidad',        item.unit);
  _setVal('form-item-ubicacion',     item.location);
  _setVal('form-item-marca',         item.brand);
  _setVal('form-item-modelo',        item.model);
  _setVal('form-item-serie',         item.serial_number);
  _setVal('form-item-compra',        item.purchase_date);
  _setVal('form-item-precio',        item.purchase_price_cop);
  _setVal('form-item-notas',         item.notes);
  _setVal('form-item-current-image', item.image_url || '');
  const prev = document.getElementById('form-item-img-preview');
  if (prev) {
    if (item.image_url) { prev.src = item.image_url; prev.style.display = 'block'; }
    else { prev.style.display = 'none'; prev.src = ''; }
  }
  const img = document.getElementById('form-item-imagen');
  if (img) img.value = '';
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}

function previewInvImage(input) {
  const file = input.files?.[0];
  const prev = document.getElementById('form-item-img-preview');
  if (!prev) return;
  if (file) {
    const reader = new FileReader();
    reader.onload = e => { prev.src = e.target.result; prev.style.display = 'block'; };
    reader.readAsDataURL(file);
  } else {
    prev.style.display = 'none'; prev.src = '';
  }
}

async function guardarItem() {
  const nombre = (document.getElementById('form-item-nombre').value || '').trim();
  if (!nombre) { toast('Campo requerido', 'Ingresa el nombre del ítem'); return; }

  const rawQty = document.getElementById('form-item-cantidad').value.trim();
  const qty    = rawQty === '' ? null : parseInt(rawQty);
  if (qty !== null && (isNaN(qty) || qty < 0)) { toast('Cantidad inválida', 'La cantidad debe ser un número ≥ 0'); return; }

  const btn = document.getElementById('form-item-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const file = document.getElementById('form-item-imagen')?.files?.[0];
  let image_url = document.getElementById('form-item-current-image').value || null;

  if (file) {
    const ext      = file.name.split('.').pop();
    const filename = `inventory/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await db.storage.from('inventory').upload(filename, file, { upsert: true });
    if (uploadError) {
      toast('Error al subir imagen', uploadError.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
      return;
    }
    const { data: pubData } = db.storage.from('inventory').getPublicUrl(filename);
    image_url = pubData?.publicUrl || null;
  }

  const payload = {
    name:           nombre,
    category:       (document.getElementById('form-item-categoria').value || '').trim() || null,
    status:         (document.getElementById('form-item-estado').value    || '').trim() || null,
    quantity:       qty,
    unit:           document.getElementById('form-item-unidad').value              || 'unidades',
    location:       (document.getElementById('form-item-ubicacion').value  || '').trim() || null,
    brand:          (document.getElementById('form-item-marca').value      || '').trim() || null,
    model:          (document.getElementById('form-item-modelo').value     || '').trim() || null,
    serial_number:  (document.getElementById('form-item-serie').value      || '').trim() || null,
    purchase_date:  document.getElementById('form-item-compra').value      || null,
    purchase_price_cop: Math.round(parseFloat(document.getElementById('form-item-precio').value)) || null,
    notes:          (document.getElementById('form-item-notas').value      || '').trim() || null,
    image_url,
  };

  let error;
  if (invEditingId) {
    ({ error } = await db.from('inventory').update(payload).eq('id', invEditingId));
  } else {
    ({ error } = await db.from('inventory').insert(payload));
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
  if (error) { toast('Error', error.message); return; }

  toast(invEditingId ? 'Ítem actualizado' : 'Ítem agregado', nombre);
  closeModal('modal-form-item');
  await loadInventario();
}

// ===================== PROVEEDORES MODULE =====================

let _proveedoresData  = [];
let _provSearch       = '';
let _provCatFilter    = '';
let _provEstadoFilter = 'activos'; // 'activos' | 'inactivos' | 'todos' — defaults to hiding inactive so they don't clutter the main list
// { proveedor_id: count } — how many invoices are on file per supplier (Fase 3.1). Best-
// effort: if proveedor_facturas doesn't exist yet (migration not run), this stays empty
// and the badge is simply omitted, same "degrade silently" pattern as loadLegalDocsPage's
// e2 handling.
let _provFacturasCounts   = {};
let _provFacturasAdeudado = {}; // { proveedor_id: totalAdeudado } — pending (non-pagado) invoices only
let _provFacturasVencidas = {}; // { proveedor_id: count } — pending invoices past fecha_vencimiento

async function loadProveedoresPage() {
  const tbody = document.getElementById('prov-tbody');
  if (!tbody) return;
  tbody.innerHTML = _loaderRow(6);

  try {
    const { data, error } = await db
      .from('proveedores')
      .select('*')
      .order('nombre');
    if (error) throw error;
    _proveedoresData = data || [];
    _provSearch       = '';
    _provCatFilter    = '';
    _provEstadoFilter = 'activos';
    const searchEl   = document.getElementById('prov-search');
    const catEl      = document.getElementById('prov-cat-filter');
    const estadoEl   = document.getElementById('prov-estado-filter');
    if (searchEl) searchEl.value = '';
    if (catEl)    catEl.value    = '';
    if (estadoEl) estadoEl.value = 'activos';

    _provFacturasCounts   = {};
    _provFacturasAdeudado = {};
    _provFacturasVencidas = {};
    try {
      const { data: facturas, error: facErr } = await db.from('proveedor_facturas').select('proveedor_id, estado, monto_total, monto_pagado, fecha_vencimiento');
      if (!facErr) {
        const todayStr = _bogotaToday();
        (facturas || []).forEach(f => {
          _provFacturasCounts[f.proveedor_id] = (_provFacturasCounts[f.proveedor_id] || 0) + 1;
          if (f.estado !== 'pagado' && f.monto_total != null) {
            const debe = Math.max(f.monto_total - (f.monto_pagado || 0), 0);
            _provFacturasAdeudado[f.proveedor_id] = (_provFacturasAdeudado[f.proveedor_id] || 0) + debe;
          }
          if (f.estado !== 'pagado' && f.fecha_vencimiento && f.fecha_vencimiento < todayStr) {
            _provFacturasVencidas[f.proveedor_id] = (_provFacturasVencidas[f.proveedor_id] || 0) + 1;
          }
        });
      }
    } catch (_) { /* migration not run yet — badge stays omitted */ }

    _renderProveedores();
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--red);">Error al cargar proveedores: ${_escHtml(err.message)}</td></tr>`;
  }
}

function _applyProvFiltros() {
  _provSearch       = (document.getElementById('prov-search')?.value        || '').trim().toLowerCase();
  _provCatFilter    = (document.getElementById('prov-cat-filter')?.value    || '').trim();
  _provEstadoFilter = (document.getElementById('prov-estado-filter')?.value || 'activos').trim();
  _renderProveedores();
}

function _renderProveedores() {
  const tbody = document.getElementById('prov-tbody');
  if (!tbody) return;

  // activo defaults to true when the column hasn't been migrated in yet (undefined) —
  // never treat an unmigrated DB as "everyone inactive".
  const _isActivo = p => p.activo !== false;

  const filtered = _proveedoresData.filter(p => {
    if (_provEstadoFilter === 'activos'   && !_isActivo(p)) return false;
    if (_provEstadoFilter === 'inactivos' &&  _isActivo(p)) return false;
    if (_provCatFilter && p.categoria !== _provCatFilter) return false;
    if (_provSearch) {
      const hay = `${p.nombre || ''} ${p.nit || ''}`.toLowerCase();
      if (!hay.includes(_provSearch)) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px 0;">${_proveedoresData.length ? 'Sin proveedores que coincidan con los filtros' : 'No hay proveedores registrados'}</td></tr>`;
    return;
  }

  const _catBadge = cat => {
    const cls = { Equipamiento:'badge-cyan', Suplementos:'badge-green', Servicios:'badge-purple', Uniformes:'badge-orange', Otro:'badge-muted' };
    return cat ? `<span class="badge ${cls[cat] || 'badge-muted'}">${_escHtml(cat)}</span>` : '—';
  };

  tbody.innerHTML = filtered.map(p => {
    const facCount   = _provFacturasCounts[p.id] || 0;
    const adeudado   = _provFacturasAdeudado[p.id] || 0;
    const facBadge   = facCount > 0
      ? `<span class="badge badge-muted" title="${facCount} factura${facCount === 1 ? '' : 's'} en archivo" style="margin-left:6px;">📎 ${facCount}</span>`
      : '';
    const debeBadge  = adeudado > 0
      ? `<span class="badge badge-orange" title="Total pendiente por pagar" style="margin-left:6px;">💰 ${_fmtCOP(adeudado)}</span>`
      : '';
    const vencidas   = _provFacturasVencidas[p.id] || 0;
    const vencidasBadge = vencidas > 0
      ? `<span class="badge badge-red" title="${vencidas} factura${vencidas === 1 ? '' : 's'} vencida${vencidas === 1 ? '' : 's'}" style="margin-left:6px;">⚠ ${vencidas} vencida${vencidas === 1 ? '' : 's'}</span>`
      : '';
    return `
    <tr${_isActivo(p) ? '' : ' style="opacity:.55;"'}>
      <td style="font-weight:600;font-size:13px;">${_escHtml(p.nombre)}${_isActivo(p) ? '' : ' <span class="badge badge-muted" style="margin-left:6px;">Inactivo</span>'}${facBadge}${debeBadge}${vencidasBadge}</td>
      <td style="color:var(--muted);font-size:12px;">${_escHtml(p.nit || '—')}</td>
      <td>${_catBadge(p.categoria)}</td>
      <td style="font-size:13px;">${_escHtml(p.contacto_nombre || '—')}</td>
      <td style="font-size:13px;color:var(--muted);">${_escHtml(p.contacto_telefono || '—')}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="openProveedorForm('${p.id}')">✎ Editar</button>
          ${_isActivo(p)
            ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="toggleProveedorActivo('${p.id}', false)">Desactivar</button>`
            : `<button class="btn btn-ghost btn-sm" style="color:var(--green);" onclick="toggleProveedorActivo('${p.id}', true)">Reactivar</button>`}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openProveedorForm(id) {
  const p = id ? _proveedoresData.find(x => x.id === id) : null;

  document.getElementById('prov-form-titulo').textContent        = p ? 'EDITAR PROVEEDOR' : 'NUEVO PROVEEDOR';
  document.getElementById('prov-form-id').value                  = p?.id                 || '';
  document.getElementById('prov-nombre').value                   = p?.nombre             || '';
  document.getElementById('prov-nit').value                      = p?.nit                || '';
  document.getElementById('prov-categoria').value                = p?.categoria          || '';
  document.getElementById('prov-contacto-nombre').value          = p?.contacto_nombre    || '';
  document.getElementById('prov-contacto-telefono').value        = p?.contacto_telefono  || '';
  document.getElementById('prov-contacto-email').value           = p?.contacto_email     || '';
  document.getElementById('prov-direccion').value                = p?.direccion          || '';
  document.getElementById('prov-notas').value                    = p?.notas              || '';

  // Facturas (Fase 3.1) — only meaningful once the supplier row exists (files are FK'd
  // to proveedor_id), so hidden entirely on "nuevo proveedor".
  const facSection = document.getElementById('prov-facturas-section');
  if (facSection) {
    if (p) {
      facSection.style.display = '';
      _provFacturasProveedorId = p.id;
      loadProveedorFacturas(p.id);
    } else {
      facSection.style.display = 'none';
      _provFacturasProveedorId = null;
      _provFacturasData = [];
    }
  }

  openModal('proveedor-form');
  setTimeout(() => document.getElementById('prov-nombre')?.focus(), 80);
}

async function saveProveedor() {
  const id      = (document.getElementById('prov-form-id')?.value             || '').trim() || null;
  const nombre  = (document.getElementById('prov-nombre')?.value              || '').trim();
  const nit     = (document.getElementById('prov-nit')?.value                 || '').trim() || null;
  const cat     = (document.getElementById('prov-categoria')?.value           || '').trim() || null;
  const cNombre = (document.getElementById('prov-contacto-nombre')?.value     || '').trim() || null;
  const cTel    = (document.getElementById('prov-contacto-telefono')?.value   || '').trim() || null;
  const cEmail  = (document.getElementById('prov-contacto-email')?.value      || '').trim().toLowerCase() || null;
  const dir     = (document.getElementById('prov-direccion')?.value           || '').trim() || null;
  const notas   = (document.getElementById('prov-notas')?.value               || '').trim() || null;

  if (!nombre) { toast('Campo requerido', 'Ingresa el nombre del proveedor'); return; }

  const btn = document.querySelector('#modal-proveedor-form .btn-primary');
  if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }

  try {
    // Conditional payload — only include fields with values to avoid null-overwriting
    const payload = { nombre };
    if (nit     !== null) payload.nit               = nit;
    if (cat     !== null) payload.categoria         = cat;
    if (cNombre !== null) payload.contacto_nombre   = cNombre;
    if (cTel    !== null) payload.contacto_telefono = cTel;
    if (cEmail  !== null) payload.contacto_email    = cEmail;
    if (dir     !== null) payload.direccion         = dir;
    if (notas   !== null) payload.notas             = notas;

    if (id) {
      payload.updated_at = new Date().toISOString();
      const { error } = await db.from('proveedores').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await db.from('proveedores').insert(payload);
      if (error) throw error;
    }

    toast(id ? 'Proveedor actualizado' : 'Proveedor agregado', nombre);
    closeModal('modal-proveedor-form');
    await loadProveedoresPage();
  } catch (err) {
    toast('Error al guardar', err.message || 'Intenta de nuevo');
  } finally {
    if (btn) { btn.textContent = 'Guardar'; btn.disabled = false; }
  }
}

async function toggleProveedorActivo(id, activo) {
  const p = _proveedoresData.find(x => x.id === id);
  const nombre = p?.nombre || 'este proveedor';
  const msg = activo
    ? `¿Reactivar a "${nombre}"?`
    : `¿Desactivar a "${nombre}"? Se conserva en la base de datos (historial de proveedores), solo deja de aparecer en el listado principal.`;
  if (!confirm(msg)) return;
  try {
    const { error } = await db.from('proveedores').update({ activo }).eq('id', id);
    if (error) throw error;
    toast(activo ? 'Proveedor reactivado' : 'Proveedor desactivado', nombre);
    await loadProveedoresPage();
  } catch (err) {
    toast('Error al actualizar', err.message || 'Intenta de nuevo');
  }
}

// ── Facturas de proveedor (Fase 3.1, 2026-08-20) ─────────────────────────────────────
// One row per uploaded invoice file, FK'd to a proveedor. Mirrors the Bóveda Legal file
// pattern (legal_document_files / uploadLegalDoc / deleteLegalDocFile, ~line 13153-13237):
// private storage bucket ('proveedor-facturas'), file_url is a storage PATH (not a public
// URL), opened on demand via a signed URL. Only usable once a supplier row exists — see
// openProveedorForm() above, which hides this section entirely for "nuevo proveedor".
let _provFacturasData         = [];
let _provFacturasProveedorId  = null;

async function loadProveedorFacturas(proveedorId) {
  const list = document.getElementById('prov-facturas-list');
  if (!list) return;
  list.innerHTML = '<div style="font-size:12px;color:var(--muted);">Cargando…</div>';
  try {
    const { data, error } = await db
      .from('proveedor_facturas')
      .select('*')
      .eq('proveedor_id', proveedorId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    _provFacturasData = data || [];
    _renderProveedorFacturas();
  } catch (err) {
    list.innerHTML = `<div style="font-size:12px;color:var(--red);">Error al cargar facturas: ${_escHtml(err.message || '')}</div>`;
  }
}

function _fmtCOP(n) {
  return n == null ? null : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function _renderProveedorFacturas() {
  const list = document.getElementById('prov-facturas-list');
  if (!list) return;
  if (!_provFacturasData.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Sin facturas cargadas.</div>';
    return;
  }
  const todayStr = _bogotaToday();

  list.innerHTML = _provFacturasData.map(f => {
    const dateStr   = new Date(f.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const estado    = f.estado || 'pendiente';
    const total     = f.monto_total;
    const pagado    = f.monto_pagado || 0;
    const adeudado  = total != null ? Math.max(total - pagado, 0) : null;
    const estadoBadge = estado === 'pagado'
      ? `<span class="badge badge-green">Pagado</span>`
      : `<span class="badge badge-orange">Pendiente</span>`;
    const adeudadoStr = adeudado != null
      ? (adeudado > 0 ? `<span style="color:var(--red);font-weight:600;">Debe ${_fmtCOP(adeudado)}</span>` : `<span style="color:var(--green);">Sin saldo</span>`)
      : `<span style="color:var(--muted);">Monto no registrado</span>`;

    // Vencimiento badge — only meaningful for invoices still pending; once pagada, the due
    // date is no longer actionable so no vencida/próxima warning is shown for it.
    let vencimientoBadge = '';
    if (estado !== 'pagado' && f.fecha_vencimiento) {
      const diffDays = Math.round((new Date(f.fecha_vencimiento + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
      if (diffDays < 0) vencimientoBadge = `<span class="badge badge-red" title="Venció hace ${-diffDays} día(s)">⚠ Vencida</span>`;
      else if (diffDays <= 7) vencimientoBadge = `<span class="badge badge-orange" title="Vence en ${diffDays} día(s)">⏰ Próxima a vencer</span>`;
    }

    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
        <span style="font-size:12px;color:var(--green);">✓ ${_escHtml(f.file_name)} · ${dateStr}</span>
        <button class="btn btn-ghost btn-sm" type="button" onclick="viewProveedorFactura('${f.id}')">Ver</button>
        <button class="btn btn-ghost btn-sm" type="button" style="color:var(--red);" onclick="deleteProveedorFactura('${f.id}')">Eliminar</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;">
        ${estadoBadge}
        ${vencimientoBadge}
        <label style="color:var(--muted);">Total
          <input type="number" min="0" step="0.01" value="${total != null ? total : ''}" placeholder="—"
            style="width:100px;height:26px;font-size:12px;margin-left:4px;" id="fac-total-${f.id}">
        </label>
        <label style="color:var(--muted);">Abonado
          <input type="number" min="0" step="0.01" value="${pagado}"
            style="width:90px;height:26px;font-size:12px;margin-left:4px;" id="fac-pagado-${f.id}">
        </label>
        <select id="fac-estado-${f.id}" class="form-input" style="width:110px;height:26px;font-size:12px;padding:2px 8px;">
          <option value="pendiente" ${estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
          <option value="pagado" ${estado === 'pagado' ? 'selected' : ''}>Pagado</option>
        </select>
        <label style="color:var(--muted);">Vence
          <input type="date" value="${f.fecha_vencimiento || ''}"
            style="height:26px;font-size:12px;margin-left:4px;" id="fac-vence-${f.id}">
        </label>
        <label style="color:var(--muted);">Pagada el
          <input type="date" value="${f.fecha_pago || ''}"
            style="height:26px;font-size:12px;margin-left:4px;" id="fac-fecha-pago-${f.id}">
        </label>
        <button class="btn btn-ghost btn-sm" type="button" onclick="guardarEstadoFactura('${f.id}')">Guardar</button>
        <span>${adeudadoStr}</span>
      </div>
    </div>`;
  }).join('');
}

async function guardarEstadoFactura(fileId) {
  const totalEl  = document.getElementById(`fac-total-${fileId}`);
  const pagadoEl = document.getElementById(`fac-pagado-${fileId}`);
  const estadoEl = document.getElementById(`fac-estado-${fileId}`);
  const venceEl  = document.getElementById(`fac-vence-${fileId}`);
  const fPagoEl  = document.getElementById(`fac-fecha-pago-${fileId}`);
  if (!totalEl || !pagadoEl || !estadoEl) return;

  const monto_total  = totalEl.value  === '' ? null : Number(totalEl.value);
  const monto_pagado = pagadoEl.value === '' ? 0    : Number(pagadoEl.value);
  const estado       = estadoEl.value;
  const fecha_vencimiento = venceEl?.value || null;
  // If the admin marks an invoice paid without picking a payment date, default it to today
  // rather than leaving it blank — matches how `estado` itself is a one-click action.
  const fecha_pago = fPagoEl?.value || (estado === 'pagado' ? _bogotaToday() : null);

  if (monto_total != null && monto_pagado > monto_total) {
    toast('Monto inválido', 'Lo abonado no puede superar el total de la factura');
    return;
  }

  const { error } = await db
    .from('proveedor_facturas')
    .update({ monto_total, monto_pagado, estado, fecha_vencimiento, fecha_pago })
    .eq('id', fileId);
  if (error) { toast('Error al guardar', error.message); return; }

  toast('Factura actualizada', '');
  const f = _provFacturasData.find(x => x.id === fileId);
  if (f) { await loadProveedorFacturas(f.proveedor_id); await loadProveedoresPage(); }
}

function uploadProveedorFactura() {
  if (!_provFacturasProveedorId) return;
  const proveedorId = _provFacturasProveedorId;

  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.pdf,.jpg,.jpeg,.png,.webp';
  input.multiple = true;

  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const btn = document.querySelector('#prov-facturas-section .btn-ghost[onclick="uploadProveedorFactura()"]');
    if (btn) { btn.textContent = 'Subiendo…'; btn.disabled = true; }

    try {
      for (const file of files) {
        // Reuses the generic filename sanitizer already used by the legal-docs uploader —
        // its logic (strip accents/special chars, keep the extension) is domain-agnostic.
        const safeName = _sanitizeLegalFileName(file.name);
        const path = `${proveedorId}/${Date.now()}_${safeName}`;

        const { error: storageError } = await db.storage
          .from('proveedor-facturas')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (storageError) throw storageError;

        const { error: dbError } = await db.from('proveedor_facturas').insert({
          proveedor_id: proveedorId,
          file_url:     path,
          file_name:    file.name,
          uploaded_at:  new Date().toISOString(),
          uploaded_by:  currentUser?.id || null,
        });
        if (dbError) throw dbError;
      }

      toast('Factura subida', files.length > 1 ? `${files.length} archivos subidos` : files[0].name);
      await loadProveedorFacturas(proveedorId);
      await loadProveedoresPage();
    } catch (err) {
      toast('Error al subir', err.message || 'Intenta de nuevo');
    } finally {
      if (btn) { btn.textContent = '+ Subir factura'; btn.disabled = false; }
    }
  };

  input.click();
}

async function viewProveedorFactura(fileId) {
  const f = _provFacturasData.find(x => x.id === fileId);
  if (!f) return;
  try {
    const { data, error } = await db.storage
      .from('proveedor-facturas')
      .createSignedUrl(f.file_url, 3600);
    if (error) throw error;
    window.open(data.signedUrl, '_blank');
  } catch (err) {
    toast('Error al abrir', err.message || 'No se pudo generar el enlace');
  }
}

async function deleteProveedorFactura(fileId) {
  const f = _provFacturasData.find(x => x.id === fileId);
  if (!f) return;
  if (!confirm(`¿Eliminar la factura "${f.file_name}"?`)) return;

  await db.storage.from('proveedor-facturas').remove([f.file_url]).catch(() => {});

  const { error } = await db.from('proveedor_facturas').delete().eq('id', fileId);
  if (error) { toast('Error', error.message); return; }

  toast('Factura eliminada', '');
  await loadProveedorFacturas(f.proveedor_id);
  await loadProveedoresPage();
}

// ===================== SUPABASE DATA LAYER =====================

async function getMembership(userId) {
  // Ordered + limit(1) + maybeSingle() instead of .eq('status','active').single(): a user
  // can legitimately end up with more than one row (renewal history, nothing demotes an
  // old row's status), and .single() throws on both 0 and 2+ matches — silently returning
  // null and making a paid, current membership look "deleted" everywhere this is used
  // (self-service Pagos page, Wompi renewal CTA). See _pickCurrentMembership() for the
  // same rule applied to already-fetched membership arrays.
  const { data } = await db
    .from('memberships')
    .select('*, plans(*)')
    .eq('user_id', userId)
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function _getMonday(weekOffset = 0) {
  // Anchor to the Bogotá calendar date (via parseLocalDate/_bogotaToday), not the browser's
  // own clock/timezone — a device not set to America/Bogota (or right at a midnight
  // boundary) used to compute a different "this week" than the server-side pg_cron
  // generator (which is explicitly Bogotá-anchored), so two writers disagreed on which
  // dates belonged to "this week" and classes appeared to repeat "randomly" across weeks.
  const d = parseLocalDate(_bogotaToday());
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
  const mon = new Date(d);
  mon.setDate(diff);
  const pad = n => String(n).padStart(2, '0');
  return `${mon.getFullYear()}-${pad(mon.getMonth() + 1)}-${pad(mon.getDate())}`;
}

function _getSunday(weekOffset = 0) {
  const [y, m, d] = _getMonday(weekOffset).split('-').map(Number);
  const sun = new Date(y, m - 1, d + 6);
  const pad = n => String(n).padStart(2, '0');
  return `${sun.getFullYear()}-${pad(sun.getMonth() + 1)}-${pad(sun.getDate())}`;
}

async function getWeekBookings(userId) {
  const { data } = await db
    .from('bookings')
    .select('*, schedule(*, classes(*))')
    .eq('user_id', userId)
    .gte('schedule.class_date', _getMonday())
    .lte('schedule.class_date', _getSunday());
  return data || [];
}

async function getUpcomingSchedule() {
  const today = _bogotaToday();
  const { data } = await db
    .from('schedule')
    .select('*, classes(*)')
    .gte('class_date', today)
    .eq('is_cancelled', false)
    .gt('spots_available', 0)
    .order('class_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(10);
  return data || [];
}

async function getBodyProgress(userId) {
  const { data } = await db
    .from('body_progress')
    .select('*')
    .eq('user_id', userId)
    .order('measured_at', { ascending: true });
  return data || [];
}

function calculateStreak(attendances) {
  if (!attendances?.length) return 0;
  const bogotaOffset = 5 * 3600 * 1000;
  const dates = [...new Set(
    attendances.map(a => new Date(new Date(a.checked_in_at).getTime() - bogotaOffset).toISOString().split('T')[0])
  )].sort().reverse();
  let streak = 0;
  let expected = parseLocalDate(_bogotaToday());
  for (const dateStr of dates) {
    const d = parseLocalDate(dateStr);
    const diff = Math.round((expected - d) / 86400000);
    if (diff > 1) break;
    streak++;
    expected = d;
    expected.setDate(expected.getDate() - 1);
  }
  return streak;
}

async function getStreak(userId) {
  const { data } = await db
    .from('attendance')
    .select('checked_in_at')
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(60);
  return calculateStreak(data);
}

async function getAdminStats() {
  const [users, activeMemberships, todayAttendance, pendingPayments] = await Promise.all([
    db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'user'),
    db.from('memberships').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('attendance').select('id', { count: 'exact', head: true })
      .gte('checked_in_at', _bogotaToday()),
    db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  ]);
  return {
    totalUsers:         users.count        ?? 0,
    activeMemberships:  activeMemberships.count ?? 0,
    todayAttendance:    todayAttendance.count   ?? 0,
    pendingPayments:    pendingPayments.count   ?? 0
  };
}

async function getAllUsers() {
  const { data } = await db
    .from('users')
    .select('*, memberships!user_id(*, plans(*))')
    .eq('role', 'user')
    .order('created_at', { ascending: false });
  return data || [];
}

// F3: state for "book on behalf" modal
let _reservaSlotId         = null;
let _reservaSpotsAvailable = 0;
let _reservaSelectedUser   = null;

async function bookClass(userId, scheduleId, bookedByStaff = null) {
  const row = { user_id: userId, schedule_id: scheduleId };
  if (bookedByStaff) row.booked_by_staff = bookedByStaff;
  const { error: bookingError } = await db
    .from('bookings')
    .insert(row);
  if (bookingError) throw bookingError;
  const { data: slot } = await db
    .from('schedule')
    .select('spots_available')
    .eq('id', scheduleId)
    .single();
  if (slot) {
    await db.from('schedule')
      .update({ spots_available: slot.spots_available - 1 })
      .eq('id', scheduleId);
  }
}

// Fase 4.5: if fewer than 2h remain before the class starts, cancelling still frees the spot
// (so another member can take it) but warns the caller that the class will be charged
// against the member's allowance anyway. This function does NOT write any "counts / doesn't
// count" flag — that's derived later, purely from this row's cancelled_at timestamp vs. the
// class's start time, by seal_past_class_occurrences() when it seals the occurrence (see
// supabase/migrations/20260820_class_allowance_tracking.sql). Single source of truth for the
// charge decision, instead of this function and the nightly sweep having to agree on a flag.
// opts.skipLateConfirm lets a caller that already showed its own late-cancel warning skip
// this one's confirm() dialog.
// Returns { cancelled: boolean } — false only when the caller declined the late-cancel warning.
async function cancelBooking(bookingId, opts = {}) {
  const { data: booking } = await db
    .from('bookings')
    .select('schedule_id, schedule(class_date, start_time)')
    .eq('id', bookingId)
    .single();

  const sched = booking?.schedule;
  if (sched && _isLateCancellation(sched.class_date, sched.start_time) && !opts.skipLateConfirm) {
    const proceed = confirm(
      'Faltan menos de 2 horas para esta clase. Si cancelas ahora, la clase se descontará igual de la membresía/tiquetera, como si se hubiera tomado. ¿Deseas continuar de todos modos?'
    );
    if (!proceed) return { cancelled: false };
  }

  await db.from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (booking) {
    const { data: slot } = await db
      .from('schedule')
      .select('spots_available')
      .eq('id', booking.schedule_id)
      .single();
    if (slot) {
      await db.from('schedule')
        .update({ spots_available: slot.spots_available + 1 })
        .eq('id', booking.schedule_id);
    }
  }
  return { cancelled: true };
}

// ── F3: Book on behalf of user ────────────────────────────────────────────────

function abrirReservarPorUsuario(scheduleId, spotsAvailable) {
  _reservaSlotId         = scheduleId;
  _reservaSpotsAvailable = spotsAvailable;
  _reservaSelectedUser   = null;
  const searchEl   = document.getElementById('reserva-search');
  const resultsEl  = document.getElementById('reserva-resultados');
  const selEl      = document.getElementById('reserva-seleccionado');
  const confirmBtn = document.getElementById('btn-confirmar-reserva');
  if (searchEl)   searchEl.value     = '';
  if (resultsEl)  resultsEl.innerHTML = '';
  if (selEl)      selEl.style.display = 'none';
  if (confirmBtn) confirmBtn.disabled = true;
  openModal('reservar-por-usuario');
}

async function buscarMiembroReserva() {
  const q         = (document.getElementById('reserva-search')?.value || '').trim();
  const container = document.getElementById('reserva-resultados');
  if (!container) return;
  container.innerHTML = '';
  if (!q) return;
  container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0;">Buscando...</div>';

  const { data, error } = await db
    .from('users')
    .select('id, full_name, identification, memberships!user_id(status, end_date, plans(name))')
    .eq('role', 'user')
    .or(_memberSearchOrFilter(q))
    .limit(10);

  container.innerHTML = '';
  if (error || !data?.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0;">Sin resultados.</div>';
    return;
  }
  data.map(_userToCheckinMember).forEach(m => {
    const card = document.createElement('div');
    card.className = 'member-result-card';
    card.innerHTML = `
      <div style="width:32px;height:32px;font-size:12px;background:${ciColorBg[m.color]};color:${ciColorFg[m.color]};font-family:'Outfit',sans-serif;font-weight:700;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${m.avatar}</div>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:13px;">${m.nombre}</div>
        <div style="font-size:11px;color:var(--muted);">${m.plan}</div>
      </div>
      <span class="badge ${_statusBadgeClass(m.estado)}">${m.estado}</span>`;
    card.onclick = () => {
      _reservaSelectedUser = m;
      document.querySelectorAll('#reserva-resultados .member-result-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const selEl = document.getElementById('reserva-seleccionado');
      if (selEl) {
        selEl.style.display = 'block';
        selEl.textContent   = `Seleccionado: ${m.nombre}`;
      }
      const confirmBtn = document.getElementById('btn-confirmar-reserva');
      if (confirmBtn) confirmBtn.disabled = false;
    };
    container.appendChild(card);
  });
}

async function confirmarReservaStaff() {
  if (!_reservaSelectedUser || !_reservaSlotId) return;

  // Capacity check — re-fetch spots_available to guard against race conditions
  const { data: slot } = await db
    .from('schedule')
    .select('spots_available')
    .eq('id', _reservaSlotId)
    .single();

  if (!slot || slot.spots_available <= 0) {
    toast('Sin cupo', 'Esta clase ya no tiene lugares disponibles');
    closeModal('modal-reservar-por-usuario');
    await loadAdminHorariosPage();
    return;
  }

  const confirmBtn = document.getElementById('btn-confirmar-reserva');
  if (confirmBtn) { confirmBtn.textContent = 'Reservando…'; confirmBtn.disabled = true; }

  try {
    // Reuse bookClass — passes booked_by_staff for audit trail
    await bookClass(_reservaSelectedUser.id, _reservaSlotId, currentUser.id);
    toast('Reserva registrada', `${_reservaSelectedUser.nombre} inscrito en la clase`);
    closeModal('modal-reservar-por-usuario');
    await loadAdminHorariosPage(); // refresh grid + attendee list immediately
  } catch (err) {
    toast('Error al reservar', err.message || 'Intenta de nuevo');
  } finally {
    if (confirmBtn) { confirmBtn.textContent = 'Confirmar reserva'; confirmBtn.disabled = false; }
  }
}

// ---- Dashboard loaders ----

function _showDashboardError(msg) {
  toast('Error al cargar', msg);
}

function _dbSetKpi(valId, val, colorClass, chgId, chgText, chgClass) {
  const el = document.getElementById(valId);
  if (el) {
    el.textContent = val;
    el.className   = colorClass ? `db-kpi-val ${colorClass}` : (el.className || 'db-kpi-val');
  }
  const chgEl = document.getElementById(chgId);
  if (chgEl) {
    chgEl.textContent = chgText || '';
    chgEl.className   = `db-kpi-chg ${chgClass || 'neutral'}`;
  }
}

// ── Period filter state ────────────────────────────────────
let _dashPeriod     = 'month';
let _dashCustomFrom = null;
let _dashCustomTo   = null;

// True only under the dashboard's own mobile breakpoint (2026-07-14 mobile pass) — matches
// the "@media (max-width: 480px)" block in thor-training.css that hides #db-custom-date-row
// by default. Guards the JS-driven show/hide below so desktop's "always visible" date row
// behavior is never touched by this — only mobile ever gets its display toggled by JS.
function _isDashMobileLayout() {
  return window.matchMedia('(max-width: 480px)').matches;
}

function setDashPeriod(btn, period) {
  _dashPeriod     = period;
  _dashCustomFrom = null;
  _dashCustomTo   = null;
  document.querySelectorAll('.db-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Selecting a regular period chip collapses the custom date row again on mobile — desktop
  // date inputs are untouched (this only runs the hide when the mobile query matches).
  if (_isDashMobileLayout()) {
    const row = document.getElementById('db-custom-date-row');
    if (row) row.style.display = 'none';
  }
  loadAdminDashboard();
}

// Mobile-only "Personalizado" chip (2026-07-14 mobile pass) — reveals the custom date row
// (hidden by default under the dashboard's mobile breakpoint) and marks itself active,
// mirroring setDashPeriod()'s active-state handling. Unreachable on desktop since the chip
// itself is hidden there via CSS — the date row simply stays visible as it always has.
function toggleDashPersonalizado(btn) {
  document.querySelectorAll('.db-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const row = document.getElementById('db-custom-date-row');
  if (row) row.style.display = 'flex';
}

function setDashPeriodCustom() {
  const from = document.getElementById('db-date-from')?.value;
  const to   = document.getElementById('db-date-to')?.value;
  if (!from || !to || from > to) return;
  _dashPeriod     = 'custom';
  _dashCustomFrom = from;
  _dashCustomTo   = to;
  document.querySelectorAll('.db-filter-btn').forEach(b => b.classList.remove('active'));
  // Re-affirm Personalizado as the active-looking chip once real dates are picked (mirrors
  // the other chips' own active-on-select behavior) — harmless on desktop, where this chip
  // is hidden and simply never seen.
  document.getElementById('db-filter-personalizado')?.classList.add('active');
  loadAdminDashboard();
}

function _getDashDateRange() {
  const now   = new Date();
  const today = _bogotaToday();
  const y     = now.getFullYear();
  const m     = now.getMonth() + 1;
  const pad   = n => String(n).padStart(2, '0');
  const _ld   = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (_dashPeriod === 'custom' && _dashCustomFrom && _dashCustomTo) {
    return { from: _dashCustomFrom, to: _dashCustomTo, label: 'período' };
  }
  if (_dashPeriod === 'month') {
    return {
      from:  `${y}-${pad(m)}-01`,
      to:    `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`,
      label: 'este mes'
    };
  }
  if (_dashPeriod === '3m') {
    const d = new Date(now); d.setMonth(d.getMonth() - 3);
    return { from: _ld(d), to: today, label: '3 meses' };
  }
  if (_dashPeriod === '6m') {
    const d = new Date(now); d.setMonth(d.getMonth() - 6);
    return { from: _ld(d), to: today, label: '6 meses' };
  }
  if (_dashPeriod === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: 'este año' };
  }
  return {
    from:  `${y}-${pad(m)}-01`,
    to:    `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`,
    label: 'este mes'
  };
}

// Stores last loaded data for CSV export
let _lastDashData = {};

// ── Birthday widget ────────────────────────────────────────────

async function loadBirthdayWidget() {
  const container = document.getElementById('db-birthday-widget');
  if (!container) return;

  try {
    const { data: users } = await db
      .from('users')
      .select('id, full_name, birth_date, role, avatar_url')
      .not('birth_date', 'is', null)
      .eq('is_active', true);

    const today  = new Date();
    const todayM = today.getMonth() + 1;
    const todayD = today.getDate();
    const todayY = today.getFullYear();

    const birthdaysToday = (users || []).reduce((acc, u) => {
      const bd = parseLocalDate(u.birth_date);
      if (!bd) return acc;
      if (bd.getMonth() + 1 === todayM && bd.getDate() === todayD) {
        acc.push({ name: u.full_name, age: todayY - bd.getFullYear(), role: u.role, avatarUrl: u.avatar_url });
      }
      return acc;
    }, []);

    if (!birthdaysToday.length) {
      container.style.display = 'none';
      return;
    }

    const roleLabel = { user: 'Usuario', instructor: 'Instructor', employee: 'Empleado', admin: 'Admin' };

    // Static sizing/layout moved into .db-birthday-* classes (thor-training.css) so the
    // dashboard's mobile media query can compress this widget without touching the per-user
    // dynamic values (background/color), which stay inline (2026-07-14 mobile pass). Visual
    // result and the accent border-left treatment are unchanged on desktop.
    const items = birthdaysToday.map(u => {
      const initials = (u.name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const colorKey = ciColorKeys[(u.name || '?').charCodeAt(0) % ciColorKeys.length];
      const avatarEl = u.avatarUrl
        ? `<img src="${u.avatarUrl}" alt="${initials}" class="db-birthday-avatar">`
        : `<div class="db-birthday-avatar" style="background:${ciColorBg[colorKey]};color:${ciColorFg[colorKey]};">${initials}</div>`;
      return `
        <div class="db-birthday-item" style="display:flex;align-items:center;gap:10px;min-width:180px;flex:1;">
          ${avatarEl}
          <div>
            <div class="db-birthday-name-line">${u.name}<span class="db-birthday-age-inline"> · ${u.age} años</span></div>
            <div class="db-birthday-meta-line">${roleLabel[u.role] || u.role} · ${u.age} años</div>
          </div>
        </div>`;
    }).join('');

    container.style.display = '';
    container.innerHTML = `
      <div class="card db-birthday-card" style="border-left:3px solid var(--cyan);">
        <div class="card-title" style="margin-bottom:12px;">🎂 Cumpleaños hoy</div>
        <div class="db-birthday-list" style="display:flex;flex-wrap:wrap;gap:14px;">${items}</div>
      </div>`;
  } catch (_) {
    container.style.display = 'none';
  }
}

let _dashExpiringList = []; // {id, name, phone}[] — populated by loadAdminDashboard(), consumed by adminNotifyAllExpiring()

async function loadAdminDashboard() {
  const dateEl = document.getElementById('admin-dashboard-date');
  if (dateEl) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
    }).toUpperCase();
    dateEl.textContent = `${dateStr} · VISTA ADMINISTRADOR`;
  }

  // Shorter mobile-only format (2026-07-14 mobile pass) — e.g. "Mar 14 jul · Administrador".
  // Same `now`/locale as above, just a shorter string for #admin-dashboard-date-mobile
  // (hidden on desktop via CSS — see the dashboard mobile media query).
  const dateMobileEl = document.getElementById('admin-dashboard-date-mobile');
  if (dateMobileEl) {
    const now2   = new Date();
    const cap    = s => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/\.$/, '') : '';
    const wd     = cap(now2.toLocaleDateString('es-CO', { weekday: 'short' }));
    const mon    = now2.toLocaleDateString('es-CO', { month: 'short' }).replace(/\.$/, '');
    dateMobileEl.textContent = `${wd} ${now2.getDate()} ${mon} · Administrador`;
  }

  const { from: rangeFrom, to: rangeTo, label: rangeLabel } = _getDashDateRange();
  const now        = new Date();
  const bogotaMs   = Date.now() - 5 * 3600 * 1000;
  const today      = _bogotaToday();
  const pad        = n => String(n).padStart(2, '0');
  const in7days    = new Date(bogotaMs + 7  * 86400000).toISOString().split('T')[0];
  // Desertor threshold: end_date < ago7Days  (same as users page)
  const ago7Days   = new Date(bogotaMs - 7  * 86400000).toISOString().split('T')[0];
  const MESES      = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Previous period (same duration) for delta comparisons
  const rFromMs  = new Date(rangeFrom + 'T00:00:00').getTime();
  const rToMs    = new Date(rangeTo   + 'T23:59:59').getTime();
  const rangeLen = rToMs - rFromMs;
  const prevTo   = new Date(rFromMs - 86400000).toISOString().split('T')[0];
  const prevFrom = new Date(rFromMs - rangeLen - 86400000).toISOString().split('T')[0];

  // 6-month window for trend charts (always fixed)
  const trendAnchor = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const trendStart  = trendAnchor.toISOString().split('T')[0];

  // 7-day window for attendance chart
  const sevenDaysAgo = new Date(bogotaMs - 6 * 86400000).toISOString().split('T')[0];

  document.querySelectorAll('#db-period-label').forEach(el => el.textContent = rangeLabel);

  try {
    // Single query for ALL memberships — compute member metrics in JS,
    // exactly like the users page does (status field in DB is not auto-updated).
    const [
      allMembRes,
      revenueRes, prevRevenueRes,
      revTrendRes,
      attendTrendRes,
      expiringRes,
      scheduleRes,
      streamRes
    ] = await Promise.all([

      // All memberships: used for active count, desertors, new, trends, plans.
      // High limit overrides Supabase's default 1000-row cap (gyms with many renewals
      // easily exceed 1000 rows, causing silent undercounting of active members).
      db.from('memberships')
        .select('user_id, end_date, created_at, plans(name)')
        .order('end_date', { ascending: false })
        .limit(50000),

      // Revenue in selected period
      db.from('cash_movements')
        .select('amount_cop')
        .eq('movement_type', 'Ingreso')
        .gte('movement_date', rangeFrom)
        .lte('movement_date', rangeTo),

      // Revenue in previous period (for % delta)
      db.from('cash_movements')
        .select('amount_cop')
        .eq('movement_type', 'Ingreso')
        .gte('movement_date', prevFrom)
        .lte('movement_date', prevTo),

      // Revenue trend: last 6 months
      db.from('cash_movements')
        .select('amount_cop, movement_date')
        .eq('movement_type', 'Ingreso')
        .gte('movement_date', trendStart),

      // Attendance last 7 days
      db.from('attendance')
        .select('checked_in_at')
        .gte('checked_in_at', sevenDaysAgo + 'T00:00:00')
        .lte('checked_in_at', today + 'T23:59:59'),

      // Expiring in 7 days (by date, not status)
      db.from('memberships')
        .select('end_date, users!user_id(id, full_name, phone), plans(name)')
        .gte('end_date', today)
        .lte('end_date', in7days)
        .order('end_date', { ascending: true }),

      // Today's schedule
      db.from('schedule')
        .select('id, start_time, spots_available, classes(name, capacity, color)')
        .eq('class_date', today)
        .eq('is_cancelled', false)
        .order('start_time'),

      // Today's check-in stream
      db.from('attendance')
        .select('checked_in_at, users(full_name), schedule(start_time, classes(name))')
        .gte('checked_in_at', today + 'T00:00:00')
        .lte('checked_in_at', today + 'T23:59:59')
        .order('checked_in_at', { ascending: false })
        .limit(12)
    ]);

    // ── Compute member states from all memberships ──────────
    // Group by user_id keeping the latest end_date  (same logic as users page)
    const latestByUser = {};
    const allMems = allMembRes.data || [];
    allMems.forEach(m => {
      const prev = latestByUser[m.user_id];
      if (!prev || m.end_date > prev.end_date) {
        latestByUser[m.user_id] = { end_date: m.end_date, plan: m.plans?.name || null };
      }
    });
    const userStates = Object.values(latestByUser);

    // State counts — mirrors users page thresholds exactly
    const activeCount  = userStates.filter(u => u.end_date >= ago7Days).length;
    const churnCount   = userStates.filter(u => u.end_date < ago7Days).length;

    // New memberships in selected period and previous period
    const newCount = allMems.filter(m =>
      m.created_at >= rangeFrom && m.created_at <= rangeTo + 'T23:59:59'
    ).length;
    const newPrev  = allMems.filter(m =>
      m.created_at >= prevFrom && m.created_at <= prevTo + 'T23:59:59'
    ).length;

    // Desertors in selected period (membership ended in period AND > 7 days ago)
    const churnInPeriod = userStates.filter(u =>
      u.end_date >= rangeFrom && u.end_date < ago7Days
    ).length;
    // Desertors in previous period
    const churnPrev = userStates.filter(u =>
      u.end_date >= prevFrom && u.end_date < rangeFrom
    ).length;

    // Revenue totals
    const totalRev   = (revenueRes.data     || []).reduce((s, r) => s + (r.amount_cop || 0), 0);
    const prevRev    = (prevRevenueRes.data || []).reduce((s, r) => s + (r.amount_cop || 0), 0);
    const expiringList = expiringRes.data || [];

    // Retention = active / (active + total desertors)
    const retention = (activeCount + churnCount) > 0
      ? Math.round((activeCount / (activeCount + churnCount)) * 100)
      : 100;

    // ── KPI cards ───────────────────────────────────────────
    _dbSetKpi('admin-stat-members', activeCount, 'cyan',
      'admin-stat-members-chg', `${newCount} alta(s) · ${churnCount} baja(s)`, 'neutral');

    const newDelta = newCount - newPrev;
    _dbSetKpi('admin-stat-new', newCount, 'green',
      'admin-stat-new-chg',
      newPrev > 0
        ? `${newDelta >= 0 ? '↑ +' : '↓ '}${newDelta} vs período ant.`
        : 'primer período',
      newDelta >= 0 ? 'up' : 'down');

    const churnDelta = churnInPeriod - churnPrev;
    _dbSetKpi('admin-stat-churn', churnInPeriod, 'red',
      'admin-stat-churn-chg',
      churnPrev > 0
        ? `${churnDelta <= 0 ? '↓ ' : '↑ +'}${churnDelta} vs período ant.`
        : `${churnCount} totales acum.`,
      churnDelta <= 0 ? 'up' : 'down');

    const retEl  = document.getElementById('admin-stat-retention');
    const retSub = document.getElementById('admin-stat-retention-sub');
    if (retEl) {
      retEl.textContent = retention + '%';
      retEl.className   = `db-kpi-val ${retention >= 80 ? 'green' : retention >= 60 ? 'amber' : 'red'}`;
    }
    if (retSub) retSub.textContent = `${activeCount} activos · ${churnCount} bajas totales`;

    const revEl    = document.getElementById('admin-stat-revenue');
    const revChgEl = document.getElementById('admin-stat-revenue-chg');
    if (revEl) revEl.textContent = _finFmt(totalRev);
    if (revChgEl) {
      if (prevRev > 0) {
        const pct = Math.round(((totalRev - prevRev) / prevRev) * 100);
        revChgEl.textContent = `${pct >= 0 ? '↑ +' : '↓ '}${pct}% vs período ant.`;
        revChgEl.className   = `db-kpi-chg ${pct >= 0 ? 'up' : 'down'}`;
      } else {
        revChgEl.textContent = rangeLabel;
        revChgEl.className   = 'db-kpi-chg neutral';
      }
    }

    _dbSetKpi('admin-stat-expiring', expiringList.length,
      expiringList.length > 0 ? 'amber' : 'green',
      'admin-stat-expiring-sub',
      expiringList.length > 0 ? 'Requieren seguimiento' : 'Al día',
      expiringList.length > 0 ? 'down' : 'up');

    // Kept for adminNotifyAllExpiring() — real recipients (id/phone), not just a count.
    _dashExpiringList = expiringList
      .map(m => ({ id: m.users?.id, name: m.users?.full_name || '?', phone: m.users?.phone || null }))
      .filter(u => u.id);

    // ── Build 6-month trend arrays ──────────────────────────
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trendMonths.push({
        key:   `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
        label: MESES[d.getMonth()]
      });
    }

    // Revenue by month (from cash_movements)
    const revByMonth = {};
    (revTrendRes.data || []).forEach(r => {
      const k = r.movement_date.slice(0, 7);
      revByMonth[k] = (revByMonth[k] || 0) + (r.amount_cop || 0);
    });

    // New members by month (from all memberships created_at)
    const newByMonth = {};
    allMems.forEach(m => {
      if (m.created_at >= trendStart) {
        const k = m.created_at.slice(0, 7);
        newByMonth[k] = (newByMonth[k] || 0) + 1;
      }
    });

    // Desertors by month: group by the month their latest membership expired
    // (end_date < ago7Days = confirmed desertor)
    const churnByMonth = {};
    userStates
      .filter(u => u.end_date >= trendStart && u.end_date < ago7Days)
      .forEach(u => {
        const k = u.end_date.slice(0, 7);
        churnByMonth[k] = (churnByMonth[k] || 0) + 1;
      });

    const trendLabels = trendMonths.map(m => m.label);
    const revData     = trendMonths.map(m => revByMonth[m.key]   || 0);
    const newData     = trendMonths.map(m => newByMonth[m.key]   || 0);
    const churnData   = trendMonths.map(m => churnByMonth[m.key] || 0);

    // Attendance last 7 days
    const dayBuckets = {};
    const dayLabels  = [];
    for (let i = 6; i >= 0; i--) {
      const d   = new Date(bogotaMs - i * 86400000);
      const key = d.toISOString().split('T')[0];
      const lbl = new Date(bogotaMs - i * 86400000 + 5 * 3600 * 1000).toLocaleDateString('es-CO', { weekday: 'short' });
      dayBuckets[key] = 0;
      dayLabels.push({ key, label: lbl.charAt(0).toUpperCase() + lbl.slice(1, 3) });
    }
    (attendTrendRes.data || []).forEach(r => {
      const k = new Date(new Date(r.checked_in_at).getTime() - 5 * 3600 * 1000).toISOString().split('T')[0];
      if (dayBuckets[k] !== undefined) dayBuckets[k]++;
    });

    // Plan distribution (active users only)
    const planCount = {};
    userStates.filter(u => u.end_date >= today).forEach(u => {
      const n = u.plan || 'Sin plan';
      planCount[n] = (planCount[n] || 0) + 1;
    });
    const planEntries = Object.entries(planCount).sort((a, b) => b[1] - a[1]);

    // Store for CSV export
    _lastDashData = {
      trendLabels, revData, newData, churnData,
      activeCount, newCount, churnCount: churnInPeriod, retention, totalRev
    };

    // ── Render all charts ───────────────────────────────────
    requestAnimationFrame(() => {
      _initRevenueChart(trendLabels, revData);
      _initGrowthChart(trendLabels, newData, churnData);
      initAdminCharts(planEntries.map(e => e[0]), planEntries.map(e => e[1]));
      _initAttendanceChart(
        dayLabels.map(d => d.label),
        dayLabels.map(d => dayBuckets[d.key])
      );
    });

    // ── Capacity today ──────────────────────────────────────
    const capList = document.getElementById('admin-capacity-list');
    if (capList) {
      const slots = scheduleRes.data || [];
      if (slots.length === 0) {
        capList.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px 0;text-align:center;">No hay clases programadas hoy</div>';
      } else {
        capList.innerHTML = slots.map(s => {
          const cls       = s.classes || {};
          const total     = cls.capacity || 1;
          const avail     = s.spots_available ?? total;
          const booked    = total - avail;
          const pct       = Math.round((booked / total) * 100);
          const t         = new Date(`2000-01-01T${s.start_time}`);
          const timeLabel = t.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
          const color     = cls.color || 'var(--cyan)';
          const fillClass = color.includes('purple') ? 'purple' : (color.includes('orange') || color.includes('FF6B')) ? 'orange' : '';
          const numColor  = pct >= 90 ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : 'var(--cyan)';
          return `<div class="capacity-row">
            <div class="capacity-header">
              <span class="capacity-class">${cls.name || '—'} ${timeLabel}</span>
              <span class="capacity-num" style="color:${numColor};">${booked}<span style="font-size:14px;color:var(--muted);">/${total}</span></span>
            </div>
            <div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${pct}%;"></div></div>
          </div>`;
        }).join('');
      }
    }

    // ── Check-in stream ─────────────────────────────────────
    const stream = document.getElementById('checkin-stream');
    if (stream) {
      const items = streamRes.data || [];
      if (items.length === 0) {
        stream.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px 0;text-align:center;">Sin check-ins hoy aún</div>';
      } else {
        stream.innerHTML = items.map(a => {
          const name     = a.users?.full_name || 'Usuario';
          const cls      = a.schedule?.classes?.name || '—';
          const timeStr  = new Date(a.checked_in_at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
          const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const colorKey = ciColorKeys[name.charCodeAt(0) % ciColorKeys.length];
          return `<div class="stream-item">
            <div class="stream-avatar" style="background:${ciColorBg[colorKey]};color:${ciColorFg[colorKey]};">${initials}</div>
            <div style="flex:1;"><div style="font-size:12px;font-weight:500;">${name}</div><div style="font-size:10px;color:var(--muted);">${timeStr} · ${cls}</div></div>
            <span class="badge badge-green">✓</span>
          </div>`;
        }).join('');
      }
    }

    // ── Expiring list ───────────────────────────────────────
    const expListEl = document.getElementById('admin-expiring-list');
    const notifAll  = document.getElementById('admin-notif-all-wrapper');
    if (expListEl) {
      if (expiringList.length === 0) {
        expListEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px 0;text-align:center;">Sin vencimientos en los próximos 7 días</div>';
        if (notifAll) notifAll.style.display = 'none';
      } else {
        expListEl.innerHTML = expiringList.map(m => {
          const name     = m.users?.full_name || 'Usuario';
          const plan     = m.plans?.name || '—';
          const end      = new Date(m.end_date + 'T12:00:00');
          const diffMs   = end - new Date(today + 'T00:00:00');
          const days     = Math.round(diffMs / 86400000);
          const badge    = days <= 2 ? 'badge-red' : 'badge-amber';
          const dayLabel = days === 0 ? 'hoy' : days === 1 ? '1 día' : `${days} días`;
          const endStr   = end.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
          const uid      = m.users?.id;
          return `<div class="log-item">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:500;">${name}</div>
              <div style="font-size:11px;color:var(--muted);">${plan} · Vence ${endStr}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="badge ${badge}">${dayLabel}</span>
              ${uid ? `<button class="btn btn-ghost btn-sm" onclick="notificarVencimiento('${uid}',this)">Notif.</button>` : ''}
            </div>
          </div>`;
        }).join('');
        if (notifAll) notifAll.style.display = 'block';
      }
    }

  } catch (err) {
    // Drop any list from a previous successful load — otherwise a failed refresh (e.g. after
    // a member renews and the admin reloads the dashboard) would leave adminNotifyAllExpiring()
    // able to fire real WhatsApp sends off stale "expiring soon" data.
    _dashExpiringList = [];
    _showDashboardError('No pudimos cargar las estadísticas');
    console.error('loadAdminDashboard error:', err);
  }
}

function exportAdminReport() {
  const d = _lastDashData;
  if (!d.trendLabels) { toast('Sin datos', 'Abre el dashboard primero'); return; }
  const rows = [
    ['Mes', 'Ingresos COP', 'Nuevos', 'Desertores'],
    ...d.trendLabels.map((l, i) => [l, d.revData[i], d.newData[i], d.churnData[i]]),
    [],
    ['KPI', 'Valor'],
    ['Miembros activos',      d.activeCount],
    ['Nuevos en período',     d.newCount],
    ['Desertores en período', d.churnCount],
    ['Tasa retención %',      d.retention],
    ['Ingresos en período',   d.totalRev],
  ];
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `thor-training-dashboard-${_bogotaToday()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV descargado', 'Reporte exportado correctamente');
}

// Sends a real WhatsApp "aviso_general" reminder to one user and reports the actual
// outcome — replaces a previous version of this button that just showed a fake
// "Notificación enviada" toast without ever calling send-whatsapp-message.
// btnEl is the clicked button itself (passed as `this` from the onclick attribute) rather
// than looked up via a CSS selector — the same user can appear in more than one still-mounted
// page at once (pages are hidden with CSS, not removed from the DOM — see showPage()), so a
// selector matching on the onclick text alone could update the WRONG identical-looking button.
async function notificarVencimiento(userId, btnEl) {
  // _adminUsuariosAll is only populated once the Usuarios page has loaded — this button
  // also appears on the dashboard's expiring-list widget, so fall back to a direct fetch.
  let user = (_adminUsuariosAll || []).find(u => u.id === userId);
  if (!user) {
    const { data } = await db.from('users').select('id, full_name, phone').eq('id', userId).maybeSingle();
    if (data) user = { id: data.id, name: data.full_name || '?', phone: data.phone || null, statusLabel: null };
  }
  if (!user) return;
  if (!user.phone) { toast('Sin teléfono', 'Este usuario no tiene un número de WhatsApp registrado'); return; }

  const btn = btnEl;
  if (btn) { btn.textContent = 'Enviando…'; btn.disabled = true; }

  const subject = 'Tu membresía en Thor Training';
  const body = (user.statusLabel === 'Vencido' || user.statusLabel === 'Desertor')
    ? `Hola ${user.name}, tu membresía está vencida. Pásate a renovarla cuando puedas.`
    : `Hola ${user.name}, tu membresía está por vencer pronto. ¡No olvides renovar!`;

  const { success, error } = await _sendWhatsappTemplateDetailed('aviso_general', user, null, subject, body);
  if (success) toast('Notificación enviada', `${user.name} · WhatsApp`);
  else toast('Error al enviar', error || 'Intenta de nuevo');
  if (btn) { btn.textContent = 'Notif.'; btn.disabled = false; }
}

// Same real-send/real-outcome fix as notificarVencimiento(), applied to the dashboard's
// bulk "notify all expiring" button — previously just read the KPI count off the DOM
// and showed a fake success toast without sending anything.
async function adminNotifyAllExpiring() {
  const recipients = _dashExpiringList.filter(u => u.phone);
  if (recipients.length === 0) { toast('Sin destinatarios', 'No hay usuarios con teléfono registrado por vencer'); return; }

  // This used to be a mock button (fake toast, sent nothing) — it now sends a real
  // WhatsApp to everyone in the list in one click, so it needs an explicit confirmation
  // the old mock version never needed.
  if (!confirm(`¿Enviar recordatorio de WhatsApp a ${recipients.length} usuario${recipients.length !== 1 ? 's' : ''} con membresía por vencer?`)) return;

  const btn = document.getElementById('btn-notify-all-expiring');
  if (btn) { btn.textContent = 'Enviando…'; btn.disabled = true; }

  try {
    const results = await Promise.all(recipients.map(u => {
      const subject = 'Tu membresía en Thor Training';
      const body = `Hola ${u.name}, tu membresía está por vencer pronto. ¡No olvides renovar!`;
      return _sendWhatsappTemplateDetailed('aviso_general', u, null, subject, body);
    }));
    const sent   = results.filter(r => r.success).length;
    const failed = results.length - sent;
    toast(failed === 0 ? 'Notificaciones enviadas' : 'Envío parcial',
      `${sent} enviada(s)${failed ? `, ${failed} fallida(s)` : ''} por WhatsApp`);
  } finally {
    if (btn) { btn.textContent = 'Notificar a todos'; btn.disabled = false; }
  }
}

// ===================== ADMIN USUARIOS =====================

const _USUARIOS_PAGE_SIZE = 50;
let _adminUsuariosAll     = [];
let _usuariosFilterStatus = 'TODOS';
let _usuariosFilterPlan   = 'TODOS';
let _usuariosPage         = 0;
let _usuariosTotalCount   = 0;
let _usuariosHasMore      = false;
let _usuariosLoadingMore  = false;
let _usuariosAllLoaded    = false;
let _usuariosLoadingFiltered = false;

function openUsuarioEdit(id) {
  const user = _adminUsuariosAll.find(u => u.id === id);
  if (!user) return;
  document.getElementById('ue-id').value     = id;
  document.getElementById('ue-nombre').value = user.name;
  document.getElementById('ue-email').value  = user.email;
  document.getElementById('ue-tel').value    = user.phone || '';
  openModal('usuario-edit');
}

async function guardarUsuarioEdit() {
  const id       = document.getElementById('ue-id').value;
  const full_name = (document.getElementById('ue-nombre').value || '').trim();
  const phone    = (document.getElementById('ue-tel').value    || '').trim() || null;

  if (!full_name) { toast('Campo requerido', 'El nombre es obligatorio'); return; }

  const btn = document.getElementById('btn-ue-save');
  if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }

  try {
    const { error } = await db.from('users').update({ full_name, phone }).eq('id', id);
    if (error) throw error;
    toast('Guardado', 'Datos del usuario actualizados');
    closeModal('modal-usuario-edit');
    loadAdminUsuariosPage();
  } catch (err) {
    toast('Error', err.message || 'No se pudo guardar');
  } finally {
    if (btn) { btn.textContent = 'Guardar cambios'; btn.disabled = false; }
  }
}

let _nuevoPlanCache = null;

async function openNuevoUsuarioModal(prefillCedula) {
  // Load plans from DB once (reset when modal is reopened only if cache is stale)
  if (!_nuevoPlanCache) {
    const { data } = await db
      .from('plans')
      .select('id, name, duration_days, tiquetera_sessions, pilates_classes')
      .order('name');
    // Deduplicate by name — keeps the first occurrence (lowest id after ORDER BY name)
    _nuevoPlanCache = Array.from(new Map((data || []).map(p => [p.name, p])).values());
  }

  const planSel = document.getElementById('nuevo-u-plan');
  if (planSel) {
    planSel.innerHTML =
      '<option value="__sin_mensualidad__">Sin mensualidad</option>' +
      _nuevoPlanCache.map(p => `<option value="${p.id}">${_escHtml(p.name)}</option>`).join('');
  }

  // Default dates: start = today, fin = hidden until plan chosen
  const todayStr = _bogotaToday();
  const fechaEl = document.getElementById('nuevo-u-fecha');
  if (fechaEl) fechaEl.value = todayStr;
  const fechaFinEl = document.getElementById('nuevo-u-fecha-fin');
  if (fechaFinEl) fechaFinEl.value = '';

  // Hide membership dates row (default = Sin mensualidad)
  const fechasRow = document.getElementById('nuevo-u-fechas-row');
  if (fechasRow) fechasRow.style.display = 'none';

  // Reflect required-field state for the default Sin mensualidad selection
  _applyNuevoURequeridos(true);

  if (prefillCedula) {
    const cedulaEl = document.getElementById('nuevo-u-cedula');
    if (cedulaEl) cedulaEl.value = prefillCedula;
  }

  openModal('nuevo-usuario');
  setTimeout(() => document.getElementById('nuevo-u-nombre')?.focus(), 120);
}

function _applyNuevoURequeridos(isSin) {
  const show = el => { if (el) el.style.display = ''; };
  const hide = el => { if (el) el.style.display = 'none'; };
  isSin ? hide(document.getElementById('nuevo-u-cedula-star')) : show(document.getElementById('nuevo-u-cedula-star'));
  isSin ? hide(document.getElementById('nuevo-u-email-star'))  : show(document.getElementById('nuevo-u-email-star'));
  isSin ? show(document.getElementById('nuevo-u-tel-star'))    : hide(document.getElementById('nuevo-u-tel-star'));
}

function onNuevoPlanChange() {
  const planSel   = document.getElementById('nuevo-u-plan');
  const fechasRow = document.getElementById('nuevo-u-fechas-row');
  if (!planSel || !fechasRow) return;

  const isSin = planSel.value === '__sin_mensualidad__';
  fechasRow.style.display = isSin ? 'none' : '';

  if (isSin) {
    const fi = document.getElementById('nuevo-u-fecha');
    const ff = document.getElementById('nuevo-u-fecha-fin');
    if (fi) fi.value = '';
    if (ff) ff.value = '';
  } else {
    // Set today as start date if empty, then auto-calc end date
    const fi = document.getElementById('nuevo-u-fecha');
    if (fi && !fi.value) fi.value = _bogotaToday();
    onNuevoFechaChange();
  }

  _applyNuevoURequeridos(isSin);
}

function onNuevoFechaChange() {
  const planSel  = document.getElementById('nuevo-u-plan');
  const startInp = document.getElementById('nuevo-u-fecha');
  const endInp   = document.getElementById('nuevo-u-fecha-fin');
  if (!planSel || !startInp || !endInp) return;

  if (planSel.value === '__sin_mensualidad__') return;

  const plan = (_nuevoPlanCache || []).find(p => p.id === planSel.value);
  if (!plan?.duration_days || !startInp.value) { endInp.value = ''; return; }

  const [y, m, d] = startInp.value.split('-').map(Number);
  const end = new Date(y, m - 1, d + plan.duration_days - 1);
  const pad = n => String(n).padStart(2, '0');
  endInp.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

async function guardarNuevoUsuario() {
  const full_name  = (document.getElementById('nuevo-u-nombre')?.value     || '').trim();
  const email      = (document.getElementById('nuevo-u-email')?.value      || '').trim().toLowerCase();
  const cedula     = (document.getElementById('nuevo-u-cedula')?.value     || '').trim();
  const phone      = (document.getElementById('nuevo-u-tel')?.value        || '').trim() || null;
  const birth_date = document.getElementById('nuevo-u-nacimiento')?.value  || null;
  const address    = (document.getElementById('nuevo-u-direccion')?.value  || '').trim() || null;
  const emg_name   = (document.getElementById('nuevo-u-emg-nombre')?.value || '').trim() || null;
  const emg_phone  = (document.getElementById('nuevo-u-emg-tel')?.value    || '').trim() || null;
  const notes      = (document.getElementById('nuevo-u-notas')?.value      || '').trim() || null;

  const planValue       = document.getElementById('nuevo-u-plan')?.value;
  const isSinMensualidad = !planValue || planValue === '__sin_mensualidad__';
  const plan            = isSinMensualidad ? null : (_nuevoPlanCache || []).find(p => p.id === planValue);
  const startDate       = document.getElementById('nuevo-u-fecha')?.value      || null;
  const endDate         = document.getElementById('nuevo-u-fecha-fin')?.value  || null;

  if (!full_name) { toast('Campo requerido', 'Ingresa el nombre completo'); return; }
  if (isSinMensualidad) {
    if (!phone) { toast('Campo requerido', 'Ingresa el teléfono de contacto'); return; }
  } else {
    if (!email)            { toast('Campo requerido', 'Ingresa el correo electrónico'); return; }
    if (!cedula)           { toast('Campo requerido', 'Ingresa la cédula'); return; }
    if (cedula.length < 6) { toast('Cédula muy corta', 'Mínimo 6 dígitos'); return; }
  }
  if (!isSinMensualidad && plan && !endDate) {
    toast('Fecha requerida', 'Selecciona la fecha de inicio para calcular la fecha de fin'); return;
  }

  const btn = document.querySelector('#modal-nuevo-usuario .btn-primary');
  if (btn) { btn.textContent = 'Creando…'; btn.disabled = true; }

  try {
    // Reject duplicate cédula before any auth operation (skip when none provided)
    if (cedula) {
      const { data: existingCedula } = await db
        .from('users')
        .select('id, full_name')
        .eq('identification', cedula)
        .maybeSingle();
      if (existingCedula) {
        toast('Cédula duplicada', `Ya existe un usuario con esta cédula: ${existingCedula.full_name}`);
        return;
      }
    }

    // Create auth user — non-persistent client so the admin session is not displaced.
    // For Sin mensualidad contacts with no email/cedula, use placeholders so Supabase auth
    // can still create an account (these leads won't log in with the placeholder credentials).
    const tempDb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    const authEmail    = email  || `lead_${Date.now()}@thor-training.placeholder`;
    const authPassword = cedula || String(Date.now());
    const { data: authData, error: signUpError } = await tempDb.auth.signUp({ email: authEmail, password: authPassword });
    if (signUpError) throw signUpError;
    if (!authData?.user?.id) throw new Error('No se pudo obtener el ID del nuevo usuario');

    // Upsert profile row — handles both trigger-created and no-trigger cases
    const { error: profileError } = await db.from('users').upsert({
      id:                      authData.user.id,
      full_name,
      email:                   email || authEmail,
      phone,
      identification:          cedula || null,
      birth_date:              birth_date || null,
      address,
      emergency_contact_name:  emg_name,
      emergency_contact_phone: emg_phone,
      notes,
      role:                    'user',
      is_active:               true,
    }, { onConflict: 'id' });
    if (profileError) {
      // The auth account already exists at this point (and, if a DB trigger auto-provisions
      // a profile row on signup, so does an empty-named users row). Clean it up so a failed
      // attempt never leaves a nameless "lead_..." ghost entry visible in the Usuarios list.
      await db.from('users').delete().eq('id', authData.user.id);
      throw profileError;
    }

    // Register the initial password in the Credenciales vault (skip placeholder-only
    // "sin mensualidad" leads with no real cédula — that placeholder isn't a usable login).
    // Non-fatal — the account itself is already created either way.
    if (cedula) {
      const { error: vaultError } = await db.rpc('store_user_credential', {
        target_user_id: authData.user.id,
        new_password:   authPassword,
      });
      if (vaultError) console.warn('store_user_credential (usuario):', vaultError.message);
    }

    // Insert membership only when a real plan was selected
    if (!isSinMensualidad && plan && startDate && endDate) {
      const { error: mErr } = await db.from('memberships').insert({
        user_id:                     authData.user.id,
        plan_id:                     plan.id,
        start_date:                  startDate,
        end_date:                    endDate,
        status:                      'active',
        pilates_classes_included:    plan.pilates_classes    ?? null,
        tiquetera_sessions_included: plan.tiquetera_sessions ?? null,
      });
      if (mErr) throw mErr;
    }

    closeModal('modal-nuevo-usuario');

    // Reset all form fields
    ['nuevo-u-nombre','nuevo-u-cedula','nuevo-u-email','nuevo-u-tel',
     'nuevo-u-nacimiento','nuevo-u-direccion','nuevo-u-emg-nombre',
     'nuevo-u-emg-tel','nuevo-u-notas','nuevo-u-fecha','nuevo-u-fecha-fin',
    ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    loadAdminUsuariosPage();

    if (isSinMensualidad) {
      if (email) {
        showCredencialesModal(email, authPassword);
        toast('✅ Usuario creado', 'Sin membresía activa asignada');
      } else {
        toast('✅ Usuario creado', `${full_name} registrado sin mensualidad`);
      }
    } else {
      showCredencialesModal(email, cedula);
    }
  } catch (err) {
    toast('Error al crear usuario', err.message || '');
  } finally {
    if (btn) { btn.textContent = 'Crear usuario'; btn.disabled = false; }
  }
}

// ===================== DESPRENDIBLE DE PAGO (PDF) =====================
// Se genera al vuelo en el navegador cada vez que se pide ver/descargar (con pdf-lib,
// mismo patrón que _generateSignedPDF para el Consentimiento Informado) — nunca se
// guarda un archivo aparte en Storage. El documento es 100% derivable de una fila de
// `payments` ya con plan_id/period_start/period_end congelados en el momento del pago
// (ver register_manual_payment()), así que siempre refleja la vigencia real que ESE
// pago compró, aunque el socio se haya renovado después y la membresía actual ya
// muestre otras fechas.

async function _generatePaymentReceiptPDF(d) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const pdfDoc   = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pw = 595.28, ph = 420;
  const page  = pdfDoc.addPage([pw, ph]);
  const cyan  = rgb(0, 0.812, 1);
  const black = rgb(0.04, 0.04, 0.04);
  const gray  = rgb(0.45, 0.45, 0.45);
  const lgray = rgb(0.93, 0.93, 0.93);

  page.drawRectangle({ x: 0, y: ph - 90, width: pw, height: 90, color: black });
  page.drawRectangle({ x: 0, y: ph - 93, width: pw, height: 3,  color: cyan });

  try {
    const logoBytes = await fetch('img/logo_completo.png').then(r => r.arrayBuffer());
    const logoImg   = await pdfDoc.embedPng(logoBytes);
    const logoH = 46;
    const logoW = Math.round(logoImg.width * logoH / logoImg.height);
    page.drawImage(logoImg, { x: 40, y: ph - 68, width: logoW, height: logoH });
  } catch (_) { /* si el logo no carga (offline/CORS), el desprendible sigue siendo válido sin él */ }

  page.drawText('DESPRENDIBLE DE PAGO', { x: 230, y: ph - 40, size: 15, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(d.receiptNumber || '—',  { x: 230, y: ph - 58, size: 11, font,           color: cyan });

  const rows = [
    ['Socio:',          d.userName || '—'],
    ['Documento:',      d.userIdentification || '—'],
    ['Plan:',           d.planName || '—'],
    ['Monto:',          _formatCOPFull(d.amountCop)],
    ['Método de pago:', d.method === 'efectivo' ? 'Efectivo' : 'Transferencia'],
  ];
  if (d.transactionNumber) rows.push(['N° de transacción:', d.transactionNumber]);
  rows.push(['Fecha de pago:', d.paidAtStr  || '—']);
  rows.push(['Vigencia:',      `${d.periodStartStr || '—'}  al  ${d.periodEndStr || '—'}`]);

  let y = ph - 130;
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) page.drawRectangle({ x: 40, y: y - 6, width: pw - 80, height: 22, color: lgray });
    page.drawText(label,         { x: 50,  y, size: 10, font: fontBold, color: gray  });
    page.drawText(String(value), { x: 220, y, size: 10, font,           color: black });
    y -= 24;
  });

  page.drawText('Thor Training · La Catedral de la Fuerza',                { x: 40, y: 28, size: 9, font, color: gray });
  page.drawText('Diagonal 29 # 34A sur - 26, Envigado · thortraininggym.club', { x: 40, y: 16, size: 8, font, color: gray });

  return pdfDoc.save();
}

function _downloadReceiptPdfBytes(pdfBytes, receiptNumber) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `desprendible-${receiptNumber || 'thor-training'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// payment: fila de `payments` enriquecida con { planName, userName, userIdentification }
// por quien llama (historial admin/socio ya trae esos datos vía join a plans/users) —
// esta función no hace ninguna consulta propia, solo genera y descarga el PDF.
async function descargarDesprendiblePago(payment) {
  try {
    const pdfBytes = await _generatePaymentReceiptPDF({
      receiptNumber:      payment.receipt_number,
      userName:           payment.userName,
      userIdentification: payment.userIdentification,
      planName:           payment.planName,
      amountCop:          payment.amount_cop,
      method:             payment.method,
      transactionNumber:  payment.transaction_number,
      paidAtStr:          _formatDate(payment.paid_at,      { day: 'numeric', month: 'long',  year: 'numeric' }),
      periodStartStr:     _formatDate(payment.period_start, { day: 'numeric', month: 'short', year: 'numeric' }),
      periodEndStr:       _formatDate(payment.period_end,   { day: 'numeric', month: 'short', year: 'numeric' }),
    });
    _downloadReceiptPdfBytes(pdfBytes, payment.receipt_number);
  } catch (err) {
    toast('Error', 'No se pudo generar el desprendible: ' + (err.message || ''));
  }
}

// Reactivación de un clic para una membresía suspendida por un VOIDED de Wompi (ver
// void_payment_and_suspend_membership()) — decisión de Andrea: un VOIDED se trata
// como fraude por defecto (bloqueo automático), pero si resulta ser un error humano,
// reactivar no debe ser un dolor de cabeza.
async function reactivarMembresiaSuspendida() {
  const user = _udpCurrentUser;
  if (!user || !user.membershipId) return;

  try {
    const { error } = await db.from('memberships').update({
      status: 'active',
      suspended_reason: null,
      suspended_at: null,
      updated_by: currentUser?.id || null,
    }).eq('id', user.membershipId);
    if (error) throw error;

    // Recalcula el estado real desde end_date para refrescar el panel al instante
    // (podría seguir Vencida/Por vencer si la vigencia ya pasó mientras estaba
    // suspendida — reactivar solo quita el bloqueo de fraude, no renueva la
    // membresía) — la fila de la lista de Usuarios se refresca completa abajo, más
    // simple que reconstruir su HTML a mano por tercera vez en este archivo.
    const newStatus = _membershipStatus(user.endDateRaw, 'active');
    const updated = { ...user, statusLabel: newStatus, suspendedReason: null };
    _udpCurrentUser = updated;
    _udpRenderValues(updated);

    toast('Membresía reactivada', user.name || '');
    loadAdminUsuariosPage();
  } catch (err) {
    toast('Error', err.message || 'No se pudo reactivar la membresía');
  }
}

// ===================== REGISTRAR PAGO (efectivo/transferencia) =====================
// Abierto desde el tab Membresía del perfil de usuario (modal-registrar-pago). Cubre
// tanto mensualidad nueva (usuario sin membresía todavía) como renovación — la vigencia
// siempre se calcula desde hoy vía register_manual_payment() (RPC atómica, ver
// supabase/migrations/20260826_register_manual_payment_rpc.sql), nunca desde el
// end_date anterior.

async function abrirModalRegistrarPago() {
  const user = _udpCurrentUser;
  if (!user) return;

  if (!_udpPlansCache) {
    const { data } = await db.from('plans').select('id, name, duration_days, tiquetera_sessions, pilates_classes, pilates_classes_per_month, price_cop, is_active').order('name');
    _udpPlansCache = Array.from(new Map((data || []).map(p => [p.name, p])).values());
  }

  document.getElementById('rp-usuario-nombre').textContent = user.name || '';
  document.getElementById('rp-error').textContent = '';
  document.getElementById('rp-metodo').value = 'efectivo';
  document.getElementById('rp-transaccion').value = '';
  const fileInp = document.getElementById('rp-comprobante');
  if (fileInp) fileInp.value = '';
  document.getElementById('rp-transferencia-fields').style.display = 'none';

  const planSel = document.getElementById('rp-plan');
  const plans   = (_udpPlansCache || []).filter(p => p.is_active !== false);
  if (!plans.length) { toast('Sin planes', 'No hay planes activos configurados'); return; }
  planSel.innerHTML = plans.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  if (user.membershipPlanId && plans.some(p => p.id === user.membershipPlanId)) {
    planSel.value = user.membershipPlanId;
  }
  _rpPlanChanged();

  openModal('registrar-pago');
}

function _rpPlanChanged() {
  const planSel  = document.getElementById('rp-plan');
  const plan     = (_udpPlansCache || []).find(p => p.id === planSel.value);
  const montoInp = document.getElementById('rp-monto');
  if (plan && montoInp) montoInp.value = plan.price_cop || '';
}

function _rpMetodoChanged() {
  const metodo = document.getElementById('rp-metodo').value;
  document.getElementById('rp-transferencia-fields').style.display = metodo === 'transferencia' ? '' : 'none';
}

async function registrarPagoManual() {
  const user = _udpCurrentUser;
  if (!user) return;

  const errEl = document.getElementById('rp-error');
  errEl.textContent = '';

  const planId      = document.getElementById('rp-plan').value;
  const monto       = parseFloat(document.getElementById('rp-monto').value);
  const metodo      = document.getElementById('rp-metodo').value;
  const transaccion = (document.getElementById('rp-transaccion').value || '').trim();
  const fileInp     = document.getElementById('rp-comprobante');
  const file        = fileInp?.files?.[0] || null;

  if (!planId)               { errEl.textContent = 'Selecciona un plan'; return; }
  if (!monto || monto <= 0)  { errEl.textContent = 'Ingresa un monto válido'; return; }
  if (metodo === 'transferencia') {
    if (!transaccion) { errEl.textContent = 'Ingresa el número de transacción'; return; }
    if (!file)         { errEl.textContent = 'Sube la foto del comprobante'; return; }
  }

  const btn = document.getElementById('rp-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Registrando…'; }

  try {
    // Comprobante primero — si la subida falla, no queremos un pago sin soporte.
    let receiptPhotoUrl = null;
    if (metodo === 'transferencia' && file) {
      const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `comprobantes/${user.id}_${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage.from('payment-receipts').upload(path, file);
      if (upErr) throw new Error('No se pudo subir el comprobante: ' + upErr.message);
      receiptPhotoUrl = path;
    }

    const { data, error } = await db.rpc('register_manual_payment', {
      p_user_id:            user.id,
      p_plan_id:            planId,
      p_amount_cop:         monto,
      p_method:             metodo,
      p_transaction_number: metodo === 'transferencia' ? transaccion : null,
      p_receipt_photo_url:  receiptPhotoUrl,
      p_membership_id:      user.membershipId || null,
    });
    if (error) throw error;

    const result    = Array.isArray(data) ? data[0] : data;
    const plan      = (_udpPlansCache || []).find(p => p.id === planId);
    const newEndRaw = result?.new_end_date || user.endDateRaw;
    const newEndStr = result?.new_end_date ? _formatDate(result.new_end_date, { day: 'numeric', month: 'short', year: 'numeric' }) : user.endDateStr;

    // Recompute status from the new end_date — mismo criterio que _saveUserDetail
    // (no asumir 'Activo': un plan de duración muy corta, ej. Individual por día,
    // puede caer directo en 'Por vencer').
    const newStatus = (() => {
      const now = new Date(); now.setHours(0,0,0,0);
      const in5 = new Date(now); in5.setDate(in5.getDate() + 5);
      const edD = parseLocalDate(newEndRaw); edD.setHours(0,0,0,0);
      if (edD < now)  return 'Vencido';
      if (edD <= in5) return 'Por vencer';
      return 'Activo';
    })();

    // Refleja el nuevo estado de la membresía en memoria, en el panel de perfil y en
    // la fila de la lista de Usuarios al instante — mismo patrón que _saveUserDetail,
    // sin esperar una recarga completa de la página.
    const updated = {
      ...user,
      membershipId:              result?.membership_id || user.membershipId,
      membershipPlanId:          planId,
      planName:                  plan?.name || user.planName,
      startDate:                 _bogotaToday(),
      endDateRaw:                newEndRaw,
      endDateStr:                newEndStr,
      pilatesClassesIncluded:    plan?.pilates_classes    || 0,
      pilatesClassesUsed:        0,
      pilatesClassesPerMonth:    plan?.pilates_classes_per_month || 0,
      tiqueteraSessionsIncluded: plan?.tiquetera_sessions || 0,
      tiqueteraSessionsUsed:     0,
      statusLabel:               newStatus,
    };

    const sbClass   = _statusBadgeClass(newStatus);
    const endStyle  = newStatus === 'Vencido' ? 'color:var(--red);' : newStatus === 'Desertor' ? 'color:#9c3a50;' : '';
    const planBadge = updated.planName ? '<span class="badge badge-cyan">' + updated.planName + '</span>' : '<span class="badge badge-muted">—</span>';
    const ctHtml    = updated.hasContract
      ? '<span class="contract-icon contract-ok" title="Contrato aceptado">✓</span>'
      : '<span class="contract-icon contract-pending" title="Contrato pendiente">✗</span>';
    const aBtn = (newStatus === 'Por vencer' || newStatus === 'Vencido' || newStatus === 'Desertor')
      ? `<div style="display:flex;gap:6px;"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();notificarVencimiento('${user.id}',this)">Notif.</button><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎</button></div>`
      : `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎ Editar</button>`;
    updated.rowHtml = `<tr style="cursor:pointer;" onclick="openUserDetailModal('${user.id}')">
        <td><div class="stream-avatar" style="width:32px;height:32px;background:${updated.bg};color:${updated.fg};font-family:'Outfit';font-weight:700;font-size:13px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${updated.initials}</div></td>
        <td><div style="font-weight:500;">${updated.name}</div><div style="font-size:11px;color:var(--muted);">${updated.email || '—'}</div></td>
        <td style="color:var(--muted);font-size:13px;">${updated.phone || '—'}</td>
        <td>${planBadge}</td>
        <td style="${endStyle}">${newEndStr}</td>
        <td><span style="font-family:'Outfit';font-weight:700;font-size:18px;color:var(--cyan);">${updated.attended}</span></td>
        <td><span class="badge ${sbClass}">${newStatus}</span></td>
        <td>${ctHtml}</td>
        <td>${aBtn}</td>
      </tr>`;

    const idx = _adminUsuariosAll.findIndex(u => u.id === user.id);
    if (idx !== -1) _adminUsuariosAll[idx] = updated;
    _udpCurrentUser = updated;

    _udpRenderValues(updated);
    _applyUsuariosFilters();

    // WhatsApp de confirmación — plantilla de UTILIDAD ya aprobada por Meta
    // (confirmacion_pago, no de marketing: sin costo de conversación fuera de lo ya
    // contemplado). Un único envío, solo aquí, solo tras éxito de la RPC — nunca se
    // dispara en un pago fallido/pendiente (si la RPC lanzó error, ya se fue al catch
    // de abajo y nunca se llega hasta acá) ni se repite por reintento (una sola
    // invocación por click, con el botón deshabilitado mientras está en vuelo).
    // Completamente aparte de "Comunicación masiva" (enviarMensaje(), que dispara la
    // misma plantilla pero solo cuando el admin la arma y envía a mano desde esa
    // página) y de Wompi (que hoy NO envía ningún WhatsApp — ni el webhook ni el
    // manejo del retorno del checkout llaman send-whatsapp-message) — no comparte
    // estado con ninguno de los dos, solo la función de envío, y le pasa el monto de
    // forma explícita en vez de leerlo del campo #wa-monto de la otra página.
    // La plantilla aprobada en Meta solo tiene 2 parámetros ({{1}} nombre, {{2}} monto)
    // — agregar un tercero (vigencia) requeriría editar la plantilla en Meta Business
    // Manager y esperar su re-aprobación, algo que no se puede hacer desde acá. Mientras
    // tanto, la vigencia va empaquetada dentro del mismo parámetro de monto (pedido de
    // Andrea/María Paulina, 2026-08-27: el WhatsApp debe decir de qué fecha a qué fecha
    // queda vigente, no solo el monto) — de paso corrige que antes se mandaba el número
    // crudo sin formato de moneda (ej. "150000" en vez de "$150.000").
    const waStartStr = _formatDate(updated.startDate, { day: 'numeric', month: 'short', year: 'numeric' });
    const waMontoConVigencia = `${_formatCOPFull(monto)} (vigente del ${waStartStr} al ${newEndStr})`;

    let waWarning = '';
    try {
      const waResult = await _sendWhatsappTemplateDetailed(
        'confirmacion_pago', { name: updated.name, phone: updated.phone }, null, null, null, waMontoConVigencia
      );
      if (!waResult.success) waWarning = ' · ⚠️ WhatsApp no enviado';
    } catch (_) {
      waWarning = ' · ⚠️ WhatsApp no enviado';
    }

    closeModal('modal-registrar-pago');
    toast('✅ Pago registrado', `Recibo ${result?.receipt_number || ''} — vigencia hasta ${newEndStr}${waWarning}`);

    // El desprendible se genera y descarga de una vez — no bloquea el flujo si falla
    // (el pago ya quedó registrado; el desprendible siempre se puede volver a generar
    // desde el historial, parte 5).
    descargarDesprendiblePago({
      receipt_number:      result?.receipt_number,
      userName:            updated.name,
      userIdentification:  updated.identification,
      planName:            updated.planName,
      amount_cop:          monto,
      method:              metodo,
      transaction_number:  metodo === 'transferencia' ? transaccion : null,
      paid_at:             new Date().toISOString(),
      period_start:        updated.startDate,
      period_end:          newEndRaw,
    });
  } catch (err) {
    errEl.textContent = err.message || 'Error al registrar el pago';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Registrar pago'; }
  }
}

async function loadAdminUsuariosPage() {
  _usuariosPage        = 0;
  _usuariosHasMore     = false;
  _usuariosLoadingMore = false;
  _usuariosAllLoaded   = false;
  _adminUsuariosAll    = [];
  _usuariosFilterStatus = 'TODOS';
  _usuariosFilterPlan   = 'TODOS';

  const searchEl = document.getElementById('usuarios-search');
  if (searchEl) searchEl.value = '';

  const tbody = document.getElementById('admin-usuarios-tbody');
  if (!tbody) return;
  tbody.innerHTML = _loaderRow(9);

  try {
    const { count } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user');
    _usuariosTotalCount = count || 0;

    await _fetchUsuariosPage(0);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--red);">Error al cargar usuarios: ${err.message || 'Intenta de nuevo'}</td></tr>`;
  }
}


async function _fetchUsuariosPage(page) {
  const from = page * _USUARIOS_PAGE_SIZE;
  const to   = from + _USUARIOS_PAGE_SIZE - 1;

  const { data: users, error: usersError } = await db
    .from('users')
    .select('id, full_name, email, phone, identification, birth_date, address, emergency_contact_name, emergency_contact_phone, is_debtor, debt_balance_cop, debt_reason, notes, registered_at, receives_emails, fingerprint_registered, memberships!user_id(id, plan_id, start_date, end_date, status, suspended_reason, pilates_classes_used, pilates_classes_included, tiquetera_sessions_used, tiquetera_sessions_included, plans(name, pilates_classes_per_month))')
    .eq('role', 'user')
    .order('full_name')
    .range(from, to);

  if (usersError) throw usersError;

  const loaded = from + (users?.length || 0);
  _usuariosHasMore = loaded < _usuariosTotalCount;

  if (!users || users.length === 0) {
    if (page === 0) { _buildUsuariosPlanChips([]); _applyUsuariosFilters(); }
    _updateLoadMoreBtn();
    return;
  }

  const userIds = users.map(u => u.id);

  const [attendanceRes, contractsRes] = await Promise.all([
    db.from('attendance').select('user_id').in('user_id', userIds),
    db.from('contract_acceptances').select('user_id').in('user_id', userIds)
  ]);

  const attendanceCount = {};
  (attendanceRes.data || []).forEach(a => {
    attendanceCount[a.user_id] = (attendanceCount[a.user_id] || 0) + 1;
  });
  const contractMap = {};
  (contractsRes.data || []).forEach(c => { contractMap[c.user_id] = true; });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in5Days = new Date(today);
  in5Days.setDate(in5Days.getDate() + 5);
  const ago7Days = new Date(today);
  ago7Days.setDate(ago7Days.getDate() - 7);

  const existingIds = new Set(_adminUsuariosAll.map(u => u.id));

  const newEntries = users
    .filter(user => !existingIds.has(user.id))
    .map(user => {
      const mems       = user.memberships || [];
      const membership = _pickCurrentMembership(mems);
      const planName   = membership?.plans?.name || null;

      const attended    = attendanceCount[user.id] || 0;
      const hasContract = !!contractMap[user.id];

      let statusLabel, statusBadge;
      if (!membership || !membership.end_date) {
        statusLabel = 'Sin membresía'; statusBadge = 'badge-muted';
      } else if (membership.status === 'suspended') {
        // VOIDED de Wompi (ver void_payment_and_suspend_membership()) — pisa la fecha,
        // una membresía suspendida por fraude no debe verse "Activa" solo porque su
        // end_date todavía no pasó.
        statusLabel = 'Suspendida'; statusBadge = 'badge-red';
      } else {
        const endDate = parseLocalDate(membership.end_date);
        if      (endDate < ago7Days) { statusLabel = 'Desertor';   statusBadge = 'badge-desertor'; }
        else if (endDate < today)    { statusLabel = 'Vencido';    statusBadge = 'badge-red';      }
        else if (endDate <= in5Days) { statusLabel = 'Por vencer'; statusBadge = 'badge-amber';    }
        else                         { statusLabel = 'Activo';     statusBadge = 'badge-green';    }
      }

      const name     = user.full_name || user.email || '?';
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const colorKey = ciColorKeys[name.charCodeAt(0) % ciColorKeys.length];
      const bg       = ciColorBg[colorKey];
      const fg       = ciColorFg[colorKey];

      const actionBtn = (statusLabel === 'Por vencer' || statusLabel === 'Vencido' || statusLabel === 'Desertor')
        ? `<div style="display:flex;gap:6px;"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();notificarVencimiento('${user.id}',this)">Notif.</button><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎</button></div>`
        : `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎ Editar</button>`;

      const endDateStr   = membership?.end_date ? _formatDate(membership.end_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const endDateStyle = statusLabel === 'Vencido' ? 'color:var(--red);' : statusLabel === 'Desertor' ? 'color:#9c3a50;' : '';
      const planBadge    = planName ? `<span class="badge badge-cyan">${planName}</span>` : `<span class="badge badge-muted">—</span>`;
      const contractHtml = hasContract
        ? `<span class="contract-icon contract-ok" title="Contrato aceptado">✓</span>`
        : `<span class="contract-icon contract-pending" title="Contrato pendiente">✗</span>`;

      const rowHtml = `<tr style="cursor:pointer;" onclick="openUserDetailModal('${user.id}')">
        <td><div class="stream-avatar" style="width:32px;height:32px;background:${bg};color:${fg};font-family:'Outfit';font-weight:700;font-size:13px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${initials}</div></td>
        <td><div style="font-weight:500;">${name}</div><div style="font-size:11px;color:var(--muted);">${user.email || '—'}</div></td>
        <td style="color:var(--muted);font-size:13px;">${user.phone || '—'}</td>
        <td>${planBadge}</td>
        <td style="${endDateStyle}">${endDateStr}</td>
        <td><span style="font-family:'Outfit';font-weight:700;font-size:18px;color:var(--cyan);">${attended}</span></td>
        <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
        <td>${contractHtml}</td>
        <td>${actionBtn}</td>
      </tr>`;

      return {
        id: user.id, name, email: user.email || '', phone: user.phone || null,
        statusLabel, planName: planName || '', rowHtml,
        initials, bg, fg, attended, hasContract, endDateStr,
        identification: user.identification || null,
        birthDate: user.birth_date ? String(user.birth_date).slice(0, 10) : null,
        address: user.address || null,
        emergencyContactName: user.emergency_contact_name || null,
        emergencyContactPhone: user.emergency_contact_phone || null,
        isDebtor: !!user.is_debtor,
        debtBalance: user.debt_balance_cop || null,
        debtReason: user.debt_reason || null,
        notes: user.notes || null,
        registeredAt: user.registered_at || null,
        receivesEmails: user.receives_emails !== false,
        fingerprintRegistered: !!user.fingerprint_registered,
        membershipId:           membership?.id                        || null,
        membershipPlanId:       membership?.plan_id                   || null,
        startDate:              membership?.start_date ? String(membership.start_date).slice(0, 10) : null,
        endDateRaw:             membership?.end_date   ? String(membership.end_date).slice(0, 10)   : null,
        suspendedReason:        membership?.suspended_reason || null,
        pilatesClassesUsed:      membership?.pilates_classes_used       ?? 0,
        pilatesClassesIncluded:  membership?.pilates_classes_included   ?? 0,
        tiqueteraSessionsUsed:   membership?.tiquetera_sessions_used    ?? 0,
        tiqueteraSessionsIncluded: membership?.tiquetera_sessions_included ?? 0,
        pilatesClassesPerMonth:  membership?.plans?.pilates_classes_per_month ?? 0,
      };
    });

  _adminUsuariosAll.push(...newEntries);
  _usuariosPage = page;

  const allLoadedPlans = new Set(_adminUsuariosAll.map(u => u.planName).filter(Boolean));
  _buildUsuariosPlanChips([...allLoadedPlans].sort());

  if (page === 0) {
    document.querySelectorAll('.uf-chip-status').forEach(c =>
      c.classList.toggle('uf-chip-active', c.dataset.status === 'TODOS')
    );
  }

  _applyUsuariosFilters();
  _updateLoadMoreBtn();
}

async function loadMoreUsuarios() {
  if (_usuariosLoadingMore || !_usuariosHasMore) return;
  _usuariosLoadingMore = true;
  const btn = document.getElementById('usuarios-load-more-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="opacity:0.6;">Cargando...</span>'; }
  try {
    await _fetchUsuariosPage(_usuariosPage + 1);
  } catch (err) {
    toast('Error', 'No se pudo cargar más usuarios');
    _updateLoadMoreBtn();
  } finally {
    _usuariosLoadingMore = false;
  }
}

function _updateLoadMoreBtn() {
  const btn = document.getElementById('usuarios-load-more-btn');
  if (!btn) return;
  if (!_usuariosHasMore) { btn.style.display = 'none'; return; }
  const loaded    = _adminUsuariosAll.length;
  const remaining = _usuariosTotalCount - loaded;
  btn.style.display = 'inline-flex';
  btn.disabled      = false;
  btn.innerHTML     = `Cargar ${Math.min(_USUARIOS_PAGE_SIZE, remaining)} más <span style="opacity:0.55;font-size:11px;margin-left:6px;">${loaded} / ${_usuariosTotalCount}</span>`;
}


async function _loadUsuariosFiltered() {
  if (_usuariosLoadingFiltered) return;
  _usuariosLoadingFiltered = true;

  const tbody = document.getElementById('admin-usuarios-tbody');
  if (tbody) tbody.innerHTML = _loaderRow(9);

  try {
    // Fetch ALL users + memberships in one shot (no range limit)
    const { data: allUsers, error: usersError } = await db
      .from('users')
      .select('id, full_name, email, phone, identification, birth_date, address, emergency_contact_name, emergency_contact_phone, is_debtor, debt_balance_cop, debt_reason, notes, registered_at, receives_emails, fingerprint_registered, memberships!user_id(id, plan_id, start_date, end_date, status, suspended_reason, pilates_classes_used, pilates_classes_included, tiquetera_sessions_used, tiquetera_sessions_included, plans(name, pilates_classes_per_month))')
      .eq('role', 'user')
      .order('full_name');

    if (usersError) throw usersError;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in5Days  = new Date(today); in5Days.setDate(in5Days.getDate() + 5);
    const ago7Days = new Date(today); ago7Days.setDate(ago7Days.getDate() - 7);

    const q            = (document.getElementById('usuarios-search')?.value || '').toLowerCase().trim();
    const statusFilter = _usuariosFilterStatus;
    const planFilter   = _usuariosFilterPlan;

    // Compute statuses + identify which users match the active filters
    const computed = (allUsers || []).map(user => {
      const mems       = user.memberships || [];
      const membership = _pickCurrentMembership(mems);
      const planName   = membership?.plans?.name || null;

      let statusLabel, statusBadge;
      if (!membership || !membership.end_date) {
        statusLabel = 'Sin membresía'; statusBadge = 'badge-muted';
      } else if (membership.status === 'suspended') {
        // VOIDED de Wompi (ver void_payment_and_suspend_membership()) — pisa la fecha,
        // una membresía suspendida por fraude no debe verse "Activa" solo porque su
        // end_date todavía no pasó.
        statusLabel = 'Suspendida'; statusBadge = 'badge-red';
      } else {
        const endDate = parseLocalDate(membership.end_date);
        if      (endDate < ago7Days) { statusLabel = 'Desertor';   statusBadge = 'badge-desertor'; }
        else if (endDate < today)    { statusLabel = 'Vencido';    statusBadge = 'badge-red';      }
        else if (endDate <= in5Days) { statusLabel = 'Por vencer'; statusBadge = 'badge-amber';    }
        else                         { statusLabel = 'Activo';     statusBadge = 'badge-green';    }
      }

      const name = user.full_name || user.email || '?';
      const matches = (
        (statusFilter === 'TODOS' || statusLabel === statusFilter) &&
        (planFilter   === 'TODOS' || planName   === planFilter)   &&
        (!q || name.toLowerCase().includes(q) || (user.email || '').toLowerCase().includes(q) || (user.identification || '').includes(q))
      );

      return { user, membership, planName, statusLabel, statusBadge, name, matches };
    });

    // Fetch attendance + contracts ONLY for users matching the active filter
    const matchingIds = computed.filter(c => c.matches).map(c => c.user.id);

    const [attendanceRes, contractsRes] = await Promise.all([
      matchingIds.length
        ? db.from('attendance').select('user_id').in('user_id', matchingIds)
        : Promise.resolve({ data: [] }),
      matchingIds.length
        ? db.from('contract_acceptances').select('user_id').in('user_id', matchingIds)
        : Promise.resolve({ data: [] }),
    ]);

    const attendanceCount = {};
    (attendanceRes.data || []).forEach(a => {
      attendanceCount[a.user_id] = (attendanceCount[a.user_id] || 0) + 1;
    });
    const contractMap = {};
    (contractsRes.data || []).forEach(c => { contractMap[c.user_id] = true; });

    // Build full _adminUsuariosAll (all users, attendance reliable only for matching)
    const planNames = new Set();

    _adminUsuariosAll = computed.map(({ user, membership, planName, statusLabel, statusBadge, name }) => {
      if (planName) planNames.add(planName);

      const attended    = attendanceCount[user.id] || 0;
      const hasContract = !!contractMap[user.id];

      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
      const colorKey = ciColorKeys[name.charCodeAt(0) % ciColorKeys.length];
      const bg       = ciColorBg[colorKey];
      const fg       = ciColorFg[colorKey];

      const actionBtn = (statusLabel === 'Por vencer' || statusLabel === 'Vencido' || statusLabel === 'Desertor')
        ? `<div style="display:flex;gap:6px;"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();notificarVencimiento('${user.id}',this)">Notif.</button><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎</button></div>`
        : `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎ Editar</button>`;

      const endDateStr   = membership?.end_date ? _formatDate(membership.end_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const endDateStyle = statusLabel === 'Vencido' ? 'color:var(--red);' : statusLabel === 'Desertor' ? 'color:#9c3a50;' : '';
      const planBadge    = planName ? `<span class="badge badge-cyan">${planName}</span>` : `<span class="badge badge-muted">—</span>`;
      const contractHtml = hasContract
        ? `<span class="contract-icon contract-ok" title="Contrato aceptado">✓</span>`
        : `<span class="contract-icon contract-pending" title="Contrato pendiente">✗</span>`;

      const rowHtml = `<tr style="cursor:pointer;" onclick="openUserDetailModal('${user.id}')">
        <td><div class="stream-avatar" style="width:32px;height:32px;background:${bg};color:${fg};font-family:'Outfit';font-weight:700;font-size:13px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${initials}</div></td>
        <td><div style="font-weight:500;">${name}</div><div style="font-size:11px;color:var(--muted);">${user.email || '—'}</div></td>
        <td style="color:var(--muted);font-size:13px;">${user.phone || '—'}</td>
        <td>${planBadge}</td>
        <td style="${endDateStyle}">${endDateStr}</td>
        <td><span style="font-family:'Outfit';font-weight:700;font-size:18px;color:var(--cyan);">${attended}</span></td>
        <td><span class="badge ${statusBadge}">${statusLabel}</span></td>
        <td>${contractHtml}</td>
        <td>${actionBtn}</td>
      </tr>`;

      return {
        id: user.id, name, email: user.email || '', phone: user.phone || null,
        statusLabel, planName: planName || '', rowHtml,
        initials, bg, fg, attended, hasContract, endDateStr,
        identification: user.identification || null,
        birthDate: user.birth_date ? String(user.birth_date).slice(0, 10) : null,
        address: user.address || null,
        emergencyContactName: user.emergency_contact_name || null,
        emergencyContactPhone: user.emergency_contact_phone || null,
        isDebtor: !!user.is_debtor,
        debtBalance: user.debt_balance_cop || null,
        debtReason: user.debt_reason || null,
        notes: user.notes || null,
        registeredAt: user.registered_at || null,
        receivesEmails: user.receives_emails !== false,
        fingerprintRegistered: !!user.fingerprint_registered,
        membershipId:           membership?.id                        || null,
        membershipPlanId:       membership?.plan_id                   || null,
        startDate:              membership?.start_date ? String(membership.start_date).slice(0, 10) : null,
        endDateRaw:             membership?.end_date   ? String(membership.end_date).slice(0, 10)   : null,
        suspendedReason:        membership?.suspended_reason || null,
        pilatesClassesUsed:        membership?.pilates_classes_used          ?? 0,
        pilatesClassesIncluded:    membership?.pilates_classes_included      ?? 0,
        tiqueteraSessionsUsed:     membership?.tiquetera_sessions_used       ?? 0,
        tiqueteraSessionsIncluded: membership?.tiquetera_sessions_included   ?? 0,
        pilatesClassesPerMonth:    membership?.plans?.pilates_classes_per_month ?? 0,
      };
    });

    _usuariosAllLoaded  = true;
    _usuariosTotalCount = _adminUsuariosAll.length;
    _usuariosHasMore    = false;

    _buildUsuariosPlanChips([...planNames].sort());
    _applyUsuariosFilters();
    _updateLoadMoreBtn();

  } catch (err) {
    const t = document.getElementById('admin-usuarios-tbody');
    if (t) t.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--red);">Error al cargar usuarios: ${err.message || 'Intenta de nuevo'}</td></tr>`;
  } finally {
    _usuariosLoadingFiltered = false;
  }
}

function _buildUsuariosPlanChips(plans) {
  const container = document.getElementById('usuarios-plan-chips');
  if (!container) return;
  container.innerHTML = '<span style="font-size:11px;color:var(--muted);letter-spacing:1px;min-width:52px;">PLAN</span>';
  // This rebuilds the whole chip list from scratch (plan names come from whatever data
  // was just loaded, unlike the fixed ESTADO chip set) — it must mark whichever plan is
  // currently selected as active, not hardcode 'TODOS', or every reload (which happens
  // on every filter change, including selecting a plan) visually resets the selection
  // back to TODOS even though _usuariosFilterPlan — and the actual filtering — still
  // correctly reflects the chosen plan.
  ['TODOS', ...plans].forEach(plan => {
    const btn = document.createElement('button');
    btn.className = 'uf-chip uf-chip-plan' + (plan === _usuariosFilterPlan ? ' uf-chip-active' : '');
    btn.dataset.plan = plan;
    btn.textContent = plan.toUpperCase();
    btn.onclick = () => _setUsuariosPlan(plan);
    container.appendChild(btn);
  });
}

function _setUsuariosStatus(status) {
  _usuariosFilterStatus = status;
  document.querySelectorAll('.uf-chip-status').forEach(c =>
    c.classList.toggle('uf-chip-active', c.dataset.status === status)
  );
  const anyFilter = _usuariosFilterStatus !== 'TODOS' || _usuariosFilterPlan !== 'TODOS';
  if (anyFilter) {
    _loadUsuariosFiltered();
  } else if (_usuariosAllLoaded) {
    _applyUsuariosFilters();
  } else {
    loadAdminUsuariosPage();
  }
}

function _setUsuariosPlan(plan) {
  _usuariosFilterPlan = plan;
  document.querySelectorAll('.uf-chip-plan').forEach(c =>
    c.classList.toggle('uf-chip-active', c.dataset.plan === plan)
  );
  const anyFilter = _usuariosFilterStatus !== 'TODOS' || _usuariosFilterPlan !== 'TODOS';
  if (anyFilter) {
    _loadUsuariosFiltered();
  } else if (_usuariosAllLoaded) {
    _applyUsuariosFilters();
  } else {
    loadAdminUsuariosPage();
  }
}

function _applyUsuariosFilters() {
  const q = (document.getElementById('usuarios-search')?.value || '').toLowerCase().trim();

  // If searching and not all users loaded yet, trigger a full server load
  if (q.length >= 2 && !_usuariosAllLoaded && !_usuariosLoadingFiltered) {
    _loadUsuariosFiltered();
    return;
  }

  const filtered = _adminUsuariosAll.filter(u => {
    if (_usuariosFilterStatus !== 'TODOS' && u.statusLabel !== _usuariosFilterStatus) return false;
    if (_usuariosFilterPlan   !== 'TODOS' && u.planName   !== _usuariosFilterPlan)   return false;
    if (q && !u.name.toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q) && !(u.identification || '').includes(q)) return false;
    return true;
  });

  const tbody = document.getElementById('admin-usuarios-tbody');
  if (tbody) {
    tbody.innerHTML = filtered.length
      ? filtered.map(u => u.rowHtml).join('')
      : '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted);">Sin resultados para los filtros seleccionados</td></tr>';
  }

  const activeInView = filtered.filter(u => u.statusLabel === 'Activo' || u.statusLabel === 'Por vencer').length;
  const plansInView  = new Set(filtered.map(u => u.planName).filter(Boolean)).size;
  const activeEl     = document.getElementById('usuarios-count-active');
  const plansEl      = document.getElementById('usuarios-count-plans');
  if (activeEl) activeEl.textContent = activeInView;
  if (plansEl)  plansEl.textContent  = plansInView;

  const subEl = document.querySelector('#page-admin-usuarios .page-sub');
  if (subEl) {
    const loaded = _adminUsuariosAll.length;
    const total  = _usuariosTotalCount || loaded;
    subEl.innerHTML = loaded < total
      ? `${activeInView} activos · <span style="color:var(--amber);">${loaded} de ${total} cargados</span>`
      : `${activeInView} miembros activos · ${plansInView} planes distintos`;
  }
}


// ── User detail modal ────────────────────────────────────────
let _udpCurrentUser = null;
let _udpEditMode    = false;
let _udpPlansCache  = null;
// True once the receptionist has typed directly into the end-date field this edit
// session — once set, changing the start date no longer silently overwrites it (only an
// explicit plan change does, since that's the one action that should reset the duration).
let _udpEndDateManuallyEdited = false;

function openUserDetailModal(userId) {
  const user = _adminUsuariosAll.find(u => u.id === userId);
  if (!user) return;
  _udpCurrentUser = user;
  _udpEditMode    = false;

  const avatarEl = document.getElementById('udp-avatar-el');
  if (avatarEl) { avatarEl.style.background = user.bg; avatarEl.style.color = user.fg; }
  const initEl = document.getElementById('udp-avatar-initials');
  if (initEl) initEl.textContent = user.initials;

  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('udp-name',  user.name);
  setText('udp-email', user.email || '—');

  const badge = document.getElementById('udp-status-badge');
  if (badge) {
    badge.textContent = user.statusLabel;
    badge.className   = 'badge ' + _statusBadgeClass(user.statusLabel);
  }

  // Personal
  setText('udp-identification',  user.identification || '—');
  setText('udp-birth-date',      user.birthDate ? _formatDate(user.birthDate) : '—');
  setText('udp-phone',           user.phone || '—');
  setText('udp-address',         user.address || '—');
  setText('udp-registered-at',   user.registeredAt ? _formatDate(user.registeredAt) : '—');
  setText('udp-receives-emails', user.receivesEmails ? 'Sí' : 'No');
  setText('udp-fingerprint',     user.fingerprintRegistered ? 'Registrada' : 'Pendiente');
  setText('udp-notes',           user.notes || '—');

  // Membresía
  setText('udp-plan',         user.planName || '—');
  setText('udp-start-date',   user.startDate  ? _formatDate(user.startDate,  { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  setText('udp-end-date',     user.endDateStr || '—');
  setText('udp-attendance',   String(user.attended));
  setText('udp-contract',     user.hasContract ? 'Aceptado' : 'Pendiente');
  setText('udp-is-debtor',    user.isDebtor ? 'Sí' : 'No');
  setText('udp-debt-balance', user.debtBalance ? _formatCOP(user.debtBalance) : '—');
  setText('udp-debt-reason',  user.debtReason || '—');

  // Emergencia
  setText('udp-emergency-name',  user.emergencyContactName  || '—');
  setText('udp-emergency-phone', user.emergencyContactPhone || '—');

  // Credenciales — admin-only (restored 2026-07-06, narrower than the original
  // admin+reception scope — see 20260706_credential_vault.sql)
  const _udpCredSection = document.getElementById('udp-credenciales-section');
  if (_udpCredSection) {
    const canSeeCred = currentUser?.role === 'admin';
    _udpCredSection.style.display = canSeeCred ? '' : 'none';
    if (canSeeCred) {
      const loginEl = document.getElementById('udp-cred-login');
      if (loginEl) loginEl.textContent = user.identification || user.email || '—';
      _credResetSectionState('udp');
    }
  }

  _udpShowTab('personal');
  const _eBtn = document.getElementById('udp-edit-btn');
  const _aEl  = document.getElementById('udp-actions');
  const _sBtn = document.getElementById('udp-save-btn');
  if (_eBtn) _eBtn.style.display = '';
  if (_aEl)  _aEl.style.display  = 'none';
  if (_sBtn) { _sBtn.disabled = false; _sBtn.textContent = 'Guardar cambios'; }
  _udpUpdateBanner(user);
  _renderPilatesTracker(user);
  _renderTiqueteraTracker(user);
  _renderMonthlyClassUsage(user);
  _renderAttendanceHistory(user.id);
  _renderPaymentsHistory(user);
  document.getElementById('user-detail-modal').classList.add('visible');
}

function _statusBadgeClass(statusLabel) {
  const map = { 'Activo': 'badge-green', 'Por vencer': 'badge-amber', 'Vencido': 'badge-red', 'Desertor': 'badge-desertor', 'Suspendida': 'badge-red' };
  return map[statusLabel] || 'badge-muted';
}

async function _renderAttendanceHistory(userId) {
  const el = document.getElementById('udp-historial-content');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">Cargando historial...</div>';

  const { data, error } = await db
    .from('attendance_records')
    .select('id, checked_in_at, method')
    .eq('user_id', userId)
    .order('checked_in_at', { ascending: false })
    .limit(200);

  if (error) {
    el.innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px 0;">${error.message}</div>`;
    return;
  }

  if (!data?.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0;">Sin registros de asistencia al gimnasio</div>';
    return;
  }

  // Count unique calendar days in Bogotá time (UTC-5)
  const BOGOTA_MS  = 5 * 60 * 60 * 1000;
  const uniqueDays = new Set(
    data.map(r => new Date(new Date(r.checked_in_at).getTime() - BOGOTA_MS).toISOString().split('T')[0])
  );
  const last10 = data.slice(0, 10);

  el.innerHTML = `
    <div style="display:flex;align-items:center;padding:12px 0 14px;border-bottom:1px solid var(--border2);margin-bottom:14px;">
      <div style="flex:1;">
        <div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted2);margin-bottom:3px;">Días únicos asistidos</div>
        <div style="font-size:28px;font-weight:800;font-family:'Outfit',sans-serif;color:var(--cyan);">${uniqueDays.size}</div>
      </div>
      <div style="font-size:11px;color:var(--muted2);">Últimos ${last10.length} registros</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;">
      ${last10.map(r => {
        const ts    = new Date(r.checked_in_at);
        const fecha = ts.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
        const hora  = ts.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--card2);border:1px solid var(--border);border-radius:8px;">
          <span style="font-size:13px;">${fecha}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--muted2);font-family:'Outfit',sans-serif;">${hora}</span>
            ${_methodBadge(r.method)}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

// Historial de pagos — panel admin (tab Membresía). El botón de descarga solo
// aparece en filas con receipt_number (pagos en efectivo/transferencia registrados
// por este módulo) — un pago de Wompi no tiene desprendible propio de este flujo.
async function _renderPaymentsHistory(user) {
  const el = document.getElementById('udp-payments-history');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0;">Cargando historial...</div>';

  const { data, error } = await db
    .from('payments')
    .select('id, amount_cop, method, status, paid_at, created_at, transaction_number, receipt_number, period_start, period_end, needs_review, plans(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    el.innerHTML = `<div style="color:var(--red);font-size:13px;padding:12px 0;">${error.message}</div>`;
    return;
  }
  if (!data?.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px 0;">Sin pagos registrados</div>';
    return;
  }

  // Cache por id — evita tener que serializar el objeto completo dentro de un onclick.
  window._udpPaymentsCache = {};
  const badge = {
    approved: '<span class="badge badge-green">Pagado</span>',
    pending:  '<span class="badge badge-amber">Pendiente</span>',
    declined: '<span class="badge badge-red">Fallido</span>',
    voided:   '<span class="badge badge-muted">Anulado</span>',
  };

  el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;">
    ${data.map(p => {
      window._udpPaymentsCache[p.id] = { ...p, userName: user.name, userIdentification: user.identification, planName: p.plans?.name };
      const dateRef = p.paid_at || p.created_at;
      const date    = _formatDate(dateRef, { day: 'numeric', month: 'short', year: 'numeric' });
      const amount  = _formatCOPFull(p.amount_cop);
      const method  = p.method ? `<span style="color:var(--muted2);font-size:10px;letter-spacing:1px;text-transform:uppercase;">${p.method}</span>` : '';
      const dlBtn   = p.receipt_number
        ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();_udpDescargarDesprendible('${p.id}')">⬇ ${p.receipt_number}</button>`
        : '';
      // needs_review: pago sin resolver por 24h+ (ver reconcile_wompi_payments()) —
      // nunca se marca abandonado solo; una persona lo cierra a mano después de
      // confirmar el estado real en el dashboard de Wompi.
      const reviewBadge = p.needs_review
        ? `<span class="badge badge-amber" title="Sin resolver después de 24h — confirma el estado real en Wompi">⚠ Por revisar</span>
           <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();_udpResolveNeedsReview('${p.id}')">Marcar revisado</button>`
        : '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:var(--card2);border:1px solid var(--border);border-radius:8px;flex-wrap:wrap;">
        <div>
          <div style="font-size:13px;font-weight:600;">${p.plans?.name || '—'} · ${amount}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${date} ${method}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${badge[p.status] || `<span class="badge">${p.status}</span>`}
          ${reviewBadge}
          ${dlBtn}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function _udpDescargarDesprendible(paymentId) {
  const payment = window._udpPaymentsCache?.[paymentId];
  if (!payment) return;
  descargarDesprendiblePago(payment);
}

async function _udpResolveNeedsReview(paymentId) {
  try {
    const { error } = await db.rpc('resolve_payment_needs_review', { p_payment_id: paymentId });
    if (error) throw error;
    toast('Revisado', 'El pago ya no aparece como pendiente de revisión');
    if (_udpCurrentUser) _renderPaymentsHistory(_udpCurrentUser);
  } catch (err) {
    toast('Error', err.message || 'No se pudo marcar como revisado');
  }
}

function _udpUpdateBanner(user) {
  const checks = [
    { val: user.email,                 label: 'correo' },
    { val: user.phone,                 label: 'teléfono' },
    { val: user.address,               label: 'dirección' },
    { val: user.birthDate,             label: 'fecha de nacimiento' },
    { val: user.emergencyContactName,  label: 'contacto de emergencia' },
    { val: user.emergencyContactPhone, label: 'teléfono de emergencia' },
  ];
  const missing = checks.filter(c => !c.val).map(c => c.label);
  const el = document.getElementById('udp-incomplete-banner');
  if (!el) return;
  if (missing.length) {
    el.textContent = `⚠️ Perfil incompleto: faltan ${missing.join(', ')}`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

function _renderPilatesTracker(user) {
  const container = document.getElementById('udp-pilates-tracker');
  if (!container) return;

  const included = user.pilatesClassesIncluded || 0;
  if (!included) { container.style.display = 'none'; return; }

  const used    = user.pilatesClassesUsed || 0;
  const memId   = user.membershipId;
  const boxes   = Array.from({ length: included }, (_, i) => {
    const isUsed = i < used;
    const icon   = isUsed ? '✅' : '⬜';
    return `<span style="cursor:pointer;font-size:15px;margin-right:14px;user-select:none;"
      onclick="togglePilatesClass('${memId}',${i + 1},${!isUsed})"
      title="${isUsed ? 'Desmarcar clase' : 'Marcar clase como usada'}">${icon} Clase ${i + 1}</span>`;
  }).join('');

  const remaining = included - used;
  const badge = remaining <= 0
    ? `<span class="badge badge-green" style="font-size:11px;">✅ Beneficio completo</span>`
    : `<span class="badge badge-amber" style="font-size:11px;">🟡 ${remaining} clase${remaining !== 1 ? 's' : ''} disponible${remaining !== 1 ? 's' : ''}</span>`;

  container.style.display = '';
  container.innerHTML = `
    <div style="padding:12px 0;border-top:1px solid var(--border);margin-top:4px;">
      <div style="font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Clases de Pilates este mes</div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
        ${boxes}
        ${badge}
      </div>
    </div>`;
}

async function togglePilatesClass(membershipId, classNum, markAsUsed) {
  const user = _udpCurrentUser;
  if (!user || !membershipId) return;

  const included = user.pilatesClassesIncluded || 0;
  const curUsed  = user.pilatesClassesUsed     || 0;
  const newUsed  = markAsUsed
    ? Math.min(included, curUsed + 1)
    : Math.max(0, curUsed - 1);

  const { error } = await db.from('memberships')
    .update({ pilates_classes_used: newUsed })
    .eq('id', membershipId);

  if (error) { toast('Error', error.message); return; }

  user.pilatesClassesUsed = newUsed;
  _renderPilatesTracker(user);
}

function _renderTiqueteraTracker(user) {
  const container = document.getElementById('udp-tiquetera-tracker');
  if (!container) return;

  const included = user.tiqueteraSessionsIncluded || 0;
  if (!included) { container.style.display = 'none'; return; }

  const used  = user.tiqueteraSessionsUsed || 0;
  const memId = user.membershipId;
  container.style.display = '';
  container.innerHTML = `
    <div style="padding:14px 0 4px;border-top:1px solid var(--border);margin-top:10px;">
      <div style="font-size:11px;letter-spacing:1px;color:var(--muted);margin-bottom:8px;">TIQUETERA · SESIONES</div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <span style="font-size:22px;font-family:'Outfit';font-weight:700;color:var(--cyan);">${used}<span style="font-size:14px;color:var(--muted);font-weight:400;">/${included}</span></span>
        <span style="font-size:12px;color:var(--muted);">sesiones usadas</span>
        ${memId ? `<button class="btn btn-ghost btn-sm" onclick="toggleTiqueteraSession('${memId}',true)" ${used >= included ? 'disabled' : ''}>Usar sesión</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleTiqueteraSession('${memId}',false)" ${used <= 0 ? 'disabled' : ''}>↩ Deshacer</button>` : ''}
      </div>
    </div>`;
}

async function toggleTiqueteraSession(membershipId, markAsUsed) {
  const user = _udpCurrentUser;
  if (!user || !membershipId) return;

  const included = user.tiqueteraSessionsIncluded || 0;
  const curUsed  = user.tiqueteraSessionsUsed     || 0;
  const newUsed  = markAsUsed
    ? Math.min(included, curUsed + 1)
    : Math.max(0, curUsed - 1);

  const { error } = await db.from('memberships')
    .update({ tiquetera_sessions_used: newUsed })
    .eq('id', membershipId);

  if (error) { toast('Error', error.message); return; }

  user.tiqueteraSessionsUsed = newUsed;
  _renderTiqueteraTracker(user);
}

// Fase 4.5: monthly pilates allowance ("clases mensuales de pilates") — separate from the
// lifetime pilates/tiquetera pools rendered above by _renderPilatesTracker/
// _renderTiqueteraTracker. Read-only: rows in membership_class_usage are written exclusively
// by seal_past_class_occurrences() (supabase/migrations/20260820_class_allowance_tracking.sql)
// once a class occurrence is sealed, so there is nothing to toggle here, only to display.
// Called fire-and-forget (like _renderAttendanceHistory) right after the modal opens
// synchronously with its other, already-cached fields.
async function _renderMonthlyClassUsage(user) {
  const container = document.getElementById('udp-monthly-class-usage');
  if (!container) return;

  const included = user.pilatesClassesPerMonth || 0;
  if (!included || !user.membershipId) { container.style.display = 'none'; return; }

  const yearMonth = _bogotaToday().slice(0, 7);
  const { data, error } = await db
    .from('membership_class_usage')
    .select('classes_used')
    .eq('membership_id', user.membershipId)
    .eq('year_month', yearMonth)
    .maybeSingle();

  // The admin may have navigated to a different member's detail while this was in flight —
  // don't paint stale data into whatever is showing now.
  if (_udpCurrentUser !== user || error) {
    if (error) container.style.display = 'none';
    return;
  }

  const used      = data?.classes_used || 0;
  const remaining = included - used;
  const badge = remaining > 0
    ? `<span class="badge badge-green" style="font-size:11px;">${remaining} clase${remaining !== 1 ? 's' : ''} disponible${remaining !== 1 ? 's' : ''}</span>`
    : `<span class="badge badge-red" style="font-size:11px;">Sin clases disponibles este mes</span>`;

  container.style.display = '';
  container.innerHTML = `
    <div style="padding:12px 0;border-top:1px solid var(--border);margin-top:4px;">
      <div style="font-size:11px;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;">Clases de pilates este mes (${_escHtml(yearMonth)})</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:22px;font-family:'Outfit';font-weight:700;color:var(--cyan);">${used}<span style="font-size:14px;color:var(--muted);font-weight:400;">/${included}</span></span>
        ${badge}
      </div>
    </div>`;
}

function _udpShowTab(tab) {
  document.querySelectorAll('.udp-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.querySelectorAll('.udp-tab-panel').forEach(p =>
    p.classList.toggle('show', p.dataset.panel === tab)
  );
}

function closeUserDetailModal() {
  document.getElementById('user-detail-modal').classList.remove('visible');
}

// ===================== CREDENCIALES (admin-only) =====================
// Restored 2026-07-06 — shared by user-detail-modal (prefix='udp') and staff modal
// (prefix='emp'). Password is fetched on demand via the get_user_credential RPC
// (Vault-backed, admin-only, every successful call is atomically audit-logged
// server-side into credential_view_log) — never cached beyond the open modal,
// never sent anywhere except into this DOM node for the admin to read/copy.

function _credToggle(prefix) {
  const body  = document.getElementById(prefix + '-cred-body');
  const arrow = document.getElementById(prefix + '-cred-arrow');
  if (!body) return;
  const opening = body.style.display === 'none';
  body.style.display  = opening ? '' : 'none';
  if (arrow) arrow.textContent = opening ? '▾' : '▸';
}

function _credTargetUserId(prefix) {
  if (prefix === 'udp') return _udpCurrentUser?.id || null;
  const modal = document.getElementById('modal-perfil-empleado');
  return modal?._empId || null;
}

async function _credCopy(elementId) {
  const el = document.getElementById(elementId);
  const text = el?.textContent?.trim();
  if (!text || text === '—') { toast('Nada que copiar', 'No hay un valor visible todavía'); return; }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado', 'Valor copiado al portapapeles');
  } catch (e) {
    toast('Error al copiar', e.message || 'El navegador bloqueó el acceso al portapapeles');
  }
}

async function _credViewPassword(prefix) {
  const userId = _credTargetUserId(prefix);
  if (!userId) return;
  const wrap    = document.getElementById(prefix + '-cred-pw-display-wrap');
  const display = document.getElementById(prefix + '-cred-pw-display');
  try {
    const { data, error } = await db.rpc('get_user_credential', { target_user_id: userId });
    if (error) throw error;
    if (!data) { toast('Sin credencial registrada', 'Esta cuenta es anterior a esta función — restablece la contraseña para registrarla'); return; }
    if (display) display.textContent = data;
    if (wrap) wrap.style.display = 'flex';
  } catch (e) {
    toast('Error al ver contraseña', e.message || 'Intenta de nuevo');
  }
}

function _credShowResetForm(prefix) {
  const area    = document.getElementById(prefix + '-cred-reset-area');
  const form    = document.getElementById(prefix + '-cred-form');
  const success = document.getElementById(prefix + '-cred-success');
  const pw      = document.getElementById(prefix + '-cred-pw');
  const err     = document.getElementById(prefix + '-cred-pw-err');
  if (area)    area.style.display    = 'none';
  if (form)    form.style.display    = '';
  if (success) success.style.display = 'none';
  if (pw)      pw.value              = '';
  if (err)     err.textContent       = '';
}

function _credHideResetForm(prefix) {
  const area = document.getElementById(prefix + '-cred-reset-area');
  const form = document.getElementById(prefix + '-cred-form');
  if (area) area.style.display = '';
  if (form) form.style.display = 'none';
}

function _credValidatePw(prefix) {
  const pw  = document.getElementById(prefix + '-cred-pw')?.value || '';
  const err = document.getElementById(prefix + '-cred-pw-err');
  if (!err) return true;
  if (pw.length < 8)      { err.textContent = 'Mínimo 8 caracteres'; return false; }
  if (!/[A-Z]/.test(pw))  { err.textContent = 'Debe incluir al menos una mayúscula'; return false; }
  if (!/[0-9]/.test(pw))  { err.textContent = 'Debe incluir al menos un número'; return false; }
  err.textContent = '';
  return true;
}

async function _credSubmitReset(prefix, userId) {
  if (!_credValidatePw(prefix)) return;
  const pw      = document.getElementById(prefix + '-cred-pw')?.value || '';
  const saveBtn = document.getElementById(prefix + '-cred-save-btn');
  if (saveBtn) { saveBtn.textContent = 'Guardando…'; saveBtn.disabled = true; }
  try {
    const { data, error } = await db.functions.invoke('reset-user-password', {
      body: { user_id: userId, new_password: pw },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || 'Error al restablecer');

    const form    = document.getElementById(prefix + '-cred-form');
    const success = document.getElementById(prefix + '-cred-success');
    const wrap    = document.getElementById(prefix + '-cred-pw-display-wrap');
    if (form)    form.style.display    = 'none';
    if (success) success.style.display = '';
    if (wrap)    wrap.style.display    = 'none'; // stale password view, if any — force a fresh "Ver contraseña" click
  } catch (err) {
    const errEl = document.getElementById(prefix + '-cred-pw-err');
    if (errEl) errEl.textContent = err.message || 'Error al restablecer. Intenta de nuevo.';
  } finally {
    if (saveBtn) { saveBtn.textContent = 'Guardar'; saveBtn.disabled = false; }
  }
}

function _credDismissReset(prefix) {
  const success = document.getElementById(prefix + '-cred-success');
  const area    = document.getElementById(prefix + '-cred-reset-area');
  if (success) success.style.display = 'none';
  if (area)    area.style.display    = '';
}

function _credResetSectionState(prefix) {
  _credDismissReset(prefix);
  _credHideResetForm(prefix);
  const body  = document.getElementById(prefix + '-cred-body');
  const arrow = document.getElementById(prefix + '-cred-arrow');
  const wrap  = document.getElementById(prefix + '-cred-pw-display-wrap');
  if (body)  body.style.display  = 'none';
  if (arrow) arrow.textContent   = '▸';
  if (wrap)  wrap.style.display  = 'none';
}

// ─ Wrappers for onclick — need userId from modal-level state ─────────────────
function _udpSubmitReset() { _credSubmitReset('udp', _udpCurrentUser?.id); }
function _empSubmitReset() {
  const modal = document.getElementById('modal-perfil-empleado');
  _credSubmitReset('emp', modal?._empId);
}

async function _udpToggleEdit(on) {
  _udpEditMode = on;
  const editBtn   = document.getElementById('udp-edit-btn');
  const actionsEl = document.getElementById('udp-actions');
  if (editBtn)   editBtn.style.display   = on ? 'none' : '';
  if (actionsEl) actionsEl.style.display = on ? 'flex' : 'none';
  if (on) {
    if (!_udpPlansCache) {
      const { data } = await db.from('plans').select('id, name, duration_days, tiquetera_sessions, pilates_classes, pilates_classes_per_month, price_cop, is_active').order('name');
      // Deduplicate by name — keeps the first occurrence (lowest id after ORDER BY name)
      _udpPlansCache = Array.from(new Map((data || []).map(p => [p.name, p])).values());
    }
    _udpRenderInputs();
  } else {
    _udpRenderValues(_udpCurrentUser);
  }
}

function _udpRenderValues(user) {
  if (!user) return;
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const avatarEl = document.getElementById('udp-avatar-el');
  if (avatarEl) { avatarEl.style.background = user.bg; avatarEl.style.color = user.fg; }
  const initEl = document.getElementById('udp-avatar-initials');
  if (initEl) initEl.textContent = user.initials;
  const nameEl = document.getElementById('udp-name');
  if (nameEl) nameEl.textContent = user.name;
  const emailEl = document.getElementById('udp-email');
  if (emailEl) emailEl.textContent = user.email || '—';
  const badge = document.getElementById('udp-status-badge');
  if (badge) {
    badge.style.display = '';
    badge.textContent   = user.statusLabel;
    badge.className     = 'badge ' + _statusBadgeClass(user.statusLabel);
  }
  setText('udp-identification',  user.identification || '—');
  setText('udp-birth-date',      user.birthDate  ? _formatDate(user.birthDate) : '—');
  setText('udp-phone',           user.phone  || '—');
  setText('udp-address',         user.address || '—');
  setText('udp-registered-at',   user.registeredAt ? _formatDate(user.registeredAt) : '—');
  setText('udp-receives-emails', user.receivesEmails ? 'Sí' : 'No');
  setText('udp-fingerprint',     user.fingerprintRegistered ? 'Registrada' : 'Pendiente');
  setText('udp-notes',           user.notes || '—');
  setText('udp-plan',         user.planName || '—');
  setText('udp-start-date',   user.startDate  ? _formatDate(user.startDate,  { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  setText('udp-end-date',     user.endDateStr || '—');
  setText('udp-attendance',   String(user.attended));
  setText('udp-contract',     user.hasContract ? 'Aceptado' : 'Pendiente');
  setText('udp-is-debtor',    user.isDebtor ? 'Sí' : 'No');
  setText('udp-debt-balance', user.debtBalance ? _formatCOP(user.debtBalance) : '—');
  setText('udp-debt-reason',  user.debtReason || '—');
  setText('udp-emergency-name',  user.emergencyContactName  || '—');
  setText('udp-emergency-phone', user.emergencyContactPhone || '—');
  const suspWrap = document.getElementById('udp-suspendida-wrap');
  if (suspWrap) {
    const isSuspended = user.statusLabel === 'Suspendida';
    suspWrap.style.display = isSuspended ? '' : 'none';
    if (isSuspended) setText('udp-suspendida-reason', user.suspendedReason || 'Sin motivo registrado.');
  }
  _udpUpdateBanner(user);
  _renderPilatesTracker(user);
  _renderTiqueteraTracker(user);
  _renderMonthlyClassUsage(user);
}

// fromPlanChange=true (plan <select> changed): always recalculates and treats the new
// value as the fresh baseline, since a plan change is a deliberate action that should
// override whatever was in the field. fromPlanChange=false (start-date input changed):
// skips recalculating once the receptionist has manually typed an end date this edit
// session — otherwise adjusting the start date (e.g. backdating) silently threw away a
// custom end date she'd already set, and the wrong auto-calculated one got saved instead.
function _udpAutoCalcEndDate(fromPlanChange) {
  const planSel  = document.getElementById('udp-plan-inp');
  const startInp = document.getElementById('udp-start-date-inp');
  const endInp   = document.getElementById('udp-end-date-inp');
  if (!planSel || !startInp || !endInp) return;
  if (!fromPlanChange && _udpEndDateManuallyEdited) return;
  const plan = (_udpPlansCache || []).find(p => p.name === planSel.value);
  if (!plan?.duration_days) return;
  // Day-pass: auto-set start to today when it's empty
  if (plan.duration_days === 1 && !startInp.value) {
    startInp.value = _bogotaToday();
  }
  if (!startInp.value) return;
  if (fromPlanChange) _udpEndDateManuallyEdited = false;
  const [y, m, d] = startInp.value.split('-').map(Number);
  const end = new Date(y, m - 1, d + plan.duration_days - 1);
  const pad = n => String(n).padStart(2, '0');
  endInp.value = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

function _udpRenderInputs() {
  const user = _udpCurrentUser;
  if (!user) return;
  const setInput = (id, type, rawVal) => {
    const el = document.getElementById(id);
    if (!el) return;
    const inp = document.createElement('input');
    inp.className = 'udp-input'; inp.type = type; inp.id = id + '-inp';
    // For date inputs, normalize ISO timestamps to YYYY-MM-DD to prevent UTC-offset day shift
    const strVal = rawVal != null ? String(rawVal) : '';
    inp.value = type === 'date' ? strVal.slice(0, 10) : strVal;
    el.innerHTML = ''; el.appendChild(inp);
  };
  const setSelect = (id, options, currentVal) => {
    const el = document.getElementById(id);
    if (!el) return;
    const sel = document.createElement('select');
    sel.className = 'udp-select'; sel.id = id + '-inp';
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.text = o.label;
      opt.selected = String(o.value) === String(currentVal);
      sel.appendChild(opt);
    });
    el.innerHTML = ''; el.appendChild(sel);
  };
  const setTextarea = (id, rawVal) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ta = document.createElement('textarea');
    ta.className = 'udp-textarea'; ta.id = id + '-inp'; ta.value = rawVal || '';
    el.innerHTML = ''; el.appendChild(ta);
  };

  // Header — editable name + email
  const nameEl = document.getElementById('udp-name');
  if (nameEl) {
    const inp = document.createElement('input');
    inp.className = 'udp-input'; inp.type = 'text'; inp.value = user.name || '';
    inp.id = 'udp-name-inp'; inp.style.cssText = 'font-size:15px;font-weight:600;';
    nameEl.innerHTML = ''; nameEl.appendChild(inp);
  }
  const emailEl = document.getElementById('udp-email');
  if (emailEl) {
    const inp = document.createElement('input');
    inp.className = 'udp-input'; inp.type = 'email'; inp.value = user.email || '';
    inp.id = 'udp-email-inp'; inp.style.cssText = 'font-size:12px;margin-top:2px;';
    emailEl.innerHTML = ''; emailEl.appendChild(inp);
  }
  const badge = document.getElementById('udp-status-badge');
  if (badge) badge.style.display = 'none';

  // Personal
  setInput('udp-identification', 'text', user.identification);
  setInput('udp-birth-date',     'date', user.birthDate);
  setInput('udp-phone',          'text', user.phone);
  setInput('udp-address',        'text', user.address);
  setSelect('udp-receives-emails',
    [{ value: 'true', label: 'Sí' }, { value: 'false', label: 'No' }],
    String(user.receivesEmails));
  setSelect('udp-fingerprint',
    [{ value: 'true', label: 'Registrada' }, { value: 'false', label: 'Pendiente' }],
    String(user.fingerprintRegistered));
  setTextarea('udp-notes', user.notes);

  // Membresía
  const planOpts = [
    { value: '', label: '— Sin plan —' },
    ...(_udpPlansCache || []).map(p => ({ value: p.name, label: p.name }))
  ];
  setSelect('udp-plan', planOpts, user.planName || '');
  setInput('udp-start-date', 'date', user.startDate);
  setInput('udp-end-date',   'date', user.endDateRaw);
  // Auto-calculate end date when plan or start date changes — a fresh edit session
  // starts with no manual end-date edit recorded yet.
  _udpEndDateManuallyEdited = false;
  document.getElementById('udp-plan-inp')?.addEventListener('change', () => _udpAutoCalcEndDate(true));
  document.getElementById('udp-start-date-inp')?.addEventListener('input', () => _udpAutoCalcEndDate(false));
  document.getElementById('udp-end-date-inp')?.addEventListener('input', () => { _udpEndDateManuallyEdited = true; });
  setSelect('udp-is-debtor',
    [{ value: 'false', label: 'No' }, { value: 'true', label: 'Sí' }],
    String(user.isDebtor));
  setInput('udp-debt-balance', 'number', user.debtBalance);
  setInput('udp-debt-reason',  'text',   user.debtReason);

  // Emergencia
  setInput('udp-emergency-name',  'text', user.emergencyContactName);
  setInput('udp-emergency-phone', 'text', user.emergencyContactPhone);
}

async function _saveUserDetail() {
  const user = _udpCurrentUser;
  if (!user) return;

  const getInp = id => { const el = document.getElementById(id + '-inp'); return el ? (el.value.trim() || null) : null; };
  const getBool = id => { const el = document.getElementById(id + '-inp'); return el ? (el.value === 'true') : null; };

  const fullName  = getInp('udp-name')  || user.name;
  const email     = getInp('udp-email') || user.email;
  const identif   = getInp('udp-identification');
  const birthDate = getInp('udp-birth-date');
  const phone     = getInp('udp-phone');
  const address   = getInp('udp-address');
  const rcvEmails = getBool('udp-receives-emails');
  const fpReg     = getBool('udp-fingerprint');
  const notesEl   = document.getElementById('udp-notes-inp');
  const notes     = notesEl ? (notesEl.value.trim() || null) : user.notes;

  const newPlanName = getInp('udp-plan');
  const newStart    = getInp('udp-start-date');
  const newEnd      = getInp('udp-end-date');
  const isDebtor    = getBool('udp-is-debtor');
  const debtBal     = (() => { const v = getInp('udp-debt-balance'); return v ? parseFloat(v) : null; })();
  const debtReason  = getInp('udp-debt-reason');
  const emName      = getInp('udp-emergency-name');
  const emPhone     = getInp('udp-emergency-phone');

  const saveBtn = document.getElementById('udp-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }

  try {
    const { error: userErr } = await db.from('users').update({
      full_name:               fullName,
      email,
      identification:          identif,
      birth_date:              birthDate || null,
      phone,
      address,
      is_debtor:               isDebtor !== null ? isDebtor : user.isDebtor,
      debt_balance_cop:        debtBal,
      debt_reason:             debtReason,
      notes,
      receives_emails:         rcvEmails !== null ? rcvEmails : user.receivesEmails,
      fingerprint_registered:  fpReg     !== null ? fpReg     : user.fingerprintRegistered,
      emergency_contact_name:  emName,
      emergency_contact_phone: emPhone,
    }).eq('id', user.id);
    if (userErr) throw userErr;

    // Membership: update if plan or dates changed
    const planChanged  = newPlanName !== null && newPlanName !== user.planName;
    const datesChanged = (newStart && newStart !== user.startDate) || (newEnd && newEnd !== user.endDateRaw);
    // Fase 4.5: the monthly pilates allowance lives on `plans`, not `memberships` — it is
    // never copied/written into the membership row (unlike pilatesIncluded/tiqueteraIncluded
    // below, which ARE membership-level lifetime totals). This is only kept in sync here so
    // the in-memory user object (and therefore the modal's monthly-usage display) reflects a
    // plan change immediately, without a full reload.
    let pilatesPerMonth = user.pilatesClassesPerMonth || 0;
    if (planChanged || datesChanged) {
      let planId   = user.membershipPlanId;
      let planName = user.planName || '';
      if (planChanged && newPlanName) {
        const found = (_udpPlansCache || []).find(p => p.name === newPlanName);
        if (found) { planId = found.id; planName = found.name; }
      }
      const foundPlan         = planChanged ? (_udpPlansCache || []).find(p => p.name === planName) : null;
      const pilatesIncluded   = planChanged ? (foundPlan?.pilates_classes   || 0) : user.pilatesClassesIncluded;
      const tiqueteraIncluded = planChanged ? (foundPlan?.tiquetera_sessions || 0) : user.tiqueteraSessionsIncluded;
      if (planChanged) pilatesPerMonth = foundPlan?.pilates_classes_per_month || 0;

      if (user.membershipId) {
        const upd = { updated_by: currentUser?.id || null };
        if (planId)   upd.plan_id    = planId;
        if (newStart) upd.start_date = newStart;
        if (newEnd)   upd.end_date   = newEnd;
        // When plan changes, recalculate Pilates and Tiquetera entitlements and reset used counts
        if (planChanged) {
          upd.pilates_classes_included    = pilatesIncluded;
          upd.pilates_classes_used        = 0;
          upd.tiquetera_sessions_included = tiqueteraIncluded;
          upd.tiquetera_sessions_used     = 0;
        }
        if (Object.keys(upd).length > 1) {
          const { error: mErr } = await db.from('memberships').update(upd).eq('id', user.membershipId);
          if (mErr) throw mErr;
        }
      } else if (planId && newEnd) {
        // Defensive re-check: user.membershipId can be stale (e.g. cached in
        // _adminUsuariosAll from before this user's first membership existed, then never
        // refreshed within the session). Trusting it blindly here is exactly how a second,
        // duplicate 'active' row gets created for someone who already has one — which then
        // breaks getMembership()'s single-row lookup and makes the real membership look
        // lost. Re-check by user_id right before inserting so a stale cache can never do that.
        const { data: existingMems } = await db.from('memberships').select('id, end_date').eq('user_id', user.id);
        const existing = _pickCurrentMembership(existingMems);
        if (existing) {
          const upd2 = {
            plan_id: planId, start_date: newStart || _bogotaToday(), end_date: newEnd,
            pilates_classes_included: pilatesIncluded, pilates_classes_used: 0,
            tiquetera_sessions_included: tiqueteraIncluded, tiquetera_sessions_used: 0,
            updated_by: currentUser?.id || null,
          };
          const { error: mErr } = await db.from('memberships').update(upd2).eq('id', existing.id);
          if (mErr) throw mErr;
          user.membershipId     = existing.id;
          user.membershipPlanId = planId;
        } else {
          const { data: nm, error: mErr } = await db.from('memberships').insert({
            user_id:                    user.id,
            plan_id:                    planId,
            start_date:                 newStart || _bogotaToday(),
            end_date:                   newEnd,
            status:                     'active',
            pilates_classes_used:       0,
            pilates_classes_included:   pilatesIncluded,
            tiquetera_sessions_used:    0,
            tiquetera_sessions_included: tiqueteraIncluded,
          }).select('id, plan_id').single();
          if (mErr) throw mErr;
          user.membershipId     = nm?.id      || null;
          user.membershipPlanId = nm?.plan_id || null;
        }
      }
    }

    // Recompute status from end_date
    const ed = newEnd || user.endDateRaw;
    let newStatus = ed ? (() => {
      const now = new Date(); now.setHours(0,0,0,0);
      const in5 = new Date(now); in5.setDate(in5.getDate() + 5);
      const ag7 = new Date(now); ag7.setDate(ag7.getDate() - 7);
      const edD = parseLocalDate(ed);  edD.setHours(0,0,0,0);
      if (edD < ag7)  return 'Desertor';
      if (edD < now)  return 'Vencido';
      if (edD <= in5) return 'Por vencer';
      return 'Activo';
    })() : 'Sin membresía';

    // Rebuild avatar if name changed
    const colorKey = ciColorKeys[fullName.charCodeAt(0) % ciColorKeys.length];
    const bg       = ciColorBg[colorKey];
    const fg       = ciColorFg[colorKey];
    const initials = fullName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();

    const finalPlan   = newPlanName !== null ? (newPlanName || '') : (user.planName || '');
    const finalEndRaw = newEnd  || user.endDateRaw;
    const finalEndStr = finalEndRaw ? _formatDate(finalEndRaw, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const finalStart  = newStart || user.startDate;

    // Rebuild rowHtml
    const sbClass     = _statusBadgeClass(newStatus);
    const endStyle    = newStatus === 'Vencido' ? 'color:var(--red);' : newStatus === 'Desertor' ? 'color:#9c3a50;' : '';
    const planBadge   = finalPlan ? '<span class="badge badge-cyan">' + finalPlan + '</span>' : '<span class="badge badge-muted">—</span>';
    const ctHtml      = user.hasContract
      ? '<span class="contract-icon contract-ok" title="Contrato aceptado">✓</span>'
      : '<span class="contract-icon contract-pending" title="Contrato pendiente">✗</span>';
    const aBtn = (newStatus === 'Por vencer' || newStatus === 'Vencido' || newStatus === 'Desertor')
      ? `<div style="display:flex;gap:6px;"><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();notificarVencimiento('${user.id}',this)">Notif.</button><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎</button></div>`
      : `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openUsuarioEdit('${user.id}')">✎ Editar</button>`;
    const rowHtml = `<tr style="cursor:pointer;" onclick="openUserDetailModal('${user.id}')">
        <td><div class="stream-avatar" style="width:32px;height:32px;background:${bg};color:${fg};font-family:'Outfit';font-weight:700;font-size:13px;border-radius:50%;display:flex;align-items:center;justify-content:center;">${initials}</div></td>
        <td><div style="font-weight:500;">${fullName}</div><div style="font-size:11px;color:var(--muted);">${email || '—'}</div></td>
        <td style="color:var(--muted);font-size:13px;">${phone || '—'}</td>
        <td>${planBadge}</td>
        <td style="${endStyle}">${finalEndStr}</td>
        <td><span style="font-family:'Outfit';font-weight:700;font-size:18px;color:var(--cyan);">${user.attended}</span></td>
        <td><span class="badge ${sbClass}">${newStatus}</span></td>
        <td>${ctHtml}</td>
        <td>${aBtn}</td>
      </tr>`;

    const updated = {
      ...user,
      name: fullName, email, phone, identification: identif,
      birthDate: birthDate || user.birthDate, address,
      receivesEmails:        rcvEmails !== null ? rcvEmails : user.receivesEmails,
      fingerprintRegistered: fpReg     !== null ? fpReg     : user.fingerprintRegistered,
      notes, isDebtor: isDebtor !== null ? isDebtor : user.isDebtor,
      debtBalance: debtBal, debtReason,
      emergencyContactName: emName, emergencyContactPhone: emPhone,
      planName: finalPlan, endDateRaw: finalEndRaw, endDateStr: finalEndStr,
      startDate: finalStart, statusLabel: newStatus,
      pilatesClassesPerMonth: pilatesPerMonth,
      initials, bg, fg, rowHtml,
    };

    const idx = _adminUsuariosAll.findIndex(u => u.id === user.id);
    if (idx !== -1) _adminUsuariosAll[idx] = updated;
    _udpCurrentUser = updated;

    _applyUsuariosFilters();
    toast('Guardado', 'Cambios guardados correctamente');
    _udpToggleEdit(false);

  } catch (err) {
    toast('Error', err.message || 'No se pudo guardar');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar cambios'; }
  }
}


// ===================== PAGE RENDERERS =====================

// ---- Helpers ----

function _formatCOP(amount) {
  if (!amount) return '—';
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (amount >= 1000)    return '$' + Math.round(amount / 1000) + 'K';
  return '$' + amount.toLocaleString('es-CO');
}

// Full (non-abbreviated) COP amount, e.g. 25000 -> "$25.000" — used where the
// exact figure matters (class price), unlike _formatCOP's K/M abbreviation.
function _formatCOPFull(amount) {
  return (amount == null || isNaN(amount)) ? '—' : '$' + Math.round(amount).toLocaleString('es-CO');
}

// e.g. "martes 30 de junio" — used to show the exact date of a single occurrence.
function _formatFullWeekday(dateStr) {
  if (!dateStr) return '';
  const dias  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d = parseLocalDate(dateStr);
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`;
}

// Parses date strings as local midnight to avoid UTC-offset shift.
// Handles both YYYY-MM-DD and ISO timestamps (timestamptz columns return 'YYYY-MM-DDT...'
// which, parsed as UTC midnight, would display as the previous day in UTC-5/Bogotá).
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  // Extract just the date portion from any ISO timestamp or date string
  const datePart = typeof dateStr === 'string' ? dateStr.slice(0, 10) : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

function _formatDate(dateStr, opts) {
  if (!dateStr) return '—';
  return parseLocalDate(dateStr).toLocaleDateString('es-CO', opts || { day: 'numeric', month: 'short', year: 'numeric' });
}

function _formatScheduleDate(classDate, startTime) {
  const today    = _bogotaToday();
  const tomorrow = new Date(Date.now() + 86400000 - 5 * 3600 * 1000).toISOString().split('T')[0];
  let label;
  if (classDate === today)    label = 'Hoy';
  else if (classDate === tomorrow) label = 'Mañana';
  else {
    const d = new Date(classDate + 'T12:00:00');
    label = d.toLocaleDateString('es-CO', { weekday: 'long' });
    label = label.charAt(0).toUpperCase() + label.slice(1);
  }
  const t = new Date(classDate + 'T' + startTime);
  const timeStr = t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  return `${label} · ${timeStr}`;
}

function _deltaText(curr, prev, unit, lowerIsBetter) {
  if (prev == null || curr == null) return '';
  const diff = parseFloat((curr - prev).toFixed(1));
  if (diff === 0) return '';
  const sign  = diff > 0 ? '▲ +' : '▼ ';
  const color = (diff < 0) === lowerIsBetter ? 'var(--green)' : 'var(--red)';
  return `<span style="color:${color};">${sign}${Math.abs(diff)}${unit} este periodo</span>`;
}

// ---- Dashboard inicio ----

async function loadUserDashboard(profile) {
  const greetingEl = document.getElementById('dashboard-greeting');
  if (greetingEl && profile.full_name) {
    greetingEl.textContent = profile.full_name.split(' ')[0].toUpperCase();
    greetingEl.style.display = 'block';
  }

  try {
    const today    = new Date();
    const todayStr = _bogotaToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay  = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    const monday   = _getMonday();
    const sunday   = _getSunday();

    const [membership, streak, evalRes, upcomingRes, weekSchRes, monthAttRes] = await Promise.all([
      getMembership(profile.id),
      getStreak(profile.id),
      db.from('body_evaluations')
        .select('weight_kg, porcentaje_grasa, peso_muscular_kg, imc, evaluation_date')
        .eq('user_id', profile.id)
        .order('evaluation_date', { ascending: false })
        .limit(2),
      db.from('schedule').select('id, class_date, start_time, spots_available, classes(name, type, color)').gte('class_date', todayStr).eq('is_cancelled', false).order('class_date').order('start_time').limit(8),
      db.from('schedule').select('id, class_date').gte('class_date', monday).lte('class_date', sunday).eq('is_cancelled', false),
      db.from('bookings').select('schedule_id, status, schedule!inner(class_date)').eq('user_id', profile.id).gte('schedule.class_date', firstDay).lte('schedule.class_date', lastDay)
    ]);

    const weekSched   = weekSchRes.data  || [];
    const monthBook   = monthAttRes.data || [];
    const weekSchedIds = new Set(weekSched.map(s => s.id));

    // bookings for the week
    const weekBookRes = await db.from('bookings').select('schedule_id, status').eq('user_id', profile.id).in('schedule_id', [...weekSchedIds]);
    const weekBookings = weekBookRes.data || [];

    // Fase 4.5: current month's pilates class usage, only when the plan actually has a
    // monthly allowance — depends on `membership` (from the Promise.all above), so it can't
    // be folded into that same batch; a single small follow-up call is the simplest option.
    let classUsage = null;
    if (membership?.id && (membership.plans?.pilates_classes_per_month || 0) > 0) {
      const { data: cu } = await db
        .from('membership_class_usage')
        .select('classes_used')
        .eq('membership_id', membership.id)
        .eq('year_month', todayStr.slice(0, 7))
        .maybeSingle();
      classUsage = cu;
    }

    renderStatCards(membership, streak, monthBook, classUsage);
    renderWeekCalendar(weekSched, weekBookings);
    renderProximasClases(upcomingRes.data || [], weekBookings);
    renderProgressSummary(evalRes?.data || []);

    if (membership?.plans?.name) {
      document.getElementById('sidebar-plan').textContent = membership.plans.name;
    }
  } catch (err) {
    console.error('[Dashboard]', err);
    _showDashboardError('No pudimos cargar tu información');
  }
}

function renderStatCards(membership, streak, monthBookings, classUsage) {
  const attended = monthBookings?.filter(b => b.status !== 'cancelled').length ?? 0;
  const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

  setEl('stat-clases-value', attended);
  const barEl = document.getElementById('stat-clases-bar');
  if (barEl) barEl.style.width = Math.min(100, attended * 4) + '%';
  setEl('stat-clases-change', attended ? `${attended} clase${attended !== 1 ? 's' : ''} este mes` : 'Sin clases este mes');

  setEl('stat-racha-value', streak ?? '—');
  setEl('stat-racha-change', streak > 0 ? '🔥 ¡Sigue así!' : 'Empieza tu racha hoy');

  if (membership) {
    // Fase 4.5: "Clases Pilates" card now shows a real number instead of the previously
    // dead `membership.pilates_credits_remaining` (that column never existed, so this always
    // rendered 0). Monthly allowance takes priority when the plan has one; otherwise falls
    // back to the tiquetera lifetime pool — a tiquetera membership has no monthly allowance
    // by design (see supabase/migrations/20260820_class_allowance_tracking.sql).
    const monthlyIncluded = membership.plans?.pilates_classes_per_month || 0;
    const unitEl = document.getElementById('stat-pilates-unit');
    let credits, unit, changeText;
    if (monthlyIncluded > 0) {
      const used = classUsage?.classes_used || 0;
      credits    = Math.max(0, monthlyIncluded - used);
      unit       = 'disp.';
      changeText = `${used}/${monthlyIncluded} usadas este mes`;
    } else if ((membership.tiquetera_sessions_included || 0) > 0) {
      const used = membership.tiquetera_sessions_used || 0;
      credits    = Math.max(0, membership.tiquetera_sessions_included - used);
      unit       = 'disp.';
      changeText = `${used}/${membership.tiquetera_sessions_included} usadas`;
    } else {
      credits    = 0;
      unit       = '';
      changeText = membership.end_date
        ? (() => {
            const days = Math.ceil((parseLocalDate(membership.end_date) - new Date()) / 86400000);
            return days > 0 ? `Vencen en ${days} días` : 'Membresía vencida';
          })()
        : '';
    }
    setEl('stat-pilates-value', credits);
    if (unitEl) unitEl.textContent = unit;
    setEl('stat-pilates-change', changeText);

    setEl('stat-plan-name', membership.plans?.name || '—');
    if (membership.end_date) {
      const endStr = _formatDate(membership.end_date, { day: 'numeric', month: 'short' });
      setEl('stat-plan-change', `Vence ${endStr}`);
    }
  } else {
    setEl('stat-plan-name', 'Sin plan activo');
  }
}

function renderWeekCalendar(weekSchedule, userBookings) {
  const container = document.getElementById('week-days-container');
  const summary   = document.getElementById('week-summary-text');
  if (!container) return;

  const todayStr   = _bogotaToday();
  const monday     = new Date(_getMonday() + 'T12:00:00');
  const labels     = ['L','M','X','J','V','S'];
  const bookedIds  = new Set(userBookings.filter(b => b.status !== 'cancelled').map(b => b.schedule_id));
  const schedByDay = {};
  weekSchedule.forEach(s => { schedByDay[s.class_date] = schedByDay[s.class_date] || []; schedByDay[s.class_date].push(s.id); });

  let done = 0, pending = 0;
  const html = labels.map((lbl, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isPast    = dateStr < todayStr;
    const isToday   = dateStr === todayStr;
    const dayIds    = schedByDay[dateStr] || [];
    const hasBooked = dayIds.some(id => bookedIds.has(id));
    let cls = 'week-day';
    if (isToday)       cls += ' day-today';
    else if (isPast && hasBooked) { cls += ' day-done'; done++; }
    else if (!isPast && hasBooked){ pending++; cls += ' day-pending'; }
    else cls += ' day-pending';
    return `<div class="${cls}">${lbl}</div>`;
  }).join('');

  container.innerHTML = html;
  if (summary) {
    summary.innerHTML = (done || pending)
      ? `<span style="color:var(--cyan);font-weight:600;">${done} clase${done!==1?'s':''}</span> completadas · <span style="color:var(--muted2);">${pending} pendiente${pending!==1?'s':''}</span>`
      : '<span style="color:var(--muted);">Sin clases reservadas esta semana</span>';
  }
}

function renderProximasClases(upcoming, userBookings) {
  const container = document.getElementById('proximas-clases-list');
  if (!container) return;
  if (!upcoming.length) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:12px 0;">Sin clases disponibles próximamente.</div>';
    return;
  }
  const bookedIds = new Set(userBookings.filter(b => b.status !== 'cancelled').map(b => b.schedule_id));
  const colorMap  = { funcional:'var(--cyan)', pilates:'var(--purple)', cycling:'var(--orange)', riding:'var(--orange)' };

  container.innerHTML = upcoming.slice(0, 4).map(s => {
    const cls     = s.classes || {};
    const type    = (cls.type || cls.name || '').toLowerCase();
    const color   = cls.color || colorMap[type] || 'var(--cyan)';
    const isBooked = bookedIds.has(s.id);
    const dateStr  = _formatScheduleDate(s.class_date, s.start_time);
    const right    = isBooked
      ? '<span class="badge badge-cyan">Reservada</span>'
      : `<button class="btn btn-outline btn-sm" onclick="openModal('reservar')">Reservar</button>`;
    return `<div class="log-item">
      <div style="display:flex;align-items:center;flex:1;gap:10px;">
        <div class="log-dot" style="background:${color};box-shadow:0 0 6px ${color}55;"></div>
        <div>
          <div style="font-weight:500;font-size:13px;">${cls.name || 'Clase'}</div>
          <div style="font-size:11px;color:var(--muted);">${dateStr} · ${s.spots_available} cupos</div>
        </div>
      </div>${right}</div>`;
  }).join('');
}

function renderProgressSummary(evals) {
  const card = document.getElementById('summary-progress-card');
  if (!evals.length) {
    if (card) card.style.display = 'none';
    return;
  }
  if (card) card.style.display = '';

  const latest = evals[0]; // descending — most recent first
  const prev   = evals.length > 1 ? evals[1] : null;

  const setVal = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val != null ? (typeof val === 'number' ? val.toFixed(1) : val) : '—';
  };
  const setDelta = (id, curr, prevVal, unit, lowerIsBetter) => {
    const e = document.getElementById(id);
    if (e) e.innerHTML = _deltaText(curr, prevVal, unit, lowerIsBetter);
  };

  setVal('summary-peso-value',    latest.weight_kg);
  setVal('summary-grasa-value',   latest.porcentaje_grasa);
  setVal('summary-musculo-value', latest.peso_muscular_kg);
  setDelta('summary-peso-change',    latest.weight_kg,        prev?.weight_kg,        ' kg', false);
  setDelta('summary-grasa-change',   latest.porcentaje_grasa, prev?.porcentaje_grasa, '%',   true);
  setDelta('summary-musculo-change', latest.peso_muscular_kg, prev?.peso_muscular_kg, ' kg', false);

  const dateEl = document.getElementById('summary-eval-date');
  if (dateEl && latest.evaluation_date) {
    dateEl.textContent = 'Última eval: ' + _formatDate(latest.evaluation_date, { day: 'numeric', month: 'short', year: 'numeric' });
    dateEl.style.display = 'block';
  }
}

// ===================== EVALUACIÓN FÍSICA — COMPOSICIÓN CORPORAL =====================

let _progresoCharts = {};

// ---- Router: dispatches by role ----

async function loadProgresoPage(userId) {
  const role = currentUser?.role;
  // Fase 3.4 (2026-08-20): employee/reception reach this page only through the new
  // nav-emp-evaluaciones/nav-rec-evaluaciones items, themselves gated by
  // _canAccessEvaluacionesModule() — routed here by ROLE (not by that finer-grained check)
  // so the same page-shell/defense-in-depth message in renderMiProgresoInstructor() handles
  // an ungranted person reaching this route directly, instead of them incorrectly falling
  // into renderMiProgresoUsuario() (that view is for role='user' gym members' own progress).
  if (role === 'admin' || role === 'instructor' || role === 'employee' || role === 'reception') {
    await renderMiProgresoInstructor();
  } else {
    await renderMiProgresoUsuario(userId);
  }
}

// ---- Calculation engine ----

function calcularComposicionCorporal(datos, sexo) {
  const r = {};
  const fem = (sexo === 'femenino' || sexo === 'F');

  const { weight_kg, height_m, age_decimal,
    diam_humeral, diam_femoral,
    pliegue_triceps, pliegue_subescapular, pliegue_suprailiaco,
    pliegue_abdominal, pliegue_muslo_anterior, pliegue_pierna_medial,
    per_abdomen_inferior, per_cadera } = datos;

  if (weight_kg && height_m) {
    r.imc = +(weight_kg / (height_m * height_m)).toFixed(2);
    r.clasificacion_imc = r.imc < 18.5 ? 'Bajo peso' : r.imc < 25 ? 'Saludable' : r.imc < 30 ? 'Sobrepeso' : 'Obesidad';
  }

  const p6 = [pliegue_triceps, pliegue_subescapular, pliegue_suprailiaco,
               pliegue_abdominal, pliegue_muslo_anterior, pliegue_pierna_medial];
  if (p6.every(v => v != null && v !== '' && !isNaN(v))) {
    r.suma_6_pliegues = +p6.reduce((a, b) => a + +b, 0).toFixed(2);
    r.porcentaje_grasa = fem
      ? +((r.suma_6_pliegues * 0.1548) + 3.580).toFixed(2)
      : +((r.suma_6_pliegues * 0.1012) + 3.640).toFixed(2);
    r.clasificacion_grasa = _clasGrasa(r.porcentaje_grasa, fem);
  }

  if (weight_kg && r.porcentaje_grasa != null) {
    r.peso_graso_kg      = +(weight_kg * r.porcentaje_grasa / 100).toFixed(2);
    const pctRes         = fem ? 20.9 : 24.1;
    r.porcentaje_residual = pctRes;
    r.peso_residual_kg   = +(weight_kg * pctRes / 100).toFixed(2);
    r.masa_magra_kg      = +(weight_kg - r.peso_graso_kg).toFixed(2);

    if (height_m && diam_humeral && diam_femoral) {
      // Fixed 2026-07-06: the constant was transcribed as "* 400" (multiplier) instead of
      // "/ 400" (divisor) — produced peso_oseo_kg in the thousands of kg for any normal
      // adult input (e.g. ~9,000kg for height=1.75m/diam_hum=6.5cm/diam_fem=9.5cm), which
      // also overflowed body_evaluations.peso_oseo_kg's numeric(5,2) column. With the
      // divisor restored, the same inputs correctly produce ~1.8kg — squarely in the
      // expected ~2-4.5% of body weight range for skeletal mass.
      const boneKg       = 3.02 * Math.pow((height_m * height_m * +diam_humeral * +diam_femoral) / 400, 0.712);
      r.peso_oseo_kg     = +boneKg.toFixed(2);
    } else {
      r.peso_oseo_kg     = +(weight_kg * (fem ? 0.122 : 0.145)).toFixed(2);
    }
    r.porcentaje_oseo    = +(r.peso_oseo_kg / weight_kg * 100).toFixed(2);
    r.peso_muscular_kg   = +Math.max(0, weight_kg - r.peso_graso_kg - r.peso_oseo_kg - r.peso_residual_kg).toFixed(2);
    r.porcentaje_muscular = +(r.peso_muscular_kg / weight_kg * 100).toFixed(2);

    r.porcentaje_grasa_ideal   = fem ? 12 : 8;
    r.peso_graso_ideal_kg      = +(weight_kg * r.porcentaje_grasa_ideal / 100).toFixed(2);
    r.porcentaje_muscular_ideal = fem ? 54 : 60;
    r.peso_muscular_ideal_kg   = +(weight_kg * r.porcentaje_muscular_ideal / 100).toFixed(2);
    r.porcentaje_oseo_ideal    = fem ? 12 : 14;
    r.masa_magra_ideal_kg      = +(weight_kg * (1 - r.porcentaje_grasa_ideal / 100)).toFixed(2);
  }

  if (height_m) {
    const hcm = height_m * 100;
    r.peso_ideal_kg = +(fem ? (hcm - 100) * 0.85 : (hcm - 100) * 0.9).toFixed(2);
  }

  if (per_abdomen_inferior && per_cadera) {
    r.relacion_cintura_cadera = +(+per_abdomen_inferior / +per_cadera).toFixed(3);
    r.clasificacion_cintura_cadera = _clasCintura(r.relacion_cintura_cadera, fem);
  }

  if (weight_kg && height_m && age_decimal) {
    const hcm = height_m * 100;
    r.tmb_24h = +(fem
      ? (10 * weight_kg) + (6.25 * hcm) - (5 * +age_decimal) - 161
      : (10 * weight_kg) + (6.25 * hcm) - (5 * +age_decimal) + 5).toFixed(0);
    r.kcal_ligera   = +(r.tmb_24h * 1.375).toFixed(0);
    r.kcal_moderada = +(r.tmb_24h * 1.55).toFixed(0);
    r.kcal_alta     = +(r.tmb_24h * 1.725).toFixed(0);
  }

  return r;
}

// ===== CLASSIFIER & HELPER FUNCTIONS =====

function clasificarIMC(imc) {
  if (imc == null) return { texto: '—', cls: 'badge-muted' };
  if (imc < 18.5) return { texto: 'Bajo peso',  cls: 'badge-amber' };
  if (imc < 25)   return { texto: 'Saludable',   cls: 'badge-green' };
  if (imc < 30)   return { texto: 'Sobrepeso',   cls: 'badge-amber' };
  return           { texto: 'Obesidad',           cls: 'badge-red'   };
}

function clasificarGrasa(pct, sexo) {
  if (pct == null) return { texto: '—', cls: 'badge-muted' };
  const fem = sexo === 'femenino';
  if (fem) {
    if (pct < 13)  return { texto: 'Atleta',    cls: 'badge-cyan'  };
    if (pct < 20)  return { texto: 'Fitness',   cls: 'badge-green' };
    if (pct < 25)  return { texto: 'Aceptable', cls: 'badge-amber' };
    return         { texto: 'Alto',             cls: 'badge-red'   };
  } else {
    if (pct < 6)   return { texto: 'Atleta',    cls: 'badge-cyan'  };
    if (pct < 14)  return { texto: 'Fitness',   cls: 'badge-green' };
    if (pct < 18)  return { texto: 'Aceptable', cls: 'badge-amber' };
    return         { texto: 'Alto',             cls: 'badge-red'   };
  }
}

function clasificarCinturaCadera(ratio, sexo) {
  if (ratio == null) return { texto: '—', cls: 'badge-muted' };
  const fem = sexo === 'femenino';
  if (fem) {
    if (ratio < 0.75) return { texto: 'Bajo riesgo',     cls: 'badge-green' };
    if (ratio < 0.80) return { texto: 'Riesgo leve',     cls: 'badge-cyan'  };
    if (ratio < 0.85) return { texto: 'Riesgo moderado', cls: 'badge-amber' };
    return            { texto: 'Riesgo alto',             cls: 'badge-red'   };
  } else {
    if (ratio < 0.85) return { texto: 'Bajo riesgo',     cls: 'badge-green' };
    if (ratio < 0.90) return { texto: 'Riesgo leve',     cls: 'badge-cyan'  };
    if (ratio < 0.95) return { texto: 'Riesgo moderado', cls: 'badge-amber' };
    return            { texto: 'Riesgo alto',             cls: 'badge-red'   };
  }
}

function clasificarSomatotipo(endo, meso, ecto) {
  if (endo == null || meso == null || ecto == null) return { tipo: '—', descripcion: '' };
  if (endo >= meso && endo >= ecto) {
    if (meso - ecto >= 0.5) return { tipo: 'Endo-mesomorfo',      descripcion: 'Predominio graso con buena musculatura' };
    if (ecto - meso >= 0.5) return { tipo: 'Endo-ectomorfo',      descripcion: 'Predominio graso con tendencia lineal' };
    if (Math.abs(endo - meso) < 0.5 && Math.abs(endo - ecto) < 0.5)
                            return { tipo: 'Central',              descripcion: 'Los tres componentes son similares' };
    return                  { tipo: 'Endomorfo balanceado',        descripcion: 'Predominio de masa grasa' };
  }
  if (meso >= endo && meso >= ecto) {
    if (endo - ecto >= 0.5) return { tipo: 'Meso-endomorfo',      descripcion: 'Alta musculatura con reservas grasas' };
    if (ecto - endo >= 0.5) return { tipo: 'Meso-ectomorfo',      descripcion: 'Alta musculatura con tendencia lineal' };
    return                  { tipo: 'Mesomorfo balanceado',        descripcion: 'Predominio muscular equilibrado' };
  }
  if (meso - endo >= 0.5)   return { tipo: 'Ecto-mesomorfo',      descripcion: 'Tendencia lineal con buena musculatura' };
  return                           { tipo: 'Ectomorfo balanceado', descripcion: 'Tendencia lineal y delgada' };
}

function formatearKcal(n) {
  if (n == null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('es-CO');
}

function calcularEdadDecimal(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const diff = new Date() - parseLocalDate(fechaNacimiento);
  return +(diff / (365.25 * 24 * 60 * 60 * 1000)).toFixed(2);
}

function _fmtNum(v, dec) { return (v == null || isNaN(v)) ? '—' : parseFloat(v).toFixed(dec ?? 1); }
function _fmtK(n) { return (n == null || isNaN(n)) ? '—' : Math.round(n).toLocaleString('es-CO'); }

function _clasGrasa(pct, fem) {
  if (fem) return pct < 14 ? 'Muy bajo' : pct < 21 ? 'Deportista' : pct < 33 ? 'Aceptable' : 'Alto';
  return pct < 6 ? 'Muy bajo' : pct < 14 ? 'Deportista' : pct < 25 ? 'Aceptable' : 'Alto';
}

function _clasCintura(r, fem) {
  if (fem) return r < 0.75 ? 'Excelente' : r < 0.80 ? 'Bueno' : r < 0.85 ? 'Riesgo moderado' : 'Riesgo alto';
  return r < 0.85 ? 'Excelente' : r < 0.90 ? 'Bueno' : r < 0.95 ? 'Riesgo moderado' : 'Riesgo alto';
}

function _clasColor(cls) {
  const map = {
    'Excelente':'badge-green','Bueno':'badge-cyan','Aceptable':'badge-cyan',
    'Deportista':'badge-green','Saludable':'badge-green','Normal':'badge-green','Fitness':'badge-green',
    'Atleta':'badge-cyan','Riesgo leve':'badge-cyan',
    'Riesgo moderado':'badge-amber','Sobrepeso':'badge-amber','Muy bajo':'badge-amber','Bajo peso':'badge-amber',
    'Alto':'badge-red','Riesgo alto':'badge-red','Obesidad':'badge-red',
  };
  return map[cls] || 'badge-muted';
}

// ===== INFORME SECTION BUILDERS =====

function _sec0Header(latest, evals, userName) {
  const fechaStr = _formatDate(latest.evaluation_date, { day:'numeric', month:'long', year:'numeric' });
  const imcCls   = clasificarIMC(latest.imc);
  const grasCls  = clasificarGrasa(latest.porcentaje_grasa, latest.sexo);
  const ccCls    = clasificarCinturaCadera(latest.relacion_cintura_cadera, latest.sexo);
  return `
    <div class="inf-header inf-section">
      <div class="inf-header-top">
        <div>
          <div class="inf-label-sm">Informe de composición corporal</div>
          <div class="inf-patient-name">${userName || 'Atleta'}</div>
          <div class="inf-header-meta">
            ${latest.sexo ? `<span>${latest.sexo.charAt(0).toUpperCase() + latest.sexo.slice(1)}</span>` : ''}
            ${latest.age_decimal ? `<span>${_fmtNum(latest.age_decimal, 1)} años</span>` : ''}
            ${latest.height_m ? `<span>${_fmtNum(latest.height_m, 3)} m</span>` : ''}
            ${latest.sport ? `<span>${latest.sport}</span>` : ''}
            ${latest.training_period ? `<span>${latest.training_period}</span>` : ''}
          </div>
        </div>
        <div class="inf-header-date">
          <div class="inf-label-sm">Fecha</div>
          <div class="inf-date-val">${fechaStr}</div>
          ${evals.length > 1 ? `<div class="inf-eval-count">${evals.length} evaluaciones</div>` : ''}
        </div>
      </div>
      <div class="inf-badge-strip">
        ${latest.weight_kg ? `<div class="inf-stat"><div class="inf-stat-val">${latest.weight_kg}<span class="inf-stat-unit"> kg</span></div><div class="inf-stat-label">Peso</div></div>` : ''}
        ${latest.imc ? `<div class="inf-stat"><div class="inf-stat-val">${_fmtNum(latest.imc,1)}</div><div class="inf-stat-label">IMC · <span class="badge ${imcCls.cls}">${imcCls.texto}</span></div></div>` : ''}
        ${latest.porcentaje_grasa != null ? `<div class="inf-stat"><div class="inf-stat-val">${_fmtNum(latest.porcentaje_grasa,1)}<span class="inf-stat-unit">%</span></div><div class="inf-stat-label">Grasa · <span class="badge ${grasCls.cls}">${grasCls.texto}</span></div></div>` : ''}
        ${latest.porcentaje_muscular != null ? `<div class="inf-stat"><div class="inf-stat-val">${_fmtNum(latest.porcentaje_muscular,1)}<span class="inf-stat-unit">%</span></div><div class="inf-stat-label">Muscular</div></div>` : ''}
        ${latest.relacion_cintura_cadera != null ? `<div class="inf-stat"><div class="inf-stat-val">${_fmtNum(latest.relacion_cintura_cadera,3)}</div><div class="inf-stat-label">Cin/Cad · <span class="badge ${ccCls.cls}">${ccCls.texto}</span></div></div>` : ''}
      </div>
    </div>`;
}

function _sec1Composicion(latest, prev) {
  const grasCls = clasificarGrasa(latest.porcentaje_grasa, latest.sexo);
  const infDelta = (cur, pre, unit, lbi) => {
    if (pre == null || cur == null) return '';
    const d = +(cur - pre).toFixed(2);
    if (d === 0) return '';
    const pos = lbi ? d < 0 : d > 0;
    return `<span class="inf-delta ${pos ? 'inf-delta-pos' : 'inf-delta-neg'}">${d > 0 ? '+' : ''}${d}${unit} ${d > 0 ? '↑' : '↓'}</span>`;
  };
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">01</span> Composición Corporal</div>
      <div class="inf-comp-grid">
        <div class="inf-comp-chart-wrap">
          <div style="position:relative;height:240px;"><canvas id="chartBodyComp"></canvas></div>
          <div class="inf-comp-legend">
            <div class="inf-leg-item"><span style="background:#FF3B5C"></span>Grasa</div>
            <div class="inf-leg-item"><span style="background:#00CFFF"></span>Muscular</div>
            <div class="inf-leg-item"><span style="background:#9B59FF"></span>Óseo</div>
            <div class="inf-leg-item"><span style="background:rgba(255,255,255,0.15)"></span>Residual</div>
          </div>
        </div>
        <div class="inf-comp-metrics">
          <div class="inf-metric-row">
            <div class="inf-metric-label">% Grasa corporal</div>
            <div class="inf-metric-val" style="color:#FF3B5C">${_fmtNum(latest.porcentaje_grasa,1)}<span class="inf-metric-unit">%</span></div>
            <div><span class="badge ${grasCls.cls}">${grasCls.texto}</span> ${infDelta(latest.porcentaje_grasa, prev?.porcentaje_grasa, '%', true)}</div>
          </div>
          <div class="inf-metric-row">
            <div class="inf-metric-label">% Muscular</div>
            <div class="inf-metric-val" style="color:#00CFFF">${_fmtNum(latest.porcentaje_muscular,1)}<span class="inf-metric-unit">%</span></div>
            <div>${infDelta(latest.porcentaje_muscular, prev?.porcentaje_muscular, '%', false)}</div>
          </div>
          <div class="inf-metric-row">
            <div class="inf-metric-label">% Óseo</div>
            <div class="inf-metric-val" style="color:#9B59FF">${_fmtNum(latest.porcentaje_oseo,1)}<span class="inf-metric-unit">%</span></div>
            <div></div>
          </div>
          <div class="inf-metric-row">
            <div class="inf-metric-label">% Residual</div>
            <div class="inf-metric-val" style="color:rgba(255,255,255,0.4)">${_fmtNum(latest.porcentaje_residual,1)}<span class="inf-metric-unit">%</span></div>
            <div></div>
          </div>
          <div class="inf-divider"></div>
          <div class="inf-metric-row">
            <div class="inf-metric-label">Suma 6 pliegues</div>
            <div class="inf-metric-val">${_fmtNum(latest.suma_6_pliegues,1)}<span class="inf-metric-unit"> mm</span></div>
            <div>${infDelta(latest.suma_6_pliegues, prev?.suma_6_pliegues, ' mm', true)}</div>
          </div>
          <div class="inf-metric-row">
            <div class="inf-metric-label">Peso ideal</div>
            <div class="inf-metric-val">${_fmtNum(latest.peso_ideal_kg,1)}<span class="inf-metric-unit"> kg</span></div>
            <div></div>
          </div>
        </div>
      </div>
    </div>`;
}

function _sec2RossGuimaraes(latest) {
  const rows = [
    ['Masa grasa',    latest.peso_graso_kg,   latest.porcentaje_grasa,    '#FF3B5C'],
    ['Masa muscular', latest.peso_muscular_kg, latest.porcentaje_muscular, '#00CFFF'],
    ['Masa ósea',     latest.peso_oseo_kg,     latest.porcentaje_oseo,     '#9B59FF'],
    ['Masa magra',    latest.masa_magra_kg,    null,                       '#39FF7A'],
    ['Masa residual', null,                    latest.porcentaje_residual, 'rgba(255,255,255,0.35)'],
  ];
  const rowsHtml = rows.map(([label, kg, pct, color]) => {
    if (!kg && !pct) return '';
    const barW = pct ? Math.min(100, Math.round(pct)) : 0;
    return `
      <div class="inf-rg-row">
        <div class="inf-rg-label" style="color:${color}">${label}</div>
        <div class="inf-rg-bar-wrap"><div class="inf-rg-bar" style="width:${barW}%;background:${color}"></div></div>
        <div class="inf-rg-kg">${kg != null ? `${_fmtNum(kg,2)} kg` : '—'}</div>
        <div class="inf-rg-pct">${pct != null ? `${_fmtNum(pct,1)}%` : '—'}</div>
      </div>`;
  }).join('');
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">02</span> Modelo Ross &amp; Guimaraes (5 compartimentos)</div>
      <div class="inf-rg-wrap">${rowsHtml}</div>
      <div class="inf-rg-total">Peso corporal total: <strong>${latest.weight_kg ? `${latest.weight_kg} kg` : '—'}</strong></div>
    </div>`;
}

function _sec3Somatotipo(latest) {
  if (!latest.endomorfia && !latest.mesomorfia && !latest.ectomorfia) return '';
  const soma = clasificarSomatotipo(latest.endomorfia, latest.mesomorfia, latest.ectomorfia);
  const ejeX = latest.eje_x ?? (latest.ectomorfia != null && latest.endomorfia != null
    ? +(latest.ectomorfia - latest.endomorfia).toFixed(3) : null);
  const ejeY = latest.eje_y ?? (latest.mesomorfia != null && latest.endomorfia != null && latest.ectomorfia != null
    ? +(2 * latest.mesomorfia - (latest.endomorfia + latest.ectomorfia)).toFixed(3) : null);
  const bar = (label, val, color) => {
    const w = Math.min(100, Math.round((val / 8) * 100));
    return `<div class="inf-soma-bar-row"><span class="inf-soma-bar-label">${label}</span><div class="inf-soma-bar-track"><div class="inf-soma-bar-fill" style="width:${w}%;background:${color}"></div></div><span class="inf-soma-bar-val">${_fmtNum(val, 2)}</span></div>`;
  };
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">03</span> Somatotipo Heath-Carter</div>
      <div class="inf-soma-grid">
        <div class="inf-soma-chart-wrap">
          <div style="position:relative;height:220px;"><canvas id="chartSomatotipo"></canvas></div>
        </div>
        <div class="inf-soma-info">
          <div class="inf-soma-tipo">${soma.tipo}</div>
          <div class="inf-soma-desc">${soma.descripcion}</div>
          <div class="inf-soma-bars" style="margin-top:16px;">
            ${bar('I Endomorfia',   latest.endomorfia,  '#FF3B5C')}
            ${bar('II Mesomorfia',  latest.mesomorfia,  '#00CFFF')}
            ${bar('III Ectomorfia', latest.ectomorfia,  '#9B59FF')}
          </div>
          ${ejeX != null && ejeY != null ? `<div class="inf-soma-coords"><span>X = ${_fmtNum(ejeX,2)}</span><span>Y = ${_fmtNum(ejeY,2)}</span></div>` : ''}
        </div>
      </div>
    </div>`;
}

function _sec4Calorias(latest) {
  if (!latest.tmb_24h) return '';
  const cards = [
    ['TMB 24h',            latest.tmb_24h,        'Basal · reposo completo',         '#555'],
    ['Actividad ligera',   latest.kcal_ligera,     'Sedentario · ×1.375',             '#2D95CC'],
    ['Actividad moderada', latest.kcal_moderada,   'Ejercicio 3–5×/sem · ×1.55',      '#00CFFF'],
    ['Actividad alta',     latest.kcal_alta,       'Ejercicio 6–7×/sem · ×1.725',     '#39FF7A'],
    ['Actividad excesiva', latest.kcal_excesiva,   'Trabajo físico + entreno · ×1.9', '#FFD700'],
  ].filter(([, v]) => v != null);
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">04</span> Necesidades Calóricas Diarias</div>
      <div class="inf-kcal-grid">
        ${cards.map(([label, val, sub, color]) => `
          <div class="inf-kcal-card" style="--kc:${color}">
            <div class="inf-kcal-val">${formatearKcal(val)}</div>
            <div class="inf-kcal-unit">kcal/día</div>
            <div class="inf-kcal-label">${label}</div>
            <div class="inf-kcal-sub">${sub}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function _sec5Medidas(latest, prev) {
  const pliegues = [
    ['Bíceps',         latest.pliegue_biceps,         prev?.pliegue_biceps],
    ['Tríceps',        latest.pliegue_triceps,        prev?.pliegue_triceps],
    ['Subescapular',   latest.pliegue_subescapular,   prev?.pliegue_subescapular],
    ['Suprailíaco',    latest['pliegue_suprailiaco'],  prev?.['pliegue_suprailiaco']],
    ['Abdominal',      latest.pliegue_abdominal,      prev?.pliegue_abdominal],
    ['Muslo anterior', latest.pliegue_muslo_anterior, prev?.pliegue_muslo_anterior],
    ['Pierna medial',  latest.pliegue_pierna_medial,  prev?.pliegue_pierna_medial],
    ['Pectoral',       latest.pliegue_pectoral,       prev?.pliegue_pectoral],
  ].filter(([, v]) => v != null);
  if (!pliegues.length) return '';
  const rows = pliegues.map(([label, val, prevVal]) => {
    const d = prevVal != null ? +(val - prevVal).toFixed(1) : null;
    const dHtml = (d != null && d !== 0) ? `<span class="inf-td-delta ${d < 0 ? 'inf-delta-pos' : 'inf-delta-neg'}">${d > 0 ? '+' : ''}${d}</span>` : '';
    return `<tr><td>${label}</td><td>${_fmtNum(val,1)} mm${dHtml}</td></tr>`;
  }).join('');
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">05</span> Pliegues Cutáneos</div>
      <div class="inf-pliegues-wrap">
        <table class="inf-table">
          <thead><tr><th>Pliegue</th><th>Valor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="inf-pliegues-chart"><canvas id="chartPliegues"></canvas></div>
      </div>
    </div>`;
}

function _sec6Perimetros(latest, prev) {
  const pers = [
    ['Tórax',            latest.per_torax,            prev?.per_torax,            false],
    ['Abdomen inferior', latest.per_abdomen_inferior, prev?.per_abdomen_inferior, true],
    ['Cadera',           latest.per_cadera,           prev?.per_cadera,           true],
    ['Bíceps relajado',  latest.per_biceps_relajado,  prev?.per_biceps_relajado,  false],
    ['Bíceps contraído', latest.per_biceps_contraido, prev?.per_biceps_contraido, false],
    ['Muslo superior',   latest.per_muslo_superior,   prev?.per_muslo_superior,   false],
    ['Pantorrilla',      latest.per_pantorrilla,      prev?.per_pantorrilla,      false],
  ].filter(([, v]) => v != null);
  if (!pers.length) return '';
  const rows = pers.map(([label, val, prevVal, lbi]) => {
    const d = prevVal != null ? +(val - prevVal).toFixed(1) : null;
    const dHtml = (d != null && d !== 0) ? `<span class="inf-td-delta ${(lbi ? d < 0 : d > 0) ? 'inf-delta-pos' : 'inf-delta-neg'}">${d > 0 ? '+' : ''}${d}</span>` : '';
    return `<tr><td>${label}</td><td>${_fmtNum(val,1)} cm${dHtml}</td></tr>`;
  }).join('');
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">06</span> Perímetros Musculares</div>
      <div class="inf-per-wrap">
        <table class="inf-table">
          <thead><tr><th>Perímetro</th><th>Valor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="inf-per-chart"><canvas id="chartPerimetros"></canvas></div>
      </div>
    </div>`;
}

function _sec7Observaciones(latest) {
  if (!latest.observaciones_medicas) return '';
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">07</span> Observaciones Médicas</div>
      <div class="inf-obs-card">
        <div style="font-size:13px;line-height:1.7;white-space:pre-line;color:var(--muted2);">${latest.observaciones_medicas}</div>
      </div>
    </div>`;
}

function _sec8Conclusion(latest) {
  const hasContent = latest.conclusion_profesional || latest.recomendaciones || latest.conclusion_general;
  if (!hasContent) return '';
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">08</span> Conclusión y Recomendaciones</div>
      ${latest.conclusion_general ? `
        <div class="inf-concl-block">
          <div class="inf-concl-label">Conclusión general</div>
          <div class="inf-concl-text">${latest.conclusion_general}</div>
        </div>` : ''}
      ${latest.conclusion_profesional ? `
        <div class="inf-concl-block">
          <div class="inf-concl-label">Evaluación profesional</div>
          <div class="inf-concl-text">${latest.conclusion_profesional}</div>
        </div>` : ''}
      ${latest.recomendaciones ? `
        <div class="inf-concl-block" style="border-left-color:var(--cyan);">
          <div class="inf-concl-label" style="color:var(--cyan);">Recomendaciones</div>
          <div class="inf-concl-text">${latest.recomendaciones}</div>
        </div>` : ''}
    </div>`;
}

function _sec9Evolucion(evals) {
  if (evals.length < 2) return '';
  const first  = evals[0];
  const latest = evals[evals.length - 1];
  return `
    <div class="inf-section">
      <div class="inf-section-title"><span class="inf-section-num">09</span> Evolución Histórica (${evals.length} evaluaciones)</div>
      <div class="grid-2 mb-md" style="gap:16px;">
        <div class="inf-chart-card">
          <div class="inf-chart-label">Peso corporal (kg)</div>
          <div style="height:200px;"><canvas id="chartEvolPeso"></canvas></div>
        </div>
        <div class="inf-chart-card">
          <div class="inf-chart-label">% Grasa vs % Muscular</div>
          <div style="height:200px;"><canvas id="chartEvolComp"></canvas></div>
        </div>
      </div>
      <div class="inf-chart-card mb-md">
        <div class="inf-chart-label">Índice de Masa Corporal (IMC)</div>
        <div style="height:180px;"><canvas id="chartEvolIMC"></canvas></div>
      </div>
      <div class="card mb-md" style="overflow-x:auto;">
        <div class="card-title">Comparativo primera vs última evaluación</div>
        <table class="eval-compare-table" style="min-width:480px;margin-top:8px;">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Primera (${first.evaluation_date})</th>
              <th>Última (${latest.evaluation_date})</th>
              <th>Cambio</th>
            </tr>
          </thead>
          <tbody>
            ${_compareRow('Peso', first.weight_kg, latest.weight_kg, 'kg', false)}
            ${_compareRow('IMC', first.imc, latest.imc, '', false)}
            ${_compareRow('% Grasa', first.porcentaje_grasa, latest.porcentaje_grasa, '%', true)}
            ${_compareRow('% Muscular', first.porcentaje_muscular, latest.porcentaje_muscular, '%', false)}
            ${_compareRow('Masa magra', first.masa_magra_kg, latest.masa_magra_kg, 'kg', false)}
            ${_compareRow('Tórax', first.per_torax, latest.per_torax, 'cm', false)}
            ${_compareRow('Abdomen', first.per_abdomen_inferior, latest.per_abdomen_inferior, 'cm', true)}
            ${_compareRow('Cadera', first.per_cadera, latest.per_cadera, 'cm', true)}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ===== CHART RENDERERS =====

function _renderBodyCompDonut(latest) {
  const canvas = document.getElementById('chartBodyComp');
  if (!canvas || latest.porcentaje_grasa == null) return;
  _progresoCharts.bodyComp = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['% Grasa','% Muscular','% Óseo','% Residual'],
      datasets: [{ data: [
        latest.porcentaje_grasa   ?? 0,
        latest.porcentaje_muscular ?? 0,
        latest.porcentaje_oseo    ?? 0,
        latest.porcentaje_residual ?? 0,
      ], backgroundColor: ['#FF3B5C','#00CFFF','#9B59FF','rgba(255,255,255,0.12)'], borderWidth: 0 }]
    },
    options: {
      animation: { duration: 700 },
      plugins: { legend: { display: false } },
      cutout: '65%',
    }
  });
}

function _renderSomatotipoRadar(latest) {
  const canvas = document.getElementById('chartSomatotipo');
  if (!canvas || !latest.endomorfia) return;
  _progresoCharts.soma = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: ['I Endomorfia','II Mesomorfia','III Ectomorfia'],
      datasets: [{
        data: [latest.endomorfia, latest.mesomorfia, latest.ectomorfia],
        backgroundColor: 'rgba(0,207,255,0.15)',
        borderColor: '#00CFFF',
        pointBackgroundColor: '#00CFFF',
        borderWidth: 2,
        pointRadius: 4,
      }]
    },
    options: {
      animation: { duration: 700 },
      scales: { r: { min: 0, max: 8, ticks: { display: false, stepSize: 2 },
        grid: { color: 'rgba(255,255,255,0.06)' },
        pointLabels: { color: '#888', font: { family: 'Outfit', size: 11 } } } },
      plugins: { legend: { display: false } }
    }
  });
}

function _renderPlieguesChart(latest) {
  const canvas = document.getElementById('chartPliegues');
  if (!canvas) return;
  const pliegues = [
    ['Bíceps', latest.pliegue_biceps], ['Tríceps', latest.pliegue_triceps],
    ['Subescapular', latest.pliegue_subescapular], ['Suprailíaco', latest['pliegue_suprailiaco']],
    ['Abdominal', latest.pliegue_abdominal], ['Muslo', latest.pliegue_muslo_anterior],
    ['Pierna', latest.pliegue_pierna_medial], ['Pectoral', latest.pliegue_pectoral],
  ].filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
  if (!pliegues.length) return;
  _progresoCharts.pliegues = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: pliegues.map(([l]) => l),
      datasets: [{ data: pliegues.map(([, v]) => v),
        backgroundColor: 'rgba(0,207,255,0.7)', borderColor: '#00CFFF', borderWidth: 1, borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      animation: { duration: 600 },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { family: 'Outfit', size: 10 } } },
        y: { grid: { display: false }, ticks: { color: '#888', font: { family: 'Outfit', size: 10 } } }
      }
    }
  });
}

function _renderPerimetrosChart(latest, prev) {
  const canvas = document.getElementById('chartPerimetros');
  if (!canvas) return;
  const perPairs = [
    ['Tórax',   latest.per_torax,            prev?.per_torax],
    ['Abdomen', latest.per_abdomen_inferior,  prev?.per_abdomen_inferior],
    ['Cadera',  latest.per_cadera,            prev?.per_cadera],
    ['Bíceps',  latest.per_biceps_contraido,  prev?.per_biceps_contraido],
    ['Muslo',   latest.per_muslo_superior,    prev?.per_muslo_superior],
    ['Pantorr.',latest.per_pantorrilla,       prev?.per_pantorrilla],
  ].filter(([, v]) => v != null);
  if (!perPairs.length) return;
  const datasets = [{ label: 'Actual', data: perPairs.map(([, v]) => v),
    backgroundColor: 'rgba(0,207,255,0.75)', borderColor: '#00CFFF', borderWidth: 1, borderRadius: 4 }];
  if (prev) datasets.unshift({ label: 'Anterior', data: perPairs.map(([,, p]) => p ?? null),
    backgroundColor: 'rgba(0,207,255,0.2)', borderColor: 'rgba(0,207,255,0.4)', borderWidth: 1, borderRadius: 4 });
  _progresoCharts.perimetros = new Chart(canvas, {
    type: 'bar',
    data: { labels: perPairs.map(([l]) => l), datasets },
    options: {
      animation: { duration: 600 },
      plugins: { legend: { display: !!prev, labels: { color: '#666', font: { family: 'Outfit', size: 11 }, boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#888', font: { family: 'Outfit', size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { family: 'Outfit', size: 10 } } }
      }
    }
  });
}

function _renderEvolPesoChart(evals) {
  const canvas = document.getElementById('chartEvolPeso');
  if (!canvas) return;
  const labels = evals.map(e => _formatDate(e.evaluation_date, { month: 'short', day: 'numeric' }));
  _progresoCharts.evolPeso = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Peso (kg)', data: evals.map(e => e.weight_kg),
      borderColor: '#00CFFF', backgroundColor: 'rgba(0,207,255,0.08)', tension: 0.4,
      fill: true, borderWidth: 2, pointBackgroundColor: '#00CFFF', pointRadius: 4 }] },
    options: { ...chartDefaults, plugins: { legend: { display: false } } }
  });
}

function _renderEvolCompChart(evals) {
  const canvas = document.getElementById('chartEvolComp');
  if (!canvas) return;
  const labels = evals.map(e => _formatDate(e.evaluation_date, { month: 'short', day: 'numeric' }));
  _progresoCharts.evolComp = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [
      { label: '% Grasa', data: evals.map(e => e.porcentaje_grasa),
        borderColor: '#FF3B5C', backgroundColor: 'rgba(255,59,92,0.06)',
        tension: 0.4, fill: true, borderWidth: 2, pointBackgroundColor: '#FF3B5C', pointRadius: 4 },
      { label: '% Muscular', data: evals.map(e => e.porcentaje_muscular),
        borderColor: '#39FF7A', backgroundColor: 'rgba(57,255,122,0.06)',
        tension: 0.4, fill: true, borderWidth: 2, pointBackgroundColor: '#39FF7A', pointRadius: 4 },
    ]},
    options: { ...chartDefaults, plugins: { legend: { display: true, labels: { color: '#666', font: { family: 'Outfit', size: 11 }, boxWidth: 12 } } } }
  });
}

function _renderEvolIMCChart(evals) {
  const canvas = document.getElementById('chartEvolIMC');
  if (!canvas) return;
  const labels = evals.map(e => _formatDate(e.evaluation_date, { month: 'short', day: 'numeric' }));
  _progresoCharts.evolIMC = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ label: 'IMC', data: evals.map(e => e.imc),
      borderColor: '#FFD700', backgroundColor: 'rgba(255,215,0,0.06)', tension: 0.4,
      fill: true, borderWidth: 2, pointBackgroundColor: '#FFD700', pointRadius: 4 }] },
    options: { ...chartDefaults, plugins: { legend: { display: false } } }
  });
}

// ===== USER VIEW =====

async function renderMiProgresoUsuario(userId) {
  const container = document.getElementById('progreso-container');
  if (!container) return;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">MI <span class="accent">PROGRESO</span></div>
        <div class="page-sub">Informe cineantropométrico · Composición corporal</div>
      </div>
    </div>
    <div id="user-progreso-content">
      <div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--muted);">Cargando...</div>
    </div>`;

  const [{ data: evals }, { data: userData }] = await Promise.all([
    db.from('body_evaluations').select('*').eq('user_id', userId).order('evaluation_date', { ascending: true }),
    db.from('users').select('full_name').eq('id', userId).single(),
  ]);

  const content = document.getElementById('user-progreso-content');
  if (!content) return;

  if (!evals || evals.length === 0) {
    content.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 32px;">
        <div style="font-size:48px;margin-bottom:16px;">📊</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Aún sin evaluaciones</div>
        <div style="color:var(--muted2);font-size:14px;line-height:1.7;max-width:440px;margin:0 auto;">
          Tu instructor registrará tus métricas de composición corporal en tu próxima sesión de evaluación.
        </div>
      </div>`;
    return;
  }

  _destroyProgresoCharts();

  const latest   = evals[evals.length - 1];
  const prev     = evals.length > 1 ? evals[evals.length - 2] : null;
  const userName = userData?.full_name || '';

  content.innerHTML = `<div class="informe-wrapper">
    ${_sec0Header(latest, evals, userName)}
    ${_sec1Composicion(latest, prev)}
    ${_sec2RossGuimaraes(latest)}
    ${_sec3Somatotipo(latest)}
    ${_sec4Calorias(latest)}
    ${_sec5Medidas(latest, prev)}
    ${_sec6Perimetros(latest, prev)}
    ${_sec7Observaciones(latest)}
    ${_sec8Conclusion(latest)}
    ${_sec9Evolucion(evals)}
  </div>`;

  requestAnimationFrame(() => {
    _renderBodyCompDonut(latest);
    _renderSomatotipoRadar(latest);
    _renderPlieguesChart(latest);
    _renderPerimetrosChart(latest, prev);
    if (evals.length >= 2) {
      _renderEvolPesoChart(evals);
      _renderEvolCompChart(evals);
      _renderEvolIMCChart(evals);
    }
  });
}

// ===== INSTRUCTOR VIEW =====

async function renderMiProgresoInstructor() {
  const container = document.getElementById('progreso-container');
  if (!container) return;

  // Defense in depth — the nav item is already hidden/shown by _applyEvaluacionesNav()
  // per _canAccessEvaluacionesModule(), and server-side RLS/RPCs enforce the same gate
  // regardless (20260820_evaluaciones_role_configurable.sql), but bail out here too in case
  // this page is ever reached directly (e.g. an employee/reception/PS-instructor without the
  // 'evaluaciones' grant, or anyone with evaluaciones_hidden=true).
  if (!_canAccessEvaluacionesModule()) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">EVA<span class="accent">LUACIONES</span></div>
        </div>
      </div>
      <div style="text-align:center;padding:40px;color:var(--muted);">No tienes acceso a evaluaciones.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">EVA<span class="accent">LUACIONES</span></div>
        <div class="page-sub">Evaluación cineantropométrica · Composición corporal</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;height:120px;color:var(--muted);font-size:13px;">Cargando clientes...</div>`;

  // RLS-safe RPC (2026-07-06) — a direct users.select() here was both silently empty for
  // instructors (users_own_row RLS never granted instructor read access to other rows) and,
  // separately, over-selecting `email`, which instructors must never see. See
  // 20260706_evaluaciones_instructor_readonly.sql.
  const { data: users, error: usersErr } = await db.rpc('list_evaluable_members');
  if (usersErr) console.error('list_evaluable_members:', usersErr.message);

  window._evalUsers = users || [];

  const userOptions = (users || []).map(u =>
    `<option value="${u.id}">${u.full_name || u.email}</option>`).join('');

  const pliegueFields = [
    ['ev-p-biceps','Bíceps'],['ev-p-triceps','Tríceps'],
    ['ev-p-subescapular','Subescapular'],['ev-p-suprailiaco','Suprailíaco'],
    ['ev-p-abdominal','Abdominal'],['ev-p-muslo','Muslo anterior'],
    ['ev-p-pierna','Medial de pierna'],['ev-p-pectoral','Pectoral'],
  ];
  const perFields = [
    ['ev-per-torax','Tórax'],['ev-per-abdomen','Abdomen inferior'],
    ['ev-per-cadera','Cadera'],['ev-per-biceps-rel','Bíceps relajado'],
    ['ev-per-biceps-con','Bíceps contraído'],['ev-per-muslo','Muslo superior'],
    ['ev-per-pantorrilla','Pantorrilla'],
  ];

  const mkInput = (id, label, ph, oninput = '') =>
    `<div class="form-group" style="margin:0;">
      <label class="form-label">${label}</label>
      <input class="form-input" type="number" id="${id}" step="0.1" placeholder="${ph}" ${oninput ? `oninput="${oninput}"` : ''}>
    </div>`;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">EVA<span class="accent">LUACIONES</span></div>
        <div class="page-sub">Evaluación cineantropométrica · Composición corporal</div>
      </div>
    </div>

    <div class="card mb-md">
      <div class="card-title">Seleccionar Cliente</div>
      <div class="grid-2" style="gap:12px;align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Filtrar por nombre</label>
          <input class="form-input" type="text" id="eval-search" placeholder="Escribe para filtrar..."
            oninput="filtrarUsuariosEval(this.value)">
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">Cliente</label>
          <select class="form-input" id="eval-user-select" onchange="onEvalUserChange(this.value)">
            <option value="">— Selecciona un cliente —</option>
            ${userOptions}
          </select>
        </div>
      </div>
      <div id="eval-user-summary" style="display:none;margin-top:14px;padding:12px 16px;background:var(--card2);border-radius:8px;border:1px solid var(--border2);font-size:13px;"></div>
    </div>

    <div id="eval-form-wrap" style="display:none;">

      <!-- 1. DATOS BÁSICOS -->
      <div class="card mb-md">
        <div class="card-title">1 · Datos Básicos</div>
        <div class="grid-3" style="gap:12px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Fecha de evaluación</label>
            <input class="form-input" type="date" id="ev-date" value="${_bogotaToday()}">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Fecha de nacimiento</label>
            <input class="form-input" type="date" id="ev-fecha-nacimiento"
              oninput="(function(){const edad=calcularEdadDecimal(document.getElementById('ev-fecha-nacimiento').value);const el=document.getElementById('ev-age');if(el&&edad!=null)el.value=edad;onEvalInput();})()">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Edad decimal</label>
            <input class="form-input" type="number" id="ev-age" step="0.01" placeholder="18.10" oninput="onEvalInput()">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Peso (kg)</label>
            <input class="form-input" type="number" id="ev-weight" step="0.1" placeholder="56.3" oninput="onEvalInput()">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Talla (m)</label>
            <input class="form-input" type="number" id="ev-height" step="0.001" placeholder="1.570" oninput="onEvalInput()">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Sexo</label>
            <select class="form-input" id="ev-gender" onchange="onEvalInput()">
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Período de entrenamiento</label>
            <input class="form-input" type="text" id="ev-period" placeholder="GRAL">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Deporte / Actividad</label>
            <input class="form-input" type="text" id="ev-sport" placeholder="Gym">
          </div>
        </div>
      </div>

      <!-- 2. DIÁMETROS ÓSEOS -->
      <div class="card mb-md">
        <div class="card-title">2 · Diámetros Óseos (cm)</div>
        <div class="grid-3" style="gap:12px;">
          ${mkInput('ev-diam-humeral','Biepicondilar humeral','5.5','onEvalInput()')}
          ${mkInput('ev-diam-radio','Radiocubital','4.2')}
          ${mkInput('ev-diam-femoral','Biepicondilar femoral','7.7','onEvalInput()')}
        </div>
      </div>

      <!-- 3. PLIEGUES CUTÁNEOS -->
      <div class="card mb-md">
        <div class="card-title">3 · Pliegues Cutáneos (mm)</div>
        <div class="grid-3" style="gap:12px;">
          ${pliegueFields.map(([id, label]) => mkInput(id, label, '—', 'onEvalInput()')).join('')}
        </div>
      </div>

      <!-- 4. PERÍMETROS MUSCULARES -->
      <div class="card mb-md">
        <div class="card-title">4 · Perímetros Musculares (cm)</div>
        <div class="grid-3" style="gap:12px;">
          ${perFields.map(([id, label]) => mkInput(id, label, '—', 'onEvalInput()')).join('')}
        </div>
      </div>

      <!-- 5. COMPOSICIÓN CALCULADA (live) -->
      <div class="card mb-md" style="border-color:rgba(0,207,255,0.2);background:linear-gradient(135deg,rgba(0,207,255,0.04),var(--card));">
        <div class="card-title">5 · Composición Corporal (Calculada)</div>
        <div id="eval-calc-display">
          <div style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">
            Completa datos básicos y pliegues para ver cálculos en tiempo real
          </div>
        </div>
      </div>

      <!-- 6. SOMATOTIPO -->
      <div class="card mb-md">
        <div class="card-title">6 · Somatotipo Heath-Carter</div>
        <div class="grid-3" style="gap:12px;">
          ${mkInput('ev-endo','I – Endomorfia','3.60','onEvalInput()')}
          ${mkInput('ev-meso','II – Mesomorfia','2.61','onEvalInput()')}
          ${mkInput('ev-ecto','III – Ectomorfia','1.41','onEvalInput()')}
          ${mkInput('ev-eje-x','Eje X (ecto − endo)','—')}
          ${mkInput('ev-eje-y','Eje Y (2meso − endo − ecto)','—')}
        </div>
      </div>

      <!-- 7. OBSERVACIONES MÉDICAS -->
      <div class="card mb-md">
        <div class="card-title">7 · Observaciones Médicas</div>
        <div class="form-group" style="margin:0;">
          <textarea class="form-input" id="ev-observaciones" rows="4"
            placeholder="Lesiones previas, restricciones, antecedentes relevantes..."></textarea>
        </div>
      </div>

      <!-- 8. CONCLUSIÓN -->
      <div class="card mb-md">
        <div class="card-title">8 · Conclusión y Recomendaciones</div>
        <div class="grid-2" style="gap:12px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">Conclusión general</label>
            <textarea class="form-input" id="ev-conclusion-general" rows="5"
              placeholder="Resumen ejecutivo del estado actual del atleta..."></textarea>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Evaluación profesional</label>
            <textarea class="form-input" id="ev-conclusion" rows="5"
              placeholder="Evaluación detallada de composición corporal..."></textarea>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Recomendaciones generales</label>
            <textarea class="form-input" id="ev-recomendaciones" rows="5"
              placeholder="Mantener entrenamiento de fuerza mínimo 3–4 veces por semana..."></textarea>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Kcal actividad excesiva (opcional)</label>
            <input class="form-input" type="number" id="ev-kcal-excesiva" step="1" placeholder="2800">
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-bottom:32px;">
        ${_instructorCanEditEvals()
          ? ''
          : '<span style="font-size:12px;color:var(--muted);">Solo lectura — un administrador debe habilitarte edición de evaluaciones</span>'}
        <button class="btn btn-secondary" onclick="resetEvalForm()">Limpiar</button>
        <button class="btn btn-primary" id="eval-save-btn" onclick="guardarEvaluacion()"
          ${_instructorCanEditEvals() ? '' : 'disabled'}>+ Guardar Evaluación</button>
      </div>
    </div>`;
}

// Read-only/edit gate — generalized Fase 3.4 (2026-08-20), name kept for the existing call
// sites. Admin always passes. Anyone else must first clear the module-level gate
// (_canAccessEvaluacionesModule() — vinculado instructor by default, or an explicit
// 'evaluaciones' grant for a PS instructor/employee/reception), then additionally needs
// users.can_edit_evaluations = true — same tri-state composition described at
// _canAccessEvaluacionesModule(). Mirrors can_edit_evaluaciones() in
// 20260820_evaluaciones_role_configurable.sql server-side.
function _instructorCanEditEvals() {
  if (currentUser?.role === 'admin') return true;
  return _canAccessEvaluacionesModule() && !!currentUser?.can_edit_evaluations;
}

function filtrarUsuariosEval(query) {
  const select = document.getElementById('eval-user-select');
  if (!select || !window._evalUsers) return;
  const q = query.toLowerCase();
  select.innerHTML = '<option value="">— Selecciona un cliente —</option>' +
    window._evalUsers
      .filter(u => (u.full_name || u.email || '').toLowerCase().includes(q))
      .map(u => `<option value="${u.id}">${u.full_name || u.email}</option>`)
      .join('');
}

async function onEvalUserChange(userId) {
  const summaryEl = document.getElementById('eval-user-summary');
  const formWrap  = document.getElementById('eval-form-wrap');
  if (!userId) {
    if (summaryEl) summaryEl.style.display = 'none';
    if (formWrap)  formWrap.style.display  = 'none';
    return;
  }

  if (formWrap) formWrap.style.display = 'block';
  if (summaryEl) {
    summaryEl.style.display = 'block';
    summaryEl.innerHTML = '<span style="color:var(--muted)">Buscando última evaluación...</span>';
  }

  const [{ data: last }, { data: userProfileRows }] = await Promise.all([
    db.from('body_evaluations')
      .select('evaluation_date, weight_kg, imc, porcentaje_grasa, porcentaje_muscular, fecha_nacimiento')
      .eq('user_id', userId)
      .order('evaluation_date', { ascending: false })
      .limit(1)
      .single(),
    // RLS-safe RPC (2026-07-06) — see 20260706_evaluaciones_instructor_readonly.sql.
    // Returns birth_date + full_name only, never email/phone; callable by admin+instructor.
    db.rpc('get_member_evaluation_context', { member_id: userId }),
  ]);
  const userProfile = userProfileRows?.[0] || null;

  if (summaryEl) {
    if (last) {
      summaryEl.innerHTML = `
        <span style="color:var(--muted2);font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Última evaluación:</span>
        <span style="color:var(--white);margin-left:8px;">${last.evaluation_date}</span>
        ${last.weight_kg ? `<span style="margin-left:16px;color:var(--cyan);">${last.weight_kg} kg</span>` : ''}
        ${last.imc ? `<span style="margin-left:12px;color:var(--muted2);">IMC ${last.imc}</span>` : ''}
        ${last.porcentaje_grasa ? `<span style="margin-left:12px;color:var(--muted2);">Grasa ${last.porcentaje_grasa}%</span>` : ''}
        ${last.porcentaje_muscular ? `<span style="margin-left:12px;color:var(--muted2);">Músculo ${last.porcentaje_muscular}%</span>` : ''}`;
    } else {
      summaryEl.innerHTML = '<span style="color:var(--muted);">Sin evaluaciones previas — esta será la primera.</span>';
    }
  }

  // Pre-fill birth date: prefer users.birth_date (authoritative), fall back to
  // the value stored in the last evaluation if the profile field is empty.
  const birthDate = userProfile?.birth_date || last?.fecha_nacimiento;
  const dobEl = document.getElementById('ev-fecha-nacimiento');
  if (dobEl && birthDate) {
    dobEl.value = String(birthDate).slice(0, 10);
    const edad = calcularEdadDecimal(dobEl.value);
    const ageEl = document.getElementById('ev-age');
    if (ageEl && edad != null) ageEl.value = edad;
    onEvalInput();
  }
}

function _getEvalFormData() {
  const fv = id => { const el = document.getElementById(id); return el ? el.value : null; };
  const fn = id => { const v = fv(id); return (v === '' || v == null) ? null : parseFloat(v); };
  return {
    fecha_nacimiento:        fv('ev-fecha-nacimiento') || null,
    weight_kg:               fn('ev-weight'),
    height_m:                fn('ev-height'),
    age_decimal:             fn('ev-age'),
    sexo:                    fv('ev-gender'),
    sport:                   fv('ev-sport'),
    training_period:         fv('ev-period'),
    diam_humeral:            fn('ev-diam-humeral'),
    diam_radiocubital:       fn('ev-diam-radio'),
    diam_femoral:            fn('ev-diam-femoral'),
    pliegue_biceps:          fn('ev-p-biceps'),
    pliegue_triceps:         fn('ev-p-triceps'),
    pliegue_subescapular:    fn('ev-p-subescapular'),
    'pliegue_suprailiaco':   fn('ev-p-suprailiaco'),
    pliegue_abdominal:       fn('ev-p-abdominal'),
    pliegue_muslo_anterior:  fn('ev-p-muslo'),
    pliegue_pierna_medial:   fn('ev-p-pierna'),
    pliegue_pectoral:        fn('ev-p-pectoral'),
    per_torax:               fn('ev-per-torax'),
    per_abdomen_inferior:    fn('ev-per-abdomen'),
    per_cadera:              fn('ev-per-cadera'),
    per_biceps_relajado:     fn('ev-per-biceps-rel'),
    per_biceps_contraido:    fn('ev-per-biceps-con'),
    per_muslo_superior:      fn('ev-per-muslo'),
    per_pantorrilla:         fn('ev-per-pantorrilla'),
    endomorfia:              fn('ev-endo'),
    mesomorfia:              fn('ev-meso'),
    ectomorfia:              fn('ev-ecto'),
    eje_x:                   fn('ev-eje-x'),
    eje_y:                   fn('ev-eje-y'),
    observaciones_medicas:   fv('ev-observaciones'),
    conclusion_general:      fv('ev-conclusion-general'),
    conclusion_profesional:  fv('ev-conclusion'),
    recomendaciones:         fv('ev-recomendaciones'),
    kcal_excesiva:           fn('ev-kcal-excesiva'),
  };
}

function onEvalInput() {
  const raw = _getEvalFormData();
  if (raw.endomorfia != null && raw.mesomorfia != null && raw.ectomorfia != null) {
    const exEl = document.getElementById('ev-eje-x');
    const eyEl = document.getElementById('ev-eje-y');
    if (exEl && !exEl.value) exEl.value = +(raw.ectomorfia - raw.endomorfia).toFixed(3);
    if (eyEl && !eyEl.value) eyEl.value = +(2 * raw.mesomorfia - raw.endomorfia - raw.ectomorfia).toFixed(3);
  }
  const calcs = calcularComposicionCorporal(raw, raw.sexo);
  _renderCalcDisplay(calcs, raw.sexo);
}

function _renderCalcDisplay(c, sexo) {
  const el = document.getElementById('eval-calc-display');
  if (!el) return;

  const hasData = c.porcentaje_grasa != null || c.imc != null;
  if (!hasData) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px;">Completa datos básicos y pliegues para ver cálculos en tiempo real</div>';
    return;
  }

  const row = (label, val, unit) => `
    <div class="eval-calc-item">
      <div class="eval-calc-label">${label}</div>
      <div class="eval-calc-value">${val ?? '—'}</div>
      <div class="eval-calc-unit">${unit}</div>
    </div>`;

  const imcCls  = clasificarIMC(c.imc);
  const grasCls = clasificarGrasa(c.porcentaje_grasa, sexo);
  const ccCls   = clasificarCinturaCadera(c.relacion_cintura_cadera, sexo);

  el.innerHTML = `
    <div class="eval-calc-grid">
      ${row('IMC', c.imc, imcCls.texto)}
      ${row('Suma 6 pliegues', c.suma_6_pliegues, 'mm')}
      ${row('% Grasa', c.porcentaje_grasa, grasCls.texto + ' %')}
      ${row('% Muscular', c.porcentaje_muscular, '%')}
      ${row('Peso graso', c.peso_graso_kg, 'kg')}
      ${row('Peso muscular', c.peso_muscular_kg, 'kg')}
      ${row('Peso óseo', c.peso_oseo_kg, 'kg')}
      ${row('Masa magra', c.masa_magra_kg, 'kg')}
      ${row('Cintura/Cadera', c.relacion_cintura_cadera, ccCls.texto)}
      ${row('Peso ideal', c.peso_ideal_kg, 'kg')}
      ${row('TMB 24h', c.tmb_24h, 'kcal')}
      ${row('Kcal moderada', c.kcal_moderada, 'kcal/día')}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      ${c.imc ? `<span class="badge ${imcCls.cls}">IMC: ${imcCls.texto}</span>` : ''}
      ${c.porcentaje_grasa != null ? `<span class="badge ${grasCls.cls}">Grasa: ${grasCls.texto}</span>` : ''}
      ${c.relacion_cintura_cadera != null ? `<span class="badge ${ccCls.cls}">Cin/Cad: ${ccCls.texto}</span>` : ''}
    </div>`;
}

function resetEvalForm() {
  ['ev-fecha-nacimiento','ev-weight','ev-height','ev-age','ev-period','ev-sport',
   'ev-diam-humeral','ev-diam-radio','ev-diam-femoral',
   'ev-p-biceps','ev-p-triceps','ev-p-subescapular','ev-p-suprailiaco',
   'ev-p-abdominal','ev-p-muslo','ev-p-pierna','ev-p-pectoral',
   'ev-per-torax','ev-per-abdomen','ev-per-cadera',
   'ev-per-biceps-rel','ev-per-biceps-con','ev-per-muslo','ev-per-pantorrilla',
   'ev-endo','ev-meso','ev-ecto','ev-eje-x','ev-eje-y',
   'ev-observaciones','ev-conclusion-general','ev-conclusion','ev-recomendaciones','ev-kcal-excesiva',
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  onEvalInput();
}

async function guardarEvaluacion() {
  // UI-level gate mirroring the DB-level one (instructor_insert_evaluations_if_granted /
  // instructor_update_evaluations_if_granted in 20260706_evaluaciones_instructor_readonly.sql)
  // — the RLS policy is the real enforcement; this just avoids a raw permission-denied
  // error reaching an instructor who hasn't been granted write access.
  if (!_instructorCanEditEvals()) {
    toast('Sin permiso', 'Un administrador debe habilitarte edición de evaluaciones');
    return;
  }

  const userId = document.getElementById('eval-user-select')?.value;
  if (!userId) { toast('Falta cliente', 'Selecciona un cliente antes de guardar'); return; }

  const raw   = _getEvalFormData();
  const calcs = calcularComposicionCorporal(raw, raw.sexo);

  const ejeX = raw.eje_x ?? (raw.ectomorfia != null && raw.endomorfia != null
    ? +(raw.ectomorfia - raw.endomorfia).toFixed(3) : null);
  const ejeY = raw.eje_y ?? (raw.mesomorfia != null && raw.endomorfia != null && raw.ectomorfia != null
    ? +(2 * raw.mesomorfia - raw.endomorfia - raw.ectomorfia).toFixed(3) : null);
  const kcalExcesiva = raw.kcal_excesiva ?? (calcs.tmb_24h ? +(calcs.tmb_24h * 1.9).toFixed(0) : null);

  const payload = {
    user_id:                 userId,
    evaluated_by:            currentUser?.id,
    evaluation_date:         document.getElementById('ev-date')?.value || _bogotaToday(),
    fecha_nacimiento:        raw.fecha_nacimiento || null,
    weight_kg:               raw.weight_kg,
    height_m:                raw.height_m,
    age_decimal:             raw.age_decimal,
    sexo:                    raw.sexo,
    sport:                   raw.sport || null,
    training_period:         raw.training_period || null,
    diam_humeral:            raw.diam_humeral,
    diam_radiocubital:       raw.diam_radiocubital,
    diam_femoral:            raw.diam_femoral,
    pliegue_biceps:          raw.pliegue_biceps,
    pliegue_triceps:         raw.pliegue_triceps,
    pliegue_subescapular:    raw.pliegue_subescapular,
    'pliegue_suprailiaco':   raw['pliegue_suprailiaco'],
    pliegue_abdominal:       raw.pliegue_abdominal,
    pliegue_muslo_anterior:  raw.pliegue_muslo_anterior,
    pliegue_pierna_medial:   raw.pliegue_pierna_medial,
    pliegue_pectoral:        raw.pliegue_pectoral,
    per_torax:               raw.per_torax,
    per_abdomen_inferior:    raw.per_abdomen_inferior,
    per_cadera:              raw.per_cadera,
    per_biceps_relajado:     raw.per_biceps_relajado,
    per_biceps_contraido:    raw.per_biceps_contraido,
    per_muslo_superior:      raw.per_muslo_superior,
    per_pantorrilla:         raw.per_pantorrilla,
    endomorfia:              raw.endomorfia,
    mesomorfia:              raw.mesomorfia,
    ectomorfia:              raw.ectomorfia,
    eje_x:                   ejeX,
    eje_y:                   ejeY,
    observaciones_medicas:   raw.observaciones_medicas || null,
    conclusion_general:      raw.conclusion_general || null,
    conclusion_profesional:  raw.conclusion_profesional || null,
    recomendaciones:         raw.recomendaciones || null,
    kcal_excesiva:           kcalExcesiva,
    suma_6_pliegues:         calcs.suma_6_pliegues ?? null,
    imc:                     calcs.imc ?? null,
    porcentaje_grasa:        calcs.porcentaje_grasa ?? null,
    peso_graso_kg:           calcs.peso_graso_kg ?? null,
    peso_muscular_kg:        calcs.peso_muscular_kg ?? null,
    porcentaje_muscular:     calcs.porcentaje_muscular ?? null,
    peso_oseo_kg:            calcs.peso_oseo_kg ?? null,
    porcentaje_oseo:         calcs.porcentaje_oseo ?? null,
    porcentaje_residual:     calcs.porcentaje_residual ?? null,
    masa_magra_kg:           calcs.masa_magra_kg ?? null,
    peso_ideal_kg:           calcs.peso_ideal_kg ?? null,
    relacion_cintura_cadera: calcs.relacion_cintura_cadera ?? null,
    tmb_24h:                 calcs.tmb_24h ?? null,
    kcal_ligera:             calcs.kcal_ligera ?? null,
    kcal_moderada:           calcs.kcal_moderada ?? null,
    kcal_alta:               calcs.kcal_alta ?? null,
    clasificacion_grasa:     calcs.clasificacion_grasa || null,
    clasificacion_imc:       calcs.clasificacion_imc || null,
    clasificacion_cintura_cadera: calcs.clasificacion_cintura_cadera || null,
  };

  const btn = document.getElementById('eval-save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  const { error } = await db.from('body_evaluations').insert(payload);

  if (btn) { btn.disabled = false; btn.textContent = '+ Guardar Evaluación'; }

  if (error) {
    toast('Error al guardar', error.message);
  } else {
    toast('Evaluación guardada', `Registro para ${window._evalUsers?.find(u => u.id === userId)?.full_name || 'cliente'} guardado correctamente`);
    resetEvalForm();
    onEvalUserChange(userId);
  }
}

function _destroyProgresoCharts() {
  Object.keys(_progresoCharts).forEach(k => { _progresoCharts[k]?.destroy(); delete _progresoCharts[k]; });
}

function _compareRow(label, a, b, unit, lowerIsBetter) {
  if (a == null && b == null) return '';
  const aFmt = a != null ? `${_fmtNum(a,1)}${unit ? ' '+unit : ''}` : '—';
  const bFmt = b != null ? `${_fmtNum(b,1)}${unit ? ' '+unit : ''}` : '—';
  let deltaHtml = '—';
  if (a != null && b != null) {
    const d = +(b - a).toFixed(2);
    if (d !== 0) {
      const positive = lowerIsBetter ? d < 0 : d > 0;
      deltaHtml = `<span class="${positive ? 'eval-delta-pos' : 'eval-delta-neg'}">${d > 0 ? '+' : ''}${d}${unit ? ' '+unit : ''} ${d > 0 ? '↑' : '↓'}</span>`;
    } else {
      deltaHtml = '<span style="color:var(--muted)">Sin cambio</span>';
    }
  }
  return `<tr><td>${label}</td><td>${aFmt}</td><td>${bFmt}</td><td>${deltaHtml}</td></tr>`;
}

// ---- Horario page ----

async function loadHorarioPage(userId) {
  const grid = document.getElementById('schedule-grid');
  if (!grid) return;

  const monday   = _getMonday();
  const saturday = new Date(monday + 'T12:00:00');
  saturday.setDate(saturday.getDate() + 5);
  const saturdayStr = saturday.toISOString().split('T')[0];

  const [schedRes, bookRes] = await Promise.all([
    db.from('schedule').select('id, class_date, start_time, spots_available, is_cancelled, classes(name, type, color)').gte('class_date', monday).lte('class_date', saturdayStr).eq('is_cancelled', false).order('start_time'),
    userId ? db.from('bookings').select('schedule_id, status').eq('user_id', userId).neq('status', 'cancelled') : { data: [] }
  ]);

  const schedule  = schedRes.data  || [];
  const bookedIds = new Set((bookRes.data || []).map(b => b.schedule_id));

  // Organise: dayOffset(0=Mon..5=Sat) → timeSlot → entries[]
  const slots     = ['05:00','06:00','07:00','08:00','17:00','18:00','19:00','20:00'];
  const slotLabel = ['5 AM','6 AM','7 AM','8 AM','5 PM','6 PM','7 PM','8 PM'];
  const gridMap   = {};
  schedule.forEach(s => {
    const d   = new Date(s.class_date + 'T12:00:00');
    const day = (d.getDay() + 6) % 7; // Mon=0, Sat=5
    if (day > 5) return;
    const hour = s.start_time.slice(0, 5);
    if (!gridMap[day]) gridMap[day] = {};
    if (!gridMap[day][hour]) gridMap[day][hour] = [];
    gridMap[day][hour].push(s);
  });

  const typeMap = { funcional:'sch-func', pilates:'sch-pilates', cycling:'sch-riding', riding:'sch-riding' };

  let html = `<div class="sch-head"></div><div class="sch-head">LUN</div><div class="sch-head">MAR</div><div class="sch-head">MIÉ</div><div class="sch-head">JUE</div><div class="sch-head">VIE</div><div class="sch-head">SÁB</div>`;

  slots.forEach((slot, ti) => {
    html += `<div class="sch-time">${slotLabel[ti]}</div>`;
    for (let d = 0; d < 6; d++) {
      const entries = gridMap[d]?.[slot] || [];
      if (!entries.length) { html += '<div class="sch-cell"></div>'; continue; }
      const cells = entries.map(s => {
        const t    = (s.classes?.type || s.classes?.name || '').toLowerCase();
        const cls  = typeMap[t] || 'sch-func';
        const name = s.classes?.name || 'Clase';
        const isBooked = bookedIds.has(s.id);
        const shortName = name.length > 8 ? name.slice(0,7) + '.' : name;
        return `<div class="sch-class ${cls}" onclick="openReservaModal('${name}','${shortName} ${slotLabel[ti]}','${s.spots_available}')">${shortName}${isBooked ? ' ✓' : ''}</div>`;
      }).join('');
      html += `<div class="sch-cell">${cells}</div>`;
    }
  });

  grid.innerHTML = html;
}

// ---- Planes page ----

async function loadPlanesPage() {
  const grid    = document.getElementById('plan-grid');
  const extGrid = document.getElementById('extended-plan-grid');
  if (!grid) return;

  const loader = `<div style="grid-column:1/-1;text-align:center;padding:32px 0;">${_loader('Cargando planes...')}</div>`;
  grid.innerHTML = loader;
  if (extGrid) extGrid.innerHTML = loader;

  const { data: raw, error } = await db.from('plans').select('*').eq('is_active', true).order('price_cop');

  if (error || !raw?.length) {
    const msg = `<div style="grid-column:1/-1;text-align:center;padding:32px 0;color:var(--muted);">No hay planes disponibles en este momento.</div>`;
    grid.innerHTML = msg;
    if (extGrid) extGrid.innerHTML = '';
    return;
  }

  // Deduplicate by name — keep first occurrence (lowest price, since ordered by price_cop)
  const seen = new Set();
  const plans = raw.filter(p => {
    const key = (p.name || '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Split: extended = trimestral/semestral/anualidad; rest = mensualidades
  const extendedKw = ['trimest', 'semest', 'anual'];
  const isExtended = p => extendedKw.some(k => (p.name || '').toLowerCase().includes(k));
  const mensual    = plans.filter(p => !isExtended(p));
  const extended   = plans.filter(p =>  isExtended(p));

  // Fallback: show Anualidad if not yet in DB
  if (!extended.some(p => (p.name || '').toLowerCase().includes('anual'))) {
    extended.push({
      id: '__anualidad_fallback__',
      name: 'Anualidad',
      price_cop: 1300000,
      description: 'Acceso únicamente a clases funcionales.\n6 clases de PILATES incluidas.',
      pilates_credits: null
    });
  }

  const renderCards = (list, showPeriod) => {
    if (!list.length) return '';
    return list.map(plan => {
      const features = (plan.description || '').split('\n').filter(Boolean);
      if (plan.pilates_credits) features.push(`${plan.pilates_credits} clases de Pilates / mes`);
      return `<div class="plan-card">
        <div class="plan-name">${plan.name}</div>
        <div class="plan-price">${_formatCOP(plan.price_cop)}</div>
        ${showPeriod ? '<div class="plan-period">/ mes</div>' : ''}
        <ul class="plan-features">${features.map(f => `<li>${f}</li>`).join('')}</ul>
        <button class="btn btn-ghost" style="width:100%;" onclick="window.open('https://wa.me/573202219103','_blank')">Contratar</button>
      </div>`;
    }).join('');
  };

  grid.innerHTML = mensual.length ? renderCards(mensual, true) : `<div style="grid-column:1/-1;color:var(--muted);padding:24px 0;">No hay mensualidades activas.</div>`;
  if (extGrid) extGrid.innerHTML = renderCards(extended, false);
}

// ---- Pagos page ----

function _misPagosDescargarDesprendible(paymentId) {
  const payment = window._misPagosCache?.[paymentId];
  if (!payment) return;
  descargarDesprendiblePago(payment);
}

async function loadPagosPage(userId) {
  const setEl  = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val ?? '—'; };
  const setHTML = (id, val) => { const e = document.getElementById(id); if (e) e.innerHTML  = val; };
  const ctaEl  = document.getElementById('pagos-pago-cta');

  const [membership, paymentsRes] = await Promise.all([
    getMembership(userId),
    db.from('payments').select('*, plans(name)').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  ]);
  const payments = paymentsRes.data || [];

  // — Sin membresía activa —
  if (!membership) {
    setEl('pagos-plan-name', 'Sin plan activo');
    setEl('pagos-plan-price', '—');
    setEl('pagos-end-date', '—');
    setEl('pagos-count', '0');
    setEl('pagos-total-value', '—');
    setEl('pagos-cycle-value', '—');
    if (ctaEl) ctaEl.innerHTML = `
      <div class="card" style="text-align:center;padding:28px 20px;">
        <div style="font-size:36px;margin-bottom:10px;">🏋️</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:6px;">Sin membresía activa</div>
        <div style="color:var(--muted);font-size:13px;margin-bottom:18px;line-height:1.5;">
          Contáctanos para activar o renovar tu membresía.
        </div>
        <a href="https://wa.me/573202219103" target="_blank" class="btn btn-primary btn-sm">💬 Contactar al gym</a>
      </div>`;
    const tbody = document.getElementById('pagos-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px 0;">Sin historial de pagos</td></tr>';
    return;
  }

  // — Plan activo —
  setEl('pagos-plan-name',  membership.plans?.name || '—');
  setEl('pagos-plan-price', _formatCOP(membership.plans?.price_cop));
  setEl('pagos-end-date',   _formatDate(membership.end_date, { day:'numeric', month:'long', year:'numeric' }));

  // Ciclo actual
  const start   = parseLocalDate(membership.start_date);
  const end     = parseLocalDate(membership.end_date);
  const total   = Math.max(1, Math.round((end - start) / 86400000));
  const elapsed = Math.max(0, Math.min(total, Math.round((new Date() - start) / 86400000)));
  setEl('pagos-cycle-value', elapsed);
  const barEl = document.getElementById('pagos-cycle-bar');
  if (barEl) barEl.style.width = Math.round(elapsed / total * 100) + '%';
  setEl('pagos-cycle-label', `Día ${elapsed} de ${total} · vence ${_formatDate(membership.end_date, { day:'numeric', month:'short' })}`);

  // Stats
  const approved  = payments.filter(p => p.status === 'approved');
  const totalPaid = approved.reduce((s, p) => s + (p.amount_cop || 0), 0);
  setEl('pagos-count',        approved.length);
  setEl('pagos-count-change', membership.start_date ? `Miembro desde ${_formatDate(membership.start_date, { month:'short', year:'numeric' })}` : '');
  setEl('pagos-total-value',  totalPaid ? _formatCOP(totalPaid) : '—');
  setEl('pagos-total-change', membership.plans?.name ? `${membership.plans.name} · ${approved.length} ciclos` : '');

  // CTA: mostrar botón de pago si vence en < 7 días o ya expiró
  window._wompiMembership = membership;
  const today        = new Date(); today.setHours(0, 0, 0, 0);
  const daysToExpiry = Math.round((end - today) / 86400000);
  const isExpired    = end < today;

  if (ctaEl) {
    if (daysToExpiry < 7) {
      const urgency = isExpired
        ? `<span style="color:var(--red);font-weight:700;">⚠️ Tu membresía venció hace ${Math.abs(daysToExpiry)} día${Math.abs(daysToExpiry) !== 1 ? 's' : ''}</span>`
        : `<span style="color:var(--amber);font-weight:700;">⏰ Vence en ${daysToExpiry} día${daysToExpiry !== 1 ? 's' : ''}</span>`;
      ctaEl.innerHTML = `
        <div class="card card-cyan" style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 22px;">
          <div>
            ${urgency}
            <div style="font-size:12px;color:var(--muted);margin-top:3px;">${membership.plans?.name || ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
            <button class="btn btn-primary" id="btn-pagar-wompi" onclick="initWompiPayment()">
              💳 Renovar · ${_formatCOP(membership.plans?.price_cop)}
            </button>
            <div id="pagos-verificar-cta" style="display:none;">
              <button class="btn btn-ghost btn-sm" onclick="loadPagosPage('${userId}')">🔄 Verificar estado del pago</button>
            </div>
          </div>
        </div>
        <div id="pagos-wompi-widget-area" style="margin-top:8px;"></div>`;
    } else {
      ctaEl.innerHTML = '';
    }
  }

  // Historial de pagos
  const tbody = document.getElementById('pagos-tbody');
  if (!tbody) return;

  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px 0;">Sin historial de pagos</td></tr>';
    return;
  }

  const badge = {
    approved: '<span class="badge badge-green">Pagado</span>',
    pending:  '<span class="badge badge-amber">Pendiente</span>',
    declined: '<span class="badge badge-red">Fallido</span>',
    voided:   '<span class="badge badge-muted">Anulado</span>',
  };

  tbody.innerHTML = payments.map((p, i) => {
    const dateRef  = p.paid_at || p.created_at;
    const period   = new Date(dateRef).toLocaleDateString('es-CO', { month:'long', year:'numeric' });
    const date     = p.paid_at ? _formatDate(p.paid_at, { day:'numeric', month:'short', year:'numeric' }) : '— —';
    const amount   = p.amount_cop ? '$' + p.amount_cop.toLocaleString('es-CO') : '—';
    const amtColor = p.status === 'approved' ? 'var(--green)' : p.status === 'declined' ? 'var(--red)' : 'var(--amber)';
    const method   = p.method ? `<br><span style="color:var(--muted2);font-size:10px;letter-spacing:1px;text-transform:uppercase;">${p.method}</span>` : '';
    const num      = String(payments.length - i).padStart(3, '0');
    window._misPagosCache = window._misPagosCache || {};
    if (p.receipt_number) {
      window._misPagosCache[p.id] = { ...p, userName: currentUser?.full_name || currentUser?.name, userIdentification: currentUser?.identification, planName: p.plans?.name };
    }
    const dlBtn = p.receipt_number
      ? `<button class="btn btn-ghost btn-sm" onclick="_misPagosDescargarDesprendible('${p.id}')">⬇</button>`
      : '<span style="color:var(--muted2);">—</span>';
    return `<tr>
      <td style="color:var(--muted);font-family:'Outfit',sans-serif;font-weight:500;letter-spacing:1px;font-size:12px;">#${num}</td>
      <td style="text-transform:capitalize;">${period}</td>
      <td style="color:${amtColor};font-family:'Outfit',sans-serif;font-weight:700;font-size:16px;">${amount}${method}</td>
      <td style="color:var(--muted);">${date}</td>
      <td>${badge[p.status] || `<span class="badge">${p.status}</span>`}</td>
      <td>${dlBtn}</td>
    </tr>`;
  }).join('');
}

// ===================== WOMPI PAYMENT =====================

const WOMPI_PUBLIC_KEY = 'pub_test_58Ze4JuAzgum713lkdHyozT0vUeNEv01';

async function initWompiPayment() {
  const membership = window._wompiMembership;
  if (!membership?.plans) { toast('Error', 'Datos de membresía no disponibles'); return; }

  const btn = document.getElementById('btn-pagar-wompi');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Preparando pago...'; }

  try {
    const userId        = currentUser.id;
    const reference     = `THOR-${userId.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const amountInCents = membership.plans.price_cop * 100;

    // 1. Obtener firma de integridad desde Edge Function
    const { data: sigData, error: sigErr } = await db.functions.invoke('wompi-signature', {
      body: { reference, amountInCents, currency: 'COP', membership_id: membership.id },
    });
    if (sigErr || !sigData?.signature) throw new Error('No se pudo obtener la firma de pago');

    // 2. Registrar pago pendiente en Supabase
    const { error: payErr } = await db.from('payments').insert({
      user_id:       userId,
      membership_id: membership.id,
      amount_cop:    membership.plans.price_cop,
      status:        'pending',
      wompi_ref:     reference,
    });
    if (payErr) throw new Error('No se pudo registrar el pago: ' + payErr.message);

    // 3. Inyectar widget de Wompi y abrir checkout
    _openWompiWidget({
      publicKey:    WOMPI_PUBLIC_KEY,
      currency:     'COP',
      amountInCents,
      reference,
      signature:    sigData.signature,
      redirectUrl:  window.location.href,
    });

    // 4. Mostrar botón de verificación post-pago
    const verifyCta = document.getElementById('pagos-verificar-cta');
    if (verifyCta) verifyCta.style.display = 'block';

    if (btn) { btn.disabled = false; btn.textContent = '💳 Renovar · ' + _formatCOP(membership.plans.price_cop); }

  } catch (err) {
    toast('Error al iniciar pago', err.message || 'Intenta de nuevo');
    if (btn) { btn.disabled = false; btn.textContent = '💳 Renovar · ' + _formatCOP(membership?.plans?.price_cop); }
  }
}

function _openWompiWidget({ publicKey, currency, amountInCents, reference, signature, redirectUrl }) {
  // Área de inyección definida en el CTA
  const area = document.getElementById('pagos-wompi-widget-area');
  if (!area) return;

  area.innerHTML = '';

  const form = document.createElement('form');
  area.appendChild(form);

  const script = document.createElement('script');
  script.src = 'https://checkout.wompi.co/widget.js';
  script.setAttribute('data-render',             'button');
  script.setAttribute('data-public-key',          publicKey);
  script.setAttribute('data-currency',            currency);
  script.setAttribute('data-amount-in-cents',     String(amountInCents));
  script.setAttribute('data-reference',           reference);
  script.setAttribute('data-signature:integrity', signature);
  if (redirectUrl) script.setAttribute('data-redirect-url', redirectUrl);

  script.onload = () => {
    // Esperar a que Wompi renderice su botón y hacer clic automático
    setTimeout(() => {
      const wompiBtn = form.querySelector('button');
      if (wompiBtn) wompiBtn.click();
    }, 400);
  };

  form.appendChild(script);
}

// ===================== NOTICIAS =====================

let _newsPosts     = [];
let _editingPostId = null;

// --- Admin ---

async function loadAdminNoticiasPage() {
  const container = document.getElementById('admin-noticias-list');
  if (!container) return;
  container.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';

  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="color:var(--red);padding:20px;text-align:center;">${error.message}</div>`;
    return;
  }
  _newsPosts = data || [];
  _renderAdminNewsList();
}

function _renderAdminNewsList() {
  const container = document.getElementById('admin-noticias-list');
  if (!container) return;

  if (!_newsPosts.length) {
    container.innerHTML = `
      <div class="card" style="text-align:center;padding:60px 20px;color:var(--muted);">
        <i data-lucide="newspaper" style="width:40px;height:40px;stroke-width:1;opacity:0.3;margin-bottom:12px;"></i>
        <div style="font-size:14px;margin-top:8px;">No hay noticias todavía</div>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  container.innerHTML = _newsPosts.map(p => {
    const rawDate  = p.post_date || p.created_at;
    const date     = rawDate ? _formatDate(rawDate, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const img      = p.image_url ? `<img src="${_escHtml(p.image_url)}" alt="" style="width:100%;max-height:320px;object-fit:cover;border-radius:8px;margin-bottom:14px;display:block;" onerror="this.style.display='none'">` : '';
    const bodyHtml = _escHtml(p.body || '').replace(/\n/g, '<br>');
    const safeId   = p.id;
    return `
      <div class="card" style="margin-bottom:16px;" id="news-row-${safeId}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;">
          <span style="font-size:11px;font-weight:600;letter-spacing:1px;color:${p.published ? 'var(--cyan)' : 'var(--muted2)'};">${p.published ? '● PUBLICADO' : '○ BORRADOR'}</span>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <label class="toggle-switch" title="Visible para miembros">
              <input type="checkbox" ${p.published ? 'checked' : ''} onchange="toggleNewsPublished('${safeId}')">
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
            </label>
            <button class="btn btn-outline btn-sm" onclick="openNewsForm('${safeId}')">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="deleteNewsPost('${safeId}')">Eliminar</button>
          </div>
        </div>
        ${img}
        <div style="font-weight:700;font-size:17px;color:var(--white);margin-bottom:10px;">${_escHtml(p.title || '')}</div>
        ${bodyHtml ? `<div style="font-size:13px;color:var(--muted);line-height:1.75;">${bodyHtml}</div>` : ''}
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border2);font-size:11px;color:var(--muted2);">${date}</div>
      </div>`;
  }).join('');
}

async function toggleNewsPublished(id) {
  const post = _newsPosts.find(p => p.id === id);
  if (!post) return;
  const newVal = !post.published;
  const { error } = await db.from('news_posts').update({ published: newVal }).eq('id', id);
  if (error) {
    toast('Error', error.message);
    _renderAdminNewsList();
    return;
  }
  post.published = newVal;
  const cb = document.querySelector(`#news-row-${id} input[type=checkbox]`);
  if (cb) cb.checked = newVal;
}

async function deleteNewsPost(id) {
  const post = _newsPosts.find(p => p.id === id);
  if (!post) return;
  if (!confirm(`¿Eliminar "${post.title}"? Esta acción no se puede deshacer.`)) return;
  const { error } = await db.from('news_posts').delete().eq('id', id);
  if (error) { toast('Error', error.message); return; }
  toast('Eliminada', `"${post.title}" fue eliminada`);
  _newsPosts = _newsPosts.filter(p => p.id !== id);
  _renderAdminNewsList();
}

let _newsSelectedFile  = null;
let _newsRemoveImage   = false;

function _onNewsImageSelected(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Archivo muy grande', 'La imagen no puede superar 5 MB'); input.value = ''; return; }
  _newsSelectedFile = file;
  _newsRemoveImage  = false;
  const label = document.getElementById('news-drop-label');
  if (label) label.textContent = file.name;
  const preview = document.getElementById('news-img-preview');
  const wrap    = document.getElementById('news-img-preview-wrap');
  if (preview) preview.src = URL.createObjectURL(file);
  if (wrap)    wrap.style.display = 'block';
  const zone = document.getElementById('news-drop-zone');
  if (zone) zone.style.display = 'none';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _clearNewsImage() {
  _newsSelectedFile = null;
  _newsRemoveImage  = true;
  const input   = document.getElementById('news-form-imagen-file');
  const wrap    = document.getElementById('news-img-preview-wrap');
  const preview = document.getElementById('news-img-preview');
  const label   = document.getElementById('news-drop-label');
  const zone    = document.getElementById('news-drop-zone');
  if (input)   input.value = '';
  if (preview) { preview.src = ''; }
  if (wrap)    wrap.style.display = 'none';
  if (label)   label.textContent = 'Haz clic para subir una imagen';
  if (zone)    zone.style.display = 'block';
}

function openNewsForm(postId = null) {
  _editingPostId    = postId;
  _newsSelectedFile = null;
  const post = postId ? _newsPosts.find(p => p.id === postId) : null;

  document.getElementById('news-form-modal-title').textContent = post ? 'EDITAR NOTICIA' : 'PUBLICAR NOTICIA';
  document.getElementById('news-form-titulo').value      = post?.title     || '';
  document.getElementById('news-form-cuerpo').value      = post?.body      || '';
  document.getElementById('news-form-publicado').checked = post ? post.published : true;
  _newsRemoveImage = false;
  document.getElementById('news-form-imagen-file').value = '';
  document.getElementById('news-upload-progress').style.display = 'none';

  // Fecha: si hay post usa su post_date/created_at, si no usa hoy
  const rawDate = post?.post_date || post?.created_at || new Date().toISOString();
  document.getElementById('news-form-fecha').value = rawDate.slice(0, 10);

  const label   = document.getElementById('news-drop-label');
  const preview = document.getElementById('news-img-preview');
  const wrap    = document.getElementById('news-img-preview-wrap');
  const zone    = document.getElementById('news-drop-zone');
  if (label) label.textContent = 'Haz clic para subir una imagen';

  if (post?.image_url) {
    if (preview) preview.src = post.image_url;
    if (wrap)    wrap.style.display = 'block';
    if (zone)    zone.style.display = 'none';
  } else {
    if (preview) preview.src = '';
    if (wrap)    wrap.style.display = 'none';
    if (zone)    zone.style.display = 'block';
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
  openModal('news-form');
}

async function _uploadNewsImage(file) {
  const ext  = file.name.split('.').pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from('news').upload(path, file, { upsert: false });
  if (error) throw new Error(`Error al subir imagen: ${error.message}`);
  const { data } = db.storage.from('news').getPublicUrl(path);
  return data.publicUrl;
}

async function saveNewsPost() {
  const title     = (document.getElementById('news-form-titulo').value || '').trim();
  const body      = (document.getElementById('news-form-cuerpo').value || '').trim() || null;
  const published = document.getElementById('news-form-publicado').checked;
  const post_date = document.getElementById('news-form-fecha').value || _bogotaToday();

  if (!title) { toast('Campo requerido', 'El título es obligatorio'); return; }

  const btn      = document.getElementById('btn-news-save');
  const progress = document.getElementById('news-upload-progress');
  if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }

  try {
    let image_url = _editingPostId ? (_newsPosts.find(p => p.id === _editingPostId)?.image_url || null) : null;
    if (_newsRemoveImage) image_url = null;

    if (_newsSelectedFile) {
      if (progress) progress.style.display = 'block';
      image_url = await _uploadNewsImage(_newsSelectedFile);
      if (progress) progress.style.display = 'none';
    }

    // Try saving with post_date; fall back without it if the column doesn't exist yet
    let error;
    const withDate    = _editingPostId
      ? { title, body, image_url, published, post_date, updated_at: new Date().toISOString() }
      : { title, body, image_url, published, post_date, created_by: currentUser.id };
    const withoutDate = _editingPostId
      ? { title, body, image_url, published, updated_at: new Date().toISOString() }
      : { title, body, image_url, published, created_by: currentUser.id };

    if (_editingPostId) {
      ({ error } = await db.from('news_posts').update(withDate).eq('id', _editingPostId));
    } else {
      ({ error } = await db.from('news_posts').insert(withDate));
    }

    // If column missing, retry without post_date
    if (error?.message?.includes('post_date')) {
      if (_editingPostId) {
        ({ error } = await db.from('news_posts').update(withoutDate).eq('id', _editingPostId));
      } else {
        ({ error } = await db.from('news_posts').insert(withoutDate));
      }
    }

    if (error) throw error;

    toast('¡Listo!', _editingPostId ? 'Noticia actualizada' : 'Noticia publicada');
    closeModal('modal-news-form');
    _newsSelectedFile = null;
    loadAdminNoticiasPage();
  } catch (err) {
    if (progress) progress.style.display = 'none';
    toast('Error', err.message || 'No se pudo guardar');
  } finally {
    if (btn) { btn.textContent = 'Publicar'; btn.disabled = false; }
  }
}

// --- Noticias CTA on dashboard ---

async function _loadNoticiasCTA() {
  const cta     = document.getElementById('noticias-cta');
  const preview = document.getElementById('noticias-cta-preview');
  const badge   = document.getElementById('noticias-badge');
  if (!cta) return;

  const { data } = await db
    .from('news_posts')
    .select('title, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(5);

  const posts = data || [];
  if (!posts.length) return;

  if (preview && posts[0].title) preview.textContent = posts[0].title;

  // Badge: solo mostrar posts más nuevos que la última visita
  const lastSeen   = localStorage.getItem('thor_noticias_seen') || '';
  const newPosts   = lastSeen ? posts.filter(p => (p.created_at || '') > lastSeen) : posts;
  if (badge && newPosts.length) {
    badge.textContent = newPosts.length;
    badge.style.display = 'inline-flex';
  }

  cta.style.display = 'block';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// --- User feed ---

async function loadNoticiasUsuarioPage() {
  const feed = document.getElementById('noticias-feed');
  if (!feed) return;
  feed.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';

  const { data, error } = await db
    .from('news_posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (error) {
    feed.innerHTML = `<div style="color:var(--red);padding:20px;text-align:center;">${error.message}</div>`;
    return;
  }

  const posts = data || [];
  if (!posts.length) {
    feed.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--muted);">
        <i data-lucide="newspaper" style="width:40px;height:40px;stroke-width:1;opacity:0.3;margin-bottom:12px;"></i>
        <div style="font-size:14px;">No hay noticias por el momento</div>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  // Mark as seen — clear badge
  localStorage.setItem('thor_noticias_seen', new Date().toISOString());
  const badge = document.getElementById('noticias-badge');
  if (badge) badge.style.display = 'none';

  feed.innerHTML = posts.map(p => {
    const img      = p.image_url ? `<img src="${_escHtml(p.image_url)}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:8px;margin-bottom:14px;display:block;" onerror="this.style.display='none'">` : '';
    const rawDate  = p.post_date || p.created_at;
    const date     = rawDate ? _formatDate(rawDate, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const bodyHtml = _escHtml(p.body || '').replace(/\n/g, '<br>');
    return `
      <div class="card" style="margin-bottom:16px;">
        ${img}
        <div style="font-weight:700;font-size:16px;color:var(--white);margin-bottom:8px;">${_escHtml(p.title || '')}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.7;">${bodyHtml}</div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border2);font-size:11px;color:var(--muted2);">${date}</div>
      </div>`;
  }).join('');
}

// ===================== NOTIFICATIONS =====================

let _notifCount        = 0;
let _notifChannel      = null;
let _notifPollInterval = null;

function _setNotifBadge(n) {
  _notifCount = Math.max(0, n);
  const label = _notifCount > 99 ? '99+' : String(_notifCount);

  // Avatar badge (all roles)
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent   = label;
    badge.style.display = _notifCount > 0 ? 'flex' : 'none';
  }

  // Instructor sidebar bell badge
  const instBadge = document.getElementById('inst-notif-cnt');
  if (instBadge) {
    instBadge.textContent   = label;
    instBadge.style.display = _notifCount > 0 ? '' : 'none';
  }
}

async function initNotifications(userId) {
  const { count } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  _setNotifBadge(count ?? 0);

  _notifChannel = db.channel('user-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      _setNotifBadge(_notifCount + 1);
      toast(payload.new.title || 'Nueva notificación', payload.new.body || '');
    })
    .subscribe();
}

function _teardownNotifications() {
  if (_notifChannel)      { db.removeChannel(_notifChannel); _notifChannel = null; }
  if (_notifPollInterval) { clearInterval(_notifPollInterval); _notifPollInterval = null; }
  _setNotifBadge(0);
}

// ── Instructor notification dropdown ─────────────────────────────────────────

async function toggleInstNotifDropdown() {
  const panel = document.getElementById('inst-notif-panel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    panel.style.display = '';
    await _loadInstNotifDropdown();
  } else {
    panel.style.display = 'none';
  }
}

async function _loadInstNotifDropdown() {
  const list = document.getElementById('inst-notif-list');
  if (!list || !currentUser) return;
  list.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:8px;">Cargando…</div>`;

  const { data: notifs, error } = await db
    .from('notifications')
    .select('id, title, body, created_at')
    .eq('user_id', currentUser.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !notifs?.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:10px;">Sin notificaciones pendientes 🔔</div>`;
    return;
  }

  list.innerHTML = notifs.map(n => `
    <div id="inst-nrow-${n.id}" style="padding:8px 4px;border-bottom:1px solid var(--border);">
      <div style="font-size:11px;font-weight:700;color:var(--white);margin-bottom:2px;">${_escHtml(n.title || '')}</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.4;margin-bottom:5px;">${_escHtml(n.body || '')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:10px;color:var(--muted2);">${_tiempoRelativo(n.created_at)}</span>
        <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 6px;" onclick="marcarLeidoInst('${n.id}')">Marcar leída</button>
      </div>
    </div>`).join('');
}

async function marcarLeidoInst(notifId) {
  const { error } = await db.from('notifications').update({ read: true }).eq('id', notifId);
  if (error) { toast('Error', error.message); return; }
  _setNotifBadge(_notifCount - 1);
  const row = document.getElementById('inst-nrow-' + notifId);
  if (row) row.remove();
  const list = document.getElementById('inst-notif-list');
  if (list && !list.querySelector('[id^="inst-nrow-"]')) {
    list.innerHTML = `<div style="color:var(--muted);font-size:12px;text-align:center;padding:10px;">Sin notificaciones pendientes 🔔</div>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function _tiempoRelativo(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'ahora';
  if (mins  < 60) return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours} hora${hours !== 1 ? 's' : ''}`;
  if (days  === 1) return 'ayer';
  if (days  < 7)  return `hace ${days} días`;
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadNotificacionesPage() {
  const container = document.getElementById('notif-list-container');
  if (!container || !currentUser) return;
  container.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';

  const { data: notifs, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div style="color:var(--red);padding:20px;text-align:center;">${error.message}</div>`;
    return;
  }
  _renderNotifList(notifs || []);
}

function _renderNotifList(notifs) {
  const container  = document.getElementById('notif-list-container');
  const markAllBtn = document.getElementById('btn-marcar-todas');
  if (!container) return;

  if (!notifs.length) {
    if (markAllBtn) markAllBtn.style.display = 'none';
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:var(--muted);">
        <div style="font-size:40px; margin-bottom:12px;">🔔</div>
        <div style="font-size:14px;">No tienes notificaciones aún</div>
      </div>`;
    return;
  }

  const hasUnread = notifs.some(n => !n.read);
  if (markAllBtn) markAllBtn.style.display = hasUnread ? '' : 'none';

  container.innerHTML = notifs.map(n => `
    <div class="notif-row" id="notif-row-${n.id}" onclick="marcarLeido('${n.id}')">
      <div class="notif-dot${n.read ? ' read' : ''}" id="notif-dot-${n.id}"></div>
      <div style="flex:1; min-width:0;">
        <div id="notif-title-${n.id}" style="font-weight:${n.read ? '500' : '700'}; font-size:13px; color:${n.read ? 'var(--muted)' : 'var(--white)'};">${_escHtml(n.title || '')}</div>
        <div style="font-size:12px; color:var(--muted); margin-top:3px; line-height:1.5;">${_escHtml(n.body || '')}</div>
      </div>
      <div style="font-size:11px; color:var(--muted2); white-space:nowrap; padding-left:12px; flex-shrink:0;">${_tiempoRelativo(n.created_at)}</div>
    </div>`).join('');
}

async function marcarLeido(id) {
  const dot = document.getElementById('notif-dot-' + id);
  if (!dot || dot.classList.contains('read')) return;

  const { error } = await db.from('notifications').update({ read: true }).eq('id', id);
  if (error) return;

  dot.classList.add('read');
  const titleEl = document.getElementById('notif-title-' + id);
  if (titleEl) { titleEl.style.fontWeight = '500'; titleEl.style.color = 'var(--muted)'; }
  _setNotifBadge(_notifCount - 1);
  const markAllBtn = document.getElementById('btn-marcar-todas');
  if (markAllBtn && _notifCount === 0) markAllBtn.style.display = 'none';
}

async function marcarTodoLeido() {
  if (!currentUser) return;
  const { error } = await db.from('notifications')
    .update({ read: true })
    .eq('user_id', currentUser.id)
    .eq('read', false);
  if (error) { toast('Error', error.message); return; }
  _setNotifBadge(0);
  loadNotificacionesPage();
}

// ===================== INIT =====================

document.getElementById('user-nav').style.display        = 'none';
document.getElementById('admin-nav').style.display       = 'none';
document.getElementById('employee-nav').style.display    = 'none';
// ===================== VAULT (BÓVEDA) =====================

function openVaultAuth() {
  const emailEl = document.getElementById('vault-auth-email');
  if (currentUser) emailEl.value = currentUser.email || '';
  document.getElementById('vault-auth-password').value = '';
  document.getElementById('vault-auth-error').textContent = '';
  const btn = document.getElementById('vault-auth-btn');
  btn.disabled = false;
  btn.textContent = '🔓 Verificar y entrar';
  openModal('vault-auth');
  setTimeout(() => document.getElementById('vault-auth-password').focus(), 120);
}

async function doVaultAuth() {
  const email    = document.getElementById('vault-auth-email').value.trim();
  const password = document.getElementById('vault-auth-password').value;
  const errEl    = document.getElementById('vault-auth-error');
  const btn      = document.getElementById('vault-auth-btn');

  if (!password) { errEl.textContent = 'Ingresa tu contraseña'; return; }

  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Verificando...';

  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    closeModal('modal-vault-auth');
    showPage('admin-boveda');
    document.querySelector('.vault-nav-item')?.classList.add('active');
  } catch (e) {
    errEl.textContent = 'Contraseña incorrecta. Intenta de nuevo.';
    btn.disabled = false;
    btn.textContent = '🔓 Verificar y entrar';
    document.getElementById('vault-auth-password').value = '';
    document.getElementById('vault-auth-password').focus();
  }
}

// ===================== SOLICITUDES DEL PERSONAL =====================

let _solicitudesChannel = null;

async function _refreshSolicitudesBadge() {
  const badge = document.getElementById('solicitudes-badge');
  if (!badge) return;
  try {
    const { count } = await db
      .from('staff_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pendiente');
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (_) {
    badge.style.display = 'none';
  }
}

function _subscribeToSolicitudesRealtime() {
  if (_solicitudesChannel) return;
  _solicitudesChannel = db
    .channel('solicitudes-badge')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_requests' },
      () => _refreshSolicitudesBadge())
    .subscribe();
}

// Task G: admin/reception badge for "needs action" items — pending cuentas de cobro
// (instructor_billing.status = 'pending') and unreviewed monthly Seguridad Social
// submissions (seguridad_social_submissions.reviewed = false). Deliberately NOT driven
// by notifications.read — that flips true the moment a row is opened/clicked in the
// generic notification list, before anyone actually reviewed or paid anything. This
// badge only clears when the underlying domain status changes (paid / reviewed).
let _pendingReviewChannel = null;

async function _refreshPendingReviewBadge() {
  const badge = document.getElementById('pending-review-badge');
  if (!badge) return;
  try {
    const [{ count: billingCount }, { count: ssCount }] = await Promise.all([
      db.from('instructor_billing').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('seguridad_social_submissions').select('*', { count: 'exact', head: true }).eq('reviewed', false),
    ]);
    const total = (billingCount || 0) + (ssCount || 0);
    if (total > 0) {
      badge.textContent = total;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (_) {
    badge.style.display = 'none';
  }
}

function _subscribePendingReviewRealtime() {
  if (_pendingReviewChannel) return;
  _pendingReviewChannel = db
    .channel('pending-review-badge')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'instructor_billing' },
      () => _refreshPendingReviewBadge())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'seguridad_social_submissions' },
      () => _refreshPendingReviewBadge())
    .subscribe();
}

// Where the pending-review badge (above) sends the user when clicked. Admin still goes to
// the full Personal tab (unchanged). Reception no longer has access to Personal (it exposes
// bank account numbers and other staff HR fields) — they get a read-only summary instead,
// with no instructor bank/HR data and no approve/pay/mark-reviewed actions.
function abrirPendingReviewBadge() {
  if (currentUser?.role === 'admin') {
    showPage('admin-personal');
  } else if (currentUser?.role === 'reception') {
    loadPendientesResumen();
    openModal('pendientes-resumen');
  }
}

// Reception-safe summary: instructor name, what's pending, and since when — nothing else.
// Sourced from get_pending_review_summary(), a SECURITY DEFINER RPC that returns only these
// three columns (see supabase/migrations/20260703_reception_users_rls_narrow.sql) — reception
// cannot read instructor rows directly (bank_account_number, id_number, etc.) via the users
// table anymore, so this RPC is the only way this data reaches them, and it hard-caps the
// column set regardless of what the underlying tables contain.
async function loadPendientesResumen() {
  const container = document.getElementById('pendientes-resumen-list');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const { data, error } = await db.rpc('get_pending_review_summary');
    if (error) throw error;

    if (!data?.length) {
      container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px 0;text-align:center;">No hay nada pendiente de revisión.</div>';
      return;
    }

    const typeLabel = { cuenta_de_cobro: 'Cuenta de cobro', seguridad_social: 'Seguridad Social' };
    const typeIcon  = { cuenta_de_cobro: '💰', seguridad_social: '🩺' };

    container.innerHTML = data.map(item => {
      const since = item.since_date
        ? new Date(item.since_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="font-size:18px;">${typeIcon[item.item_type] || '📄'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${_escHtml(item.instructor_name || 'Instructor')}</div>
          <div style="font-size:12px;color:var(--muted);">${typeLabel[item.item_type] || item.item_type} · pendiente desde ${since}</div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = `<div style="color:var(--red);font-size:12px;padding:12px 0;">Error al cargar: ${err.message}</div>`;
  }
}

// Fire-and-forget: notify every active admin/reception user of an event related to an
// instructor (new cuenta de cobro, new Seguridad Social monthly submission). This inserts
// into the generic `notifications` feed for visibility/history — the persistent "needs
// action" signal itself is the separate pending-review badge above, not this insert's
// read/unread state.
//
// Routed through the notify_admins_and_reception() RPC (SECURITY DEFINER, see
// supabase/migrations/20260703_notify_admins_reception_rpc.sql) instead of querying `users`
// directly: this function is called from the INSTRUCTOR's own session, and an instructor
// has never had RLS read access to admin/reception rows in `users` (users_own_row only
// matches their own row) — the old direct-query version silently found zero staff and
// never inserted anything. The RPC does the lookup+insert internally under elevated
// privileges, so instructors don't need any broader users-table access for this to work.
async function _notifyAdminsAndReception(title, body) {
  try {
    await db.rpc('notify_admins_and_reception', { p_title: title, p_body: body });
  } catch (_) { /* best-effort — never block the upload flow on this */ }
}

const _solicitudTipoLabel = {
  vacaciones: 'Vacaciones',
  permiso:    'Permiso',
  prestamo:   'Préstamo',
  otro:       'Otro',
};

const _solicitudStatusBadge = {
  pendiente: 'badge-amber',
  aprobada:  'badge-green',
  rechazada: 'badge-red',
};

let _solicitudesAll    = [];
let _solicitudesFilter = 'todas';

// ── Instructor view ────────────────────────────────────────────

async function loadInstructorSolicitudesPage() {
  const list = document.getElementById('instructor-solicitudes-list');
  if (!list || !currentUser) return;
  list.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';
  try {
    const { data, error } = await db
      .from('staff_requests')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    _renderInstructorSolicitudes(data || []);
  } catch (err) {
    console.error('[Thor] loadInstructorSolicitudesPage:', err);
    list.innerHTML = `<div style="color:var(--red);padding:20px;">Error al cargar los datos. Intenta de nuevo.<br><small style="opacity:.6;">${err?.message || err}</small></div>`;
  }
}

function _renderInstructorSolicitudes(requests) {
  const list = document.getElementById('instructor-solicitudes-list');
  if (!list) return;

  if (!requests.length) {
    list.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:var(--muted);">
      No tienes solicitudes todavía.<br>
      <span style="font-size:12px;">Usa el botón <strong>+ Nueva solicitud</strong> para crear una.</span>
    </div>`;
    return;
  }

  list.innerHTML = requests.map(req => {
    const label      = _solicitudTipoLabel[req.request_type] || req.request_type;
    const badgeClass = _solicitudStatusBadge[req.status]     || 'badge-muted';
    const statusTxt  = req.status.charAt(0).toUpperCase() + req.status.slice(1);
    const createdAt  = new Date(req.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

    const datesHtml = (req.requested_start_date || req.requested_end_date)
      ? `<div style="font-size:12px;color:var(--muted2);margin-top:5px;">📅 ${req.requested_start_date ? _formatDate(req.requested_start_date) : '—'} → ${req.requested_end_date ? _formatDate(req.requested_end_date) : '—'}</div>`
      : '';

    const attachHtml = req.attachment_url
      ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="viewRequestAttachment('${req.attachment_url}')">📎 Ver adjunto</button>`
      : '';

    const respHtml = req.admin_response
      ? `<div style="margin-top:10px;padding:10px 14px;background:rgba(0,207,255,0.06);border-left:3px solid var(--cyan);border-radius:0 6px 6px 0;font-size:12px;line-height:1.5;">
           <span style="color:var(--muted);display:block;margin-bottom:3px;font-size:11px;letter-spacing:.5px;">RESPUESTA DEL ADMINISTRADOR</span>
           ${req.admin_response}
         </div>`
      : '';

    return `<div class="card" style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="badge badge-cyan" style="font-size:11px;">${label}</span>
          <span style="font-size:12px;color:var(--muted);">${createdAt}</span>
        </div>
        <span class="badge ${badgeClass}">${statusTxt}</span>
      </div>
      <div style="margin:9px 0 4px;font-size:13px;line-height:1.55;">${req.description}</div>
      ${datesHtml}${attachHtml}${respHtml}
    </div>`;
  }).join('');
}

function abrirNuevaSolicitud() {
  const el = id => document.getElementById(id);
  if (el('sr-tipo'))        el('sr-tipo').value        = 'vacaciones';
  if (el('sr-descripcion')) el('sr-descripcion').value = '';
  if (el('sr-fecha-inicio')) el('sr-fecha-inicio').value = '';
  if (el('sr-fecha-fin'))   el('sr-fecha-fin').value   = '';
  if (el('sr-adjunto'))     el('sr-adjunto').value     = '';
  openModal('nueva-solicitud');
}

async function submitNuevaSolicitud() {
  const tipo       = document.getElementById('sr-tipo')?.value;
  const desc       = (document.getElementById('sr-descripcion')?.value || '').trim();
  const fechaIni   = document.getElementById('sr-fecha-inicio')?.value || null;
  const fechaFin   = document.getElementById('sr-fecha-fin')?.value   || null;
  const fileInput  = document.getElementById('sr-adjunto');
  const file       = fileInput?.files?.[0] || null;

  if (!desc) { toast('Campo requerido', 'Escribe una descripción'); return; }

  const btn = document.getElementById('btn-enviar-solicitud');
  if (btn) { btn.textContent = 'Enviando…'; btn.disabled = true; }

  try {
    let attachmentUrl = null;
    if (file) {
      const path = `${currentUser.id}/${Date.now()}_${_sanitizeLegalFileName(file.name)}`;
      const { error: storageErr } = await db.storage
        .from('staff-requests')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (storageErr) throw storageErr;
      attachmentUrl = path;
    }

    const { error } = await db.from('staff_requests').insert({
      user_id:              currentUser.id,
      request_type:         tipo,
      description:          desc,
      requested_start_date: fechaIni,
      requested_end_date:   fechaFin,
      attachment_url:       attachmentUrl,
      status:               'pendiente',
    });
    if (error) throw error;

    closeModal('modal-nueva-solicitud');
    toast('Solicitud enviada', 'El administrador la revisará pronto');
    loadInstructorSolicitudesPage();
  } catch (err) {
    // Fix 5: log full error object so we can distinguish RLS vs. missing bucket vs. schema error
    console.error('[Thor] submitNuevaSolicitud error:', JSON.stringify(err, null, 2));
    const hint = err?.code === '42501'
      ? 'Política de seguridad (RLS). Contacta al administrador del sistema.'
      : err?.message || 'Intenta de nuevo';
    toast('Error al enviar', hint);
  } finally {
    if (btn) { btn.textContent = 'Enviar solicitud'; btn.disabled = false; }
  }
}

async function viewRequestAttachment(storagePath) {
  try {
    const { data, error } = await db.storage
      .from('staff-requests')
      .createSignedUrl(storagePath, 3600);
    if (error) throw error;
    window.open(data.signedUrl, '_blank');
  } catch (err) {
    toast('Error al abrir adjunto', err.message || 'No se pudo generar el enlace');
  }
}

// ── Admin view ─────────────────────────────────────────────────

async function loadAdminSolicitudesPage() {
  const container = document.getElementById('admin-solicitudes-list');
  if (!container) return;
  container.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';
  try {
    const { data, error } = await db
      .from('staff_requests')
      .select('*, users!user_id(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    _solicitudesAll = data || [];
    _applyAdminSolicitudesFilter();
  } catch (err) {
    console.error('[Thor] loadAdminSolicitudesPage:', err);
    container.innerHTML = `<div style="color:var(--red);padding:20px;">Error al cargar los datos. Intenta de nuevo.<br><small style="opacity:.6;">${err?.message || err}</small></div>`;
  }
}

function _setSolicitudesFilter(filter) {
  _solicitudesFilter = filter;
  document.querySelectorAll('.sol-chip').forEach(c =>
    c.classList.toggle('uf-chip-active', c.dataset.filter === filter)
  );
  _applyAdminSolicitudesFilter();
}

function _applyAdminSolicitudesFilter() {
  const container = document.getElementById('admin-solicitudes-list');
  if (!container) return;
  const q = (document.getElementById('solicitudes-search')?.value || '').toLowerCase().trim();

  const filtered = _solicitudesAll.filter(r => {
    if (_solicitudesFilter !== 'todas' && r.status !== _solicitudesFilter) return false;
    if (q && !(r.users?.full_name || '').toLowerCase().includes(q)) return false;
    return true;
  });

  if (!filtered.length) {
    container.innerHTML = '<div style="padding:32px;color:var(--muted);text-align:center;">No hay solicitudes para los filtros seleccionados.</div>';
    return;
  }

  container.innerHTML = filtered.map(req => {
    const label      = _solicitudTipoLabel[req.request_type] || req.request_type;
    const staffName  = req.users?.full_name || 'Instructor';
    const badgeClass = _solicitudStatusBadge[req.status]     || 'badge-muted';
    const statusTxt  = req.status.charAt(0).toUpperCase() + req.status.slice(1);
    const createdAt  = new Date(req.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });

    const datesHtml = (req.requested_start_date || req.requested_end_date)
      ? `<div style="font-size:12px;color:var(--muted2);margin-top:5px;">📅 ${req.requested_start_date ? _formatDate(req.requested_start_date) : '—'} → ${req.requested_end_date ? _formatDate(req.requested_end_date) : '—'}</div>`
      : '';

    const attachHtml = req.attachment_url
      ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="viewRequestAttachment('${req.attachment_url}')">📎 Ver adjunto</button>`
      : '';

    const prevRespHtml = req.admin_response
      ? `<div style="margin-top:8px;padding:8px 12px;background:rgba(0,207,255,0.06);border-radius:6px;font-size:12px;"><span style="color:var(--muted);">Respuesta actual:</span> ${req.admin_response}</div>`
      : '';

    return `<div class="card" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div>
          <span style="font-weight:600;font-size:14px;">${staffName}</span>
          <span class="badge badge-cyan" style="margin-left:8px;font-size:11px;">${label}</span>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">${createdAt}</div>
        </div>
        <span class="badge ${badgeClass}">${statusTxt}</span>
      </div>
      <div style="margin:10px 0 4px;font-size:13px;line-height:1.55;">${req.description}</div>
      ${datesHtml}${attachHtml}${prevRespHtml}
      <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
        <textarea id="sol-resp-${req.id}" class="form-input"
          placeholder="Respuesta del administrador (opcional)…"
          style="width:100%;box-sizing:border-box;resize:vertical;min-height:64px;margin-bottom:8px;">${req.admin_response || ''}</textarea>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="responderSolicitud('${req.id}','aprobada')">✓ Aprobar</button>
          <button class="btn btn-danger btn-sm"  onclick="responderSolicitud('${req.id}','rechazada')">✗ Rechazar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function responderSolicitud(id, newStatus) {
  const respEl   = document.getElementById(`sol-resp-${id}`);
  const response = (respEl?.value || '').trim() || null;

  document.querySelectorAll(`button[onclick*="responderSolicitud('${id}'"]`)
    .forEach(b => { b.disabled = true; });

  try {
    const { error } = await db.from('staff_requests').update({
      status:         newStatus,
      admin_response: response,
      responded_by:   currentUser?.id || null,
      responded_at:   new Date().toISOString(),
    }).eq('id', id);
    if (error) throw error;
    toast(newStatus === 'aprobada' ? 'Solicitud aprobada' : 'Solicitud rechazada', response || '');
    loadAdminSolicitudesPage();
    _refreshSolicitudesBadge();
  } catch (err) {
    toast('Error al responder', err.message || 'Intenta de nuevo');
    document.querySelectorAll(`button[onclick*="responderSolicitud('${id}'"]`)
      .forEach(b => { b.disabled = false; });
  }
}

// ===================== DOCUMENTOS LEGALES =====================

const _LEGAL_DOC_TYPES = [
  { document_type: 'camara_comercio',  document_name: 'Cámara de Comercio' },
  { document_type: 'usos_suelo',       document_name: 'Concepto de Usos del Suelo' },
  { document_type: 'bomberos',         document_name: 'Concepto de Seguridad de Bomberos' },
  { document_type: 'secretaria_salud', document_name: 'Concepto Sanitario — Secretaría de Salud' },
  { document_type: 'apertura_policia', document_name: 'Comunicación de Apertura — Comandante de Policía' },
  { document_type: 'fumigacion',       document_name: 'Certificado de Fumigación' },
  { document_type: 'sst',             document_name: 'SST — Seguridad y Salud en el Trabajo' },
];

let _legalDocsData  = [];  // legal_documents rows (categories)
let _legalDocsFiles = [];  // legal_document_files rows (actual files)

// Same mobile-share-link bug as REDES_SOCIALES_DRIVE_URL above (see _normalizeDriveFolderUrl).
const SST_DRIVE_URL = _normalizeDriveFolderUrl('https://drive.google.com/drive/u/0/mobile/folders/1BY4RcbuioI8uhnwnV0DnrAlCDSO405hF?usp=sharing_eip_se_dm&ts=6a876e3f');

// Strips special chars from a filename so Supabase Storage accepts it as a key.
function _sanitizeLegalFileName(name) {
  const dotIdx = name.lastIndexOf('.');
  const ext    = dotIdx >= 0 ? name.slice(dotIdx).toLowerCase() : '';
  const base   = dotIdx >= 0 ? name.slice(0, dotIdx) : name;
  const safe   = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'doc';
  return safe + ext;
}

async function loadLegalDocsPage() {
  const container = document.getElementById('legales-container');
  if (!container) return;
  container.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';
  try {
    const [{ data: cats, error: e1 }, { data: files, error: e2 }] = await Promise.all([
      db.from('legal_documents').select('*').order('document_name'),
      db.from('legal_document_files').select('*').order('uploaded_at', { ascending: false }),
    ]);
    if (e1) throw e1;
    // e2: 404 "schema cache" = migration not run yet — degrade silently to empty files
    if (e2 && !(e2.message || '').toLowerCase().includes('schema cache')) throw e2;
    _legalDocsData  = cats  || [];
    _legalDocsFiles = files || [];
    _renderLegalDocs();
  } catch (err) {
    console.error('[Thor] loadLegalDocsPage:', err);
    _legalDocsData  = [];
    _legalDocsFiles = [];
    _renderLegalDocs();
    const c = document.getElementById('legales-container');
    if (c) {
      c.insertAdjacentHTML('afterbegin',
        `<div style="color:var(--amber);padding:10px 14px;background:rgba(255,184,0,0.07);border:1px solid rgba(255,184,0,0.2);border-radius:8px;font-size:12px;margin-bottom:14px;">
          ⚠ No se pudieron cargar los archivos desde la base de datos. Intenta de nuevo.<br>
          <small style="opacity:.6;">${err?.message || err}</small>
        </div>`
      );
    }
  }
}

function _legalDocRow(docType, docName, files, isCustom) {
  const filesHtml = files.length > 0
    ? files.map(f => {
        const dateStr = new Date(f.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const safeUrl = f.file_url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap;">
          <span style="font-size:12px;color:var(--green);">✓ ${f.file_name} · ${dateStr}</span>
          <button class="btn btn-ghost btn-sm" onclick="viewLegalDoc('${safeUrl}')">Ver</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteLegalDocFile('${f.id}','${safeUrl}')">Eliminar</button>
        </div>`;
      }).join('')
    : `<span style="color:var(--muted);font-size:12px;">Sin documentos</span>`;

  const deleteBtn = isCustom
    ? `<button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteLegalDocCategory('${docType}','${docName.replace(/'/g,"\\'")}')">Eliminar</button>`
    : '';

  const driveLink = docType === 'sst'
    ? `<div style="margin-bottom:6px;"><a href="${SST_DRIVE_URL}" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent, #4f9dff);">🔗 Abrir Drive de SST</a></div>`
    : '';

  return `<div class="doc-row" style="padding:14px 0;border-bottom:1px solid var(--border);">
    <div class="doc-icon" style="align-self:flex-start;margin-top:2px;">${files.length > 0 ? '✅' : '⚠️'}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-weight:500;font-size:14px;margin-bottom:6px;">${docName}</div>
      ${driveLink}
      <div>${filesHtml}</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0;align-self:flex-start;">
      <button class="btn btn-ghost btn-sm" onclick="uploadLegalDoc('${docType}')">
        ${files.length > 0 ? '+ Subir otro' : 'Subir'}
      </button>
      ${deleteBtn}
    </div>
  </div>`;
}

function _renderLegalDocs() {
  const container = document.getElementById('legales-container');
  if (!container) return;

  const fixedTypes = new Set(_LEGAL_DOC_TYPES.map(t => t.document_type));

  const filesByType = {};
  _legalDocsFiles.forEach(f => {
    if (!filesByType[f.document_type]) filesByType[f.document_type] = [];
    filesByType[f.document_type].push(f);
  });

  const fixedRows = _LEGAL_DOC_TYPES.map(t =>
    _legalDocRow(t.document_type, t.document_name, filesByType[t.document_type] || [], false)
  ).join('');

  const customDocs = _legalDocsData.filter(d => !fixedTypes.has(d.document_type));
  const customRows = customDocs.length
    ? `<div style="padding:10px 0 4px;font-size:11px;letter-spacing:.5px;color:var(--muted);text-transform:uppercase;">Documentos adicionales</div>` +
      customDocs.map(d => _legalDocRow(d.document_type, d.document_name, filesByType[d.document_type] || [], true)).join('')
    : '';

  const addForm = `
    <div id="legal-add-form" style="display:none;padding:14px;margin-top:10px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">Nombre del documento</div>
      <div style="display:flex;gap:8px;">
        <input id="legal-add-name" class="form-input" type="text" placeholder="Ej: Permiso Sayco Acinpro" style="flex:1;height:36px;font-size:13px;">
        <button class="btn btn-primary btn-sm" onclick="createLegalDocCategory()">Agregar</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('legal-add-form').style.display='none'">Cancelar</button>
      </div>
    </div>
    <div style="padding:14px 0 2px;">
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('legal-add-form').style.display='';document.getElementById('legal-add-name').focus();">+ Agregar documento</button>
    </div>`;

  container.innerHTML = fixedRows + customRows + addForm;
}

async function createLegalDocCategory() {
  const nameEl = document.getElementById('legal-add-name');
  const name   = nameEl?.value?.trim();
  if (!name) { toast('Campo requerido', 'Escribe el nombre del documento'); return; }

  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    .slice(0, 40) || `doc_${Date.now()}`;

  const alreadyFixed  = _LEGAL_DOC_TYPES.some(t => t.document_type === slug);
  const alreadyCustom = _legalDocsData.some(d => d.document_type === slug);
  if (alreadyFixed || alreadyCustom) { toast('Ya existe', 'Ya hay un documento con ese nombre'); return; }

  const btn = document.querySelector('#legal-add-form .btn-primary');
  if (btn) { btn.textContent = 'Guardando…'; btn.disabled = true; }

  const { error } = await db.from('legal_documents').insert({
    document_type: slug,
    document_name: name,
    uploaded_by:   currentUser?.id || null,
  });

  if (error) {
    toast('Error', error.message);
    if (btn) { btn.textContent = 'Agregar'; btn.disabled = false; }
    return;
  }

  toast('Categoría creada', name);
  loadLegalDocsPage();
}

async function deleteLegalDocCategory(docType, docName) {
  if (!confirm(`¿Eliminar la categoría "${docName}"? Se eliminarán todos sus archivos.`)) return;

  const filesToRemove = _legalDocsFiles.filter(f => f.document_type === docType);
  for (const f of filesToRemove) {
    await db.storage.from('legal-docs').remove([f.file_url]).catch(() => {});
  }
  if (filesToRemove.length) {
    await db.from('legal_document_files').delete().eq('document_type', docType);
  }

  const { error } = await db.from('legal_documents').delete().eq('document_type', docType);
  if (error) { toast('Error', error.message); return; }

  toast('Categoría eliminada', docName);
  loadLegalDocsPage();
}

async function uploadLegalDoc(docType) {
  const input      = document.createElement('input');
  input.type       = 'file';
  input.accept     = '.pdf,.jpg,.jpeg,.png,.webp';
  input.multiple   = true;

  input.onchange = async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    document.querySelectorAll(`button[onclick="uploadLegalDoc('${docType}')"]`)
      .forEach(b => { b.textContent = 'Subiendo…'; b.disabled = true; });

    try {
      for (const file of files) {
        const safeName = _sanitizeLegalFileName(file.name);
        // Fix 3: deterministic path (no timestamp) so re-uploading the same
        // filename replaces the old file instead of creating a duplicate.
        const path = `${docType}/${safeName}`;

        const { error: storageError } = await db.storage
          .from('legal-docs')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (storageError) throw storageError;

        // Ensure the category row exists for fixed types not yet seeded in DB
        const docMeta = _LEGAL_DOC_TYPES.find(t => t.document_type === docType)
                     || _legalDocsData.find(d => d.document_type === docType);
        if (docMeta) {
          await db.from('legal_documents').upsert(
            { document_type: docType, document_name: docMeta.document_name },
            { onConflict: 'document_type', ignoreDuplicates: true }
          );
        }

        // Fix 3: upsert DB record by (document_type, file_name) to avoid duplicate rows.
        // First try to update an existing record; insert only if none exists.
        const { data: existingFile } = await db
          .from('legal_document_files')
          .select('id')
          .eq('document_type', docType)
          .eq('file_name', file.name)
          .maybeSingle();

        if (existingFile) {
          const { error: updErr } = await db
            .from('legal_document_files')
            .update({ file_url: path, uploaded_at: new Date().toISOString(), uploaded_by: currentUser?.id || null })
            .eq('id', existingFile.id);
          if (updErr) throw updErr;
        } else {
          const { error: dbError } = await db.from('legal_document_files').insert({
            document_type: docType,
            file_url:      path,
            file_name:     file.name,
            uploaded_at:   new Date().toISOString(),
            uploaded_by:   currentUser?.id || null,
          });
          if (dbError) throw dbError;
        }
      }

      toast('Documento subido', files.length > 1 ? `${files.length} archivos subidos` : files[0].name);
      _refreshLegalDocsView();
    } catch (err) {
      toast('Error al subir', err.message || 'Intenta de nuevo');
      document.querySelectorAll(`button[onclick="uploadLegalDoc('${docType}')"]`)
        .forEach(b => { b.textContent = 'Subir'; b.disabled = false; });
    }
  };

  input.click();
}

async function deleteLegalDocFile(fileId, fileUrl) {
  if (!confirm('¿Eliminar este archivo?')) return;

  await db.storage.from('legal-docs').remove([fileUrl]).catch(() => {});

  const { error } = await db.from('legal_document_files').delete().eq('id', fileId);
  if (error) { toast('Error', error.message); return; }

  toast('Archivo eliminado', '');
  _refreshLegalDocsView();
}

// Both the admin Docs Legales page (#legales-container) and the read-only-plus-SST-write
// view granted collaborators land on (#boveda-legal-readonly-container) call into
// uploadLegalDoc()/deleteLegalDocFile() — refresh whichever one is actually on screen
// instead of hard-coding the admin page's loader.
function _refreshLegalDocsView() {
  if (document.getElementById('legales-container')) loadLegalDocsPage();
  else if (document.getElementById('boveda-legal-readonly-container')) loadBovedaLegalReadOnly();
}

async function viewLegalDoc(filePath) {
  try {
    const { data, error } = await db.storage
      .from('legal-docs')
      .createSignedUrl(filePath, 3600);
    if (error) throw error;
    window.open(data.signedUrl, '_blank');
  } catch (err) {
    toast('Error al abrir', err.message || 'No se pudo generar el enlace');
  }
}

// ===================== SISTEMAS (MANUALES) — Fase 3.2, 2026-08-20 =====================
// Admin (and Sebastián, once granted the 'sistemas' module — see STAFF_GRANTABLE_MODULES
// and 20260820_grant_sebastian_sistemas.sql) upload/manage view for #page-admin-sistemas.
// One row per file (system_manuals), same shape as legal_document_files, plus a
// `visible_roles` column for the per-file granular visibility the client asked for — see
// the design note at the top of 20260820_system_manuals.sql for why this is a `TEXT[]`
// column checked against get_my_role()/currentUser.role, rather than staff_extra_permissions
// rows (that mechanism grants a person a whole module, not per-file visibility by viewer role).
let _sistemasManualsData = [];

async function loadSistemasAdminPage() {
  const container = document.getElementById('sistemas-manuals-container');
  if (!container) return;
  container.innerHTML = _loader();
  try {
    const { data, error } = await db.from('system_manuals').select('*').order('uploaded_at', { ascending: false });
    if (error) throw error;
    _sistemasManualsData = data || [];
    _renderSistemasManuals();
  } catch (err) {
    console.error('[Thor] loadSistemasAdminPage:', err);
    _sistemasManualsData = [];
    container.innerHTML = `<div style="color:var(--red);padding:20px;">Error al cargar manuales.<br><small>${_escHtml(err?.message || '')}</small></div>`;
  }
}

const _SISTEMAS_ROLE_LABELS = { instructor: 'Entrenador', admin: 'Admin', user: 'Usuario', employee: 'Empleado', reception: 'Recepción' };

function _renderSistemasManuals() {
  const container = document.getElementById('sistemas-manuals-container');
  if (!container) return;

  if (!_sistemasManualsData.length) {
    container.innerHTML = '<div style="color:var(--muted);padding:24px;text-align:center;">No hay manuales cargados todavía.</div>';
    return;
  }

  container.innerHTML = _sistemasManualsData.map(m => {
    const roles = Array.isArray(m.visible_roles) ? m.visible_roles.filter(Boolean) : [];
    const visLabel = roles.length
      ? roles.map(r => _escHtml(_SISTEMAS_ROLE_LABELS[r] || r)).join(', ')
      : 'Todos';
    const dateStr = new Date(m.uploaded_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `<div class="doc-row" style="padding:14px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:500;font-size:14px;">${_escHtml(m.title)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px;">${_escHtml(m.file_name)} · ${dateStr} · Visible: ${visLabel}</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button class="btn btn-ghost btn-sm" onclick="viewSistemaManual('${m.id}')">Ver</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteSistemaManual('${m.id}')">Eliminar</button>
      </div>
    </div>`;
  }).join('');
}

function uploadSistemaManual() {
  const titleEl = document.getElementById('sistemas-manual-titulo');
  const title = (titleEl?.value || '').trim();
  if (!title) { toast('Campo requerido', 'Escribe el título del manual'); return; }

  const visibleRoles = [];
  if (document.getElementById('sistemas-vis-instructor')?.checked) visibleRoles.push('instructor');
  if (document.getElementById('sistemas-vis-admin')?.checked)      visibleRoles.push('admin');
  if (document.getElementById('sistemas-vis-user')?.checked)       visibleRoles.push('user');

  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    const btn = document.querySelector('#page-admin-sistemas .btn-primary');
    if (btn) { btn.textContent = 'Subiendo…'; btn.disabled = true; }

    try {
      // Reuses the generic filename sanitizer already used by the legal-docs uploader —
      // its logic (strip accents/special chars, keep the extension) is domain-agnostic.
      const safeName = _sanitizeLegalFileName(file.name);
      const path = `manuals/${Date.now()}_${safeName}`;

      const { error: storageError } = await db.storage
        .from('system-manuals')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (storageError) throw storageError;

      const { error: dbError } = await db.from('system_manuals').insert({
        title,
        file_url:      path,
        file_name:     file.name,
        visible_roles: visibleRoles.length ? visibleRoles : null,
        uploaded_by:   currentUser?.id || null,
      });
      if (dbError) throw dbError;

      toast('Manual subido', title);
      if (titleEl) titleEl.value = '';
      ['sistemas-vis-instructor', 'sistemas-vis-admin', 'sistemas-vis-user'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
      });
      loadSistemasAdminPage();
    } catch (err) {
      toast('Error al subir', err.message || 'Intenta de nuevo');
    } finally {
      if (btn) { btn.textContent = '+ Subir manual'; btn.disabled = false; }
    }
  };

  input.click();
}

async function viewSistemaManual(manualId) {
  const m = _sistemasManualsData.find(x => x.id === manualId);
  if (!m) return;
  try {
    const { data, error } = await db.storage
      .from('system-manuals')
      .createSignedUrl(m.file_url, 3600);
    if (error) throw error;
    window.open(data.signedUrl, '_blank');
  } catch (err) {
    toast('Error al abrir', err.message || 'No se pudo generar el enlace');
  }
}

async function deleteSistemaManual(manualId) {
  const m = _sistemasManualsData.find(x => x.id === manualId);
  if (!m) return;
  if (!confirm(`¿Eliminar el manual "${m.title}"?`)) return;

  await db.storage.from('system-manuals').remove([m.file_url]).catch(() => {});

  const { error } = await db.from('system_manuals').delete().eq('id', manualId);
  if (error) { toast('Error', error.message); return; }

  toast('Manual eliminado', '');
  loadSistemasAdminPage();
}

async function loadVaultDocs() {
  const listEl = document.getElementById('vault-docs-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';

  try {
    const { data: files, error } = await db.storage.from('vault').list('', {
      sortBy: { column: 'created_at', order: 'desc' }
    });
    if (error) throw error;

    const docs = (files || []).filter(f => f.name !== '.emptyFolderPlaceholder');

    if (docs.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:48px 24px;color:var(--muted);">
          <div style="font-size:36px;margin-bottom:12px;">📂</div>
          <div style="font-size:14px;font-weight:600;color:var(--text);">No hay documentos aún</div>
          <div style="font-size:12px;margin-top:6px;">Sube el primer documento usando el área de arriba</div>
        </div>`;
      return;
    }

    listEl.innerHTML = `
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Tipo</th>
              <th>Tamaño</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${docs.map(f => {
              const ext  = (f.name.split('.').pop() || '').toUpperCase();
              const size = f.metadata?.size ? _vaultFormatSize(f.metadata.size) : '—';
              const date = f.created_at
                ? new Date(f.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })
                : '—';
              const icon = _vaultFileIcon(ext);
              const safeName = f.name.replace(/'/g, "\\'");
              return `<tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:20px;">${icon}</span>
                    <span style="font-weight:500;font-size:13px;word-break:break-all;">${f.name}</span>
                  </div>
                </td>
                <td><span class="badge badge-cyan">${ext || 'FILE'}</span></td>
                <td style="color:var(--muted);font-size:12px;white-space:nowrap;">${size}</td>
                <td style="color:var(--muted);font-size:12px;white-space:nowrap;">${date}</td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm" onclick="downloadVaultDoc('${safeName}')">⬇ Descargar</button>
                    <button class="btn btn-danger btn-sm"  onclick="deleteVaultDoc('${safeName}')">Eliminar</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    listEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red);font-size:13px;">Error al cargar documentos: ${e.message}</div>`;
  }
}

async function uploadVaultDocs(files) {
  if (!files || files.length === 0) return;
  const MAX = 50 * 1024 * 1024;

  for (const file of Array.from(files)) {
    if (file.size > MAX) {
      toast('Archivo muy grande', `${file.name} supera los 50 MB`);
      continue;
    }
    const safeName = _sanitizeLegalFileName(file.name);
    const path     = `${Date.now()}_${safeName}`;
    toast('Subiendo...', file.name);
    const { error } = await db.storage.from('vault').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) {
      toast('Error al subir', error.message);
    } else {
      toast('✅ Documento subido', file.name);
    }
  }

  document.getElementById('vault-file-input').value = '';
  await loadVaultDocs();
}

function handleVaultDrop(e) {
  e.preventDefault();
  document.getElementById('vault-drop-zone').classList.remove('drag-over');
  uploadVaultDocs(e.dataTransfer.files);
}

async function downloadVaultDoc(name) {
  try {
    const { data, error } = await db.storage.from('vault').createSignedUrl(name, 300);
    if (error) throw error;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = name;
    a.target = '_blank';
    a.click();
  } catch (e) {
    toast('Error', 'No se pudo generar el enlace de descarga');
  }
}

async function deleteVaultDoc(name) {
  if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
  const { error } = await db.storage.from('vault').remove([name]);
  if (error) {
    toast('Error', error.message);
  } else {
    toast('Documento eliminado', name);
    await loadVaultDocs();
  }
}

function _vaultFormatSize(bytes) {
  if (bytes < 1024)             return bytes + ' B';
  if (bytes < 1024 * 1024)     return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function _vaultFileIcon(ext) {
  const map = {
    PDF:'📄', DOC:'📝', DOCX:'📝', XLS:'📊', XLSX:'📊', CSV:'📊',
    PPT:'📊', PPTX:'📊', TXT:'📋', PNG:'🖼', JPG:'🖼', JPEG:'🖼',
    GIF:'🖼', SVG:'🖼', WEBP:'🖼', ZIP:'📦', RAR:'📦', '7Z':'📦'
  };
  return map[ext] || '📎';
}

// ── Vault Credentials (Datos y Credenciales tab) ──────────────────────────────

let _vaultEntriesCache = [];

function switchVaultTab(tab) {
  document.querySelectorAll('.vault-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tab)
  );
  const isDocs = tab === 'docs';
  document.getElementById('vault-panel-docs').style.display  = isDocs ? '' : 'none';
  document.getElementById('vault-panel-creds').style.display = isDocs ? 'none' : '';
  const uploadBtn = document.getElementById('vault-upload-btn');
  if (uploadBtn) uploadBtn.style.display = isDocs ? '' : 'none';
  if (!isDocs) loadVaultEntries();
}

async function loadVaultEntries() {
  const container = document.getElementById('vault-entries-container');
  if (!container) return;
  container.innerHTML = '<div class="thor-loader"><img src="img/preloader.gif" alt=""></div>';

  try {
    const { data, error } = await db
      .from('vault_entries')
      .select('id, category, label, value, notes')
      .order('category')
      .order('label');
    if (error) throw error;
    _vaultEntriesCache = data || [];
    _renderVaultEntries(_vaultEntriesCache);
  } catch (e) {
    container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red);font-size:13px;">Error al cargar credenciales: ${e.message}</div>`;
  }
}

function _renderVaultEntries(entries) {
  const container = document.getElementById('vault-entries-container');
  if (!container) return;

  const categories = [...new Set(entries.map(e => e.category))];

  const datalist = `<datalist id="vault-cat-datalist">${
    categories.map(c => `<option value="${_escHtml(c)}">`).join('')
  }</datalist>`;

  if (!entries.length) {
    container.innerHTML = datalist + `
      <div style="text-align:center;padding:48px 24px;color:var(--muted);">
        <div style="font-size:36px;margin-bottom:12px;">🔑</div>
        <div style="font-size:14px;font-weight:600;color:var(--text);">Sin credenciales guardadas</div>
        <div style="font-size:12px;margin-top:6px;">Usa "+ Agregar entrada" para añadir la primera</div>
      </div>`;
    return;
  }

  const groups = categories.map(cat => {
    const rows = entries.filter(e => e.category === cat);
    return `<div class="card" style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:var(--cyan);margin-bottom:12px;">${_escHtml(cat)}</div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:28%;">Etiqueta</th>
              <th style="width:34%;">Valor</th>
              <th>Notas</th>
              <th style="width:96px;">Acciones</th>
            </tr>
          </thead>
          <tbody>${rows.map(e => _vaultEntryRow(e)).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = datalist + groups;
}

function _vaultEntryRow(e) {
  const id = e.id;
  return `<tr id="vault-row-${id}">
    <td id="vault-label-cell-${id}" style="font-weight:500;font-size:13px;">
      <div style="display:flex;align-items:center;gap:4px;">
        <span>${_escHtml(e.label)}</span>
        <button class="btn btn-ghost btn-sm" style="padding:2px 5px;font-size:11px;opacity:.5;" onclick="startVaultLabelEdit('${id}')" title="Renombrar">✎</button>
      </div>
    </td>
    <td><span style="font-family:monospace;font-size:13px;letter-spacing:.5px;">${_escHtml(e.value)}</span></td>
    <td style="color:var(--muted);font-size:12px;">${e.notes ? _escHtml(e.notes) : '<span style="opacity:.4;">—</span>'}</td>
    <td>
      <div style="display:flex;gap:5px;">
        <button class="btn btn-ghost btn-sm" style="padding:2px 8px;" onclick="editVaultEntry('${id}')" title="Editar">✏️</button>
        <button class="btn btn-danger btn-sm" style="padding:2px 8px;" onclick="deleteVaultEntry('${id}')" title="Eliminar">🗑</button>
      </div>
    </td>
  </tr>`;
}

function startVaultLabelEdit(id) {
  const entry = _vaultEntriesCache.find(e => e.id === id);
  const cell  = document.getElementById(`vault-label-cell-${id}`);
  if (!entry || !cell) return;

  const input = document.createElement('input');
  input.className = 'form-input';
  input.style.cssText = 'padding:4px 8px;font-size:13px;width:100%;min-width:80px;';
  input.value = entry.label;

  let committed = false;
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); if (!committed) { committed = true; saveVaultLabelEdit(id, input.value); } }
    if (ev.key === 'Escape') { ev.preventDefault(); committed = true; cancelVaultLabelEdit(id); }
  });
  input.addEventListener('blur', () => { if (!committed) { committed = true; saveVaultLabelEdit(id, input.value); } });

  cell.innerHTML = '';
  cell.appendChild(input);
  input.focus();
  input.select();
}

function cancelVaultLabelEdit(id) {
  const entry = _vaultEntriesCache.find(e => e.id === id);
  const cell  = document.getElementById(`vault-label-cell-${id}`);
  if (!cell) return;
  cell.innerHTML = `<div style="display:flex;align-items:center;gap:4px;"><span>${_escHtml(entry?.label ?? '')}</span><button class="btn btn-ghost btn-sm" style="padding:2px 5px;font-size:11px;opacity:.5;" onclick="startVaultLabelEdit('${id}')" title="Renombrar">✎</button></div>`;
}

async function saveVaultLabelEdit(id, newLabel) {
  newLabel = (newLabel ?? '').trim();
  if (!newLabel) { cancelVaultLabelEdit(id); return; }
  const entry = _vaultEntriesCache.find(e => e.id === id);
  if (!entry || newLabel === entry.label) { cancelVaultLabelEdit(id); return; }
  try {
    const { error } = await db.from('vault_entries').update({ label: newLabel }).eq('id', id);
    if (error) throw error;
    entry.label = newLabel;
  } catch (e) {
    toast('Error al guardar etiqueta', e.message);
  }
  cancelVaultLabelEdit(id);
}

function editVaultEntry(id) {
  const entry = _vaultEntriesCache.find(e => e.id === id);
  const row   = document.getElementById(`vault-row-${id}`);
  if (!entry || !row) return;

  const ea = s => _escHtml(s ?? '');
  const keyHandler = `if(event.key==='Enter'){event.preventDefault();saveVaultEntryEdit('${id}')}else if(event.key==='Escape')loadVaultEntries()`;
  row.innerHTML = `
    <td><input id="ve-edit-label-${id}" class="form-input" style="padding:6px 10px;font-size:13px;" value="${ea(entry.label)}" onkeydown="${keyHandler}"></td>
    <td><input id="ve-edit-value-${id}" class="form-input" style="padding:6px 10px;font-size:13px;" value="${ea(entry.value)}" onkeydown="${keyHandler}"></td>
    <td><input id="ve-edit-notes-${id}" class="form-input" style="padding:6px 10px;font-size:13px;" value="${ea(entry.notes)}" placeholder="(opcional)" onkeydown="${keyHandler}"></td>
    <td>
      <div style="display:flex;gap:5px;">
        <button class="btn btn-primary btn-sm" style="padding:4px 10px;" onclick="saveVaultEntryEdit('${id}')">✓</button>
        <button class="btn btn-ghost btn-sm"   style="padding:4px 10px;" onclick="loadVaultEntries()">✗</button>
      </div>
    </td>`;
  document.getElementById(`ve-edit-label-${id}`)?.focus();
}

async function saveVaultEntryEdit(id) {
  const label = document.getElementById(`ve-edit-label-${id}`)?.value.trim();
  const value = document.getElementById(`ve-edit-value-${id}`)?.value.trim();
  const notes = document.getElementById(`ve-edit-notes-${id}`)?.value.trim() || null;

  if (!label || !value) { toast('Campos requeridos', 'Etiqueta y Valor son obligatorios.'); return; }

  try {
    const { error } = await db
      .from('vault_entries')
      .update({ label, value, notes, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await loadVaultEntries();
  } catch (e) {
    toast('Error al guardar', e.message);
  }
}

async function deleteVaultEntry(id) {
  const entry = _vaultEntriesCache.find(e => e.id === id);
  if (!confirm(`¿Eliminar "${entry?.label || 'esta entrada'}"? Esta acción no se puede deshacer.`)) return;
  try {
    const { error } = await db.from('vault_entries').delete().eq('id', id);
    if (error) throw error;
    await loadVaultEntries();
  } catch (e) {
    toast('Error al eliminar', e.message);
  }
}

function openVaultEntryForm() {
  if (document.getElementById('vault-add-form')) {
    document.getElementById('vault-add-form').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  const container = document.getElementById('vault-entries-container');
  container.insertAdjacentHTML('afterbegin', `<div class="card" id="vault-add-form" style="margin-bottom:14px;border:1px solid rgba(0,207,255,.35);">
    <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:var(--cyan);margin-bottom:14px;">+ NUEVA ENTRADA</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <div class="form-group" style="margin:0;">
        <label class="form-label">Categoría</label>
        <input class="form-input" id="ve-cat" list="vault-cat-datalist" placeholder="Ej. REDES SOCIALES" autocomplete="off">
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Etiqueta</label>
        <input class="form-input" id="ve-label" placeholder="Ej. CONTRASEÑA">
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Valor</label>
        <input class="form-input" id="ve-value" placeholder="Credencial o dato">
      </div>
      <div class="form-group" style="margin:0;">
        <label class="form-label">Notas <span style="color:var(--muted);">(opcional)</span></label>
        <input class="form-input" id="ve-notes" placeholder="Información adicional">
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;">
      <button class="btn btn-ghost btn-sm" onclick="cancelVaultEntryForm()">Cancelar</button>
      <button class="btn btn-primary btn-sm" onclick="saveNewVaultEntry()">Guardar</button>
    </div>
  </div>`);
  document.getElementById('ve-cat')?.focus();
}

function cancelVaultEntryForm() {
  document.getElementById('vault-add-form')?.remove();
}

async function saveNewVaultEntry() {
  const category = document.getElementById('ve-cat')?.value.trim().toUpperCase();
  const label    = document.getElementById('ve-label')?.value.trim().toUpperCase();
  const value    = document.getElementById('ve-value')?.value.trim();
  const notes    = document.getElementById('ve-notes')?.value.trim() || null;

  if (!category || !label || !value) {
    toast('Campos requeridos', 'Categoría, Etiqueta y Valor son obligatorios.');
    return;
  }

  try {
    const { error } = await db.from('vault_entries').insert({ category, label, value, notes });
    if (error) throw error;
    cancelVaultEntryForm();
    await loadVaultEntries();
    toast('✅ Entrada guardada', `${label} añadida en ${category}`);
  } catch (e) {
    toast('Error al guardar', e.message);
  }
}

document.getElementById('instructor-nav').style.display  = 'none';
document.getElementById('user-pill').style.display       = 'none';

// ===================== CRONOGRAMA GENERAL (Phase 3, 2026-07-14) =====================
// Shared staff calendar — separate from the class-schedule system (admin-horarios).
// Audience buckets mirror classify_audience_type() in 20260714_cronograma_general.sql —
// keep these two in sync if that mapping ever changes.
const CRONO_ROLE_LABELS = {
  vinculado:            'Vinculado',
  ps:                   'Prestación de Servicios',
  recepcion:            'Recepción',
  administracion:       'Administración',
  colaborador_externo:  'Colaborador externo',
};
const CRONO_EVENT_TYPE_COLOR = { reunion: 'cyan', capacitacion: 'purple', recordatorio: 'orange', otro: 'red' };

let _cronoYear         = null;
let _cronoMonth        = null;  // 0-11
let _cronoEvents       = [];    // events for the visible grid range, each with embedded .calendar_event_recipients
let _cronoGridDays     = [];    // Date[] for the 42 cells currently rendered
let _cronoStaffList    = [];    // from list_staff_directory() — admin/reception, or anyone granted 'agendar_cronograma' (Fase 3.3, 2026-08-20)
let _cronoRoleFilter   = '';
let _cronoPersonFilter = '';
let _cronoEditingId    = null;
let _cronoIsPrivileged = false;
// Fase 3.3 (2026-08-20) — true for admin/reception (same as _cronoIsPrivileged) OR anyone
// granted the 'agendar_cronograma' staff_extra_permissions key. Distinct from
// _cronoIsPrivileged: privileged users can browse/filter/edit EVERY event; a granted
// creator can only create new events and edit/delete their OWN (created_by = auth.uid()),
// enforced server-side by 20260820_cronograma_agendar_permission.sql.
let _cronoCanCreate    = false;

function _cronoPad2(n) { return String(n).padStart(2, '0'); }

function _cronoTimeOf(iso) {
  const d = new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000);
  return `${_cronoPad2(d.getUTCHours())}:${_cronoPad2(d.getUTCMinutes())}`;
}

// Combines a <input type=date>/<input type=time> pair (Bogotá local) into a UTC ISO string
// suitable for a timestamptz column — same -05:00 fixed-offset convention as
// _bogotaMidnightUTC (Colombia does not observe DST). For all-day events, the "end" boundary
// is the start of the day AFTER the end date, matching _bogotaDayRange's exclusive-upper-bound shape.
function _cronoCombineDateTimeUTC(dateStr, timeStr, allDay, isEnd) {
  if (allDay) {
    if (isEnd) { const [, endExclusive] = _bogotaDayRange(dateStr); return endExclusive; }
    return _bogotaMidnightUTC(dateStr);
  }
  return new Date(dateStr + 'T' + (timeStr || '00:00') + ':00-05:00').toISOString();
}

async function loadCronogramaPage() {
  _cronoIsPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'reception';
  // Fase 3.3 (2026-08-20) — refresh the grant cache so a just-granted 'agendar_cronograma'
  // person sees the create controls without a full re-login. Cheap single-table query,
  // safe to re-run every time this page loads.
  if (!_cronoIsPrivileged) await _loadMyExtraPermissions();
  _cronoCanCreate = _cronoIsPrivileged || _myExtraPermissions.has('agendar_cronograma');
  document.getElementById('crono-new-btn-wrap').style.display = _cronoCanCreate ? 'block' : 'none';
  document.getElementById('crono-filters-wrap').style.display = _cronoIsPrivileged ? 'block' : 'none';

  if (_cronoYear == null) {
    const [y, m] = _bogotaToday().split('-').map(Number);
    _cronoYear = y;
    _cronoMonth = m - 1;
  }
  if (_cronoCanCreate && !_cronoStaffList.length) await _cronoLoadStaffList();
  await _cronoLoadMonth();
}

async function _cronoLoadStaffList() {
  try {
    const { data, error } = await db.rpc('list_staff_directory');
    if (error) throw error;
    _cronoStaffList = data || [];
  } catch (_) {
    _cronoStaffList = [];
  }
  _cronoRenderPersonFilterOptions();
}

function _cronoRenderPersonFilterOptions() {
  const sel = document.getElementById('crono-filter-person');
  if (!sel) return;
  sel.innerHTML = '<option value="">Filtrar por persona…</option>' +
    _cronoStaffList.map(p => `<option value="${p.id}">${_escHtml(p.full_name)}</option>`).join('');
}

async function _cronoLoadMonth() {
  const grid = document.getElementById('crono-grid');
  grid.innerHTML = '<div style="grid-column:1/-1"><div class="thor-loader"><img src="img/preloader.gif" alt=""></div></div>';

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('crono-month-title').textContent = `${monthNames[_cronoMonth]} ${_cronoYear}`;

  const firstOfMonth  = new Date(Date.UTC(_cronoYear, _cronoMonth, 1));
  const startWeekday  = firstOfMonth.getUTCDay(); // 0 = Domingo
  const gridStartDate = new Date(Date.UTC(_cronoYear, _cronoMonth, 1 - startWeekday));
  _cronoGridDays = Array.from({ length: 42 }, (_, i) => new Date(gridStartDate.getTime() + i * 86400000));

  const dateStr = d => `${d.getUTCFullYear()}-${_cronoPad2(d.getUTCMonth() + 1)}-${_cronoPad2(d.getUTCDate())}`;
  const [rangeStartISO]     = _bogotaDayRange(dateStr(_cronoGridDays[0]));
  const [, rangeEndISOExcl] = _bogotaDayRange(dateStr(_cronoGridDays[41]));

  try {
    const { data, error } = await db
      .from('calendar_events')
      .select('*, calendar_event_recipients(*)')
      .gte('start_at', rangeStartISO)
      .lt('start_at', rangeEndISOExcl)
      .order('start_at');
    if (error) throw error;
    _cronoEvents = data || [];
  } catch (err) {
    _cronoEvents = [];
    toast('Error al cargar el cronograma', err.message || 'Intenta de nuevo');
  }
  _cronoRenderGrid();
}

function _cronoChangeMonth(delta) {
  _cronoMonth += delta;
  if (_cronoMonth < 0)  { _cronoMonth = 11; _cronoYear--; }
  if (_cronoMonth > 11) { _cronoMonth = 0;  _cronoYear++; }
  _cronoLoadMonth();
}

function _cronoSetRoleFilter(roleKey) {
  _cronoRoleFilter   = roleKey;
  _cronoPersonFilter = '';
  const personSel = document.getElementById('crono-filter-person');
  if (personSel) personSel.value = '';
  document.querySelectorAll('.crono-filter-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.roleKey === roleKey);
  });
  _cronoRenderGrid();
}

function _cronoSetPersonFilter(userId) {
  _cronoPersonFilter = userId;
  if (userId) document.querySelectorAll('.crono-filter-chip').forEach(chip => chip.classList.remove('active'));
  else document.querySelector('.crono-filter-chip[data-role-key=""]')?.classList.add('active');
  _cronoRenderGrid();
}

function _cronoVisibleEventsByDate() {
  let events = _cronoEvents;
  if (_cronoIsPrivileged && (_cronoRoleFilter || _cronoPersonFilter)) {
    events = events.filter(ev => {
      const recips = ev.calendar_event_recipients || [];
      if (recips.some(r => r.recipient_type === 'everyone')) return true;
      if (_cronoPersonFilter) return recips.some(r => r.recipient_type === 'user' && r.user_id === _cronoPersonFilter);
      if (_cronoRoleFilter)   return recips.some(r => r.recipient_type === 'role' && r.role_key === _cronoRoleFilter);
      return true;
    });
  }
  const map = {};
  events.forEach(ev => { const d = _bogotaDateOf(ev.start_at); (map[d] = map[d] || []).push(ev); });
  return map;
}

function _cronoRenderGrid() {
  const grid = document.getElementById('crono-grid');
  const byDate  = _cronoVisibleEventsByDate();
  const todayStr = _bogotaToday();
  const headNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  let html = headNames.map(h => `<div class="crono-head">${h}</div>`).join('');
  _cronoGridDays.forEach(day => {
    const y = day.getUTCFullYear(), m = day.getUTCMonth(), d = day.getUTCDate();
    const dStr    = `${y}-${_cronoPad2(m + 1)}-${_cronoPad2(d)}`;
    const outside = m !== _cronoMonth;
    const isToday = dStr === todayStr;
    const chips = (byDate[dStr] || []).map(ev => {
      const color = CRONO_EVENT_TYPE_COLOR[ev.event_type] || 'cyan';
      return `<div class="crono-event crono-event-${color}" onclick="abrirEditarEventoCronograma('${ev.id}')" title="${_escHtml(ev.title)}">${_escHtml(ev.title)}</div>`;
    }).join('');
    const addBtn = _cronoCanCreate
      ? `<span style="float:right;cursor:pointer;color:var(--cyan);" onclick="abrirNuevoEventoCronograma('${dStr}')">+</span>`
      : '';
    html += `<div class="crono-cell ${outside ? 'crono-cell-outside' : ''} ${isToday ? 'crono-cell-today' : ''}">
      <div class="crono-cell-date">${d}${addBtn}</div>
      ${chips}
    </div>`;
  });
  grid.innerHTML = html;
}

function _cronoToggleAllDay() {
  const allDay = document.getElementById('crono-all-day').checked;
  document.getElementById('crono-start-time-wrap').style.display = allDay ? 'none' : '';
  document.getElementById('crono-end-time-wrap').style.display   = allDay ? 'none' : '';
}

function _cronoToggleEveryone() {
  const everyone = document.getElementById('crono-rec-everyone').checked;
  document.querySelectorAll('.crono-rec-role-cb, .crono-rec-person-cb').forEach(cb => {
    cb.disabled = everyone;
    if (everyone) cb.checked = false;
  });
}

function _cronoRenderRolesPicker() {
  const wrap = document.getElementById('crono-rec-roles');
  wrap.innerHTML = Object.entries(CRONO_ROLE_LABELS).map(([key, label]) => `
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
      <input type="checkbox" class="crono-rec-role-cb" value="${key}"> ${label}
    </label>
  `).join('');
}

function _cronoRenderPeoplePicker(filterText) {
  const wrap = document.getElementById('crono-rec-people');
  if (!wrap) return;
  const q = (filterText || '').toLowerCase();
  const list = _cronoStaffList.filter(p => !q || p.full_name.toLowerCase().includes(q));
  wrap.innerHTML = list.map(p => `
    <label style="display:flex;align-items:center;gap:8px;font-size:12px;">
      <input type="checkbox" class="crono-rec-person-cb" value="${p.id}"> ${_escHtml(p.full_name)}
      <span style="color:var(--muted);">(${CRONO_ROLE_LABELS[p.audience_type] || p.role})</span>
    </label>
  `).join('');
}

function _cronoFilterPersonPicker(text) { _cronoRenderPeoplePicker(text); }

// "Para ti" instead of a resolved name for 'user'-type rows: a non-privileged viewer's
// embedded calendar_event_recipients is already RLS-filtered down to only rows that
// identify THEM (see calendar_event_recipients_select policy) — never another person's
// individual targeting — so there is nothing else to resolve/look up here.
function _cronoDescribeAudience(recipients) {
  if (recipients.some(r => r.recipient_type === 'everyone')) return 'Para: todo el personal';
  const parts = recipients.filter(r => r.recipient_type === 'role').map(r => CRONO_ROLE_LABELS[r.role_key] || r.role_key);
  if (recipients.some(r => r.recipient_type === 'user')) parts.push('ti');
  return parts.length ? ('Para: ' + parts.join(', ')) : '';
}

function abrirNuevoEventoCronograma(dateStr) {
  _cronoEditingId = null;
  document.getElementById('crono-modal-title').textContent = 'Nuevo evento';

  const fields = ['crono-titulo','crono-descripcion','crono-all-day','crono-start-date','crono-end-date',
    'crono-start-time','crono-end-time','crono-event-type'];
  fields.forEach(id => { document.getElementById(id).disabled = false; });

  document.getElementById('crono-titulo').value = '';
  document.getElementById('crono-descripcion').value = '';
  document.getElementById('crono-all-day').checked = false;
  const d = dateStr || _bogotaToday();
  document.getElementById('crono-start-date').value = d;
  document.getElementById('crono-end-date').value   = d;
  document.getElementById('crono-start-time').value = '08:00';
  document.getElementById('crono-end-time').value   = '09:00';
  document.getElementById('crono-event-type').value = 'reunion';
  _cronoToggleAllDay();

  document.getElementById('crono-rec-everyone').checked  = false;
  document.getElementById('crono-rec-everyone').disabled = false;
  _cronoRenderRolesPicker();
  document.getElementById('crono-rec-person-search').value = '';
  _cronoRenderPeoplePicker('');
  _cronoToggleEveryone();

  document.getElementById('crono-rec-wrap').style.display = '';
  document.getElementById('crono-readonly-audience').style.display = 'none';
  document.getElementById('crono-delete-btn').style.display = 'none';
  document.getElementById('crono-save-btn').style.display = '';
  openModal('crono-evento');
}

function abrirEditarEventoCronograma(eventId) {
  const ev = _cronoEvents.find(e => e.id === eventId);
  if (!ev) return;
  _cronoEditingId = eventId;
  // Fase 3.3 (2026-08-20) — a granted (non-privileged) creator can edit/delete only the
  // events THEY created; admin/reception keep full edit access to everything, as before.
  // Server-side RLS enforces the same created_by scoping regardless of this UI check
  // (20260820_cronograma_agendar_permission.sql).
  const canEdit = _cronoIsPrivileged || (_cronoCanCreate && ev.created_by === currentUser?.id);
  const recipients = ev.calendar_event_recipients || [];

  document.getElementById('crono-modal-title').textContent = canEdit ? 'Editar evento' : ev.title;
  document.getElementById('crono-titulo').value = ev.title;
  document.getElementById('crono-descripcion').value = ev.description || '';
  document.getElementById('crono-all-day').checked = !!ev.all_day;
  const startDate = _bogotaDateOf(ev.start_at);
  document.getElementById('crono-start-date').value = startDate;
  document.getElementById('crono-end-date').value   = ev.end_at ? _bogotaDateOf(ev.end_at) : startDate;
  document.getElementById('crono-start-time').value = _cronoTimeOf(ev.start_at);
  document.getElementById('crono-end-time').value   = ev.end_at ? _cronoTimeOf(ev.end_at) : _cronoTimeOf(ev.start_at);
  document.getElementById('crono-event-type').value = ev.event_type || 'reunion';
  _cronoToggleAllDay();

  const fields = ['crono-titulo','crono-descripcion','crono-all-day','crono-start-date','crono-end-date',
    'crono-start-time','crono-end-time','crono-event-type'];
  fields.forEach(id => { document.getElementById(id).disabled = !canEdit; });

  document.getElementById('crono-rec-everyone').checked = recipients.some(r => r.recipient_type === 'everyone');
  _cronoRenderRolesPicker();
  document.querySelectorAll('.crono-rec-role-cb').forEach(cb => {
    cb.checked = recipients.some(r => r.recipient_type === 'role' && r.role_key === cb.value);
  });
  document.getElementById('crono-rec-person-search').value = '';
  _cronoRenderPeoplePicker('');
  document.querySelectorAll('.crono-rec-person-cb').forEach(cb => {
    cb.checked = recipients.some(r => r.recipient_type === 'user' && r.user_id === cb.value);
  });
  _cronoToggleEveryone();
  document.getElementById('crono-rec-everyone').disabled = !canEdit;

  if (canEdit) {
    document.getElementById('crono-rec-wrap').style.display = '';
    document.getElementById('crono-readonly-audience').style.display = 'none';
    document.getElementById('crono-delete-btn').style.display = '';
    document.getElementById('crono-save-btn').style.display = '';
  } else {
    document.getElementById('crono-rec-wrap').style.display = 'none';
    document.getElementById('crono-readonly-audience').style.display = '';
    document.getElementById('crono-readonly-audience').textContent = _cronoDescribeAudience(recipients);
    document.getElementById('crono-delete-btn').style.display = 'none';
    document.getElementById('crono-save-btn').style.display = 'none';
  }
  openModal('crono-evento');
}

async function guardarEventoCronograma() {
  const titulo = (document.getElementById('crono-titulo').value || '').trim();
  if (!titulo) { toast('Campo requerido', 'Ingresa un título'); return; }

  const allDay    = document.getElementById('crono-all-day').checked;
  const startDate = document.getElementById('crono-start-date').value;
  if (!startDate) { toast('Campo requerido', 'Ingresa la fecha de inicio'); return; }
  const endDate   = document.getElementById('crono-end-date').value || startDate;
  const startTime = document.getElementById('crono-start-time').value || '00:00';
  const endTime   = document.getElementById('crono-end-time').value || startTime;
  const startAt   = _cronoCombineDateTimeUTC(startDate, startTime, allDay, false);
  const endAt     = _cronoCombineDateTimeUTC(endDate, endTime, allDay, true);
  const eventType = document.getElementById('crono-event-type').value;
  const description = (document.getElementById('crono-descripcion').value || '').trim() || null;

  const everyone = document.getElementById('crono-rec-everyone').checked;
  const recipients = [];
  if (everyone) {
    recipients.push({ type: 'everyone' });
  } else {
    document.querySelectorAll('.crono-rec-role-cb:checked').forEach(cb => recipients.push({ type: 'role', role_key: cb.value }));
    document.querySelectorAll('.crono-rec-person-cb:checked').forEach(cb => recipients.push({ type: 'user', user_id: cb.value }));
  }
  if (!recipients.length) { toast('Selecciona destinatarios', 'Elige al menos un rol, una persona, o "Todo el personal"'); return; }

  const btn = document.getElementById('crono-save-btn');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    if (_cronoEditingId) {
      // Update: plain table calls under the Phase 1 admin/reception RLS — no need to
      // re-resolve "who is currently in this role", recipient rows are static.
      const { error: updErr } = await db.from('calendar_events').update({
        title: titulo, description, all_day: allDay, start_at: startAt, end_at: endAt,
        event_type: eventType, updated_by: currentUser?.id, updated_at: new Date().toISOString(),
      }).eq('id', _cronoEditingId);
      if (updErr) throw updErr;

      const { error: delErr } = await db.from('calendar_event_recipients').delete().eq('event_id', _cronoEditingId);
      if (delErr) throw delErr;

      const rows = recipients.map(r => ({
        event_id: _cronoEditingId,
        recipient_type: r.type,
        role_key: r.type === 'role' ? r.role_key : null,
        user_id: r.type === 'user' ? r.user_id : null,
      }));
      const { error: insErr } = await db.from('calendar_event_recipients').insert(rows);
      if (insErr) throw insErr;
      toast('Evento actualizado', 'Los cambios se guardaron correctamente');
    } else {
      // Create: RPC — the only step that needs to resolve "who is currently in role X" to
      // fan out notifications, which a reception caller cannot do via a plain client-side
      // query (see 20260714_cronograma_general_rpc.sql header for why).
      const { error } = await db.rpc('create_calendar_event_with_recipients', {
        p_title: titulo, p_description: description, p_all_day: allDay,
        p_start_at: startAt, p_end_at: endAt, p_event_type: eventType, p_recipients: recipients,
      });
      if (error) throw error;
      toast('Evento creado', 'Se notificó a los destinatarios seleccionados');
    }
    closeModal('modal-crono-evento');
    await _cronoLoadMonth();
  } catch (err) {
    toast('Error al guardar', err.message || 'Intenta de nuevo');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function eliminarEventoCronograma() {
  if (!_cronoEditingId) return;
  if (!confirm('¿Eliminar este evento del cronograma?')) return;
  try {
    const { error } = await db.from('calendar_events').delete().eq('id', _cronoEditingId);
    if (error) throw error;
    toast('Evento eliminado', '');
    closeModal('modal-crono-evento');
    await _cronoLoadMonth();
  } catch (err) {
    toast('Error al eliminar', err.message || 'Intenta de nuevo');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();
  const result = await checkSession();
  if (result && !result._inactive) {
    enterApp(result);
  } else {
    showLogin();
    if (result?._inactive) {
      document.getElementById('login-error').textContent =
        'Tu cuenta ha sido desactivada. Contacta al administrador.';
    }
  }
});

db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && !_suppressSignoutRedirect) showLogin();
});
