# NILIX

> *"From nil, all structures emerge."*

A terminal-aesthetic business application engine. Forms, reports, explorers, data — parsed from declarative XML and YAML, rendered in monospace. Inspired by the architecture of Blame! — layered, recursive, purposeful.

---

## Submodules

| Module | Role |
|--------|------|
| **nil-form** | XML form parser and renderer — fields, validation, lookups, multifields |
| **nil-report** | YAML report engine — tables, zones, header/footer, public access |
| **nil-explorer** | Menu/file explorer — recursive XML menu, RADU permissions |
| **nil-data** | SQLite data layer — ScopedDb, multi-tenant, CRUD, catalogs |
| **nil-handler** | Custom handler hooks — before/after/beforeSave per form |
| **nil-runtime** | Express server runtime — auth, JWT, cookies, middleware |

---

## Quick Start

```bash
# 1. Install dependencies
npm install --no-bin-links   # exFAT drives require --no-bin-links

# 2. Create .env (see .env.example)
cp .env.example .env
# Edit NIL_ variables as needed

# 3. Initialize auth database
node utils/init-auth.js

# 4. Start server
node server.js
```

Open `http://localhost:3000` and log in with the credentials set during init.

### Environment Variables

```env
NIL_MENU_FILE=/path/to/your/app/menu.xml
NIL_PORT=3000
NIL_DB_FILE=/path/to/your/app/dbase/app.db
NIL_AUTH_DB=data/auth.db
NIL_JWT_SECRET=<random-256-bit-hex>
NIL_JWT_EXPIRY=8h

# Optional
NIL_ALLOWED_ORIGIN=http://192.168.1.x:3000
NIL_TLS_CERT=/path/to/cert.pem
NIL_TLS_KEY=/path/to/key.pem
```

---

## Philosophy

Nilix follows a layered, declarative philosophy:

- **Forms** are XML. Fields, validation, lookups — all in the file. No code for CRUD.
- **Reports** are YAML. Data sources, zones, expressions — declared, not programmed.
- **Handlers** are minimal. Only custom logic. The engine handles the rest.
- **Multi-tenant** by default. Every query is scoped by `empresa_id`. Handlers never touch it.
- **Terminal aesthetic**. Monospace, brutalist, no JS frameworks. The UI is a tool, not a product.

The engine expands from nil — a menu file, a form file, and a handler if you need one. Everything else is derived.

---

## Form XML Example

```xml
<form title="Products" database="products" keyField="id" handler="none">
    <field id="id"      type="number" label="ID"    skip="true"/>
    <field id="name"    type="text"   label="Name"  required="true"/>
    <field id="price"   type="number" label="Price"/>
    <field id="active"  type="check"  label="Active"/>
</form>
```

Menu entry:

```xml
<item type="form" label="Products" target="/path/to/your/app/forms/products.xml"
      permissions="RADU"/>
```

---

## Report YAML Example

```yaml
name: products
description: Product Listing

dataSources:
  products:
    table: products
  categories:
    table: categories

zones:
  - id: list
    type: table
    dataSource: products
    columns:
      - field: name
      - field: price
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login — sets `nil_token` HttpOnly cookie |
| POST | `/api/auth/logout` | Logout — clears cookie, blacklists JWT |
| GET | `/api/auth/check` | Check session — `{ ok, usuario, rol, publicToken }` |
| GET | `/api/menu` | Parse and return menu tree |
| GET | `/api/files/content?path=` | Serve authorized file |
| GET | `/api/records/:table` | List records (tenant-scoped) |
| POST | `/api/records/:table` | Insert record |
| PUT | `/api/records/:table/:id` | Update record |
| DELETE | `/api/records/:table/:id` | Delete record |
| GET | `/api/public/report-data/:report/:table?t=TOKEN` | Public report data |

---

## License

ISC
