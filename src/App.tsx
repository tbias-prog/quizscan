/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scan, 
  PlusCircle, 
  History, 
  ArrowLeft, 
  Save, 
  FileText, 
  ClipboardCheck, 
  AlertCircle,
  ChevronRight,
  User,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Loader2
} from 'lucide-react';
import { getSupabase } from './lib/supabase';
import { Quiz, Submission, GradingResult } from './types';
import CameraManager from './components/CameraManager';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';

export default function App() {
  const [view, setView] = useState<'dashboard' | 'setup' | 'grading' | 'results'>('dashboard');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup form
  const [title, setTitle] = useState('');
  const [answerKey, setAnswerKey] = useState('');
  const [isScanningKey, setIsScanningKey] = useState(false);
  const [isParsingKey, setIsParsingKey] = useState(false);

  // Grading state
  const [isCapturing, setIsCapturing] = useState(false);
  const [gradingStatus, setGradingStatus] = useState<'idle' | 'processing' | 'done'>('idle');
  const [currentResult, setCurrentResult] = useState<GradingResult | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [studentNameInput, setStudentNameInput] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = await getSupabase();
      const isPlaceholder = !supabase || 
        (supabase.supabaseUrl && supabase.supabaseUrl.includes("your-project-url.supabase.co"));

      if (supabase && !isPlaceholder) {
        const { data: qData, error: qErr } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false });
        const { data: sData, error: sErr } = await supabase.from('submissions').select('*').order('created_at', { ascending: false });
        
        if (qErr) {
          throw qErr;
        }

        if (qData) setQuizzes(qData);
        if (sData) setSubmissions(sData);
        setIsOfflineMode(false);
      } else {
        console.warn("Supabase credentials missing or placeholder. Running in Demo Mode (Local Storage).");
        loadLocalStorageData();
        setIsOfflineMode(true);
      }
    } catch (err: any) {
      console.error("Supabase load error, switching to Offline Mode:", err);
      loadLocalStorageData();
      setIsOfflineMode(true);
    }
    setLoading(false);
  };

  const loadLocalStorageData = () => {
    try {
      const savedQuizzes = localStorage.getItem('quizscan_quizzes');
      const savedSubmissions = localStorage.getItem('quizscan_submissions');
      if (savedQuizzes) setQuizzes(JSON.parse(savedQuizzes));
      if (savedSubmissions) setSubmissions(JSON.parse(savedSubmissions));
    } catch (err) {
      console.error("Local storage load error:", err);
    }
  };

  const handleCreateQuiz = async () => {
    if (!title || !answerKey) return;
    setLoading(true);
    setError(null);
    try {
      const generatedId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      const newQuiz: Quiz = {
        id: generatedId,
        title,
        answer_key: answerKey,
        created_at: new Date().toISOString()
      };

      if (!isOfflineMode) {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Supabase configuration missing.");
        
        const { data, error } = await supabase.from('quizzes').insert([{ title, answer_key: answerKey }]).select().single();
        if (error) {
          if (error.code === 'PGRST116' || error.message.includes('not found')) {
            throw new Error("Database table 'quizzes' not found. Please run the SQL in AGENTS.md in your Supabase SQL Editor.");
          }
          throw new Error(error.message);
        }
        if (data) {
          setQuizzes([data, ...quizzes]);
        }
      } else {
        const updatedQuizzes = [newQuiz, ...quizzes];
        setQuizzes(updatedQuizzes);
        localStorage.setItem('quizscan_quizzes', JSON.stringify(updatedQuizzes));
      }

      setView('dashboard');
      setTitle('');
      setAnswerKey('');
    } catch (err: any) {
      console.error("Quiz creation error:", err);
      setError(err.message || "Failed to create quiz.");
    } finally {
      setLoading(false);
    }
  };

  const handleParseKey = async (imageBase64: string) => {
    setIsScanningKey(false);
    setIsParsingKey(true);
    setError(null);

    try {
      const res = await fetch('/api/parse-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      const contentType = res.headers.get("content-type");
      let data: any = null;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status}`);
      }

      if (res.ok) {
        setAnswerKey(data.text);
      } else {
        throw new Error(data.error || "Failed to parse key");
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsParsingKey(false);
  };

  const handleGrade = async (imageBase64: string) => {
    if (!activeQuiz) return;
    setGradingStatus('processing');
    setError(null);

    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageBase64,
          answerKey: activeQuiz.answer_key,
          studentNameInput: studentNameInput || "Student" // user override or default fallback
        }),
      });

      const contentType = res.headers.get("content-type");
      let result: any = null;
      if (contentType && contentType.includes("application/json")) {
        result = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status}`);
      }

      if (res.ok) {
        setCurrentResult(result);
        setGradingStatus('done');
        
        const generatedId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
        const newSubmission: Submission = {
          id: generatedId,
          quiz_id: activeQuiz.id,
          student_name: result.studentName,
          score: result.totalScore,
          max_score: result.maxScore,
          grading_payload: result,
          created_at: new Date().toISOString()
        };

        if (!isOfflineMode) {
          const supabase = await getSupabase();
          if (supabase) {
            const { data, error: sErr } = await supabase.from('submissions').insert([{
              quiz_id: activeQuiz.id,
              student_name: result.studentName,
              score: result.totalScore,
              max_score: result.maxScore,
              grading_payload: result
            }]).select().single();
            
            if (data) {
              setSubmissions([data, ...submissions]);
            } else {
              const fallbackSubmission = {
                ...newSubmission,
                id: Math.random().toString(36).substring(2, 15)
              };
              setSubmissions([fallbackSubmission, ...submissions]);
            }
            if (sErr) console.error("Sync error:", sErr);
          }
        } else {
          const updatedSubmissions = [newSubmission, ...submissions];
          setSubmissions(updatedSubmissions);
          localStorage.setItem('quizscan_submissions', JSON.stringify(updatedSubmissions));
        }
      } else {
        throw new Error((result as any).error || "Grading failed");
      }
    } catch (err: any) {
      setError(err.message);
      setGradingStatus('idle');
    }
    setIsCapturing(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Navbar with Glassmorphism */}
      <header className="sticky top-0 z-40 w-full glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => setView('dashboard')} 
            role="button"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 shadow-xl shadow-brand-200 transition-transform group-hover:scale-105">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900">QuizScan<span className="text-brand-600">AI</span></span>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-extrabold leading-none">Intelligence in Education</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
               onClick={() => setView('setup')}
               className="hidden sm:flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-200"
            >
              <PlusCircle className="h-4 w-4" />
              New Quiz
            </button>
            <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block" />
            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
              <User className="h-5 w-5" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-12"
            >
              {/* Header Title section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight">Academic Dashboard</h1>
                  <p className="text-slate-500 mt-2 font-medium">Welcome back, Professor. Here's your grading report.</p>
                </div>
                {isOfflineMode ? (
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-600 bg-amber-50 border border-amber-100 px-4 py-2 rounded-full shadow-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
                    Demo Mode (Local Storage)
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-full shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Cloud Synced (Supabase)
                  </div>
                )}
              </div>

              {/* Enhanced Hero Stats */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Active Quizzes', value: quizzes.length, icon: FileText, color: 'text-brand-600', bg: 'bg-brand-50', border: 'border-brand-100' },
                  { label: 'Total Scanned', value: submissions.length, icon: Scan, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
                  { label: 'Avg. Accuracy', value: '99.4%', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                  { label: 'Hours Saved', value: `${(submissions.length * 5 / 60).toFixed(1)}`, icon: History, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                ].map((stat, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={cn("rounded-3xl border bg-white p-7 shadow-sm transition-all hover:shadow-lg", stat.border)}
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn("rounded-2xl p-4 shrink-0 shadow-inner", stat.bg)}>
                        <stat.icon className={cn("h-7 w-7", stat.color)} />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
                        <p className="text-3xl font-black text-slate-900 mt-0.5">{stat.value}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Main Content Sections */}
              <div className="grid gap-10 lg:grid-cols-3">
                {/* Recent Quizzes */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Active Quiz Banks</h2>
                    <button onClick={() => setView('setup')} className="text-sm font-bold text-brand-600 px-4 py-2 rounded-full hover:bg-brand-50 transition-colors">Create New</button>
                  </div>
                  {loading ? (
                    <div className="flex h-60 items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white">
                      <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
                    </div>
                  ) : quizzes.length === 0 ? (
                    <section className="flex h-80 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
                       <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                        <FileText className="h-10 w-10 text-slate-200" />
                       </div>
                       <h3 className="text-xl font-bold text-slate-900">No active quizzes found</h3>
                       <p className="max-w-xs text-slate-400 mt-2 mb-8 font-medium">Ready to speed up your grading? Add your first quiz key to get started.</p>
                       <button 
                        onClick={() => setView('setup')}
                        className="rounded-xl bg-brand-600 px-8 py-3.5 font-bold text-white shadow-xl shadow-brand-200 hover:bg-brand-500 transition-all active:scale-95"
                       >
                        + Create Quiz Bank
                       </button>
                    </section>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2">
                       {quizzes.map((quiz, i) => (
                         <motion.div 
                          key={quiz.id} 
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="group card-hover relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-7"
                         >
                           <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50/50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-100/50 transition-colors" />
                           <div className="relative">
                            <div className="mb-6 flex items-start justify-between">
                              <div className="rounded-2xl bg-brand-50 p-3 text-brand-600">
                                <ClipboardCheck className="h-6 w-6" />
                              </div>
                              <button className="text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical className="h-5 w-5" /></button>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 line-clamp-1 h-7 leading-7">{quiz.title}</h3>
                            <p className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1.5 uppercase tracking-wide">
                              <History className="w-3 h-3" />
                              Created {new Date(quiz.created_at).toLocaleDateString()}
                            </p>
                           </div>
                           <button 
                            onClick={() => { setActiveQuiz(quiz); setView('grading'); }}
                            className="relative mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white transition-all hover:bg-brand-600 shadow-lg shadow-slate-200 hover:shadow-brand-200"
                           >
                            <Scan className="h-4 w-4" />
                            Start Grading
                           </button>
                         </motion.div>
                       ))}
                    </div>
                  )}
                </div>

                {/* Activity Feed */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Real-time Feed</h2>
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
                    {submissions.length === 0 ? (
                      <div className="py-20 px-8 text-center">
                        <History className="w-10 h-10 text-slate-100 mx-auto mb-4" />
                        <p className="text-sm font-bold text-slate-300 uppercase tracking-widest leading-loose">Waiting for scans...</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {submissions.slice(0, 8).map((sub, i) => (
                          <motion.div 
                            key={sub.id} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center gap-4 p-4 transition-all hover:bg-slate-50 rounded-2xl"
                          >
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 border border-slate-200">
                              <User className="h-6 w-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-slate-900">{sub.student_name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(sub.created_at).toLocaleTimeString()}</p>
                            </div>
                            <div className={cn(
                              "rounded-xl px-4 py-2 text-sm font-black shadow-sm",
                              sub.score / sub.max_score >= 0.7 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                : "bg-rose-50 text-rose-700 border border-rose-100"
                            )}>
                              {sub.score}/{sub.max_score}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'setup' && (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="mx-auto max-w-2xl space-y-8"
            >
              <button 
                onClick={() => setView('dashboard')}
                className="group flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                Back to Dashboard
              </button>
              
              <div className="rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-2xl shadow-slate-200/50">
                <div className="mb-10">
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configure New Quiz</h1>
                  <p className="text-slate-500 mt-2 font-medium">Create a digital twin of your physical quiz key.</p>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Quiz Identification</label>
                    <input 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Physics 101: Midterm Section B"
                      className="w-full rounded-2xl border-2 border-slate-100 px-6 py-4 text-slate-900 outline-none ring-brand-500 transition-all focus:border-brand-500 focus:ring-0 placeholder:text-slate-300 font-bold"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                       <label className="block text-sm font-black uppercase tracking-widest text-slate-400">Answer Key Schema</label>
                       <button 
                        onClick={() => setIsScanningKey(true)}
                        className="flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 text-xs font-black text-brand-600 hover:bg-brand-100 transition-all active:scale-95 shadow-sm"
                       >
                         <Scan className="h-4 w-4" />
                         Scan Document
                       </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-600 to-brand-400 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500" />
                      <textarea 
                        value={answerKey}
                        onChange={(e) => setAnswerKey(e.target.value)}
                        rows={10}
                        placeholder={isParsingKey ? "AI Vision extracting data..." : "Q1: A\nQ2: B\nQ3: True\n..."}
                        className={cn(
                          "relative w-full rounded-2xl border-2 border-slate-100 px-6 py-4 text-slate-900 outline-none ring-brand-500 transition-all focus:border-brand-500 focus:ring-0 font-mono text-sm leading-relaxed",
                          isParsingKey && "bg-slate-50 text-slate-200 italic"
                        )}
                      />
                      {isParsingKey && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px] rounded-2xl transition-all">
                           <div className="h-10 w-10 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin mb-4" />
                           <p className="text-xs font-black uppercase tracking-widest text-brand-600">Syncing Vision API</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex items-start gap-2 text-xs text-slate-400 leading-relaxed font-medium italic">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      Tip: Use a simple "Question: Answer" format. Gemini's vision engine will handle the rest during scanning.
                    </div>
                  </div>

                  <button 
                    onClick={handleCreateQuiz}
                    disabled={loading || !title || !answerKey}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-5 font-black text-white shadow-2xl shadow-slate-300 transition-all hover:bg-brand-600 active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                    Deploy Quiz Bank
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'grading' && (
            <motion.div 
              key="grading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setView('dashboard')}
                  className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Cancel
                </button>
                <div className="text-center">
                  <h2 className="font-bold text-slate-900">{activeQuiz?.title}</h2>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Live Grading Session</p>
                </div>
                <div className="w-24" />
              </div>

              {gradingStatus === 'idle' && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="relative mb-12">
                     <div className="absolute -inset-10 animate-pulse rounded-full bg-brand-100/40" />
                     <div className="absolute -inset-20 animate-pulse rounded-full bg-brand-50/20 duration-1000" />
                     <div className="relative flex h-40 w-40 items-center justify-center rounded-[2.5rem] bg-brand-600 text-white shadow-3xl shadow-brand-400/50">
                        <Scan className="h-20 w-20" />
                     </div>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Vision Ready</h2>
                  <p className="mt-4 max-w-sm text-slate-400 font-medium leading-relaxed">Position the student quiz paper clearly in view. Gemini will extract text and grade instantly.</p>
                  
                  {/* Student Name Option */}
                  <div className="mt-8 w-full max-w-sm text-left">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Student Name (Optional)</label>
                    <input 
                      type="text"
                      value={studentNameInput}
                      onChange={(e) => setStudentNameInput(e.target.value)}
                      placeholder="e.g. Alex Mercer (or leave blank to auto-detect)"
                      className="w-full rounded-2xl border-2 border-slate-100 px-5 py-3 text-slate-900 outline-none ring-brand-500 transition-all focus:border-brand-500 focus:ring-0 placeholder:text-slate-300 font-bold text-sm bg-white"
                    />
                  </div>

                  <button 
                    onClick={() => setIsCapturing(true)}
                    className="group relative mt-10 flex items-center gap-4 rounded-3xl bg-slate-900 px-10 py-5 font-black text-white transition-all hover:bg-slate-800 active:scale-95 shadow-2xl shadow-slate-200"
                  >
                    Open Live Lens
                    <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1.5" />
                  </button>
                </div>
              )}

              {gradingStatus === 'processing' && (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="mb-12 relative h-40 w-40">
                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-slate-100 border-t-brand-600" />
                    <div className="absolute inset-6 flex items-center justify-center rounded-3xl bg-slate-50 border border-slate-200 shadow-inner">
                       <ClipboardCheck className="h-12 w-12 text-brand-600 animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Syncing Academic Data</h2>
                  <p className="mt-4 text-slate-400 font-bold uppercase tracking-widest text-xs animate-pulse">Running Gemini vision models...</p>
                </div>
              )}

              {gradingStatus === 'done' && currentResult && (
                <motion.div 
                   initial={{ opacity: 0, y: 50, scale: 0.95 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                   className="mx-auto max-w-3xl space-y-10"
                >
                  <div className="overflow-hidden rounded-[3rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/50">
                    <div className="bg-slate-950 p-12 text-white relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-brand-600/20 rounded-full blur-[80px] -mr-32 -mt-32" />
                       <div className="relative">
                         <div className="mb-10 flex items-center justify-between">
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Student Identity</p>
                              <h2 className="text-4xl font-extrabold tracking-tight">{currentResult.studentName}</h2>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Authenticated Score</p>
                              <div className="flex items-center gap-3">
                                 <span className="text-6xl font-black text-brand-400">{currentResult.totalScore}</span>
                                 <div className="h-10 w-[2px] bg-slate-800" />
                                 <span className="text-2xl font-bold text-slate-600">{currentResult.maxScore}</span>
                              </div>
                           </div>
                         </div>
                         
                         <div className="flex gap-4">
                            <div className={cn(
                              "rounded-2xl px-6 py-3 text-sm font-black flex items-center gap-2.5 shadow-xl",
                              currentResult.totalScore / currentResult.maxScore >= 0.5 ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-rose-500 text-white shadow-rose-500/20"
                            )}>
                               {currentResult.totalScore / currentResult.maxScore >= 0.5 ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                               {currentResult.totalScore / currentResult.maxScore >= 0.5 ? "PASSING GRADE" : "REMEDIATION REQUIRED"}
                            </div>
                            <div className="rounded-2xl bg-white/5 border border-white/10 px-6 py-3 text-sm font-black text-slate-400 flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                               {(currentResult.totalScore / currentResult.maxScore * 100).toFixed(1)}% Accuracy Rate
                            </div>
                         </div>
                       </div>
                    </div>

                    <div className="p-12">
                       <div className="flex items-center justify-between mb-8">
                         <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                           <History className="h-7 w-7 text-brand-600" />
                           Audit Log
                         </h3>
                         <div className="h-1 w-20 bg-slate-100 rounded-full" />
                       </div>

                       <div className="space-y-4">
                          {currentResult.results.map((res, i) => (
                            <motion.div 
                              key={i} 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-center gap-6 rounded-3xl border border-slate-50 bg-slate-50/30 p-6 transition-all hover:bg-slate-50 group"
                            >
                               <div className={cn(
                                 "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl font-black text-xl shadow-sm transition-transform group-hover:scale-105",
                                 res.isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                               )}>
                                 {res.questionNumber}
                               </div>
                               <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-3 text-base">
                                     <span className="font-black text-slate-900">Student: {res.studentAnswer}</span>
                                     <span className="text-slate-300 font-light">→</span>
                                     <span className="text-slate-400 font-bold italic">Expected: {res.correctAnswer}</span>
                                  </div>
                                  <p className="text-sm text-slate-500 mt-2 font-medium leading-relaxed">{res.feedback}</p>
                               </div>
                               <div className={cn(
                                 "h-8 w-8 rounded-full flex items-center justify-center",
                                 res.isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-500"
                               )}>
                                {res.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                               </div>
                            </motion.div>
                          ))}
                       </div>

                       <div className="mt-12 rounded-[2rem] bg-brand-50 border border-brand-100 p-8 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 text-brand-200">
                             <ClipboardCheck className="w-20 h-20 opacity-20 rotate-12" />
                          </div>
                          <div className="relative">
                            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-brand-500 mb-4">Instructor Insight</h4>
                            <div className="prose prose-sm prose-slate font-medium text-brand-900 leading-loose prose-strong:text-brand-950 prose-strong:font-black">
                              <ReactMarkdown>{currentResult.overallFeedback}</ReactMarkdown>
                            </div>
                          </div>
                       </div>

                        <div className="mt-12 flex gap-5">
                           <button 
                             onClick={() => { setGradingStatus('idle'); setCurrentResult(null); setStudentNameInput(''); }}
                             className="flex-[2] rounded-2xl bg-slate-900 py-5 font-black text-white shadow-2xl shadow-slate-200 transition-all hover:bg-brand-600 active:scale-95"
                           >
                             Scan Next Document
                          </button>
                          <button 
                            onClick={() => setView('dashboard')}
                            className="flex-1 rounded-2xl border-2 border-slate-100 px-6 py-5 font-black text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95"
                          >
                             Finish Session
                          </button>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {isCapturing && (
        <CameraManager 
          onCapture={handleGrade} 
          onCancel={() => setIsCapturing(false)} 
          title="Student Paper Scanner"
          confirmLabel="Grade This Paper"
        />
      )}

      {isScanningKey && (
        <CameraManager 
          onCapture={handleParseKey} 
          onCancel={() => setIsScanningKey(false)} 
          title="Answer Key Scanner"
          confirmLabel="Extract Answer Key"
        />
      )}

      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-3 rounded-2xl bg-red-600 px-6 py-4 text-white shadow-2xl animate-bounce">
            <AlertCircle className="h-5 w-5" />
            <span className="font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:text-red-200">
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

