/**
 * HydrationService — Initial data load + merge strategy
 * 
 * Handles the critical first-load scenario:
 * 1. Load from localStorage (instant)
 * 2. Load from Supabase (async)
 * 3. Merge using Last Write Wins
 * 4. Write merged result to both stores
 */

import { storage } from '../utils/storage';
import { getEnvelopes } from '../utils/envelopes';
import { dataRepository } from './dataRepository';

const INITIAL_GAMIFICATION = { totalXP: 0, xpLog: [], earnedBadgeIds: [] };
const INITIAL_PROFILE = { name: '', email: '', incomeSources: [], currency: 'CLP' };
const INITIAL_ENVELOPES = { enabled: false, rules: [] };

class HydrationService {

    /**
     * Load data from localStorage — synchronous, instant
     */
    loadLocal() {
        let fixedExpenses = [];
        try {
            const stored = localStorage.getItem('metaflow_fixed_expenses');
            if (stored) fixedExpenses = JSON.parse(stored);
        } catch { /* ignore */ }

        return {
            goals: storage.getGoals() || [],
            transactions: storage.getTransactions() || [],
            routines: storage.getRoutines() || [],
            fixedExpenses,
            profile: storage.getProfile() || INITIAL_PROFILE,
            gamification: storage.get('metaflow_gamification') || INITIAL_GAMIFICATION,
            envelopes: getEnvelopes() || INITIAL_ENVELOPES,
        };
    }

    /**
     * Load data from Supabase with timeout
     * @param {string} userId
     * @param {number} timeoutMs - Max time to wait (default 8s)
     */
    async loadRemote(userId, timeoutMs = 8000) {
        if (!userId || !dataRepository.configured) return null;

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase load timeout')), timeoutMs)
        );

        try {
            const data = await Promise.race([
                dataRepository.fetchAll(userId),
                timeout,
            ]);
            return data;
        } catch (err) {
            console.warn('[Hydration] Remote load failed:', err.message);
            return null;
        }
    }

    /**
     * Hydrate — Main entry point
     * 
     * Strategy:
     * - Local only → use local, migrate to cloud
     * - Remote only → use remote, cache locally
     * - Both exist → merge using ID-based Last Write Wins
     * 
     * @param {string|null} userId
     * @returns {{ data: object, source: 'local'|'remote'|'merged', needsMigration: boolean }}
     */
    async hydrate(userId) {
        const localData = this.loadLocal();
        const localHasData = this._hasData(localData);

        // No user → pure offline mode
        if (!userId || !dataRepository.configured) {
            return { data: localData, source: 'local', needsMigration: false };
        }

        // Try loading remote
        const remoteData = await this.loadRemote(userId);
        const remoteHasData = remoteData && this._hasData(remoteData);

        // Case 1: Only local data exists → migrate to cloud
        if (localHasData && !remoteHasData) {
            console.log('[Hydration] Local only → will migrate to cloud');
            return { data: localData, source: 'local', needsMigration: true };
        }

        // Case 2: Only remote data exists → use it
        if (!localHasData && remoteHasData) {
            console.log('[Hydration] Remote only → hydrating from cloud');
            this._saveLocal(remoteData);
            return { data: remoteData, source: 'remote', needsMigration: false };
        }

        // Case 3: Both exist → merge
        if (localHasData && remoteHasData) {
            console.log('[Hydration] Both exist → merging');
            const merged = this._merge(localData, remoteData);
            this._saveLocal(merged);
            return { data: merged, source: 'merged', needsMigration: true };
        }

        // Case 4: Neither has data → fresh start
        return { data: localData, source: 'local', needsMigration: false };
    }

    // ── Merge Strategy (Last Write Wins by ID) ────────

    _merge(local, remote) {
        return {
            goals: this._mergeList(local.goals, remote.goals),
            transactions: this._mergeList(local.transactions, remote.transactions),
            routines: this._mergeList(local.routines, remote.routines),
            fixedExpenses: this._mergeList(local.fixedExpenses, remote.fixedExpenses),
            profile: this._mergeProfile(local, remote),
            gamification: this._mergeGamification(local.gamification, remote.gamification),
            envelopes: remote.envelopes || local.envelopes || INITIAL_ENVELOPES,
        };
    }

    /**
     * Merge two lists by ID. For duplicates, Last Write Wins.
     * Items only in one list are kept.
     */
    _mergeList(localList = [], remoteList = []) {
        const map = new Map();

        // Add all remote items first
        for (const item of remoteList) {
            map.set(item.id, { ...item, _source: 'remote' });
        }

        // Overlay local items — keep local if newer
        for (const item of localList) {
            const existing = map.get(item.id);
            if (!existing) {
                // Only exists locally
                map.set(item.id, { ...item, _source: 'local' });
            } else {
                // Both exist → compare updatedAt or version
                const localTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
                const remoteTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
                const localVersion = item.version || 0;
                const remoteVersion = existing.version || 0;

                if (localVersion > remoteVersion || (localVersion === remoteVersion && localTime > remoteTime)) {
                    map.set(item.id, { ...item, _source: 'local' });
                }
                // Otherwise remote wins (already in map)
            }
        }

        // Clean up _source flag
        return Array.from(map.values()).map(({ _source, ...rest }) => rest);
    }

    _mergeProfile(local, remote) {
        // Remote profile wins if it has a name, otherwise local
        if (remote.profile?.name) return remote.profile;
        return local.profile || INITIAL_PROFILE;
    }

    _mergeGamification(local, remote) {
        if (!local && !remote) return INITIAL_GAMIFICATION;
        if (!local) return remote;
        if (!remote) return local;

        // Higher XP wins
        const localXP = local.totalXP || 0;
        const remoteXP = remote.totalXP || 0;
        return localXP >= remoteXP ? local : remote;
    }

    // ── Helpers ───────────────────────────────────────

    _hasData(data) {
        if (!data) return false;
        return (
            (data.goals?.length > 0) ||
            (data.transactions?.length > 0) ||
            (data.routines?.length > 0) ||
            (data.fixedExpenses?.length > 0) ||
            (data.gamification?.totalXP > 0)
        );
    }

    _saveLocal(data) {
        try {
            storage.saveGoals(data.goals || []);
            storage.saveTransactions(data.transactions || []);
            storage.saveRoutines(data.routines || []);
            storage.saveProfile(data.profile || INITIAL_PROFILE);
            storage.set('metaflow_gamification', data.gamification || INITIAL_GAMIFICATION);
            // Fixed expenses
            localStorage.setItem('metaflow_fixed_expenses', JSON.stringify(data.fixedExpenses || []));
        } catch (err) {
            console.warn('[Hydration] Failed to save to localStorage:', err.message);
        }
    }
}

export const hydrationService = new HydrationService();
