/**
 * @file authRecordService.js
 * @description CRUD operations on auth.db tables, exposed via the @auth: prefix
 *   in form XML (database="@auth:usuarios").
 *
 * Accessible tables: usuarios, usuario_permisos
 *   - Always scoped to empresaId (tenant isolation)
 *   - Sensitive columns (password_hash) never returned
 *   - usuarios: password_hash auto-hashed from `password`, but ONLY when
 *     creating a brand-new account (isNew). Changing an EXISTING account's
 *     password never goes through this generic path — see
 *     PUT /api/users/me/password (self-service, requires current password)
 *     and PUT /api/users/:id/password (admin/wizard reset, rank-checked) in
 *     usersController.js. Without that split, any tenant member able to
 *     reach this endpoint could silently take over ANY other account in
 *     their tenant (including admins) just by setting a new password on
 *     their row — there's nothing "current password" to take over on a
 *     record that doesn't exist yet, so creation is a different case.
 *   - delete = soft (activo=0)
 */

const bcrypt = require('bcryptjs');
const { getAuthDatabase, saveAuthDatabase } = require('./authDatabase');
const logger = require('./logger');

const SALT_ROUNDS = 10;

// Only these tables are accessible via @auth: prefix
const ALLOWED = new Set(['usuarios', 'usuario_permisos']);

// Columns excluded from all responses
const HIDDEN = new Set(['password_hash']);

// Explicit allowlist of columns a client may set through this generic CRUD
// path, per table. rol, activo, failed_attempts, and empresa_id are
// privileged / tenant-scoping / lockout fields — they require a dedicated
// role-gated endpoint (see usersController.js's requireAdmin) and are never
// accepted from req.body.data, regardless of which (if any) @auth: handler
// the client claims to invoke. A handler is a UI convenience, not a security
// boundary. password / password_hash are deliberately absent too — password
// is handled as a special, isNew-only case inside upsert() (see the file
// header comment), never as a generic editable column, and password_hash is
// never a direct client input at all.
// permisos ('RADU'/'RAU'/'RA'/'R') stays editable — it does not grant
// cross-tenant access (only rol='wizard' does, see authRecordController.js's
// GLOBAL_AUTH_ROLES) — but it IS an intra-tenant privilege lever (an operador
// with write access to usuarios could grant themselves RADU on their own
// row). That still needs a "caller must be admin/wizard" check that doesn't
// exist yet — noted, not fixed here.
const EDITABLE_FIELDS = {
    usuarios: new Set([
        'nombre', 'usuario', 'email', 'permisos',
        'force_change', 'never_exp', 'exp_days',
        'pass_from', 'pass_to', 'warn_days', 'warn_date', 'allow_change',
    ]),
    usuario_permisos: new Set(['target', 'perms']),
};

const VALID_PERMISOS = new Set(['RADU', 'RAU', 'RA', 'R']);

