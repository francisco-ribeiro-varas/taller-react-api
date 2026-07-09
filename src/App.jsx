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

const getPokemonImage = (id) => {
  const official = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
  const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`
  return { official, sprite }
}

const getDescription = (speciesData) => {
  const entries = speciesData?.flavor_text_entries || []
  const preferred = entries.find((entry) => entry?.language?.name === 'es')
  const fallback = entries.find((entry) => entry?.language?.name === 'en')
  const anyEntry = entries[0]

  const description = (preferred || fallback || anyEntry)?.flavor_text?.replace(/\f/g, ' ')

  if (description) {
    return description
  }

  if (speciesData?.genera?.length) {
    const genus = speciesData.genera.find((entry) => entry?.language?.name === 'es') || speciesData.genera[0]
    return `Pokémon ${genus?.genus || 'sin descripción disponible'}.`
  }

  return 'Descripción no disponible para este Pokémon.'
}

const getMegaEvolutionInfo = async (speciesData) => {
  const variedades = speciesData?.varieties || []
  const megaVarieties = variedades.filter((variety) => variety?.pokemon?.name?.includes('mega'))

  if (megaVarieties.length === 0) {
    return {
      canMegaEvolve: false,
      requires: 'No',
      typeCombos: []
    }
  }

  const resolvedForms = await Promise.allSettled(
    megaVarieties.map(async (variety) => {
      const response = await fetchWithTimeout(variety.pokemon.url).catch(() => null)
      const data = response ? await response.json().catch(() => null) : null
      const types = data?.types?.map(({ type }) => type.name) || []

      return {
        name: variety.pokemon.name,
        types
      }
    })
  )

  const forms = resolvedForms
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value)

  const typeCombos = [...new Set(forms.map((form) => form.types.join(' / ')).filter(Boolean))]

  return {
    canMegaEvolve: forms.length > 0,
    requires: 'Mega piedra',
    typeCombos
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

        const mappedPokemons = data.results.map((pokemon) => {
          const id = Number(pokemon.url.split('/').filter(Boolean).pop())
          const { official, sprite } = getPokemonImage(id)

          return {
            id,
            name: pokemon.name,
            image: official,
            fallbackImage: sprite,
            gender: 'sin-sexo'
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

  useEffect(() => {
    if (!selectedPokemon) {
      setModalData(null)
      return
    }

    const loadPokemonDetails = async () => {
      try {
        setModalLoading(true)
        const [pokemonResponse, speciesResponse] = await Promise.allSettled([
          fetchWithTimeout(`https://pokeapi.co/api/v2/pokemon/${selectedPokemon.id}`),
          fetchWithTimeout(`https://pokeapi.co/api/v2/pokemon-species/${selectedPokemon.id}`)
        ])

        const pokemonData = pokemonResponse.status === 'fulfilled' ? await pokemonResponse.value.json().catch(() => null) : null
        const speciesData = speciesResponse.status === 'fulfilled' ? await speciesResponse.value.json().catch(() => null) : null
        const description = getDescription(speciesData)

        let evolutionInfo = {
          nextForm: null,
          level: 'No evoluciona',
          needsStone: false,
          stoneName: null
        }

        const megaEvolutionInfo = await getMegaEvolutionInfo(speciesData)

        if (speciesData?.evolution_chain?.url) {
          const evolutionResponse = await fetchWithTimeout(speciesData.evolution_chain.url).catch(() => null)

          if (evolutionResponse?.ok) {
            const evolutionData = await evolutionResponse.json().catch(() => null)
            const currentNode = findEvolutionNode(evolutionData?.chain, selectedPokemon.name)
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

        const modalImage = pokemonData?.sprites?.other?.['official-artwork']?.front_default || pokemonData?.sprites?.front_default || selectedPokemon.image
        const fallbackModalImage = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${selectedPokemon.id}.png`

        setModalData({
          id: pokemonData?.id || selectedPokemon.id,
          name: pokemonData?.name || selectedPokemon.name,
          image: modalImage,
          fallbackImage: fallbackModalImage,
          types: pokemonData?.types?.map(({ type }) => type.name).join(', ') || 'Sin información',
          gender: getGenderLabel(speciesData?.gender_rate),
          description,
          evolution: evolutionInfo,
          megaEvolution: megaEvolutionInfo
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
          },
          megaEvolution: {
            canMegaEvolve: false,
            requires: 'No',
            typeCombos: []
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
        <div className="hero-names" aria-label="Integrantes">
          <span>Diego Lazo</span>
          <span>Alexandra Naranjo</span>
          <span>Francisco Ribeiro</span>
        </div>
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
                <img
                  src={pokemon.image}
                  alt={pokemon.name}
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.src = pokemon.fallbackImage || '/pokeball-placeholder.png'
                  }}
                />
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
                  <img
                    src={modalData.image}
                    alt={modalData.name}
                    onError={(event) => {
                      event.currentTarget.src = modalData.fallbackImage || '/pokeball-placeholder.png'
                    }}
                  />
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
                  <div>
                    <span className="modal-label">Megaevolución</span>
                    <p>{modalData.megaEvolution.canMegaEvolve ? `Sí — ${modalData.megaEvolution.requires}` : 'No'}</p>
                  </div>
                  <div>
                    <span className="modal-label">Tipos de megaevolución</span>
                    <p>{modalData.megaEvolution.typeCombos.length > 0 ? modalData.megaEvolution.typeCombos.join(' · ') : 'No aplica'}</p>
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
