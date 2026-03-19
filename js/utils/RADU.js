/**
 * @file RADU.js
 * @description Utilidad para parsear y consultar permisos RADU (Read/Add/Delete/Update)
 * @version 1.0.0 (v0.29.0)
 */

export class RADU {
    constructor(permString) {
        const s = (permString || 'RADU').toUpperCase();
        this.r = s.includes('R');
        this.a = s.includes('A');
        this.d = s.includes('D');
        this.u = s.includes('U');
        if (this.d || this.u) this.r = true;  // D o U implican R
    }
    canRead()   { return this.r; }
    canAdd()    { return this.a; }
    canDelete() { return this.d; }
    canUpdate() { return this.u; }
    canWrite()  { return this.a || this.u; }
}
