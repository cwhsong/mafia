import { rolesHref } from '../route'

const STEPS = [
  {
    label: 'Setup',
    title: 'One narrator, everyone else plays',
    text: 'The narrator shares the room code and picks the pool of roles for the game. Everyone else joins on their own phone. Roles are dealt in secret: tap your card to see yours.',
  },
  {
    label: 'Night',
    title: 'Phones run the night',
    text: 'Everyone uses their phones for night actions. The Mafia choose who to kill, and every other role makes their move: protect, investigate, distract, etc.',
  },
  {
    label: 'Dawn',
    title: 'The narrator tells the story',
    text: 'Each player gets a private message about their night. The narrator sees everything that happened and tells the town who died.',
  },
  {
    label: 'Day',
    title: 'Talk it out, then vote',
    text: 'Accuse, defend, bluff. Everyone votes on their phone; votes are public, like pointing around the table. Whoever gets the most votes, and more votes than Abstain, is out.',
  },
]

const WINS = [
  { team: 'town', name: 'Town', text: 'wins when every Mafia member and hostile Neutral is gone.' },
  { team: 'mafia', name: 'Mafia', text: 'win when they match or outnumber everyone else.' },
  { team: 'neutral', name: 'Neutrals', text: 'each have their own goal, from surviving to getting voted out.' },
]

// The short version of the rules, below Host / Join on the home page.
export function HowToPlay() {
  return (
    <section className="how" aria-labelledby="how-title">
      <div className="stack">
        <p className="eyebrow">How to play</p>
        <h2 id="how-title" className="how-title">Mafia, with the logistics handled</h2>
        <p className="home-lede">
          A party game of hidden roles for 5 or more people in the same room. The town tries to find
          the Mafia before the Mafia take over.
        </p>
      </div>

      <ol className="how-steps">
        {STEPS.map((step, i) => (
          <li key={step.label} className="panel how-step">
            <p className="section-label">
              {i + 1} · {step.label}
            </p>
            <h3 className="how-step-title">{step.title}</h3>
            <p className="muted">{step.text}</p>
          </li>
        ))}
      </ol>

      <div className="panel stack">
        <p className="section-label">Winning</p>
        <ul className="how-wins">
          {WINS.map((w) => (
            <li key={w.team}>
              <strong className={`team-${w.team}`}>{w.name}</strong> {w.text}
            </li>
          ))}
        </ul>
        <p className="hint">The game is over once a side has won. Then every role is revealed.</p>
      </div>

      <a className="btn btn-primary how-roles" href={rolesHref()}>
        Browse all roles →
      </a>
      <p className="hint how-credit">
        Inspired by the party game Mafia, mafiarole.com and Town of Salem.
      </p>
    </section>
  )
}
