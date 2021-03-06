"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// tslint:disable:no-implicit-dependencies
const common_types_1 = require("common-types");
const lodash_set_1 = __importDefault(require("lodash.set"));
const lodash_get_1 = __importDefault(require("lodash.get"));
const firebase_key_1 = require("firebase-key");
const fast_equals_1 = require("fast-equals");
const fast_copy_1 = __importDefault(require("fast-copy"));
const deepmerge_1 = __importDefault(require("deepmerge"));
const auth_1 = require("../auth");
const index_1 = require("../shared/index");
const index_2 = require("../rtdb/index");
/**
 * The in-memory dictionary/hash mantained by the mock RTDB to represent
 * the state of the database
 */
let db = {};
let _silenceEvents = false;
/**
 * silences the database from sending events;
 * this is not typically done but can be done
 * as part of the Mocking process to reduce noise
 */
function silenceEvents() {
    _silenceEvents = true;
}
exports.silenceEvents = silenceEvents;
/**
 * returns the database to its default state of sending
 * events out.
 */
function restoreEvents() {
    _silenceEvents = false;
}
exports.restoreEvents = restoreEvents;
function shouldSendEvents() {
    return !_silenceEvents;
}
exports.shouldSendEvents = shouldSendEvents;
/** clears the DB without losing reference to DB object */
function clearDatabase() {
    const keys = Object.keys(db);
    keys.forEach(key => delete db[key]);
}
exports.clearDatabase = clearDatabase;
/**
 * updates the state of the database based on a
 * non-descructive update.
 */
function updateDatabase(updatedState) {
    db = deepmerge_1.default(db, updatedState);
}
exports.updateDatabase = updateDatabase;
async function auth() {
    return auth_1.auth();
}
exports.auth = auth;
function getDb(path) {
    return path ? lodash_get_1.default(db, index_1.dotify(path)) : db;
}
exports.getDb = getDb;
/**
 * **setDB**
 *
 * sets the database at a given path
 */
function setDB(path, value, silent = false) {
    const dotPath = index_1.join(path);
    const oldRef = lodash_get_1.default(db, dotPath);
    const oldValue = typeof oldRef === "object" ? Object.assign(Object.assign({}, oldRef), {}) : oldRef;
    const isReference = ["object", "array"].includes(typeof value);
    const dbSnapshot = fast_copy_1.default(Object.assign({}, db));
    // ignore if no change
    if ((isReference && fast_equals_1.deepEqual(oldValue, value)) ||
        (!isReference && oldValue === value)) {
        return;
    }
    if (value === null) {
        const parentValue = lodash_get_1.default(db, index_1.getParent(dotPath));
        if (typeof parentValue === "object") {
            delete parentValue[index_1.getKey(dotPath)];
            lodash_set_1.default(db, index_1.getParent(dotPath), parentValue);
        }
        else {
            lodash_set_1.default(db, dotPath, undefined);
        }
    }
    else {
        lodash_set_1.default(db, dotPath, value);
    }
    if (!silent) {
        index_2.notify({ [dotPath]: value }, dbSnapshot);
    }
}
exports.setDB = setDB;
/**
 * **updateDB**
 *
 * single-path, non-destructive update to database
 */
function updateDB(path, value) {
    const dotPath = index_1.join(path);
    const oldValue = lodash_get_1.default(db, dotPath);
    let changed = true;
    if (typeof value === "object" &&
        Object.keys(value).every(k => (oldValue ? oldValue[k] : null) ===
            value[k])) {
        changed = false;
    }
    if (typeof value !== "object" && value === oldValue) {
        changed = false;
    }
    if (!changed) {
        return;
    }
    const newValue = typeof oldValue === "object" ? Object.assign(Object.assign({}, oldValue), value) : value;
    setDB(dotPath, newValue);
}
exports.updateDB = updateDB;
/**
 * **multiPathUpdateDB**
 *
 * Emulates a Firebase multi-path update. The keys of the dictionary
 * are _paths_ in the DB, the value is the value to set at that path.
 *
 * **Note:** dispatch notifations must not be done at _path_ level but
 * instead grouped up by _watcher_ level.
 */
