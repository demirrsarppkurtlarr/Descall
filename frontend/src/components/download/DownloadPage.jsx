import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Download, 
  Windows, 
  Apple, 
  Linux, 
  CheckCircle2, 
  Loader2,
  Sparkles,
  Zap,
  Shield,
  Globe,
  MessageCircle,
  Mic,
  Video,
  Users,
  ChevronRight,
  Github,
  Star
} from 'lucide-react';
import './DownloadPage.css';

// This will be updated by GitHub Actions on each release
const LATEST_VERSION = "v1.0.0";
const GITHUB_REPO = "demirrsarppkurtlarr/descall";

const features = [
  { icon: MessageCircle, title: "Real-time Chat", desc: "Instant messaging with typing indicators" },
  { icon: Mic, title: "Voice Messages", desc: "Crystal clear voice recordings" },
  { icon: Video, title: "Video Calls", desc: "HD video calling with screen share" },
  { icon: Users, title: "Group Chats", desc: "Create groups with unlimited members" },
];

const platforms = [
  { 
    id: 'windows', 
    name: 'Windows', 
    icon: Windows, 
    file: 'Descall-Setup.exe',
    size: '~80 MB',
    color: '#0078D4'
  },
  { 
    id: 'mac', 
    name: 'macOS', 
    icon: Apple, 
    file: 'Descall.dmg',
    size: '~85 MB',
    color: '#000000'
  },
  { 
    id: 'linux', 
    name: 'Linux', 
    icon: Linux, 
    file: 'Descall.AppImage',
    size: '~90 MB',
    color: '#25D366'
  },
];

const stats = [
  { value: "10K+", label: "Downloads" },
  { value: "4.9", label: "Rating" },
  { value: "50+", label: "Countries" },
];

export default function DownloadPage() {
  const [selectedPlatform, setSelectedPlatform] = useState('windows');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isInstalled, setIsInstalled] = useState(false);
  const [latestRelease, setLatestRelease] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestRelease();
    detectPlatform();
  }, []);

  const fetchLatestRelease = async () => {
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      if (response.ok) {
        const data = await response.json();
        setLatestRelease(data);
      }
    } catch (error) {
      console.error('Failed to fetch latest release:', error);
    } finally {
      setLoading(false);
    }
  };

  const detectPlatform = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) setSelectedPlatform('windows');
    else if (userAgent.includes('mac')) setSelectedPlatform('mac');
    else if (userAgent.includes('linux')) setSelectedPlatform('linux');
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadProgress(0);

    // Simulate download progress
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsInstalled(true);
          setDownloading(false);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Actual download
    const platform = platforms.find(p => p.id === selectedPlatform);
    const releaseUrl = latestRelease?.assets?.find(asset => 
      asset.name.toLowerCase().includes(platform.id)
    )?.browser_download_url;

    if (releaseUrl) {
      window.open(releaseUrl, '_blank');
    }
  };

  const currentPlatform = platforms.find(p => p.id === selectedPlatform);

  return (
    <div className="download-page">
      {/* Animated Background */}
      <div className="download-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
        <div className="grid-pattern" />
      </div>

      {/* Hero Section */}
      <section className="download-hero">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="hero-content"
        >
          <motion.div 
            className="version-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            <Sparkles size={14} />
            <span>{latestRelease?.tag_name || LATEST_VERSION} Now Available</span>
          </motion.div>

          <motion.h1 
            className="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Descall Desktop
            <span className="gradient-text"> Experience</span>
          </motion.h1>

          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            The ultimate chat application for your desktop. 
            Fast, secure, and beautifully designed.
          </motion.p>

          {/* Stats */}
          <motion.div 
            className="stats-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            {stats.map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="stat-item"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <span className="stat-value">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Download Card */}
        <motion.div 
          className="download-card"
          initial={{ opacity: 0, y: 40, rotateX: 10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
        >
          {/* Platform Selector */}
          <div className="platform-tabs">
            {platforms.map((platform) => (
              <motion.button
                key={platform.id}
                className={`platform-tab ${selectedPlatform === platform.id ? 'active' : ''}`}
                onClick={() => setSelectedPlatform(platform.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <platform.icon size={20} />
                <span>{platform.name}</span>
              </motion.button>
            ))}
          </div>

          {/* Selected Platform Info */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedPlatform}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="platform-info"
            >
              <div className="platform-header">
                <div 
                  className="platform-icon-large"
                  style={{ background: currentPlatform.color }}
                >
                  <currentPlatform.icon size={32} color="white" />
                </div>
                <div className="platform-details">
                  <h3>Descall for {currentPlatform.name}</h3>
                  <p>{currentPlatform.file} • {currentPlatform.size}</p>
                </div>
              </div>

              {/* Requirements */}
              <div className="requirements">
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>Windows 10/11 or newer</span>
                </div>
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>64-bit processor</span>
                </div>
                <div className="req-item">
                  <CheckCircle2 size={16} />
                  <span>200 MB free space</span>
                </div>
              </div>

              {/* Download Button */}
              <motion.button
                className={`download-btn ${downloading ? 'downloading' : ''} ${isInstalled ? 'installed' : ''}`}
                onClick={handleDownload}
                disabled={downloading || isInstalled}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {downloading ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    <span>Downloading... {Math.round(downloadProgress)}%</span>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                  </>
                ) : isInstalled ? (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Download Started</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>Download for {currentPlatform.name}</span>
                    <ChevronRight size={18} className="arrow" />
                  </>
                )}
              </motion.button>
            </motion.div>
          </AnimatePresence>

          {/* Additional Links */}
          <div className="additional-links">
            <a href={`https://github.com/${GITHUB_REPO}/releases`} target="_blank" rel="noopener noreferrer">
              <Github size={16} />
              <span>View All Releases</span>
            </a>
            <a href={`https://github.com/${GITHUB_REPO}`} target="_blank" rel="noopener noreferrer">
              <Star size={16} />
              <span>Star on GitHub</span>
            </a>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="section-header"
        >
          <h2>Why Choose Descall?</h2>
          <p>Experience the next generation of communication</p>
        </motion.div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <div className="feature-icon">
                <feature.icon size={28} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust-section">
        <div className="trust-grid">
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Shield size={32} />
            <h4>End-to-End Security</h4>
            <p>Your conversations are encrypted and secure</p>
          </motion.div>
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Zap size={32} />
            <h4>Lightning Fast</h4>
            <p>Built for speed with native performance</p>
          </motion.div>
          <motion.div 
            className="trust-item"
            whileHover={{ scale: 1.05 }}
          >
            <Globe size={32} />
            <h4>Global Network</h4>
            <p>Connect with anyone, anywhere in the world</p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="download-footer">
        <p>© 2024 Descall. Open source on <a href={`https://github.com/${GITHUB_REPO}`}>GitHub</a></p>
      </footer>
    </div>
  );
}
