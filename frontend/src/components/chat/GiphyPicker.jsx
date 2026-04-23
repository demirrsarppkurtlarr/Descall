import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, TrendingUp, Loader2 } from "lucide-react";

// Giphy API - Public beta key (for development)
const GIPHY_API_KEY = "dtgxSdCkeVkjYcEeEpSYlqP4mmv4LQgi";
const GIPHY_API_URL = "https://api.giphy.com/v1/gifs";

export default function GiphyPicker({ isOpen, onClose, onSelectGif }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("trending"); // 'trending' | 'search'
  const searchInputRef = useRef(null);

  // Fetch trending GIFs
  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${GIPHY_API_URL}/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
      );
      if (!response.ok) throw new Error("Failed to fetch trending GIFs");
      const data = await response.json();
      setGifs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search GIFs
  const searchGifs = useCallback(async (query) => {
    if (!query.trim()) {
      fetchTrending();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${GIPHY_API_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );
      if (!response.ok) throw new Error("Failed to search GIFs");
      const data = await response.json();
      setGifs(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchTrending]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchTrending();
      // Focus search input after opening
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, fetchTrending]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchQuery) {
        searchGifs(searchQuery);
        setActiveTab("search");
      } else if (activeTab === "search") {
        fetchTrending();
        setActiveTab("trending");
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchGifs, fetchTrending, activeTab]);

  const handleSelect = (gif) => {
    const gifUrl = gif.images?.fixed_height?.url || gif.images?.original?.url;
    const previewUrl = gif.images?.fixed_height_small?.url || gif.images?.preview_gif?.url;
    if (gifUrl) {
      onSelectGif({
        url: gifUrl,
        previewUrl: previewUrl || gifUrl,
        title: gif.title,
        id: gif.id,
        source: "giphy"
      });
      onClose();
      setSearchQuery("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="giphy-picker-overlay" onClick={onClose}>
      <div className="giphy-picker" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="giphy-picker-header">
          <div className="giphy-logo">
            <span className="giphy-text">GIPHY</span>
          </div>
          <button className="giphy-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="giphy-search">
          <Search size={18} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search GIFs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="giphy-search-input"
          />
          {searchQuery && (
            <button 
              className="clear-search" 
              onClick={() => { setSearchQuery(""); fetchTrending(); setActiveTab("trending"); }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="giphy-tabs">
          <button 
            className={`giphy-tab ${activeTab === "trending" ? "active" : ""}`}
            onClick={() => { setActiveTab("trending"); setSearchQuery(""); fetchTrending(); }}
          >
            <TrendingUp size={16} />
            Trending
          </button>
          <button 
            className={`giphy-tab ${activeTab === "search" ? "active" : ""}`}
            onClick={() => searchInputRef.current?.focus()}
          >
            <Search size={16} />
            Search
          </button>
        </div>

        {/* Content */}
        <div className="giphy-content">
          {loading ? (
            <div className="giphy-loading">
              <Loader2 size={32} className="spin" />
              <p>Loading GIFs...</p>
            </div>
          ) : error ? (
            <div className="giphy-error">
              <p>Error: {error}</p>
              <button onClick={fetchTrending}>Try Again</button>
            </div>
          ) : gifs.length === 0 ? (
            <div className="giphy-empty">
              <p>No GIFs found. Try a different search!</p>
            </div>
          ) : (
            <div className="giphy-grid">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  className="giphy-item"
                  onClick={() => handleSelect(gif)}
                  title={gif.title}
                >
                  <img
                    src={gif.images?.fixed_height_small?.url || gif.images?.preview_gif?.url}
                    alt={gif.title}
                    loading="lazy"
                    className="giphy-thumb"
                  />
                  <div className="giphy-overlay">
                    <span className="giphy-select">Click to send</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="giphy-footer">
          <span className="giphy-powered">Powered by GIPHY</span>
        </div>
      </div>
    </div>
  );
}
