import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, UserPlus, Lock, Mail, Zap, Shield, Sparkles } from "lucide-react";

// Animated background particles
function BackgroundParticles() {
  return (
    <div className="auth-particles">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="particle"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            y: [null, -100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut",
          }}
          style={{
            left: `${Math.random() * 100}%`,
            width: `${4 + Math.random() * 8}px`,
            height: `${4 + Math.random() * 8}px`,
            background: `rgba(${100 + Math.random() * 155}, ${100 + Math.random() * 155}, 255, ${0.3 + Math.random() * 0.5})`,
          }}
        />
      ))}
    </div>
  );
}

// Descall Logo Component
function DescallLogo({ size = 80 }) {
  return (
    <motion.div
      className="descall-logo"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 15, duration: 0.8 }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Main circle background */}
        <circle cx="50" cy="50" r="45" fill="url(#logoGrad)" filter="url(#glow)" opacity="0.2" />
        <circle cx="50" cy="50" r="38" stroke="url(#logoGrad)" strokeWidth="3" fill="none" />
        {/* Chat bubble */}
        <path
          d="M30 45 C30 35, 35 30, 50 30 C65 30, 70 35, 70 45 C70 55, 65 60, 50 60 L45 68 L40 60 C35 58, 30 55, 30 45"
          fill="url(#logoGrad)"
          filter="url(#glow)"
        />
        {/* Sound waves */}
        <motion.path
          d="M75 40 Q82 50, 75 60"
          stroke="url(#logoGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        />
        <motion.path
          d="M82 35 Q92 50, 82 65"
          stroke="url(#logoGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        />
      </svg>
    </motion.div>
  );
}

// Feature item with animation
function FeatureItem({ icon: Icon, text, delay }) {
  return (
    <motion.div
      className="auth-feature"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div className="feature-icon">
        <Icon size={18} />
      </div>
      <span>{text}</span>
    </motion.div>
  );
}

export default function AuthView({ onLogin, onRegister, loading, error }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focusedInput, setFocusedInput] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      return;
    }
    if (mode === "login") {
      await onLogin({ username: username.trim(), password });
      return;
    }
    await onRegister({ username: username.trim(), password });
  };

  return (
    <main className="auth-shell">
      <BackgroundParticles />
      
      <motion.section
        className="auth-card enhanced"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="auth-logo-container">
          <DescallLogo size={90} />
          <motion.h1
            className="auth-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Descall
          </motion.h1>
          <motion.p
            className="auth-subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Connect with friends through voice, video, and messaging
          </motion.p>
        </div>

        {/* Features */}
        <div className="auth-features">
          <FeatureItem icon={Zap} text="Real-time messaging" delay={0.6} />
          <FeatureItem icon={Shield} text="Secure connections" delay={0.7} />
          <FeatureItem icon={Sparkles} text="Crystal clear calls" delay={0.8} />
        </div>

        {/* Tabs */}
        <motion.div
          className="auth-tabs enhanced"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
        >
          <motion.button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <MessageCircle size={18} />
            <span>Login</span>
          </motion.button>
          <motion.button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <UserPlus size={18} />
            <span>Register</span>
          </motion.button>
          <motion.div
            className="tab-indicator"
            layoutId="tabIndicator"
            initial={false}
            animate={{ x: mode === "login" ? 0 : "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </motion.div>

        {/* Form */}
        <AnimatePresence mode="wait">
          <motion.form
            key={mode}
            onSubmit={submit}
            className="auth-form enhanced"
            initial={{ opacity: 0, x: mode === "login" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === "login" ? 20 : -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className={`input-wrapper ${focusedInput === "username" ? "focused" : ""}`}>
              <Mail className="input-icon" size={20} />
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedInput("username")}
                onBlur={() => setFocusedInput(null)}
                maxLength={24}
                required
              />
              <motion.div
                className="input-line"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: focusedInput === "username" ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className={`input-wrapper ${focusedInput === "password" ? "focused" : ""}`}>
              <Lock className="input-icon" size={20} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedInput("password")}
                onBlur={() => setFocusedInput(null)}
                maxLength={72}
                required
              />
              <motion.div
                className="input-line"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: focusedInput === "password" ? 1 : 0 }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  className="error-message"
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              className="auth-submit"
              disabled={loading || !username.trim() || !password}
              whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(99, 102, 241, 0.4)" }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <motion.div
                  className="loading-spinner"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Sparkles size={20} />
                </motion.div>
              ) : mode === "login" ? (
                <>
                  <MessageCircle size={20} />
                  <span>Login</span>
                </>
              ) : (
                <>
                  <UserPlus size={20} />
                  <span>Create Account</span>
                </>
              )}
            </motion.button>
          </motion.form>
        </AnimatePresence>

        {/* Footer */}
        <motion.p
          className="auth-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          By continuing, you agree to our Terms of Service
        </motion.p>
      </motion.section>
    </main>
  );
}
