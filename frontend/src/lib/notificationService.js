/**
 * Advanced Notification Service for Descall
 * Handles both Electron native notifications and Web Push notifications
 * with permission management and modern UX
 */

class NotificationService {
  constructor() {
    this.permission = 'default';
    this.isElectron = window.electronAPI?.isElectron || false;
    this.hasPermission = false;
    this.initialized = false;
    this.pendingNotifications = [];
    this.lastNotificationTime = 0;
    this.cooldownMs = 1000; // Minimum time between notifications
  }

  /**
   * Initialize notification service and request permission
   */
  async init() {
    if (this.initialized) return;
    
    if (this.isElectron) {
      // Electron: Use native notification API via IPC
      await this.requestElectronPermission();
    } else {
      // Web: Use browser Notification API
      await this.requestWebPermission();
    }
    
    this.initialized = true;
    this.processPendingNotifications();
  }

  /**
   * Request permission for Electron
   */
  async requestElectronPermission() {
    try {
      if (window.electronAPI?.requestNotificationPermission) {
        this.hasPermission = await window.electronAPI.requestNotificationPermission();
        this.permission = this.hasPermission ? 'granted' : 'denied';
      }
    } catch (err) {
      console.error('[Notification] Electron permission error:', err);
      this.hasPermission = false;
    }
  }

  /**
   * Request permission for Web
   */
  async requestWebPermission() {
    if (!('Notification' in window)) {
      console.warn('[Notification] Browser does not support notifications');
      this.permission = 'unsupported';
      return;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      this.hasPermission = true;
      return;
    }

    if (Notification.permission !== 'denied') {
      try {
        const result = await Notification.requestPermission();
        this.permission = result;
        this.hasPermission = result === 'granted';
      } catch (err) {
        console.error('[Notification] Web permission error:', err);
        this.permission = 'error';
        this.hasPermission = false;
      }
    }
  }

  /**
   * Show permission prompt to user
   */
  async requestPermissionWithDialog() {
    // For web: Show custom dialog before requesting
    if (!this.isElectron && 'Notification' in window) {
      const userConfirmed = confirm('Bildirimler için izin vermek istiyor musunuz?\n\nYeni mesajlar, aramalar ve duyurular için bildirim alacaksınız.');
      if (userConfirmed) {
        await this.init();
        return this.hasPermission;
      }
      return false;
    }
    
    // Electron: Direct request
    await this.init();
    return this.hasPermission;
  }

  /**
   * Show notification with rate limiting
   */
  async show(options = {}) {
    const {
      title = 'Descall',
      body = '',
      icon = '/icon.png',
      tag = 'descall',
      requireInteraction = false,
      silent = false,
      data = {}
    } = options;

    // Check rate limit
    const now = Date.now();
    if (now - this.lastNotificationTime < this.cooldownMs) {
      // Queue notification for later
      this.pendingNotifications.push(options);
      return;
    }
    this.lastNotificationTime = now;

    // Check permission
    if (!this.hasPermission) {
      // Try to initialize if not done yet
      if (!this.initialized) {
        this.pendingNotifications.push(options);
        await this.init();
        return;
      }
      console.log('[Notification] No permission, skipping');
      return;
    }

    // Show notification based on platform
    if (this.isElectron) {
      this.showElectronNotification({ title, body, icon, tag, data });
    } else {
      this.showWebNotification({ title, body, icon, tag, requireInteraction, silent, data });
    }
  }

