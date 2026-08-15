'use strict';

/**
 * @file nil-users.js
 * @description Handler for sys/form/nil-users.xml (operadores management).
 *   Loaded via @auth:nil-users prefix — runs on auth.db.
 *
 * Responsibilities:
 *   - beforeSave: strip fields that authRecordService's EDITABLE_FIELDS
 *     allowlist rejects (rol, activo, failed_attempts, last_login) — the form
 *     shows them (read-only info when editing an existing user, via the
 *     <in-table> lookup's copy), but none of them are settable through this
 *     generic path. New rows get rol='operador'/activo=1 from the usuarios
 *     table's own DEFAULT — this handler used to force rol/activo itself,
 *     which was correct before the EDITABLE_FIELDS hardening but now makes
 *     every save (create or edit) fail with "Campo(s) no editable(s) vía
 *     esta ruta". Re-activating a deactivated user or clearing
 *     failed_attempts needs a dedicated role-gated endpoint — doesn't exist
 *     yet (see authRecordService.js's EDITABLE_FIELDS comment) — not added
 *     here.
 */

function beforeSave(data) {
    delete data.rol;
    delete data.activo;
    delete data.failed_attempts;
    delete data.last_login;
}

module.exports = { beforeSave };
