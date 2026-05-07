import React, { useEffect } from 'react'
import { useStore } from '@store'
import { initAuth } from '@lib/AuthManager'
import TitleScreen      from './screens/TitleScreen'
import BuildScreen      from './screens/BuildScreen'
import ShopScreen       from './screens/ShopScreen'
import CollectionScreen from './screens/CollectionScreen'
import ForgeScreen      from './screens/ForgeScreen'
import RefineScreen     from './screens/RefineScreen'
import CampaignScreen   from './screens/CampaignScreen'
import InterBattleScreen from './screens/InterBattleScreen'
import BattleHUD        from './screens/BattleHUD'
import ResultScreen     from './screens/ResultScreen'
import './styles.css'

// ============================================================
// APP — Root screen router
// React is the UI overlay. Phaser handles the battle grid.
// All screens except Battle are pure React.
// Battle screen = React HUD layered over a Phaser canvas.
// ============================================================

export default function App(): React.ReactElement {
  const screen = useStore(s => s.screen)

  // Unlock Web Audio on first interaction (mobile requirement)
  useEffect(() => {
    // Init Supabase auth session
    initAuth()

    const unlock = () => {
      // AudioContext is managed in the AudioEngine utility
      window.removeEventListener('click',      unlock)
      window.removeEventListener('touchstart', unlock)
    }
    window.addEventListener('click',      unlock, { once: true })
    window.addEventListener('touchstart', unlock, { once: true })
  }, [])

  return (
    <div id="ui-root" style={{ pointerEvents: 'none', height: '100%' }}>
      {screen === 'title'      && <TitleScreen />}
      {screen === 'build'      && <BuildScreen />}
      {screen === 'shop'       && <ShopScreen />}
      {screen === 'collection' && <CollectionScreen />}
      {screen === 'forge'      && <ForgeScreen />}
      {screen === 'refine'     && <RefineScreen />}
      {screen === 'campaign'   && <CampaignScreen />}
      {screen === 'inter'      && <InterBattleScreen />}
      {screen === 'battle'     && <BattleHUD />}
      {screen === 'result'     && <ResultScreen />}
    </div>
  )
}