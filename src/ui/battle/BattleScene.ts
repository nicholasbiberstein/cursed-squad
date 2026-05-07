import Phaser from 'phaser'
import { useStore } from '@store'
import { isEnemyVisible } from '@systems/VisibilityEngine'
import { registerAnimations, doMove, doPunch, buildPreview, selectUnit } from './BattleController'
import type { Unit } from '@data/types'

// ============================================================
// BATTLE SCENE  (Phaser 3)
// Renders the 15×15 grid, fog, tokens, highlights.
// Calls BattleController on user interaction.
// React BattleHUD overlays this canvas.
// ============================================================

const CELL  = 42
const GSIZE = 15
const COLS  = ['#07070d','#0d0d17','#3c8fff','#ff3c3c','#ffb800','#3cffb4','#c03cff','#ff8800','#04040a','#22223a','#888899']

export default class BattleScene extends Phaser.Scene {
  private tokens:     Map<string, Phaser.GameObjects.Container> = new Map()
  private cellGfx!:   Phaser.GameObjects.Graphics
  private hlGfx!:     Phaser.GameObjects.Graphics
  private fogGfx!:    Phaser.GameObjects.Graphics
  private numGroup!:  Phaser.GameObjects.Group
  private stsGroup!:  Phaser.GameObjects.Group
  private _prevPhase: string = 'idle'
  private _prevTurnIdx = -1

  constructor() { super({ key: 'BattleScene' }) }

