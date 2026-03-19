const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.NIL_DB_FILE
    ?? path.join(__dirname, '../../data/catalogs.db');

let db = null;
let SQL = null;

async function initDatabase() {
    if (db) return db;
    
    SQL = await initSqlJs();
    
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
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
    fs.writeFileSync(DB_PATH, buffer);
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
