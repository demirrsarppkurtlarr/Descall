import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Unexpected runtime error",
    };
  }

  componentDidCatch(error) {
    console.error("[Descall] UI crashed:", error);
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
        <section className="auth-card">
          <h1>Descall</h1>
          <p>UI crashed and recovered safely.</p>
          <p className="error">{this.state.message}</p>
          <button type="button" onClick={this.handleReset}>
            Reset session and reload
          </button>
        </section>
      </main>
    );
  }
}
