// ============================================================
// EVENT MANAGER
// Handles login streaks, quest tracking, mission timers,
// token management, and wheel spins.
// All state syncs to Supabase player_events table.
// ============================================================

import { supabase } from './supabase'
import { useStore } from '@store'
import { save } from '@systems/SaveManager'
import {
  getLoginReward, generateDailyQuests, generateMissions,
  spinWheel, COMMON_WHEEL, RARE_WHEEL,
  type QuestDef, type MissionDef, type WheelSlot,
} from '@data/events'

export interface ActiveMission {
  defId:     string
  startTime: number   // unix ms
  endTime:   number   // unix ms
  unitIds:   string[]
  completed: boolean
}

export interface QuestProgress {
  questId:  string
  progress: number
  done:     boolean
}

export interface EventState {
  loginStreak:      number
  lastLoginDate:    string | null
  longestStreak:    number
  commonTokens:     number
  rareTokens:       number
  questDate:        string | null
  quests:           QuestDef[]
  questProgress:    QuestProgress[]
  questsClaimed:    number[]   // milestone indices claimed today
  missions:         ActiveMission[]
  missionSlots:     number
  availableMissions: MissionDef[]
  lastMissionRefresh: string | null
}

const DEFAULT_STATE: EventState = {
  loginStreak:        0,
  lastLoginDate:      null,
  longestStreak:      0,
  commonTokens:       0,
  rareTokens:         0,
  questDate:          null,
  quests:             [],
  questProgress:      [],
  questsClaimed:      [],
  missions:           [],
  missionSlots:       2,
  availableMissions:  [],
  lastMissionRefresh: null,
}

let _state: EventState = { ...DEFAULT_STATE }

export function getEventState(): EventState { return _state }

// ── Load from Supabase ────────────────────────────────────────
export async function loadEventState(userId: string): Promise<EventState> {
  const { data, error } = await supabase
    .from('player_events')
    .select('*')
    .eq('player_id', userId)
    .single()

  if (error || !data) {
    // Create row
    await supabase.from('player_events').insert({ player_id: userId })
    _state = { ...DEFAULT_STATE }
  } else {
    const today    = getTodayStr()
    const questDate = data.quest_date

    _state = {
      loginStreak:        data.login_streak        ?? 0,
      lastLoginDate:      data.last_login_date      ?? null,
      longestStreak:      data.longest_streak       ?? 0,
      commonTokens:       data.common_tokens        ?? 0,
      rareTokens:         data.rare_tokens          ?? 0,
      questDate:          questDate                 ?? null,
      quests:             questDate === today ? (data.quests ?? []) : generateDailyQuests(dateToSeed(today)),
      questProgress:      [],
      questsClaimed:      questDate === today ? (data.quests_claimed ?? []) : [],
      missions:           data.missions            ?? [],
      missionSlots:       data.mission_slots       ?? 2,
      availableMissions:  [],
      lastMissionRefresh: null,
    }

    // Always rebuild questProgress from current quests
    const currentQuests = _state.quests
    _state.questProgress = currentQuests.map(q => ({
      questId:  q.id,
      progress: 0,
      done:     q.id === 'login' && questDate === today,  // login auto-done if already claimed today
    }))

    // Refresh quests if it's a new day
    if (questDate !== today) {
      _state.quests         = generateDailyQuests(dateToSeed(today))
      _state.questProgress  = _state.quests.map(q => ({ questId: q.id, progress: 0, done: false }))
      _state.questsClaimed  = []
      _state.questDate      = today
    }
  }

  // Refresh available missions
  _state.availableMissions = generateMissions(4)

  useStore.setState({ eventState: _state })
  return _state
}

async function saveEventState(userId: string) {
  await supabase.from('player_events').upsert({
    player_id:      userId,
    login_streak:   _state.loginStreak,
    last_login_date: _state.lastLoginDate,
    longest_streak: _state.longestStreak,
    common_tokens:  _state.commonTokens,
    rare_tokens:    _state.rareTokens,
    quest_date:     _state.questDate,
    quests:         _state.quests,
    quests_claimed: _state.questsClaimed,
    missions:       _state.missions,
    mission_slots:  _state.missionSlots,
    updated_at:     new Date().toISOString(),
  }, { onConflict: 'player_id' })
  useStore.setState({ eventState: { ..._state } })
}

// ── Daily Login ───────────────────────────────────────────────
export async function claimDailyLogin(userId: string): Promise<{ reward: ReturnType<typeof getLoginReward>; newStreak: number } | null> {
  const today = getTodayStr()
  if (_state.lastLoginDate === today) return null  // already claimed

  const yesterday = getYesterdayStr()
  const wasStreak = _state.lastLoginDate === yesterday

  const newStreak = wasStreak ? _state.loginStreak + 1 : 1
  const reward    = getLoginReward(newStreak)

  _state.loginStreak     = newStreak
  _state.lastLoginDate   = today
  _state.longestStreak   = Math.max(_state.longestStreak, newStreak)

  // Apply reward
  applyReward(reward.type, reward.amount)
  if (reward.type === 'legendary_token') {
    // Legendary pack day also gives 10 diamonds
    save.diamonds += 10; save.persistCoins()
    useStore.setState({ diamonds: save.diamonds })
  }

  await saveEventState(userId)
  return { reward, newStreak }
}

export function canClaimLogin(): boolean {
  return _state.lastLoginDate !== getTodayStr()
}

