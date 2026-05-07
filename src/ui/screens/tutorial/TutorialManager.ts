// ============================================================
// TUTORIAL MANAGER
// Controls tutorial state and progress.
// Future-proofed: hooks for accounts, IAP, multiplayer, events.
// ============================================================

const TUTORIAL_KEY = 'cs_tutorial_v1'

export type TutorialStep =
  | 'welcome'
  | 'forge_explained'
  | 'build_guided'
  | 'battle_basics'
  | 'tutorial_battle'
  | 'complete'
  | 'skipped'

export interface TutorialState {
  step:       TutorialStep
  completed:  boolean
  skipped:    boolean
  rewardGiven:boolean
}

const DEFAULT: TutorialState = {
  step:        'welcome',
  completed:   false,
  skipped:     false,
  rewardGiven: false,
}

export function getTutorialState(): TutorialState {
  try {
    const raw = localStorage.getItem(TUTORIAL_KEY)
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveTutorialState(state: Partial<TutorialState>): void {
  try {
    const current = getTutorialState()
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ ...current, ...state }))
  } catch { /* ignore */ }
}

export function isTutorialComplete(): boolean {
  const s = getTutorialState()
  return s.completed || s.skipped
}

export function markTutorialComplete(): void {
  saveTutorialState({ completed: true, step: 'complete' })
}

export function markTutorialSkipped(): void {
  saveTutorialState({ skipped: true, step: 'skipped' })
}

export function markRewardGiven(): void {
  saveTutorialState({ rewardGiven: true })
}

export function resetTutorial(): void {
  localStorage.removeItem(TUTORIAL_KEY)
}

// Future hook — call this when account system is added
// so tutorial completion syncs to the server profile
export function onAccountLinked(userId: string): void {
  // TODO Phase 1: POST /api/tutorial/complete { userId }
  console.log('[Tutorial] Account linked, will sync tutorial state:', userId)
}

// Future hook — events system can check if tutorial is done
// before allowing event entry
export function canAccessEvents(): boolean {
  return isTutorialComplete()
}

// Future hook — multiplayer matchmaking checks this
export function canAccessMultiplayer(): boolean {
  return isTutorialComplete()
}