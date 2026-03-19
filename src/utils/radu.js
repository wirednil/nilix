function RADU(permString) {
    const s = (permString || 'RADU').toUpperCase();
    return {
        canRead:   () => s.includes('R') || s.includes('D') || s.includes('U'),
        canAdd:    () => s.includes('A'),
        canDelete: () => s.includes('D'),
        canUpdate: () => s.includes('U'),
    };
}
module.exports = RADU;