// ── Quest Progress ────────────────────────────────────────────
export async function updateQuestProgress(userId: string, type: string, amount = 1) {
  let changed = false
  _state.questProgress = _state.questProgress.map(qp => {
    if (qp.done) return qp
    const quest = _state.quests.find(q => q.id === qp.questId)
    if (!quest || quest.type !== type) return qp
    const newProgress = Math.min(qp.progress + amount, quest.target)
    if (newProgress !== qp.progress) changed = true
    return { ...qp, progress: newProgress, done: newProgress >= quest.target }
  })

  if (changed) {
    await saveEventState(userId)
  }
}

export function getCompletedQuestCount(): number {
  return _state.questProgress.filter(qp => qp.done).length
}

export async function claimQuestMilestone(userId: string, milestoneIdx: number): Promise<boolean> {
  const { QUEST_MILESTONES } = await import('@data/events')
  const milestone = QUEST_MILESTONES[milestoneIdx]
  if (!milestone) return false
  if (_state.questsClaimed.includes(milestoneIdx)) return false
  if (getCompletedQuestCount() < milestone.required) return false

  _state.questsClaimed = [..._state.questsClaimed, milestoneIdx]
  applyReward(milestone.reward.type, milestone.reward.amount)
  if ((milestone.reward as any).diamonds) {
    save.diamonds += (milestone.reward as any).diamonds
    save.persistCoins()
    useStore.setState({ diamonds: save.diamonds })
  }

  await saveEventState(userId)
  return true
}

// ── Spin Wheel ────────────────────────────────────────────────
export async function spinCommonWheel(userId: string): Promise<WheelSlot | null> {
  if (_state.commonTokens < 1) return null
  _state.commonTokens -= 1
  const { slot } = spinWheel(COMMON_WHEEL)
  applyReward(slot.type, slot.amount)
  await saveEventState(userId)
  return slot
}

export async function spinRareWheel(userId: string): Promise<WheelSlot | null> {
  if (_state.rareTokens < 1) return null
  _state.rareTokens -= 1
  const { slot } = spinWheel(RARE_WHEEL)
  applyReward(slot.type, slot.amount)
  await saveEventState(userId)
  return slot
}

// ── Missions ──────────────────────────────────────────────────
export async function startMission(userId: string, defId: string, unitIds: string[]): Promise<boolean> {
  const { MISSION_POOL } = await import('@data/events')
  const def = MISSION_POOL.find(m => m.id === defId)
  if (!def) return false

  const activeMissions = _state.missions.filter(m => !m.completed)
  if (activeMissions.length >= _state.missionSlots) return false

  const now     = Date.now()
  const mission: ActiveMission = {
    defId,
    startTime: now,
    endTime:   now + def.duration * 60 * 1000,
    unitIds,
    completed: false,
  }

  _state.missions = [..._state.missions, mission]

  // Update send_mission quest progress
  await updateQuestProgress(userId, 'send_mission', 1)

  await saveEventState(userId)
  return true
}

export async function skipMission(userId: string, missionIdx: number): Promise<boolean> {
  const { MISSION_POOL } = await import('@data/events')
  const mission = _state.missions[missionIdx]
  if (!mission || mission.completed) return false

  const def = MISSION_POOL.find(m => m.id === mission.defId)
  if (!def) return false

  if (save.diamonds < def.skipCost) return false

  save.diamonds -= def.skipCost
  save.persistCoins()
  useStore.setState({ diamonds: save.diamonds })

  // Complete immediately
  _state.missions[missionIdx] = { ...mission, endTime: Date.now() - 1 }
  await claimMissionReward(userId, missionIdx)
  return true
}

export async function claimMissionReward(userId: string, missionIdx: number): Promise<boolean> {
  const { MISSION_POOL } = await import('@data/events')
  const mission = _state.missions[missionIdx]
  if (!mission || mission.completed) return false
  if (Date.now() < mission.endTime) return false

  const def = MISSION_POOL.find(m => m.id === mission.defId)
  if (!def) return false

  _state.missions[missionIdx] = { ...mission, completed: true }

  // Apply rewards
  save.coins += def.reward.coins
  if (def.reward.diamonds)      { save.diamonds += def.reward.diamonds }
  if (def.reward.common_tokens) { _state.commonTokens += def.reward.common_tokens }
  if (def.reward.rare_tokens)   { _state.rareTokens   += def.reward.rare_tokens   }
  save.persistCoins()
  useStore.setState({ coins: save.coins, diamonds: save.diamonds })

  await saveEventState(userId)
  return true
}

export function isMissionComplete(mission: ActiveMission): boolean {
  return Date.now() >= mission.endTime
}

export function getMissionTimeLeft(mission: ActiveMission): string {
  const ms   = Math.max(0, mission.endTime - Date.now())
  const hrs  = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (hrs > 0)  return `${hrs}h ${mins}m`
  if (mins > 0) return `${mins}m`
  return 'Done!'
}

// ── Helpers ───────────────────────────────────────────────────
function applyReward(type: string, amount: number) {
  switch (type) {
    case 'coins':           save.coins    += amount; save.persistCoins(); useStore.setState({ coins: save.coins }); break
    case 'diamonds':        save.diamonds += amount; save.persistCoins(); useStore.setState({ diamonds: save.diamonds }); break
    case 'common_token':    _state.commonTokens += amount; break
    case 'rare_token':      _state.rareTokens   += amount; break
    case 'epic_token':      _state.commonTokens += amount; break   // Epic token = rare token for simplicity
    case 'legendary_token': _state.rareTokens   += amount; break   // Legendary token = 2 rare tokens
    case 'pack_multiplier': useStore.setState({ packMultiplier: amount }); break
  }
}

function getTodayStr():     string { return new Date().toISOString().split('T')[0] }
function getYesterdayStr(): string { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0] }
function dateToSeed(str: string):  number { return str.split('-').reduce((a,b) => a + parseInt(b), 0) }