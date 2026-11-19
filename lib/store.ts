// 강연자 작업(PDF, 영상, 슬라이드 위치)을 이 브라우저의 IndexedDB에 보관한다. 서버로는 전송하지 않는다.

let dbp: Promise<IDBDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open("live-lecture", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("kv", mode);
    const req = fn(t.objectStore("kv"));
    t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const kvGet = <T>(key: string) => run<T>("readonly", (s) => s.get(key));
export const kvSet = (key: string, value: unknown) => run("readwrite", (s) => void s.put(value, key));
export const kvDel = (key: string) => run("readwrite", (s) => void s.delete(key));
export const kvClear = () => run("readwrite", (s) => void s.clear());

export type SavedItem = { id: string; kind: "file" | "embed" | "video"; name: string; src?: string };
export type Meta = {
  fileName: string;
  embedUrl: string | null;
  hasPdf: boolean;
  page: number;
  media: Record<number, SavedItem[]>;
};