  create() {
    const W = GSIZE * CELL, H = GSIZE * CELL

    // Background
    this.add.rectangle(W/2, H/2, W, H, 0x07070d)

    // Layered graphics
    this.cellGfx = this.add.graphics()
    this.hlGfx   = this.add.graphics()
    this.fogGfx  = this.add.graphics()

    this.numGroup = this.add.group()
    this.stsGroup = this.add.group()

    // Register animation callbacks with controller
    registerAnimations({
      hit:    id => this.doHitAnim(id),
      heal:   id => this.doHealAnim(id),
      death:  id => this.doDeathAnim(id),
      number: (id, text, type) => this.spawnFloatNumber(id, text, type),
      status: (id, text, color) => this.spawnStatusPop(id, text, color),
      render: () => this.renderAll(),
    })

    // Input — click on grid cell
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      const c = Math.floor(ptr.x / CELL)
      const r = Math.floor(ptr.y / CELL)
      if (c < 0 || c >= GSIZE || r < 0 || r >= GSIZE) return
      this.handleCellClick(r, c)
    })

    this.renderAll()
  }

  update() {
    const s = useStore.getState()
    if (s.phase !== this._prevPhase || s.selectedUnitId !== this._prevTurnIdx as any) {
      this._prevPhase    = s.phase
      this._prevTurnIdx  = s.selectedUnitId as any
      this.renderHighlights()
    }
  }

  // ── RENDER ALL ──────────────────────────────────────────────
  renderAll() {
    this.renderCells()
    this.renderHighlights()
    this.renderFog()
    this.renderTokens()
  }

  // ── CELLS (walls + cover) ───────────────────────────────────
  renderCells() {
    const s   = this.cellGfx
    const st  = useStore.getState()
    s.clear()

    for (let r = 0; r < GSIZE; r++) {
      for (let c = 0; c < GSIZE; c++) {
        const x = c * CELL, y = r * CELL
        const key = `${r},${c}`

        if (st.walls.has(key)) {
          // Wall
          s.fillStyle(0x111120)
          s.fillRect(x, y, CELL, CELL)
          s.lineStyle(1, 0x1c1c2c)
          for (let i = 0; i < CELL; i += 8) {
            s.lineBetween(x + i, y, x, y + i)
            s.lineBetween(x + CELL, y + i, x + i, y + CELL)
          }
        } else if (st.covers.has(key)) {
          // Cover
          s.fillStyle(0x1a1508, 0.6)
          s.fillRect(x, y, CELL, CELL)
          s.lineStyle(1, 0xff880033)
          s.strokeRect(x, y, CELL, CELL)
        } else {
          // Normal cell
          s.lineStyle(1, 0xffffff, 0.025)
          s.strokeRect(x, y, CELL, CELL)
        }
      }
    }
  }

  // ── HIGHLIGHTS ──────────────────────────────────────────────
  renderHighlights() {
    const g  = this.hlGfx; g.clear()
    const st = useStore.getState()
    // Only highlight when it's the player phase and a unit is selected
    if (st.battlePhase !== 'player') return
    const cu = st.units.find(u => u.id === st.selectedUnitId)
    if (!cu || cu.team !== 'player' || cu.hp <= 0) return

    const phase = st.phase
    const pwr   = cu.power

    // ── MOVE: BFS flood fill matching controller logic exactly ──
    if (phase === 'move' && cu.downside.id !== 'locked_pos') {
      const mr = (pwr.type === 'dash' ? 5 : 3) + (pwr._moveBonus ?? 0)
      const reachable = new Set<string>()
      const queue: Array<{r: number; c: number; steps: number}> = [{ r: cu.pos.r, c: cu.pos.c, steps: 0 }]
      const visited = new Set<string>([`${cu.pos.r},${cu.pos.c}`])
      while (queue.length) {
        const { r, c, steps } = queue.shift()!
        // Only mark as reachable if empty (no unit, no wall) and not the starting cell
        if (steps > 0 && !st.grid[r]?.[c] && !st.walls.has(`${r},${c}`)) {
          reachable.add(`${r},${c}`)
        }
        if (steps >= mr) continue
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          const nr = r+dr, nc = c+dc, nk = `${nr},${nc}`
          if (nr < 0 || nr >= GSIZE || nc < 0 || nc >= GSIZE) continue
          if (visited.has(nk)) continue
          // Can pass through empty non-wall tiles only
          if (st.walls.has(nk)) continue
          if (st.grid[nr]?.[nc]) continue  // occupied by any unit — can't pass through
          visited.add(nk)
          queue.push({ r: nr, c: nc, steps: steps+1 })
        }
      }
      for (const key of reachable) {
        const [r, c] = key.split(',').map(Number)
        g.fillStyle(0x3c8fff, 0.18); g.fillRect(c*CELL, r*CELL, CELL, CELL)
        g.lineStyle(1, 0x3c8fff, 0.5); g.strokeRect(c*CELL, r*CELL, CELL, CELL)
      }
      // Undo highlight — only show if selected unit hasn't acted yet
      const selActs = cu ? (st.unitActs[cu.id] ?? { moved: false, acted: false }) : null
      if (st.undoPos && selActs && !selActs.acted) {
        const { r, c } = st.undoPos
        g.fillStyle(0x3c8fff, 0.08); g.fillRect(c*CELL, r*CELL, CELL, CELL)
        g.lineStyle(1, 0x3c8fff, 0.25); g.strokeRect(c*CELL, r*CELL, CELL, CELL)
      }
    }

    if (phase === 'punch') {
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
      for (const [dr, dc] of dirs) {
        const nr = cu.pos.r + dr, nc = cu.pos.c + dc
        if (nr < 0 || nr >= GSIZE || nc < 0 || nc >= GSIZE) continue
        const hasEnemy = st.units.find(u => u.pos.r === nr && u.pos.c === nc && u.hp > 0 && u.team === 'enemy')
        if (hasEnemy) { g.fillStyle(0xff8800, 0.2); g.fillRect(nc*CELL, nr*CELL, CELL, CELL); g.lineStyle(1, 0xff8800, 0.5); g.strokeRect(nc*CELL, nr*CELL, CELL, CELL) }
      }
    }

    if (phase === 'ability' || phase === 'preview') {
      const range = (pwr.range ?? 1) + (pwr._rangeBonus ?? 0)
      const isSelf = ['shield','double','selfbuff'].includes(pwr.type) ||
        ['shield','double_action','adrenaline','stabilize','warcry','rewind','entropy_field'].includes(pwr.id)

      if (isSelf) {
        g.fillStyle(0xffffff, 0.08); g.fillRect(cu.pos.c*CELL, cu.pos.r*CELL, CELL, CELL)
        g.lineStyle(1, 0xffffff, 0.35); g.strokeRect(cu.pos.c*CELL, cu.pos.r*CELL, CELL, CELL)

      } else if (pwr.type === 'aoe' || pwr.type === 'scan') {
        for (let r = 0; r < GSIZE; r++) {
          for (let c = 0; c < GSIZE; c++) {
            const d = Math.abs(r - cu.pos.r) + Math.abs(c - cu.pos.c)
            if (d <= range) {
              const col = pwr.type === 'scan' ? 0xc03cff : 0xffb800
              g.fillStyle(col, 0.12); g.fillRect(c*CELL, r*CELL, CELL, CELL)
              g.lineStyle(1, col, 0.38); g.strokeRect(c*CELL, r*CELL, CELL, CELL)
            }
          }
        }

      } else if (pwr.type === 'heal' || pwr.id === 'cleanse') {
        st.units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => {
          const d = Math.abs(u.pos.r - cu.pos.r) + Math.abs(u.pos.c - cu.pos.c)
          if (d <= range) { g.fillStyle(0x3cffb4, 0.14); g.fillRect(u.pos.c*CELL, u.pos.r*CELL, CELL, CELL); g.lineStyle(1, 0x3cffb4, 0.4); g.strokeRect(u.pos.c*CELL, u.pos.r*CELL, CELL, CELL) }
        })

      } else if (pwr.type === 'teleport') {
        for (let r = 0; r < GSIZE; r++) {
          for (let c = 0; c < GSIZE; c++) {
            const d = Math.abs(r - cu.pos.r) + Math.abs(c - cu.pos.c)
            const key = `${r},${c}`
            const fogOk = pwr.id === 'shadow_step' ? !st.visibleCells.has(key) : st.visibleCells.has(key)
            if (d > 0 && d <= range && fogOk && !st.grid[r]?.[c] && !st.walls.has(key)) {
              g.fillStyle(0xc03cff, 0.14); g.fillRect(c*CELL, r*CELL, CELL, CELL)
              g.lineStyle(1, 0xc03cff, 0.38); g.strokeRect(c*CELL, r*CELL, CELL, CELL)
            }
          }
        }

      } else if (pwr.type === 'line') {
        // Bug 3 fix: line attacks only highlight along the 4 cardinal directions with LoS check
        const dirs4 = [[-1,0],[1,0],[0,-1],[0,1]]
        for (const [dr, dc] of dirs4) {
          let cr = cu.pos.r + dr, cc = cu.pos.c + dc, dist = 1
          while (dist <= range && cr >= 0 && cr < GSIZE && cc >= 0 && cc < GSIZE) {
            if (st.walls.has(`${cr},${cc}`)) break  // wall blocks the beam
            const hasEnemy = st.units.find(u => u.pos.r === cr && u.pos.c === cc && u.hp > 0 && u.team === 'enemy' && isEnemyVisible(u, st.visibleCells, st.fogReveal))
            if (hasEnemy) {
              g.fillStyle(0xff3c3c, 0.16); g.fillRect(cc*CELL, cr*CELL, CELL, CELL)
              g.lineStyle(1, 0xff3c3c, 0.46); g.strokeRect(cc*CELL, cr*CELL, CELL, CELL)
              break  // line stops at first enemy
            }
            cr += dr; cc += dc; dist++
          }
        }

      } else {
        // Standard range attack — only highlight cells with visible enemies in range
        for (let r = 0; r < GSIZE; r++) {
          for (let c = 0; c < GSIZE; c++) {
            const d = Math.abs(r - cu.pos.r) + Math.abs(c - cu.pos.c)
            if (d <= range) {
              const hasEnemy = st.units.find(u => u.pos.r === r && u.pos.c === c && u.hp > 0 && u.team === 'enemy' && isEnemyVisible(u, st.visibleCells, st.fogReveal))
              if (hasEnemy) {
                g.fillStyle(0xff3c3c, 0.16); g.fillRect(c*CELL, r*CELL, CELL, CELL)
                g.lineStyle(1, 0xff3c3c, 0.46); g.strokeRect(c*CELL, r*CELL, CELL, CELL)
              }
            }
          }
        }
      }
    }
  }

  // ── FOG OF WAR ───────────────────────────────────────────────
  renderFog() {
    const g  = this.fogGfx; g.clear()
    const st = useStore.getState()
    for (let r = 0; r < GSIZE; r++) {
      for (let c = 0; c < GSIZE; c++) {
        if (!st.visibleCells.has(`${r},${c}`) && !st.walls.has(`${r},${c}`)) {
          g.fillStyle(0x04040a, 0.94)
          g.fillRect(c*CELL, r*CELL, CELL, CELL)
        }
      }
    }
  }

  // ── TOKENS ───────────────────────────────────────────────────
  renderTokens() {
    const st  = useStore.getState()
    const selectedId = st.selectedUnitId

    for (const [id, container] of this.tokens.entries()) {
      const unit = st.units.find(u => u.id === id)
      if (!unit) { container.destroy(); this.tokens.delete(id) }
    }

    for (const unit of st.units) {
      if (unit.hp <= 0) {
        this.tokens.get(unit.id)?.destroy()
        this.tokens.delete(unit.id)
        continue
      }

      const isPlayer = unit.team === 'player'
      const vis      = isPlayer || isEnemyVisible(unit, st.visibleCells, st.fogReveal)
      if (!vis) { this.tokens.get(unit.id)?.setVisible(false); continue }

      const x = unit.pos.c * CELL + CELL/2
      const y = unit.pos.r * CELL + CELL/2
      const isSelected = unit.id === selectedId

      let container = this.tokens.get(unit.id)
      if (!container) { container = this.createToken(unit); this.tokens.set(unit.id, container) }

      container.setPosition(x, y)
      container.setVisible(true)
      container.setAlpha(unit.statuses.invisible ? 0.42 : 1)

      const hpText = container.getByName('hp') as Phaser.GameObjects.Text
      if (hpText) hpText.setText(String(unit.hp))

      const bg = container.getByName('bg') as Phaser.GameObjects.Rectangle
      if (bg) {
        // Selected player unit = gold, others = team colour
        const borderColor = isSelected
          ? 0xffb800
          : isPlayer
            ? (unit.statuses.invisible ? 0xc03cff : 0x3c8fff)
            : 0xff3c3c
        bg.setStrokeStyle(isSelected ? 2 : 1, borderColor)
        // Pulse selected unit slightly larger
        if (isSelected && !this.tweens.isTweening(container)) {
          this.tweens.add({ targets: container, scaleX: 1.08, scaleY: 1.08, duration: 300, yoyo: true, repeat: -1 })
        } else if (!isSelected) {
          this.tweens.killTweensOf(container)
          container.setScale(1)
        }
      }
    }
  }

  createToken(unit: Unit): Phaser.GameObjects.Container {
    const isPlayer = unit.team === 'player'
    const size     = 32

    const bg = this.add.rectangle(0, 0, size, size, isPlayer ? 0x0d1a2a : 0x1a0d0d, 0.85)
    bg.setStrokeStyle(1, isPlayer ? 0x3c8fff : 0xff3c3c)
    bg.setName('bg')

    const icon = this.add.text(0, -4, unit.icon, { fontSize: '14px' }).setOrigin(0.5)
    icon.setName('icon')

    const hp = this.add.text(0, 9, String(unit.hp), {
      fontSize: '7px', color: '#3cffb4', fontFamily: 'Share Tech Mono',
    }).setOrigin(0.5)
    hp.setName('hp')

    const container = this.add.container(unit.pos.c * CELL + CELL/2, unit.pos.r * CELL + CELL/2, [bg, icon, hp])
    container.setSize(size, size)
    container.setInteractive()
    container.on('pointerdown', () => {
      const c = Math.floor(container.x / CELL)
      const r = Math.floor(container.y / CELL)
      this.handleCellClick(r, c)
    })
    return container
  }

  // ── CELL CLICK HANDLER ───────────────────────────────────────
  handleCellClick(r: number, c: number) {
    const st    = useStore.getState()
    const phase = st.phase

    // Click on a friendly unit — select it
    const clickedUnit = st.units.find(u => u.pos.r === r && u.pos.c === c && u.hp > 0)
    if (clickedUnit?.team === 'player' && st.battlePhase === 'player') {
      selectUnit(clickedUnit.id)
      return
    }

    const cu = st.units.find(u => u.id === st.selectedUnitId)
    if (!cu || cu.team !== 'player' || st.battlePhase !== 'player') return

    if (phase === 'move') { doMove(r, c); return }

    if (phase === 'punch') {
      const target = st.units.find(u => u.pos.r === r && u.pos.c === c && u.hp > 0 && u.team === 'enemy')
      if (target) doPunch(target.id)
      return
    }

    if (phase === 'ability' || phase === 'preview') {
      const pwr   = cu.power
      const range = (pwr.range ?? 1) + (pwr._rangeBonus ?? 0)
      const dist  = Math.abs(r - cu.pos.r) + Math.abs(c - cu.pos.c)

      const isSelf = ['shield','double','selfbuff'].includes(pwr.type) ||
        ['shield','double_action','adrenaline','stabilize','warcry','rewind','entropy_field'].includes(pwr.id)
      if (isSelf) {
        const pre = buildPreview([], null); if (pre) useStore.setState({ preview: pre, phase: 'preview' }); return
      }

      if (pwr.type === 'teleport') {
        if (!st.grid[r]?.[c] && !st.walls.has(`${r},${c}`)) {
          const fogOk = pwr.id === 'shadow_step' ? !st.visibleCells.has(`${r},${c}`) : st.visibleCells.has(`${r},${c}`)
          if (fogOk) {
            st.grid[cu.pos.r][cu.pos.c] = null; cu.pos = { r, c }; st.grid[r][c] = cu.id
            useStore.setState(s => ({ unitActs: { ...s.unitActs, [cu.id]: { ...s.unitActs[cu.id], acted: true } }, phase: 'idle', units: [...st.units] }))
          }
        }
        return
      }

      if (pwr.type === 'aoe' && dist <= range) {
        const tgts = st.units.filter(t => t.hp > 0 && t.team === 'enemy' && Math.max(Math.abs(t.pos.r-r), Math.abs(t.pos.c-c)) <= 1+(pwr._radiusBonus??0))
        const pre = buildPreview(tgts, { r, c }); if (pre) useStore.setState({ preview: pre, phase: 'preview' }); return
      }

      if (pwr.type === 'heal' || pwr.id === 'cleanse') {
        const target = st.units.find(t => t.pos.r===r && t.pos.c===c && t.hp>0 && t.team==='player')
        if (target && dist <= range) { const pre = buildPreview([target], {r,c}); if (pre) useStore.setState({ preview: pre, phase: 'preview' }) }
        return
      }

      if (pwr.type === 'scan') {
        if (dist <= range) { const pre = buildPreview([], {r,c}); if (pre) useStore.setState({ preview: pre, phase: 'preview' }) }
        return
      }

      if (pwr.type === 'scan_all' || pwr.type === 'aoe_buff') {
        const pre = buildPreview([], null); if (pre) useStore.setState({ preview: pre, phase: 'preview' }); return
      }

      // Line attack — cardinal direction only, beam must not be blocked by walls
      if (pwr.type === 'line') {
        const target = st.units.find(t => t.pos.r===r && t.pos.c===c && t.hp>0 && t.team==='enemy')
        if (target && isEnemyVisible(target, st.visibleCells, st.fogReveal)) {
          const dr = r - cu.pos.r, dc = c - cu.pos.c
          const isCardinal = (dr===0 || dc===0) && !(dr===0 && dc===0)
          if (isCardinal) {
            // Trace beam — check no wall sits between shooter and target
            const stepR = Math.sign(dr), stepC = Math.sign(dc)
            let tr = cu.pos.r + stepR, tc = cu.pos.c + stepC
            let blocked = false
            while (tr !== r || tc !== c) {
              if (st.walls.has(`${tr},${tc}`)) { blocked = true; break }
              tr += stepR; tc += stepC
            }
            if (!blocked) { const pre = buildPreview([target], {r,c}); if (pre) useStore.setState({ preview: pre, phase: 'preview' }) }
          }
        }
        return
      }

      // Standard ranged — requires unblocked LoS (hasLoS check via visibility)
      const target = st.units.find(t => t.pos.r===r && t.pos.c===c && t.hp>0 && t.team==='enemy')
      if (target && dist <= range && isEnemyVisible(target, st.visibleCells, st.fogReveal)) {
        // Verify LoS is not wall-blocked
        let losBlocked = false
        const dr2 = Math.sign(r - cu.pos.r), dc2 = Math.sign(c - cu.pos.c)
        if (dr2 !== 0 || dc2 !== 0) {
          // Use Bresenham-style check: just reuse the visibility system which already checks walls
          // isEnemyVisible already confirmed this target is visible from player vision cast
          // which uses hasLoS internally — so if visible, LoS is already confirmed
        }
        if (!losBlocked) { const pre = buildPreview([target], {r,c}); if (pre) useStore.setState({ preview: pre, phase: 'preview' }) }
      }
    }
  }

  // ── ANIMATIONS ───────────────────────────────────────────────
  doHitAnim(id: string) {
    const c = this.tokens.get(id); if (!c) return
    const orig = { x: c.x, y: c.y }
    this.tweens.add({
      targets: c, x: c.x + 4, duration: 50, yoyo: true, repeat: 2,
      onComplete: () => c.setPosition(orig.x, orig.y),
    })
    const bg = c.getByName('bg') as Phaser.GameObjects.Rectangle
    if (bg) { this.tweens.add({ targets: bg, fillAlpha: 0.95, duration: 60, yoyo: true, onComplete: () => bg.setFillStyle(bg.fillColor, 0.85) }) }
  }

  doHealAnim(id: string) {
    const c = this.tokens.get(id); if (!c) return
    this.tweens.add({ targets: c, scaleX: 1.15, scaleY: 1.15, duration: 120, yoyo: true })
  }

  doDeathAnim(id: string) {
    const c = this.tokens.get(id); if (!c) return
    this.tweens.add({
      targets: c, scaleX: 0, scaleY: 0, alpha: 0, angle: 20, duration: 480,
      onComplete: () => { c.destroy(); this.tokens.delete(id) },
    })
  }

  spawnFloatNumber(id: string, text: string, type: 'dmg'|'heal'|'miss') {
    const c = this.tokens.get(id); if (!c) return
    const col   = type === 'heal' ? '#3cffb4' : type === 'miss' ? '#555555' : '#ff5050'
    const size  = type === 'dmg' && parseInt(text.replace('-','')) >= 45 ? '22px' : '18px'
    const label = this.add.text(c.x, c.y - 10, text, {
      fontSize: size, color: col, fontFamily: "'Bebas Neue', sans-serif",
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(100)
    this.numGroup.add(label)
    this.tweens.add({
      targets: label, y: label.y - 40, alpha: 0, duration: 720,
      onComplete: () => label.destroy(),
    })
  }

  spawnStatusPop(id: string, text: string, color: string) {
    const c = this.tokens.get(id); if (!c) return
    const col = color.startsWith('#') ? color : '#c03cff'
    const label = this.add.text(c.x, c.y - 14, text, {
      fontSize: '11px', color: col, fontFamily: "'Bebas Neue', sans-serif",
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101)
    this.stsGroup.add(label)
    this.tweens.add({
      targets: label, y: label.y - 28, alpha: 0, duration: 700,
      onComplete: () => label.destroy(),
    })
  }
}