function multiPathUpdateDB(data) {
    const snapshot = fast_copy_1.default(db);
    Object.keys(data).map(key => {
        const value = data[key];
        const path = key;
        if (lodash_get_1.default(db, path) !== value) {
            // silent set
            setDB(path, value, true);
        }
    });
    index_2.notify(data, snapshot);
}
exports.multiPathUpdateDB = multiPathUpdateDB;
const slashify = (path) => {
    const slashPath = path.replace(/\./g, "/");
    return slashPath.slice(0, 1) === "/" ? slashPath.slice(1) : slashPath;
};
/**
 * Will aggregate the data passed in to dictionary objects of paths
 * which fire at the root of the listeners/watchers that are currently
 * on the database.
 */
function groupEventsByWatcher(data, dbSnapshot) {
    data = index_1.dotifyKeys(data);
    const getFromSnapshot = (path) => lodash_get_1.default(dbSnapshot, index_1.dotify(path));
    const eventPaths = Object.keys(data).map(i => index_1.dotify(i));
    const response = [];
    const relativePath = (full, partial) => {
        return full.replace(partial, "");
    };
    const justKey = (obj) => (obj ? Object.keys(obj)[0] : null);
    const justValue = (obj) => justKey(obj) ? obj[justKey(obj)] : null;
    index_2.getListeners().forEach(listener => {
        const eventPathsUnderListener = eventPaths.filter(path => path.includes(index_1.dotify(listener.query.path)));
        if (eventPathsUnderListener.length === 0) {
            // if there are no listeners then there's nothing to do
            return;
        }
        const paths = [];
        const listenerPath = index_1.dotify(listener.query.path);
        const changeObject = eventPathsUnderListener.reduce((changes, path) => {
            paths.push(path);
            if (index_1.dotify(listener.query.path) === path) {
                changes = data[path];
            }
            else {
                lodash_set_1.default(changes, index_1.dotify(relativePath(path, listenerPath)), data[path]);
            }
            return changes;
        }, {});
        const key = listener.eventType === "value"
            ? changeObject
                ? justKey(changeObject)
                : listener.query.path.split(".").pop()
            : index_1.dotify(common_types_1.pathJoin(slashify(listener.query.path), justKey(changeObject)));
        const newResponse = {
            listenerId: listener.id,
            listenerPath,
            listenerEvent: listener.eventType,
            callback: listener.callback,
            eventPaths: paths,
            key,
            changes: justValue(changeObject),
            value: listener.eventType === "value"
                ? getDb(listener.query.path)
                : getDb(key),
            priorValue: listener.eventType === "value"
                ? lodash_get_1.default(dbSnapshot, listener.query.path)
                : justValue(lodash_get_1.default(dbSnapshot, listener.query.path))
        };
        response.push(newResponse);
    });
    return response;
}
exports.groupEventsByWatcher = groupEventsByWatcher;
function removeDB(path) {
    if (!getDb(path)) {
        return;
    }
    setDB(path, null);
}
exports.removeDB = removeDB;
/**
 * **pushDB**
 *
 * Push a new record into the mock database. Uses the
 * `firebase-key` library to generate the key which
 * attempts to use the same algorithm as Firebase
 * itself.
 */
function pushDB(path, value) {
    const pushId = firebase_key_1.key();
    const fullPath = index_1.join(path, pushId);
    const valuePlusId = typeof value === "object" ? Object.assign(Object.assign({}, value), { id: pushId }) : value;
    setDB(fullPath, valuePlusId);
    return pushId;
}
exports.pushDB = pushDB;
/** Clears the DB and removes all listeners */
function reset() {
    index_2.removeAllListeners();
    clearDatabase();
}
exports.reset = reset;
//# sourceMappingURL=store.js.map