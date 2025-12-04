import { useEffect, useRef, useState } from 'react'
import {
  VictorDb,
  chunkerPlugin,
  hfEmbeddingPlugin,
  cosineDistancePlugin,
  hnswIndexPlugin,
  indexedDbProviderPlugin,
} from 'victor-db-ts'

type Result = {
  id: string
  score: number
  text: string
}

const docs = [
  { id: '1', text: 'The Future of Remote Work: Trends to Watch in 2024.' },
  { id: '2', text: 'Sustainable Living: Small Changes That Make a Big Impact.' },
  { id: '3', text: 'The Art of Mindful Cooking: Finding Peace in the Kitchen.' },
  { id: '4', text: 'Digital Minimalism: Reclaiming Your Attention in a Noisy World.' },
  { id: '5', text: 'The Science Behind Morning Routines: Why They Actually Work.' },
  { id: '6', text: 'AI in Everyday Life: How Automation Shapes Our Future.' },
  { id: '7', text: 'Healthy Habits: Small Daily Practices for Long-Term Wellness.' },
  { id: '8', text: 'The Rise of Micro-Learning: Education in Bite-Sized Pieces.' },
  { id: '9', text: 'Eco-Friendly Technology: Innovations That Protect the Planet.' },
  { id: '10', text: 'The Psychology of Decluttering: Why Less Really Is More.' },
  { id: '11', text: 'The Power of Slow Living: Reconnecting With What Matters.' },
  { id: '12', text: 'Quantum Computing 101: What You Need to Know.' },
  { id: '13', text: 'The Benefits of Daily Journaling: A Simple Path to Clarity.' },
  { id: '14', text: 'Minimalist Travel: Packing Light for a Fuller Experience.' },
  { id: '15', text: 'The Future of Renewable Energy: What is Coming Next.' },
  { id: '16', text: 'How to Build Better Focus in a Digital Age.' },
  { id: '17', text: 'Plant-Based Diets: Myths, Facts, and Practical Tips.' },
  { id: '18', text: 'The Evolution of Smartphones: A Look Ahead.' },
  { id: '19', text: 'Finding Creativity Through Solitude: Why Quiet Matters.' },
  { id: '20', text: 'The Truth About Multitasking: Why It Hurts Productivity.' },
  { id: '21', text: 'Home Automation: Creating a Smarter Living Space.' },
  { id: '22', text: 'The Art of Slow Reading: Bringing Back Deep Focus.' },
  { id: '23', text: 'Why Walking Is the Most Underrated Exercise.' },
  { id: '24', text: 'Understanding Biohacking: Optimizing Your Body and Mind.' },
  { id: '25', text: 'The Future of Social Media: More Privacy, Less Noise?' },
  { id: '26', text: 'Gardening for Mental Health: Growing Calm and Joy.' },
  { id: '27', text: 'The Rise of Electric Vehicles: What to Expect in 2025.' },
  { id: '28', text: 'The Importance of Digital Detoxes for Mental Clarity.' },
  { id: '29', text: 'How Music Affects Productivity and Mood.' },
  { id: '30', text: 'The Science of Goal Setting: Making Habits Stick.' },
  { id: '31', text: 'Understanding Carbon Footprints: What You Can Do.' },
  { id: '32', text: 'How to Build a Capsule Wardrobe: A Minimalist Approach.' },
  { id: '33', text: 'The Future of Space Exploration: What Lies Ahead.' },
  { id: '34', text: 'Nature Therapy: Why Spending Time Outdoors Heals.' },
  { id: '35', text: 'The Benefits of Intermittent Fasting: What Research Says.' },
  { id: '36', text: 'Digital Wellbeing: Setting Healthy Tech Boundaries.' },
  { id: '37', text: 'The Rise of No-Code Tools: Building Without Programming.' },
  { id: '38', text: 'How Sleep Affects Creativity and Performance.' },
  { id: '39', text: 'The Art of Mindful Eating: Savoring Every Bite.' },
  { id: '40', text: 'Future Cities: Designing Smarter Urban Spaces.' },
  { id: '41', text: 'The Neuroscience of Learning: How to Study Smarter.' },
  { id: '42', text: 'Sustainable Fashion: How to Shop More Responsibly.' },
  { id: '43', text: 'AI-Powered Healthcare: Transforming Patient Outcomes.' },
  { id: '44', text: 'The Joy of Simple Hobbies: Rediscovering Play.' },
  { id: '45', text: 'The Hidden Impact of Microplastics on Our Health.' },
  { id: '46', text: 'Budgeting for Beginners: Taking Control of Your Money.' },
  { id: '47', text: 'The Value of Solitude in a Hyperconnected World.' },
  { id: '48', text: 'How VR Is Changing the Way We Work and Learn.' },
  { id: '49', text: 'The Benefits of Drinking More Water Daily.' },
  { id: '50', text: 'Cognitive Load: Why Your Brain Feels Overwhelmed.' },
  { id: '51', text: 'Green Tech Startups: Innovators Shaping the Planet.' },
  { id: '52', text: 'How to Build a More Intentional Morning Routine.' },
  { id: '53', text: 'The Future of Education: Blended and Remote Learning.' },
  { id: '54', text: 'Minimalist Interior Design: Less Clutter, More Peace.' },
  { id: '55', text: 'Cold Exposure Therapy: Benefits and Precautions.' },
  { id: '56', text: 'Robotics in Daily Life: What is Already Here.' },
  { id: '57', text: 'The Power of Silence: Resetting Your Mind.' },
  { id: '58', text: 'The Rise of Digital Nomads: A New Work Culture.' },
  { id: '59', text: 'How to Improve Gut Health Naturally.' },
  { id: '60', text: 'The Psychology of Motivation: How to Stay Driven.' },
  { id: '61', text: 'Emotional Intelligence: Why EQ Matters More Than IQ.' },
  { id: '62', text: 'The Future of Batteries: Faster Charging Ahead.' },
  { id: '63', text: 'The Impact of AI on Creative Industries.' },
  { id: '64', text: 'Mindful Productivity: Getting More Done with Less Stress.' },
  { id: '65', text: 'Healthy Snacking: Better Choices for Busy Days.' },
  { id: '66', text: 'The Role of Augmented Reality in Retail Experiences.' },
  { id: '67', text: 'The Science of Happiness: Daily Practices That Work.' },
  { id: '68', text: 'The Future of Workspaces: Hybrid and Flexible Designs.' },
  { id: '69', text: 'How to Cultivate Gratitude in Everyday Life.' },
  { id: '70', text: 'The Environmental Impact of Fast Fashion.' },
  { id: '71', text: 'The Rise of Smart Homes: Convenience and Security.' },
  { id: '72', text: 'The Benefits of Learning a Second Language.' },
  { id: '73', text: 'The Future of Food: Lab-Grown and Sustainable Options.' },
  { id: '74', text: 'The Power of Visualization in Achieving Goals.' },
  { id: '75', text: 'How to Build Resilience in Challenging Times.' },
];

