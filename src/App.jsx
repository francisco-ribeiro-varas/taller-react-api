import { useEffect, useState } from 'react'
import './App.css'
import SidebarFavorites from './SidebarFavorites'

function App() {
  const [pokemons, setPokemons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem('favorites')
      return raw ? JSON.parse(raw) : []
    } catch (err) {
      return []
    }
  })
  const [blockedIds, setBlockedIds] = useState(() => {
    try {
      const raw = localStorage.getItem('blocked')
      return raw ? JSON.parse(raw) : []
    } catch (err) {
      return []
    }
  })

  useEffect(() => {
    const fetchPokemons = async () => {
      try {
        setLoading(true)
        const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1500')

        if (!response.ok) {
          throw new Error('No se pudo cargar la lista de Pokémon')
        }

        const data = await response.json()
        const mappedPokemons = data.results.slice(0, 150).map((pokemon) => {
          const id = Number(pokemon.url.split('/').filter(Boolean).pop())

          return {
            id,
            name: pokemon.name,
            image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
          }
        })

        setPokemons(mappedPokemons)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPokemons()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites))
    } catch (err) {
      // ignore
    }
  }, [favorites])

  useEffect(() => {
    try {
      localStorage.setItem('blocked', JSON.stringify(blockedIds))
    } catch (err) {
      // ignore
    }
  }, [blockedIds])

  useEffect(() => {
    setFavorites((prev) => prev.filter((id) => !blockedIds.includes(id)))
  }, [blockedIds])

  const toggleFavorite = (id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const toggleBlocked = (id) => {
    const isBlocked = blockedIds.includes(id)

    if (isBlocked) {
      setBlockedIds((prev) => prev.filter((item) => item !== id))
      return
    }

    setBlockedIds((prev) => [...prev, id])
    setFavorites((prev) => prev.filter((item) => item !== id))
  }

  const filteredPokemons = pokemons.filter((pokemon) => {
    if (blockedIds.includes(pokemon.id)) {
      return false
    }

    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) {
      return true
    }

    return (
      pokemon.name.toLowerCase().includes(normalizedSearch) ||
      pokemon.id.toString().includes(normalizedSearch)
    )
  })

  return (
    <main className="app">
      <header className="hero">
        <p className="eyebrow">Pokedex básica</p>
        <h1>Descubre Pokémon</h1>
        <p className="hero-text">
          Esta página consume la API de Pokémon y muestra un diseño simple con tarjetas e imágenes.
        </p>
      </header>

      <section className="toolbar">
        <label className="search-field" htmlFor="pokemon-search">
          <span className="search-label">Buscar Pokémon</span>
          <input
            id="pokemon-search"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ej. Pikachu"
          />
        </label>
        <p className="results-count">
          {filteredPokemons.length} de {pokemons.length} Pokémon
        </p>
      </section>

      {loading && <p className="status">Cargando Pokémon...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && filteredPokemons.length === 0 && (
        <p className="status">No se encontraron Pokémon con ese término.</p>
      )}

      <div className="content-with-sidebar">
        <section className="pokemon-grid">
          {filteredPokemons.map((pokemon) => {
            const isBlocked = blockedIds.includes(pokemon.id)

            return (
              <article key={pokemon.id} className="pokemon-card">
                <button
                  className={`fav-btn ${favorites.includes(pokemon.id) ? 'fav-active' : ''}`}
                  onClick={() => toggleFavorite(pokemon.id)}
                  aria-pressed={favorites.includes(pokemon.id)}
                  title={favorites.includes(pokemon.id) ? 'Quitar favorito' : 'Marcar favorito'}
                >
                  <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="16" cy="16" r="14" fill="#fff" stroke="#000" strokeWidth="1" />
                    <path d="M2 16h28" stroke="#000" strokeWidth="2" />
                    <circle cx="16" cy="16" r="5" fill="#fff" stroke="#000" strokeWidth="1.5" />
                    <path d="M4 16a12 12 0 0 0 24 0" fill="#ef4444" opacity="0.95" />
                  </svg>
                </button>
                <button
                  className={`block-btn ${isBlocked ? 'blocked' : ''}`}
                  onClick={() => toggleBlocked(pokemon.id)}
                  title={isBlocked ? 'Desbloquear Pokémon' : 'Bloquear Pokémon'}
                >
                  {isBlocked ? '🔓' : '🔒'}
                </button>
                <span className="pokemon-id">#{pokemon.id.toString().padStart(3, '0')}</span>
                <img src={pokemon.image} alt={pokemon.name} loading="lazy" />
                <h2>{pokemon.name}</h2>
              </article>
            )
          })}
        </section>

        <SidebarFavorites
          pokemons={pokemons}
          favorites={favorites}
          blockedIds={blockedIds}
          onToggle={toggleFavorite}
          onToggleBlocked={toggleBlocked}
        />
      </div>
    </main>
  )
}

export default App
