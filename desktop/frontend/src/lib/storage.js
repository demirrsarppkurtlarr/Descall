const TOKEN_KEY = "descall_token";
const USER_KEY = "descall_user";

function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken() {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore write failures in restricted browser modes.
  }
}

export function clearToken() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore remove failures in restricted browser modes.
  }
}

export function getUser() {
  const storage = getStorage();
  if (!storage) return null;
  let raw = null;
  try {
    raw = storage.getItem(USER_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Recover from corrupted localStorage values to prevent blank screen crashes.
    try {
      storage.removeItem(USER_KEY);
    } catch {
      // Ignore remove failures in restricted browser modes.
    }
    return null;
  }
}

export function setUser(user) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore write failures in restricted browser modes.
  }
}

export function clearUser() {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(USER_KEY);
  } catch {
    // Ignore remove failures in restricted browser modes.
  }
}
