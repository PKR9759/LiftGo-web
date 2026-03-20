'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { isLoggedIn } from '@/lib/auth'

export default function LandingPage() {
    const [loggedIn, setLoggedIn] = useState(false)

    useEffect(() => {
        setLoggedIn(isLoggedIn())
    }, [])

    return (
        <div className="min-h-screen bg-white">

            {/* ─── Hero Section ─── */}
            <section className="relative overflow-hidden">
                {/* gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(16,185,129,0.1),transparent_50%)]" />

                <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-32 text-center">
                    {/* badge */}
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 
            rounded-full px-4 py-1.5 mb-8 text-sm text-white/80">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live rides happening near you
                    </div>

                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-tight mb-6">
                        Share your ride,
                        <br />
                        <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            split the cost
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                        LiftGo connects drivers with empty seats to passengers headed the same way.
                        Save money, reduce traffic, and make every journey better.
                    </p>

                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        {loggedIn ? (
                            <Link href="/liveboard">
                                <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white
                  px-8 py-6 text-base rounded-xl shadow-lg shadow-emerald-500/25 transition-all
                  hover:shadow-emerald-500/40 hover:-translate-y-0.5">
                                    Go to Live Board →
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link href="/auth/register">
                                    <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600 text-white
                    px-8 py-6 text-base rounded-xl shadow-lg shadow-emerald-500/25 transition-all
                    hover:shadow-emerald-500/40 hover:-translate-y-0.5">
                                        Get Started — It&apos;s Free
                                    </Button>
                                </Link>
                                <Link href="/auth/login">
                                    <Button size="lg" variant="outline" className="border-white/30 text-white
                    hover:bg-white/10 px-8 py-6 text-base rounded-xl transition-all
                    hover:-translate-y-0.5">
                                        Log In
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* stats row */}
                    <div className="flex items-center justify-center gap-10 mt-16 text-white/70 text-sm">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">100%</p>
                            <p>Free to use</p>
                        </div>
                        <div className="w-px h-10 bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">India</p>
                            <p>Wide coverage</p>
                        </div>
                        <div className="w-px h-10 bg-white/20" />
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">Real-time</p>
                            <p>Live matching</p>
                        </div>
                    </div>
                </div>

                {/* wave divider */}
                <div className="absolute bottom-0 left-0 right-0">
                    <svg viewBox="0 0 1440 120" fill="none" className="w-full">
                        <path d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,80 1440,60 L1440,120 L0,120 Z"
                            fill="white" />
                    </svg>
                </div>
            </section>

            {/* ─── How It Works ─── */}
            <section className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <p className="text-emerald-600 font-semibold text-sm uppercase tracking-wider mb-3">
                            Simple & Quick
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                            How LiftGo works
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01',
                                icon: '📍',
                                title: 'Set your route',
                                desc: 'Drop pins on the map for your pickup and destination. We use Ola Maps for precise Indian locations.',
                                color: 'from-emerald-500 to-teal-500',
                            },
                            {
                                step: '02',
                                icon: '🔍',
                                title: 'Find matches',
                                desc: 'Instantly see drivers and riders going your way. Filter by time, price, and rating.',
                                color: 'from-blue-500 to-indigo-500',
                            },
                            {
                                step: '03',
                                icon: '🚗',
                                title: 'Book & ride',
                                desc: 'Reserve your seat with one click. Rate your experience and build your reputation.',
                                color: 'from-violet-500 to-purple-500',
                            },
                        ].map((item) => (
                            <div key={item.step}
                                className="relative group bg-white border border-slate-100 rounded-2xl p-8
                  hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300
                  hover:-translate-y-1"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.color}
                  flex items-center justify-center text-2xl mb-6 shadow-lg
                  group-hover:scale-110 transition-transform`}>
                                    {item.icon}
                                </div>
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                                    Step {item.step}
                                </span>
                                <h3 className="text-xl font-bold text-slate-900 mt-2 mb-3">{item.title}</h3>
                                <p className="text-slate-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Features Grid ─── */}
            <section className="py-24 bg-slate-50">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <p className="text-emerald-600 font-semibold text-sm uppercase tracking-wider mb-3">
                            Built for India
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                            Everything you need, nothing you don&apos;t
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            {
                                icon: '🗺️',
                                title: 'Ola Maps Integration',
                                desc: 'Accurate Indian maps with autocomplete, reverse geocoding, and route plotting powered by Ola Maps.',
                            },
                            {
                                icon: '🔄',
                                title: 'Recurring Rides',
                                desc: 'Set up your daily commute once. LiftGo automatically reposts your ride on selected days.',
                            },
                            {
                                icon: '⭐',
                                title: 'Rating & Reviews',
                                desc: 'Build trust with community reviews. See driver ratings before booking.',
                            },
                            {
                                icon: '📱',
                                title: 'Real-time Live Board',
                                desc: 'See all active rides and seekers on an interactive map. Find matches instantly.',
                            },
                            {
                                icon: '💰',
                                title: 'Flexible Pricing',
                                desc: 'Drivers set their own price per seat. Find rides that fit your budget or offer them for free.',
                            },
                            {
                                icon: '🔒',
                                title: 'Secure & Private',
                                desc: 'JWT-based authentication keeps your data safe. Share only what you want.',
                            },
                        ].map((feature) => (
                            <div key={feature.title}
                                className="bg-white border border-slate-100 rounded-2xl p-6
                  hover:shadow-lg hover:shadow-slate-100 transition-all duration-300
                  hover:border-slate-200"
                            >
                                <span className="text-3xl mb-4 block">{feature.icon}</span>
                                <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── For Drivers & Riders ─── */}
            <section className="py-24 bg-white">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                        {/* Drivers */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-10 text-white">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
                            <span className="text-4xl mb-6 block">🚗</span>
                            <h3 className="text-2xl font-bold mb-4">For Drivers</h3>
                            <ul className="space-y-3 text-slate-300 mb-8">
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-0.5">✓</span>
                                    Earn money from empty seats on your daily commute
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-0.5">✓</span>
                                    Set your own price and schedule
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-0.5">✓</span>
                                    Recurring ride posting — set it and forget it
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-emerald-400 mt-0.5">✓</span>
                                    Approve or decline booking requests
                                </li>
                            </ul>
                            <Link href="/auth/register">
                                <Button className="bg-emerald-500 hover:bg-emerald-600 rounded-lg">
                                    Start offering rides
                                </Button>
                            </Link>
                        </div>

                        {/* Riders */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-white">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-400/10 rounded-full blur-3xl" />
                            <span className="text-4xl mb-6 block">🧳</span>
                            <h3 className="text-2xl font-bold mb-4">For Riders</h3>
                            <ul className="space-y-3 text-indigo-200 mb-8">
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-300 mt-0.5">✓</span>
                                    Find affordable rides going your way
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-300 mt-0.5">✓</span>
                                    Post a &quot;seek&quot; and let drivers find you
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-300 mt-0.5">✓</span>
                                    See driver ratings before booking
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-300 mt-0.5">✓</span>
                                    Book seats with a single click
                                </li>
                            </ul>
                            <Link href="/auth/register">
                                <Button className="bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg">
                                    Find a ride now
                                </Button>
                            </Link>
                        </div>

                    </div>
                </div>
            </section>

            {/* ─── CTA Section ─── */}
            <section className="py-24 bg-gradient-to-br from-emerald-600 to-teal-700 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_70%)]" />
                <div className="relative max-w-3xl mx-auto px-4 text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                        Ready to share the road?
                    </h2>
                    <p className="text-emerald-100 text-lg mb-10 leading-relaxed">
                        Join LiftGo today and start saving on your daily commute.
                        Every shared ride means one less car on the road.
                    </p>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        <Link href="/auth/register">
                            <Button size="lg" className="bg-white text-emerald-700 hover:bg-emerald-50
                px-8 py-6 text-base rounded-xl shadow-lg transition-all
                hover:-translate-y-0.5 hover:shadow-xl">
                                Create Free Account
                            </Button>
                        </Link>
                        <Link href="/auth/login">
                            <Button size="lg" variant="outline" className="border-white/40 text-white
                hover:bg-white/10 px-8 py-6 text-base rounded-xl transition-all
                hover:-translate-y-0.5">
                                Log In
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="bg-slate-900 text-slate-400 py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-white">LiftGo</span>
                            <span className="text-sm">— Share rides, save money</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <Link href="/auth/login" className="hover:text-white transition-colors">Log In</Link>
                            <Link href="/auth/register" className="hover:text-white transition-colors">Sign Up</Link>
                        </div>
                    </div>
                    <div className="mt-8 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
                        © {new Date().getFullYear()} LiftGo. Built with ❤️ for India.
                    </div>
                </div>
            </footer>

        </div>
    )
}
