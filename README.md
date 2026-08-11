# NILIX

[![CI](https://github.com/wirednil/nilix/actions/workflows/ci.yml/badge.svg)](https://github.com/wirednil/nilix/actions/workflows/ci.yml)

> *"From nil, all structures emerge."*

A terminal-aesthetic business application engine. Forms, reports, explorers, data — parsed from declarative XML and YAML, rendered in monospace. Inspired by the architecture of Blame! — layered, recursive, purposeful.

---

## Building something with an AI agent, or new to this repo?

Read [`AGENTS.md`](AGENTS.md) before writing any form XML, report YAML, or
handler — nilix's syntax is its own, not HTML/Django/Angular/Jinja, and the
examples below are deliberately minimal. Full spec and getting-started guide:
[`docs/01-getting-started/README.md`](docs/01-getting-started/README.md).

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

**Node.js (bare-metal)**
```bash
git clone https://github.com/wirednil/nilix.git && cd nilix
node scripts/setup.js   # configures .env, installs deps, initializes dev sandbox
node server.js
```

**Docker**
```bash
git clone https://github.com/wirednil/nilix.git && cd nilix
cp .env.example .env    # edit NIL_JWT_SECRET
docker compose up
```

Open `http://localhost:3000` and log in with the dev sandbox credentials:

```
usuario:  superdvlp
password: devpass1234
```

`setup.js` (bare-metal) or the Docker entrypoint handle everything: JWT secret, dependencies, and dev database initialization. See `.env.example` for all available variables.

### Key Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NIL_JWT_SECRET` | JWT signing secret — 256-bit hex | Yes |
| `NIL_MENU_FILE` | Absolute path to your app's `menu.xml` | Yes |
| `NIL_DB_FILE` | SQLite path for app data | Yes |
| `NIL_AUTH_DB` | SQLite path for auth data | Yes |
| `NIL_ALLOWED_ORIGIN` | CORS allowed origin — required in production | Prod |
| `NIL_TLS_CERT` / `NIL_TLS_KEY` | TLS cert/key paths — enables HTTPS | Optional |

---

## Philosophy

Nilix follows a layered, declarative philosophy:

- **Forms** are XML. Fields, validation, lookups — all in the file. No code for CRUD.
- **Reports** are YAML. Data sources, zones, expressions — declared, not programmed.
- **Handlers** are minimal. Only custom logic. The engine handles the rest.
- **Multi-tenant** by default. Every query is scoped by `empresa_id`. Handlers never touch it.
  Opting out is per-table, not a config flag: a table with no `empresa_id`
  column is simply never scoped (`schemaService.hasColumn()` decides this
  per query — there is nothing to switch off).
- **Terminal aesthetic**. Monospace, brutalist, no JS frameworks. The UI is a tool, not a product.

The engine expands from nil — a menu file, a form file, and a handler if you need one. Everything else is derived.

---

## Form XML Example

Fields live inside `<layout>` → `<container>` (never flat under `<form>`).
The key field is marked with `keyField="true"` on the `<field>` itself — not
a form-level attribute. Options and validation are child elements, not flat
string attributes:

```xml
<form id="products" title="Products" database="products" handler="none">
    <layout>
        <container type="horizontal">
            <field id="id" label="ID" type="number" keyField="true" size="6"/>
        </container>
        <container type="vertical">
            <field id="name" label="Name" type="text" size="50">
                <validation><required>true</required></validation>
            </field>
            <field id="price" label="Price" type="number" decimals="2"/>
            <field id="category" label="Category" type="select">
                <options>
                    <option value="1">Tools</option>
                    <option value="2">Parts</option>
                </options>
            </field>
            <field id="active" label="Active" type="checkbox" default="true"/>
        </container>
    </layout>
</form>
```

There is no `depends=`/conditional-field-visibility attribute — it's not
implemented (see `AGENTS.md` for the full list of syntax that looks
plausible but isn't real).

Menu entry — the tag is `<option>`, never `<item>` (a different tag is
silently ignored, not an error):

```xml
<option type="form" label="Products" target="form/products.xml"
        permissions="RADU"/>
```

---

## Report YAML Example

Zones use `name`/`layout`/`template` — not `id`/`type`/`content`. Every
report declares `kind: document` or `kind: ledger` (required):

```yaml
name: products
description: Product Listing
kind: document

dataSources:
  products:
    table: products
    orderBy: [name]

zones:
  - name: header
    condition: { when: before, on: report }
    template: ["PRODUCT LISTING"]

  - name: detalle
    layout: lines
    dataSource: products
    expressions:
      - { name: precio_fmt, field: price, format: currency }
    template: ["{name}   {precio_fmt}"]
```

`layout: table` (HTML `<table>` with typed `columns:`) only works as a
detail zone — no `condition:` — one row per record, not a multi-row summary
table; see `docs/03-reference/NIL-REPORT.md` §5.3 for the confirmed gap and
the `rowTemplate` alternative for a real multi-row table. Full spec,
including `kind`/zone roles: [`docs/03-reference/NIL-REPORT.md`](docs/03-reference/NIL-REPORT.md).

---

## API Endpoints

Full spec: [`docs/api/openapi.yaml`](docs/api/openapi.yaml) (OpenAPI 3.1 — importable in Postman/Insomnia).

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Server + DB status (unversioned) |
| POST | `/api/v1/auth/login` | — | Login — sets `nil_token` HttpOnly cookie |
| POST | `/api/v1/auth/logout` | — | Logout — clears cookie, blacklists JWT |
| GET | `/api/v1/auth/check` | — | Check session — `{ ok, usuario, rol, publicToken }` |
| POST | `/api/v1/auth/refresh` | — | Rotate token — issues new JWT, blacklists old |
| GET  | `/api/v1/menu` | 🔒 | Parse and return menu tree |
| POST | `/api/v1/records/app/:table` | 🔒 | CRUD on app DB (get/insert/update/delete) |
| POST | `/api/v1/records/auth/:table` | 🔒 | CRUD on auth DB (users, permissions) |
| POST | `/api/v1/handler/:handler/after` | 🔒 | Execute handler after() callback |
| GET | `/api/v1/public/report-data/:report/:table?t=TOKEN` | — | Public report data |
| POST | `/api/security/csp-report` | — | CSP violation receiver (unversioned) |
| GET | `/api/server-info` | — | Server network IP (unversioned) |

> Note: `/api/*` paths still work as deprecated alias (with `Deprecation: true` header).

---

## License

ISC
