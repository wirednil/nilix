'use strict';

/**
 * @file nil-wizard.js
 * @description Auth handler for nil-wizard form (system users: wizard/admin/auditor).
 *
 * Handles:
 *   - Create vs update mode: lock/unlock fields via enableFields/disableFields
 *   - never_exp toggle: show/hide expiration fields
 *   - Expiration date computation: pass_to = pass_from + exp_days
 *                                  warn_date = pass_to - warn_days
 */

const EXP_FIELDS   = ['exp_days', 'pass_from', 'pass_to', 'warn_days', 'warn_date'];
const ROLE_PERMISOS = { wizard: 'RADU', admin: 'RAU', auditor: 'R' };

/** Returns YYYY-MM-DD string for dateStr + n days, or '' on invalid input. */
function addDays(dateStr, days) {
    if (!dateStr || days == null || days === '') return '';
    const n = Number(days);
    if (isNaN(n)) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

/**
 * Computes pass_to and warn_date from the current data + changed field.
 * Returns { setValues: { pass_to, warn_date } } or null.
 */
function computeExpDates(data) {
    const passTo   = addDays(data.pass_from, data.exp_days);
    const warnDate = passTo ? addDays(passTo, -(Number(data.warn_days) || 0)) : '';

    const setValues = {};
    if (passTo   !== undefined) setValues.pass_to   = passTo;
    if (warnDate !== undefined) setValues.warn_date  = warnDate;

    return Object.keys(setValues).length ? { setValues } : null;
}

function after(fieldId, value, data /*, empresaId */) {

    // Create vs update mode: driven by the id (keyField)
    if (fieldId === 'id') {
        if (value) {
            return {
                disableFields: ['usuario'],
                enableFields:  ['failed_attempts']
            };
        }
        return null;
    }

    // never_exp toggle: show/hide expiration fields
    if (fieldId === 'never_exp') {
        const isNever = value == 1 || value === true || value === '1';
        return isNever
            ? { disableFields: EXP_FIELDS }
            : { enableFields:  EXP_FIELDS };
    }

    // Expiration date computation
    if (['exp_days', 'pass_from', 'warn_days'].includes(fieldId)) {
        const merged = { ...data, [fieldId]: value };
        return computeExpDates(merged);
    }

    return null;
}

/**
 * beforeSave — runs server-side before the record is persisted.
 * Mutates data in place.
 */
function beforeSave(data /*, empresaId */) {
    // Auto-calculate permisos from rol — never trust client value
    if (data.rol && ROLE_PERMISOS[data.rol]) {
        data.permisos = ROLE_PERMISOS[data.rol];
    }
    // Normalize booleans that arrive as strings
    if (data.activo      !== undefined) data.activo      = data.activo      ? 1 : 0;
    if (data.force_change !== undefined) data.force_change = data.force_change ? 1 : 0;
    if (data.never_exp   !== undefined) data.never_exp   = data.never_exp   ? 1 : 0;
}

module.exports = { after, beforeSave };
