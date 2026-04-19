import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "", stack: "", componentStack: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Unexpected runtime error",
      stack: error?.stack || "",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[Descall] UI crashed:", error);
    console.error("[Descall] Component stack:", errorInfo.componentStack);
    this.setState({
      stack: error?.stack || "",
      componentStack: errorInfo?.componentStack || "",
    });
  }

  handleReset = () => {
    try {
      window.localStorage.removeItem("descall_user");
      window.localStorage.removeItem("descall_token");
    } catch {
      // Ignore storage reset failures.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="auth-shell">
        <section className="auth-card" style={{ maxWidth: "600px", maxHeight: "80vh", overflow: "auto" }}>
          <h1>Descall</h1>
          <p>UI crashed and recovered safely.</p>
          <p className="error">{this.state.message}</p>
          
          {this.state.stack && (
            <div style={{ marginTop: "20px" }}>
              <h3>Error Stack:</h3>
              <pre style={{ 
                background: "#1a1a1a", 
                color: "#ff6b6b", 
                padding: "10px", 
                borderRadius: "4px", 
                fontSize: "12px",
                overflow: "auto",
                maxHeight: "200px" 
              }}>
                {this.state.stack}
              </pre>
            </div>
          )}

          {this.state.componentStack && (
            <div style={{ marginTop: "20px" }}>
              <h3>Component Stack:</h3>
              <pre style={{ 
                background: "#1a1a1a", 
                color: "#4ecdc4", 
                padding: "10px", 
                borderRadius: "4px", 
                fontSize: "12px",
                overflow: "auto",
                maxHeight: "200px" 
              }}>
                {this.state.componentStack}
              </pre>
            </div>
          )}
          
          <button type="button" onClick={this.handleReset} style={{ marginTop: "20px" }}>
            Reset session and reload
          </button>
        </section>
      </main>
    );
  }
}
