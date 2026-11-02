import { useState, type FormEvent } from 'react'
import { CardFan } from '../components/CardFan'
import { codeFromHash, isValidRoomCode, normalizeRoomCode, CODE_LENGTH } from '../../transport/roomCode'
import './Home.css'

type Mode = 'host' | 'join'

export function Home() {
  // A join link like …/mafia/#KXQRTZ opens straight on the Join tab with the code filled in
  const linkedCode = codeFromHash(window.location.hash)

  const [mode, setMode] = useState<Mode>(linkedCode ? 'join' : 'host')
  const [name, setName] = useState('')
  const [code, setCode] = useState(linkedCode ?? '')

  const cleanCode = normalizeRoomCode(code)
  const codeTyped = cleanCode.length >= CODE_LENGTH
  const codeOk = isValidRoomCode(cleanCode)
  const canSubmit = name.trim() !== '' && (mode === 'host' || codeOk)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Wired up in Step 2.6
  }

  return (
    <section className="home">
      <div className="home-copy">
        <p className="eyebrow">Omertà</p>
        <h1 className="home-title">
          <span className="home-title-line">Mafia:</span>
          <span className="home-title-accent">Daybreak</span>
        </h1>
        <p className="home-lede">
          Phones run the night. Narrator runs the story.
          
        </p>

        <form className="panel stack home-panel" onSubmit={handleSubmit}>
          <div className="tabs" role="tablist" aria-label="Host or join">
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={mode === 'host'}
              onClick={() => setMode('host')}
            >
              Host a game
            </button>
            <button
              type="button"
              role="tab"
              className="tab"
              aria-selected={mode === 'join'}
              onClick={() => setMode('join')}
            >
              Join a game
            </button>
          </div>

          <p className="hint">
            {mode === 'host'
              ? "You'll narrate. Everyone else joins with a 6-letter code."
              : 'Ask the narrator for the room code.'}
          </p>

          {mode === 'join' && (
            <label className="field">
              Room code
              <input
                className="input input-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCDEF"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={8}
              />
              {codeTyped && !codeOk && (
                <span className="error">Codes use letters only, without I, L or O.</span>
              )}
            </label>
          )}

          <label className="field">
            Your name
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chisp"
              autoComplete="nickname"
              maxLength={24}
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            {mode === 'host' ? 'Host a game' : 'Join game'}
          </button>
        </form>
      </div>

      <div className="home-art" aria-hidden="true">
        <CardFan />
      </div>
    </section>
  )
}
