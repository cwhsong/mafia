import type { ReactNode } from 'react'

interface Props {
  label: string                 // when: "Night 2" (narrator screens add "· Narrator")
  title: ReactNode              // what is happening
  subtext?: ReactNode           // what you should do
  titleClassName?: string
}

// The three-line heading used on every in-game screen.
export function ScreenHeading({ label, title, subtext, titleClassName = '' }: Props) {
  return (
    <section className="stack">
      <p className="section-label">{label}</p>
      <h1 className={`room-title ${titleClassName}`}>{title}</h1>
      {subtext && <p className="muted">{subtext}</p>}
    </section>
  )
}
