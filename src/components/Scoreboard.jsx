import Avatar from './Avatar.jsx'

// Placar de dois lados: [{ name, avatar, seed, score, active, badge }]
export default function Scoreboard({ sides, draws }) {
  return (
    <div className="scoreboard">
      {sides.map((s, i) => (
        <div key={i} className={`scoreboard__side${s.active ? ' scoreboard__side--active' : ''}`}>
          {s.badge}
          <Avatar src={s.avatar} seed={s.seed} name={s.name} size={30} />
          <span className="scoreboard__name">{s.name}</span>
          <span className="scoreboard__score">{s.score}</span>
        </div>
      ))}
      {draws != null && <span className="scoreboard__draws">Empates: {draws}</span>}
    </div>
  )
}
