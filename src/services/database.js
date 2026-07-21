const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
let SQL = null;
let DB_PATH = null;

function resolveDbPath() {
    if (DB_PATH) return DB_PATH;
    DB_PATH = process.env.NIL_DB_FILE
        ?? path.join(__dirname, '../../data/catalogs.db');
    return DB_PATH;
}

async function initDatabase() {
    if (db) return db;
    
    const dbPath = resolveDbPath();
    SQL = await initSqlJs();
    
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }
    
    return db;
}

function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

function saveDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(resolveDbPath(), buffer);
}

function closeDatabase() {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    saveDatabase,
    closeDatabase
};
