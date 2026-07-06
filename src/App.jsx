import { useEffect, useState } from 'react'
import './App.css'
import SidebarFavorites from './SidebarFavorites'

const findEvolutionNode = (node, pokemonName) => {
  if (!node) return null

  if (node.species?.name === pokemonName) {
    return node
  }

  for (const child of node.evolves_to || []) {
    const found = findEvolutionNode(child, pokemonName)
    if (found) {
      return found
    }
  }

  return null
}

const getGenderLabel = (genderRate) => {
  if (genderRate === -1) return 'Sin sexo'
  if (genderRate === 0) return 'Masculino'
  if (genderRate === 8) return 'Femenino'
  if (genderRate === 4) return 'Masculino / Femenino'
  if (genderRate < 4) return 'Masculino'
  return 'Femenino'
}

const getGenderFromSpecies = (genderRate) => {
  if (genderRate === -1) return 'sin-sexo'
  if (genderRate === 0) return 'masculino'
  if (genderRate === 8) return 'femenino'
  if (genderRate === 4) return 'ambos'
  if (genderRate < 4) return 'masculino'
  return 'femenino'
}

const fetchWithTimeout = async (url, timeout = 8000) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response
  } finally {
    window.clearTimeout(timer)
  }
}

function App() {
  const [pokemons, setPokemons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [genderFilter, setGenderFilter] = useState('todos')
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
  const [selectedPokemon, setSelectedPokemon] = useState(null)
  const [modalData, setModalData] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    const fetchPokemons = async () => {
      try {
        setLoading(true)
        const response = await fetchWithTimeout('https://pokeapi.co/api/v2/pokemon?limit=1500')
        const data = await response.json()

        const mappedPokemons = await Promise.allSettled(
          data.results.map(async (pokemon) => {
            const id = Number(pokemon.url.split('/').filter(Boolean).pop())
            const speciesResponse = await fetchWithTimeout(`https://pokeapi.co/api/v2/pokemon-species/${id}`).catch(() => null)
            const speciesData = speciesResponse ? await speciesResponse.json().catch(() => null) : null

            return {
              id,
              name: pokemon.name,
              image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
              gender: getGenderFromSpecies(speciesData?.gender_rate)
            }
          })
        )

        const resolvedPokemons = mappedPokemons.map((result) =>
          result.status === 'fulfilled'
            ? result.value
            : {
                id: 0,
                name: 'Pokémon sin cargar',
                image: '',
                gender: 'sin-sexo'
              }
        )

        setPokemons(resolvedPokemons.filter((pokemon) => pokemon.id !== 0))
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

  useEffect(() => {
    if (!selectedPokemon) {
      setModalData(null)
      return
    }

    const loadPokemonDetails = async () => {
      try {
        setModalLoading(true)
        const [pokemonResponse, speciesResponse] = await Promise.all([
          fetch(`https://pokeapi.co/api/v2/pokemon/${selectedPokemon.id}`),
          fetch(`https://pokeapi.co/api/v2/pokemon-species/${selectedPokemon.id}`)
        ])

        if (!pokemonResponse.ok || !speciesResponse.ok) {
          throw new Error('No se pudo cargar la información del Pokémon')
        }

        const pokemonData = await pokemonResponse.json()
        const speciesData = await speciesResponse.json()
        const descriptionEntry =
          speciesData.flavor_text_entries.find((entry) => entry.language.name === 'es') ||
          speciesData.flavor_text_entries.find((entry) => entry.language.name === 'en') ||
          speciesData.flavor_text_entries[0]

        let evolutionInfo = {
          nextForm: null,
          level: 'No evoluciona',
          needsStone: false,
          stoneName: null
        }

        if (speciesData.evolution_chain?.url) {
          const evolutionResponse = await fetch(speciesData.evolution_chain.url)

          if (evolutionResponse.ok) {
            const evolutionData = await evolutionResponse.json()
            const currentNode = findEvolutionNode(evolutionData.chain, selectedPokemon.name)
            const nextEvolution = currentNode?.evolves_to?.[0]

            if (nextEvolution) {
              const firstDetail = nextEvolution.evolution_details?.[0]
              const nextName = nextEvolution.species?.name || 'Desconocido'
              const level = firstDetail?.min_level ?? null
              const itemName = firstDetail?.item?.name ?? null

              evolutionInfo = {
                nextForm: nextName,
                level: level !== null ? `Nivel ${level}` : 'Desconocido',
                needsStone: Boolean(itemName),
                stoneName: itemName ? itemName.replace(/-/g, ' ') : null
              }
            }
          }
        }

        setModalData({
          id: pokemonData.id,
          name: pokemonData.name,
          image: pokemonData.sprites?.other?.['official-artwork']?.front_default || pokemonData.sprites?.front_default,
          types: pokemonData.types.map(({ type }) => type.name).join(', '),
          gender: getGenderLabel(speciesData.gender_rate),
          description: descriptionEntry?.flavor_text?.replace(/\f/g, ' ') || 'Sin descripción disponible.',
          evolution: evolutionInfo
        })
      } catch (err) {
        setModalData({
          id: selectedPokemon.id,
          name: selectedPokemon.name,
          image: selectedPokemon.image,
          types: 'Sin información',
          gender: 'No disponible',
          description: 'No se pudo cargar la información.',
          evolution: {
            nextForm: null,
            level: 'No evoluciona',
            needsStone: false,
            stoneName: null
          }
        })
      } finally {
        setModalLoading(false)
      }
    }

    loadPokemonDetails()
  }, [selectedPokemon])

  const filteredPokemons = pokemons.filter((pokemon) => {
    if (blockedIds.includes(pokemon.id)) {
      return false
    }

    const normalizedSearch = searchTerm.trim().toLowerCase()
    const matchesSearch = !normalizedSearch || pokemon.name.toLowerCase().includes(normalizedSearch) || pokemon.id.toString().includes(normalizedSearch)

    if (!matchesSearch) {
      return false
    }

    if (genderFilter === 'todos') {
      return true
    }

    return pokemon.gender === genderFilter
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

        <label className="search-field filter-field" htmlFor="gender-filter">
          <span className="search-label">Filtrar por sexo</span>
          <select id="gender-filter" value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="ambos">Ambos</option>
            <option value="sin-sexo">Sin sexo</option>
          </select>
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
              <article
                key={pokemon.id}
                className="pokemon-card"
                onClick={() => setSelectedPokemon(pokemon)}
              >
                <button
                  type="button"
                  className={`fav-btn ${favorites.includes(pokemon.id) ? 'fav-active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleFavorite(pokemon.id)
                  }}
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
                  type="button"
                  className={`block-btn ${isBlocked ? 'blocked' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleBlocked(pokemon.id)
                  }}
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

      {selectedPokemon && (
        <div className="modal-overlay" role="presentation" onClick={() => setSelectedPokemon(null)}>
          <div className="pokemon-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelectedPokemon(null)} aria-label="Cerrar detalle">
              ✕
            </button>

            {modalLoading && <p className="status">Cargando información...</p>}

            {!modalLoading && modalData && (
              <>
                <div className="modal-header">
                  <img src={modalData.image} alt={modalData.name} />
                  <div>
                    <p className="modal-id">#{modalData.id.toString().padStart(3, '0')}</p>
                    <h3>{modalData.name}</h3>
                    <p className="modal-types">{modalData.types}</p>
                  </div>
                </div>

                <div className="modal-grid">
                  <div>
                    <span className="modal-label">Sexo</span>
                    <p>{modalData.gender}</p>
                  </div>
                  <div>
                    <span className="modal-label">Tipos</span>
                    <p>{modalData.types}</p>
                  </div>
                  <div>
                    <span className="modal-label">Evoluciona</span>
                    <p>{modalData.evolution.level}</p>
                  </div>
                  <div>
                    <span className="modal-label">Piedra para evolucionar</span>
                    <p>{modalData.evolution.needsStone ? `Sí — ${modalData.evolution.stoneName}` : 'No'}</p>
                  </div>
                </div>

                <div className="modal-description">
                  <span className="modal-label">Descripción</span>
                  <p>{modalData.description}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default App
