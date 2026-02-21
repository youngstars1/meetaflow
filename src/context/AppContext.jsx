import { createContext, useContext, useReducer, useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { storage } from '../utils/storage';
import { generateId } from '../utils/helpers';
import { XP_REWARDS, calculateLevel, evaluateBadges } from '../utils/gamification';
import { Finance, Sanitize } from '../utils/security';
import { getEnvelopes, saveEnvelopes } from '../utils/envelopes';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AppContext = createContext();

const initialState = {
    goals: [],
    transactions: [],
    routines: [],
    envelopes: { enabled: false, rules: [] },
    profile: { name: '', email: '', incomeSources: [], currency: 'CLP' },
    gamification: { totalXP: 0, xpLog: [], earnedBadgeIds: [] },
    isLoaded: false,
    _undoStack: [],
    _syncing: false,
};

// =================== STREAK ===================
function calculateStreak(completedDates) {
    if (!completedDates || completedDates.length === 0) return 0;
    const sorted = [...completedDates].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 365; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        if (sorted.includes(d.toDateString())) { streak++; }
        else if (i > 0) { break; }
    }
    return streak;
}

function addXP(gamification, amount, action) {
    if (amount <= 0) return gamification;
    return {
        ...gamification,
        totalXP: (gamification.totalXP || 0) + amount,
        xpLog: [{ action, xp: amount, timestamp: Date.now() }, ...(gamification.xpLog || [])].slice(0, 100),
    };
}

