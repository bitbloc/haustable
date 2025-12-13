import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Mail, Lock, User, Phone, Check } from 'lucide-react'

export default function AuthModal({ isOpen, onClose }) {
    const [view, setView] = useState('login') // 'login' | 'register' | 'success'
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Form Stats
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')

    // Bot Protection (Simple Math)
    const [mathChallenge] = useState(() => {
        const a = Math.floor(Math.random() * 5) + 1
        const b = Math.floor(Math.random() * 5) + 1
        return { a, b, ans: a + b }
    })
    const [mathInput, setMathInput] = useState('')

    if (!isOpen) return null

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            })
            if (error) throw error
        } catch (err) {
            setError(err.message)
        }
    }

    const handleEmailLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) throw error
            onClose() // Success
        } catch (err) {
            if (err.message && (err.message.includes('Email not confirmed') || err.message.includes('Invalid login credentials'))) {
                if (err.message.includes('Email not confirmed')) {
                    setError('Please verify your email address before logging in. Check your inbox (and spam).')
                } else {
                    setError(err.message)
                }
            } else {
                setError(err.message)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        if (parseInt(mathInput) !== mathChallenge.ans) {
            setError(`Incorrect Math Answer: ${mathChallenge.a} + ${mathChallenge.b} is not ${mathInput}`)
            return
        }

        setLoading(true)
        setError(null)
        try {
            // 1. Sign Up
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name } // basic storage in metadata
                }
            })
            if (signUpError) throw signUpError

            // 2. Insert into Profiles (Optional but recommended if you use profiles table)
            if (data.user) {
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    display_name: name,
                    phone_number: phone,
                    role: 'customer'
                })
                if (profileError) console.error("Profile Error:", profileError)
            }

            setView('success')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#1A1A1A] w-full max-w-md rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl animate-fade-in-up">

                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                    <X size={24} />
                </button>

                {view === 'success' ? (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-4">Verify Your Email</h2>
                        <p className="text-gray-400 mb-8 leading-relaxed">
                            We've sent a confirmation link to <br /><span className="text-white font-bold">{email}</span>.<br />
                            Please check your inbox (and spam) to activate your account.
                        </p>
                        <button onClick={() => setView('login')} className="w-full bg-[#DFFF00] text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity">
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-bold text-white mb-2 text-center">
                            {view === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-sm text-gray-400 text-center mb-6">
                            {view === 'login' ? 'Login to continue ordering' : 'Join us to order faster'}
                        </p>

                        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-sm mb-4 text-center border border-red-500/20">{error}</div>}

                        {/* Google Button */}
                        {view === 'login' && (
                            <>
                                <button onClick={handleGoogleLogin} className="w-full bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform mb-6">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                    Continue with Google
                                </button>
                                <div className="relative flex items-center justify-center mb-6">
                                    <div className="h-px bg-white/10 w-full absolute" />
                                    <span className="bg-[#1A1A1A] px-2 relative text-xs text-gray-500">OR EMAIL</span>
                                </div>
                            </>
                        )}

                        {/* Forms */}
                        <form onSubmit={view === 'login' ? handleEmailLogin : handleRegister} className="space-y-4">
                            {view === 'register' && (
                                <>
                                    <div className="relative">
                                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input required type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 text-white outline-none focus:border-[#DFFF00] transition-colors" />
                                    </div>
                                    <div className="relative">
                                        <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input required type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 text-white outline-none focus:border-[#DFFF00] transition-colors" />
                                    </div>
                                </>
                            )}

                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input required type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 text-white outline-none focus:border-[#DFFF00] transition-colors" />
                            </div>

                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 text-white outline-none focus:border-[#DFFF00] transition-colors" />
                            </div>

                            {view === 'register' && (
                                <div className="bg-[#222] p-4 rounded-xl border border-white/5 space-y-2">
                                    <label className="text-xs text-gray-400 block mb-1">Human Check: What is {mathChallenge.a} + {mathChallenge.b} ?</label>
                                    <input required type="number" placeholder="?" value={mathInput} onChange={e => setMathInput(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-center text-white outline-none focus:border-[#DFFF00]" />
                                </div>
                            )}

                            <button disabled={loading} className="w-full bg-[#DFFF00] hover:bg-[#DFFF00]/80 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all shadow-lg shadow-[#DFFF00]/20 mt-2">
                                {loading ? 'Processing...' : (view === 'login' ? 'Login' : 'Create Account')}
                            </button>
                        </form>

                        {/* Toggle View */}
                        <div className="mt-6 text-center text-sm text-gray-400">
                            {view === 'login' ? (
                                <>Don't have an account? <button onClick={() => setView('register')} className="text-[#DFFF00] font-bold hover:underline">Sign up</button></>
                            ) : (
                                <>Already have an account? <button onClick={() => setView('login')} className="text-[#DFFF00] font-bold hover:underline">Log in</button></>
                            )}
                        </div>
                    </>
                )}

            </div>
        </div>
    )
}
