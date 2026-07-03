import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [pokemons, setPokemons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <main className="app">
      <header className="hero">
        <p className="eyebrow">Pokedex básica</p>
        <h1>Descubre Pokémon</h1>
        <p className="hero-text">
          Esta página consume la API de Pokémon y muestra un diseño simple con tarjetas e imágenes.
        </p>
      </header>

      {loading && <p className="status">Cargando Pokémon...</p>}
      {error && <p className="status error">{error}</p>}

      <section className="pokemon-grid">
        {pokemons.map((pokemon) => (
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