// =================== REDUCER ===================
function appReducer(state, action) {
    switch (action.type) {
        case 'SET_LOADING': return { ...state, _syncing: action.payload };
        case 'LOAD_DATA': return { ...state, ...action.payload, isLoaded: true };
        case 'ADD_XP': return { ...state, gamification: addXP(state.gamification, action.payload, 'MANUAL') };

        // GOALS
        case 'ADD_GOAL': {
            const sanitized = {
                ...action.payload,
                id: action.payload.id || generateId(),
                name: Sanitize.html(action.payload.name),
                description: Sanitize.html(action.payload.description),
                targetAmount: Finance.parse(action.payload.targetAmount),
                currentAmount: Finance.parse(action.payload.currentAmount || 0),
            };
            const xpGain = state.goals.length === 0 ? XP_REWARDS.FIRST_GOAL + XP_REWARDS.GOAL_CREATED : XP_REWARDS.GOAL_CREATED;
            return { ...state, goals: [...state.goals, sanitized], gamification: addXP(state.gamification, xpGain, 'GOAL_CREATED') };
        }
        case 'UPDATE_GOAL':
            return {
                ...state,
                goals: state.goals.map(g => g.id === action.payload.id ? {
                    ...g, ...action.payload,
                    name: action.payload.name ? Sanitize.html(action.payload.name) : g.name,
                    targetAmount: action.payload.targetAmount !== undefined ? Finance.parse(action.payload.targetAmount) : g.targetAmount,
                } : g),
            };
        case 'DELETE_GOAL':
            return {
                ...state,
                goals: state.goals.filter(g => g.id !== action.payload),
                _undoStack: [...state._undoStack, { type: 'RESTORE_GOAL', data: state.goals.find(g => g.id === action.payload), timestamp: Date.now() }].slice(-10),
            };
        case 'RESTORE_GOAL': return { ...state, goals: [...state.goals, action.payload] };
        case 'ADD_SAVINGS_TO_GOAL': {
            const { goalId, amount } = action.payload;
            const parsedAmount = Finance.parse(amount);
            let extraXP = 0;
            const goal = state.goals.find(g => g.id === goalId);
            if (!goal) return state;
            const oldAmount = Finance.parse(goal.currentAmount || 0);
            const newAmount = Finance.add(oldAmount, parsedAmount);
            if (oldAmount < goal.targetAmount && newAmount >= goal.targetAmount) extraXP += XP_REWARDS.GOAL_COMPLETED;
            return {
                ...state,
                goals: state.goals.map(g => g.id === goalId ? { ...g, currentAmount: newAmount } : g),
                gamification: addXP(state.gamification, XP_REWARDS.SAVINGS_REGISTERED + extraXP, 'SAVINGS_REGISTERED'),
            };
        }

        // TRANSACTIONS
        case 'ADD_TRANSACTION': {
            const sanitized = { ...action.payload, id: generateId(), note: Sanitize.html(action.payload.note), amount: Finance.parse(action.payload.amount) };
            const xpGain = state.transactions.length === 0 ? XP_REWARDS.FIRST_TRANSACTION + XP_REWARDS.TRANSACTION_LOGGED : XP_REWARDS.TRANSACTION_LOGGED;
            return { ...state, transactions: [sanitized, ...state.transactions], gamification: addXP(state.gamification, xpGain, 'TRANSACTION_LOGGED') };
        }
        case 'DELETE_TRANSACTION':
            return {
                ...state,
                transactions: state.transactions.filter(t => t.id !== action.payload),
                _undoStack: [...state._undoStack, { type: 'RESTORE_TRANSACTION', data: state.transactions.find(t => t.id === action.payload), timestamp: Date.now() }].slice(-10),
            };
        case 'RESTORE_TRANSACTION': return { ...state, transactions: [action.payload, ...state.transactions] };

        // ROUTINES
        case 'ADD_ROUTINE': {
            const newRoutine = { ...action.payload, id: action.payload.id || generateId(), name: Sanitize.html(action.payload.name), objective: action.payload.objective ? Sanitize.html(action.payload.objective) : '', streak: 0, completedDates: [], createdAt: new Date().toISOString() };
            return { ...state, routines: [...state.routines, newRoutine], gamification: addXP(state.gamification, XP_REWARDS.GOAL_CREATED, 'ROUTINE_CREATED') };
        }
        case 'UPDATE_ROUTINE':
            return {
                ...state,
                routines: state.routines.map(r => r.id === action.payload.id ? {
                    ...r, ...action.payload,
                    name: action.payload.name ? Sanitize.html(action.payload.name) : r.name,
                    objective: action.payload.objective !== undefined ? Sanitize.html(action.payload.objective) : r.objective,
                } : r),
            };
        case 'DELETE_ROUTINE':
            return {
                ...state,
                routines: state.routines.filter(r => r.id !== action.payload),
                _undoStack: [...state._undoStack, { type: 'RESTORE_ROUTINE', data: state.routines.find(r => r.id === action.payload), timestamp: Date.now() }].slice(-10),
            };
        case 'RESTORE_ROUTINE': return { ...state, routines: [...state.routines, action.payload] };
        case 'COMPLETE_ROUTINE': {
            const { id, date, xp } = action.payload;
            const routine = state.routines.find(r => r.id === id);
            if (!routine) return state;
            const completedDates = [...(routine.completedDates || []), date];
            const newStreak = calculateStreak(completedDates);
            let bonusXP = 0;
            if (newStreak === 7) bonusXP += XP_REWARDS.ROUTINE_STREAK_7;
            if (newStreak === 30) bonusXP += XP_REWARDS.ROUTINE_STREAK_30;
            const allCompleted = state.routines.every(r => r.id === id ? true : (r.completedDates || []).includes(date));
            if (allCompleted && state.routines.length > 1) bonusXP += XP_REWARDS.ALL_ROUTINES_TODAY;
            return {
                ...state,
                routines: state.routines.map(r => r.id === id ? { ...r, completedDates, streak: newStreak } : r),
                gamification: addXP(state.gamification, (xp || XP_REWARDS.ROUTINE_COMPLETE) + bonusXP, 'ROUTINE_COMPLETE'),
            };
        }

        case 'SET_ENVELOPES': return { ...state, envelopes: action.payload };
        case 'UPDATE_PROFILE': return { ...state, profile: { ...state.profile, ...action.payload, name: action.payload.name ? Sanitize.html(action.payload.name) : state.profile.name } };
        case 'SYNC_STATE': return { ...state, ...action.payload };

        case 'UNDO_LAST': {
            if (state._undoStack.length === 0) return state;
            const lastAction = state._undoStack[state._undoStack.length - 1];
            const newStack = state._undoStack.slice(0, -1);
            switch (lastAction.type) {
                case 'RESTORE_GOAL': return { ...state, goals: [...state.goals, lastAction.data], _undoStack: newStack };
                case 'RESTORE_TRANSACTION': return { ...state, transactions: [lastAction.data, ...state.transactions], _undoStack: newStack };
                case 'RESTORE_ROUTINE': return { ...state, routines: [...state.routines, lastAction.data], _undoStack: newStack };
                default: return { ...state, _undoStack: newStack };
            }
        }
        default: return state;
    }
}

