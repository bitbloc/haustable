import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Mail, Lock, User, Phone, Check, Eye, EyeOff, Calendar, Smartphone, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function AuthModal({ isOpen, onClose }) {
    const { t } = useLanguage()
    const [view, setView] = useState('login') // 'login' | 'register-step-1' ...
    const [step, setStep] = useState(1) // 1=Creds, 2=Profile, 3=Contact, 4=Confirm
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    // Form Data
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    // Profile Data
    const [name, setName] = useState('')
    const [nickname, setNickname] = useState('') // New
    const [intro, setIntro] = useState('') // Just display filler
    const [birthDay, setBirthDay] = useState('') // New
    const [birthMonth, setBirthMonth] = useState('') // New
    const [gender, setGender] = useState('') // 'Male', 'Female', 'Not Specified'

    // Contact Data
    const [phone, setPhone] = useState('')
    const [lineUid, setLineUid] = useState('') // New
    const [pdpaConsent, setPdpaConsent] = useState(false) // New

    // Bot Protection
    const [botChallenge, setBotChallenge] = useState({ word: '' })
    const [botInput, setBotInput] = useState('')

    const challengeWords = ['HAUS', 'TABLE', 'MENU', 'CHEF', 'FRESH', 'FOOD', 'YUMMY']

    useEffect(() => {
        if (isOpen) {
            // Reset state or initialize
            const randomWord = challengeWords[Math.floor(Math.random() * challengeWords.length)]
            setBotChallenge({ word: randomWord })
            checkLineSync()
        }
    }, [isOpen])

    // "Line Sync" / Social Pre-fill
    // Check if user is logged in but might be in extraction flow (rare in this modal context, but good for "Complete Profile")
    // Or just check if we have metadata from a previous attempt? 
    // For now, let's assume if they registered via Social, Supabase handles it. 
    // If we want to pre-fill from Google/Line metadata after they click "Register" (if we supported hybrid), we'd need that data.
    // Here we'll implement logic: If user is logged in via OAuth (e.g. just redirected back), we might want to auto-open this modal?
    // That needs to be in App.jsx. 
    // INSIDE Modal: We'll mainly focus on the "Progressive Reveal" UI.
    const checkLineSync = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && view.startsWith('register')) {
            if (user.user_metadata?.full_name) setName(user.user_metadata.full_name)
            if (user.user_metadata?.picture) { /* could show avatar */ }
            // Line UID might be in user.identities
        }
    }

    if (!isOpen) return null

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            })
            if (error) throw error
        } catch (err) { setError(err.message) }
    }

    const handleLineLogin = async () => {
        // LINE Login implementation if provider is enabled
        // Ensuring "Line Sync" works by using the provider
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'line',
                options: { redirectTo: window.location.origin }
            })
            if (error) throw error
        } catch (err) { setError(err.message) }
    }

    const handleEmailLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) throw error
            onClose()
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const validateStep = () => {
        setError(null)
        if (step === 1) {
            if (!email || !password || !confirmPassword) return setError("Please fill all fields")
            if (password !== confirmPassword) return setError("Passwords do not match")
            if (botInput.toUpperCase() !== botChallenge.word) return setError("Bot Check Failed: Incorrect Word")
        }
        if (step === 2) {
            if (!name) return setError("Name is required")
            // Nickname, Birthday, Gender optional but recommended
        }
        if (step === 3) {
            if (!phone) return setError("Phone is required")
        }
        return true
    }

    const nextStep = () => {
        if (validateStep() === true) setStep(s => s + 1)
    }

    const handleFinalRegister = async () => {
        if (!pdpaConsent) return setError("Please accept the Terms & Privacy Policy")
        setLoading(true)

        try {
            // 1. SignUp
            const { data, error: signUpError } = await supabase.auth.signUp({
                email, password,
                options: { data: { full_name: name } }
            })
            if (signUpError) throw signUpError

            // 2. Profile
            if (data.user) {
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    display_name: name,
                    nickname: nickname,
                    phone_number: phone,
                    birth_day: birthDay ? parseInt(birthDay) : null,
                    birth_month: birthMonth ? parseInt(birthMonth) : null,
                    gender: gender,
                    line_uid: lineUid,
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

    const slideVariants = {
        enter: (dir) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir < 0 ? 50 : -50, opacity: 0 }),
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[#1A1A1A] w-full max-w-md rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden flex flex-col min-h-[400px]">

                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white z-20">
                    <X size={24} />
                </button>

                {/* View: Success */}
                {view === 'success' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in-up">
                        <div className="w-20 h-20 bg-[#DFFF00]/20 text-[#DFFF00] rounded-full flex items-center justify-center mb-6">
                            <Check size={40} />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">{t('accountReady') || "Success!"}</h2>
                        <button onClick={() => { setView('login'); setStep(1); }} className="mt-8 text-[#DFFF00] font-bold hover:underline">Go to Login</button>
                    </div>
                )}

                {/* View: Login */}
                {view === 'login' && (
                    <div className="animate-fade-in-up">
                        <h2 className="text-2xl font-bold text-white mb-6 text-center">{t('welcomeBack') || "Welcome Back"}</h2>
                        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-sm mb-4 text-center">{error}</div>}

                        <button onClick={handleGoogleLogin} className="w-full bg-white text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform mb-4">
                            {/* Google Icon */}
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                            Continue with Google
                        </button>
                        {/* OPTIONAL: LINE Login Button if configured */}
                        {/* <button onClick={handleLineLogin} className="w-full bg-[#06C755] text-white py-3 rounded-xl font-bold ... " >Line Login</button> */}

                        <div className="relative flex items-center justify-center my-6">
                            <div className="h-px bg-white/10 w-full absolute" />
                            <span className="bg-[#1A1A1A] px-2 relative text-xs text-gray-500">OR EMAIL</span>
                        </div>

                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#DFFF00] outline-none" required />
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-[#111] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#DFFF00] outline-none"
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <button disabled={loading} className="w-full bg-[#DFFF00] text-black font-bold py-3 rounded-xl hover:opacity-90">{loading ? '...' : 'Login'}</button>
                        </form>

                        <div className="mt-6 text-center">
                            <button onClick={() => setView('register')} className="text-gray-400 text-sm hover:text-white">New here? <span className="text-[#DFFF00] font-bold">Create Account</span></button>
                        </div>
                    </div>
                )}

                {/* View: Register Wizard */}
                {view === 'register' && (
                    <div className="flex flex-col h-full">
                        {/* Header & Steps */}
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-4">
                                <button onClick={() => step === 1 ? setView('login') : setStep(s => s - 1)} className="p-1 hover:bg-white/10 rounded-full"><ArrowLeft size={20} className="text-gray-400" /></button>
                                <h2 className="text-xl font-bold text-white">
                                    {step === 1 && "Create Account"}
                                    {step === 2 && "About You"}
                                    {step === 3 && "Contact Info"}
                                    {step === 4 && "Consent"}
                                </h2>
                            </div>
                            {/* Progress Bar */}
                            <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                                <motion.div className="h-full bg-[#DFFF00]" initial={{ width: 0 }} animate={{ width: `${(step / 4) * 100}%` }} />
                            </div>
                        </div>

                        {error && <div className="bg-red-500/10 text-red-500 p-2 rounded-lg text-xs mb-4 text-center">{error}</div>}

                        <div className="flex-1 relative">
                            <AnimatePresence mode="wait">
                                {/* Step 1: Credentials */}
                                {step === 1 && (
                                    <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                        <div className="relative">
                                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 text-white focus:border-[#DFFF00] outline-none" />
                                        </div>
                                        <div className="relative">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Password"
                                                value={password}
                                                onChange={e => setPassword(e.target.value)}
                                                className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 pr-10 text-white focus:border-[#DFFF00] outline-none"
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Confirm Password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 pr-10 text-white focus:border-[#DFFF00] outline-none"
                                            />
                                        </div>
                                        <div className="bg-[#222] p-3 rounded-xl border border-white/5 flex items-center justify-between gap-3">
                                            <span className="text-xs text-gray-400">Type the word: <span className="text-[#DFFF00] font-bold text-sm tracking-wider">{botChallenge.word}</span></span>
                                            <input type="text" value={botInput} onChange={e => setBotInput(e.target.value)} placeholder={botChallenge.word} className="w-24 bg-[#111] border border-white/10 rounded p-1 text-center text-white uppercase" />
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 2: Profile (Name, Birthday, Gender) */}
                                {step === 2 && (
                                    <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Full Name & Nickname</label>
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-[#111] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#DFFF00] outline-none" />
                                                <input type="text" placeholder="Nickname" value={nickname} onChange={e => setNickname(e.target.value)} className="w-1/3 bg-[#111] border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#DFFF00] outline-none" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Birthday</label>
                                            <div className="flex gap-2">
                                                <select value={birthDay} onChange={e => setBirthDay(e.target.value)} className="w-20 bg-[#111] border border-white/10 rounded-xl py-3 px-2 text-white outline-none">
                                                    <option value="">Day</option>
                                                    {[...Array(31)].map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                                                </select>
                                                <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)} className="flex-1 bg-[#111] border border-white/10 rounded-xl py-3 px-2 text-white outline-none">
                                                    <option value="">Month</option>
                                                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                                            <div className="flex bg-[#111] rounded-xl p-1 border border-white/5">
                                                {['Male', 'Female', 'Not Specified'].map(g => (
                                                    <button key={g} onClick={() => setGender(g)} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${gender === g ? 'bg-[#DFFF00] text-black shadow' : 'text-gray-400 hover:text-white'}`}>
                                                        {g === 'Not Specified' ? 'Other' : g}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Contact (Phone & Line) */}
                                {step === 3 && (
                                    <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                        <div className="relative">
                                            <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                            <input type="tel" placeholder="Mobile Number" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 text-white focus:border-[#DFFF00] outline-none" />
                                        </div>
                                        <div className="relative">
                                            <Smartphone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#06C755]" />
                                            <input type="text" placeholder="LINE User ID (Optional)" value={lineUid} onChange={e => setLineUid(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-xl py-3 pl-11 text-white focus:border-[#06C755] outline-none" />
                                            <p className="text-[10px] text-gray-500 mt-1 ml-1">Connect for points & notifications.</p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 4: Consent */}
                                {step === 4 && (
                                    <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                        <div className="bg-[#222] p-4 rounded-xl border border-white/5 space-y-3">
                                            <h3 className="text-white font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-[#DFFF00]" /> Privacy & Terms</h3>
                                            <p className="text-xs text-gray-400 leading-relaxed max-h-32 overflow-y-auto">
                                                We value your privacy. Your data (Name, Phone, Birthday) will be used solely for reservation management and loyalty benefits...
                                            </p>
                                            <label className="flex items-start gap-3 pt-2 cursor-pointer">
                                                <input type="checkbox" checked={pdpaConsent} onChange={e => setPdpaConsent(e.target.checked)} className="mt-1 accent-[#DFFF00] w-4 h-4" />
                                                <span className="text-xs text-white">I agree to the PDPA (Privacy Policy) and Terms of Service.</span>
                                            </label>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Navigation Actions */}
                        <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
                            {step < 4 ? (
                                <button onClick={nextStep} className="bg-white text-black px-6 py-2 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors">
                                    Next <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button onClick={handleFinalRegister} disabled={!pdpaConsent || loading} className="bg-[#DFFF00] text-black px-8 py-2 rounded-full font-bold shadow-[0_0_15px_rgba(223,255,0,0.3)] hover:shadow-[0_0_25px_rgba(223,255,0,0.5)] disabled:opacity-50 disabled:shadow-none transition-all">
                                    {loading ? 'Creating...' : 'Confirm Registration'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
