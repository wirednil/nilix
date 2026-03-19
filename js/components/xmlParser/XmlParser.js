/**
 * @file XmlParser.js
 * @description Utilidades para parsear y procesar XML de formularios
 * @module xmlParser
 */

/**
 * @namespace xmlParser
 * @description Utilidades para parsear y procesar XML
 */
const xmlParser = {
    /**
     * Parsea una cadena XML y extrae nodos importantes
     * @param {string} xmlString - Cadena XML a parsear
     * @returns {Object} Objeto con los nodos principales del formulario
     */
    parseFormXml(xmlString) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, "text/xml");
            
            // Verificar errores de parseo
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('Formato XML inválido: ' + parseError.textContent);
            }
            
            return {
                formNode: xmlDoc.querySelector('form'),
                messagesNode: xmlDoc.querySelector('messages'),
                layoutNode: xmlDoc.querySelector('layout'),
                xmlDoc
            };
        } catch (error) {
            console.error('❌ Error al parsear XML:', error);
            throw new Error('Formato XML inválido');
        }
    },

    /**
     * Extrae mensajes del nodo <messages> del XML
     * @param {Element} messagesNode - Nodo de mensajes XML
     * @returns {Object} Diccionario de mensajes {id: texto}
     */
    extractMessages(messagesNode) {
        const messages = {};
        if (!messagesNode) return messages;

        messagesNode.querySelectorAll('message').forEach(m => {
            messages[m.getAttribute('id')] = m.textContent;
        });

        return messages;
    },

    /**
     * Extrae la configuración del formulario desde el nodo form
     * @param {Element} formNode - Nodo form del XML
     * @returns {Object} Configuración del formulario
     */
    extractFormConfig(formNode) {
        if (!formNode) return {};

        return {
            id: formNode.getAttribute('id'),
            title: formNode.getAttribute('title'),
            database: formNode.getAttribute('database'),
            action: formNode.getAttribute('action'),
            method: formNode.getAttribute('method') || 'POST'
        };
    }
};

export default xmlParser;