// =================== SUPABASE CLOUD SYNC ===================
async function loadFromSupabase(userId) {
    const [goalsRes, txRes, routinesRes, profileRes] = await Promise.all([
        supabase.from('goals').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('routines').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('profiles').select('*').eq('user_id', userId).single(),
    ]);

    // Map snake_case → camelCase
    const goals = (goalsRes.data || []).map(g => ({
        id: g.id, name: g.name, description: g.description,
        targetAmount: g.target_amount, currentAmount: g.current_amount,
        deadline: g.deadline, priority: g.priority, color: g.color, imageUrl: g.image_url,
        createdAt: g.created_at,
    }));

    const transactions = (txRes.data || []).map(t => ({
        id: t.id, type: t.type, amount: t.amount, category: t.category,
        note: t.note, date: t.date, goalId: t.goal_id, decisionType: t.decision_type,
        createdAt: t.created_at,
    }));

    const routines = (routinesRes.data || []).map(r => ({
        id: r.id, name: r.name, objective: r.objective, category: r.category,
        frequency: r.frequency, difficulty: r.difficulty, xpValue: r.xp_value,
        completedDates: r.completed_dates || [], streak: r.streak, createdAt: r.created_at,
    }));

    const profile = profileRes.data ? {
        name: profileRes.data.name || '',
        currency: profileRes.data.currency || 'CLP',
        incomeSources: profileRes.data.income_sources || [],
    } : initialState.profile;

    const gamification = profileRes.data?.gamification || initialState.gamification;
    const envelopes = profileRes.data?.envelopes || { enabled: false, rules: [] };

    return { goals, transactions, routines, profile, gamification, envelopes };
}

