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
                {/* pure black gradient background */}
                <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-neutral-900" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.04),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.02),transparent_40%)]" />

                {/* subtle grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />

                <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-24 sm:pt-24 sm:pb-36 text-center">
                    {/* badge */}
                    <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10
            rounded-full px-5 py-2 mb-10 text-sm text-white/60">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        Live rides happening near you
                    </div>

                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-6">
                        Share your ride,
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-300 to-neutral-500">
                            split the cost
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        LiftGo connects drivers with empty seats to passengers headed the same way.
                        Save money, reduce traffic, and make every journey better.
                    </p>

                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        {loggedIn ? (
                            <Link href="/liveboard">
                                <Button size="lg" className="bg-white text-black hover:bg-neutral-100
                  px-8 py-6 text-base rounded-xl shadow-lg shadow-white/10 transition-all
                  hover:shadow-white/20 hover:-translate-y-0.5 font-semibold">
                                    Go to Live Board →
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link href="/auth/register">
                                    <Button size="lg" className="bg-white text-black hover:bg-neutral-100
                    px-8 py-6 text-base rounded-xl shadow-lg shadow-white/10 transition-all
                    hover:shadow-white/20 hover:-translate-y-0.5 font-semibold">
                                        Get Started — It&apos;s Free
                                    </Button>
                                </Link>
                                <Link href="/auth/login">
                                    <Button size="lg" variant="outline" className="border-white/20 text-white
                    hover:bg-white/5 px-8 py-6 text-base rounded-xl transition-all
                    hover:-translate-y-0.5">
                                        Log In
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* stats row */}
                    <div className="flex items-center justify-center gap-6 sm:gap-12 mt-14 sm:mt-20 text-neutral-500 text-sm flex-wrap">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">100%</p>
                            <p>Free to use</p>
                        </div>
                        <div className="w-px h-10 bg-neutral-800" />
                        <div className="text-center">
                            <p className="text-2xl font-bold text-white">India</p>
                            <p>Wide coverage</p>
                        </div>
                        <div className="w-px h-10 bg-neutral-800" />
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
                        <p className="text-neutral-400 font-semibold text-sm uppercase tracking-wider mb-3">
                            Simple & Quick
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900">
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
                            },
                            {
                                step: '02',
                                icon: '🔍',
                                title: 'Find matches',
                                desc: 'Instantly see drivers and riders going your way. Filter by time, price, and rating.',
                            },
                            {
                                step: '03',
                                icon: '🚗',
                                title: 'Book & ride',
                                desc: 'Reserve your seat with one click. Rate your experience and build your reputation.',
                            },
                        ].map((item) => (
                            <div key={item.step}
                                className="relative group bg-white border border-neutral-100 rounded-2xl p-8
                  hover:shadow-xl hover:shadow-neutral-200/50 transition-all duration-300
                  hover:-translate-y-1"
                            >
                                <div className="w-14 h-14 rounded-xl bg-neutral-900
                  flex items-center justify-center text-2xl mb-6
                  group-hover:scale-110 transition-transform">
                                    {item.icon}
                                </div>
                                <span className="text-xs font-bold text-neutral-300 uppercase tracking-widest">
                                    Step {item.step}
                                </span>
                                <h3 className="text-xl font-bold text-neutral-900 mt-2 mb-3">{item.title}</h3>
                                <p className="text-neutral-500 leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Features Grid ─── */}
            <section className="py-24 bg-neutral-50">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="text-center mb-16">
                        <p className="text-neutral-400 font-semibold text-sm uppercase tracking-wider mb-3">
                            Built for India
                        </p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900">
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
                                className="bg-white border border-neutral-100 rounded-2xl p-6
                  hover:shadow-lg hover:shadow-neutral-100 transition-all duration-300
                  hover:border-neutral-200 group"
                            >
                                <div className="w-12 h-12 rounded-lg bg-neutral-900 flex items-center justify-center
                  text-xl mb-4 group-hover:scale-105 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="font-bold text-neutral-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-neutral-500 leading-relaxed">{feature.desc}</p>
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
                        <div className="relative overflow-hidden rounded-2xl bg-black p-6 sm:p-10 text-white">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/3 rounded-full blur-2xl" />
                            <span className="text-4xl mb-6 block">🚗</span>
                            <h3 className="text-2xl font-bold mb-4">For Drivers</h3>
                            <ul className="space-y-3 text-neutral-400 mb-8">
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    Earn money from empty seats on your daily commute
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    Set your own price and schedule
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    Recurring ride posting — set it and forget it
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    Approve or decline booking requests
                                </li>
                            </ul>
                            <Link href="/auth/register">
                                <Button className="bg-white text-black hover:bg-neutral-100 rounded-lg font-semibold">
                                    Start offering rides
                                </Button>
                            </Link>
                        </div>

                        {/* Riders */}
                        <div className="relative overflow-hidden rounded-2xl bg-neutral-900 p-6 sm:p-10 text-white">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/3 rounded-full blur-2xl" />
                            <span className="text-4xl mb-6 block">🧳</span>
                            <h3 className="text-2xl font-bold mb-4">For Riders</h3>
                            <ul className="space-y-3 text-neutral-400 mb-8">
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    Find affordable rides going your way
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    Post a &quot;seek&quot; and let drivers find you
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    See driver ratings before booking
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-white mt-0.5">✓</span>
                                    Book seats with a single click
                                </li>
                            </ul>
                            <Link href="/auth/register">
                                <Button className="bg-white text-black hover:bg-neutral-100 rounded-lg font-semibold">
                                    Find a ride now
                                </Button>
                            </Link>
                        </div>

                    </div>
                </div>
            </section>

            {/* ─── CTA Section ─── */}
            <section className="py-24 bg-black relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03),transparent_70%)]" />
                {/* decorative elements */}
                <div className="absolute top-10 left-10 w-72 h-72 bg-white/[0.02] rounded-full blur-3xl" />
                <div className="absolute bottom-10 right-10 w-96 h-96 bg-white/[0.015] rounded-full blur-3xl" />

                <div className="relative max-w-3xl mx-auto px-4 text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                        Ready to share the road?
                    </h2>
                    <p className="text-neutral-400 text-lg mb-10 leading-relaxed">
                        Join LiftGo today and start saving on your daily commute.
                        Every shared ride means one less car on the road.
                    </p>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                        <Link href="/auth/register">
                            <Button size="lg" className="bg-white text-black hover:bg-neutral-100
                px-8 py-6 text-base rounded-xl shadow-lg transition-all
                hover:-translate-y-0.5 hover:shadow-xl font-semibold">
                                Create Free Account
                            </Button>
                        </Link>
                        <Link href="/auth/login">
                            <Button size="lg" variant="outline" className="border-white/20 text-white
                hover:bg-white/5 px-8 py-6 text-base rounded-xl transition-all
                hover:-translate-y-0.5">
                                Log In
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ─── Footer ─── */}
            <footer className="bg-neutral-950 text-neutral-500 py-12">
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
                    <div className="mt-8 pt-8 border-t border-neutral-800 text-center text-xs text-neutral-600">
                        © {new Date().getFullYear()} LiftGo. Built with ❤️ for India.
                    </div>
                </div>
            </footer>

        </div>
    )
}