function editableFields(tableName) {
    return EDITABLE_FIELDS[tableName] ?? new Set();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tableAllowed(tableName) {
    return ALLOWED.has(tableName);
}

function rowToObject(columns, values) {
    const obj = {};
    columns.forEach((c, i) => { obj[c] = values[i]; });
    return obj;
}

function stripHidden(obj) {
    const clean = { ...obj };
    for (const col of HIDDEN) delete clean[col];
    return clean;
}

function getColumns(db, tableName) {
    const result = db.exec(`PRAGMA table_info(${tableName})`);
    if (!result.length) return [];
    return result[0].values.map(v => v[1]);
}

// keyField is a column NAME, not a value — it can never be bound with `?`,
// so every function that interpolates it into raw SQL must validate it
// against the table's real columns first. Mirrors recordService.ts's
// assertColumnAllowed(tableName, keyField) on the app-db side (same
// COLUMN_FORBIDDEN code, same idea), reusing getColumns() — already the
// source of truth for "is this a real column" elsewhere in this file —
// instead of a regex or escaping, which can't validate an identifier the way
// a lookup against the actual schema can.
function assertKeyFieldAllowed(db, tableName, keyField) {
    if (!getColumns(db, tableName).includes(keyField)) {
        const err = new Error(`Column not allowed: ${keyField}`);
        err.code = 'COLUMN_FORBIDDEN';
        throw err;
    }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// empresaId=null → global access (no tenant scope).
// Determined by the caller based on the user's rol from the JWT.

function findById(tableName, keyField, id, empresaId) {
    const db = getAuthDatabase();
    assertKeyFieldAllowed(db, tableName, keyField);
    const rows = empresaId === null
        ? db.exec(`SELECT * FROM ${tableName} WHERE ${keyField} = ? LIMIT 1`, [id])
        : db.exec(`SELECT * FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ? LIMIT 1`, [id, empresaId]);
    if (!rows.length || !rows[0].values.length) return null;
    return stripHidden(rowToObject(rows[0].columns, rows[0].values[0]));
}

/**
 * Upsert: insert if no keyField value, update if exists.
 * Special handling for usuarios:
 *   - password → password_hash (bcrypt)
 *   - empty password on update → skip password change
 *   - empresa_id always enforced from token
 *
 * _requestUserId: kept for call-site compatibility (authRecordController.js
 * passes req.usuarioId) but currently unused — activo is no longer settable
 * through this path at all (see EDITABLE_FIELDS), so the self-deactivation
 * guard that used to live here is dead and was removed. Re-introduce this
 * param's use if/when a role-gated activo endpoint is added and needs it.
 */
async function upsert(tableName, keyField, data, empresaId, _requestUserId = null) {
    const db = getAuthDatabase();
    let insertData = { ...data };

    // A client-supplied password_hash is never legitimate (e.g. a hash
    // stolen from another account, or a self-generated one) — the only valid
    // way this column gets a value is computed fresh from `password` below,
    // and only at creation time. Track it explicitly so it surfaces as a
    // loud FIELD_NOT_ALLOWED rejection like any other disallowed column,
    // instead of silently vanishing.
    const rawPasswordHash = Object.prototype.hasOwnProperty.call(insertData, 'password_hash');
    delete insertData.password_hash;

    const keyValue = insertData[keyField];
    const isNew = keyValue === undefined || keyValue === null || keyValue === '' || keyValue === 0;

    const validCols = getColumns(db, tableName);
    const hasUpdatedAt = validCols.includes('updated_at');

    // Fields that are legitimately absent from the allowlist but not an error
    // to receive — they're either the record's own key or server-managed.
    // Anything else that (a) is a real column and (b) isn't editable through
    // this path gets rejected loudly below instead of silently dropped: a
    // field that looks saved but wasn't is worse than a 400. Checked before
    // the usuarios-specific validation below so a rejection always names the
    // actual offending field (e.g. a raw password_hash) rather than a more
    // generic downstream error.
    const allowed = editableFields(tableName);
    const isFieldAllowed = f => allowed.has(f) || (isNew && f === 'password_hash');
    const structural = new Set([keyField, 'empresa_id', 'created_at', 'updated_at']);

    const rejected = Object.keys(insertData).filter(f =>
        validCols.includes(f) && !structural.has(f) && !isFieldAllowed(f) && insertData[f] !== undefined
    );
    if (rawPasswordHash) rejected.push('password_hash');
    if (rejected.length) {
        logger.warn({ tableName, keyField, fields: rejected }, '[AUTH_RECORD] Rejected non-editable field(s)');
        const err = new Error(`Campo(s) no editable(s) vía esta ruta: ${rejected.join(', ')}`);
        err.code = 'FIELD_NOT_ALLOWED';
        err.fields = rejected;
        throw err;
    }

    if (tableName === 'usuarios') {
        // Enforce tenant — null = global wizard access → empresa_id=0
        insertData.empresa_id = empresaId !== null ? empresaId : 0;

        if (insertData.permisos !== undefined && !VALID_PERMISOS.has(insertData.permisos)) {
            const err = new Error(`permisos inválido: ${insertData.permisos} (valores válidos: ${[...VALID_PERMISOS].join(', ')})`);
            err.code = 'INVALID_PERMISOS';
            throw err;
        }

        const suppliedPassword = insertData.password;
        delete insertData.password;

        if (isNew) {
            // Creating a brand-new account needs an initial password_hash
            // (NOT NULL column) — there's no "current password" to take over
            // yet, so this is a different case from changing an existing
            // account's password (blocked below, see the file header).
            if (!suppliedPassword) {
                const err = new Error('password es requerida al crear un usuario');
                err.code = 'PASSWORD_REQUIRED';
                throw err;
            }
            if (String(suppliedPassword).length < 8) {
                const err = new Error('La contraseña debe tener al menos 8 caracteres');
                err.code = 'PASSWORD_TOO_SHORT';
                throw err;
            }
            insertData.password_hash = await bcrypt.hash(String(suppliedPassword), SALT_ROUNDS);
        } else if (suppliedPassword) {
            // Non-empty password on an UPDATE of an existing account — reject
            // loudly, same as any other disallowed field (see file header for
            // why: use PUT /api/users/me/password or /:id/password instead).
            // An EMPTY password field is left alone, not rejected — the
            // existing forms (nil-users.xml, nil-wizard.xml) use "vacío = no
            // cambiar" as their convention and always submit the field, so
            // treating blank as "no intent to change" avoids breaking every
            // unrelated field update on those forms.
            const err = new Error('Campo(s) no editable(s) vía esta ruta: password');
            err.code = 'FIELD_NOT_ALLOWED';
            err.fields = ['password'];
            throw err;
        }
    }

    if (!isNew) {
        // Verify record belongs to this empresa
        const existing = findById(tableName, keyField, keyValue, empresaId);
        if (!existing) {
            const err = new Error(`Record not found: ${keyField}=${keyValue}`);
            err.code = 'RECORD_NOT_FOUND';
            throw err;
        }

        // password_hash never reaches here: isFieldAllowed only admits it when
        // isNew, and this is the update branch.
        const fields = Object.keys(insertData).filter(f =>
            isFieldAllowed(f) &&
            validCols.includes(f) &&
            f !== keyField &&
            f !== 'empresa_id' &&
            f !== 'created_at' &&   // creation timestamp — never mutated by form updates
            insertData[f] !== undefined
        );

        logger.info({
            fn: 'authRecordService.upsert',
            tableName, keyField, keyValue, empresaId,
            fields
        }, '[AUTH_RECORD] UPDATE');

        if (fields.length > 0) {
            const setParts = fields.map(f => `${f} = ?`);
            if (hasUpdatedAt) setParts.push(`updated_at = datetime('now')`);
            const whereClause = empresaId === null
                ? `${keyField} = ?`
                : `${keyField} = ? AND empresa_id = ?`;
            const values = empresaId === null
                ? [...fields.map(f => insertData[f]), keyValue]
                : [...fields.map(f => insertData[f]), keyValue, empresaId];
            db.run(`UPDATE ${tableName} SET ${setParts.join(', ')} WHERE ${whereClause}`, values);
        }

        const afterState = findById(tableName, keyField, keyValue, empresaId);
        logger.info({ fn: 'authRecordService.upsert.result', activo: afterState?.activo, failed_attempts: afterState?.failed_attempts }, '[AUTH_RECORD] UPDATE result');

        saveAuthDatabase();
        return { ...findById(tableName, keyField, keyValue, empresaId), updated: true };
    } else {
        // INSERT — empresa_id is always server-derived from the caller's own
        // session, never taken from the client's data. Previously this only
        // defaulted empresa_id when the client omitted it, so a client-supplied
        // empresa_id in the request body silently overrode the caller's real
        // tenant and created a user in an arbitrary company. Global (wizard)
        // access keeps empresaId === null and may still choose a target tenant
        // explicitly.
        if (empresaId !== null) insertData.empresa_id = empresaId;

        const fields = Object.keys(insertData).filter(f =>
            (isFieldAllowed(f) || f === 'empresa_id') &&
            validCols.includes(f) &&
            insertData[f] !== undefined &&
            // Skip empty keyField — let DB auto-assign (e.g. INTEGER PRIMARY KEY AUTOINCREMENT)
            !(f === keyField && (insertData[f] === '' || insertData[f] === null || insertData[f] === 0))
        );
        const placeholders = fields.map(() => '?').join(', ');
        const values = fields.map(f => insertData[f]);

        db.run(
            `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`,
            values
        );
        const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        saveAuthDatabase();
        return { ...findById(tableName, keyField, newId, empresaId), created: true };
    }
}

function navigate(tableName, keyField, currentKey, dir, empresaId) {
    const db = getAuthDatabase();
    assertKeyFieldAllowed(db, tableName, keyField);
    const op    = dir === 'next' ? '>' : '<';
    const order = dir === 'next' ? 'ASC' : 'DESC';
    const rows = empresaId === null
        ? db.exec(
            `SELECT * FROM ${tableName} WHERE ${keyField} ${op} ? ORDER BY ${keyField} ${order} LIMIT 1`,
            [currentKey])
        : db.exec(
            `SELECT * FROM ${tableName} WHERE ${keyField} ${op} ? AND empresa_id = ? ORDER BY ${keyField} ${order} LIMIT 1`,
            [currentKey, empresaId]);
    if (!rows.length || !rows[0].values.length) return null;
    return stripHidden(rowToObject(rows[0].columns, rows[0].values[0]));
}

function remove(tableName, keyField, id, empresaId) {
    const db = getAuthDatabase();
    const existing = findById(tableName, keyField, id, empresaId);
    if (!existing) {
        const err = new Error(`Record not found: ${keyField}=${id}`);
        err.code = 'RECORD_NOT_FOUND';
        throw err;
    }

    // Soft delete for usuarios (preserve history, revoke access)
    if (tableName === 'usuarios') {
        const whereClause = empresaId === null ? `${keyField} = ?` : `${keyField} = ? AND empresa_id = ?`;
        const params = empresaId === null ? [id] : [id, empresaId];
        db.run(`UPDATE usuarios SET activo = 0, updated_at = datetime('now') WHERE ${whereClause}`, params);
    } else {
        const whereClause = empresaId === null ? `${keyField} = ?` : `${keyField} = ? AND empresa_id = ?`;
        const params = empresaId === null ? [id] : [id, empresaId];
        db.run(`DELETE FROM ${tableName} WHERE ${whereClause}`, params);
    }
    saveAuthDatabase();
    return true;
}

/**
 * Creates a system-wide wizard account — rol='wizard', empresa_id=0, always.
 * The ONLY place in this codebase allowed to set rol='wizard' on an insert.
 *
 * Deliberately NOT built on upsert(): that path's EDITABLE_FIELDS allowlist
 * excludes rol on purpose (see the file header and EDITABLE_FIELDS comment
 * above), and this function exists precisely because that privilege still
 * needs to be grantable somewhere. Routing it through upsert() with a flag
 * to skip the allowlist would make the allowlist optional — the exact thing
 * three rounds of fixes on this file were about removing. Instead the
 * privilege is named in its own function, with its own fixed values, never
 * taking rol or empresa_id from a caller-supplied object.
 *
 * Not exposed over HTTP anywhere — meant to be called from a server-side
 * script only (see utils/create-wizard.js), which is also responsible for
 * calling saveAuthDatabase()/closeAuthDatabase() at the right time and for
 * warning about a live server sharing the same auth.db.
 */
async function createSystemWizard({ nombre, usuario, password }) {
    if (!nombre?.trim() || !usuario?.trim() || !password) {
        const err = new Error('nombre, usuario y password son requeridos');
        err.code = 'MISSING_FIELDS';
        throw err;
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(usuario)) {
        const err = new Error('usuario: solo letras, números, _ y - (3-30 caracteres)');
        err.code = 'INVALID_USUARIO';
        throw err;
    }
    if (String(password).length < 8) {
        const err = new Error('La contraseña debe tener al menos 8 caracteres');
        err.code = 'PASSWORD_TOO_SHORT';
        throw err;
    }

    const db = getAuthDatabase();

    // FK constraints are never enforced at runtime (no PRAGMA foreign_keys —
    // see database.js/authDatabase.js), so an INSERT against a missing
    // empresa_id=0 would succeed silently and create an orphaned wizard
    // instead of failing. Check explicitly.
    let empresaRow;
    try {
        empresaRow = db.exec('SELECT id FROM empresas WHERE id = 0');
    } catch (e) {
        const err = new Error(`El schema de auth.db no existe todavía (${e.message}). Corré el setup wizard o initAuthDatabase() primero.`);
        err.code = 'SYSTEM_TENANT_MISSING';
        throw err;
    }
    if (!empresaRow.length || !empresaRow[0].values.length) {
        const err = new Error('empresa_id=0 ("Nilix System") no existe todavía — corré initAuthDatabase() primero (crea esa fila si el schema ya existe).');
        err.code = 'SYSTEM_TENANT_MISSING';
        throw err;
    }

    const hash = await bcrypt.hash(String(password), SALT_ROUNDS);
    try {
        db.run(
            `INSERT INTO usuarios (empresa_id, nombre, usuario, password_hash, rol, permisos)
             VALUES (0, ?, ?, ?, 'wizard', 'RADU')`,
            [nombre.trim(), usuario.trim(), hash]
        );
    } catch (e) {
        if (e.message.includes('UNIQUE')) {
            const err = new Error(`El usuario "${usuario}" ya existe`);
            err.code = 'USUARIO_EXISTS';
            throw err;
        }
        throw e;
    }

    const newId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    saveAuthDatabase();
    return findById('usuarios', 'id', newId, null);
}

module.exports = { tableAllowed, findById, upsert, navigate, remove, createSystemWizard };
