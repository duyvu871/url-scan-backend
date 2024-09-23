class Cache {
    constructor() {
        this._cache = Object.create(null);
        this._size = 0;
        this._instance = Cache; // You might not need this line in JavaScript
    }

    set(key, value, time) {
        if (typeof time !== "undefined" && (typeof time !== "number" || isNaN(time) || time <= 0)) {
            throw new Error("Cache timeout must be a positive number");
        }

        const oldRecord = this._cache[key];
        if (oldRecord) {
            clearTimeout(oldRecord.timeout);
        } else {
            this._size++;
        }

        const record = {
            value: value,
            expire: time ? time + Date.now() : NaN,
        };

        if (!isNaN(record.expire)) {
            record.timeout = setTimeout(() => this._del(key), time);
        }

        this._cache[key] = record;

        return value;
    }

    del(key) {
        let canDelete = true;

        const oldRecord = this._cache[key];
        if (oldRecord) {
            clearTimeout(oldRecord.timeout);
            if (!isNaN(oldRecord.expire) && oldRecord.expire < Date.now()) {
                canDelete = false;
            }
        } else {
            canDelete = false;
        }

        if (canDelete) {
            this._del(key);
        }

        return canDelete;
    }

    _del(key) {
        this._size--;
        delete this._cache[key];
    }

    clear() {
        for (const key in this._cache) {
            clearTimeout(this._cache[key].timeout);
        }
        this._size = 0;
        this._cache = Object.create(null);
    }

    get(key) {
        const data = this._cache[key];
        if (typeof data !== "undefined") {
            if (isNaN(data.expire) || data.expire >= Date.now()) {
                return data.value;
            } else {
                // free some space
                this._size--;
                delete this._cache[key];
            }
        }
        return null;
    }
}

const exp = new Cache();

module.exports = exp;
