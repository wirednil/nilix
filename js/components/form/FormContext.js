/**
 * @file FormContext.js
 * @description Contexto centralizado del formulario con registro de campos
 */

import xmlParser from '../xmlParser/index.js';

export class FormContext {
    constructor(formNode, messagesNode, layoutNode) {
        this.title = formNode.getAttribute('title');
        this.database = formNode.getAttribute('database');
        this.formAction = formNode.getAttribute('action') || null;  // e.g. /api/auth/login
        this.formId = this.database || 'default-form';
        this.messages = xmlParser.extractMessages(messagesNode);
        this.layoutNode = layoutNode;

        const _handler = formNode.getAttribute('handler');
        const handler = (_handler && _handler !== 'none') ? _handler : null;
        const crudMode = formNode.getAttribute('crud-mode') || null;
        const keyField = this._findKeyField(layoutNode);

        this.tableConfig = (this.database || handler)
            ? { table: this.database, keyField, handler, crudMode }
            : null;

        this.outputDirectives = this._parseOutputDirectives(formNode);
        this.currentKey = null;
        this.permissions = null;
        this.formPath = null;
        this.fields = new Map();
        this.container = null;
        this.abortController = new AbortController();
    }

    get signal() {
        return this.abortController.signal;
    }

    destroy() {
        this.abortController.abort();
        this.fields.clear();
    }

    registerField(id, element) {
        this.fields.set(id, element);
    }

    getField(id) {
        return this.fields.get(id);
    }

    getAllFieldIds() {
        return Array.from(this.fields.keys());
    }

    _parseOutputDirectives(formNode) {
        const directives = [];
        const outputEls = formNode.getElementsByTagName
            ? Array.from(formNode.getElementsByTagName('output'))
            : [];
        for (const el of outputEls) {
            const report = el.getAttribute('report');
            const param  = el.getAttribute('param');
            if (!report || !param) continue;
            directives.push({
                report,
                param,
                on:        el.getAttribute('on') || 'save',
                condition: el.getAttribute('condition') || null
            });
        }
        return directives;
    }

    _findKeyField(layoutNode) {
        if (!layoutNode) return null;

        const findRecursive = (node) => {
            if (node.tagName?.toUpperCase() === 'FIELD' && (node.getAttribute('key') === 'true' || node.getAttribute('keyField') === 'true')) {
                return node.getAttribute('id');
            }
            for (const child of node.children) {
                const result = findRecursive(child);
                if (result) return result;
            }
            return null;
        };

        for (const child of layoutNode.children) {
            const result = findRecursive(child);
            if (result) return result;
        }
        return null;
    }
}

export default FormContext;
