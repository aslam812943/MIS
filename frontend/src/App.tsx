import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-12 text-center">
        {/* Header Section */}
        <header className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-wider text-indigo-400 uppercase bg-indigo-500/10 rounded-full border border-indigo-500/20">
            Management Information System
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Seamlessly <span className="text-gradient">Manage</span> Your Enterprise
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A powerful, intuitive, and highly scalable MIS designed to streamline operations and enhance decision-making across your organization.
          </p>
        </header>

        {/* Action Section */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <button 
            onClick={() => setCount((count) => count + 1)}
            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/25 flex items-center gap-2"
          >
            Get Started
            <span className="bg-indigo-400/30 px-2 py-0.5 rounded text-sm">{count}</span>
          </button>
          <button className="px-8 py-4 glass hover:bg-white/5 rounded-xl font-semibold transition-all border border-slate-700">
            View Documentation
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
          <FeatureCard 
            title="Real-time Analytics" 
            description="Monitor key performance indicators in real-time with beautiful dashboards."
            icon="📊"
          />
          <FeatureCard 
            title="Role-based Access" 
            description="Securely manage permissions for employees, managers, and administrators."
            icon="🔐"
          />
          <FeatureCard 
            title="Cloud Integration" 
            description="Powered by Supabase for lightning-fast and reliable data management."
            icon="☁️"
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 text-slate-500 text-sm">
        © 2024 MIS Enterprise Solutions. Built with React & Tailwind v4.
      </footer>
    </div>
  )
}

function FeatureCard({ title, description, icon }: { title: string, description: string, icon: string }) {
  return (
    <div className="glass p-8 rounded-2xl text-left transition-all hover:border-indigo-500/30 group">
      <div className="text-3xl mb-4 group-hover:scale-110 transition-transform inline-block">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm">
        {description}
      </p>
    </div>
  )
}

export default App
