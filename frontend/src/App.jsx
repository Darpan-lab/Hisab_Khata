import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { 
  getTransactions, 
  saveTransactions, 
  getCategories, 
  saveCategories, 
  getGroups, 
  saveGroups, 
  addToQueue, 
  getQueue, 
  removeFromQueue 
} from './offlineDb';
import {
  Wallet,
  ClipboardList,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  PlusCircle,
  Tag,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  User,
  Mail,
  Lock,
  ExternalLink,
  Loader,
  Users,
  UserPlus,
  Copy,
  RefreshCw,
  UserMinus,
  Eye,
  EyeOff,
  Shield,
  ArrowLeft,
  PieChart,
  Bell,
  Sun,
  Moon,
  Check,
  X,
  Calendar
} from 'lucide-react';

const API_BASE = '/api';
const APP_VERSION = '9.0';
const presetAvatars = ['👤', '👨‍💻', '👩‍💻', '🦁', '🦊', '🐼', '🐱', '🕶️', '👑', '⭐', '🍀', '🔥'];
let cachedVapidPublicKey = null;

function App() {
  // Authentication & Navigation State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) {
          if (!parsed.id && parsed._id) parsed.id = parsed._id;
          if (!parsed._id && parsed.id) parsed._id = parsed.id;
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const setAndStoreUser = (userData) => {
    if (userData) {
      if (!userData.id && userData._id) userData.id = userData._id;
      if (!userData._id && userData.id) userData._id = userData.id;
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } else {
      localStorage.removeItem('user');
      setUser(null);
    }
  };
  const [activeTab, setActiveTab] = useState('track'); // 'track', 'history', 'groups', 'settings'
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  // Helper to get local date string in YYYY-MM-DD format
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to parse date string/object timezone-safely into a local Date object representing the calendar day
  const parseLocalDate = (dateInput) => {
    if (!dateInput) return new Date();
    const dateStr = typeof dateInput === 'string' 
      ? dateInput.split('T')[0] 
      : new Date(dateInput).toISOString().split('T')[0];
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [yr, mo, dy] = dateStr.split('-').map(Number);
      return new Date(yr, mo - 1, dy);
    }
    return new Date(dateInput);
  };

  // Form States
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [transactionForm, setTransactionForm] = useState({ itemName: '', cost: '', quantity: '1', category: '', date: getLocalDateString(), groupId: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#2563eb' });
  const [sheetUrlForm, setSheetUrlForm] = useState('');
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    profilePic: '',
    budget: '',
    telegramChatId: '',
    activeTelegramGroup: null,
    currentPassword: '',
    newPassword: ''
  });

  // Admin Control States
  const [signupPaused, setSignupPaused] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSignupPaused, setAdminSignupPaused] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null); // { id, username }
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [passwordSubmitLoading, setPasswordSubmitLoading] = useState(false);

  // Notification & PWA Push States
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [showNotificationsTray, setShowNotificationsTray] = useState(false);
  const [isSubscribedToPush, setIsSubscribedToPush] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  // Fetch signup status on mount
  useEffect(() => {
    const fetchSignupStatus = async () => {
      try {
        const response = await axios.get(`${API_BASE}/auth/signup-status`);
        if (response.data && typeof response.data.isSignupPaused === 'boolean') {
          setSignupPaused(response.data.isSignupPaused);
        }
      } catch (err) {
        console.error('Failed to fetch signup status:', err);
      }
    };
    fetchSignupStatus();
  }, []);
  
  // Apply selected theme class to document root element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-midnight', 'theme-emerald', 'theme-cyberpunk', 'theme-minimalist', 'theme-trust-blue', 'theme-slate', 'theme-dark', 'theme-light');
    const activeClass = theme === 'light' ? 'theme-light' : 'theme-dark';
    root.classList.add(activeClass);
    root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    localStorage.setItem('theme', theme);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'light' ? '#ffffff' : '#0f172a');
    }
  }, [theme]);

  // Sync profile editing form when user state changes
  useEffect(() => {
    if (user) {
      setProfileForm({
        username: user.username || '',
        email: user.email || '',
        profilePic: user.profilePic || '',
        budget: user.budget !== undefined ? user.budget : '',
        telegramChatId: user.telegramChatId || '',
        activeTelegramGroup: user.activeTelegramGroup || null,
        currentPassword: '',
        newPassword: ''
      });
    }
  }, [user]);

  const renderAvatar = (pic, size = 20) => {
    if (!pic) {
      return <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>👤</span>;
    }
    const isUrl = pic.startsWith('http://') || pic.startsWith('https://') || pic.startsWith('data:image/');
    if (isUrl) {
      return (
        <img
          src={pic}
          alt="Avatar"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1px solid var(--card-border)',
            display: 'inline-block',
            verticalAlign: 'middle'
          }}
        />
      );
    }
    return <span style={{ fontSize: `${size}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{pic}</span>;
  };

  const findDefaultCategory = (cats) => {
    if (!cats || cats.length === 0) return '';
    const foodCat = cats.find(c => c.name.toLowerCase().includes('food') || c.name === 'Food 🍔');
    return foodCat ? foodCat.name : cats[0].name;
  };

  // Group Collaboration States
  const [groups, setGroups] = useState([]);
  const [filterGroup, setFilterGroup] = useState(
    localStorage.getItem('filterGroup') && localStorage.getItem('filterGroup') !== 'all'
      ? localStorage.getItem('filterGroup')
      : 'personal'
  );

  const handleFilterGroupChange = (value) => {
    setFilterGroup(value);
    localStorage.setItem('filterGroup', value);
  };

  // Custom Scope Selection Modal & Swipe States
  const [showScopeModal, setShowScopeModal] = useState(false);

  const availableScopes = useMemo(() => [
    {
      id: 'personal',
      name: 'Personal Only',
      type: 'personal',
      subtitle: 'Private personal expenses & budget'
    },
    ...groups.map(g => ({
      id: g._id,
      name: g.name,
      type: 'group',
      subtitle: `${g.members?.length || 1} members • ${g.owner?._id === user?.id || g.owner === user?.id ? 'Owner' : 'Member'}`,
      group: g
    }))
  ], [groups, user]);

  const currentScopeObj = useMemo(() => {
    return availableScopes.find(s => s.id === filterGroup) || availableScopes[0];
  }, [availableScopes, filterGroup]);

  // Scope Swipe & Fluid Animation States
  const [scopeDragOffset, setScopeDragOffset] = useState(0);
  const [isScopeDragging, setIsScopeDragging] = useState(false);
  const [scopeAnimDirection, setScopeAnimDirection] = useState(null); // 'left' | 'right' | null
  const [scopeAnimKey, setScopeAnimKey] = useState(0);

  const triggerAnimatedScopeSwitch = (direction) => {
    if (availableScopes.length <= 1) return;

    // Single vibration pulse feedback for scope switch
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(35);
      } catch {}
    }

    // Set animation direction:
    // If switching 'next' (swiped left), the incoming badge slides in from right ('right')
    // If switching 'prev' (swiped right), the incoming badge slides in from left ('left')
    setScopeAnimDirection(direction === 'next' ? 'right' : 'left');
    setScopeAnimKey(prev => prev + 1);

    const currentIndex = availableScopes.findIndex(s => s.id === filterGroup);
    let nextIndex = 0;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % availableScopes.length;
    } else {
      nextIndex = (currentIndex - 1 + availableScopes.length) % availableScopes.length;
    }
    const nextScope = availableScopes[nextIndex];
    if (nextScope) {
      handleFilterGroupChange(nextScope.id);
    }
  };

  const cycleScope = (direction) => {
    triggerAnimatedScopeSwitch(direction);
  };

  const scopeTouchRef = useRef({ startX: 0, startY: 0, startTime: 0, isSwiping: false, isScrolling: false });
  const didScopeSwipeRef = useRef(false);

  const onScopeTouchStart = (e) => {
    e.stopPropagation();
    const t = e.touches[0];
    scopeTouchRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      startTime: Date.now(),
      isSwiping: false,
      isScrolling: false
    };
    didScopeSwipeRef.current = false;
  };

  const onScopeTouchMove = (e) => {
    e.stopPropagation();
    const t = e.touches[0];
    const dx = t.clientX - scopeTouchRef.current.startX;
    const dy = t.clientY - scopeTouchRef.current.startY;

    // Distinguish vertical scrolling from horizontal swiping
    if (!scopeTouchRef.current.isSwiping && !scopeTouchRef.current.isScrolling) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        scopeTouchRef.current.isScrolling = true;
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        scopeTouchRef.current.isSwiping = true;
      }
    }

    if (scopeTouchRef.current.isScrolling) return;

    if (scopeTouchRef.current.isSwiping) {
      didScopeSwipeRef.current = true;
      setIsScopeDragging(true);
      // Dampened touch-follow offset for smooth physical tracking
      const damped = dx > 0 ? Math.min(dx * 0.65, 45) : Math.max(dx * 0.65, -45);
      setScopeDragOffset(damped);
    }
  };

  const onScopeTouchEnd = (e) => {
    e.stopPropagation();
    const t = e.changedTouches ? e.changedTouches[0] : null;
    setIsScopeDragging(false);
    setScopeDragOffset(0);

    if (!t || scopeTouchRef.current.isScrolling) {
      scopeTouchRef.current.isSwiping = false;
      scopeTouchRef.current.isScrolling = false;
      return;
    }

    const dx = t.clientX - scopeTouchRef.current.startX;
    const dy = t.clientY - scopeTouchRef.current.startY;
    const dt = Date.now() - scopeTouchRef.current.startTime;

    const isQuickFlick = dt < 350 && Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy);
    const isDragSwipe = Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy);

    if (isQuickFlick || isDragSwipe) {
      didScopeSwipeRef.current = true;
      const direction = dx > 0 ? 'prev' : 'next';
      triggerAnimatedScopeSwitch(direction);
    } else if (didScopeSwipeRef.current) {
      // Swiped slightly but canceled; prevent opening modal accidentally
      setTimeout(() => {
        didScopeSwipeRef.current = false;
      }, 150);
    }

    scopeTouchRef.current.isSwiping = false;
    scopeTouchRef.current.isScrolling = false;
  };

  const handleScopeBoxClick = () => {
    if (didScopeSwipeRef.current) {
      didScopeSwipeRef.current = false;
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(25); } catch {}
    }
    setShowScopeModal(true);
  };

  // Tab Slider Track & Touch Gesture States
  const APP_TABS = useMemo(() => ['track', 'history', 'groups', 'settings'], []);
  const trackRef = useRef(null);
  const tabPanesRef = useRef([]);
  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isSwiping: false,
    isScrolling: false,
    currentDx: 0
  });
  const didTabSwipeRef = useRef(false);

  const switchTab = (targetTab, withVibration = true) => {
    const targetIdx = APP_TABS.indexOf(targetTab);
    if (targetIdx === -1) return;

    if (withVibration && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(25); } catch {}
    }

    if (targetTab === activeTab) {
      // If tapping active tab in bottom nav, smoothly scroll pane to top
      const pane = tabPanesRef.current[targetIdx];
      if (pane) {
        pane.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    setActiveTab(targetTab);
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1)';
      trackRef.current.style.transform = `translateX(-${targetIdx * 25}%)`;
    }
  };

  useEffect(() => {
    const idx = APP_TABS.indexOf(activeTab);
    if (idx !== -1 && trackRef.current) {
      trackRef.current.style.transform = `translateX(-${idx * 25}%)`;
    }
  }, [activeTab, APP_TABS]);

  const onSliderTouchStart = (e) => {
    // If modal is open, or multi-select active, ignore
    if (
      selectedTransactionDetails ||
      selectedGroupDetails ||
      showPersonalAnalytics ||
      showScopeModal ||
      confirmModal ||
      showNotificationsTray ||
      passwordResetUser ||
      showAdminPanel ||
      selectedHistoryIds.length > 0
    ) {
      touchStateRef.current.isScrolling = true;
      return;
    }

    // If user is actively typing in an input/textarea, don't hijack
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active === e.target) {
      touchStateRef.current.isScrolling = true;
      return;
    }

    const t = e.touches[0];
    touchStateRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      startTime: Date.now(),
      isSwiping: false,
      isScrolling: false,
      currentDx: 0
    };
    didTabSwipeRef.current = false;
  };

  const onSliderTouchMove = (e) => {
    if (touchStateRef.current.isScrolling) return;

    const t = e.touches[0];
    const dx = t.clientX - touchStateRef.current.startX;
    const dy = t.clientY - touchStateRef.current.startY;

    if (!touchStateRef.current.isSwiping) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Wait until at least 7px of movement to be sure
      if (absX < 7 && absY < 7) return;

      // If horizontal movement is greater than or equal to vertical, it's a swipe!
      if (absX >= absY) {
        touchStateRef.current.isSwiping = true;
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
        }
      } else {
        // Vertical scroll
        touchStateRef.current.isScrolling = true;
        return;
      }
    }

    if (touchStateRef.current.isSwiping) {
      touchStateRef.current.currentDx = dx;

      const currentIdx = APP_TABS.indexOf(activeTab);
      let effectiveDx = dx;

      // Rubber band resistance at boundaries
      if ((currentIdx === 0 && dx > 0) || (currentIdx === APP_TABS.length - 1 && dx < 0)) {
        effectiveDx = dx * 0.25;
      }

      if (trackRef.current) {
        const basePercent = -(currentIdx * 25);
        trackRef.current.style.transform = `translateX(calc(${basePercent}% + ${effectiveDx}px))`;
      }
    }
  };

  const onSliderTouchEnd = (e) => {
    if (touchStateRef.current.isScrolling && !touchStateRef.current.isSwiping) {
      touchStateRef.current.isScrolling = false;
      return;
    }

    if (touchStateRef.current.isSwiping) {
      const dx = touchStateRef.current.currentDx;
      const dt = Math.max(Date.now() - touchStateRef.current.startTime, 1);
      const velocity = Math.abs(dx) / dt;
      const currentIdx = APP_TABS.indexOf(activeTab);

      let targetIdx = currentIdx;

      // Switching criteria:
      // Dragged > 38px OR quick flick (velocity > 0.20 and moved > 14px)
      if (Math.abs(dx) > 38 || (velocity > 0.20 && Math.abs(dx) > 14)) {
        if (dx < 0 && currentIdx < APP_TABS.length - 1) {
          // Swiped right-to-left: go to next tab
          targetIdx = currentIdx + 1;
        } else if (dx > 0 && currentIdx > 0) {
          // Swiped left-to-right: go to prev tab
          targetIdx = currentIdx - 1;
        }
      }

      if (targetIdx !== currentIdx) {
        didTabSwipeRef.current = true;
        setTimeout(() => { didTabSwipeRef.current = false; }, 200);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(20); } catch {}
        }
        switchTab(APP_TABS[targetIdx], false);
      } else {
        // Snap back to current tab with smooth easing
        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)';
          trackRef.current.style.transform = `translateX(-${currentIdx * 25}%)`;
        }
      }

      touchStateRef.current.isSwiping = false;
      touchStateRef.current.isScrolling = false;
    }
  };

  const handleMainClickCapture = (e) => {
    if (didTabSwipeRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const renderScopeSelector = () => (
    <div
      data-no-swipe="true"
      onTouchStart={onScopeTouchStart}
      onTouchMove={onScopeTouchMove}
      onTouchEnd={onScopeTouchEnd}
      onClick={handleScopeBoxClick}
      style={{
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        background: isScopeDragging 
          ? (theme === 'light' ? '#f0f7ff' : 'rgba(37, 99, 235, 0.08)')
          : 'var(--surface-subtle)',
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        border: isScopeDragging ? '1.5px solid var(--primary-color)' : '1.5px solid var(--card-border)',
        cursor: isScopeDragging ? 'grabbing' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'pan-y',
        position: 'relative',
        overflow: 'hidden',
        transition: isScopeDragging ? 'none' : 'border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease',
        boxShadow: isScopeDragging ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'var(--shadow-sm)'
      }}
      title="Tap to open scope window, or swipe left/right to switch"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', flexShrink: 0 }}>
          Scope:
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div
            key={`${filterGroup}-${scopeAnimKey}`}
            className={
              !isScopeDragging && scopeAnimDirection === 'right'
                ? 'scope-pill-anim-right'
                : !isScopeDragging && scopeAnimDirection === 'left'
                  ? 'scope-pill-anim-left'
                  : ''
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-primary)',
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transform: isScopeDragging ? `translateX(${scopeDragOffset}px)` : undefined,
              transition: isScopeDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
              boxShadow: isScopeDragging ? 'var(--shadow-md)' : undefined,
              willChange: 'transform, opacity'
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentScopeObj.name}
            </span>
          </div>

          {/* Scope Indicator Dots */}
          {availableScopes.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {availableScopes.map((scope) => {
                const isActive = scope.id === filterGroup;
                const dotColor = isActive
                  ? (theme === 'light' ? '#1d4ed8' : 'var(--primary-color)')
                  : (theme === 'light' ? '#64748b' : 'rgba(255, 255, 255, 0.35)');
                return (
                  <span
                    key={scope.id}
                    style={{
                      height: '5px',
                      width: isActive ? '14px' : '5px',
                      borderRadius: '3px',
                      backgroundColor: dotColor,
                      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isActive 
                        ? (theme === 'light' ? '0 1px 3px rgba(29, 78, 216, 0.35)' : '0 1px 4px rgba(37, 99, 235, 0.6)')
                        : 'none'
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cycleScope('prev');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: scopeDragOffset > 15 ? 'var(--primary-color)' : 'var(--text-muted)',
            transform: scopeDragOffset > 15 ? 'scale(1.2)' : 'scale(1)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          title="Previous Scope"
          aria-label="Previous Scope"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cycleScope('next');
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: scopeDragOffset < -15 ? 'var(--primary-color)' : 'var(--text-muted)',
            transform: scopeDragOffset < -15 ? 'scale(1.2)' : 'scale(1)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          title="Next Scope"
          aria-label="Next Scope"
        >
          <ChevronRight size={16} />
        </button>
        <div style={{ width: '1px', height: '14px', background: 'var(--card-border)', margin: '0 2px' }} />
        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}>
          <ChevronDown size={15} />
        </div>
      </div>
    </div>
  );
  
  // Custom Confirm Modal State
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm, requiresPassword }
  const [confirmPassword, setConfirmPassword] = useState('');
  const showConfirm = (message, onConfirm, requiresPassword = false) => {
    setConfirmPassword('');
    setConfirmModal({ message, onConfirm, requiresPassword });
  };

  // Group Details & Budget Analytics States
  const [selectedGroupDetails, setSelectedGroupDetails] = useState(null); // Group object for details view modal
  const [groupBudgetInput, setGroupBudgetInput] = useState('');
  const [showPersonalAnalytics, setShowPersonalAnalytics] = useState(false);
  const [personalBudgetInput, setPersonalBudgetInput] = useState('');

  const [copiedCode, setCopiedCode] = useState('');
  const [scriptCopied, setScriptCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSheetUrl, setNewGroupSheetUrl] = useState('');
  const [groupSheetUrls, setGroupSheetUrls] = useState({}); // { [groupId]: sheetUrl }
  const [groupNames, setGroupNames] = useState({}); // { [groupId]: name }
  const [showSheetScriptInstructions, setShowSheetScriptInstructions] = useState(false);

  // Data States
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // History Tab Filter & Sort States
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState('all');
  const [historySortBy, setHistorySortBy] = useState('date_desc');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historySelectedMonth, setHistorySelectedMonth] = useState(() => new Date().getMonth());
  const [historySelectedYear, setHistorySelectedYear] = useState(() => new Date().getFullYear());
  const [historyViewAll, setHistoryViewAll] = useState(false);
  const currentMonthName = useMemo(() => new Date().toLocaleString('en-US', { month: 'long' }), []);
  
  // History Selection & Long-Press States
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);
  const [pressingHistoryId, setPressingHistoryId] = useState(null);
  const longPressTimerRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggeredRef = useRef(false);
  const longPressedItemIdRef = useRef(null);

  const [selectedTransactionDetails, setSelectedTransactionDetails] = useState(null);

  // Close transaction details on Escape key
  useEffect(() => {
    if (!selectedTransactionDetails) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedTransactionDetails(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTransactionDetails]);

  // Clear selection if tab or filter changes
  useEffect(() => {
    setSelectedHistoryIds([]);
    setSelectedTransactionDetails(null);
  }, [activeTab, historyCategoryFilter, historyStartDate, historyEndDate]);

  // Shared Group Personal Linking State
  const [linkedPersonalGroups, setLinkedPersonalGroups] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      if (parsedUser && Array.isArray(parsedUser.linkedPersonalGroups)) {
        return parsedUser.linkedPersonalGroups;
      }
      const myId = parsedUser ? (parsedUser.id || parsedUser._id) : 'default';
      const localStored = localStorage.getItem(`linkedPersonalGroups_${myId}`);
      return localStored ? JSON.parse(localStored) : [];
    } catch {
      return [];
    }
  });

  // Sync linkedPersonalGroups when user object changes
  useEffect(() => {
    if (user && Array.isArray(user.linkedPersonalGroups)) {
      setLinkedPersonalGroups(user.linkedPersonalGroups);
    }
  }, [user]);
  
  // Settings Tab Category Scope State
  const [settingsCategoryScope, setSettingsCategoryScope] = useState('personal');
  
  // Group Details Analytics Date Filters
  const [analyticsFromDate, setAnalyticsFromDate] = useState('');
  const [analyticsToDate, setAnalyticsToDate] = useState('');
  const [analyticsSelectedMonth, setAnalyticsSelectedMonth] = useState(() => new Date().getMonth());
  const [analyticsSelectedYear, setAnalyticsSelectedYear] = useState(() => new Date().getFullYear());
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [alert, setAlert] = useState(null); // { message, type, sheetError }
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Set Authorization Header
  const getHeaders = () => ({
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // Sync Offline Queue to server
  const syncOfflineQueue = async () => {
    if (!navigator.onLine || !localStorage.getItem('token')) return;
    
    try {
      const queue = await getQueue();
      if (queue.length === 0) return;

      setSyncLoading(true);
      let successCount = 0;

      for (const item of queue) {
        try {
          if (item.type === 'add_transaction') {
            await axios.post(`${API_BASE}/transactions`, item.data, getHeaders());
          } else if (item.type === 'delete_transaction') {
            await axios.delete(`${API_BASE}/transactions/${item.data.id}`, getHeaders());
          } else if (item.type === 'add_category') {
            await axios.post(`${API_BASE}/categories`, item.data, getHeaders());
          } else if (item.type === 'delete_category') {
            await axios.delete(`${API_BASE}/categories/${item.data.id}`, getHeaders());
          }
          await removeFromQueue(item.id);
          successCount++;
        } catch (err) {
          console.error('Failed to sync offline item:', item, err);
          if (err.response && (err.response.status >= 400 && err.response.status < 500)) {
            // Delete corrupt queue item
            await removeFromQueue(item.id);
          } else {
            // Server or network error, stop queue processing to retry later
            break;
          }
        }
      }

      if (successCount > 0) {
        showAlert(`Synced ${successCount} offline action(s) successfully!`, 'success');
        // Fetch fresh copy from server
        const [transRes, catRes, groupsRes] = await Promise.all([
          axios.get(`${API_BASE}/transactions`, getHeaders()),
          axios.get(`${API_BASE}/categories`, getHeaders()),
          axios.get(`${API_BASE}/groups`, getHeaders()).catch(() => ({ data: { success: true, data: [] } }))
        ]);

        if (transRes.data.success) {
          setTransactions(transRes.data.data);
          await saveTransactions(transRes.data.data);
        }
        if (catRes.data.success) {
          setCategories(catRes.data.data);
          await saveCategories(catRes.data.data);
        }
        if (groupsRes && groupsRes.data && groupsRes.data.success) {
          setGroups(groupsRes.data.data);
          await saveGroups(groupsRes.data.data);
        }
      }
    } catch (err) {
      console.error('Error syncing offline queue:', err);
    } finally {
      setSyncLoading(false);
    }
  };

  // Event Listeners for Online/Offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showAlert('Connection restored! Syncing offline entries...', 'success');
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showAlert('You are offline. Entries will be saved locally.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check on mount if online
    if (navigator.onLine && token) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [token]);

  // Clear Alerts after 8s
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // Sync group sheets and names input states when groups list changes
  useEffect(() => {
    if (groups && groups.length > 0) {
      const urls = {};
      const names = {};
      groups.forEach(g => {
        urls[g._id] = g.sheetUrl || '';
        names[g._id] = g.name || '';
      });
      setGroupSheetUrls(urls);
      setGroupNames(names);
    }
  }, [groups]);

  // Reset analytics date range filters when group selection changes
  useEffect(() => {
    if (selectedGroupDetails) {
      setAnalyticsFromDate('');
      setAnalyticsToDate('');
    }
  }, [selectedGroupDetails]);

  // Reset admin panel state when leaving Settings tab
  useEffect(() => {
    if (activeTab !== 'settings') {
      setShowAdminPanel(false);
    }
  }, [activeTab]);

  // Auto-hide scrollbars: reveal scrollbar thumb only when actively scrolling
  useEffect(() => {
    const scrollTimers = new Map();
    const handleScrollCapture = (e) => {
      const target = e.target;
      if (!target || target === document || target === window) return;
      if (target.classList && !target.classList.contains('is-scrolling')) {
        target.classList.add('is-scrolling');
      }
      if (scrollTimers.has(target)) {
        clearTimeout(scrollTimers.get(target));
      }
      scrollTimers.set(
        target,
        setTimeout(() => {
          if (target && target.classList) {
            target.classList.remove('is-scrolling');
          }
          scrollTimers.delete(target);
        }, 800)
      );
    };

    window.addEventListener('scroll', handleScrollCapture, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollCapture, { capture: true });
      scrollTimers.forEach(timer => clearTimeout(timer));
      scrollTimers.clear();
    };
  }, []);

  // Load Initial Data when token changes
  useEffect(() => {
    if (token) {
      fetchData();
      fetchNotifications();
      if (user) {
        setSheetUrlForm(user.sheetUrl || '');
      }

      // Check active device push subscription and prefetch VAPID key
      const checkSubscription = async () => {
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            setIsSubscribedToPush(!!sub);

            // Prefetch VAPID public key in background so 'Enable' click is instant
            if (!cachedVapidPublicKey) {
              axios.get(`${API_BASE}/notifications/vapid-key`, getHeaders())
                .then(res => {
                  if (res.data?.success && res.data?.publicKey) {
                    cachedVapidPublicKey = res.data.publicKey;
                  }
                })
                .catch(() => {});
            }
          } catch (e) {
            console.error('Error checking push subscription:', e);
          }
        }
      };
      checkSubscription();
    } else {
      setTransactions([]);
      setCategories([]);
      setGroups([]);
      setNotifications([]);
      setUnreadNotificationsCount(0);
      setIsSubscribedToPush(false);
    }
  }, [token]);

  // Set up periodic background data synchronization (dynamic updates without reload)
  useEffect(() => {
    if (!token) return;
    
    const handleInterval = () => {
      if (document.visibilityState === 'visible') {
        syncDataBackground();
      }
    };

    const interval = setInterval(handleInterval, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const fetchNotifications = async () => {
    if (!token || !navigator.onLine) return;
    try {
      const res = await axios.get(`${API_BASE}/notifications`, getHeaders());
      if (res.data.success) {
        setNotifications(res.data.data);
        const unread = res.data.data.filter(n => !n.isRead).length;
        setUnreadNotificationsCount(unread);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err.message);
    }
  };

  const markNotificationsAsRead = async (notificationId = null) => {
    if (!token || !navigator.onLine) return;
    try {
      const res = await axios.put(`${API_BASE}/notifications/read`, { notificationId }, getHeaders());
      if (res.data.success) {
        setNotifications(prev =>
          prev.map(n => {
            if (notificationId) {
              return n._id === notificationId ? { ...n, isRead: true } : n;
            } else {
              return { ...n, isRead: true };
            }
          })
        );
        if (notificationId) {
          setUnreadNotificationsCount(prev => Math.max(0, prev - 1));
        } else {
          setUnreadNotificationsCount(0);
        }
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err.message);
    }
  };

  const togglePushSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showAlert('Push notifications are not supported on this browser/device.', 'error');
      return;
    }

    setIsPushLoading(true);

    try {
      const reg = await navigator.serviceWorker.ready;

      if (isSubscribedToPush) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await axios.post(`${API_BASE}/notifications/unsubscribe`, { endpoint: sub.endpoint }, getHeaders());
        }
        setIsSubscribedToPush(false);
        showAlert('Successfully disabled push notifications on this device.', 'success');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showAlert('Notification permission was denied. Please enable notifications in your browser settings.', 'error');
          setIsPushLoading(false);
          return;
        }

        // Get VAPID public key (from memory cache if available, or fetch once)
        let publicKey = cachedVapidPublicKey;
        if (!publicKey) {
          const keyRes = await axios.get(`${API_BASE}/notifications/vapid-key`, getHeaders());
          if (!keyRes.data?.success || !keyRes.data?.publicKey) {
            throw new Error('VAPID key not configured on server.');
          }
          publicKey = keyRes.data.publicKey;
          cachedVapidPublicKey = publicKey;
        }

        const convertedKey = urlBase64ToUint8Array(publicKey);
        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });

        await axios.post(`${API_BASE}/notifications/subscribe`, { subscription: newSub }, getHeaders());

        setIsSubscribedToPush(true);
        showAlert('Push notifications enabled successfully!', 'success');
      }
    } catch (err) {
      console.error('Push subscription toggling error:', err);
      showAlert(err.response?.data?.message || err.message || 'Failed to toggle push notifications.', 'error');
    } finally {
      setIsPushLoading(false);
    }
  };

  const clearNotifications = async () => {
    if (!token || !navigator.onLine) return;
    try {
      const res = await axios.delete(`${API_BASE}/notifications`, getHeaders());
      if (res.data.success) {
        setNotifications([]);
        setUnreadNotificationsCount(0);
        showAlert('All notifications cleared successfully!', 'success');
      }
    } catch (err) {
      console.error('Error clearing notifications:', err.message);
      showAlert(err.response?.data?.message || 'Failed to clear notifications.', 'error');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    // Load local cache first so it renders instantly
    const cachedTrans = await getTransactions();
    const cachedCats = await getCategories();
    const cachedGroups = await getGroups();
    
    if (cachedTrans.length > 0) setTransactions(cachedTrans);
    if (cachedCats.length > 0) {
      setCategories(cachedCats);
      setTransactionForm(prev => ({ ...prev, category: findDefaultCategory(cachedCats) }));
    }
    if (cachedGroups.length > 0) setGroups(cachedGroups);

    // If offline, stop here
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    try {
      // Sync offline queue first before loading fresh data
      await syncOfflineQueue();

      const [transRes, catRes, groupsRes, notifRes] = await Promise.all([
        axios.get(`${API_BASE}/transactions`, getHeaders()),
        axios.get(`${API_BASE}/categories`, getHeaders()),
        axios.get(`${API_BASE}/groups`, getHeaders()).catch(() => ({ data: { success: true, data: [] } })),
        axios.get(`${API_BASE}/notifications`, getHeaders()).catch(() => null)
      ]);

      if (transRes.data.success) {
        setTransactions(transRes.data.data);
        await saveTransactions(transRes.data.data);
      }
      if (catRes.data.success) {
        setCategories(catRes.data.data);
        await saveCategories(catRes.data.data);
        if (catRes.data.data.length > 0) {
          setTransactionForm(prev => ({ ...prev, category: findDefaultCategory(catRes.data.data) }));
        }
      }
      if (groupsRes && groupsRes.data && groupsRes.data.success) {
        const fetchedGroups = groupsRes.data.data;
        setGroups(fetchedGroups);
        await saveGroups(fetchedGroups);
        
        // Reset filter if the stored group ID no longer exists
        const currentFilter = localStorage.getItem('filterGroup') || 'personal';
        if (currentFilter !== 'personal') {
          const exists = fetchedGroups.some(g => g._id === currentFilter);
          if (!exists) {
            setFilterGroup('personal');
            localStorage.setItem('filterGroup', 'personal');
          }
        }
      }
      if (notifRes && notifRes.data && notifRes.data.success) {
        setNotifications(notifRes.data.data);
        const unread = notifRes.data.data.filter(n => !n.isRead).length;
        setUnreadNotificationsCount(unread);
      }
    } catch (err) {
      if (err.message !== 'Network Error') {
        showAlert(err.response?.data?.message || 'Failed to fetch dashboard data', 'error');
      }
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const syncDataBackground = async () => {
    if (!token || !navigator.onLine) return;
    try {
      // Try to sync offline queue first if there are pending items
      const queue = await getQueue();
      if (queue.length > 0) {
        await syncOfflineQueue();
      }

      const [transRes, catRes, groupsRes, meRes, notifRes] = await Promise.all([
        axios.get(`${API_BASE}/transactions`, getHeaders()),
        axios.get(`${API_BASE}/categories`, getHeaders()),
        axios.get(`${API_BASE}/groups`, getHeaders()).catch(() => ({ data: { success: true, data: [] } })),
        axios.get(`${API_BASE}/auth/me`, getHeaders()).catch(() => null),
        axios.get(`${API_BASE}/notifications`, getHeaders()).catch(() => null)
      ]);

      if (transRes.data.success) {
        setTransactions(transRes.data.data);
        await saveTransactions(transRes.data.data);
      }
      if (catRes.data.success) {
        setCategories(catRes.data.data);
        await saveCategories(catRes.data.data);
      }
      if (groupsRes && groupsRes.data && groupsRes.data.success) {
        const fetchedGroups = groupsRes.data.data;
        setGroups(fetchedGroups);
        await saveGroups(fetchedGroups);
        
        // Reset filter if the stored group ID no longer exists
        const currentFilter = localStorage.getItem('filterGroup') || 'personal';
        if (currentFilter !== 'personal') {
          const exists = fetchedGroups.some(g => g._id === currentFilter);
          if (!exists) {
            setFilterGroup('personal');
            localStorage.setItem('filterGroup', 'personal');
          }
        }
      }
      if (meRes && meRes.data && meRes.data.success) {
        const updatedUser = meRes.data.user;
        if (
          !user ||
          updatedUser.username !== user.username ||
          updatedUser.email !== user.email ||
          updatedUser.profilePic !== user.profilePic ||
          updatedUser.sheetUrl !== user.sheetUrl
        ) {
          setAndStoreUser(updatedUser);
        }
      }
      if (notifRes && notifRes.data && notifRes.data.success) {
        setNotifications(notifRes.data.data);
        const unread = notifRes.data.data.filter(n => !n.isRead).length;
        setUnreadNotificationsCount(unread);
      }
    } catch (err) {
      console.error('Background sync failed:', err);
    }
  };

  const showAlert = (message, type, sheetError = null) => {
    setAlert({ message, type, sheetError });
  };

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = authMode === 'login' ? 'login' : 'signup';
      const response = await axios.post(`${API_BASE}/auth/${endpoint}`, authForm);
      
      if (response.data.success) {
        const { token: userToken, user: userData } = response.data;
        localStorage.setItem('token', userToken);
        setToken(userToken);
        setAndStoreUser(userData);
        setSheetUrlForm(userData.sheetUrl || '');
        showAlert(`Successfully logged in as ${userData.username}!`, 'success');
        setAuthForm({ username: '', email: '', password: '' });
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setAndStoreUser(null);
    switchTab('track');
    showAlert('Logged out successfully', 'success');
  };

  // Transaction Operations
  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(40); } catch {}
    }
    if (!transactionForm.itemName || !transactionForm.cost || !transactionForm.category || !transactionForm.date) {
      showAlert('Please fill in Item Name, Cost, Category, and Date', 'error');
      return;
    }

    const activeGroupId = filterGroup === 'personal' ? undefined : filterGroup;
    const payload = {
      itemName: transactionForm.itemName,
      cost: Number(transactionForm.cost),
      quantity: Number(transactionForm.quantity) || 1,
      category: transactionForm.category,
      date: transactionForm.date,
      groupId: activeGroupId
    };

    if (!navigator.onLine) {
      const tempId = `temp-${Date.now()}`;
      const localTransaction = {
        ...payload,
        _id: tempId,
        isPending: true,
        createdAt: new Date().toISOString(),
        user: user?.id || user?._id || 'temp-user'
      };

      setTransactions(prev => [localTransaction, ...prev]);
      await addToQueue('add_transaction', payload);
      
      const currentTrans = await getTransactions();
      await saveTransactions([localTransaction, ...currentTrans]);

      setTransactionForm(prev => ({
        ...prev,
        itemName: '',
        cost: '',
        quantity: '1'
      }));
      
      showAlert('Saved locally. Will sync when online.', 'warning');
      return;
    }

    setSyncLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/transactions`, payload, getHeaders());

      if (response.data.success) {
        setTransactions(prev => [response.data.data, ...prev]);
        const currentTrans = await getTransactions();
        await saveTransactions([response.data.data, ...currentTrans]);

        setTransactionForm(prev => ({
          ...prev,
          itemName: '',
          cost: '',
          quantity: '1'
        }));
        
        showAlert('Transaction saved successfully!', 'success');
      }
    } catch (err) {
      if (err.message === 'Network Error') {
        const tempId = `temp-${Date.now()}`;
        const localTransaction = {
          ...payload,
          _id: tempId,
          isPending: true,
          createdAt: new Date().toISOString(),
          user: user?.id || user?._id || 'temp-user'
        };

        setTransactions(prev => [localTransaction, ...prev]);
        await addToQueue('add_transaction', payload);
        
        const currentTrans = await getTransactions();
        await saveTransactions([localTransaction, ...currentTrans]);

        setTransactionForm(prev => ({
          ...prev,
          itemName: '',
          cost: '',
          quantity: '1'
        }));
        
        showAlert('Saved locally. Will sync when online.', 'warning');
      } else {
        showAlert(err.response?.data?.message || 'Failed to save transaction', 'error');
      }
    } finally {
      setSyncLoading(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    if (typeof id === 'string' && id.startsWith('group-summary-')) {
      showAlert('This is a consolidated group total. Manage individual expenses inside the group view.', 'info');
      return;
    }
    showConfirm('Are you sure you want to delete this transaction?', async () => {
      setSelectedHistoryIds(prev => prev.filter(itemId => itemId !== id));
      if (id && id.startsWith && id.startsWith('temp-')) {
        setTransactions(prev => prev.filter(t => t._id !== id));
        const currentTrans = await getTransactions();
        await saveTransactions(currentTrans.filter(t => t._id !== id));

        const queue = await getQueue();
        const localTrans = currentTrans.find(t => t._id === id);
        if (localTrans) {
          const queueItem = queue.find(item => 
            item.type === 'add_transaction' && 
            item.data.itemName === localTrans.itemName && 
            item.data.cost === localTrans.cost &&
            item.data.date === localTrans.date
          );
          if (queueItem) {
            await removeFromQueue(queueItem.id);
          }
        }
        showAlert('Unsynced transaction deleted.', 'success');
        return;
      }

      if (!navigator.onLine) {
        setTransactions(prev => prev.filter(t => t._id !== id));
        const currentTrans = await getTransactions();
        await saveTransactions(currentTrans.filter(t => t._id !== id));
        await addToQueue('delete_transaction', { id });
        showAlert('Deleted locally. Sync pending.', 'warning');
        return;
      }

      setSyncLoading(true);
      try {
        const response = await axios.delete(`${API_BASE}/transactions/${id}`, getHeaders());
        if (response.data.success) {
          setTransactions(prev => prev.filter(t => t._id !== id));
          const currentTrans = await getTransactions();
          await saveTransactions(currentTrans.filter(t => t._id !== id));
          showAlert('Transaction deleted successfully!', 'success');
        }
      } catch (err) {
        if (err.message === 'Network Error') {
          setTransactions(prev => prev.filter(t => t._id !== id));
          const currentTrans = await getTransactions();
          await saveTransactions(currentTrans.filter(t => t._id !== id));
          await addToQueue('delete_transaction', { id });
          showAlert('Deleted locally. Sync pending.', 'warning');
        } else {
          showAlert(err.response?.data?.message || 'Failed to delete transaction', 'error');
        }
      } finally {
        setSyncLoading(false);
      }
    });
  };

  // Category Operations
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name) return;

    const payload = {
      ...categoryForm,
      group: settingsCategoryScope === 'personal' ? undefined : settingsCategoryScope
    };

    if (!navigator.onLine) {
      const tempId = `temp-cat-${Date.now()}`;
      const localCat = {
        ...payload,
        _id: tempId,
        isPending: true,
        user: user?.id || user?._id || 'temp-user'
      };

      setCategories(prev => [...prev, localCat].sort((a, b) => a.name.localeCompare(b.name)));
      setTransactionForm(prev => ({ ...prev, category: localCat.name }));
      await addToQueue('add_category', payload);
      
      const currentCats = await getCategories();
      await saveCategories([...currentCats, localCat]);

      setCategoryForm({ name: '', color: '#2563eb' });
      showAlert('Category saved locally. Will sync when online.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/categories`, payload, getHeaders());
      if (response.data.success) {
        setCategories(prev => [...prev, response.data.data].sort((a, b) => a.name.localeCompare(b.name)));
        setTransactionForm(prev => ({ ...prev, category: response.data.data.name }));
        
        const currentCats = await getCategories();
        await saveCategories([...currentCats, response.data.data]);

        setCategoryForm({ name: '', color: '#2563eb' });
        showAlert('New category created!', 'success');
      }
    } catch (err) {
      if (err.message === 'Network Error') {
        const tempId = `temp-cat-${Date.now()}`;
        const localCat = {
          ...payload,
          _id: tempId,
          isPending: true,
          user: user?.id || user?._id || 'temp-user'
        };

        setCategories(prev => [...prev, localCat].sort((a, b) => a.name.localeCompare(b.name)));
        setTransactionForm(prev => ({ ...prev, category: localCat.name }));
        await addToQueue('add_category', payload);
        
        const currentCats = await getCategories();
        await saveCategories([...currentCats, localCat]);

        setCategoryForm({ name: '', color: '#2563eb' });
        showAlert('Category saved locally. Will sync when online.', 'warning');
      } else {
        showAlert(err.response?.data?.message || 'Failed to create category', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    showConfirm(`Delete category "${name}"? This won't delete existing transactions.`, async () => {
      if (id && id.startsWith && id.startsWith('temp-cat-')) {
        setCategories(prev => prev.filter(c => c._id !== id));
        const currentCats = await getCategories();
        await saveCategories(currentCats.filter(c => c._id !== id));

        const queue = await getQueue();
        const localCat = currentCats.find(c => c._id === id);
        if (localCat) {
          const queueItem = queue.find(item => 
            item.type === 'add_category' && 
            item.data.name === localCat.name
          );
          if (queueItem) {
            await removeFromQueue(queueItem.id);
          }
        }

        if (transactionForm.category === name) {
          const remaining = categories.filter(c => c._id !== id);
          setTransactionForm(prev => ({ ...prev, category: findDefaultCategory(remaining) }));
        }
        showAlert('Unsynced category deleted.', 'success');
        return;
      }

      if (!navigator.onLine) {
        setCategories(prev => prev.filter(c => c._id !== id));
        const currentCats = await getCategories();
        await saveCategories(currentCats.filter(c => c._id !== id));
        await addToQueue('delete_category', { id });
        
        if (transactionForm.category === name) {
          const remaining = categories.filter(c => c._id !== id);
          setTransactionForm(prev => ({ ...prev, category: findDefaultCategory(remaining) }));
        }
        showAlert('Category deleted locally. Sync pending.', 'warning');
        return;
      }

      setLoading(true);
      try {
        const response = await axios.delete(`${API_BASE}/categories/${id}`, getHeaders());
        if (response.data.success) {
          setCategories(prev => prev.filter(c => c._id !== id));
          const currentCats = await getCategories();
          await saveCategories(currentCats.filter(c => c._id !== id));

          if (transactionForm.category === name) {
            const remaining = categories.filter(c => c._id !== id);
            setTransactionForm(prev => ({ ...prev, category: findDefaultCategory(remaining) }));
          }
          showAlert('Category removed successfully', 'success');
        }
      } catch (err) {
        if (err.message === 'Network Error') {
          setCategories(prev => prev.filter(c => c._id !== id));
          const currentCats = await getCategories();
          await saveCategories(currentCats.filter(c => c._id !== id));
          await addToQueue('delete_category', { id });
          
          if (transactionForm.category === name) {
            const remaining = categories.filter(c => c._id !== id);
            setTransactionForm(prev => ({ ...prev, category: findDefaultCategory(remaining) }));
          }
          showAlert('Category deleted locally. Sync pending.', 'warning');
        } else {
          showAlert(err.response?.data?.message || 'Failed to delete category', 'error');
        }
      } finally {
        setLoading(false);
      }
    });
  };

  const canDeleteCategory = (cat) => {
    if (cat.isDefault) return false;
    if (cat.group) {
      const grpId = cat.group._id || cat.group;
      const grp = groups.find(g => g._id === grpId);
      return grp && (grp.owner?._id === user?.id || grp.owner === user?.id);
    }
    return true; // Personal category
  };

  // Google Sheet URL settings
  const handleSheetUrlSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.put(`${API_BASE}/auth/sheeturl`, { sheetUrl: sheetUrlForm }, getHeaders());
      if (response.data.success) {
        const updatedUser = response.data.user;
        setAndStoreUser(updatedUser);
        showAlert('Google Sheet Apps Script URL updated!', 'success');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to update URL', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showAlert('File is too large. Please select an image under 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const base64Data = canvas.toDataURL('image/jpeg', 0.85);
        setProfileForm(prev => ({ ...prev, profilePic: base64Data }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.put(`${API_BASE}/auth/profile`, {
        username: profileForm.username,
        email: profileForm.email,
        profilePic: profileForm.profilePic,
        budget: profileForm.budget !== '' ? Number(profileForm.budget) : 0,
        telegramChatId: profileForm.telegramChatId,
        activeTelegramGroup: profileForm.activeTelegramGroup,
        currentPassword: profileForm.currentPassword || undefined,
        newPassword: profileForm.newPassword || undefined
      }, getHeaders());

      if (response.data.success) {
        const updatedUser = response.data.user;
        setAndStoreUser(updatedUser);
        setProfileForm(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: ''
        }));
        showAlert('Profile updated successfully!', 'success');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePersonalBudget = async (newBudget) => {
    setLoading(true);
    try {
      const response = await axios.put(`${API_BASE}/auth/profile`, {
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        budget: newBudget !== '' ? Number(newBudget) : 0,
        telegramChatId: user.telegramChatId,
        activeTelegramGroup: user.activeTelegramGroup
      }, getHeaders());

      if (response.data.success) {
        const updatedUser = response.data.user;
        setAndStoreUser(updatedUser);
        showAlert('Personal monthly budget updated successfully!', 'success');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to update personal budget', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Admin Operations
  const fetchAdminData = async () => {
    setAdminLoading(true);
    try {
      const [usersRes, statusRes] = await Promise.all([
        axios.get(`${API_BASE}/auth/users`, getHeaders()),
        axios.get(`${API_BASE}/auth/signup-status`)
      ]);
      if (usersRes.data.success) {
        setAdminUsers(usersRes.data.users);
      }
      if (statusRes.data.success) {
        setAdminSignupPaused(statusRes.data.isSignupPaused);
        setSignupPaused(statusRes.data.isSignupPaused);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to fetch admin data', 'error');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleToggleSignup = async (pausedVal) => {
    try {
      const response = await axios.put(`${API_BASE}/auth/toggle-signup`, { isSignupPaused: pausedVal }, getHeaders());
      if (response.data.success) {
        setAdminSignupPaused(response.data.isSignupPaused);
        setSignupPaused(response.data.isSignupPaused);
        showAlert(response.data.message, 'success');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to toggle signup status', 'error');
    }
  };

  const handleRemoveUser = async (userId, usernameToDelete, roleToDelete) => {
    if (roleToDelete === 'admin' || usernameToDelete === 'rkdarpan') {
      showAlert('Root/Admin user cannot be deleted', 'error');
      return;
    }
    
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete user "${usernameToDelete}"? This will delete all their transactions, groups, custom categories, and memberships permanently from the DB!`);
    if (!confirmDelete) return;

    try {
      const response = await axios.delete(`${API_BASE}/auth/users/${userId}`, getHeaders());
      if (response.data.success) {
        showAlert(response.data.message, 'success');
        setAdminUsers(prev => prev.filter(u => u._id !== userId));
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const handleSetUserPassword = async (userId, username) => {
    if (!newPasswordForUser || newPasswordForUser.length < 6) {
      showAlert('Password must be at least 6 characters long', 'error');
      return;
    }

    setPasswordSubmitLoading(true);
    try {
      const response = await axios.put(`${API_BASE}/auth/users/${userId}/password`, { password: newPasswordForUser }, getHeaders());
      if (response.data.success) {
        showAlert(response.data.message || `Password for ${username} updated successfully`, 'success');
        setPasswordResetUser(null);
        setNewPasswordForUser('');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to update user password', 'error');
    } finally {
      setPasswordSubmitLoading(false);
    }
  };

  // Group Operations
  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!newGroupName) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/groups`, { name: newGroupName, sheetUrl: newGroupSheetUrl }, getHeaders());
      if (response.data.success) {
        setGroups(prev => [response.data.data, ...prev]);
        setNewGroupName('');
        setNewGroupSheetUrl('');
        showAlert(`Group "${response.data.data.name}" created!`, 'success');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to create group', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroupSubmit = async (e) => {
    e.preventDefault();
    if (!joinCode) return;
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/groups/join`, { inviteCode: joinCode }, getHeaders());
      if (response.data.success) {
        setGroups(prev => [response.data.data, ...prev]);
        setJoinCode('');
        showAlert(response.data.message, 'success');
        fetchData(); // Reload transactions to fetch new group transactions
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to join group', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroupSettings = async (e, groupId) => {
    e.preventDefault();
    const url = groupSheetUrls[groupId] || '';
    const name = groupNames[groupId] || '';
    if (!name.trim()) {
      showAlert('Please provide a group name', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await axios.put(`${API_BASE}/groups/${groupId}`, { name: name.trim(), sheetUrl: url }, getHeaders());
      if (response.data.success) {
        setGroups(prev => prev.map(g => g._id === groupId ? response.data.data : g));
        showAlert('Group settings updated successfully!', 'success');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to update group settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveGroup = async (groupId) => {
    showConfirm('Are you sure you want to leave this group? You will lose access to its collaborative logs.', async () => {
      setLoading(true);
      try {
        const response = await axios.post(`${API_BASE}/groups/${groupId}/leave`, {}, getHeaders());
        if (response.data.success) {
          setGroups(prev => prev.filter(g => g._id !== groupId));
          showAlert(response.data.message, 'success');
          fetchData();
        }
      } catch (err) {
        showAlert(err.response?.data?.message || 'Failed to leave group', 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleDeleteGroup = async (groupId) => {
    showConfirm('Are you sure you want to delete this group? All shared expenses in this group will be deleted for everyone. This action requires your account password to confirm.', async (password) => {
      setLoading(true);
      try {
        const response = await axios.delete(`${API_BASE}/groups/${groupId}`, {
          ...getHeaders(),
          headers: {
            ...getHeaders().headers,
            'X-Confirm-Password': encodeURIComponent(password)
          },
          data: { password }
        });
        if (response.data.success) {
          setGroups(prev => prev.filter(g => g._id !== groupId));
          showAlert(response.data.message, 'success');
          fetchData();
        }
      } catch (err) {
        showAlert(err.response?.data?.message || 'Failed to delete group', 'error');
      } finally {
        setLoading(false);
      }
    }, true);
  };

  const handleRemoveGroupMember = async (groupId, memberId, username) => {
    showConfirm(`Are you sure you want to remove ${username} from this group?`, async () => {
      setLoading(true);
      try {
        const response = await axios.delete(`${API_BASE}/groups/${groupId}/members/${memberId}`, getHeaders());
        if (response.data.success) {
          setGroups(prev => prev.map(g => g._id === groupId ? response.data.data : g));
          showAlert('Member removed successfully', 'success');
        }
      } catch (err) {
        showAlert(err.response?.data?.message || 'Failed to remove member', 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleRegenerateGroupInvite = async (groupId) => {
    showConfirm('Are you sure you want to regenerate the invite code? The old code will stop working immediately.', async () => {
      setLoading(true);
      try {
        const response = await axios.post(`${API_BASE}/groups/${groupId}/regenerate-invite`, {}, getHeaders());
        if (response.data.success) {
          setGroups(prev => prev.map(g => g._id === groupId ? response.data.data : g));
          showAlert('Invite code regenerated!', 'success');
        }
      } catch (err) {
        showAlert(err.response?.data?.message || 'Failed to regenerate invite code', 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleUpdateGroupBudget = async (groupId, budgetValue) => {
    setLoading(true);
    try {
      const response = await axios.put(`${API_BASE}/groups/${groupId}/budget`, { budget: Number(budgetValue) }, getHeaders());
      if (response.data.success) {
        setGroups(prev => prev.map(g => g._id === groupId ? response.data.data : g));
        if (selectedGroupDetails && selectedGroupDetails._id === groupId) {
          setSelectedGroupDetails(response.data.data);
        }
        showAlert('Group budget updated successfully!', 'success');
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'Failed to update group budget', 'error');
    } finally {
      setLoading(false);
    }
  };



  const handleCopyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 3000);
  };

  const handleToggleLinkGroupToPersonal = async (groupId) => {
    const isAlreadyLinked = linkedPersonalGroups.includes(groupId);
    const nextLinked = isAlreadyLinked 
      ? linkedPersonalGroups.filter(id => id !== groupId)
      : [...linkedPersonalGroups, groupId];

    setLinkedPersonalGroups(nextLinked);

    const myId = user?.id || user?._id || 'default';
    localStorage.setItem(`linkedPersonalGroups_${myId}`, JSON.stringify(nextLinked));

    const targetGroup = groups.find(g => g._id === groupId);
    const groupName = targetGroup?.name || 'Group';

    if (user) {
      const updatedUser = { ...user, linkedPersonalGroups: nextLinked };
      setAndStoreUser(updatedUser);

      if (navigator.onLine && token) {
        try {
          await axios.put(`${API_BASE}/auth/profile`, { linkedPersonalGroups: nextLinked }, getHeaders());
        } catch (err) {
          console.error('Failed to sync linked personal groups to server:', err);
        }
      }
    }

    if (!isAlreadyLinked) {
      showAlert(`Expenses you spend in "${groupName}" will now be added to your Personal costing under "${groupName}".`, 'success');
    } else {
      showAlert(`Disconnected "${groupName}" expenses from your Personal costing.`, 'info');
    }
  };

  // Detailed list of all active transactions for metrics (preserving individual dates and categories)
  const metricTransactions = useMemo(() => {
    if (filterGroup !== 'personal') {
      return transactions.filter(t => {
        const gid = t.group?._id || t.group || t.groupId;
        return gid === filterGroup;
      });
    }

    const myId = user?.id || user?._id;
    return transactions.filter(t => {
      const gid = t.group?._id || t.group || t.groupId;
      if (!gid) return true;
      if (Array.isArray(linkedPersonalGroups) && linkedPersonalGroups.includes(gid)) {
        return myId && (
          (t.user?._id && (t.user._id === myId || t.user._id === user?.id || t.user._id === user?._id)) ||
          (typeof t.user === 'string' && (t.user === myId || t.user === user?.id || t.user === user?._id)) ||
          (t.user?.email && user?.email && t.user.email === user.email)
        );
      }
      return false;
    });
  }, [transactions, filterGroup, linkedPersonalGroups, user]);

  // Transaction Filters & Totals (consolidates user's expenses from linked shared groups into a single total entry named after the group)
  const filteredTransactions = useMemo(() => {
    if (filterGroup !== 'personal') {
      return transactions.filter(t => {
        const gid = t.group?._id || t.group || t.groupId;
        return gid === filterGroup;
      });
    }

    const myId = user?.id || user?._id;
    const personalList = [];

    // 1. Pure personal transactions (no group)
    transactions.forEach(t => {
      const gid = t.group?._id || t.group || t.groupId;
      if (!gid) {
        personalList.push(t);
      }
    });

    // 2. Consolidated entry for each linked shared group per month
    if (Array.isArray(linkedPersonalGroups) && linkedPersonalGroups.length > 0) {
      linkedPersonalGroups.forEach(gid => {
        const matchedGroup = groups.find(g => g._id === gid);
        const groupName = matchedGroup?.name || 'Shared Group';

        // Filter transactions in this group where the current user spent
        const myGroupTxs = transactions.filter(t => {
          const tGid = t.group?._id || t.group || t.groupId;
          if (tGid !== gid) return false;

          return myId && (
            (t.user?._id && (t.user._id === myId || t.user._id === user?.id || t.user._id === user?._id)) ||
            (typeof t.user === 'string' && (t.user === myId || t.user === user?.id || t.user === user?._id)) ||
            (t.user?.email && user?.email && t.user.email === user.email)
          );
        });

        if (myGroupTxs.length > 0) {
          // Group transactions by month and year (e.g. "2026-8", "2026-9")
          const monthBuckets = {};
          myGroupTxs.forEach(t => {
            const tDate = parseLocalDate(t.date);
            const m = tDate.getMonth();
            const y = tDate.getFullYear();
            const key = `${y}-${m}`;
            if (!monthBuckets[key]) {
              monthBuckets[key] = { month: m, year: y, txs: [] };
            }
            monthBuckets[key].txs.push(t);
          });

          // Create a consolidated entry for each month
          Object.values(monthBuckets).forEach(bucket => {
            const sortedGroupTxs = [...bucket.txs].sort((a, b) => {
              const dateA = parseLocalDate(a.date);
              const dateB = parseLocalDate(b.date);
              if (dateB - dateA !== 0) return dateB - dateA;
              return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });

            const latestTx = sortedGroupTxs[0];
            const totalSpentInMonth = bucket.txs.reduce((sum, t) => sum + (t.cost * t.quantity), 0);
            const fullMonthName = new Date(bucket.year, bucket.month, 1).toLocaleString('en-US', { month: 'long' });
            const monthLabel = bucket.year !== new Date().getFullYear() ? `${fullMonthName} ${bucket.year}` : fullMonthName;

            personalList.push({
              _id: `group-summary-${gid}-${bucket.year}-${bucket.month}`,
              itemName: groupName, // cost name will be the group name as a common consolidated entry
              cost: totalSpentInMonth, // total costing of what user spent in that group during THIS month
              quantity: 1,
              category: 'Shared Cost',
              date: latestTx?.date || getLocalDateString(),
              createdAt: latestTx?.createdAt || new Date().toISOString(),
              isGroupTotalSummary: true,
              isSharedGroupCost: true,
              sharedGroupId: gid,
              sharedGroupName: groupName,
              month: bucket.month,
              year: bucket.year,
              monthName: monthLabel,
              itemCount: bucket.txs.length,
              group: matchedGroup || { _id: gid, name: groupName },
              user: user
            });
          });
        }
      });
    }

    return personalList.sort((a, b) => {
      const dateA = parseLocalDate(a.date);
      const dateB = parseLocalDate(b.date);
      if (dateB - dateA !== 0) return dateB - dateA;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [transactions, filterGroup, linkedPersonalGroups, groups, user]);

  // Filter and sort transactions specifically for the History tab
  const historyTransactions = useMemo(() => {
    let list = [...filteredTransactions];
    
    if (historyCategoryFilter !== 'all') {
      list = list.filter(t => t.category === historyCategoryFilter);
    }

    if (historyStartDate) {
      const [yr, mo, dy] = historyStartDate.split('-').map(Number);
      const start = new Date(yr, mo - 1, dy, 0, 0, 0, 0);
      list = list.filter(t => parseLocalDate(t.date) >= start);
    }

    if (historyEndDate) {
      const [yr, mo, dy] = historyEndDate.split('-').map(Number);
      const end = new Date(yr, mo - 1, dy, 23, 59, 59, 999);
      list = list.filter(t => parseLocalDate(t.date) <= end);
    }
    
    list.sort((a, b) => {
      if (historySortBy === 'date_desc') {
        const diff = parseLocalDate(b.date) - parseLocalDate(a.date);
        if (diff !== 0) return diff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (historySortBy === 'date_asc') {
        const diff = parseLocalDate(a.date) - parseLocalDate(b.date);
        if (diff !== 0) return diff;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (historySortBy === 'amount_desc') {
        return (b.cost * b.quantity) - (a.cost * a.quantity);
      }
      if (historySortBy === 'amount_asc') {
        return (a.cost * a.quantity) - (b.cost * b.quantity);
      }
      if (historySortBy === 'category_asc') {
        return (a.category || '').localeCompare(b.category || '');
      }
      if (historySortBy === 'category_desc') {
        return (b.category || '').localeCompare(a.category || '');
      }
      if (historySortBy === 'name_asc') {
        return (a.itemName || '').localeCompare(b.itemName || '');
      }
      if (historySortBy === 'name_desc') {
        return (b.itemName || '').localeCompare(a.itemName || '');
      }
      return 0;
    });
    
    return list;
  }, [filteredTransactions, historyCategoryFilter, historySortBy, historyStartDate, historyEndDate]);

  const historyTotal = useMemo(() => {
    return historyTransactions.reduce((acc, t) => acc + (t.cost * t.quantity), 0);
  }, [historyTransactions]);

  const isHistoryFiltered = useMemo(() => {
    return historyCategoryFilter !== 'all' || Boolean(historyStartDate) || Boolean(historyEndDate);
  }, [historyCategoryFilter, historyStartDate, historyEndDate]);

  const historySpentLabel = useMemo(() => {
    const hasCategory = historyCategoryFilter !== 'all';
    const hasDate = Boolean(historyStartDate || historyEndDate);

    if (!hasCategory && !hasDate) {
      return 'All time spent';
    }

    if (hasCategory && !hasDate) {
      return `Total spent on ${historyCategoryFilter}`;
    }

    let dateText = '';
    if (historyStartDate && historyEndDate) {
      dateText = `${historyStartDate} to ${historyEndDate}`;
    } else if (historyStartDate) {
      dateText = `from ${historyStartDate}`;
    } else if (historyEndDate) {
      dateText = `until ${historyEndDate}`;
    }

    if (hasCategory && hasDate) {
      return `Filtered spent on ${historyCategoryFilter} (${dateText})`;
    }

    return `Filtered spent (${dateText})`;
  }, [historyCategoryFilter, historyStartDate, historyEndDate]);

  const selectedHistoryTotal = useMemo(() => {
    if (selectedHistoryIds.length === 0) return 0;
    const idSet = new Set(selectedHistoryIds);
    return historyTransactions
      .filter(t => idSet.has(t._id))
      .reduce((acc, t) => acc + (t.cost * t.quantity), 0);
  }, [selectedHistoryIds, historyTransactions]);

  const cancelLongPress = () => {
    setPressingHistoryId(null);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleHistoryPressStart = (id, e) => {
    if (selectedHistoryIds.length > 0) {
      // In selection mode: tap immediately toggles selection without press-scaling
      return;
    }
    cancelLongPress();
    isLongPressTriggeredRef.current = false;
    longPressedItemIdRef.current = null;
    setPressingHistoryId(id);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    touchStartPosRef.current = { x: clientX, y: clientY };

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      longPressedItemIdRef.current = id;
      setPressingHistoryId(null);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(40); } catch {}
      }
      setSelectedHistoryIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(itemId => itemId !== id);
        } else {
          return [...prev, id];
        }
      });
      // Safety auto-reset so long press only blocks immediate release of THIS item, never future clicks
      setTimeout(() => {
        isLongPressTriggeredRef.current = false;
        longPressedItemIdRef.current = null;
      }, 250);
    }, 450);
  };

  const handleHistoryPressMove = (e) => {
    if (!longPressTimerRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dist = Math.hypot(clientX - touchStartPosRef.current.x, clientY - touchStartPosRef.current.y);
    if (dist > 8) {
      cancelLongPress();
    }
  };

  const handleHistoryPressEnd = () => {
    cancelLongPress();
    if (isLongPressTriggeredRef.current) {
      setTimeout(() => {
        isLongPressTriggeredRef.current = false;
        longPressedItemIdRef.current = null;
      }, 100);
    }
  };

  const handleHistoryItemClick = (transactionOrId) => {
    const t = typeof transactionOrId === 'object' && transactionOrId !== null
      ? transactionOrId
      : historyTransactions.find(item => item._id === transactionOrId);
    const id = t ? t._id : transactionOrId;

    // Only ignore the immediate synthetic click on the exact item that was just long-pressed
    if (longPressedItemIdRef.current === id) {
      longPressedItemIdRef.current = null;
      isLongPressTriggeredRef.current = false;
      return;
    }

    if (selectedHistoryIds.length > 0) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(35); } catch {}
      }
      setSelectedHistoryIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(itemId => itemId !== id);
        } else {
          return [...prev, id];
        }
      });
    } else {
      if (!t) return;
      if (t.isGroupTotalSummary) {
        if (t.sharedGroupId) {
          setFilterGroup(t.sharedGroupId);
        }
      } else {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(25); } catch {}
        }
        setSelectedTransactionDetails(t);
      }
    }
  };


  const clearHistorySelection = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(25); } catch {}
    }
    setSelectedHistoryIds([]);
  };

  const activeGroupObj = useMemo(() => {
    if (filterGroup === 'personal') return null;
    return groups.find(g => g._id === filterGroup);
  }, [groups, filterGroup]);

  const activeBudget = useMemo(() => {
    if (filterGroup === 'personal') {
      return user?.budget || 0;
    } else {
      return activeGroupObj?.budget || 0;
    }
  }, [filterGroup, user, activeGroupObj]);

  const activeBudgetForSelectedPeriod = useMemo(() => {
    const now = new Date();
    const isCurrentPeriod = (historySelectedMonth === now.getMonth()) && (historySelectedYear === now.getFullYear());
    
    if (filterGroup === 'personal') {
      if (isCurrentPeriod) {
        return user?.budget || 0;
      }
      const hist = user?.historicalBudgets?.find(
        hb => hb.month === historySelectedMonth && hb.year === historySelectedYear
      );
      return hist ? hist.amount : (user?.budget || 0);
    } else {
      if (isCurrentPeriod) {
        return activeGroupObj?.budget || 0;
      }
      const hist = activeGroupObj?.historicalBudgets?.find(
        hb => hb.month === historySelectedMonth && hb.year === historySelectedYear
      );
      return hist ? hist.amount : (activeGroupObj?.budget || 0);
    }
  }, [filterGroup, user, activeGroupObj, historySelectedMonth, historySelectedYear]);


  const categoryBreakdown = useMemo(() => {
    const periodTx = metricTransactions.filter(t => {
      const tDate = parseLocalDate(t.date);
      return tDate.getMonth() === historySelectedMonth && tDate.getFullYear() === historySelectedYear;
    });

    const totalSpent = periodTx.reduce((acc, t) => acc + (t.cost * t.quantity), 0);

    const categoryTotals = {};
    periodTx.forEach(t => {
      const amt = t.cost * t.quantity;
      const catName = (filterGroup === 'personal' && t.group) ? 'Shared Cost' : t.category;
      categoryTotals[catName] = (categoryTotals[catName] || 0) + amt;
    });

    const breakdown = Object.entries(categoryTotals).map(([name, amount]) => {
      const percentage = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
      const catObj = categories.find(c => c.name === name);
      const color = name === 'Shared Cost' ? 'var(--primary-color)' : (catObj ? catObj.color : '#6b7280');
      return { name, amount, percentage, color };
    });

    breakdown.sort((a, b) => b.amount - a.amount);
    return { breakdown, totalSpent };
  }, [metricTransactions, historySelectedMonth, historySelectedYear, categories, filterGroup]);

  // Categories computed based on the selected group filter (for Add Expense Form)
  const formCategories = useMemo(() => {
    return categories.filter(cat => {
      if (filterGroup === 'personal') {
        return !cat.group;
      } else {
        return cat.isDefault || (cat.group === filterGroup || (cat.group && (cat.group._id === filterGroup || cat.group === filterGroup)));
      }
    });
  }, [categories, filterGroup]);

  // Categories computed for Settings Tab list based on settingsCategoryScope
  const settingsCategories = useMemo(() => {
    return categories.filter(cat => {
      if (settingsCategoryScope === 'personal') {
        return !cat.group;
      } else {
        return cat.isDefault || (cat.group === settingsCategoryScope || (cat.group && (cat.group._id === settingsCategoryScope || cat.group === settingsCategoryScope)));
      }
    });
  }, [categories, settingsCategoryScope]);

  // Check if current user is owner of the settings category scope
  const isSettingsScopeOwner = useMemo(() => {
    if (settingsCategoryScope === 'personal') return true;
    const activeGroup = groups.find(g => g._id === settingsCategoryScope);
    if (!activeGroup) return false;
    return activeGroup.owner?._id === user?.id || activeGroup.owner === user?.id;
  }, [groups, settingsCategoryScope, user]);

  // Auto-select default category (prioritizes food) when formCategories change (e.g. scope changes)
  useEffect(() => {
    if (formCategories.length > 0) {
      const isStillAvailable = formCategories.some(c => c.name === transactionForm.category);
      if (!isStillAvailable) {
        setTransactionForm(prev => ({ ...prev, category: findDefaultCategory(formCategories) }));
      }
    } else {
      setTransactionForm(prev => ({ ...prev, category: '' }));
    }
  }, [formCategories, transactionForm.category]);

  const getTotals = () => {
    const today = new Date().toDateString();
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();

    return metricTransactions.reduce((acc, t) => {
      const amt = t.cost * t.quantity;
      const tDate = parseLocalDate(t.date);

      acc.total += amt;
      if (tDate.toDateString() === today) {
        acc.today += amt;
      }
      if (tDate.getMonth() === thisMonth && tDate.getFullYear() === thisYear) {
        acc.month += amt;
      }
      return acc;
    }, { total: 0, today: 0, month: 0 });
  };

  const totals = getTotals();

  const currentMonthBurnData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, currentDay);
    const daysRemaining = Math.max(0, daysInMonth - currentDay);
    const dailyAvg = totals.month / daysPassed;
    const projectedSpend = Math.round(dailyAvg * daysInMonth);
    const remainingBalance = activeBudget - totals.month;

    let estimatedDays = 'N/A';
    if (activeBudget > 0) {
      if (remainingBalance <= 0) {
        estimatedDays = 0;
      } else if (dailyAvg <= 0) {
        estimatedDays = '∞';
      } else {
        estimatedDays = Math.ceil(remainingBalance / dailyAvg);
      }
    }

    const safeDailyBudget = daysRemaining > 0 && remainingBalance > 0 
      ? Math.round(remainingBalance / daysRemaining) 
      : 0;

    return {
      currentDay,
      daysInMonth,
      daysPassed,
      daysRemaining,
      dailyAvg: Math.round(dailyAvg),
      projectedSpend,
      remainingBalance,
      estimatedDays,
      safeDailyBudget
    };
  }, [totals.month, activeBudget]);

  const getGroupMemberBreakdown = () => {
    if (filterGroup === 'personal') return null;
    
    const today = new Date().toDateString();
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();

    const currentGroup = groups.find(g => g._id === filterGroup);
    if (!currentGroup) return null;

    const breakdown = {};
    currentGroup.members?.forEach(m => {
      breakdown[m._id] = {
        username: m.username,
        email: m.email,
        profilePic: m.profilePic,
        today: 0,
        month: 0,
        total: 0
      };
    });

    filteredTransactions.forEach(t => {
      const userId = t.user?._id || t.user;
      if (!userId || !breakdown[userId]) return;

      const amt = t.cost * t.quantity;
      const tDate = parseLocalDate(t.date);

      breakdown[userId].total += amt;
      if (tDate.toDateString() === today) {
        breakdown[userId].today += amt;
      }
      if (tDate.getMonth() === thisMonth && tDate.getFullYear() === thisYear) {
        breakdown[userId].month += amt;
      }
    });

    return Object.values(breakdown);
  };

  const memberBreakdown = getGroupMemberBreakdown();

  const handleDownloadPersonalCSV = () => {
    const myId = user?.id || user?._id;
    const purePersonalTransactions = transactions.filter(t => {
      if (t.group) return false;
      const tDate = parseLocalDate(t.date);
      return tDate.getMonth() === historySelectedMonth && tDate.getFullYear() === historySelectedYear;
    });

    // Consolidate each linked shared group for the selected period
    const consolidatedGroupItems = [];
    if (Array.isArray(linkedPersonalGroups) && linkedPersonalGroups.length > 0) {
      linkedPersonalGroups.forEach(gid => {
        const matchedGroup = groups.find(g => g._id === gid);
        const groupName = matchedGroup?.name || 'Shared Group';

        const myGroupTxs = transactions.filter(t => {
          const tGid = t.group?._id || t.group || t.groupId;
          if (tGid !== gid) return false;
          const tDate = parseLocalDate(t.date);
          if (tDate.getMonth() !== historySelectedMonth || tDate.getFullYear() !== historySelectedYear) return false;

          return myId && (
            (t.user?._id && (t.user._id === myId || t.user._id === user?.id || t.user._id === user?._id)) ||
            (typeof t.user === 'string' && (t.user === myId || t.user === user?.id || t.user === user?._id)) ||
            (t.user?.email && user?.email && t.user.email === user.email)
          );
        });

        if (myGroupTxs.length > 0) {
          const sorted = [...myGroupTxs].sort((a, b) => {
            const dateA = parseLocalDate(a.date);
            const dateB = parseLocalDate(b.date);
            if (dateB - dateA !== 0) return dateB - dateA;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
          const latestTx = sorted[0];
          const totalSpent = myGroupTxs.reduce((sum, t) => sum + (t.cost * t.quantity), 0);

          consolidatedGroupItems.push({
            date: latestTx.date,
            createdAt: latestTx.createdAt,
            itemName: groupName, // just group name
            category: 'Shared Cost',
            cost: totalSpent,
            quantity: 1,
            totalPrice: totalSpent
          });
        }
      });
    }

    const reportItems = [
      ...purePersonalTransactions.map(t => ({
        date: t.date,
        createdAt: t.createdAt,
        itemName: t.itemName,
        category: t.category,
        cost: t.cost,
        quantity: t.quantity,
        totalPrice: t.cost * t.quantity
      })),
      ...consolidatedGroupItems
    ].sort((a, b) => {
      const dateA = parseLocalDate(a.date);
      const dateB = parseLocalDate(b.date);
      if (dateB - dateA !== 0) return dateB - dateA;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    const now = new Date();
    const isCurrentPeriod = (historySelectedMonth === now.getMonth()) && (historySelectedYear === now.getFullYear());
    const monthlyBudget = isCurrentPeriod 
      ? (user?.budget || 0) 
      : (user?.historicalBudgets?.find(hb => hb.month === historySelectedMonth && hb.year === historySelectedYear)?.amount ?? (user?.budget || 0));

    let csvContent = "";
    csvContent += `Personal Expense Report - ${user?.username || 'User'}\n`;
    csvContent += `Generated On,${new Date().toLocaleDateString()}\n`;
    csvContent += `Period,${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][historySelectedMonth]} ${historySelectedYear}\n`;
    csvContent += `Monthly Budget,${monthlyBudget}\n\n`;
    csvContent += "COST ITEMS LIST\n";
    csvContent += "Date,Item Name,Category,Cost,Quantity,Total Price\n";
    reportItems.forEach(t => {
      const formattedDate = parseLocalDate(t.date).toLocaleDateString();
      csvContent += `"${formattedDate}","${(t.itemName || '').replace(/"/g, '""')}","${t.category}",${t.cost},${t.quantity},${t.totalPrice}\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${(user?.username || 'Personal').replace(/\s+/g, '_')}_Personal_Expense_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPersonalPDF = async () => {
    try {
      const response = await axios.get(`${API_BASE}/transactions/report/pdf?groupId=personal&month=${historySelectedMonth}&year=${historySelectedYear}`, {
        ...getHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${(user?.username || 'Personal').replace(/\s+/g, '_')}_Personal_Expense_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error downloading personal PDF:", err);
      showAlert("Failed to download PDF report. Please try again.", "error");
    }
  };

  const handleDownloadGroupCSV = (targetGroup) => {
    if (!targetGroup) return;
    const groupTransactions = transactions.filter(t => {
      const isGrp = t.group && (t.group._id === targetGroup._id || t.group === targetGroup._id);
      if (!isGrp) return false;
      const tDate = parseLocalDate(t.date);
      return tDate.getMonth() === historySelectedMonth && tDate.getFullYear() === historySelectedYear;
    });

    const now = new Date();
    const isCurrentPeriod = (historySelectedMonth === now.getMonth()) && (historySelectedYear === now.getFullYear());
    const groupBudget = isCurrentPeriod 
      ? (targetGroup.budget || 0)
      : (targetGroup.historicalBudgets?.find(hb => hb.month === historySelectedMonth && hb.year === historySelectedYear)?.amount ?? (targetGroup.budget || 0));

    let csvContent = "";
    csvContent += `Group Budget Report - ${targetGroup.name}\n`;
    csvContent += `Generated On,${new Date().toLocaleDateString()}\n`;
    csvContent += `Period,${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][historySelectedMonth]} ${historySelectedYear}\n`;
    csvContent += `Group Budget,${groupBudget}\n\n`;
    csvContent += "COST ITEMS LIST\n";
    csvContent += "Date,Item Name,Category,Cost,Quantity,Total Price,Added By\n";
    groupTransactions.forEach(t => {
      const addedBy = t.user?.username || (t.user?._id === user?.id || t.user === user?.id ? 'Me' : 'Unknown');
      const formattedDate = parseLocalDate(t.date).toLocaleDateString();
      csvContent += `"${formattedDate}","${(t.itemName || '').replace(/"/g, '""')}","${t.category}",${t.cost},${t.quantity},${t.cost * t.quantity},"${addedBy}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${targetGroup.name.replace(/\s+/g, '_')}_Budget_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadGroupPDF = async (targetGroup) => {
    if (!targetGroup) return;
    try {
      const response = await axios.get(`${API_BASE}/transactions/report/pdf?groupId=${targetGroup._id}&month=${historySelectedMonth}&year=${historySelectedYear}`, {
        ...getHeaders(),
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `${targetGroup.name.replace(/\s+/g, '_')}_Budget_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error downloading group PDF:", err);
      showAlert("Failed to download PDF report. Please try again.", "error");
    }
  };

  const handleOpenAnalyticsForScope = () => {
    if (filterGroup === 'personal') {
      setPersonalBudgetInput(user?.budget || '');
      setShowPersonalAnalytics(true);
    } else if (activeGroupObj) {
      setGroupBudgetInput(activeGroupObj.budget || '');
      setSelectedGroupDetails(activeGroupObj);
    }
  };

  const getGroupDailyTrend = (group) => {
    if (!group) return [];
    const groupTransactions = transactions.filter(t => t.group && (t.group._id === group._id || t.group === group._id));
    
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateString: d.toDateString(),
        label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        amount: 0
      });
    }
    
    groupTransactions.forEach(t => {
      const tDate = parseLocalDate(t.date).toDateString();
      const match = days.find(day => day.dateString === tDate);
      if (match) {
        match.amount += t.cost * t.quantity;
      }
    });
    
    return days;
  };

  // Render Auth UI
  if (!token) {
    return (
      <div className="main-content animate-fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img 
            src="/logo.png" 
            alt="Hisab Khata Logo" 
            style={{ 
              width: '68px', 
              height: '68px', 
              borderRadius: '16px', 
              marginBottom: '14px', 
              objectFit: 'cover',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)' 
            }} 
          />
          <h1 style={{ fontSize: '36px', fontWeight: '800', margin: '0' }} className="app-title">Hisab Khata</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>Track your budget. Sync to Google Sheets.</p>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type}`}>
            <AlertCircle size={18} />
            <div>{alert.message}</div>
          </div>
        )}

        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', textAlign: 'center' }}>
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>

          {authMode === 'signup' && signupPaused && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: 'var(--danger-color)',
              fontSize: '13px',
              fontWeight: 500
            }}>
              <AlertCircle size={16} />
              <span>Registration is temporarily paused by the administrator.</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            {authMode === 'signup' && (
              <div className="form-group">
                <label>Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    placeholder="e.g. John Doe"
                    value={authForm.username}
                    onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '44px' }}
                  placeholder="e.g. john@example.com"
                  value={authForm.email}
                  onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  style={{ paddingLeft: '44px', paddingRight: '44px' }}
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="gradient-btn"
              style={{ width: '100%' }}
              disabled={loading || (authMode === 'signup' && signupPaused)}
            >
              {loading ? (
                <Loader className="animate-spin" size={18} />
              ) : authMode === 'signup' && signupPaused ? (
                'Sign Up Paused'
              ) : authMode === 'login' ? (
                'Log In'
              ) : (
                'Sign Up'
              )}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setShowPassword(false);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {authMode === 'login' ? 'Sign Up Now' : 'Log In Now'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Main Dashboard & Tracks
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {renderAvatar(user?.profilePic, 40)}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 className="app-title" style={{ margin: 0 }}>Hisab Khata</h1>
              {!isOnline && (
                <span style={{
                  fontSize: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: 'rgb(248, 113, 113)',
                  padding: '2px 6px',
                  borderRadius: '100px',
                  fontWeight: '600',
                  border: '1px solid rgba(239, 68, 68, 0.4)'
                }}>
                  Offline
                </span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Hi, {user?.username}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Dark / Light Mode Toggle */}
          <button
            onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              transition: 'color var(--transition-fast)'
            }}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            aria-label="Toggle dark/light mode"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowNotificationsTray(!showNotificationsTray);
                if (!showNotificationsTray) {
                  fetchNotifications();
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                color: showNotificationsTray ? 'var(--primary-color)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                position: 'relative'
              }}
              title="Notifications"
            >
              <Bell size={20} />
              {unreadNotificationsCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  backgroundColor: 'var(--danger-color, #ef4444)',
                  color: 'white',
                  fontSize: '9px',
                  fontWeight: '700',
                  borderRadius: '50%',
                  width: '15px',
                  height: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--bg-secondary, #0f172a)'
                }}>
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Notifications Modal (Flat Window Style) */}
      {showNotificationsTray && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 15, 29, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} className="animate-fade-in">
          <div className="glass-card animate-scale-in" style={{
            maxWidth: '500px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--card-border)',
            backgroundColor: 'var(--card-bg, #1e293b)',
            margin: 0,
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} style={{ color: 'var(--primary-color)' }} /> Notifications
              </h3>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {notifications.length > 0 && (
                  <button
                    onClick={clearNotifications}
                    style={{
                      background: 'var(--danger-bg)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'var(--danger-color)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'background var(--transition-fast)'
                    }}
                    title="Delete all notifications permanently"
                  >
                    Clear All
                  </button>
                )}

                {unreadNotificationsCount > 0 && (
                  <button
                    onClick={() => markNotificationsAsRead()}
                    style={{
                      background: 'var(--primary-light)',
                      border: '1px solid var(--primary-border)',
                      color: 'var(--primary-color)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    Mark all read
                  </button>
                )}
                
                <button
                  onClick={() => setShowNotificationsTray(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body / Scroll Content */}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', minHeight: '120px' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px', padding: '40px 0' }}>
                  No notifications yet.
                </div>
              ) : (
                notifications.map(n => (
                  <div
                    key={n._id}
                    onClick={() => {
                      if (!n.isRead) markNotificationsAsRead(n._id);
                      if (n.group?._id) {
                        setFilterGroup(n.group._id);
                        localStorage.setItem('filterGroup', n.group._id);
                        switchTab('groups');
                      }
                      setShowNotificationsTray(false);
                    }}
                    style={{
                      padding: '12px',
                      background: n.isRead ? 'transparent' : 'var(--primary-light)',
                      border: '1px solid',
                      borderColor: n.isRead ? 'var(--card-border)' : 'var(--primary-border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}
                    className="notification-item"
                  >
                    {renderAvatar(n.sender?.profilePic, 32)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                      <span style={{ fontSize: '13px', fontWeight: n.isRead ? '500' : '700', color: 'var(--text-primary)' }}>
                        {n.title}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {n.message}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {!n.isRead && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: 'var(--primary-color)',
                        borderRadius: '50%',
                        marginTop: '4px',
                        flexShrink: 0
                      }} />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* App Alert Banner */}
      {alert && (
        <div style={{ padding: '12px 20px 0 20px' }} className="animate-fade-in">
          <div className={`alert alert-${alert.type}`} style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {alert.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              <div style={{ fontWeight: 600 }}>{alert.message}</div>
            </div>
            {alert.sheetError && (
              <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.8, wordBreak: 'break-all' }}>
                <strong>Sync Error:</strong> {alert.sheetError}. Check your Apps Script Deployment or Settings URL.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main 
        className="main-content tab-slider-main"
        onTouchStart={onSliderTouchStart}
        onTouchMove={onSliderTouchMove}
        onTouchEnd={onSliderTouchEnd}
        onTouchCancel={onSliderTouchEnd}
        onClickCapture={handleMainClickCapture}
      >
        <div
          ref={trackRef}
          className="tab-slider-track"
          style={{
            transform: `translateX(-${APP_TABS.indexOf(activeTab) * 25}%)`
          }}
        >
          {/* ==================== TAB 1: TRACK EXPENSES (FIRST PAGE) ==================== */}
          <div className="tab-pane" ref={el => { tabPanesRef.current[0] = el; }}>
            <div>
            
            {/* Filter Scope Selector if user has groups */}
            {groups.length > 0 && renderScopeSelector()}

            {/* Quick stats dashboard widget */}
            <div className="form-row" style={{ marginBottom: '16px' }}>
              <div className="glass-card" style={{ marginBottom: 0, padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Today's Spending</span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${totals.today.toLocaleString()}`}>৳{totals.today.toLocaleString()}</span>
              </div>
              <div className="glass-card" style={{ marginBottom: 0, padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentMonthName}</span>
                  {activeBudget > 0 && (
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: '700', 
                      color: totals.month > activeBudget ? 'var(--danger-color)' : 'var(--success-color)',
                      background: totals.month > activeBudget ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      flexShrink: 0
                    }}>
                      {Math.round((totals.month / activeBudget) * 100)}%
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${totals.month.toLocaleString()}`}>৳{totals.month.toLocaleString()}</span>
                {activeBudget > 0 && (
                  <span style={{ 
                    fontSize: '11px', 
                    color: (activeBudget - totals.month) < 0 ? 'var(--danger-color)' : 'var(--text-muted)',
                    fontWeight: 500,
                    marginTop: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }} title={`Remaining: ৳${(activeBudget - totals.month).toLocaleString()}`}>
                    Remaining: ৳{(activeBudget - totals.month).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Input Form for tracking budget - MUST BE FIRST PAGE ALWAYS */}
            <div className="glass-card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} style={{ color: 'var(--primary-color)' }} /> Add New Expense
              </h2>

              <form onSubmit={handleTransactionSubmit}>
                <div className="form-group">
                  <label>Item Name / What did you spend for?</label>
                  <input
                     type="text"
                     className="form-input"
                     placeholder="e.g. Rice, Petrol, Laptop repair"
                     value={transactionForm.itemName}
                     onChange={e => setTransactionForm({ ...transactionForm, itemName: e.target.value })}
                     required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Cost (Per Item)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Cost"
                      min="0"
                      step="any"
                      value={transactionForm.cost}
                      onChange={e => setTransactionForm({ ...transactionForm, cost: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty"
                      min="1"
                      value={transactionForm.quantity}
                      onChange={e => setTransactionForm({ ...transactionForm, quantity: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select
                      className="form-input"
                      value={transactionForm.category}
                      onChange={e => setTransactionForm({ ...transactionForm, category: e.target.value })}
                      style={{ appearance: 'none', backgroundPosition: 'right 16px center', backgroundRepeat: 'no-repeat', backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27%3E%3C/polyline%3E%3C/svg%3E")' }}
                      required
                    >
                      {formCategories.length === 0 ? (
                        <option value="">-- No Categories Available --</option>
                      ) : (
                        formCategories.map(cat => (
                          <option key={cat._id} value={cat.name}>
                            {cat.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={transactionForm.date}
                      onChange={e => setTransactionForm({ ...transactionForm, date: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="gradient-btn" 
                  style={{ width: '100%', marginTop: '8px' }} 
                  disabled={syncLoading}
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      try { navigator.vibrate(40); } catch {}
                    }
                  }}
                >
                  {syncLoading ? (
                    <>
                      <Loader className="animate-spin" size={18} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      Record Expense
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Member contribution breakdown for groups */}
            {memberBreakdown && (
              <div className="glass-card animate-fade-in" style={{ padding: '16px', marginBottom: '16px', borderLeft: '4px solid var(--primary-color)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} style={{ color: 'var(--primary-color)' }} /> Member Breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {memberBreakdown.map(member => (
                    <div key={member.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        {renderAvatar(member.profilePic, 32)}
                        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={`${member.username} ${member.email === user?.email ? '(Me)' : ''}`}>
                            {member.username} {member.email === user?.email ? '(Me)' : ''}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={member.email}>{member.email}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '140px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Today: ৳${member.today.toLocaleString()}`}>
                          Today: ৳{member.today.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: '600', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Month: ৳${member.month.toLocaleString()}`}>
                          Month: ৳{member.month.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick list of recent expenditures */}
            <div className="glass-card" style={{ padding: '16px 0 0 0', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px 16px', borderBottom: '1px solid var(--card-border)' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  Recent Expenses
                </h3>
                <button
                  onClick={() => switchTab('history')}
                  style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  View All <ChevronRight size={16} />
                </button>
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {filteredTransactions.length === 0 ? (
                  <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    No expenses recorded yet. Your trackers are clean!
                  </div>
                ) : (
                  filteredTransactions.slice(0, 5).map(t => {
                    const matchedCat = categories.find(c => c.name === t.category);
                    const catColor = t.isGroupTotalSummary ? 'var(--primary-color)' : (matchedCat?.color || 'var(--text-muted)');
                    return (
                      <div 
                        key={t._id} 
                        className="transaction-item animate-fade-in"
                        onClick={() => {
                          if (t.isGroupTotalSummary) {
                            if (t.sharedGroupId) setFilterGroup(t.sharedGroupId);
                          } else {
                            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                              try { navigator.vibrate(25); } catch {}
                            }
                            setSelectedTransactionDetails(t);
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Left side: Information Column */}
                        <div className="transaction-info" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span className="transaction-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={t.itemName}>
                            {t.itemName}
                          </span>

                          {/* Row 2: Category / Expenses Count Badge */}
                          <div className="transaction-meta" style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0 1px 0', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                            {t.isGroupTotalSummary ? (
                              <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', border: '1px solid var(--primary-border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', fontSize: '11.5px', fontWeight: '600' }} title={`${t.itemCount} ${t.itemCount === 1 ? 'expense' : 'expenses'}`}>
                                {t.itemCount} {t.itemCount === 1 ? 'expense' : 'expenses'}
                              </span>
                            ) : (
                              <>
                                <span className="badge" style={{ backgroundColor: `${catColor}20`, color: catColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {t.category}
                                </span>
                                {t.isSharedGroupCost && t.originalItemName && (
                                  <span className="badge" style={{ backgroundColor: 'var(--surface-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', flexShrink: 1 }} title={t.originalItemName}>
                                    📝 {t.originalItemName}
                                  </span>
                                )}
                                {t.isPending && (
                                  <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.25)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    ⏳ Sync Pending
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Row 3: Group Name below Category (for regular items) */}
                          {!t.isGroupTotalSummary && t.group && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '1px 0 2px 0', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
                              <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', border: '1px solid var(--primary-border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', flexShrink: 1, fontSize: '11.5px', fontWeight: '600' }} title={t.group.name || t.group}>
                                👥 {t.group.name || t.group}
                              </span>
                            </div>
                          )}

                          {/* Row 4 (or Row 3 for group summary): Date / Month & user */}
                          {t.isGroupTotalSummary ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px', width: '100%' }}>
                              <span>{t.monthName || parseLocalDate(t.date).toLocaleString('en-US', { month: 'long' })}</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px', width: '100%' }}>
                              <span style={{ flexShrink: 0 }}>
                                {parseLocalDate(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                              {t.group && t.user && (
                                <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', flexShrink: 1 }}>
                                  • by {t.user._id === user?.id || t.user === user?.id ? 'Me' : t.user.username}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right side: Cost Amount - VERTICALLY CENTERED */}
                        <div className="transaction-amount" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0, marginLeft: '10px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }} title={`৳${(t.cost * t.quantity).toLocaleString()}`}>
                            ৳{(t.cost * t.quantity).toLocaleString()}
                          </span>
                          {t.quantity > 1 && (
                            <span className="transaction-qty" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {t.quantity} x ৳{t.cost}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            </div>
          </div>

          {/* ==================== TAB 2: DETAILED HISTORY ==================== */}
          <div className="tab-pane" ref={el => { tabPanesRef.current[1] = el; }}>
            <div>
            {/* Filter Scope Selector if user has groups */}
            {groups.length > 0 && renderScopeSelector()}
            {/* Remaining Balance Section (Current Month) */}
            <div className="glass-card" style={{ marginBottom: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Remaining Balance ({currentMonthName})
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px', flexShrink: 0 }} title={`Scope: ${filterGroup === 'personal' ? 'Personal' : activeGroupObj?.name || 'Group'}`}>
                  Scope: {filterGroup === 'personal' ? 'Personal' : activeGroupObj?.name || 'Group'}
                </span>
              </div>
              
              {activeBudget > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', minWidth: 0 }}>
                    <span style={{ 
                      fontSize: '32px', 
                      fontWeight: '800', 
                      color: (activeBudget - totals.month) < 0 ? 'var(--danger-color)' : 'var(--success-color)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%'
                    }} title={`৳${(activeBudget - totals.month).toLocaleString()}`}>
                      ৳{(activeBudget - totals.month).toLocaleString()}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={`Spent: ৳${totals.month.toLocaleString()} / ৳${activeBudget.toLocaleString()}`}>
                      Spent: ৳{totals.month.toLocaleString()} / ৳{activeBudget.toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '8px', background: 'var(--chart-empty-bar)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${Math.min((totals.month / activeBudget) * 100, 100)}%`, 
                      height: '100%', 
                      background: totals.month > activeBudget ? 'var(--danger-color)' : 'var(--primary-color)',
                      borderRadius: '4px' 
                    }} />
                  </div>

                  {totals.month > activeBudget && (
                    <span style={{ color: '#f87171', fontWeight: 600, fontSize: '11px', marginTop: '2px' }}>
                      ⚠️ Monthly budget exceeded for this scope!
                    </span>
                  )}

                  {/* Burn rate projection */}
                  <div style={{
                    marginTop: '8px',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--card-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px', minWidth: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-color)' }}>
                        Burn rate projection
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={`Pace: ৳${currentMonthBurnData.dailyAvg.toLocaleString()}/day`}>
                        Pace: ৳{currentMonthBurnData.dailyAvg.toLocaleString()}/day
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                      {currentMonthBurnData.remainingBalance <= 0 ? (
                        <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>
                          ⚠️ Budget exhausted! You have spent more than your allocated budget.
                        </span>
                      ) : (
                        <>
                          Based on your current monthly burn rate, your remaining budget is estimated to last{' '}
                          <strong style={{ color: typeof currentMonthBurnData.estimatedDays === 'number' && currentMonthBurnData.estimatedDays < currentMonthBurnData.daysRemaining ? 'var(--warning-color)' : 'var(--success-color)' }}>
                            {currentMonthBurnData.estimatedDays === '∞' ? 'the entire month' : `${currentMonthBurnData.estimatedDays} days`}
                          </strong>.
                          {currentMonthBurnData.daysRemaining > 0 && (
                            <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {currentMonthBurnData.daysRemaining} days left in {currentMonthName} • Safe daily target: ৳{currentMonthBurnData.safeDailyBudget.toLocaleString()}/day
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '4px 0' }}>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    No budget allocated for this scope.
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                    {filterGroup === 'personal' 
                      ? 'Go to Settings -> Account Profile to set your personal monthly budget.'
                      : 'Go to the Groups tab and edit group budget inside group details.'}
                  </span>
                </div>
              )}
            </div>

            <div className="glass-card">
              <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>History Logs</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                Manage all recorded spends. {isHistoryFiltered ? `Total items filtered: ${historyTransactions.length}.` : `Total items: ${historyTransactions.length}.`}
              </p>

              {/* Category Filter and Sorting Controls */}
              <div className="form-row" style={{ gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <Tag size={12} /> Category
                  </label>
                  <select
                    className="form-input"
                    value={historyCategoryFilter}
                    onChange={e => setHistoryCategoryFilter(e.target.value)}
                    style={{ 
                      padding: '8px 12px', 
                      fontSize: '13px', 
                      height: '38px',
                      appearance: 'none', 
                      backgroundPosition: 'right 12px center', 
                      backgroundRepeat: 'no-repeat', 
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27%3E%3C/polyline%3E%3C/svg%3E")',
                      margin: 0
                    }}
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                    <Layers size={12} /> Sort By
                  </label>
                  <select
                    className="form-input"
                    value={historySortBy}
                    onChange={e => setHistorySortBy(e.target.value)}
                    style={{ 
                      padding: '8px 12px', 
                      fontSize: '13px', 
                      height: '38px',
                      appearance: 'none', 
                      backgroundPosition: 'right 12px center', 
                      backgroundRepeat: 'no-repeat', 
                      backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27%3E%3C/polyline%3E%3C/svg%3E")',
                      margin: 0
                    }}
                  >
                    <option value="date_desc">Date: Newest First</option>
                    <option value="date_asc">Date: Oldest First</option>
                    <option value="amount_desc">Amount: High to Low</option>
                    <option value="amount_asc">Amount: Low to High</option>
                    <option value="category_asc">Category: A to Z</option>
                    <option value="category_desc">Category: Z to A</option>
                    <option value="name_asc">Item Name: A to Z</option>
                    <option value="name_desc">Item Name: Z to A</option>
                  </select>
                </div>
              </div>

              {/* Date Range Filters */}
              <div className="form-row" style={{ gap: '12px', marginBottom: '16px' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Start Date</span>
                    {historyStartDate && (
                      <button 
                        type="button"
                        onClick={() => setHistoryStartDate('')} 
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '10px', textTransform: 'none', padding: 0 }}
                      >
                        Clear
                      </button>
                    )}
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={historyStartDate}
                    onChange={e => setHistoryStartDate(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '13px', height: '38px', margin: 0 }}
                  />
                </div>

                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>End Date</span>
                    {historyEndDate && (
                      <button 
                        type="button"
                        onClick={() => setHistoryEndDate('')} 
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '10px', textTransform: 'none', padding: 0 }}
                      >
                        Clear
                      </button>
                    )}
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={historyEndDate}
                    onChange={e => setHistoryEndDate(e.target.value)}
                    style={{ padding: '8px 12px', fontSize: '13px', height: '38px', margin: 0 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 16px', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', border: '1px solid var(--card-border)', marginBottom: '16px', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={historySpentLabel}>
                  {historySpentLabel}
                </span>
                <span style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${historyTotal.toLocaleString()}`}>৳{historyTotal.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {historyTransactions.length === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No recorded data found.
                  </div>
                ) : (
                  (historyViewAll ? historyTransactions : historyTransactions.slice(0, 5)).map(t => {
                    const matchedCat = categories.find(c => c.name === t.category);
                    const catColor = t.isGroupTotalSummary ? 'var(--primary-color)' : (matchedCat?.color || 'var(--text-muted)');
                    const isSelected = selectedHistoryIds.includes(t._id);
                    const isSelectionMode = selectedHistoryIds.length > 0;
                    return (
                      <div
                        key={t._id}
                        className="glass-card animate-fade-in"
                        onMouseDown={(e) => handleHistoryPressStart(t._id, e)}
                        onMouseMove={handleHistoryPressMove}
                        onMouseUp={handleHistoryPressEnd}
                        onMouseLeave={handleHistoryPressEnd}
                        onTouchStart={(e) => handleHistoryPressStart(t._id, e)}
                        onTouchMove={handleHistoryPressMove}
                        onTouchEnd={handleHistoryPressEnd}
                        onTouchCancel={handleHistoryPressEnd}
                        onContextMenu={(e) => {
                          if (isSelectionMode || isLongPressTriggeredRef.current) {
                            e.preventDefault();
                          }
                        }}
                        onClick={() => handleHistoryItemClick(t)}
                        style={{
                          marginBottom: 0,
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          minHeight: '76px',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitTouchCallout: 'none',
                          backgroundColor: isSelected 
                            ? (theme === 'light' ? '#e0edff' : 'rgba(37, 99, 235, 0.16)') 
                            : undefined,
                          borderColor: isSelected ? 'var(--primary-color)' : undefined,
                          boxShadow: isSelected ? '0 0 0 1px var(--primary-color)' : undefined,
                          transform: (!isSelectionMode && pressingHistoryId === t._id) ? 'scale(0.985)' : 'scale(1)',
                          transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease'
                        }}
                      >
                        <div 
                          style={{ 
                            width: isSelectionMode ? '22px' : '0px',
                            minWidth: isSelectionMode ? '22px' : '0px',
                            marginRight: isSelectionMode ? '12px' : '0px',
                            opacity: isSelectionMode ? 1 : 0,
                            transform: isSelectionMode ? 'translateX(0) scale(1)' : 'translateX(-8px) scale(0.7)',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            flexShrink: 0,
                            overflow: isSelectionMode ? 'visible' : 'hidden',
                            pointerEvents: isSelectionMode ? 'auto' : 'none',
                            transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.22s cubic-bezier(0.16, 1, 0.3, 1), margin-right 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                        >
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              minWidth: '22px',
                              minHeight: '22px',
                              maxWidth: '22px',
                              maxHeight: '22px',
                              aspectRatio: '1 / 1',
                              borderRadius: '50%',
                              boxSizing: 'border-box',
                              border: isSelected ? 'none' : '2px solid var(--card-border)',
                              backgroundColor: isSelected ? 'var(--primary-color)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'background-color 0.18s ease, border-color 0.18s ease'
                            }}
                          >
                            {isSelected && <Check size={13} color="#ffffff" strokeWidth={3} style={{ display: 'block', flexShrink: 0 }} />}
                          </div>
                        </div>

                        <div className="transaction-info" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px', paddingRight: '10px' }}>
                          <span 
                            className="transaction-name" 
                            style={{ 
                              fontSize: '15.5px', 
                              fontWeight: '600',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                              lineHeight: '1.3'
                            }}
                            title={t.itemName}
                          >
                            {t.itemName}
                          </span>

                          {/* Row 2: Category / Shared Group Badge */}
                          <div 
                            className="transaction-meta" 
                            style={{ 
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px', 
                              margin: '2px 0 1px 0',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              width: '100%'
                            }}
                          >
                            {t.isGroupTotalSummary ? (
                              <span 
                                className="badge" 
                                style={{ 
                                  backgroundColor: 'var(--primary-light)', 
                                  color: 'var(--primary-color)', 
                                  border: '1px solid var(--primary-border)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                  fontSize: '11.5px',
                                  fontWeight: '600'
                                }}
                                title={`${t.itemCount} ${t.itemCount === 1 ? 'expense' : 'expenses'}`}
                              >
                                {t.itemCount} {t.itemCount === 1 ? 'expense' : 'expenses'}
                              </span>
                            ) : (
                              <>
                                <span 
                                  className="badge" 
                                  style={{ 
                                    backgroundColor: `${catColor}20`, 
                                    color: catColor,
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}
                                >
                                  {t.category}
                                </span>
                                {t.isSharedGroupCost && t.originalItemName && (
                                  <span 
                                    className="badge" 
                                    style={{ 
                                      backgroundColor: 'var(--surface-subtle)', 
                                      color: 'var(--text-secondary)', 
                                      border: '1px solid var(--card-border)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '140px',
                                      flexShrink: 1
                                    }}
                                    title={t.originalItemName}
                                  >
                                    📝 {t.originalItemName}
                                  </span>
                                )}
                                {t.isPending && (
                                  <span 
                                    className="badge" 
                                    style={{ 
                                      backgroundColor: 'rgba(245, 158, 11, 0.15)', 
                                      color: '#fcd34d', 
                                      border: '1px solid rgba(245, 158, 11, 0.25)',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0
                                    }}
                                  >
                                    ⏳ Sync Pending
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Row 3: Group Name below Category */}
                          {!t.isGroupTotalSummary && t.group && (
                            <div 
                              style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                margin: '1px 0 2px 0',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                width: '100%'
                              }}
                            >
                              <span 
                                className="badge" 
                                style={{ 
                                  backgroundColor: 'var(--primary-light)', 
                                  color: 'var(--primary-color)', 
                                  border: '1px solid var(--primary-border)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                  flexShrink: 1,
                                  fontSize: '11.5px',
                                  fontWeight: '600'
                                }}
                                title={t.group.name || t.group}
                              >
                                👥 {t.group.name || t.group}
                              </span>
                            </div>
                          )}

                          {/* Row 4 (or Row 3 for group summary): Date / Month, User, Quantity */}
                          {t.isGroupTotalSummary ? (
                            <div 
                              style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: '1.2',
                                marginTop: '1px',
                                width: '100%'
                              }}
                            >
                              <span>{t.monthName || parseLocalDate(t.date).toLocaleString('en-US', { month: 'long' })}</span>
                            </div>
                          ) : (
                            <div 
                              style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: '1.2',
                                marginTop: '1px',
                                width: '100%'
                              }}
                            >
                              <span style={{ flexShrink: 0 }}>
                                {parseLocalDate(t.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              {t.group && t.user && (
                                <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', flexShrink: 1 }}>
                                  • by {t.user._id === user?.id || t.user === user?.id ? 'Me' : (t.user.username || 'Member')}
                                </span>
                              )}
                              {t.quantity > 1 && (
                                <span style={{ flexShrink: 0, fontWeight: '500' }}>
                                  • Qty: {t.quantity} (৳{t.cost})
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right side: Costing value & Delete button - VERTICALLY CENTERED */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                          <span 
                            style={{ 
                              fontSize: '17px', 
                              fontWeight: '700', 
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              maxWidth: '130px' 
                            }} 
                            title={`৳${(t.cost * t.quantity).toLocaleString()}`}
                          >
                            ৳{(t.cost * t.quantity).toLocaleString()}
                          </span>
                          {!t.isGroupTotalSummary && (t.isPending || t.user?._id === user?.id || t.user === user?.id || (t.group && (t.group.owner?._id === user?.id || t.group.owner === user?.id || (typeof t.group.owner === 'string' && t.group.owner === user?.id)))) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTransaction(t._id);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onTouchStart={(e) => e.stopPropagation()}
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: 'var(--danger-color)', 
                                cursor: 'pointer', 
                                padding: '5px', 
                                borderRadius: '7px', 
                                transition: 'background 0.2s',
                                display: isSelectionMode ? 'none' : 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                              title="Delete transaction"
                              disabled={syncLoading}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {historyTransactions.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setHistoryViewAll(!historyViewAll)}
                    className="secondary-btn"
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginTop: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {historyViewAll ? 'View Less' : `View All (${historyTransactions.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Member contribution breakdown for groups in History tab */}
            {memberBreakdown && (
              <div className="glass-card animate-fade-in" style={{ marginTop: '16px', padding: '16px', borderLeft: '4px solid var(--primary-color)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} style={{ color: 'var(--primary-color)' }} /> Member Breakdown
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {memberBreakdown.map(member => (
                    <div key={member.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        {renderAvatar(member.profilePic, 32)}
                        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={`${member.username} ${member.email === user?.email ? '(Me)' : ''}`}>
                            {member.username} {member.email === user?.email ? '(Me)' : ''}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={member.email}>{member.email}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '140px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Today: ৳${member.today.toLocaleString()}`}>
                          Today: ৳{member.today.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: '600', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Month: ৳${member.month.toLocaleString()}`}>
                          Month: ৳{member.month.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Spend Breakdown Section */}
            <div className="glass-card" style={{ marginTop: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <PieChart size={20} style={{ color: 'var(--primary-color)', flexShrink: 0 }} /> Category Spend Breakdown
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '4px' }}>
                Spend distribution by category for a specific month and year.
              </p>

              {/* Month/Year Selectors */}
              <div style={{ display: 'flex', gap: '10px', background: 'var(--surface-subtle)', padding: '10px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Month</label>
                  <select
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '13px', height: '34px', margin: 0, width: '100%' }}
                    value={historySelectedMonth}
                    onChange={e => setHistorySelectedMonth(Number(e.target.value))}
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <label style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Year</label>
                  <select
                    className="form-input"
                    style={{ padding: '6px 10px', fontSize: '13px', height: '34px', margin: 0, width: '100%' }}
                    value={historySelectedYear}
                    onChange={e => setHistorySelectedYear(Number(e.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Budget and Remaining Balance display for the selected period */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--card-border)', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Period Budget Target</span>
                  <span style={{ fontSize: '16px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={activeBudgetForSelectedPeriod > 0 ? `৳${activeBudgetForSelectedPeriod.toLocaleString()}` : 'No Budget Set'}>
                    {activeBudgetForSelectedPeriod > 0 ? `৳${activeBudgetForSelectedPeriod.toLocaleString()}` : 'No Budget Set'}
                  </span>
                </div>
                {activeBudgetForSelectedPeriod > 0 && (
                  <div style={{ textAlign: 'right', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Remaining Balance</span>
                    <span style={{ 
                      fontSize: '16px', 
                      fontWeight: '800', 
                      color: (activeBudgetForSelectedPeriod - categoryBreakdown.totalSpent) < 0 ? 'var(--danger-color)' : 'var(--success-color)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block'
                    }} title={`৳${(activeBudgetForSelectedPeriod - categoryBreakdown.totalSpent).toLocaleString()}`}>
                      ৳{(activeBudgetForSelectedPeriod - categoryBreakdown.totalSpent).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Category Breakdown list */}
              {categoryBreakdown.breakdown.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px', overflow: 'hidden' }}>
                  {categoryBreakdown.breakdown.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', gap: '8px', minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</span>
                        </span>
                        <span style={{ fontWeight: '700', flexShrink: 0, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${item.amount.toLocaleString()} (${item.percentage}%)`}>
                          ৳{item.amount.toLocaleString()} <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 'normal' }}>({item.percentage}%)</span>
                        </span>
                      </div>
                      
                      {/* Progress Bar representing percentage of total month spend */}
                      <div style={{ width: '100%', height: '6px', background: 'var(--chart-empty-bar)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${item.percentage}%`, 
                          height: '100%', 
                          backgroundColor: item.color,
                          borderRadius: '3px' 
                        }} />
                      </div>
                    </div>
                  ))}
                  
                  <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: '700', gap: '8px', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Total Period Spending</span>
                    <span style={{ color: 'var(--primary-color)', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }} title={`৳${categoryBreakdown.totalSpent.toLocaleString()}`}>৳{categoryBreakdown.totalSpent.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '14px', marginBottom: '2px' }}>No spending recorded for this period.</p>
                  <p style={{ fontSize: '11px' }}>Change scope or select a different month/year above.</p>
                </div>
              )}
            </div>

            {/* Analytics & Reports Section - Adapts to every scope selected */}
            <div className="glass-card" style={{ marginTop: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={18} style={{ color: 'var(--primary-color)' }} /> Analytics & Reports
                </h3>
                <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', border: '1px solid var(--primary-border)', padding: '2px 8px', fontSize: '11px', fontWeight: '600' }}>
                  {filterGroup === 'personal' ? 'Personal' : activeGroupObj?.name || 'Group'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                View complete spending insights, daily averages, burn rate projection, and export reports for {filterGroup === 'personal' ? 'Personal' : activeGroupObj?.name || 'this group'}.
              </p>

              {/* Quick Export Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button 
                  type="button"
                  onClick={() => {
                    if (filterGroup === 'personal') {
                      handleDownloadPersonalPDF();
                    } else if (activeGroupObj) {
                      handleDownloadGroupPDF(activeGroupObj);
                    }
                  }}
                  className="secondary-btn"
                  style={{ justifyContent: 'center', padding: '10px', fontSize: '13px', borderRadius: 'var(--radius-sm)', gap: '6px', border: '1px solid var(--primary-border)', background: 'var(--primary-light)', color: 'var(--primary-color)' }}
                >
                  📄 PDF Report
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (filterGroup === 'personal') {
                      handleDownloadPersonalCSV();
                    } else if (activeGroupObj) {
                      handleDownloadGroupCSV(activeGroupObj);
                    }
                  }}
                  className="secondary-btn"
                  style={{ justifyContent: 'center', padding: '10px', fontSize: '13px', borderRadius: 'var(--radius-sm)', gap: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', background: 'rgba(16, 185, 129, 0.08)' }}
                >
                  📊 Sheet (CSV)
                </button>
              </div>

              <button 
                type="button" 
                onClick={handleOpenAnalyticsForScope}
                className="gradient-btn" 
                style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <PieChart size={16} /> Open Detailed Analytics
              </button>
            </div>

            {/* Floating Multi-Selection Summary Dock */}
            {selectedHistoryIds.length > 0 && (
              <div
                style={{
                  position: 'fixed',
                  bottom: '76px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 'calc(100% - 32px)',
                  maxWidth: '460px',
                  backgroundColor: 'var(--card-bg)',
                  border: '1.5px solid var(--primary-color)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  zIndex: 90,
                  backdropFilter: 'blur(8px)',
                  animation: 'fadeIn 0.2s ease-in-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      background: 'var(--primary-color)',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: '26px',
                      height: '26px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: '700',
                      flexShrink: 0
                    }}
                  >
                    {selectedHistoryIds.length}
                  </div>
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Selected Total Spent
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${selectedHistoryTotal.toLocaleString()}`}>
                      ৳{selectedHistoryTotal.toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearHistorySelection}
                  style={{
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-secondary)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="Clear selection"
                  aria-label="Clear selection"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            </div>
          </div>

          {/* ==================== TAB 3: SHARED COST GROUPS ==================== */}
          <div className="tab-pane" ref={el => { tabPanesRef.current[2] = el; }}>
            <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Info Widget */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} style={{ color: 'var(--primary-color)' }} /> Shared Cost Groups
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.5' }}>
                  Collaborate seamlessly with roommates, family, or friends. Create cost groups (e.g. "Home Cost"), invite others via a unique code, and track who spent what in real-time.
                </p>
              </div>

              {/* Join or Create Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {/* Join Group */}
                <div className="glass-card" style={{ marginBottom: 0, padding: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserPlus size={16} style={{ color: 'var(--primary-color)' }} /> Join Group
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                      Enter an invite code from the group owner to join.
                    </p>
                  </div>
                  <form onSubmit={handleJoinGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '10px 12px', fontSize: '14px' }}
                      placeholder="Invite Code"
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value)}
                      required
                    />
                    <button type="submit" className="gradient-btn" style={{ padding: '10px', fontSize: '14px', borderRadius: '12px' }} disabled={loading}>
                      Join
                    </button>
                  </form>
                </div>

                {/* Create Group */}
                <div className="glass-card" style={{ marginBottom: 0, padding: '16px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PlusCircle size={16} style={{ color: 'var(--primary-color)' }} /> Create Group
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                      Start a new group to track and share expenses with others.
                    </p>
                  </div>
                  <form onSubmit={handleCreateGroupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '10px 12px', fontSize: '14px' }}
                      placeholder="Group Name"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      required
                    />
                    <button type="submit" className="gradient-btn" style={{ padding: '10px', fontSize: '14px', borderRadius: '12px' }} disabled={loading}>
                      Create
                    </button>
                  </form>
                </div>
              </div>

              {/* List of joined Groups */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  My Shared Groups ({groups.length})
                </h3>

                {groups.length === 0 ? (
                  <div className="glass-card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                    You haven't joined or created any cost groups yet. Create one or ask for an invite code!
                  </div>
                ) : (
                  groups.map(g => {
                    const isOwner = g.owner?._id === user?.id || g.owner === user?.id;
                    const inviteCopied = copiedCode === g.inviteCode;

                    return (
                      <div key={g._id} className="glass-card" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <h4 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={g.name}>
                                {g.name}
                              </span>
                              {g.budget > 0 && (
                                <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--primary-color)', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={`Budget: ৳${g.budget.toLocaleString()}`}>
                                  Budget: ৳{g.budget.toLocaleString()}
                                </span>
                              )}
                            </h4>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '240px' }} title={`Managed by: ${isOwner ? 'You (Owner)' : g.owner?.username || 'Group Owner'}`}>
                              Managed by: {isOwner ? 'You (Owner)' : g.owner?.username || 'Group Owner'}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedGroupDetails(g);
                                setGroupBudgetInput(g.budget || '');
                              }}
                              className="secondary-btn"
                              style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} style={{ color: 'var(--primary-color)' }} />
                              Details
                            </button>

                            {isOwner ? (
                              <button
                                onClick={() => handleDeleteGroup(g._id)}
                                className="secondary-btn"
                                style={{ padding: '6px 10px', fontSize: '11px', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'var(--danger-bg)', color: '#fca5a5', borderRadius: '8px' }}
                                disabled={loading}
                              >
                                Delete Group
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLeaveGroup(g._id)}
                                className="secondary-btn"
                                style={{ padding: '6px 10px', fontSize: '11px', border: '1px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'var(--danger-bg)', color: '#fca5a5', borderRadius: '8px' }}
                                disabled={loading}
                              >
                                Leave Group
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Share with Personal Costing Toggle Button */}
                        {(() => {
                          const isLinkedToPersonal = linkedPersonalGroups.includes(g._id);
                          return (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 14px',
                              borderRadius: 'var(--radius-sm)',
                              background: isLinkedToPersonal ? 'var(--primary-light)' : 'var(--surface-subtle)',
                              border: isLinkedToPersonal ? '1px solid var(--primary-border)' : '1px solid var(--card-border)',
                              transition: 'all 0.2s ease',
                              gap: '12px'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                    Share with Personal Costing
                                  </span>
                                  {isLinkedToPersonal && (
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--primary-color)', background: 'var(--card-bg)', border: '1px solid var(--primary-border)', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      Enabled
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                  {isLinkedToPersonal 
                                    ? `Only what you spend in "${g.name}" is continuously added to your personal costing scope under "${g.name}".`
                                    : `Enable to automatically add your spending in this group into your personal costing scope under "${g.name}".`}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleLinkGroupToPersonal(g._id)}
                                role="switch"
                                aria-checked={isLinkedToPersonal}
                                style={{
                                  position: 'relative',
                                  width: '46px',
                                  height: '26px',
                                  borderRadius: '13px',
                                  border: 'none',
                                  backgroundColor: isLinkedToPersonal ? 'var(--primary-color)' : 'var(--card-border)',
                                  cursor: 'pointer',
                                  padding: 0,
                                  flexShrink: 0,
                                  transition: 'background-color 0.2s ease',
                                  outline: 'none'
                                }}
                                title={isLinkedToPersonal ? "Disable sharing with personal costing" : "Enable sharing with personal costing"}
                              >
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '3px',
                                    left: isLinkedToPersonal ? '23px' : '3px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                                    transition: 'left 0.2s ease'
                                  }}
                                />
                              </button>
                            </div>
                          );
                        })()}

                        {/* Invite Code widget */}
                        <div style={{ background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: '10px', border: '1px dashed var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Invite Code</span>
                            <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '0.05em', color: 'var(--primary-color)' }}>{g.inviteCode}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {isOwner && (
                              <button
                                onClick={() => handleRegenerateGroupInvite(g._id)}
                                className="secondary-btn"
                                style={{ padding: '8px 12px', fontSize: '12px', borderRadius: '8px', gap: '4px' }}
                                title="Regenerate Invite Code"
                              >
                                <RefreshCw size={14} />
                                <span>Regenerate</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleCopyInviteCode(g.inviteCode)}
                              className="secondary-btn"
                              style={{ padding: '8px 10px', borderRadius: '8px' }}
                              title={inviteCopied ? "Copied!" : "Copy Invite Code"}
                            >
                              {inviteCopied ? (
                                <CheckCircle size={14} style={{ color: 'var(--success-color)' }} />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Members section */}
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            Members ({g.members?.length || 0}):
                          </span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {g.members?.map(member => (
                              <span
                                key={member._id}
                                className="badge"
                                style={{
                                  backgroundColor: 'var(--surface-subtle)',
                                  color: 'var(--text-secondary)',
                                  border: '1px solid var(--card-border)',
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                title={member.email}
                              >
                                {renderAvatar(member.profilePic, 12)}
                                {member._id === user?.id ? 'Me' : member.username}
                                {isOwner && member._id !== user?.id && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveGroupMember(g._id, member._id, member.username)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#f87171',
                                      cursor: 'pointer',
                                      padding: 0,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      marginLeft: '2px'
                                    }}
                                    title={`Remove ${member.username}`}
                                  >
                                    <UserMinus size={11} />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '12px', marginTop: '4px' }}>
                          {isOwner ? (
                            <form onSubmit={(e) => handleUpdateGroupSettings(e, g._id)} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                  Group Name
                                </label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '8px 10px', fontSize: '13px' }}
                                  placeholder="Group Name"
                                  value={groupNames[g._id] || ''}
                                  onChange={e => setGroupNames({ ...groupNames, [g._id]: e.target.value })}
                                  required
                                />
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                  Group Google Sheets Web App URL (Optional)
                                </label>
                                <input
                                  type="url"
                                  className="form-input"
                                  style={{ padding: '8px 10px', fontSize: '13px' }}
                                  placeholder="Group-specific Apps Script URL"
                                  value={groupSheetUrls[g._id] || ''}
                                  onChange={e => setGroupSheetUrls({ ...groupSheetUrls, [g._id]: e.target.value })}
                                />
                              </div>

                              <button type="submit" className="gradient-btn" style={{ padding: '10px', fontSize: '13px', borderRadius: '10px', width: '100%', marginTop: '4px' }} disabled={loading}>
                                Save Group Settings
                              </button>

                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                If configured, group costs will sync here. Otherwise, group costs will not sync to Google Sheets.
                              </span>
                            </form>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {g.sheetUrl ? (
                                <>
                                  <CheckCircle size={12} style={{ color: 'var(--success-color)' }} />
                                  <span>Syncing group expenses to custom Google Sheet.</span>
                                </>
                              ) : (
                                <span>No group sheet configured. Group expenses will not sync to Google Sheets.</span>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            </div>
            </div>
          </div>

          {/* ==================== TAB 4: SETTINGS ==================== */}
          <div className="tab-pane" ref={el => { tabPanesRef.current[3] = el; }}>
            <div>
            {showAdminPanel ? (
              <div className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
                  <button
                    onClick={() => setShowAdminPanel(false)}
                    style={{ 
                      background: 'var(--secondary-btn-bg)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: '10px',
                      borderRadius: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background var(--transition-fast)'
                    }}
                    title="Exit Admin Panel"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Admin Control Panel</h2>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage system settings and user accounts</span>
                  </div>
                </div>

                {/* Sign up configuration card */}
                <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600' }}>Pause New Sign-ups</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {adminSignupPaused ? 'Users currently cannot create new accounts' : 'Public user sign-up is active'}
                      </span>
                    </div>
                    
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
                      <input
                        type="checkbox"
                        checked={adminSignupPaused}
                        onChange={(e) => handleToggleSignup(e.target.checked)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span className="slider" style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: adminSignupPaused ? 'var(--danger-color)' : 'var(--card-border)',
                        transition: '.4s',
                        borderRadius: '24px',
                        border: '1px solid var(--card-border)',
                        display: 'block'
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '""',
                          height: '16px',
                          width: '16px',
                          left: adminSignupPaused ? '26px' : '4px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          transition: '.4s',
                          borderRadius: '50%'
                        }} />
                      </span>
                    </label>
                  </div>
                </div>

                {/* Users List */}
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
                    Registered Accounts ({adminUsers.length})
                  </h3>

                  {adminLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                      <Loader className="animate-spin" size={24} style={{ color: 'var(--primary-color)' }} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {adminUsers.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No users found.</p>
                      ) : (
                        adminUsers.map(u => (
                          <div
                            key={u._id}
                            style={{
                              background: 'var(--surface-subtle)',
                              border: '1px solid var(--card-border)',
                              borderRadius: '12px',
                              padding: '12px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              width: '100%'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                              {renderAvatar(u.profilePic, 36)}
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {u.username}
                                  {(u.role === 'admin' || u.username === 'rkdarpan') && (
                                    <span style={{ fontSize: '10px', background: 'var(--primary-light)', border: '1px solid var(--primary-border)', color: 'var(--primary-color)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', fontWeight: '600' }}>
                                      Admin
                                    </span>
                                  )}
                                </span>
                                <span 
                                  style={{ 
                                    fontSize: '12px', 
                                    color: 'var(--text-secondary)',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    maxWidth: '150px',
                                    display: 'block'
                                  }}
                                  title={u.email}
                                >
                                  {u.email}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Reg: {new Date(u.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                              {u.role !== 'admin' && u.username !== 'rkdarpan' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPasswordResetUser({ 
                                        id: u._id, 
                                        username: u.username,
                                        email: u.email,
                                        createdAt: u.createdAt,
                                        profilePic: u.profilePic
                                      });
                                      setNewPasswordForUser('');
                                    }}
                                    style={{
                                      background: 'var(--secondary-btn-bg)',
                                      border: '1px solid var(--card-border)',
                                      color: 'var(--text-secondary)',
                                      cursor: 'pointer',
                                      padding: '8px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.2s',
                                      width: '32px',
                                      height: '32px',
                                      flexShrink: 0
                                    }}
                                    title="View details & set password"
                                  >
                                    <Eye size={15} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveUser(u._id, u.username, u.role)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.08)',
                                      border: '1px solid rgba(239, 68, 68, 0.2)',
                                      color: 'var(--danger-color)',
                                      cursor: 'pointer',
                                      padding: '8px',
                                      borderRadius: '8px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'background 0.2s',
                                      width: '32px',
                                      height: '32px',
                                      flexShrink: 0
                                    }}
                                    title="Remove User permanently"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Account Profile Settings */}
                <div className="glass-card">
                  <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={18} style={{ color: 'var(--primary-color)' }} /> Account Profile
                    </span>
                    {user && (user.role === 'admin' || user.username === 'rkdarpan') && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAdminPanel(true);
                          fetchAdminData();
                        }}
                        style={{
                          background: 'var(--primary-light)',
                          border: '1px solid var(--primary-border)',
                          color: 'var(--primary-color)',
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all var(--transition-fast)'
                        }}
                        title="Admin Control Panel"
                        aria-label="Admin Control Panel"
                        className="admin-control-btn"
                      >
                        <Shield size={16} />
                      </button>
                    )}
                  </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                Update your account details, choose a profile avatar, or change your password.
              </p>

              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Profile Pic Selector & Upload */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Profile Picture</label>
                  
                  {/* File Upload Section */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', marginBottom: '16px' }}>
                    {renderAvatar(profileForm.profilePic, 64)}
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="file"
                        accept="image/*"
                        id="avatar-upload-file-input"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <label
                        htmlFor="avatar-upload-file-input"
                        className="secondary-btn"
                        style={{ 
                          padding: '10px 16px', 
                          fontSize: '13px', 
                          fontWeight: '600',
                          cursor: 'pointer', 
                          borderRadius: '10px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          border: '1px solid var(--card-border)',
                          background: 'var(--surface-subtle)'
                        }}
                      >
                        Upload Photo
                      </label>
                      {profileForm.profilePic && (
                        <button
                          type="button"
                          onClick={() => setProfileForm(prev => ({ ...prev, profilePic: '' }))}
                          style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: 'var(--danger-color)',
                            cursor: 'pointer',
                            padding: '10px',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background var(--transition-fast)'
                          }}
                          title="Remove Photo"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preset Avatars Selection */}
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Or choose a preset avatar</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px', marginBottom: '12px' }}>
                    {presetAvatars.map((avatar, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setProfileForm(prev => ({ ...prev, profilePic: avatar }))}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          border: profileForm.profilePic === avatar ? '2px solid var(--primary-color)' : '1px solid var(--card-border)',
                          background: 'var(--surface-subtle)',
                          fontSize: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0,
                          transition: 'transform var(--transition-fast)',
                          transform: profileForm.profilePic === avatar ? 'scale(1.1)' : 'scale(1)'
                        }}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Or enter custom URL/Emoji"
                      value={profileForm.profilePic}
                      onChange={e => setProfileForm(prev => ({ ...prev, profilePic: e.target.value }))}
                      style={{ fontSize: '13px', padding: '10px 12px' }}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Username</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Username"
                      value={profileForm.username}
                      onChange={e => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="Email"
                      value={profileForm.email}
                      onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Personal Monthly Budget Goal (৳)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 20000 (Enter 0 or leave empty to disable)"
                    value={profileForm.budget}
                    onChange={e => setProfileForm(prev => ({ ...prev, budget: e.target.value }))}
                    min="0"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary-color)' }}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    Telegram Chat ID
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Telegram Chat ID (e.g. 123456789)"
                    value={profileForm.telegramChatId || ''}
                    onChange={e => setProfileForm(prev => ({ ...prev, telegramChatId: e.target.value }))}
                  />
                  {user && user.telegramBotUsername ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                      🔗 Quick link: Send <strong>/start</strong> to <a href={`https://t.me/${user.telegramBotUsername}?start=${user.id || user._id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline', fontWeight: '500' }}>@{user.telegramBotUsername}</a> to automatically link your account, or copy your Chat ID from the bot.
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
                      ℹ️ Add <code>TELEGRAM_BOT_TOKEN</code> to your backend <code>.env</code> file to enable direct linking and see the bot username.
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--card-border)', marginTop: '8px', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '13.5px', fontWeight: '600', marginBottom: '10px', color: 'var(--text-secondary)' }}>Change Password (Optional)</h4>
                  <div className="form-row" style={(user?.role?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'rkdarpan') ? { gridTemplateColumns: '1fr' } : {}}>
                    {!(user?.role?.toLowerCase() === 'admin' || user?.username?.toLowerCase() === 'rkdarpan') && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Current Password</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="••••••"
                          value={profileForm.currentPassword}
                          onChange={e => setProfileForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                        />
                      </div>
                    )}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>New Password</label>
                      <input
                        type="password"
                        className="form-input"
                        placeholder="••••••"
                        value={profileForm.newPassword}
                        onChange={e => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" className="gradient-btn" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                  Save Profile Changes
                </button>
              </form>
            </div>

            {/* Google Sheets Sync Settings */}
            <div className="glass-card">
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ExternalLink size={18} style={{ color: 'var(--primary-color)' }} /> Google Sheets Sync
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                Enter the Google Apps Script Web App URL to mirror your local expenses to a Google Sheet.
              </p>

              <form onSubmit={handleSheetUrlSubmit}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Apps Script Web App URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={sheetUrlForm}
                    onChange={e => setSheetUrlForm(e.target.value)}
                  />
                </div>
                <button type="submit" className="gradient-btn" style={{ width: '100%', padding: '12px' }} disabled={loading}>
                  Save URL Config
                </button>
              </form>

              {user?.sheetUrl && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)', fontSize: '12px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} /> Active Google Sheet Sync is configured.
                </div>
              )}
            </div>

            {/* Guide to setup Google Sheets */}
            <div className="glass-card">
              <button 
                type="button" 
                onClick={() => setShowSheetScriptInstructions(!showSheetScriptInstructions)}
                className="secondary-btn" 
                style={{ width: '100%', justifyContent: 'space-between', padding: '12px', borderRadius: '12px' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                  <ExternalLink size={16} /> How to Setup Google Sheet Sync
                </span>
                <span>{showSheetScriptInstructions ? '▼' : '►'}</span>
              </button>

              {showSheetScriptInstructions && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                  <p>1. Create a blank Google Sheet.</p>
                  <p>2. Open <strong>Extensions &gt; Apps Script</strong>.</p>
                  <p>3. Delete any default code and paste this script:</p>
                  <div style={{ position: 'relative' }}>
                    <pre style={{ background: 'var(--bg-primary)', padding: '12px 36px 12px 12px', borderRadius: '8px', overflowX: 'auto', fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-primary)', border: '1px solid var(--card-border)', maxHeight: '200px' }}>
{`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Determine sheet name (tab name) from transaction date in format YYYY-MM
    var sheetName = "Expenses";
    if (data.date && data.date.indexOf("-") !== -1) {
      var parts = data.date.split(" ")[0].split("-");
      if (parts.length >= 2) {
        sheetName = parts[0] + "-" + parts[1]; // e.g. "2026-07"
      }
    } else {
      var d = new Date();
      var y = d.getFullYear();
      var m = ("0" + (d.getMonth() + 1)).slice(-2);
      sheetName = y + "-" + m;
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    if (data.action === 'add') {
      // Check if new sheet, initialize headers & summary table
      if (sheet.getLastRow() === 0) {
        // Headers start from row 1
        sheet.getRange("A1:I1").setValues([["Date", "Transaction ID", "User Email", "Item Name", "Cost", "Quantity", "Category", "Group Name", "Total Price"]]);
        
        // Summary Table in Columns K and L
        sheet.getRange("K1:L1").setValues([["Summary Metrics", "Values"]]).setFontWeight("bold");
        sheet.getRange("K2:K4").setValues([["Total Budget"], ["Total Expenses"], ["Remaining Balance"]]);
        sheet.getRange("L2").setValue(Number(data.budget || 0));
        sheet.getRange("L3").setFormula("=SUM(I2:I)");
        sheet.getRange("L4").setFormula("=L2-L3");
        
        sheet.getRange("K1:L4").setBorder(true, true, true, true, true, true);
        sheet.getRange("K1:L1").setBackground("#e2e8f0");
        sheet.getRange("K2:K4").setBackground("#f8fafc");
      } else {
        // Update budget with latest value
        sheet.getRange("L2").setValue(Number(data.budget || 0));
      }
      
      // Find the last row in Column A to place the next transaction row
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") {
          lastRow = r + 1;
        }
      }
      var nextRow = lastRow + 1;
      
      sheet.getRange(nextRow, 1, 1, 9).setValues([[
        data.date,
        data.id,
        data.userEmail,
        data.name,
        Number(data.cost),
        Number(data.quantity),
        data.category,
        data.groupName || 'Personal',
        Number(data.cost) * Number(data.quantity)
      ]]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row added' }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (data.action === 'delete') {
      // Find transaction ID in Column B
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") {
          lastRow = r + 1;
        }
      }
      
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (ids[i][0] === data.id) {
            sheet.getRange(i + 2, 1, 1, 9).deleteCells(SpreadsheetApp.Dimension.ROWS);
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row deleted' }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'ID not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
                    </pre>
                    <button
                      type="button"
                      onClick={() => {
                        setScriptCopied(true);
                        setTimeout(() => setScriptCopied(false), 3000);
                        navigator.clipboard.writeText(`function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Determine sheet name (tab name) from transaction date in format YYYY-MM
    var sheetName = "Expenses";
    if (data.date && data.date.indexOf("-") !== -1) {
      var parts = data.date.split(" ")[0].split("-");
      if (parts.length >= 2) {
        sheetName = parts[0] + "-" + parts[1]; // e.g. "2026-07"
      }
    } else {
      var d = new Date();
      var y = d.getFullYear();
      var m = ("0" + (d.getMonth() + 1)).slice(-2);
      sheetName = y + "-" + m;
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    if (data.action === 'add') {
      // Check if new sheet, initialize headers & summary table
      if (sheet.getLastRow() === 0) {
        // Headers start from row 1
        sheet.getRange("A1:I1").setValues([["Date", "Transaction ID", "User Email", "Item Name", "Cost", "Quantity", "Category", "Group Name", "Total Price"]]);
        
        // Summary Table in Columns K and L
        sheet.getRange("K1:L1").setValues([["Summary Metrics", "Values"]]).setFontWeight("bold");
        sheet.getRange("K2:K4").setValues([["Total Budget"], ["Total Expenses"], ["Remaining Balance"]]);
        sheet.getRange("L2").setValue(Number(data.budget || 0));
        sheet.getRange("L3").setFormula("=SUM(I2:I)");
        sheet.getRange("L4").setFormula("=L2-L3");
        
        sheet.getRange("K1:L4").setBorder(true, true, true, true, true, true);
        sheet.getRange("K1:L1").setBackground("#e2e8f0");
        sheet.getRange("K2:K4").setBackground("#f8fafc");
      } else {
        // Update budget with latest value
        sheet.getRange("L2").setValue(Number(data.budget || 0));
      }
      
      // Find the last row in Column A to place the next transaction row
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") {
          lastRow = r + 1;
        }
      }
      var nextRow = lastRow + 1;
      
      sheet.getRange(nextRow, 1, 1, 9).setValues([[
        data.date,
        data.id,
        data.userEmail,
        data.name,
        Number(data.cost),
        Number(data.quantity),
        data.category,
        data.groupName || 'Personal',
        Number(data.cost) * Number(data.quantity)
      ]]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row added' }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (data.action === 'delete') {
      // Find transaction ID in Column B
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") {
          lastRow = r + 1;
        }
      }
      
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (ids[i][0] === data.id) {
            sheet.getRange(i + 2, 1, 1, 9).deleteCells(SpreadsheetApp.Dimension.ROWS);
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row deleted' }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'ID not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`);
                        showAlert('Apps Script code copied to clipboard!', 'success');
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'var(--surface-subtle-hover)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '6px',
                        padding: '6px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s',
                        zIndex: 10
                      }}
                      title={scriptCopied ? "Copied!" : "Copy Script Code"}
                    >
                      {scriptCopied ? (
                        <CheckCircle size={14} style={{ color: 'var(--success-color)' }} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <p>4. Click <strong>Deploy &gt; New deployment</strong>. Select <strong>Web App</strong>. Set "Execute as" to <strong>Me</strong> and "Who has access" to <strong>Anyone</strong>.</p>
                  <p>5. Click <strong>Deploy</strong>, authorize permissions, and copy the <strong>Web App URL</strong>.</p>
                  <p>6. Paste the URL above (for personal sync) or in the Groups tab (for group sync) and save!</p>
                </div>
              )}
            </div>

            {/* Custom Category Settings - As requested by user */}
            <div className="glass-card">
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Tag size={18} style={{ color: 'var(--primary-color)' }} /> Manage Categories
              </h2>

              {/* Scope Selector */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Select Scope</label>
                <select
                  className="form-input"
                  value={settingsCategoryScope}
                  onChange={e => setSettingsCategoryScope(e.target.value)}
                  style={{ 
                    appearance: 'none', 
                    backgroundPosition: 'right 16px center', 
                    backgroundRepeat: 'no-repeat', 
                    backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2394a3b8%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27%3E%3C/polyline%3E%3C/svg%3E")',
                    margin: 0
                  }}
                >
                  <option value="personal">Personal Only</option>
                  {groups.map(g => (
                    <option key={g._id} value={g._id}>Group: {g.name}</option>
                  ))}
                </select>
              </div>

              {/* Form to create new category or permission message */}
              {!isSettingsScopeOwner ? (
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontSize: '13.5px', marginBottom: '20px', lineHeight: 1.4 }}>
                  ⚠️ Only the group creator ({groups.find(g => g._id === settingsCategoryScope)?.owner?.username || 'Group Owner'}) can create or manage custom categories for this group.
                </div>
              ) : (
                <form onSubmit={handleCategorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', padding: '14px', borderRadius: '12px', background: 'var(--surface-subtle)', border: '1px solid var(--card-border)' }}>
                  <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Add Custom Category</h4>
                  
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Category Name</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Travel ✈️"
                        value={categoryForm.name}
                        onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Badge Color</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%', height: '100%' }}>
                        <input
                          type="color"
                          className="color-picker-input"
                          value={categoryForm.color}
                          onChange={e => setCategoryForm({ ...categoryForm, color: e.target.value })}
                        />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{categoryForm.color}</span>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="gradient-btn" style={{ padding: '12px' }} disabled={loading}>
                    <PlusCircle size={16} /> Create Category
                  </button>
                </form>
              )}

              {/* List of current categories */}
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Your Categories ({settingsCategories.length})
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                {settingsCategories.map(cat => (
                  <div key={cat._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-subtle)', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }}></span>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cat.name}>{cat.name}</span>
                    </div>
                    
                    {canDeleteCategory(cat) && (
                      <button
                        onClick={() => handleDeleteCategory(cat._id, cat.name)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}
                        title="Delete custom category"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Push Notifications Settings Card */}
            <div className="glass-card">
              <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} style={{ color: 'var(--primary-color)' }} /> Push & Device Alerts
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                Receive real-time push alerts on this device when other members add or edit costs in your joined groups.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'var(--surface-subtle)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>
                    {isSubscribedToPush ? 'Push Alerts Enabled' : 'Push Alerts Disabled'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {isSubscribedToPush 
                      ? 'You will receive alerts on this device even when the app is closed.'
                      : 'Enable to receive group cost alerts directly on this device.'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={togglePushSubscription}
                  disabled={isPushLoading}
                  className={isSubscribedToPush ? 'secondary-btn' : 'gradient-btn'}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    margin: 0,
                    width: 'auto'
                  }}
                >
                  {isPushLoading ? (
                    <Loader className="animate-spin" size={14} />
                  ) : isSubscribedToPush ? (
                    'Disable'
                  ) : (
                    'Enable'
                  )}
                </button>
              </div>
            </div>

            {/* Log Out button at bottom of settings */}
            <button 
              type="button" 
              onClick={handleLogout}
              className="secondary-btn" 
              style={{ 
                width: '100%', 
                padding: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                color: 'var(--danger-color)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.06)',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                fontWeight: '600',
                marginTop: '16px',
                marginBottom: '16px'
              }}
            >
              <LogOut size={16} /> Log Out
            </button>

            {/* App Version Info & Clear Cache */}
            <div style={{
              textAlign: 'center',
              padding: '8px 0 28px 0',
              color: 'var(--text-muted)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              userSelect: 'none'
            }}>
              <span style={{ fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.2px' }}>
                Hisab Khata
              </span>
              <span>Version {APP_VERSION}</span>
              <button
                type="button"
                onClick={async () => {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try { navigator.vibrate(35); } catch {}
                  }
                  if ('caches' in window) {
                    try {
                      const keys = await caches.keys();
                      await Promise.all(keys.map(k => caches.delete(k)));
                    } catch (e) {}
                  }
                  if ('serviceWorker' in navigator) {
                    try {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      for (const reg of regs) {
                        await reg.unregister();
                      }
                    } catch (e) {}
                  }
                  window.location.reload();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-color)',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  marginTop: '4px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: 0.85
                }}
                title="Wipe old cached files and reload the latest version"
              >
                <RefreshCw size={12} /> Force Clear Cache & Reload
              </button>
            </div>
          </>
        )}
      </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Tab Bar */}
      <nav className="app-nav">
        <button
          className={`nav-item ${activeTab === 'track' ? 'active' : ''}`}
          onClick={() => switchTab('track')}
        >
          <Wallet size={22} />
          <span>Track</span>
        </button>
        
        <button
          className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => switchTab('history')}
        >
          <ClipboardList size={22} />
          <span>History</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => switchTab('groups')}
        >
          <Users size={22} />
          <span>Groups</span>
        </button>
        
        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => switchTab('settings')}
        >
          <SettingsIcon size={22} />
          <span>Settings</span>
        </button>
      </nav>

      {/* Group Details & Budget Analytics Modal */}
      {selectedGroupDetails && (() => {
        // Filter group transactions by selected month & year
        const groupTransactions = transactions.filter(t => {
          const isGrp = t.group && (t.group._id === selectedGroupDetails._id || t.group === selectedGroupDetails._id);
          if (!isGrp) return false;
          
          const tDate = parseLocalDate(t.date);
          return tDate.getMonth() === analyticsSelectedMonth && tDate.getFullYear() === analyticsSelectedYear;
        });

        // Determine target budget for the selected month/year
        const now = new Date();
        const isCurrentPeriod = (analyticsSelectedMonth === now.getMonth()) && (analyticsSelectedYear === now.getFullYear());
        const selectedPeriodBudget = (() => {
          if (isCurrentPeriod) {
            return selectedGroupDetails.budget || 0;
          }
          const hist = selectedGroupDetails.historicalBudgets?.find(
            hb => hb.month === analyticsSelectedMonth && hb.year === analyticsSelectedYear
          );
          return hist ? hist.amount : (selectedGroupDetails.budget || 0);
        })();

        const filteredTotalSpent = groupTransactions.reduce((acc, t) => acc + (t.cost * t.quantity), 0);
        const filteredRemainingBalance = selectedPeriodBudget - filteredTotalSpent;

        const getDaysInMonth = (month, year) => {
          const dNow = new Date();
          if (month === dNow.getMonth() && year === dNow.getFullYear()) {
            return dNow.getDate();
          }
          return new Date(year, month + 1, 0).getDate();
        };

        const daysInRange = getDaysInMonth(analyticsSelectedMonth, analyticsSelectedYear) || 1;
        const dailyAvg = filteredTotalSpent / daysInRange;

        let remainingDays = 'N/A';
        if (selectedPeriodBudget > 0) {
          if (filteredRemainingBalance <= 0) {
            remainingDays = '0 (Budget exceeded)';
          } else if (dailyAvg <= 0) {
            remainingDays = '∞ (No consumption)';
          } else {
            remainingDays = Math.ceil(filteredRemainingBalance / dailyAvg);
          }
        }

        // Calculate member breakdown for the selected period
        const breakdown = {};
        selectedGroupDetails.members?.forEach(m => {
          const mId = m._id || m;
          breakdown[mId] = {
            username: m.username || 'Member',
            email: m.email || '',
            spent: 0
          };
        });
        
        groupTransactions.forEach(t => {
          const uId = t.user?._id || t.user;
          if (uId && breakdown[uId]) {
            breakdown[uId].spent += t.cost * t.quantity;
          }
        });
        const memberAnalyticsList = Object.values(breakdown);

        // Calculate category spend breakdown for the selected period
        const categoryTotals = {};
        groupTransactions.forEach(t => {
          const amt = t.cost * t.quantity;
          categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
        });

        const periodCategoryBreakdown = Object.entries(categoryTotals).map(([name, amount]) => {
          const percentage = filteredTotalSpent > 0 ? Math.round((amount / filteredTotalSpent) * 100) : 0;
          const catObj = categories.find(c => c.name === name);
          const color = catObj ? catObj.color : '#6b7280';
          return { name, amount, percentage, color };
        }).sort((a, b) => b.amount - a.amount);

        const trend = getGroupDailyTrend(selectedGroupDetails);
        const maxTrendAmount = Math.max(...trend.map(t => t.amount), 100);

        const handleDownloadSheet = () => {
          let csvContent = "";
          csvContent += `Group Budget Report - ${selectedGroupDetails.name}\n`;
          csvContent += `Period,${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][analyticsSelectedMonth]} ${analyticsSelectedYear}\n`;
          csvContent += `Whole Month's Budget,${selectedPeriodBudget}\n`;
          csvContent += `Total Spent,${filteredTotalSpent}\n`;
          csvContent += `Remaining Balance,${filteredRemainingBalance}\n`;
          csvContent += `Daily Average,${Math.round(dailyAvg)}\n\n`;
          
          csvContent += "CATEGORY SPEND BREAKDOWN\n";
          csvContent += "Category,Total Spent,Percentage\n";
          periodCategoryBreakdown.forEach(c => {
            csvContent += `"${c.name}",${c.amount},${c.percentage}%\n`;
          });
          csvContent += "\n";

          csvContent += "MEMBER BREAKDOWN\n";
          csvContent += "Member Username,Email,Total Spent\n";
          memberAnalyticsList.forEach(m => {
            csvContent += `"${m.username}","${m.email}",${m.spent}\n`;
          });
          csvContent += "\n";
          
          csvContent += "COST ITEMS LIST\n";
          csvContent += "Date,Item Name,Category,Cost,Quantity,Total Price,Added By\n";
          groupTransactions.forEach(t => {
            const addedBy = t.user?.username || (t.user?._id === user?.id || t.user === user?.id ? 'Me' : 'Unknown');
            const formattedDate = parseLocalDate(t.date).toLocaleDateString();
            csvContent += `"${formattedDate}","${t.itemName.replace(/"/g, '""')}","${t.category}",${t.cost},${t.quantity},${t.cost * t.quantity},"${addedBy}"\n`;
          });

          const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `${selectedGroupDetails.name.replace(/\s+/g, '_')}_Budget_Report.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        const handleDownloadPDF = async () => {
          try {
            const response = await axios.get(`${API_BASE}/transactions/report/pdf?groupId=${selectedGroupDetails._id}`, {
              ...getHeaders(),
              responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${selectedGroupDetails.name.replace(/\s+/g, '_')}_Budget_Report.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (err) {
            console.error("Error downloading group PDF:", err);
            alert("Failed to download PDF report. Please try again.");
          }
        };

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 15, 29, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9990,
            padding: '20px'
          }} className="animate-fade-in">
            <div className="glass-card animate-scale-in" style={{
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg, #1e293b)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                <div style={{ minWidth: 0, flex: 1, marginRight: '12px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${selectedGroupDetails.name} Analytics`}>
                    {selectedGroupDetails.name} Analytics
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Collaborative consumption insights
                  </span>
                </div>
                <button
                  onClick={() => setSelectedGroupDetails(null)}
                  style={{
                    background: 'var(--secondary-btn-bg)',
                    border: 'none',
                    color: 'var(--text-primary)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Budget Settings Form (All members can set) */}
              <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Set Group Budget
                </h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUpdateGroupBudget(selectedGroupDetails._id, groupBudgetInput);
                  }}
                  style={{ display: 'flex', gap: '8px' }}
                >
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="Enter total group budget"
                    style={{ flex: 1, padding: '8px 10px', fontSize: '13px' }}
                    value={groupBudgetInput}
                    onChange={(e) => setGroupBudgetInput(e.target.value)}
                    required
                  />
                  <button type="submit" className="gradient-btn" style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '10px' }} disabled={loading}>
                    Update
                  </button>
                </form>
              </div>

              {/* Filter Period & Export Controls */}
              <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Filter Period & Export
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Month</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: '12.5px', height: '34px', margin: 0 }}
                      value={analyticsSelectedMonth}
                      onChange={e => setAnalyticsSelectedMonth(Number(e.target.value))}
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                        <option key={idx} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Year</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: '12.5px', height: '34px', margin: 0 }}
                      value={analyticsSelectedYear}
                      onChange={e => setAnalyticsSelectedYear(Number(e.target.value))}
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    onClick={handleDownloadPDF}
                    className="secondary-btn"
                    style={{ justifyContent: 'center', padding: '10px', fontSize: '13px', borderRadius: 'var(--radius-sm)', gap: '6px', border: '1px solid var(--primary-border)', background: 'var(--primary-light)', color: 'var(--primary-color)' }}
                  >
                    📄 PDF Report
                  </button>
                  <button 
                    onClick={handleDownloadSheet}
                    className="secondary-btn"
                    style={{ justifyContent: 'center', padding: '10px', fontSize: '13px', borderRadius: 'var(--radius-sm)', gap: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', background: 'rgba(16, 185, 129, 0.08)' }}
                  >
                    📊 Sheet (CSV)
                  </button>
                </div>
              </div>

              {/* Stats Breakdown Widgets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-card" style={{ margin: 0, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remaining Balance</span>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: filteredRemainingBalance >= 0 ? 'var(--success-color)' : '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${filteredRemainingBalance.toLocaleString()}`}>
                    ৳{filteredRemainingBalance.toLocaleString()}
                  </span>
                </div>
                <div className="glass-card" style={{ margin: 0, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Daily Avg (Filter Range)</span>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${Math.round(dailyAvg).toLocaleString()}`}>
                    ৳{Math.round(dailyAvg).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Burn Projection Widget */}
              <div style={{ background: 'var(--primary-light)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-color)' }}>
                  Burn rate projection
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  {selectedPeriodBudget > 0 ? (
                    filteredRemainingBalance <= 0 ? (
                      <span style={{ color: '#f87171', fontWeight: 600 }}>⚠️ Budget exceeded! You have spent more than the allocated budget pool.</span>
                    ) : (
                      <>
                        Based on your group's current monthly burn rate, the remaining budget is estimated to last: <strong>{remainingDays} days</strong>.
                      </>
                    )
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Set a group budget above to enable remaining days projection.</span>
                  )}
                </span>
              </div>

              {/* Member Breakdown Section */}
              <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Member Consumption
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {memberAnalyticsList.map(member => (
                    <div key={member.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-subtle-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', gap: '10px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={member.username}>
                          {member.username}
                        </span>
                        <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={member.email}>{member.email}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '120px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--primary-color)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${member.spent.toLocaleString()}`}>
                          ৳{member.spent.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical Consumption Graph */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  7-Day Spending Trend (All Members)
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '140px', padding: '10px 0', borderBottom: '1px solid var(--card-border)', marginBottom: '10px' }}>
                  {trend.map((day, idx) => {
                    const pct = (day.amount / maxTrendAmount) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          {day.amount > 0 ? `৳${Math.round(day.amount)}` : ''}
                        </span>
                        <div style={{
                          width: '18px',
                          height: `${Math.max(pct, 4)}px`,
                          background: day.amount > 0 ? 'var(--primary-color)' : 'var(--chart-empty-bar)',
                          borderRadius: '3px',
                          transition: 'height 0.2s ease'
                        }} />
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
                <button
                  className="secondary-btn"
                  style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  onClick={() => setSelectedGroupDetails(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Personal Details & Budget Analytics Modal */}
      {showPersonalAnalytics && (() => {
        // Filter personal transactions by selected month & year
        const purePersonalTransactions = transactions.filter(t => {
          if (t.group) return false;
          
          const tDate = parseLocalDate(t.date);
          return tDate.getMonth() === analyticsSelectedMonth && tDate.getFullYear() === analyticsSelectedYear;
        });

        const myId = user?.id || user?._id;
        const consolidatedGroupEntries = [];
        if (Array.isArray(linkedPersonalGroups) && linkedPersonalGroups.length > 0) {
          linkedPersonalGroups.forEach(gid => {
            const matchedGroup = groups.find(g => g._id === gid);
            const groupName = matchedGroup?.name || 'Shared Group';

            const myGroupTxs = transactions.filter(t => {
              const tGid = t.group?._id || t.group || t.groupId;
              if (tGid !== gid) return false;
              const tDate = parseLocalDate(t.date);
              if (tDate.getMonth() !== analyticsSelectedMonth || tDate.getFullYear() !== analyticsSelectedYear) return false;

              return myId && (
                (t.user?._id && (t.user._id === myId || t.user._id === user?.id || t.user._id === user?._id)) ||
                (typeof t.user === 'string' && (t.user === myId || t.user === user?.id || t.user === user?._id)) ||
                (t.user?.email && user?.email && t.user.email === user.email)
              );
            });

            if (myGroupTxs.length > 0) {
              const sorted = [...myGroupTxs].sort((a, b) => {
                const dateA = parseLocalDate(a.date);
                const dateB = parseLocalDate(b.date);
                if (dateB - dateA !== 0) return dateB - dateA;
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
              });
              const latestTx = sorted[0];
              const totalSpent = myGroupTxs.reduce((sum, t) => sum + (t.cost * t.quantity), 0);

              consolidatedGroupEntries.push({
                date: latestTx.date,
                createdAt: latestTx.createdAt,
                itemName: groupName, // just group name
                category: 'Shared Cost',
                cost: totalSpent, // total cost
                quantity: 1,
                totalPrice: totalSpent
              });
            }
          });
        }

        // Determine target budget for selected month & year
        const now = new Date();
        const isCurrentPeriod = (analyticsSelectedMonth === now.getMonth()) && (analyticsSelectedYear === now.getFullYear());
        const selectedPeriodBudget = (() => {
          if (isCurrentPeriod) {
            return user?.budget || 0;
          }
          const hist = user?.historicalBudgets?.find(
            hb => hb.month === analyticsSelectedMonth && hb.year === analyticsSelectedYear
          );
          return hist ? hist.amount : (user?.budget || 0);
        })();

        const filteredTotalSpent = purePersonalTransactions.reduce((acc, t) => acc + (t.cost * t.quantity), 0) +
          consolidatedGroupEntries.reduce((acc, g) => acc + g.cost, 0);
        const filteredRemainingBalance = selectedPeriodBudget - filteredTotalSpent;

        const getDaysInMonth = (month, year) => {
          const dNow = new Date();
          if (month === dNow.getMonth() && year === dNow.getFullYear()) {
            return dNow.getDate();
          }
          return new Date(year, month + 1, 0).getDate();
        };

        const daysInRange = getDaysInMonth(analyticsSelectedMonth, analyticsSelectedYear) || 1;
        const dailyAvg = filteredTotalSpent / daysInRange;

        let remainingDays = 'N/A';
        if (selectedPeriodBudget > 0) {
          if (filteredRemainingBalance <= 0) {
            remainingDays = '0 (Budget exceeded)';
          } else if (dailyAvg <= 0) {
            remainingDays = '∞ (No consumption)';
          } else {
            remainingDays = Math.ceil(filteredRemainingBalance / dailyAvg);
          }
        }

        // Calculate category spend breakdown for the selected period
        const categoryTotals = {};
        purePersonalTransactions.forEach(t => {
          const amt = t.cost * t.quantity;
          categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
        });
        consolidatedGroupEntries.forEach(g => {
          categoryTotals['Shared Cost'] = (categoryTotals['Shared Cost'] || 0) + g.cost;
        });

        const periodCategoryBreakdown = Object.entries(categoryTotals).map(([name, amount]) => {
          const percentage = filteredTotalSpent > 0 ? Math.round((amount / filteredTotalSpent) * 100) : 0;
          const catObj = categories.find(c => c.name === name);
          const color = catObj ? catObj.color : '#6b7280';
          return { name, amount, percentage, color };
        }).sort((a, b) => b.amount - a.amount);

        // Calculate 7-day spending trend for personal expenses
        const trend = (() => {
          const days = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push({
              dateString: d.toDateString(),
              label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
              amount: 0
            });
          }
          
          purePersonalTransactions.forEach(t => {
            const tDate = parseLocalDate(t.date).toDateString();
            const match = days.find(day => day.dateString === tDate);
            if (match) {
              match.amount += t.cost * t.quantity;
            }
          });

          transactions.forEach(t => {
            const gid = t.group?._id || t.group || t.groupId;
            if (gid && Array.isArray(linkedPersonalGroups) && linkedPersonalGroups.includes(gid)) {
              const isMy = myId && (
                (t.user?._id && (t.user._id === myId || t.user._id === user?.id || t.user._id === user?._id)) ||
                (typeof t.user === 'string' && (t.user === myId || t.user === user?.id || t.user === user?._id)) ||
                (t.user?.email && user?.email && t.user.email === user.email)
              );
              if (isMy) {
                const tDate = parseLocalDate(t.date).toDateString();
                const match = days.find(day => day.dateString === tDate);
                if (match) {
                  match.amount += t.cost * t.quantity;
                }
              }
            }
          });
          
          return days;
        })();
        const maxTrendAmount = Math.max(...trend.map(t => t.amount), 100);

        const handleDownloadSheet = () => {
          let csvContent = "";
          csvContent += `Personal Expense Report - ${user.username}\n`;
          csvContent += `Period,${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][analyticsSelectedMonth]} ${analyticsSelectedYear}\n`;
          csvContent += `Monthly Budget,${selectedPeriodBudget}\n`;
          csvContent += `Total Spent,${filteredTotalSpent}\n`;
          csvContent += `Remaining Balance,${filteredRemainingBalance}\n`;
          csvContent += `Daily Average,${Math.round(dailyAvg)}\n\n`;
          
          csvContent += "CATEGORY SPEND BREAKDOWN\n";
          csvContent += "Category,Total Spent,Percentage\n";
          periodCategoryBreakdown.forEach(c => {
            csvContent += `"${c.name}",${c.amount},${c.percentage}%\n`;
          });
          csvContent += "\n";
          
          csvContent += "COST ITEMS LIST\n";
          csvContent += "Date,Item Name,Category,Cost,Quantity,Total Price\n";
          const reportItems = [
            ...purePersonalTransactions.map(t => ({
              date: t.date,
              createdAt: t.createdAt,
              itemName: t.itemName,
              category: t.category,
              cost: t.cost,
              quantity: t.quantity,
              totalPrice: t.cost * t.quantity
            })),
            ...consolidatedGroupEntries
          ].sort((a, b) => {
            const dateA = parseLocalDate(a.date);
            const dateB = parseLocalDate(b.date);
            if (dateB - dateA !== 0) return dateB - dateA;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });

          reportItems.forEach(t => {
            const formattedDate = parseLocalDate(t.date).toLocaleDateString();
            csvContent += `"${formattedDate}","${(t.itemName || '').replace(/"/g, '""')}","${t.category}",${t.cost},${t.quantity},${t.totalPrice}\n`;
          });

          const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", `${user.username.replace(/\s+/g, '_')}_Personal_Expense_Report.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };

        const handleDownloadPDF = async () => {
          try {
            const response = await axios.get(`${API_BASE}/transactions/report/pdf?groupId=personal`, {
              ...getHeaders(),
              responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `${user.username.replace(/\s+/g, '_')}_Personal_Expense_Report.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } catch (err) {
            console.error("Error downloading personal PDF:", err);
            alert("Failed to download PDF report. Please try again.");
          }
        };

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 15, 29, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9990,
            padding: '20px'
          }} className="animate-fade-in">
            <div className="glass-card animate-scale-in" style={{
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg, #1e293b)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    Personal Analytics
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Personal spending and consumption insights
                  </span>
                </div>
                <button
                  onClick={() => setShowPersonalAnalytics(false)}
                  style={{
                    background: 'var(--secondary-btn-bg)',
                    border: 'none',
                    color: 'var(--text-primary)',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Personal Budget Settings Form */}
              <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Set Personal Monthly Budget
                </h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUpdatePersonalBudget(personalBudgetInput);
                  }}
                  style={{ display: 'flex', gap: '8px' }}
                >
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="Enter personal monthly budget"
                    style={{ flex: 1, padding: '8px 10px', fontSize: '13px' }}
                    value={personalBudgetInput}
                    onChange={(e) => setPersonalBudgetInput(e.target.value)}
                    required
                  />
                  <button type="submit" className="gradient-btn" style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '10px' }} disabled={loading}>
                    Update
                  </button>
                </form>
              </div>

              {/* Filter Period & Export Controls */}
              <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Filter Period & Export
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Month</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: '12.5px', height: '34px', margin: 0 }}
                      value={analyticsSelectedMonth}
                      onChange={e => setAnalyticsSelectedMonth(Number(e.target.value))}
                    >
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
                        <option key={idx} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Year</label>
                    <select
                      className="form-input"
                      style={{ padding: '6px 8px', fontSize: '12.5px', height: '34px', margin: 0 }}
                      value={analyticsSelectedYear}
                      onChange={e => setAnalyticsSelectedYear(Number(e.target.value))}
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(yr => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                    onClick={handleDownloadPDF}
                    className="secondary-btn"
                    style={{ justifyContent: 'center', padding: '10px', fontSize: '13px', borderRadius: 'var(--radius-sm)', gap: '6px', border: '1px solid var(--primary-border)', background: 'var(--primary-light)', color: 'var(--primary-color)' }}
                  >
                    📄 PDF Report
                  </button>
                  <button 
                    onClick={handleDownloadSheet}
                    className="secondary-btn"
                    style={{ justifyContent: 'center', padding: '10px', fontSize: '13px', borderRadius: 'var(--radius-sm)', gap: '6px', border: '1px solid rgba(16, 185, 129, 0.25)', background: 'rgba(16, 185, 129, 0.08)' }}
                  >
                    📊 Sheet (CSV)
                  </button>
                </div>
              </div>

              {/* Stats Breakdown Widgets */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="glass-card" style={{ margin: 0, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remaining Balance</span>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: filteredRemainingBalance >= 0 ? 'var(--success-color)' : '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${filteredRemainingBalance.toLocaleString()}`}>
                    ৳{filteredRemainingBalance.toLocaleString()}
                  </span>
                </div>
                <div className="glass-card" style={{ margin: 0, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Daily Avg (Filter Range)</span>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${Math.round(dailyAvg).toLocaleString()}`}>
                    ৳{Math.round(dailyAvg).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Burn Projection Widget */}
              <div style={{ background: 'var(--primary-light)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary-border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-color)' }}>
                  Burn rate projection
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                  {selectedPeriodBudget > 0 ? (
                    filteredRemainingBalance <= 0 ? (
                      <span style={{ color: '#f87171', fontWeight: 600 }}>⚠️ Budget exceeded! You have spent more than your allocated budget.</span>
                    ) : (
                      <>
                        Based on your current monthly burn rate, your remaining budget is estimated to last: <strong>{remainingDays} days</strong>.
                      </>
                    )
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Set a personal budget above to enable remaining days projection.</span>
                  )}
                </span>
              </div>

              {/* Category Breakdown Section */}
              <div style={{ background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Category Spend Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {periodCategoryBreakdown.length === 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', display: 'block', padding: '10px 0' }}>No spending data for this period.</span>
                  ) : (
                    periodCategoryBreakdown.map(cat => (
                      <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-subtle-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cat.name}>
                            {cat.name}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>({cat.percentage}%)</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '120px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: '800', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`৳${cat.amount.toLocaleString()}`}>
                            ৳{cat.amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Historical Consumption Graph */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  7-Day Spending Trend (Personal)
                </h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '140px', padding: '10px 0', borderBottom: '1px solid var(--card-border)', marginBottom: '10px' }}>
                  {trend.map((day, idx) => {
                    const pct = (day.amount / maxTrendAmount) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          {day.amount > 0 ? `৳${Math.round(day.amount)}` : ''}
                        </span>
                        <div style={{
                          width: '18px',
                          height: `${Math.max(pct, 4)}px`,
                          background: day.amount > 0 ? 'var(--primary-color)' : 'var(--chart-empty-bar)',
                          borderRadius: '3px',
                          transition: 'height 0.2s ease'
                        }} />
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--card-border)', paddingTop: '12px' }}>
                <button
                  className="secondary-btn"
                  style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                  onClick={() => setShowPersonalAnalytics(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Custom Flat Confirm Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 15, 29, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} className="animate-fade-in">
          <div className="glass-card animate-scale-in" style={{
            maxWidth: '400px',
            width: '100%',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--card-border)',
            backgroundColor: 'var(--card-bg, #1e293b)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                background: 'var(--danger-bg)',
                color: 'var(--danger-color)',
                padding: '12px',
                borderRadius: '50%',
                display: 'inline-flex'
              }}>
                <Trash2 size={24} />
              </div>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Confirm Action</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
              {confirmModal.message}
            </p>
            {confirmModal.requiresPassword && (
              <div style={{ position: 'relative', width: '100%', marginTop: '8px' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }}
                  placeholder="Enter your account password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                className="secondary-btn"
                style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => {
                  setConfirmPassword('');
                  setConfirmModal(null);
                }}
              >
                Cancel
              </button>
              <button
                className="gradient-btn"
                style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: '600', background: 'var(--danger-color, #ef4444)', border: 'none', cursor: 'pointer' }}
                onClick={() => {
                  if (confirmModal.requiresPassword && !confirmPassword) {
                    showAlert('Please enter your password to confirm.', 'error');
                    return;
                  }
                  confirmModal.onConfirm(confirmPassword);
                  setConfirmPassword('');
                  setConfirmModal(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* User Details & Set Password Popup Modal */}
      {passwordResetUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 15, 29, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} className="animate-fade-in">
          <div className="glass-card animate-scale-in" style={{
            maxWidth: '420px',
            width: '100%',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--card-border)',
            backgroundColor: 'var(--card-bg, #1e293b)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} style={{ color: 'var(--primary-color)' }} /> User details & settings
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setPasswordResetUser(null);
                  setNewPasswordForUser('');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', fontWeight: '600' }}
              >
                &times;
              </button>
            </div>

            {/* User Profile Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--surface-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
              {renderAvatar(passwordResetUser.profilePic, 48)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {passwordResetUser.username}
                </span>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {passwordResetUser.email}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Registered: {new Date(passwordResetUser.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Set Password Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                Set New Password
              </h4>
              <div style={{ position: 'relative', width: '100%' }}>
                <Lock size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }}
                  placeholder="Enter new password (min 6 chars)"
                  value={newPasswordForUser}
                  onChange={(e) => setNewPasswordForUser(e.target.value)}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px', marginTop: '4px' }}>
              <button
                className="secondary-btn"
                style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                onClick={() => {
                  setPasswordResetUser(null);
                  setNewPasswordForUser('');
                }}
              >
                Close
              </button>
              <button
                className="gradient-btn"
                style={{ flex: 1, padding: '10px 16px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                onClick={() => handleSetUserPassword(passwordResetUser.id, passwordResetUser.username)}
                disabled={passwordSubmitLoading}
              >
                {passwordSubmitLoading ? 'Saving...' : 'Save Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Scope Selection Modal */}
      {showScopeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 15, 29, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          className="animate-fade-in"
          onClick={() => setShowScopeModal(false)}
        >
          <div
            className="glass-card animate-scale-in"
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '20px',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 0,
              boxShadow: 'var(--shadow-xl)',
              border: '1.5px solid var(--card-border)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} style={{ color: 'var(--primary-color)' }} /> Select Scope
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  Choose personal costing or switch to a shared group.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScopeModal(false)}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-secondary)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scope Options List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '2px', maxHeight: '380px' }}>
              {availableScopes.map((scope) => {
                const isSelected = filterGroup === scope.id;
                return (
                  <div
                    key={scope.id}
                    onClick={() => {
                      handleFilterGroupChange(scope.id);
                      if (typeof navigator !== 'undefined' && navigator.vibrate) {
                        try { navigator.vibrate(35); } catch {}
                      }
                      setShowScopeModal(false);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected 
                        ? (theme === 'light' ? '#e0edff' : 'rgba(37, 99, 235, 0.16)')
                        : 'var(--surface-subtle)',
                      border: isSelected 
                        ? '1.5px solid var(--primary-color)' 
                        : '1px solid var(--card-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {scope.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {scope.subtitle}
                      </div>
                    </div>

                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        minWidth: '20px',
                        minHeight: '20px',
                        maxWidth: '20px',
                        maxHeight: '20px',
                        aspectRatio: '1 / 1',
                        boxSizing: 'border-box',
                        borderRadius: '50%',
                        border: isSelected ? 'none' : '2px solid var(--card-border)',
                        background: isSelected ? 'var(--primary-color)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} style={{ display: 'block', flexShrink: 0 }} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Swipe Hint */}
            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--card-border)', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span>⇄</span>
              <span>Tip: You can also swipe left or right on the Scope bar to switch quickly!</span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTransactionDetails && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 15, 29, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          className="animate-fade-in"
          onClick={() => setSelectedTransactionDetails(null)}
        >
          <div
            className="glass-card animate-scale-in"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '22px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              border: '1.5px solid var(--card-border)',
              backgroundColor: 'var(--card-bg, #1e293b)',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              marginBottom: 0
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <ClipboardList size={19} style={{ color: 'var(--primary-color)' }} /> Expense Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTransactionDetails(null)}
                style={{
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-secondary)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Total Spent Hero */}
            <div style={{
              background: 'var(--surface-subtle)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Cost
                </span>
                <span style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary-color)' }}>
                  ৳{(selectedTransactionDetails.cost * selectedTransactionDetails.quantity).toLocaleString()}
                </span>
              </div>

              {selectedTransactionDetails.quantity > 1 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                  <span>Unit Price: ৳{selectedTransactionDetails.cost.toLocaleString()}</span>
                  <span>•</span>
                  <span>Quantity: {selectedTransactionDetails.quantity}</span>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '10px', marginTop: '2px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  Item Description
                </div>
                <div style={{ fontSize: '15.5px', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: '1.4' }}>
                  {selectedTransactionDetails.itemName}
                </div>
              </div>
            </div>

            {/* Info Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Category */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Tag size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Category</span>
                </div>
                {(() => {
                  const cat = categories.find(c => c.name === selectedTransactionDetails.category);
                  const color = cat?.color || 'var(--primary-color)';
                  return (
                    <span className="badge" style={{ backgroundColor: `${color}20`, color: color, fontWeight: '700', fontSize: '12px' }}>
                      {selectedTransactionDetails.category}
                    </span>
                  );
                })()}
              </div>

              {/* Date */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Calendar size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Date</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {parseLocalDate(selectedTransactionDetails.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* Scope / Group */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Users size={16} style={{ color: 'var(--primary-color)' }} />
                  <span>Scope</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {selectedTransactionDetails.group ? (
                    <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', border: '1px solid var(--primary-border)' }}>
                      👥 {selectedTransactionDetails.group.name || selectedTransactionDetails.group}
                    </span>
                  ) : (
                    '👤 Personal Expense'
                  )}
                </span>
              </div>

              {/* Added By / Payer */}
              {selectedTransactionDetails.user && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <User size={16} style={{ color: 'var(--primary-color)' }} />
                    <span>Added By</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    {selectedTransactionDetails.user._id === user?.id || selectedTransactionDetails.user === user?.id 
                      ? 'You (Me)' 
                      : (selectedTransactionDetails.user.username || 'Member')}
                  </span>
                </div>
              )}

              {/* Original Item Name if shared */}
              {selectedTransactionDetails.isSharedGroupCost && selectedTransactionDetails.originalItemName && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Original Group Expense Item
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                    {selectedTransactionDetails.originalItemName}
                  </div>
                </div>
              )}

              {/* Sync Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <CheckCircle size={16} style={{ color: selectedTransactionDetails.isPending ? '#fcd34d' : 'var(--success-color, #10b981)' }} />
                  <span>Sync Status</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: '600', color: selectedTransactionDetails.isPending ? '#fcd34d' : 'var(--success-color, #10b981)' }}>
                  {selectedTransactionDetails.isPending ? '⏳ Offline (Pending Sync)' : '✓ Synced with Cloud'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px', marginTop: '4px' }}>
              {(selectedTransactionDetails.isPending || 
                selectedTransactionDetails.user?._id === user?.id || 
                selectedTransactionDetails.user === user?.id || 
                (selectedTransactionDetails.group && (
                  selectedTransactionDetails.group.owner?._id === user?.id || 
                  selectedTransactionDetails.group.owner === user?.id || 
                  (typeof selectedTransactionDetails.group.owner === 'string' && selectedTransactionDetails.group.owner === user?.id)
                ))
              ) && (
                <button
                  type="button"
                  className="secondary-btn"
                  style={{ 
                    flex: 1, 
                    padding: '11px 16px', 
                    borderRadius: 'var(--radius-sm)', 
                    fontSize: '13.5px', 
                    fontWeight: '600', 
                    cursor: 'pointer', 
                    color: 'var(--danger-color)', 
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onClick={() => {
                    const idToDelete = selectedTransactionDetails._id;
                    setSelectedTransactionDetails(null);
                    handleDeleteTransaction(idToDelete);
                  }}
                >
                  <Trash2 size={16} /> Delete Expense
                </button>
              )}
              <button
                type="button"
                className="gradient-btn"
                style={{ flex: 1, padding: '11px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13.5px', fontWeight: '600', border: 'none', cursor: 'pointer' }}
                onClick={() => setSelectedTransactionDetails(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