async function saveGoalToSupabase(goal, userId) {
    await supabase.from('goals').upsert({
        id: goal.id, user_id: userId, name: goal.name, description: goal.description || '',
        target_amount: goal.targetAmount, current_amount: goal.currentAmount,
        deadline: goal.deadline, priority: goal.priority, color: goal.color || '#00f5d4',
        image_url: goal.imageUrl, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
}

async function saveTransactionToSupabase(tx, userId) {
    await supabase.from('transactions').upsert({
        id: tx.id, user_id: userId, type: tx.type, amount: tx.amount,
        category: tx.category || '', note: tx.note || '', date: tx.date,
        goal_id: tx.goalId || null, decision_type: tx.decisionType || null,
    }, { onConflict: 'id' });
}

async function saveRoutineToSupabase(routine, userId) {
    await supabase.from('routines').upsert({
        id: routine.id, user_id: userId, name: routine.name, objective: routine.objective || '',
        category: routine.category || 'finanzas', frequency: routine.frequency || 'daily',
        difficulty: routine.difficulty || 'medium', xp_value: routine.xpValue || 20,
        completed_dates: routine.completedDates || [], streak: routine.streak || 0,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
}

async function saveProfileToSupabase(profile, gamification, envelopes, userId) {
    await supabase.from('profiles').upsert({
        user_id: userId, name: profile.name || '', currency: profile.currency || 'CLP',
        income_sources: profile.incomeSources || [],
        gamification: gamification, envelopes: envelopes,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

async function deleteFromSupabase(table, id) {
    await supabase.from(table).delete().eq('id', id);
}

// =================== PROVIDER ===================
export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [prevXP, setPrevXP] = useState(0);
    const [userId, setUserId] = useState(null);
    const saveTimerRef = useRef(null);

    // Watch auth state to trigger cloud sync
    useEffect(() => {
        if (!isSupabaseConfigured()) {
            // Offline mode: load from localStorage
            const goals = storage.getGoals();
            const transactions = storage.getTransactions();
            const routines = storage.getRoutines();
            const profile = storage.getProfile();
            const gamification = storage.get('metaflow_gamification') || initialState.gamification;
            const envelopes = getEnvelopes();
            dispatch({ type: 'LOAD_DATA', payload: { goals, transactions, routines, profile, gamification, envelopes } });
            setPrevXP(gamification.totalXP || 0);
            return;
        }

        // Watch Supabase auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const uid = session?.user?.id || null;
            setUserId(uid);

            if (uid) {
                // User logged in → load from cloud
                dispatch({ type: 'SET_LOADING', payload: true });
                try {
                    const cloudData = await loadFromSupabase(uid);
                    dispatch({ type: 'LOAD_DATA', payload: cloudData });
                    setPrevXP(cloudData.gamification?.totalXP || 0);
                } catch (err) {
                    console.error('[MetaFlow] Failed to load cloud data:', err);
                    // Fallback to localStorage
                    const goals = storage.getGoals();
                    const transactions = storage.getTransactions();
                    const routines = storage.getRoutines();
                    const profile = storage.getProfile();
                    const gamification = storage.get('metaflow_gamification') || initialState.gamification;
                    const envelopes = getEnvelopes();
                    dispatch({ type: 'LOAD_DATA', payload: { goals, transactions, routines, profile, gamification, envelopes } });
                    setPrevXP(gamification.totalXP || 0);
                } finally {
                    dispatch({ type: 'SET_LOADING', payload: false });
                }
            } else {
                // Guest mode → load from localStorage
                const goals = storage.getGoals();
                const transactions = storage.getTransactions();
                const routines = storage.getRoutines();
                const profile = storage.getProfile();
                const gamification = storage.get('metaflow_gamification') || initialState.gamification;
                const envelopes = getEnvelopes();
                dispatch({ type: 'LOAD_DATA', payload: { goals, transactions, routines, profile, gamification, envelopes } });
                setPrevXP(gamification.totalXP || 0);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ---- Persistence: debounced save on state change ----
    useEffect(() => {
        if (!state.isLoaded) return;

        // Always save to localStorage as cache
        storage.saveGoals(state.goals);
        storage.saveTransactions(state.transactions);
        storage.saveRoutines(state.routines);
        storage.saveProfile(state.profile);
        storage.set('metaflow_gamification', state.gamification);
        saveEnvelopes(state.envelopes);

        // If logged in, debounce cloud sync (wait 1.5s after last change)
        if (userId && isSupabaseConfigured()) {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                syncToCloud(state, userId);
            }, 1500);
        }
    }, [state, userId]);

    const xpGained = useMemo(() =>
        state.isLoaded ? state.gamification.totalXP - prevXP : 0,
        [state.gamification.totalXP, prevXP, state.isLoaded]);

    useEffect(() => {
        if (state.gamification.totalXP !== prevXP && state.isLoaded) {
            setPrevXP(state.gamification.totalXP);
        }
    }, [state.gamification.totalXP, prevXP, state.isLoaded]);

    const undoLast = useCallback(() => dispatch({ type: 'UNDO_LAST' }), []);
    const canUndo = state._undoStack.length > 0;

    const contextValue = useMemo(() => ({
        state, dispatch, xpGained, undoLast, canUndo, userId,
    }), [state, xpGained, undoLast, canUndo, userId]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

// Background sync — runs after debounce
async function syncToCloud(state, userId) {
    try {
        // Sync profile + gamification + envelopes
        await saveProfileToSupabase(state.profile, state.gamification, state.envelopes, userId);

        // Sync goals
        await Promise.all(state.goals.map(g => saveGoalToSupabase(g, userId)));

        // Sync transactions
        await Promise.all(state.transactions.map(t => saveTransactionToSupabase(t, userId)));

        // Sync routines
        await Promise.all(state.routines.map(r => saveRoutineToSupabase(r, userId)));
    } catch (err) {
        console.warn('[MetaFlow] Cloud sync error (data safe in localStorage):', err);
    }
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within AppProvider');
    return context;
}
