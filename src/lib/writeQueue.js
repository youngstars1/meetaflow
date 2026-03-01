/**
 * WriteQueue — Offline-resilient operation queue
 * 
 * Persists pending writes in localStorage so they survive page refreshes.
 * Operations are flushed to Supabase when online.
 * Failed operations retry with exponential backoff.
 */

const QUEUE_KEY = 'metaflow_write_queue';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

class WriteQueue {
    constructor() {
        this._queue = this._load();
        this._flushing = false;
        this._listeners = new Set();
        this._supabase = null; // Stored ref for auto-flush
        this._deletedIds = new Set(); // Track pending deletes to prevent re-upsert

        // Auto-flush when coming back online
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.flush());
        }
    }

    // ── Public API ──────────────────────────────────

    /**
     * Enqueue a write operation
     * @param {'UPSERT'|'DELETE'} operation
     * @param {string} table - Supabase table name
     * @param {object} payload - Data to write
     * @param {string} userId - Owner user ID
     */
    enqueue(operation, table, payload, userId) {
        if (!userId) {
            console.warn('[WriteQueue] Skipping enqueue: no userId');
            return;
        }

        // Track deleted IDs to prevent re-upsert race conditions
        if (operation === 'DELETE') {
            this._deletedIds.add(`${table}:${payload.id}`);
            // Remove any pending UPSERT for this same item
            this._queue = this._queue.filter(e =>
                !(e.operation === 'UPSERT' && e.table === table && e.payload?.id === payload.id)
            );
        }

        // Skip UPSERT if item was already deleted in this session
        if (operation === 'UPSERT' && this._deletedIds.has(`${table}:${payload.id}`)) {
            return;
        }

        // Deduplicate: replace existing entry for same table+id+operation
        this._queue = this._queue.filter(e =>
            !(e.table === table && e.payload?.id === payload.id && e.operation === operation)
        );

        const entry = {
            id: crypto.randomUUID(),
            operation,
            table,
            payload,
            userId,
            retries: 0,
            createdAt: Date.now(),
        };

        this._queue.push(entry);
        this._persist();
        this._notify();

        // Try to flush immediately if online (use stored supabase ref)
        if (navigator.onLine && this._supabase) {
            this.flush(this._supabase);
        }
    }

    /**
     * Flush all pending operations to Supabase
     * @param {import('@supabase/supabase-js').SupabaseClient} supabase
     */
    async flush(supabase) {
        // Store ref for future auto-flushes
        if (supabase) this._supabase = supabase;
        const client = supabase || this._supabase;
        if (this._flushing || this._queue.length === 0) return;
        if (!client) return;

        this._flushing = true;
        const processed = [];

        for (const entry of [...this._queue]) {
            try {
                await this._execute(client, entry);
                processed.push(entry.id);
            } catch (err) {
                entry.retries += 1;

                if (entry.retries >= MAX_RETRIES) {
                    console.error(`[WriteQueue] Dropping operation after ${MAX_RETRIES} retries:`, entry, err.message);
                    processed.push(entry.id);
                } else {
                    console.warn(`[WriteQueue] Retry ${entry.retries}/${MAX_RETRIES} for ${entry.table}:`, err.message);
                    // Exponential backoff — wait before next attempt
                    await this._sleep(BASE_DELAY_MS * Math.pow(2, entry.retries - 1));
                }
            }
        }

        // Remove successfully processed entries
        this._queue = this._queue.filter(e => !processed.includes(e.id));
        this._persist();
        this._flushing = false;
        this._notify();
    }

    /** Get current queue size */
    get size() { return this._queue.length; }

    /** Check if queue is currently flushing */
    get isFlushing() { return this._flushing; }

    /** Subscribe to queue changes */
    subscribe(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    /** Clear all pending operations */
    clear() {
        this._queue = [];
        this._deletedIds.clear();
        this._persist();
        this._notify();
    }

    // ── Private ─────────────────────────────────────

    async _execute(supabase, entry) {
        const { operation, table, payload, userId } = entry;

        switch (operation) {
            case 'UPSERT': {
                const { error } = await supabase
                    .from(table)
                    .upsert({ ...payload, user_id: userId }, { onConflict: table === 'profiles' ? 'user_id' : 'id' });

                if (error) throw new Error(`UPSERT ${table}: ${error.message}`);
                break;
            }
            case 'DELETE': {
                // Use real DELETE — removes row from database entirely
                const { error } = await supabase
                    .from(table)
                    .delete()
                    .eq('id', payload.id)
                    .eq('user_id', userId);

                if (error) {
                    // If row doesn't exist, that's fine (already deleted)
                    if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
                        console.log(`[WriteQueue] DELETE ${table}:${payload.id} — already gone`);
                    } else {
                        throw new Error(`DELETE ${table}: ${error.message}`);
                    }
                }
                break;
            }
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }

    _load() {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    _persist() {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(this._queue));
        } catch (err) {
            console.warn('[WriteQueue] Failed to persist queue:', err.message);
        }
    }

    _notify() {
        this._listeners.forEach(fn => fn({ size: this._queue.length, flushing: this._flushing }));
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const writeQueue = new WriteQueue();