export default function App() {
  const [status, setStatus] = useState('Initializing...')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const db = useRef<VictorDb | null>(null)
  const debounceTimer = useRef<NodeJS.Timeout>()

  useEffect(() => {
    let mounted = true

    async function initDb() {
      const instance = new VictorDb()
      
      await instance.use(chunkerPlugin())
      await instance.use(hfEmbeddingPlugin())
      await instance.use(cosineDistancePlugin())
      await instance.use(hnswIndexPlugin())
      await instance.use(indexedDbProviderPlugin())

      instance.configure({
        chunker: 'hf-token-chunker',
        embeddingModel: 'hf-embedding',
        distanceMetric: 'cosine',
        indexStrategy: 'index-hnsw',
        persistenceProvider: 'indexeddb-provider',
      })

      await instance.load()

      for (const doc of docs) {
        await instance.addText(doc.id, doc.text)
      }

      if (mounted) {
        db.current = instance
        setStatus('Ready')
      }
    }

    initDb().catch(err => {
      console.error(err)
      if (mounted) setStatus('Error: ' + err.message)
    })

    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!db.current || !query.trim()) {
      setResults([])
      return
    }

    clearTimeout(debounceTimer.current)
    
    debounceTimer.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const hits = await db.current!.search(query, 3)
        setResults(hits.map(h => ({
          id: h.id,
          score: h.score,
          text: h.payload.text,
        })))
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 500)
  }, [query])

  return (
    <main className="app">
      <h1>VictorDb Test App</h1>
      <p className="status">{status}</p>

      <div className="search-bar">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask anything…"
        />
      </div>

      <section className="results">
        {isSearching ? (
          <p className="muted">Searching...</p>
        ) : results.length === 0 ? (
          <p className="muted">{query.trim() ? 'No results found.' : 'Start typing to search...'}</p>
        ) : (
          results.map(r => (
            <article key={r.id} className="result">
              <header>
                <span className="pill">Score: {r.score.toFixed(3)}</span>
                <span className="pill">ID: {r.id}</span>
              </header>
              <p>{r.text}</p>
            </article>
          ))
        )}
      </section>
    </main>
  )
}