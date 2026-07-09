import React, { useState } from 'react'

export default function SidebarFavorites({ pokemons = [], favorites = [], blockedIds = [], onToggle, onToggleBlocked }) {
  const [open, setOpen] = useState(true)

  const favoritePokemons = favorites
    .map((id) => pokemons.find((p) => p.id === id))
    .filter(Boolean)

  const blockedPokemons = blockedIds
    .map((id) => pokemons.find((p) => p.id === id))
    .filter(Boolean)

  return (
    <aside className={`sidebar-favs ${open ? 'open' : 'closed'}`}>
      <button className="sidebar-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true" style={{ marginRight: 6 }}>
          <circle cx="16" cy="16" r="14" fill="#fff" stroke="#000" strokeWidth="1" />
          <path d="M2 16h28" stroke="#000" strokeWidth="2" />
          <path d="M4 16a12 12 0 0 0 24 0" fill="#ef4444" opacity="0.95" />
        </svg>
        {open ? 'Cerrar' : `Listas (${favorites.length + blockedIds.length})`}
      </button>

      {open && (
        <div className="sidebar-content">
          <div className="list-section">
            <h3>Favoritos</h3>
            {favoritePokemons.length === 0 ? (
              <p className="empty">No hay favoritos aún.</p>
            ) : (
              <ul>
                {favoritePokemons.map((p) => (
                  <li key={p.id} className="fav-item">
                    <img src={p.image} alt={p.name} />
                    <div className="fav-meta">
                      <strong>{p.name}</strong>
                      <span>#{p.id.toString().padStart(3, '0')}</span>
                    </div>
                    <button className="remove-btn" onClick={() => onToggle(p.id)} aria-label={`Quitar ${p.name}`}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="blocked-section">
            <h4>Bloqueados</h4>
            {blockedPokemons.length === 0 ? (
              <p className="empty">No hay Pokémon bloqueados.</p>
            ) : (
              <ul>
                {blockedPokemons.map((p) => (
                  <li key={p.id} className="fav-item blocked-item">
                    <img src={p.image} alt={p.name} />
                    <div className="fav-meta">
                      <strong>{p.name}</strong>
                      <span>#{p.id.toString().padStart(3, '0')}</span>
                    </div>
                    <button className="remove-btn" onClick={() => onToggleBlocked(p.id)} aria-label={`Desbloquear ${p.name}`}>
                      🔓
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
