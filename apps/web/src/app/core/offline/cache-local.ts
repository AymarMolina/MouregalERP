/**
 * Copia local (IndexedDB) de las últimas respuestas GET del API, para que la
 * app pueda mostrar datos cuando se cae el internet.
 *
 * La clave es `<userId>|<url con parámetros>`: cada usuario solo ve lo que él
 * mismo descargó, y al cerrar sesión se borra lo suyo. Si IndexedDB no está
 * disponible (modo privado, navegador viejo), todo falla en silencio y la app
 * funciona como antes, solo que sin copia.
 */

const DB = "mouregal-erp";
const STORE = "respuestas";

export interface RespuestaGuardada {
  body: unknown;
  /** ISO de cuándo se descargó del servidor. */
  guardado: string;
}

let abriendo: Promise<IDBDatabase | null> | null = null;

function abrir(): Promise<IDBDatabase | null> {
  abriendo ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return abriendo;
}

function operar<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return abrir().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, modo);
          const req = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(req ? (req.result ?? null) : null);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export function guardarRespuesta(clave: string, body: unknown): Promise<unknown> {
  const valor: RespuestaGuardada = { body, guardado: new Date().toISOString() };
  return operar("readwrite", (s) => s.put(valor, clave));
}

export function leerRespuesta(clave: string): Promise<RespuestaGuardada | null> {
  return operar<RespuestaGuardada>("readonly", (s) => s.get(clave));
}

/** Borra todo lo guardado de un usuario (al cerrar sesión). */
export function borrarDeUsuario(userId: string): Promise<unknown> {
  return operar("readwrite", (s) => s.delete(IDBKeyRange.bound(`${userId}|`, `${userId}|￿`)));
}