  /**
   * Show Electron native notification
   */
  showElectronNotification({ title, body, icon, data }) {
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification(title, {
        body,
        icon,
        ...data
      });
      
      // Listen for click
      if (window.electronAPI.onNotificationClick) {
        window.electronAPI.onNotificationClick((notificationData) => {
          this.handleNotificationClick(notificationData);
        });
      }
    }
  }

  /**
   * Show Web browser notification
   */
  showWebNotification({ title, body, icon, tag, requireInteraction, silent, data }) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon,
          tag,
          requireInteraction,
          silent,
          badge: '/icon.png',
          data
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          this.handleNotificationClick(data);
        };

        notification.onerror = (err) => {
          console.error('[Notification] Web notification error:', err);
        };

        // Auto close after 5 seconds if not requireInteraction
        if (!requireInteraction) {
          setTimeout(() => notification.close(), 5000);
        }
      } catch (err) {
        console.error('[Notification] Failed to show web notification:', err);
      }
    }
  }

  /**
   * Handle notification click
   */
  handleNotificationClick(data) {
    console.log('[Notification] Clicked:', data);
    // Emit event for components to handle
    window.dispatchEvent(new CustomEvent('descall:notification-click', { detail: data }));
  }

  /**
   * Process pending notifications
   */
  processPendingNotifications() {
    if (this.pendingNotifications.length === 0) return;
    
    const notifications = [...this.pendingNotifications];
    this.pendingNotifications = [];
    
    notifications.forEach((options, index) => {
      setTimeout(() => {
        this.show(options);
      }, index * this.cooldownMs);
    });
  }

  // ========== Specific Notification Types ==========

  /**
   * New DM message notification
   */
  async newMessage({ from, text, preview, conversationId }) {
    await this.show({
      title: `Yeni Mesaj - ${from}`,
      body: preview || text.substring(0, 100),
      tag: `dm-${conversationId}`,
      data: { type: 'dm', conversationId, from }
    });
  }

  /**
   * Incoming call notification
   */
  async incomingCall({ from, type = 'voice' }) {
    await this.show({
      title: `${from} arıyor...`,
      body: type === 'video' ? 'Görüntülü arama' : 'Sesli arama',
      icon: '/icon.png',
      requireInteraction: true,
      tag: 'incoming-call',
      data: { type: 'call', from, callType: type }
    });
  }

  /**
   * Missed call notification
   */
  async missedCall({ from, type = 'voice' }) {
    await this.show({
      title: 'Cevapsız Arama',
      body: `${from} ${type === 'video' ? 'görüntülü' : 'sesli'} aradı`,
      tag: `missed-call-${from}`,
      data: { type: 'missed-call', from, callType: type }
    });
  }

  /**
   * New announcement notification
   */
  async newAnnouncement({ title, preview, announcementId }) {
    await this.show({
      title: `📢 ${title}`,
      body: preview,
      tag: `announcement-${announcementId}`,
      data: { type: 'announcement', announcementId }
    });
  }

  /**
   * Friend request notification
   */
  async friendRequest({ from, fromId }) {
    await this.show({
      title: 'Arkadaşlık İsteği',
      body: `${from} seni arkadaş olarak eklemek istiyor`,
      tag: `friend-request-${fromId}`,
      data: { type: 'friend-request', fromId }
    });
  }

  /**
   * Friend online notification
   */
  async friendOnline({ username }) {
    await this.show({
      title: 'Arkadaş Çevrimiçi',
      body: `${username} çevrimiçi oldu`,
      tag: `friend-online-${username}`,
      silent: true,
      data: { type: 'friend-online', username }
    });
  }

  /**
   * Group mention notification
   */
  async groupMention({ groupName, from, text, groupId }) {
    await this.show({
      title: `${groupName} - ${from}`,
      body: `Sizden bahsetti: ${text.substring(0, 80)}`,
      tag: `mention-${groupId}`,
      data: { type: 'mention', groupId }
    });
  }
}

// Singleton instance
const notificationService = new NotificationService();

// Initialize on load
if (typeof window !== 'undefined') {
  // Wait for user interaction before requesting permission
  const initOnInteraction = () => {
    notificationService.init();
    document.removeEventListener('click', initOnInteraction);
    document.removeEventListener('keydown', initOnInteraction);
  };
  
  document.addEventListener('click', initOnInteraction, { once: true });
  document.addEventListener('keydown', initOnInteraction, { once: true });
}

export default notificationService;
