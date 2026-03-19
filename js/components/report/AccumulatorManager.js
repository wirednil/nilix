/**
 * AccumulatorManager.js
 * Manage aggregation functions (sum, avg, count, min, max, runsum, etc.)
 */

export class AccumulatorManager {
    constructor() {
        this.levelAccumulators = new Map();
        this.globalAccumulators = this.createAccumulator();
    }

    createAccumulator() {
        return {
            sum: new Map(),
            count: new Map(),
            min: new Map(),
            max: new Map(),
            values: new Map()
        };
    }

    update(fieldName, value, breakLevel = null) {
        const numValue = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(numValue)) return;

        if (breakLevel) {
            if (!this.levelAccumulators.has(breakLevel)) {
                this.levelAccumulators.set(breakLevel, this.createAccumulator());
            }
            const levelAcc = this.levelAccumulators.get(breakLevel);
            this.updateAccumulator(levelAcc, fieldName, numValue);
        }

        this.updateAccumulator(this.globalAccumulators, fieldName, numValue);
    }

    updateAccumulator(acc, fieldName, value) {
        const currentSum = acc.sum.get(fieldName) || 0;
        const currentCount = acc.count.get(fieldName) || 0;
        const currentMin = acc.min.get(fieldName);
        const currentMax = acc.max.get(fieldName);

        acc.sum.set(fieldName, currentSum + value);
        acc.count.set(fieldName, currentCount + 1);
        
        if (currentMin === undefined || value < currentMin) {
            acc.min.set(fieldName, value);
        }
        if (currentMax === undefined || value > currentMax) {
            acc.max.set(fieldName, value);
        }

        if (!acc.values.has(fieldName)) {
            acc.values.set(fieldName, []);
        }
        acc.values.get(fieldName).push(value);
    }

    evaluate(func, fieldName, breakLevel = null) {
        const isGlobal = func.startsWith('run');
        const acc = isGlobal ? 
            this.globalAccumulators : 
            (breakLevel ? this.levelAccumulators.get(breakLevel) : this.globalAccumulators);

        if (!acc) return 0;

        switch (func) {
            case 'sum':
            case 'runsum':
                return acc.sum.get(fieldName) || 0;

            case 'count':
            case 'runcount':
                return acc.count.get(fieldName) || 0;

            case 'avg':
            case 'runavg':
                const sum = acc.sum.get(fieldName) || 0;
                const count = acc.count.get(fieldName) || 1;
                return sum / count;

            case 'min':
            case 'runmin':
                return acc.min.get(fieldName) ?? 0;

            case 'max':
            case 'runmax':
                return acc.max.get(fieldName) ?? 0;

            default:
                return 0;
        }
    }

    resetLevel(breakLevel) {
        if (this.levelAccumulators.has(breakLevel)) {
            const acc = this.levelAccumulators.get(breakLevel);
            acc.sum.clear();
            acc.count.clear();
            acc.min.clear();
            acc.max.clear();
            acc.values.clear();
        }
    }

    reset() {
        this.levelAccumulators.clear();
        this.globalAccumulators = this.createAccumulator();
    }
}

export default AccumulatorManager;
