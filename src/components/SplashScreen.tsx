import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Gamepad2, Cpu } from 'lucide-react';

export default function SplashScreen({ onComplete }: { onComplete: () => void; key?: React.Key }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 800);
          return 100;
        }
        return prev + 1;
      });
    }, 25);
    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }}
      className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Atmospheric Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-full h-full bg-indigo-600/20 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -40, 0],
            y: [0, 60, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-purple-600/20 rounded-full blur-[120px]"
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Animated Icons */}
        <div className="flex gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-indigo-400 shadow-2xl shadow-indigo-500/10"
          >
            <Monitor size={32} strokeWidth={1.5} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-purple-400 shadow-2xl shadow-purple-500/10"
          >
            <Gamepad2 size={32} strokeWidth={1.5} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-emerald-400 shadow-2xl shadow-emerald-500/10"
          >
            <Cpu size={32} strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* Logo Text */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ letterSpacing: '0.5em', opacity: 0, filter: 'blur(10px)' }}
            animate={{ letterSpacing: '-0.02em', opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-7xl md:text-9xl font-black text-white tracking-tighter"
          >
            GC <span className="text-indigo-500">WEB</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1, duration: 1 }}
            className="text-indigo-200/50 uppercase tracking-[0.4em] text-xs font-bold mt-4"
          >
            Digital Ecosystem & Gaming Hub
          </motion.p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-64 h-[2px] bg-white/10 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
          />
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-[10px] font-mono text-white/20 uppercase tracking-widest"
        >
          Initializing Systems... {progress}%
        </motion.div>
      </div>

      {/* Decorative Grid */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
    </motion.div>
  );
}
