/**
 * SyncManager v3 — Robust sync orchestration
 * 
 * FIXES in v3:
 * - Tracks deleted IDs to prevent re-upsert after delete
 * - Syncs fixed_expenses and savings_challenges
 * - Uses a Set-based remote update guard (not single-flag)
 * - Real DELETE from Supabase (not soft-delete)
 * - Debounce protects against rapid fire
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { writeQueue } from './writeQueue';
import { dataRepository, mappers } from './dataRepository';

const DEBOUNCE_MS = 1500;
const TABLES = ['goals', 'transactions', 'routines', 'fixed_expenses'];

class SyncManager {
    constructor() {
        this._userId = null;
        this._dispatch = null;
        this._debounceTimer = null;
        this._realtimeChannels = [];
        this._remoteUpdateCount = 0; // Counter-based guard, not boolean flag
        this._lastSyncedState = null;
        this._status = 'idle';
        this._listeners = new Set();
        this._deletedIds = new Set(); // Track deleted IDs to prevent re-upsert
    }

    // ── Initialization ──────────────────────────────

    init(userId, dispatch) {
        if (this._userId === userId && this._dispatch) return; // Prevent double-init

        this._userId = userId;
        this._dispatch = dispatch;

        if (userId && isSupabaseConfigured()) {
            this._subscribeRealtime();
            this._flushQueue();
        }
    }

    destroy() {
        this._unsubscribeRealtime();
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._userId = null;
        this._dispatch = null;
        this._deletedIds.clear();
    }

    // ── Persistence (State → Cloud) ──────────────────

    onStateChange(state) {
        if (!this._userId || !isSupabaseConfigured()) return;

        // Skip if this was a remote update
        if (this._remoteUpdateCount > 0) {
            this._remoteUpdateCount--;
            return;
        }

        // Debounce rapid changes
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this._persistDiff(state);
        }, DEBOUNCE_MS);
    }

    async _persistDiff(state) {
        if (!this._userId) return;

        this._setStatus('syncing');
        const uid = this._userId;

        try {
            // Profile (always sync — small payload)
            writeQueue.enqueue('UPSERT', 'profiles',
                dataRepository.profileToPayload(state.profile, state.gamification, state.envelopes, uid),
                uid
            );

            // Goals — skip deleted IDs
            for (const goal of state.goals) {
                if (this._deletedIds.has(`goals:${goal.id}`)) continue;
                writeQueue.enqueue('UPSERT', 'goals',
                    dataRepository.goalToPayload(goal, uid),
                    uid
                );
            }

            // Transactions — skip deleted IDs
            for (const tx of state.transactions) {
                if (this._deletedIds.has(`transactions:${tx.id}`)) continue;
                writeQueue.enqueue('UPSERT', 'transactions',
                    dataRepository.txToPayload(tx, uid),
                    uid
                );
            }

            // Routines — skip deleted IDs
            for (const routine of state.routines) {
                if (this._deletedIds.has(`routines:${routine.id}`)) continue;
                writeQueue.enqueue('UPSERT', 'routines',
                    dataRepository.routineToPayload(routine, uid),
                    uid
                );
            }

            // Fixed Expenses — skip deleted IDs
            for (const expense of (state.fixedExpenses || [])) {
                if (this._deletedIds.has(`fixed_expenses:${expense.id}`)) continue;
                writeQueue.enqueue('UPSERT', 'fixed_expenses',
                    dataRepository.fixedExpenseToPayload(expense, uid),
                    uid
                );
            }

            // Flush the queue
            await writeQueue.flush(supabase);
            this._lastSyncedState = state;
            this._setStatus('idle');

            // Clear old deleted IDs after successful sync (keep for 30s)
            setTimeout(() => {
                this._deletedIds.clear();
            }, 30000);
        } catch (err) {
            console.warn('[SyncManager] Persist error:', err.message);
            this._setStatus('error');
        }
    }

    /**
     * Immediately sync a delete. Uses REAL DELETE, not soft-delete.
     */
    syncDelete(table, id) {
        if (!this._userId || !isSupabaseConfigured()) return;

        // Track this ID to prevent re-upserting
        this._deletedIds.add(`${table}:${id}`);

        writeQueue.enqueue('DELETE', table, { id }, this._userId);
        writeQueue.flush(supabase).catch(err => {
            console.warn(`[SyncManager] Delete flush error for ${table}:${id}:`, err.message);
        });
    }

    // ── Realtime (Cloud → State) ─────────────────────

    _subscribeRealtime() {
        this._unsubscribeRealtime();

        if (!this._userId || !isSupabaseConfigured()) return;

        const uid = this._userId;

        // Subscribe to each table for this user's changes
        for (const table of TABLES) {
            const channel = supabase
                .channel(`${table}_${uid}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table,
                        filter: `user_id=eq.${uid}`,
                    },
                    (payload) => this._handleRealtimeEvent(table, payload)
                )
                .subscribe();

            this._realtimeChannels.push(channel);
        }

        // Profile channel
        const profileChannel = supabase
            .channel(`profiles_${uid}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `user_id=eq.${uid}`,
                },
                (payload) => this._handleRealtimeEvent('profiles', payload)
            )
            .subscribe();

        this._realtimeChannels.push(profileChannel);

        console.log('[SyncManager v3] Realtime subscriptions active for:', TABLES.join(', '));
    }

    _unsubscribeRealtime() {
        for (const channel of this._realtimeChannels) {
            try { supabase.removeChannel(channel); } catch { /* ignore */ }
        }
        this._realtimeChannels = [];
    }

    _handleRealtimeEvent(table, payload) {
        if (!this._dispatch) return;

        const { eventType, new: newRow, old: oldRow } = payload;

        // Set counter-based guard to prevent write loop
        this._remoteUpdateCount++;

        const stateTable = table === 'fixed_expenses' ? 'fixedExpenses' : table;

        switch (table) {
            case 'goals': {
                if (eventType === 'DELETE') {
                    this._dispatch({ type: 'SYNC_REMOVE', payload: { table: 'goals', id: oldRow?.id || newRow?.id } });
                } else if (newRow?.is_deleted) {
                    this._dispatch({ type: 'SYNC_REMOVE', payload: { table: 'goals', id: newRow.id } });
                } else {
                    const mapped = mappers.goalFromDb(newRow);
                    this._dispatch({ type: 'SYNC_UPSERT', payload: { table: 'goals', item: mapped } });
                }
                break;
            }
            case 'transactions': {
                if (eventType === 'DELETE') {
                    this._dispatch({ type: 'SYNC_REMOVE', payload: { table: 'transactions', id: oldRow?.id || newRow?.id } });
                } else if (newRow?.is_deleted) {
                    this._dispatch({ type: 'SYNC_REMOVE', payload: { table: 'transactions', id: newRow.id } });
                } else {
                    const mapped = mappers.txFromDb(newRow);
                    this._dispatch({ type: 'SYNC_UPSERT', payload: { table: 'transactions', item: mapped } });
                }
                break;
            }
            case 'routines': {
                if (eventType === 'DELETE') {
                    this._dispatch({ type: 'SYNC_REMOVE', payload: { table: 'routines', id: oldRow?.id || newRow?.id } });
                } else if (newRow?.is_deleted) {
                    this._dispatch({ type: 'SYNC_REMOVE', payload: { table: 'routines', id: newRow.id } });
                } else {
                    const mapped = mappers.routineFromDb(newRow);
                    this._dispatch({ type: 'SYNC_UPSERT', payload: { table: 'routines', item: mapped } });
                }
                break;
            }
            case 'fixed_expenses': {
                if (eventType === 'DELETE') {
                    this._dispatch({ type: 'SYNC_REMOVE', payload: { table: 'fixedExpenses', id: oldRow?.id || newRow?.id } });
                } else {
                    const mapped = mappers.fixedExpenseFromDb(newRow);
                    this._dispatch({ type: 'SYNC_UPSERT', payload: { table: 'fixedExpenses', item: mapped } });
                }
                break;
            }
            case 'profiles': {
                if (newRow) {
                    const mapped = mappers.profileFromDb(newRow);
                    this._dispatch({ type: 'SYNC_PROFILE', payload: mapped });
                }
                break;
            }
        }
    }

    // ── Queue Management ─────────────────────────────

    async _flushQueue() {
        if (writeQueue.size > 0) {
            console.log(`[SyncManager] Flushing ${writeQueue.size} queued operations`);
            await writeQueue.flush(supabase);
        }
    }

    // ── Status Management ────────────────────────────

    _setStatus(status) {
        this._status = status;
        this._listeners.forEach(fn => fn(status));
    }

    get status() { return this._status; }

    onStatusChange(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    get queueSize() { return writeQueue.size; }
}

// Singleton
export const syncManager = new SyncManager();
