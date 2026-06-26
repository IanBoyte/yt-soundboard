import type { BoardWithContent } from '../types';

/**
 * Minimal IndexedDB-backed persistence for the single local board document.
 * Big binaries (audio clips) live in Cache Storage; this only holds the small
 * structured config (board, sections, tiles, ordering, master volume).
 */

const DB_NAME = 'yt-soundboard';
const DB_VERSION = 1;
const STORE = 'kv';
const BOARD_KEY = 'board';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await openDb();
	return new Promise<T>((resolve, reject) => {
		const transaction = db.transaction(STORE, mode);
		const request = fn(transaction.objectStore(STORE));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function loadBoardDoc(): Promise<BoardWithContent | null> {
	const value = await tx<BoardWithContent | undefined>('readonly', (s) => s.get(BOARD_KEY));
	return value ?? null;
}

export async function saveBoardDoc(board: BoardWithContent): Promise<void> {
	await tx('readwrite', (s) => s.put(board, BOARD_KEY));
}
