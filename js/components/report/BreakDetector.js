/**
 * BreakDetector.js
 * Detect control breaks (changes in field values)
 */

export class BreakDetector {
    constructor() {
        this.previousValues = new Map();
    }

    detectChanges(currentRecord, breakFields) {
        const changes = [];

        for (const field of breakFields) {
            const currentValue = currentRecord[field];
            const previousValue = this.previousValues.get(field);

            if (previousValue !== undefined && currentValue !== previousValue) {
                changes.push({
                    field: field,
                    previousValue: previousValue,
                    currentValue: currentValue
                });
            }
        }

        return {
            hasChanges: changes.length > 0,
            changes: changes,
            afterOrder: [...changes],
            beforeOrder: [...changes].reverse()
        };
    }

    updateValues(currentRecord, breakFields) {
        for (const field of breakFields) {
            this.previousValues.set(field, currentRecord[field]);
        }
    }

    isFirstRecord() {
        return this.previousValues.size === 0;
    }

    reset() {
        this.previousValues.clear();
    }

    extractBreakFields(zones) {
        const fields = new Set();

        zones.forEach(zone => {
            if (zone.printCondition && zone.printCondition.triggers) {
                zone.printCondition.triggers.forEach(trigger => {
                    if (trigger.type === 'field' && trigger.fieldName) {
                        fields.add(trigger.fieldName);
                    }
                });
            }
        });

        return Array.from(fields);
    }
}

export default BreakDetector;
