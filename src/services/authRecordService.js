/**
 * @file authRecordService.js
 * @description CRUD operations on auth.db tables, exposed via the @auth: prefix
 *   in form XML (database="@auth:usuarios").
 *
 * Accessible tables: usuarios, usuario_permisos
 *   - Always scoped to empresaId (tenant isolation)
 *   - Sensitive columns (password_hash, failed_attempts) never returned
 *   - usuarios: password field auto-hashed; delete = soft (activo=0)
 */

const bcrypt = require('bcryptjs');
const { getAuthDatabase, saveAuthDatabase } = require('./authDatabase');

const SALT_ROUNDS = 10;

// Only these tables are accessible via @auth: prefix
const ALLOWED = new Set(['usuarios', 'usuario_permisos']);

// Columns excluded from all responses
const HIDDEN = new Set(['password_hash', 'failed_attempts']);

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

// ─── CRUD ─────────────────────────────────────────────────────────────────────

function findById(tableName, keyField, id, empresaId) {
    const db = getAuthDatabase();
    const rows = db.exec(
        `SELECT * FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ? LIMIT 1`,
        [id, empresaId]
    );
    if (!rows.length || !rows[0].values.length) return null;
    return stripHidden(rowToObject(rows[0].columns, rows[0].values[0]));
}

/**
 * Upsert: insert if no keyField value, update if exists.
 * Special handling for usuarios:
 *   - password → password_hash (bcrypt)
 *   - empty password on update → skip password change
 *   - empresa_id always enforced from token
 *   - activo=0 on own account blocked via requestUserId
 */
async function upsert(tableName, keyField, data, empresaId, requestUserId = null) {
    const db = getAuthDatabase();
    let insertData = { ...data };

    if (tableName === 'usuarios') {
        // Enforce tenant
        insertData.empresa_id = empresaId;

        // Hash password if provided, skip if empty
        if (insertData.password) {
            if (String(insertData.password).length < 8) {
                const err = new Error('La contraseña debe tener al menos 8 caracteres');
                err.code = 'PASSWORD_TOO_SHORT';
                throw err;
            }
            insertData.password_hash = await bcrypt.hash(String(insertData.password), SALT_ROUNDS);
        }
        delete insertData.password;

        // Never trust client for these fields
        delete insertData.failed_attempts;

        // Normalize rol
        if (insertData.rol && !['admin', 'operador'].includes(insertData.rol)) {
            insertData.rol = 'operador';
        }

        // Prevent self-deactivation
        const keyValue = insertData[keyField];
        if (requestUserId && keyValue && Number(keyValue) === Number(requestUserId)) {
            if (insertData.activo === 0 || insertData.activo === false || insertData.activo === '0') {
                const err = new Error('No podés desactivar tu propia cuenta');
                err.code = 'SELF_DEACTIVATION';
                throw err;
            }
        }
    }

    const keyValue = insertData[keyField];
    const isNew = keyValue === undefined || keyValue === null || keyValue === '' || keyValue === 0;

    const validCols = getColumns(db, tableName);
    const hasUpdatedAt = validCols.includes('updated_at');

    if (!isNew) {
        // Verify record belongs to this empresa
        const existing = findById(tableName, keyField, keyValue, empresaId);
        if (!existing) {
            const err = new Error(`Record not found: ${keyField}=${keyValue}`);
            err.code = 'RECORD_NOT_FOUND';
            throw err;
        }

        // Reactivation: reset failed_attempts so the unblocked user gets a fresh slate
        if (tableName === 'usuarios' && (insertData.activo === 1 || insertData.activo === true || insertData.activo === '1')) {
            insertData.failed_attempts = 0;
        }

        const fields = Object.keys(insertData).filter(f =>
            validCols.includes(f) &&
            f !== keyField &&
            f !== 'empresa_id' &&
            insertData[f] !== undefined &&
            // Skip password_hash if no new password was supplied
            !(f === 'password_hash' && !insertData.password_hash)
        );

        if (fields.length > 0) {
            const setParts = fields.map(f => `${f} = ?`);
            if (hasUpdatedAt) setParts.push(`updated_at = datetime('now')`);
            const values = [...fields.map(f => insertData[f]), keyValue, empresaId];
            db.run(
                `UPDATE ${tableName} SET ${setParts.join(', ')} WHERE ${keyField} = ? AND empresa_id = ?`,
                values
            );
        }

        saveAuthDatabase();
        return { ...findById(tableName, keyField, keyValue, empresaId), updated: true };
    } else {
        // INSERT — enforce empresa_id
        if (!insertData.empresa_id) insertData.empresa_id = empresaId;

        const fields = Object.keys(insertData).filter(f =>
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
    const op    = dir === 'next' ? '>' : '<';
    const order = dir === 'next' ? 'ASC' : 'DESC';
    const rows = db.exec(
        `SELECT * FROM ${tableName} WHERE ${keyField} ${op} ? AND empresa_id = ? ORDER BY ${keyField} ${order} LIMIT 1`,
        [currentKey, empresaId]
    );
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
        db.run(
            `UPDATE usuarios SET activo = 0, updated_at = datetime('now') WHERE ${keyField} = ? AND empresa_id = ?`,
            [id, empresaId]
        );
    } else {
        db.run(
            `DELETE FROM ${tableName} WHERE ${keyField} = ? AND empresa_id = ?`,
            [id, empresaId]
        );
    }
    saveAuthDatabase();
    return true;
}

module.exports = { tableAllowed, findById, upsert, navigate, remove };
