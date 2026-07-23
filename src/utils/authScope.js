'use strict';

const NIL_EMPRESA_ID = 0;

/**
 * True only when a request is BOTH rol='wizard' AND scoped to the system
 * tenant (empresa_id=0) — the sole combination that should grant unscoped,
 * cross-tenant access to auth.db data.
 *
 * Checking either half alone was a cross-tenant leak, independently
 * reintroduced in three different files: rol alone (authRecordController.js)
 * let every tenant's bootstrap admin — created with rol='wizard' by the old
 * setupController.js — see every other tenant's usuarios/usuario_permisos;
 * empresa_id alone (catalogController.js, nilSysController.js) would grant
 * the same to any non-wizard rol that ever ends up with empresa_id=0. Both
 * conditions live here, once, so the next call site imports a correct check
 * instead of re-deriving half of one.
 */
function isGlobalWizard(req) {
    return req.rol === 'wizard' && req.empresaId === NIL_EMPRESA_ID;
}

module.exports = { isGlobalWizard, NIL_EMPRESA_ID };
