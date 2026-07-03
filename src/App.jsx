import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [pokemons, setPokemons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

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

  const filteredPokemons = pokemons.filter((pokemon) => {
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

      <section className="pokemon-grid">
        {filteredPokemons.map((pokemon) => (
          <article key={pokemon.id} className="pokemon-card">
            <span className="pokemon-id">#{pokemon.id.toString().padStart(3, '0')}</span>
            <img src={pokemon.image} alt={pokemon.name} loading="lazy" />
            <h2>{pokemon.name}</h2>
          </article>
        ))}
      </section>
    </main>
  )
}

export default App
