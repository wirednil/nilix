'use strict';

/**
 * @file nil-users.js
 * @description Handler for sys/form/nil-users.xml (operadores management).
 *   Loaded via @auth:nil-users prefix — runs on auth.db.
 *
 * Responsibilities:
 *   - beforeSave: enforce rol='operador', normalize activo boolean
 */

function beforeSave(data) {
    // Always operador — admin cannot escalate via this form
    data.rol = 'operador';

    if (data.activo !== undefined) data.activo = data.activo ? 1 : 0;
}

module.exports = { beforeSave };
