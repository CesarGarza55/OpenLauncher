import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import {
  INSTALL_TARGETS,
  formatClock,
  getVersionById,
  loadLauncherCatalog,
  resolveMinecraftVersion,
  formatVersionLabel,
} from './lib/minecraftLauncher';
import { loadMinecraftNews } from './lib/minecraftNews';
import {
  searchModrinthProjects,
} from './lib/modrinth';
import { useI18n } from './context/I18nContext';
import logoIcon from '/icon.webp';
import { launcher } from './services/launcherClient';
import { ICONS } from './constants/icons';
import {
  Icon,
  MicrosoftLogo,
  EmptyState,
  LogLine,
  Toast,
} from './components/common/CommonComponents';
import {
  ModCard,
  ModrinthCard,
  NewsCard,
  ProfileCardActions,
} from './components/cards/Cards';
import { ModConflictModal } from './components/modals/ModConflictModal';
import { ModDetailModal } from './components/modals/ModDetailModal';
import {
  ProfileModal,
  InstallModal,
  SettingsModal,
  AboutModal,
  LoginLoadingModal,
} from './components/modals/LauncherModals';
import {
  createOfflineSession,
  getMcHeadsAvatarUrl,
  findModInList,
  formatFileSize,
  formatRelativeTime,
  truncateText,
} from './utils/formatters';

const APP_SOURCE_URL = 'https://github.com/CesarGarza55/OpenLauncher';
const APP_RELEASES_URL = 'https://github.com/CesarGarza55/OpenLauncher/releases/latest';

const minecraftLoginWithAbort = async (profileKey, abortSignal) => {
  if (typeof window !== 'undefined' && window.launcher?.minecraftLogin) {
    return await window.launcher.minecraftLogin(profileKey, abortSignal);
  }
  return await launcher.minecraftLogin(profileKey);
};

export default function App() {
  const { language, setLanguage, t } = useI18n();
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const [stateHydrated, setStateHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState('news');
  const [exploreType, setExploreType] = useState('mods'); // 'mods' | 'shaders' | 'resourcepacks'
  const [modSearch, setModSearch] = useState('');
  const [shaderSearch, setShaderSearch] = useState('');
  const [resourcePackSearch, setResourcePackSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState('all');
  const [versionCatalog, setVersionCatalog] = useState([]);
  const [installedVersions, setInstalledVersions] = useState([]);
  const [installTargets, setInstallTargets] = useState(INSTALL_TARGETS);
  const [mods, setMods] = useState([]);
  const [shaders, setShaders] = useState([]);
  const [resourcePacks, setResourcePacks] = useState([]);
  const [modrinthQueries, setModrinthQueries] = useState({ mods: '', shaders: '', resourcepacks: '' });
  const [modrinthCategories, setModrinthCategories] = useState({ mods: 'all', shaders: 'all', resourcepacks: 'all' });

  const modrinthQuery = modrinthQueries[exploreType] || '';
  const modrinthCategory = modrinthCategories[exploreType] || 'all';

  const setModrinthQuery = (val) => {
    setModrinthQueries(prev => ({
      ...prev,
      [exploreType]: typeof val === 'function' ? val(prev[exploreType] || '') : val,
    }));
  };

  const setModrinthCategory = (val) => {
    setModrinthCategories(prev => ({
      ...prev,
      [exploreType]: typeof val === 'function' ? val(prev[exploreType] || 'all') : val,
    }));
  };

  const [modrinthSort, setModrinthSort] = useState('relevance');
  const [modrinthLoaderFilter, setModrinthLoaderFilter] = useState('auto');
  const [modrinthVersionFilter, setModrinthVersionFilter] = useState('auto');
  const [modrinthResults, setModrinthResults] = useState([]);
  const [modrinthTotalHits, setModrinthTotalHits] = useState(0);
  const [modrinthLoading, setModrinthLoading] = useState(false);
  const [modrinthLoadingMore, setModrinthLoadingMore] = useState(false);
  const [modrinthInstalling, setModrinthInstalling] = useState({});
  const [selectedModDetail, setSelectedModDetail] = useState(null); // null | { project, initialTab: 'overview' | 'versions' }
  const [installingVersionId, setInstallingVersionId] = useState(null);
  const [modUpdates, setModUpdates] = useState({});
  const [checkingModUpdates, setCheckingModUpdates] = useState(false);
  const [updatingMods, setUpdatingMods] = useState(new Set());
  const [modConflict, setModConflict] = useState(null);
  const [logs, setLogs] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [newsSourceUrl, setNewsSourceUrl] = useState('https://www.minecraft.net/en-us/articles');
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');
  const [gameState, setGameState] = useState('idle'); // idle | loading | running
  const [progress, setProgress] = useState(0);
  const [runPid, setRunPid] = useState(null);
  const [installId, setInstallId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [updateState, setUpdateState] = useState({ phase: 'idle', progress: 0, message: '' });
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null); // null | 'newProfile' | 'install-minecraft' | 'install-fabric' | 'install-forge' | 'settings' | 'about'
  const [profileEditor, setProfileEditor] = useState(null); // null | { mode: 'new' | 'edit', profileId: number | null }
  const [account, setAccount] = useState({ name: '', loggedIn: false, profileKey: 'default', kind: 'none', session: null });
  const [authRefreshing, setAuthRefreshing] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showBetaInfo, setShowBetaInfo] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [systemTotalRam, setSystemTotalRam] = useState(
    typeof launcher?.systemTotalRamGb === 'number' && launcher.systemTotalRamGb > 0
      ? launcher.systemTotalRamGb
      : null
  );
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [settings, setSettings] = useState({
    keepOpen: false, launchBehavior: 'hide', showConsole: true, autoUpdate: true, showSnapshots: false, javaPath: '', minecraftRoot: '', language,
  });
  const consoleRef = useRef(null);
  const modrinthSentinelRef = useRef(null);
  const betaInfoRef = useRef(null);
  const gameTimerRef = useRef(null);
  const toastTimersRef = useRef(new Map());
  const loginAbortControllerRef = useRef(null);

  useEffect(() => {
    if (!showBetaInfo) return;
    const handleClickOutside = (e) => {
      if (betaInfoRef.current && !betaInfoRef.current.contains(e.target)) {
        setShowBetaInfo(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowBetaInfo(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showBetaInfo]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || null;
  const activeProfileVersion = activeProfile?.version
    ? installedVersions.find(v => v.id === activeProfile.version) || getVersionById(activeProfile.version, versionCatalog)
    : null;
  const activeVersion = activeProfileVersion || installedVersions[0] || versionCatalog[0] || null;
  const selectedInstalledVersionId = activeProfile?.version || (installedVersions[0] ? installedVersions[0].id : '');

  const stateRef = useRef({ profiles, activeProfileId, mods, logs, settings, versionCatalog, installTargets });
  useEffect(() => {
    stateRef.current = { profiles, activeProfileId, mods, logs, settings, versionCatalog, installTargets };
  }, [profiles, activeProfileId, mods, logs, settings, versionCatalog, installTargets]);

  const logBufferRef = useRef([]);
  const logFlushTimeoutRef = useRef(null);

  const flushLogs = useCallback(() => {
    if (logFlushTimeoutRef.current) {
      clearTimeout(logFlushTimeoutRef.current);
      logFlushTimeoutRef.current = null;
    }
    if (logBufferRef.current.length === 0) return;
    const itemsToAdd = logBufferRef.current;
    logBufferRef.current = [];
    setLogs(prev => {
      const next = [...prev, ...itemsToAdd];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }, []);

  const addLog = useCallback((level, msg) => {
    logBufferRef.current.push({ level, msg, time: formatClock() });
    if (!logFlushTimeoutRef.current) {
      logFlushTimeoutRef.current = setTimeout(() => {
        flushLogs();
      }, 60);
    }
  }, [flushLogs]);

  const dismissToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const pushToast = useCallback(({ tone = 'info', title = '', message = '', duration = 4000 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, tone, title, message }]);
    if (duration > 0) {
      const timer = setTimeout(() => {
        dismissToast(id);
      }, duration);
      toastTimersRef.current.set(id, timer);
    }
    return id;
  }, [dismissToast]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      pushToast({
        tone: 'warning',
        title: t('offline.badge'),
        message: t('offline.noConnectionToast'),
      });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [t, pushToast]);

  // Listen for the native macOS "About" menu item which sends this event
  // from the main process via mainWindow.webContents.send('app:show-about').
  useEffect(() => {
    if (typeof launcher?.on !== 'function') return;
    const unsub = launcher.on('app:show-about', () => setModal('about'));
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError('');
    try {
      let payload = null;
      if (typeof launcher?.minecraftGetNews === 'function') {
        payload = await launcher.minecraftGetNews({ limit: 24 });
      }
      if (!payload || !payload.items || payload.items.length === 0) {
        payload = await loadMinecraftNews({ limit: 24 });
      }

      if (!payload) {
        setNewsError(t('news.errorNoNewsFound'));
        return;
      }
      if (payload.error && (!payload.items || payload.items.length === 0)) {
        setNewsError(payload.error);
        return;
      }
      if (Array.isArray(payload)) {
        setNewsItems(payload);
        return;
      }
      const items = Array.isArray(payload.items) ? payload.items : [];
      setNewsItems(items);
      if (payload.sourceUrl) {
        setNewsSourceUrl(payload.sourceUrl);
      }
    } catch (error) {
      try {
        const fallbackPayload = await loadMinecraftNews({ limit: 16 });
        if (fallbackPayload?.items?.length > 0) {
          setNewsItems(fallbackPayload.items);
          return;
        }
      } catch { }
      setNewsError(error?.message || t('news.errorNoNewsFound'));
    } finally {
      setNewsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const persistState = useCallback((updates = {}) => {
    const currentState = stateRef.current;
    const nextState = {
      profiles: updates.profiles !== undefined ? updates.profiles : currentState.profiles,
      activeProfileId: updates.activeProfileId !== undefined ? updates.activeProfileId : currentState.activeProfileId,
      mods: updates.mods !== undefined ? updates.mods : currentState.mods,
      logs: updates.logs !== undefined ? updates.logs : currentState.logs,
      versions: updates.versions !== undefined ? updates.versions : currentState.versionCatalog,
      installTargets: updates.installTargets !== undefined ? updates.installTargets : currentState.installTargets,
      settings: updates.settings !== undefined ? updates.settings : currentState.settings,
    };
    stateRef.current = { ...currentState, ...nextState, versionCatalog: nextState.versions, logs: nextState.logs };
    launcher.minecraftSaveState?.(nextState);
  }, []);

  // Event listeners for installation and launcher lifecycle + state hydration
  useEffect(() => {
    const installProgressOff = launcher.on?.('minecraft:install-progress', (p) => {
      if (typeof p?.percent === 'number' && Number.isFinite(p.percent)) setProgress(p.percent);
      if (p?.message) addLog('info', p.message);
      if (p?.installId) setInstallId(p.installId);
    });

    const installFileOff = launcher.on?.('minecraft:install-file-progress', (f) => {
      if (typeof f?.percent === 'number' && Number.isFinite(f.percent)) {
        setProgress(f.percent);
      }
    });

    const installCompleteOff = launcher.on?.('minecraft:install-complete', (r) => {
      addLog('success', `Installation completed: ${r?.version || r?.label || 'version'}`);
      setProgress(100);
      setInstallId(null);
      launcher.minecraftGetInstalledVersions?.().then((versions) => {
        if (Array.isArray(versions)) {
          setInstalledVersions(versions);
          const currentProfiles = stateRef.current.profiles;
          const curActiveId = stateRef.current.activeProfileId;
          const curActiveProfile = currentProfiles.find(p => p.id === curActiveId);
          if (versions.length > 0 && !curActiveProfile?.version) {
            const nextProfiles = currentProfiles.map(p => p.id === curActiveId ? { ...p, version: versions[0].id } : p);
            setProfiles(nextProfiles);
            persistState({ profiles: nextProfiles });
          }
        }
      });
    });

    const installErrorOff = launcher.on?.('minecraft:install-error', (e) => {
      addLog('error', `Installation error: ${e?.message || e}`);
      setInstallId(null);
    });

    const installCancelledOff = launcher.on?.('minecraft:install-cancelled', (e) => {
      addLog('info', `Installation cancelled: ${e?.message || 'user cancelled'}`);
      setInstallId(null);
    });

    const updateStatusOff = launcher.on?.('minecraft:update-status', (u) => {
      if (u?.phase) {
        setUpdateState(prev => ({
          ...prev,
          phase: u.phase,
          message: u.message || '',
          currentVersion: u.currentVersion,
          latestVersion: u.latestVersion,
        }));
      }
    });

    const updateProgressOff = launcher.on?.('minecraft:update-progress', (u) => {
      if (typeof u?.percent === 'number') {
        setUpdateState(prev => ({
          ...prev,
          phase: u.phase || 'downloading',
          progress: u.percent,
          assetName: u.assetName,
        }));
      }
    });

    const updateCompleteOff = launcher.on?.('minecraft:update-complete', () => {
      setUpdateState(prev => ({
        ...prev,
        phase: 'complete',
        message: 'Update ready',
      }));
    });

    const runLogOff = launcher.on?.('minecraft:run-log', (l) => {
      const type = l?.type === 'stderr' || l?.type === 'error' ? 'error' : l?.type === 'warn' ? 'warn' : 'info';
      addLog(type, l?.msg || '');
    });

    const assetProgressOff = launcher.on?.('minecraft:asset-progress', (a) => {
      if (typeof a?.percent === 'number' && Number.isFinite(a.percent)) {
        setProgress(a.percent);
      }
    });

    const runExitOff = launcher.on?.('minecraft:run-exit', (s) => {
      addLog('info', `Game process exited with code ${s?.code}`);
      setGameState('idle');
      setRunPid(null);
    });

    const modConflictOff = launcher.on?.('minecraft:mod-conflict', (conflictData) => {
      setModConflict(conflictData);
    });

    const openAboutOff = launcher.on?.('app:open-about', () => {
      setModal('about');
    });

    const initializeLauncher = async () => {
      try {
        const state = await launcher.minecraftGetState();
        if (state?.profiles && Array.isArray(state.profiles) && state.profiles.length > 0) {
          setProfiles(state.profiles);
          const activeId = state.activeProfileId && state.profiles.some(p => p.id === state.activeProfileId)
            ? state.activeProfileId
            : state.profiles[0].id;
          setActiveProfileId(activeId);
        } else {
          const defaultProfile = {
            id: 'default',
            name: 'Default',
            localName: 'Player',
            version: null,
            ram: 4,
            jvmArguments: '',
            javaPath: '',
          };
          setProfiles([defaultProfile]);
          setActiveProfileId('default');
        }

        if (state?.settings) {
          setSettings(prev => ({
            ...prev,
            ...state.settings,
            language: state.settings.language || language,
          }));
        }

        if (state?.mods && Array.isArray(state.mods)) {
          setMods(state.mods);
        }

        if (state?.logs && Array.isArray(state.logs)) {
          setLogs(state.logs);
        }

        const rootRes = await launcher.minecraftGetRoot?.();
        if (rootRes?.root) {
          setSettings(prev => ({ ...prev, minecraftRoot: rootRes.root }));
        }

        const instVers = await launcher.minecraftGetInstalledVersions?.();
        if (Array.isArray(instVers)) {
          setInstalledVersions(instVers);
        }

        const instMods = await launcher.minecraftGetInstalledMods?.();
        if (Array.isArray(instMods)) {
          setMods(instMods);
        }

        let snapshot = null;
        if (launcher.minecraftGetCatalog) {
          snapshot = await launcher.minecraftGetCatalog({ includeSnapshots: state?.settings?.showSnapshots === true });
        }
        if (!snapshot || !snapshot.versions || snapshot.versions.length === 0) {
          snapshot = await loadLauncherCatalog({ includeSnapshots: state?.settings?.showSnapshots === true });
        }

        if (snapshot?.versions?.length > 0) {
          setVersionCatalog(snapshot.versions);
        }
        if (snapshot?.installTargets) {
          setInstallTargets(snapshot.installTargets);
        }
      } catch (err) {
        console.error('Failed to initialize launcher state:', err);
      } finally {
        setStateHydrated(true);
      }
    };

    launcher.getAppVersion?.()
      .then(ver => {
        if (ver) setAppVersion(String(ver));
      })
      .catch(() => { });

    launcher.getSystemInfo?.()
      .then(info => {
        if (info?.totalRamGb && info.totalRamGb > 0) {
          setSystemTotalRam(info.totalRamGb);
        }
      })
      .catch(() => { });

    initializeLauncher();
    loadNews();

    return () => {
      installProgressOff?.();
      installFileOff?.();
      installCompleteOff?.();
      installErrorOff?.();
      installCancelledOff?.();
      updateStatusOff?.();
      updateProgressOff?.();
      updateCompleteOff?.();
      runLogOff?.();
      assetProgressOff?.();
      runExitOff?.();
      modConflictOff?.();
      openAboutOff?.();
    };
  }, [addLog, loadNews, language, persistState]);

  const handleOpenNewsSource = () => {
    launcher.openExternal?.(newsSourceUrl).catch(() => { });
  };

  const handleOpenNewsArticle = (url) => {
    launcher.openExternal?.(url).catch(() => { });
  };

  const handleOpenSourceCode = () => {
    launcher.openExternal?.(APP_SOURCE_URL).catch(() => { });
  };

  const handleOpenReleases = () => {
    launcher.openExternal?.(APP_RELEASES_URL).catch(() => { });
  };

  // Account sync with active profile
  useEffect(() => {
    if (!activeProfile) return;
    const profileKey = String(activeProfile.id || 'default');
    let isMounted = true;
    setAuthRefreshing(true);

    launcher.minecraftGetAuthState(profileKey)
      .then(auth => {
        if (!isMounted) return;
        if (auth?.loggedIn && auth.name) {
          setAccount({
            name: auth.name,
            loggedIn: true,
            profileKey,
            kind: 'microsoft',
            session: auth,
          });
          if (activeProfile.skinName !== auth.name || activeProfile.microsoftAccount !== auth.name) {
            setProfiles(prev => {
              const next = prev.map(p => p.id === profileKey ? { ...p, skinName: auth.name, microsoftAccount: auth.name, localName: auth.name } : p);
              persistState({ profiles: next, activeProfileId: profileKey });
              return next;
            });
          }
        } else {
          const fallbackName = String(activeProfile.skinName || activeProfile.localName || activeProfile.name || '').trim();
          if (fallbackName) {
            setAccount({
              name: fallbackName,
              loggedIn: true,
              profileKey,
              kind: 'local',
              session: createOfflineSession(fallbackName),
            });
          } else {
            setAccount({ name: '', loggedIn: false, profileKey, kind: 'none', session: null });
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        const fallbackName = String(activeProfile.skinName || activeProfile.localName || activeProfile.name || '').trim();
        setAccount({
          name: fallbackName,
          loggedIn: Boolean(fallbackName),
          profileKey,
          kind: fallbackName ? 'local' : 'none',
          session: fallbackName ? createOfflineSession(fallbackName) : null,
        });
      })
      .finally(() => {
        if (isMounted) setAuthRefreshing(false);
      });

    return () => { isMounted = false; };
  }, [activeProfile?.id, activeProfile?.localName, activeProfile?.name, activeProfile?.skinName, activeProfile?.microsoftAccount]);

  const handleSaveProfile = (profileData) => {
    setProfiles(prev => {
      let next;
      const targetId = profileData.id || `profile-${Date.now()}`;
      if (profileData.id) {
        next = prev.map(p => p.id === profileData.id ? { ...p, ...profileData } : p);
      } else {
        const newProfile = { ...profileData, id: targetId };
        next = [...prev, newProfile];
        setActiveProfileId(targetId);
      }
      persistState({
        profiles: next,
        activeProfileId: profileData.id ? activeProfileId : targetId,
      });
      return next;
    });
  };

  const handleDeleteProfile = (profileId) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== profileId);
      let nextActiveId = activeProfileId;
      if (next.length === 0) {
        const defaultProfile = {
          id: 'default',
          name: 'Default',
          localName: 'Player',
          version: null,
          ram: 4,
          jvmArguments: '',
          javaPath: '',
        };
        next.push(defaultProfile);
        nextActiveId = 'default';
      } else if (activeProfileId === profileId) {
        nextActiveId = next[0].id;
      }
      if (nextActiveId !== activeProfileId) {
        setActiveProfileId(nextActiveId);
      }
      persistState({
        profiles: next,
        activeProfileId: nextActiveId,
      });
      return next;
    });
  };

  const handleDuplicateProfile = (profileId, e) => {
    e?.stopPropagation();
    const sourceProfile = profiles.find(p => p.id === profileId);
    if (!sourceProfile) return;
    const newId = `profile-${Date.now()}`;
    const duplicatedProfile = {
      ...sourceProfile,
      id: newId,
      name: `${sourceProfile.name} (Copy)`,
    };
    setProfiles(prev => {
      const next = [...prev, duplicatedProfile];
      setActiveProfileId(newId);
      persistState({
        profiles: next,
        activeProfileId: newId,
      });
      return next;
    });
  };

  const handleInstall = async (type, opts) => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: t('install.minecraft') || 'Install',
        message: t('offline.installRequiresInternet'),
      });
      return;
    }
    setLogs([]);
    persistState({ logs: [] });
    const installPayload = typeof opts === 'string' ? { version: opts } : (opts || {});
    addLog('info', `Starting ${type} installation...`);
    setActiveTab('console');
    setProgress(0);
    try {
      const res = await launcher.minecraftInstall({ type, ...installPayload });
      if (res?.error) {
        addLog('error', `Installation failed: ${res.message || res.error}`);
      }
    } catch (e) {
      addLog('error', `Install launch failed: ${e?.message || e}`);
    } finally {
      setInstallId(null);
    }
  };

  const handleCancelInstall = async () => {
    if (!installId) return;
    try {
      await launcher.minecraftInstallCancel({ installId });
    } catch (e) {
      addLog('error', `Failed to cancel install: ${e?.message || e}`);
    } finally {
      setInstallId(null);
    }
  };

  const handlePlay = async () => {
    if (gameState === 'running') {
      if (runPid) {
        try {
          await launcher.minecraftStop({ pid: runPid });
          setGameState('idle');
          setRunPid(null);
        } catch (e) {
          addLog('error', `Failed to stop game: ${e?.message || e}`);
        }
      }
      return;
    }

    if (!activeProfile) return;
    setLogs([]);
    persistState({ logs: [] });
    setGameState('loading');
    setProgress(0);
    if (settings.showConsole !== false) {
      setActiveTab('console');
    }
    addLog('info', `Launching profile: ${activeProfile.name}`);

    try {
      const runOpts = {
        profile: activeProfile,
        version: activeVersion || activeProfile?.version,
        session: account.session || createOfflineSession(activeProfile.localName || 'Player'),
      };
      const res = await launcher.minecraftRun(runOpts);
      if (res?.error) {
        addLog('error', `Launch failed: ${res.message || res.error}`);
        setGameState('idle');
        return;
      }
      if (res?.pid) {
        setRunPid(res.pid);
        setGameState('running');
        addLog('success', `Minecraft process started (PID: ${res.pid})`);
      }
    } catch (e) {
      addLog('error', `Launch exception: ${e?.message || e}`);
      setGameState('idle');
    }
  };

  const handleSettingChange = (key, val) => {
    setSettings(prev => {
      const next = { ...prev, [key]: val };
      persistState({
        profiles,
        mods,
        logs,
        versions: versionCatalog,
        installTargets,
        settings: next,
      });
      if (key === 'showSnapshots') {
        const refreshCatalog = async () => {
          let catalog = null;
          if (launcher.minecraftGetCatalog) {
            catalog = await launcher.minecraftGetCatalog({ includeSnapshots: Boolean(val), showSnapshots: Boolean(val) });
          } else {
            catalog = await loadLauncherCatalog({ includeSnapshots: Boolean(val) });
          }
          if (catalog?.versions) setVersionCatalog(catalog.versions);
          if (catalog?.installTargets) setInstallTargets(catalog.installTargets);
        };
        refreshCatalog().catch((err) => console.error('Failed to refresh catalog on setting change:', err));
      }
      return next;
    });
  };

  const handleLogin = async () => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: t('account.loginWithMicrosoft'),
        message: t('offline.loginRequiresInternet'),
      });
      return;
    }
    const profileKey = String(activeProfile?.id || 'default');
    setLoginLoading(true);
    addLog('info', t('account.loginWithMicrosoft') + '...');
    const abortController = new AbortController();
    loginAbortControllerRef.current = abortController;

    try {
      const accountInfo = await minecraftLoginWithAbort(profileKey, abortController.signal);
      if (accountInfo?.error) {
        if (accountInfo.cancelled) {
          addLog('info', t('account.loginCancelled'));
        } else {
          addLog('error', `Login failed: ${accountInfo.error}`);
          pushToast({
            tone: 'error',
            title: t('account.loginWithMicrosoft'),
            message: accountInfo.error,
          });
        }
        return;
      }

      if (accountInfo?.name) {
        setAccount({
          name: accountInfo.name,
          loggedIn: true,
          profileKey,
          kind: 'microsoft',
          session: accountInfo,
        });
        setProfiles(prev => {
          const next = prev.map(p => {
            if (p.id === profileKey) {
              return {
                ...p,
                skinName: accountInfo.name,
                microsoftAccount: accountInfo.name,
                localName: accountInfo.name,
              };
            }
            return p;
          });
          persistState({ profiles: next, activeProfileId: profileKey });
          return next;
        });
        addLog('success', `Logged in as ${accountInfo.name}`);
        pushToast({
          tone: 'success',
          title: t('account.loginWithMicrosoft'),
          message: t('messages.loginSuccess', { name: accountInfo.name }),
        });
      } else {
        addLog('error', 'Login did not return account information.');
      }
    } catch (error) {
      if (error?.name === 'AbortError' || error?.message?.includes('cancelled')) {
        addLog('info', t('account.loginCancelled'));
      } else {
        addLog('error', `Login failed: ${error?.message || error}`);
        pushToast({
          tone: 'error',
          title: t('account.loginWithMicrosoft'),
          message: error?.message || t('messages.loginFailed', { error: '' }),
        });
      }
    } finally {
      setLoginLoading(false);
      loginAbortControllerRef.current = null;
    }
  };

  const handleLogout = async () => {
    const profileKey = String(activeProfile?.id || 'default');
    try {
      await launcher.minecraftLogout(profileKey);
      const fallbackName = (activeProfile?.name && activeProfile?.name !== 'Default') ? activeProfile.name : 'Player';
      setProfiles(prev => {
        const next = prev.map(p => {
          if (p.id === profileKey) {
            return {
              ...p,
              microsoftAccount: '',
              skinName: '',
              localName: fallbackName,
            };
          }
          return p;
        });
        persistState({ profiles: next, activeProfileId: profileKey });
        return next;
      });
      setAccount({
        name: fallbackName,
        loggedIn: Boolean(fallbackName),
        profileKey,
        kind: fallbackName ? 'local' : 'none',
        session: fallbackName ? createOfflineSession(fallbackName) : null,
      });
      addLog('info', 'Logged out from Microsoft.');
      pushToast({
        tone: 'info',
        title: t('account.logout'),
        message: t('messages.logoutSuccess'),
      });
    } catch (e) {
      addLog('error', `Logout failed: ${e?.message || e}`);
    }
  };

  const handleModToggle = async (modId) => {
    const targetMod = mods.find(m => m.id === modId);
    if (!targetMod) return;
    const nextState = !targetMod.enabled;
    try {
      await launcher.minecraftToggleMod(modId, nextState);
      const updated = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updated)) setMods(updated);
    } catch (e) {
      addLog('error', `Failed to toggle mod: ${e?.message || e}`);
    }
  };

  const handleSetAllModsEnabled = async (enable) => {
    try {
      await launcher.minecraftSetAllModsEnabled(enable);
      const updated = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updated)) setMods(updated);
    } catch (e) {
      addLog('error', `Failed to set all mods enabled: ${e?.message || e}`);
    }
  };

  const handleModDelete = async (modId) => {
    try {
      await launcher.minecraftDeleteMod(modId);
      const updated = await launcher.minecraftGetInstalledMods();
      if (Array.isArray(updated)) setMods(updated);
    } catch (e) {
      addLog('error', `Failed to delete mod: ${e?.message || e}`);
    }
  };

  const handleAddModClick = async () => {
    try {
      const picked = await launcher.minecraftPickModFiles?.();
      const filePaths = Array.isArray(picked) ? picked : (picked?.filePaths || []);
      if (filePaths.length > 0) {
        for (const filePath of filePaths) {
          await launcher.minecraftInstallModFile(filePath);
        }
        const updated = await launcher.minecraftGetInstalledMods();
        if (Array.isArray(updated)) setMods(updated);
        pushToast({ tone: 'success', title: t('sidebar.modManager'), message: t('mods.modsImportedSuccess', { count: filePaths.length }) });
      }
    } catch (e) {
      addLog('error', `Failed to add mod: ${e?.message || e}`);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []).filter(f =>
      f.name.endsWith('.jar') || f.name.endsWith('.olpkg') || f.name.endsWith('.zip')
    );
    if (files.length === 0) return;

    const targetType = activeTab === 'shaders' ? 'shaders' : activeTab === 'resourcepacks' ? 'resourcepacks' : (activeTab === 'explore' ? exploreType : 'mods');

    addLog('info', t('mods.importingCount', { count: files.length }));
    try {
      if (targetType === 'shaders') {
        let imported = 0;
        for (const file of files) {
          if (!file.name.toLowerCase().endsWith('.zip')) continue;
          const filePath = file.path || file.name;
          const res = await launcher.minecraftImportContentFile?.({ type: 'shader', sourcePath: filePath, fileName: file.name });
          if (res?.ok) imported++;
        }
        if (imported > 0) {
          loadShaders();
          pushToast({ tone: 'success', title: t('mods.contentTypeShaders'), message: t('mods.shadersImportedSuccess', { count: imported }) });
        }
      } else if (targetType === 'resourcepacks') {
        let imported = 0;
        for (const file of files) {
          if (!file.name.toLowerCase().endsWith('.zip')) continue;
          const filePath = file.path || file.name;
          const res = await launcher.minecraftImportContentFile?.({ type: 'resourcepack', sourcePath: filePath, fileName: file.name });
          if (res?.ok) imported++;
        }
        if (imported > 0) {
          loadResourcePacks();
          pushToast({ tone: 'success', title: t('mods.contentTypeResourcePacks'), message: t('mods.resourcePacksImportedSuccess', { count: imported }) });
        }
      } else {
        for (const file of files) {
          const filePath = file.path || file.name;
          await launcher.minecraftInstallModFile(filePath);
        }
        loadMods();
        pushToast({ tone: 'success', title: t('sidebar.modManager'), message: t('mods.modsImportedSuccess', { count: files.length }) });
      }
    } catch (err) {
      addLog('error', `Error importing files: ${err?.message || err}`);
    }
  };

  // ── Load installed content ──
  const loadMods = useCallback(async () => {
    try {
      const list = await launcher.minecraftGetInstalledMods?.();
      if (Array.isArray(list)) setMods(list);
    } catch { }
  }, []);

  const loadShaders = useCallback(async () => {
    try {
      const list = await launcher.minecraftGetInstalledShaders?.();
      if (Array.isArray(list)) setShaders(list);
    } catch { }
  }, []);

  const loadResourcePacks = useCallback(async () => {
    try {
      const list = await launcher.minecraftGetInstalledResourcePacks?.();
      if (Array.isArray(list)) setResourcePacks(list);
    } catch { }
  }, []);

  const handleDeleteShader = async (shader) => {
    try {
      const res = await launcher.minecraftDeleteShader?.(shader.fileName);
      if (res?.ok) {
        loadShaders();
        pushToast({ tone: 'success', title: t('mods.deleteShader'), message: `${shader.name || shader.fileName} removed.` });
      }
    } catch (err) {
      pushToast({ tone: 'error', title: t('mods.deleteShader'), message: err?.message || 'Delete failed.' });
    }
  };

  const handleDeleteResourcePack = async (pack) => {
    try {
      const res = await launcher.minecraftDeleteResourcePack?.(pack.fileName);
      if (res?.ok) {
        loadResourcePacks();
        pushToast({ tone: 'success', title: t('mods.deleteResourcePack'), message: `${pack.name || pack.fileName} removed.` });
      }
    } catch (err) {
      pushToast({ tone: 'error', title: t('mods.deleteResourcePack'), message: err?.message || 'Delete failed.' });
    }
  };

  const handleOpenContentFolder = async (type) => {
    try {
      const targetType = type || (activeTab === 'shaders' ? 'shaders' : activeTab === 'resourcepacks' ? 'resourcepacks' : 'mods');
      await launcher.minecraftOpenContentFolder?.(targetType);
    } catch { }
  };

  const handleAddContentClick = async (type) => {
    const targetType = type || (activeTab === 'shaders' ? 'shaders' : activeTab === 'resourcepacks' ? 'resourcepacks' : 'mods');
    if (targetType === 'shaders' || targetType === 'shader') {
      const res = await launcher.minecraftPickContentFiles?.('shader');
      if (res?.filePaths?.length > 0) {
        for (const fp of res.filePaths) {
          await launcher.minecraftImportContentFile?.({ type: 'shader', sourcePath: fp });
        }
        loadShaders();
        pushToast({ tone: 'success', title: t('mods.contentTypeShaders'), message: t('mods.shadersImportedSuccess', { count: res.filePaths.length }) });
      }
    } else if (targetType === 'resourcepacks' || targetType === 'resourcepack') {
      const res = await launcher.minecraftPickContentFiles?.('resourcepack');
      if (res?.filePaths?.length > 0) {
        for (const fp of res.filePaths) {
          await launcher.minecraftImportContentFile?.({ type: 'resourcepack', sourcePath: fp });
        }
        loadResourcePacks();
        pushToast({ tone: 'success', title: t('mods.contentTypeResourcePacks'), message: t('mods.resourcePacksImportedSuccess', { count: res.filePaths.length }) });
      }
    } else {
      handleAddModClick();
    }
  };

  // ── Modrinth Search & Install logic ──
  const profileLoader = String(activeProfileVersion?.type || activeVersion?.type || activeProfile?.version || '').toLowerCase();
  const currentLoader = profileLoader.includes('fabric') ? 'fabric' : profileLoader.includes('neoforge') ? 'neoforge' : profileLoader.includes('forge') ? 'forge' : profileLoader.includes('quilt') ? 'quilt' : '';
  const rawMcVer = activeProfileVersion?.inheritsFrom || activeProfileVersion?.mcVer || activeVersion?.inheritsFrom || activeVersion?.mcVer || activeProfile?.version || activeVersion?.id || '';
  const currentMcVer = resolveMinecraftVersion(rawMcVer);

  const effectiveLoader = modrinthLoaderFilter === 'auto' ? currentLoader : (modrinthLoaderFilter === 'all' ? '' : modrinthLoaderFilter);
  const effectiveMcVer = modrinthVersionFilter === 'auto' ? currentMcVer : '';

  const executeModrinthSearch = useCallback(async (isLoadMore = false) => {
    if (!isOnline) {
      setModrinthLoading(false);
      setModrinthLoadingMore(false);
      return;
    }

    if (isLoadMore) {
      if (modrinthLoading || modrinthLoadingMore) return;
      setModrinthLoadingMore(true);
    } else {
      setModrinthLoading(true);
    }

    const currentOffset = isLoadMore ? modrinthResults.length : 0;
    const projectType = exploreType === 'shaders' ? 'shader' : exploreType === 'resourcepacks' ? 'resourcepack' : 'mod';

    try {
      let data;
      if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthSearch) {
        data = await window.launcher.minecraftModrinthSearch({
          projectType,
          query: modrinthQuery,
          loader: projectType === 'mod' ? effectiveLoader : '',
          gameVersion: effectiveMcVer,
          category: modrinthCategory === 'all' ? '' : modrinthCategory,
          sortBy: modrinthSort,
          offset: currentOffset,
          limit: 24,
        });
      } else {
        data = await searchModrinthProjects({
          projectType,
          query: modrinthQuery,
          loader: projectType === 'mod' ? effectiveLoader : '',
          gameVersion: effectiveMcVer,
          category: modrinthCategory === 'all' ? '' : modrinthCategory,
          sortBy: modrinthSort,
          offset: currentOffset,
          limit: 24,
        });
      }
      if (data?.hits) {
        if (isLoadMore) {
          setModrinthResults(prev => {
            const existingIds = new Set(prev.map(p => p.project_id || p.slug));
            const freshHits = data.hits.filter(h => !existingIds.has(h.project_id || h.slug));
            return [...prev, ...freshHits];
          });
        } else {
          setModrinthResults(data.hits);
        }
        setModrinthTotalHits(data.total_hits || (isLoadMore ? modrinthResults.length + data.hits.length : data.hits.length));
      }
    } catch (e) {
      console.error('Modrinth search failed:', e);
      if (!isLoadMore) {
        pushToast({ tone: 'error', title: 'Modrinth', message: e?.message || 'Failed to search.' });
      }
    } finally {
      if (isLoadMore) {
        setModrinthLoadingMore(false);
      } else {
        setModrinthLoading(false);
      }
    }
  }, [isOnline, exploreType, modrinthQuery, effectiveLoader, effectiveMcVer, modrinthCategory, modrinthSort, modrinthLoading, modrinthLoadingMore, modrinthResults.length, pushToast]);

  useEffect(() => {
    setModrinthResults([]);
    setModrinthTotalHits(0);
  }, [exploreType]);

  useEffect(() => {
    if (activeTab === 'explore') {
      if (!isOnline) return;
      const timer = setTimeout(() => {
        executeModrinthSearch(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, exploreType, isOnline, modrinthQuery, effectiveLoader, effectiveMcVer, modrinthCategory, modrinthSort]);

  const hasMoreModrinth = modrinthResults.length < modrinthTotalHits;

  useEffect(() => {
    if (activeTab !== 'explore') return;
    if (!isOnline || !hasMoreModrinth || modrinthLoading || modrinthLoadingMore) return;

    const sentinel = modrinthSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        executeModrinthSearch(true);
      }
    }, { rootMargin: '250px' });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, isOnline, hasMoreModrinth, modrinthLoading, modrinthLoadingMore, executeModrinthSearch]);

  const handleInstallModrinthMod = async (project) => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: 'Modrinth',
        message: t('offline.noConnectionToast'),
      });
      return;
    }
    const projectId = project.project_id || project.slug;
    const projectType = project.project_type || (exploreType === 'shaders' ? 'shader' : exploreType === 'resourcepacks' ? 'resourcepack' : 'mod');
    setModrinthInstalling(prev => ({ ...prev, [projectId]: true }));
    setLogs([]);
    persistState({ logs: [] });
    setActiveTab('console');
    addLog('info', `Installing ${projectType} '${project.title || projectId}' from Modrinth...`);

    try {
      let res;
      if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthInstall) {
        res = await window.launcher.minecraftModrinthInstall({
          projectId,
          projectType,
          gameVersion: effectiveMcVer || currentMcVer,
          loader: projectType === 'mod' ? (effectiveLoader || currentLoader) : undefined,
        });
      } else {
        res = { ok: true, fileName: `${projectId}.zip` };
      }

      if (res?.ok) {
        if (projectType === 'shader') {
          if (Array.isArray(res.items)) setShaders(res.items);
          else loadShaders();
        } else if (projectType === 'resourcepack') {
          if (Array.isArray(res.items)) setResourcePacks(res.items);
          else loadResourcePacks();
        } else {
          if (Array.isArray(res.mods || res.items)) setMods(res.mods || res.items);
          else loadMods();
        }
        addLog('success', `${projectType === 'shader' ? 'Shader' : projectType === 'resourcepack' ? 'Texture pack' : 'Mod'} '${project.title || projectId}' installed.`);
        pushToast({
          tone: 'success',
          title: t('mods.install'),
          message: t('mods.installedSuccess', { name: project.title || projectId }),
        });
      } else {
        throw new Error(res?.error || 'Installation failed');
      }
    } catch (err) {
      addLog('error', `Failed to install '${project.title || projectId}': ${err?.message || err}`);
      pushToast({
        tone: 'error',
        title: t('mods.install'),
        message: t('mods.installError', { name: project.title || projectId, error: err?.message || '' }),
      });
    } finally {
      setModrinthInstalling(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleOpenModDetails = (project) => {
    setSelectedModDetail({ project, initialTab: 'overview' });
  };

  const handleInstallSpecificVersion = async (project, version) => {
    if (!isOnline) {
      pushToast({
        tone: 'error',
        title: 'Modrinth',
        message: t('offline.noConnectionToast'),
      });
      return;
    }
    const projectId = project.project_id || project.slug || project.id;
    const projectType = project.project_type || (exploreType === 'shaders' ? 'shader' : exploreType === 'resourcepacks' ? 'resourcepack' : 'mod');
    setInstallingVersionId(version.id);
    const primaryFile = version.files?.find(f => f.primary) || version.files?.[0];
    const verNumber = version.version_number || version.name || '';
    setLogs([]);
    persistState({ logs: [] });
    setActiveTab('console');
    addLog('info', `[Modrinth] Installing ${project.title || projectId} (v${verNumber})...`);

    try {
      let res;
      if (typeof window !== 'undefined' && window.launcher?.minecraftModrinthInstall) {
        res = await window.launcher.minecraftModrinthInstall({
          projectId,
          projectType,
          versionId: version.id,
          fileUrl: primaryFile?.url,
          fileName: primaryFile?.filename,
          gameVersion: version.game_versions?.[0] || effectiveMcVer || currentMcVer,
          loader: projectType === 'mod' ? (version.loaders?.[0] || effectiveLoader || currentLoader) : undefined,
        });
      } else {
        res = { ok: true, fileName: primaryFile?.filename || `${projectId}.zip` };
      }

      if (res?.ok) {
        if (projectType === 'shader') {
          if (Array.isArray(res.items)) setShaders(res.items);
          else loadShaders();
        } else if (projectType === 'resourcepack') {
          if (Array.isArray(res.items)) setResourcePacks(res.items);
          else loadResourcePacks();
        } else {
          if (Array.isArray(res.mods || res.items)) setMods(res.mods || res.items);
          else loadMods();
        }
        addLog('success', `[Modrinth] '${project.title || projectId}' (v${verNumber}) installed.`);
        pushToast({
          tone: 'success',
          title: t('mods.install'),
          message: t('mods.installedSuccess', { name: `${project.title || projectId} v${verNumber}` }),
        });
      } else {
        throw new Error(res?.error || 'Installation failed');
      }
    } catch (err) {
      addLog('error', `[Modrinth] Failed to install version: ${err?.message || err}`);
      pushToast({
        tone: 'error',
        title: t('mods.install'),
        message: t('mods.installError', { name: project.title || projectId, error: err?.message || '' }),
      });
    } finally {
      setInstallingVersionId(null);
    }
  };

  const isModInstalled = useCallback((project) => {
    if (!project) return false;
    const projectType = project.project_type || (exploreType === 'shaders' ? 'shader' : exploreType === 'resourcepacks' ? 'resourcepack' : 'mod');
    const slug = String(project.slug || '').toLowerCase().trim();
    const projId = String(project.project_id || project.id || '').toLowerCase().trim();
    const cleanTitle = String(project.title || '').toLowerCase().trim();

    if (projectType === 'shader') {
      if (!Array.isArray(shaders) || shaders.length === 0) return false;
      return shaders.some(s => {
        const sId = String(s.id || '').toLowerCase().trim();
        const sName = String(s.name || '').toLowerCase().trim();
        const sFile = String(s.fileName || '').toLowerCase().trim();
        return (slug && (sId === slug || sFile.startsWith(slug))) || (projId && sId === projId) || (cleanTitle && sName === cleanTitle);
      });
    }

    if (projectType === 'resourcepack') {
      if (!Array.isArray(resourcePacks) || resourcePacks.length === 0) return false;
      return resourcePacks.some(p => {
        const pId = String(p.id || '').toLowerCase().trim();
        const pName = String(p.name || '').toLowerCase().trim();
        const pFile = String(p.fileName || '').toLowerCase().trim();
        return (slug && (pId === slug || pFile.startsWith(slug))) || (projId && pId === projId) || (cleanTitle && pName === cleanTitle);
      });
    }

    if (!Array.isArray(mods) || mods.length === 0) return false;

    return mods.some(m => {
      const mModId = String(m.modId || '').toLowerCase().trim();
      const mName = String(m.name || '').toLowerCase().trim();
      const mFile = String(m.fileName || m.id || '').toLowerCase().trim();

      // 1. Exact match by internal jar modId or project id
      if (mModId && (mModId === slug || mModId === projId)) return true;

      // 2. Exact match by mod title
      if (cleanTitle && mName === cleanTitle) return true;

      // 3. Exact filename prefix match
      if (slug) {
        if (slug === 'sodium' && (mFile.includes('extra') || mFile.includes('reeses') || mFile.includes('options'))) {
          return false;
        }
        if (slug === 'iris' && mFile.includes('flawless')) {
          return false;
        }
        if (mFile === `${slug}.jar` || mFile === `${slug}.olpkg`) return true;
        const slugPrefixRegex = new RegExp(`^${slug}(?:[-_+v0-9.mc]|fabric|neoforge|forge)`, 'i');
        if (slugPrefixRegex.test(mFile)) return true;
      }
      return false;
    });
  }, [exploreType, mods, shaders, resourcePacks]);

  const checkingModUpdatesRef = useRef(false);
  const hasCheckedModsOnTabOpenRef = useRef(false);

  const handleCheckModUpdates = useCallback(async (options = {}) => {
    const silent = options?.silent ?? false;
    if (checkingModUpdatesRef.current) return;
    checkingModUpdatesRef.current = true;
    setCheckingModUpdates(true);
    try {
      if (!isOnline) {
        if (!silent) {
          pushToast({
            tone: 'warning',
            title: t('mods.checkUpdates'),
            message: t('offline.noConnectionToast'),
          });
        }
        return;
      }
      const loader = effectiveLoader || currentLoader || 'fabric';
      const gameVersion = effectiveMcVer || currentMcVer || '';

      const res = await launcher.minecraftCheckModUpdates?.({ loader, gameVersion });
      if (res?.updates) {
        setModUpdates(res.updates);
        const count = Object.keys(res.updates).filter(k => k.includes('.jar')).length;
        if (!silent) {
          if (count > 0) {
            pushToast({
              tone: 'success',
              title: t('mods.checkUpdates'),
              message: t('mods.updatesAvailable', { count }),
            });
          } else {
            pushToast({
              tone: 'info',
              title: t('mods.checkUpdates'),
              message: t('mods.upToDate'),
            });
          }
        }
      }
    } catch (e) {
      if (!silent) {
        pushToast({
          tone: 'error',
          title: t('mods.checkUpdates'),
          message: e?.message || String(e),
        });
      }
    } finally {
      checkingModUpdatesRef.current = false;
      setCheckingModUpdates(false);
    }
  }, [isOnline, effectiveLoader, currentLoader, effectiveMcVer, currentMcVer, pushToast, t]);

  const handleUpdateMod = async (updateInfo) => {
    if (!updateInfo) return;
    const key = updateInfo.fileName || updateInfo.fileKey;
    setUpdatingMods(prev => new Set(prev).add(key));
    try {
      const loader = effectiveLoader || currentLoader || 'fabric';
      const gameVersion = effectiveMcVer || currentMcVer || '';
      const res = await launcher.minecraftModrinthInstall?.({
        projectId: updateInfo.projectId,
        versionId: updateInfo.versionId,
        fileUrl: updateInfo.fileUrl,
        fileName: updateInfo.targetFileName || updateInfo.fileName,
        loader,
        gameVersion,
      });

      if (res?.error) {
        pushToast({
          tone: 'error',
          title: t('mods.updateMod'),
          message: res.message || res.error,
        });
        return;
      }

      if (res?.mods && Array.isArray(res.mods)) {
        setMods(res.mods);
      } else {
        const loadedMods = await launcher.minecraftGetInstalledMods?.();
        if (Array.isArray(loadedMods)) setMods(loadedMods);
      }

      setModUpdates(prev => {
        const next = { ...prev };
        delete next[updateInfo.fileName];
        delete next[updateInfo.fileKey];
        return next;
      });

      pushToast({
        tone: 'success',
        title: t('mods.updateMod'),
        message: t('mods.installedSuccess', { name: updateInfo.newVersionName || updateInfo.fileName }),
      });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: t('mods.updateMod'),
        message: e?.message || String(e),
      });
    } finally {
      setUpdatingMods(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleUpdateAllMods = async () => {
    const updateEntries = Object.values(modUpdates).filter((u, i, arr) => arr.findIndex(x => x.fileName === u.fileName) === i);
    if (updateEntries.length === 0) return;
    for (const updateInfo of updateEntries) {
      await handleUpdateMod(updateInfo);
    }
  };

  const handleResolveConflictUpdate = async (rec) => {
    if (!rec) return;
    setLogs([]);
    persistState({ logs: [] });
    try {
      pushToast({
        tone: 'info',
        title: t('mods.updating'),
        message: `${rec.displayName || rec.modId} -> v${rec.targetVersion}`,
      });
      const loader = currentLoader || 'fabric';
      const gameVersion = currentMcVer || '';
      const res = await launcher.minecraftModrinthInstall?.({
        projectId: rec.modId,
        versionId: null,
        versionNumber: rec.targetVersion,
        loader,
        gameVersion,
      });
      if (res?.error) {
        pushToast({
          tone: 'error',
          title: t('mods.conflictTitle'),
          message: res.message || res.error,
        });
        return;
      }
      if (res?.mods && Array.isArray(res.mods)) {
        setMods(res.mods);
      } else {
        const loadedMods = await launcher.minecraftGetInstalledMods?.();
        if (Array.isArray(loadedMods)) setMods(loadedMods);
      }
      setModConflict(null);
      pushToast({
        tone: 'success',
        title: t('mods.installedSuccess', { name: rec.displayName || rec.modId }),
        message: t('mods.installedSuccess', { name: rec.displayName || rec.modId }),
      });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: t('mods.conflictTitle'),
        message: e?.message || String(e),
      });
    }
  };

  const [fixingAllConflicts, setFixingAllConflicts] = useState(false);

  const handleAutoFixAllConflicts = async (compatFixes) => {
    if (!compatFixes || compatFixes.length === 0) return;
    setLogs([]);
    persistState({ logs: [] });
    setFixingAllConflicts(true);
    pushToast({
      tone: 'info',
      title: t('mods.conflictFixAllBtn'),
      message: t('mods.conflictFixing'),
    });
    try {
      const loader = currentLoader || 'fabric';
      const gameVersion = currentMcVer || '';

      for (const fix of compatFixes) {
        const mainMod = findModInList(mods, fix.modId, fix.displayName);

        const mainCurrent = String(mainMod?.version || '').replace(/^v/i, '').trim();
        const mainTarget = String(fix.targetVersion || '').replace(/^v/i, '').trim();

        // Install base compatible version only if needed
        if (!mainCurrent || mainCurrent !== mainTarget) {
          await launcher.minecraftModrinthInstall?.({
            projectId: fix.modId,
            versionNumber: fix.targetVersion,
            loader,
            gameVersion,
          });
        }

        // Cascade updates/downgrades for companion mods
        if (Array.isArray(fix.cascade)) {
          for (const item of fix.cascade) {
            const cascadeMod = findModInList(mods, item.modId, item.displayName);
            if (cascadeMod) {
              const cCurrent = String(cascadeMod.version || '').replace(/^v/i, '').trim();
              const cTarget = String(item.targetVersion || '').replace(/^v/i, '').trim();
              if (!cCurrent || cCurrent !== cTarget) {
                await launcher.minecraftModrinthInstall?.({
                  projectId: item.modId,
                  versionNumber: item.targetVersion,
                  loader,
                  gameVersion,
                });
              }
            }
          }
        }
      }

      // Re-enable Iris if it was disabled
      const irisMod = mods.find(m => String(m.id || '').toLowerCase() === 'iris' || String(m.fileName || '').toLowerCase().includes('iris'));
      if (irisMod && !irisMod.enabled) {
        await launcher.minecraftToggleMod?.(irisMod.id || irisMod.fileName, true);
      }

      const refreshed = await launcher.minecraftGetInstalledMods?.();
      if (Array.isArray(refreshed)) setMods(refreshed);
      setModConflict(null);

      pushToast({
        tone: 'success',
        title: t('mods.conflictFixAllBtn'),
        message: t('mods.conflictFixedSuccess'),
      });
    } catch (e) {
      pushToast({
        tone: 'error',
        title: t('mods.conflictTitle'),
        message: e?.message || String(e),
      });
    } finally {
      setFixingAllConflicts(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'mods' || activeTab === 'shaders' || activeTab === 'resourcepacks' || activeTab === 'explore') {
      loadMods();
      loadShaders();
      loadResourcePacks();

      if (activeTab === 'mods' && isOnline) {
        if (!hasCheckedModsOnTabOpenRef.current) {
          hasCheckedModsOnTabOpenRef.current = true;
          handleCheckModUpdates({ silent: true });
        }
      }
    } else {
      hasCheckedModsOnTabOpenRef.current = false;
    }
  }, [activeTab, isOnline, loadMods, loadShaders, loadResourcePacks]);

  const handleCheckForUpdates = async () => {
    addLog('info', 'Checking for launcher updates...');
    try {
      const res = await launcher.minecraftCheckUpdate?.();
      if (res?.upToDate) {
        pushToast({ tone: 'info', title: t('update.launcherUpdate'), message: t('messages.alreadyUpToDate') });
      }
    } catch (e) {
      addLog('error', `Update check failed: ${e?.message || e}`);
    }
  };

  const handleOpenMinecraftDirectory = async () => {
    try {
      await launcher.minecraftOpenRootDirectory?.();
    } catch (e) {
      addLog('error', `Failed to open directory: ${e?.message || e}`);
    }
  };

  const handleCopyConsole = () => {
    const text = logs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
    navigator.clipboard?.writeText(text);
    pushToast({ tone: 'info', title: t('console.copy'), message: t('console.copiedToClipboard') });
  };

  const handleClearConsole = () => {
    setLogs([]);
    persistState({ logs: [] });
  };

  // Avatar resolution helper
  const profileAvatarName = (account.loggedIn && account.name)
    ? account.name
    : (activeProfile?.skinName || activeProfile?.microsoftAccount || (activeProfile?.localName && activeProfile?.localName !== 'Player' ? activeProfile?.localName : '') || 'MHF_Steve');
  const profileAvatarUrl = getMcHeadsAvatarUrl(profileAvatarName, 64);

  // Version Loader Type badge helper
  const loaderType = String(activeProfileVersion?.type || activeVersion?.type || activeProfile?.version || '').toLowerCase();
  const loaderBadgeClass = loaderType.includes('fabric') ? 'fabric' : loaderType.includes('neoforge') ? 'neoforge' : loaderType.includes('forge') ? 'forge' : loaderType.includes('quilt') ? 'quilt' : 'vanilla';
  const loaderBadgeLabel = loaderType.includes('fabric') ? 'Fabric' : loaderType.includes('neoforge') ? 'NeoForge' : loaderType.includes('forge') ? 'Forge' : loaderType.includes('quilt') ? 'Quilt' : 'Vanilla';

  const profileToEdit = profileEditor?.mode === 'edit'
    ? profiles.find(p => p.id === profileEditor.profileId) || null
    : null;

  return (
    <>
      <div className="toast-stack" aria-live="polite">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={dismissToast} />
        ))}
      </div>

      {/* ── WINDOW TITLEBAR ── */}
      <div className="titlebar">
        <div className="titlebar-brand">
          <div className="titlebar-logo">
            <img src={logoIcon} alt="Logo" style={{ width: 20, height: 20 }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span className="titlebar-name">{t('app.name')}</span>
          <span className="titlebar-version">{appVersion ? `v${appVersion}` : '1.0.0'}</span>
        </div>
        {!launcher?.isMac && launcher?.platform !== 'darwin' && (
          <div className="titlebar-controls">
            <button className="win-btn" onClick={() => launcher.windowMinimize()} title={t('window.minimize')}>
              <Icon d={ICONS.minimize} size={11} />
            </button>
            <button className="win-btn" onClick={() => launcher.windowMaximize()} title={t('window.maximize')}>
              <Icon d={ICONS.maximize} size={10} />
            </button>
            <button className="win-btn close" onClick={() => launcher.windowClose()} title={t('window.close')}>
              <Icon d={ICONS.x} size={11} />
            </button>
          </div>
        )}
      </div>

      {/* ── APP LAYOUT ── */}
      <div className="app-layout">
        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-scroll">
            <div className="sidebar-heading">
              <span className="sidebar-title">{t('sidebar.profiles')}</span>
            </div>

            <div className="profile-list">
              {profiles.map(p => {
                const installedProfileVersion = p.version
                  ? installedVersions.find(v => v.id === p.version) || getVersionById(p.version, versionCatalog)
                  : null;
                const profileVersionLabel = resolveMinecraftVersion(installedProfileVersion?.inheritsFrom || installedProfileVersion?.mcVer || p.version) || 'Auto';
                const isSelected = p.id === activeProfileId;
                const avatarName = (account.loggedIn && account.profileKey === p.id && account.name)
                  ? account.name
                  : (p.skinName || p.microsoftAccount || (p.localName && p.localName !== 'Player' ? p.localName : '') || 'MHF_Steve');

                return (
                  <div
                    key={p.id}
                    className={`profile-card ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      if (authRefreshing || gameState === 'running') return;
                      setActiveProfileId(p.id);
                      persistState({ activeProfileId: p.id });
                    }}
                  >
                    <div className="profile-avatar">
                      <img
                        key={`profile-avatar-${p.id}-${avatarName}`}
                        src={getMcHeadsAvatarUrl(avatarName, 64)}
                        alt={avatarName}
                        onLoad={(e) => {
                          e.currentTarget.style.display = 'block';
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="profile-info">
                      <div className="profile-name-row">
                        <span className="profile-name">{p.name}</span>
                        <ProfileCardActions
                          active={isSelected}
                          name={p.name}
                          disabled={authRefreshing || gameState === 'running'}
                          onEdit={(e) => {
                            e.stopPropagation();
                            setProfileEditor({ mode: 'edit', profileId: p.id });
                          }}
                          onDuplicate={(e) => handleDuplicateProfile(p.id, e)}
                          onDelete={(e) => {
                            e.stopPropagation();
                            handleDeleteProfile(p.id);
                          }}
                        />
                      </div>
                      <div className="profile-badges-row">
                        <span className="profile-chip version">{profileVersionLabel}</span>
                        <span className="profile-chip">{p.ram || 4} GB</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                className="add-profile-btn"
                onClick={() => setProfileEditor({ mode: 'new', profileId: null })}
                disabled={authRefreshing || gameState === 'running'}
              >
                <Icon d={ICONS.plus} size={13} />
                <span>{t('sidebar.newProfile')}</span>
              </button>
            </div>

            {/* ── DISCOVER ── */}
            <div className="sidebar-heading" style={{ marginTop: 10 }}>
              <span className="sidebar-title">{t('sidebar.discover')}</span>
            </div>

            <div className="sidebar-nav">
              <div
                className={`nav-item ${activeTab === 'news' ? 'active' : ''}`}
                onClick={() => setActiveTab('news')}
              >
                <span className="nav-icon"><Icon d={ICONS.news} size={14} /></span>
                <span>{t('sidebar.news')}</span>
              </div>
              <div
                className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
                onClick={() => setActiveTab('explore')}
              >
                <span className="nav-icon"><Icon d={ICONS.compass} size={14} /></span>
                <span>{t('sidebar.explore')}</span>
              </div>
            </div>

            {/* ── MY LIBRARY ── */}
            <div className="sidebar-heading" style={{ marginTop: 12 }}>
              <span className="sidebar-title">{t('sidebar.library')}</span>
            </div>

            <div className="sidebar-nav">
              <div
                className={`nav-item ${activeTab === 'mods' ? 'active' : ''}`}
                onClick={() => setActiveTab('mods')}
              >
                <span className="nav-icon"><Icon d={ICONS.cube} size={14} /></span>
                <span>{t('sidebar.mods')}</span>
                <span className="nav-counter">{mods.filter(m => m.enabled).length}</span>
              </div>
              <div
                className={`nav-item ${activeTab === 'shaders' ? 'active' : ''}`}
                onClick={() => setActiveTab('shaders')}
              >
                <span className="nav-icon"><Icon d={ICONS.sun} size={14} /></span>
                <span>{t('sidebar.shaders')}</span>
                <span className="nav-counter">{shaders.length}</span>
              </div>
              <div
                className={`nav-item ${activeTab === 'resourcepacks' ? 'active' : ''}`}
                onClick={() => setActiveTab('resourcepacks')}
              >
                <span className="nav-icon"><Icon d={ICONS.layers} size={14} /></span>
                <span>{t('sidebar.resourcePacks')}</span>
                <span className="nav-counter">{resourcePacks.length}</span>
              </div>
            </div>

            {/* ── SYSTEM ── */}
            <div className="sidebar-heading" style={{ marginTop: 12 }}>
              <span className="sidebar-title">{t('sidebar.system')}</span>
            </div>

            <div className="sidebar-nav">
              <div
                className={`nav-item ${activeTab === 'console' ? 'active' : ''}`}
                onClick={() => setActiveTab('console')}
              >
                <span className="nav-icon"><Icon d={ICONS.console} size={14} /></span>
                <span>{t('sidebar.console')}</span>
                {gameState === 'running' && <span className="status-dot in-game" style={{ marginLeft: 'auto' }} />}
              </div>
            </div>
          </div>

          {/* ── ACCOUNT AREA ── */}
          <div className="sidebar-account">
            <div className="account-card">
              <div className="account-avatar">
                <img
                  key={`account-avatar-${profileAvatarName}`}
                  src={profileAvatarUrl}
                  alt={profileAvatarName}
                  onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
              <div className="account-info">
                <span className="account-name">{account.name || t('account.loggedOut')}</span>
                <span className="account-status-label">
                  <span className={`status-dot ${gameState === 'running' ? 'in-game' : account.loggedIn ? 'online' : ''}`} />
                  {authRefreshing ? (
                    <span>{t('account.refreshingAuth')}</span>
                  ) : gameState === 'running' ? (
                    <span>{t('account.inGame')}</span>
                  ) : account.kind === 'microsoft' ? (
                    <span>{t('account.microsoftBadge')}</span>
                  ) : account.loggedIn ? (
                    <span>{t('account.offline')}</span>
                  ) : (
                    <span>{t('account.guest')}</span>
                  )}
                </span>
              </div>
              {account.kind === 'microsoft' ? (
                <button className="account-auth-btn logout" onClick={handleLogout} title={t('account.logout')}>
                  <Icon d={ICONS.logout} size={12} />
                </button>
              ) : (
                <button className="account-auth-btn" onClick={handleLogin} title={t('account.loginWithMicrosoft')}>
                  <MicrosoftLogo />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="main-content">
          {/* Top Action Toolbar */}
          <div className="action-bar">
            <div className="action-bar-tabs">
              {/* Discover Group */}
              <div className="tab-group">
                <button
                  className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`}
                  onClick={() => setActiveTab('news')}
                >
                  <Icon d={ICONS.news} size={13} />
                  <span>{t('sidebar.news')}</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'explore' ? 'active' : ''}`}
                  onClick={() => setActiveTab('explore')}
                >
                  <Icon d={ICONS.compass} size={13} />
                  <span>{t('sidebar.explore')}</span>
                </button>
              </div>

              <div className="tab-group-divider" />

              {/* Library Group */}
              <div className="tab-group">
                <button
                  className={`tab-btn ${activeTab === 'mods' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mods')}
                >
                  <Icon d={ICONS.cube} size={13} />
                  <span>{t('sidebar.mods')}</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'shaders' ? 'active' : ''}`}
                  onClick={() => setActiveTab('shaders')}
                >
                  <Icon d={ICONS.sun} size={13} />
                  <span>{t('sidebar.shaders')}</span>
                </button>
                <button
                  className={`tab-btn ${activeTab === 'resourcepacks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('resourcepacks')}
                >
                  <Icon d={ICONS.layers} size={13} />
                  <span>{t('sidebar.resourcePacks')}</span>
                </button>
              </div>

              <div className="tab-group-divider" />

              {/* System Group */}
              <div className="tab-group">
                <button
                  className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
                  onClick={() => setActiveTab('console')}
                >
                  <Icon d={ICONS.console} size={13} />
                  <span>{t('sidebar.console')}</span>
                </button>
              </div>
            </div>

            <div className="action-bar-actions">
              {!isOnline && (
                <div className="offline-pill" title={t('offline.newsDesc')}>
                  <Icon d={ICONS.wifiOff} size={12} />
                  <span>{t('offline.badge')}</span>
                </div>
              )}
              <button
                className="btn-primary"
                onClick={() => setModal('install')}
                disabled={gameState === 'running'}
                title={t('install.installVersion')}
                style={{ gap: 6, padding: '7px 14px' }}
              >
                <Icon d={ICONS.download} size={13} />
                <span>{t('install.installVersion')}</span>
              </button>
              <button
                className="btn-secondary"
                onClick={handleOpenMinecraftDirectory}
                title={t('settings.openMinecraftDirectory')}
              >
                <Icon d={ICONS.folder} size={12} />
              </button>
              <button
                className="btn-secondary"
                onClick={() => setModal('settings')}
                title={t('settings.title')}
              >
                <Icon d={ICONS.settings} size={12} />
              </button>
            </div>
          </div>

          {/* Update Notification Banner */}
          {updateState.phase === 'downloading' || updateState.phase === 'launching' || updateState.phase === 'complete' ? (
            <div className="update-banner">
              <div className="update-banner-header">
                <span className="update-banner-title">{t('update.launcherUpdate')} — {updateState.latestVersion || ''}</span>
                <span style={{ fontSize: 11, color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>
                  {updateState.phase === 'downloading' ? `${updateState.progress || 0}%` : updateState.phase}
                </span>
              </div>
              <div className="update-banner-progress">
                <div className="update-banner-fill" style={{ width: `${Math.max(0, Math.min(100, updateState.progress || 0))}%` }} />
              </div>
            </div>
          ) : null}

          {/* ── TAB: NEWS ── */}
          <div className="tab-panel" style={{ display: activeTab === 'news' ? 'flex' : 'none' }}>
            <div className="news-header">
              <div>
                <h2 className="news-title">{t('news.title')}</h2>
                <div className="news-subtitle">{t('news.subtitle')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" type="button" onClick={loadNews} disabled={newsLoading}>
                  <Icon d={ICONS.refresh} size={11} />
                  {newsLoading ? t('news.loading') : t('news.refresh')}
                </button>
                <button className="btn-primary" type="button" onClick={handleOpenNewsSource} style={{ fontSize: 12, padding: '6px 12px' }}>
                  <Icon d={ICONS.external} size={11} />
                  {t('news.openSource')}
                </button>
              </div>
            </div>

            {!isOnline && newsItems.length === 0 ? (
              <EmptyState
                icon={ICONS.wifiOff}
                title={t('offline.newsTitle')}
                description={t('offline.newsDesc')}
                actionText={t('news.refresh')}
                actionIcon={ICONS.refresh}
                onAction={loadNews}
              />
            ) : newsError ? (
              <EmptyState
                icon={ICONS.news}
                title={t('news.errorTitle')}
                description={newsError}
                actionText={t('news.refresh')}
                actionIcon={ICONS.refresh}
                onAction={loadNews}
                secondaryText={t('news.openSource')}
                onSecondary={handleOpenNewsSource}
              />
            ) : newsLoading && newsItems.length === 0 ? (
              <div className="news-grid">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="news-card-skeleton">
                    <div className="skeleton-media" />
                    <div className="skeleton-body">
                      <div className="skeleton-line short" />
                      <div className="skeleton-line" />
                      <div className="skeleton-line sub" />
                    </div>
                  </div>
                ))}
              </div>
            ) : newsItems.length === 0 ? (
              <EmptyState
                icon={ICONS.news}
                title={t('news.emptyTitle')}
                description={t('news.emptyText')}
                actionText={t('news.refresh')}
                actionIcon={ICONS.refresh}
                onAction={loadNews}
                secondaryText={t('news.openSource')}
                onSecondary={handleOpenNewsSource}
              />
            ) : (
              <div className="news-grid">
                {newsItems.map(item => (
                  <NewsCard key={item.url} item={item} onOpen={handleOpenNewsArticle} />
                ))}
              </div>
            )}
          </div>

          {/* ── TAB: EXPLORE (MODRINTH CATALOG) ── */}
          <div
            className="tab-panel"
            style={{ display: activeTab === 'explore' ? 'flex' : 'none', position: 'relative' }}
          >
            <div className="explore-header">
              <div>
                <h2 className="explore-title" style={{ display: 'flex', alignItems: 'center' }}>
                  {t('explore.title')}
                  <div className="explore-beta-wrapper" ref={betaInfoRef}>
                    <button
                      type="button"
                      className={`explore-beta-tag ${showBetaInfo ? 'active' : ''}`}
                      onClick={() => setShowBetaInfo(prev => !prev)}
                      title={t('mods.modrinthBetaTitle')}
                    >
                      <span>BETA</span>
                      <Icon d={ICONS.info} size={11} style={{ opacity: 0.85 }} />
                    </button>
                    {showBetaInfo && (
                      <div className="explore-beta-popover">
                        <div className="explore-beta-popover-header">
                          <div className="explore-beta-popover-title">
                            <Icon d={ICONS.compass} size={14} style={{ color: 'var(--accent-light, #60a5fa)' }} />
                            <span>{t('mods.modrinthBetaTitle')}</span>
                          </div>
                          <button
                            type="button"
                            className="explore-beta-popover-close"
                            onClick={() => setShowBetaInfo(false)}
                          >
                            <Icon d={ICONS.x} size={11} />
                          </button>
                        </div>
                        <div className="explore-beta-popover-body">
                          {t('mods.modrinthBetaDescription')}
                        </div>
                        <div className="explore-beta-popover-footer">
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ fontSize: 11, padding: '4px 8px', height: 'auto', textDecoration: 'none' }}
                            onClick={() => {
                              launcher.openExternal?.('https://modrinth.com').catch(() => { });
                            }}
                          >
                            <Icon d={ICONS.external} size={11} />
                            <span>Modrinth.com</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </h2>
                <div className="explore-subtitle">{t('explore.subtitle')}</div>
              </div>
              <div className="explore-type-selector">
                <button
                  type="button"
                  className={`explore-type-pill ${exploreType === 'mods' ? 'active' : ''}`}
                  onClick={() => setExploreType('mods')}
                >
                  <Icon d={ICONS.cube} size={15} />
                  <span>{t('explore.tabMods')}</span>
                </button>
                <button
                  type="button"
                  className={`explore-type-pill ${exploreType === 'shaders' ? 'active' : ''}`}
                  onClick={() => setExploreType('shaders')}
                >
                  <Icon d={ICONS.sun} size={15} />
                  <span>{t('explore.tabShaders')}</span>
                </button>
                <button
                  type="button"
                  className={`explore-type-pill ${exploreType === 'resourcepacks' ? 'active' : ''}`}
                  onClick={() => setExploreType('resourcepacks')}
                >
                  <Icon d={ICONS.layers} size={15} />
                  <span>{t('explore.tabResourcePacks')}</span>
                </button>
              </div>
            </div>

            <div className="modrinth-browser">
              <div className="modrinth-controls-bar">
                <div className="mods-search-box modrinth-search-box">
                  <Icon d={ICONS.search} size={14} />
                  <input
                    type="text"
                    className="mods-search-input"
                    placeholder={
                      exploreType === 'shaders'
                        ? t('mods.searchModrinthShadersPlaceholder')
                        : exploreType === 'resourcepacks'
                          ? t('mods.searchModrinthResourcePacksPlaceholder')
                          : t('mods.searchModrinthPlaceholder')
                    }
                    value={modrinthQuery}
                    onChange={e => setModrinthQuery(e.target.value)}
                  />
                  {modrinthQuery && (
                    <button className="search-clear-btn" onClick={() => setModrinthQuery('')}>
                      <Icon d={ICONS.x} size={11} />
                    </button>
                  )}
                </div>

                <div className="modrinth-filters-row">
                  <div className="modrinth-filter-select-wrapper">
                    <span className="modrinth-filter-label">{t('mods.filterSort')}:</span>
                    <select
                      className="select-input modrinth-filter-select"
                      value={modrinthSort}
                      onChange={e => setModrinthSort(e.target.value)}
                    >
                      <option value="relevance">{t('mods.sortRelevance')}</option>
                      <option value="downloads">{t('mods.sortDownloads')}</option>
                      <option value="follows">{t('mods.sortFollows')}</option>
                      <option value="newest">{t('mods.sortNewest')}</option>
                      <option value="updated">{t('mods.sortUpdated')}</option>
                    </select>
                  </div>

                  {exploreType === 'mods' && (
                    <div className="modrinth-filter-select-wrapper">
                      <span className="modrinth-filter-label">{t('mods.filterLoader')}:</span>
                      <select
                        className="select-input modrinth-filter-select"
                        value={modrinthLoaderFilter}
                        onChange={e => setModrinthLoaderFilter(e.target.value)}
                      >
                        {currentLoader && (
                          <option value="auto">
                            Auto ({currentLoader.toUpperCase()})
                          </option>
                        )}
                        <option value="all">{t('mods.allLoaders')}</option>
                        <option value="fabric">Fabric</option>
                        <option value="forge">Forge</option>
                        <option value="neoforge">NeoForge</option>
                        <option value="quilt">Quilt</option>
                      </select>
                    </div>
                  )}

                  <div className="modrinth-filter-select-wrapper">
                    <span className="modrinth-filter-label">{t('mods.filterVersion')}:</span>
                    <select
                      className="select-input modrinth-filter-select"
                      value={modrinthVersionFilter}
                      onChange={e => setModrinthVersionFilter(e.target.value)}
                    >
                      <option value="auto">
                        {currentMcVer ? `Auto (${currentMcVer})` : t('mods.allVersions')}
                      </option>
                      <option value="all">{t('mods.allVersions')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Category Pills */}
              <div className="modrinth-category-pills">
                {(exploreType === 'shaders' ? [
                  { id: 'all', label: t('mods.allCategories') },
                  { id: 'fantasy', label: 'Fantasy' },
                  { id: 'realistic', label: 'Realistic' },
                  { id: 'performance', label: 'Performance' },
                  { id: 'semi-realistic', label: 'Semi-Realistic' },
                  { id: 'cinematic', label: 'Cinematic' },
                  { id: 'vanilla-like', label: 'Vanilla-like' },
                ] : exploreType === 'resourcepacks' ? [
                  { id: 'all', label: t('mods.allCategories') },
                  { id: '16x', label: '16x' },
                  { id: '32x', label: '32x' },
                  { id: '64x', label: '64x' },
                  { id: '128x', label: '128x' },
                  { id: '512x', label: '512x' },
                  { id: 'realistic', label: 'Realistic' },
                  { id: 'medieval', label: 'Medieval' },
                  { id: 'vanilla-like', label: 'Vanilla-like' },
                ] : [
                  { id: 'all', label: t('mods.allCategories') },
                  { id: 'optimization', label: 'Optimization' },
                  { id: 'technology', label: 'Technology' },
                  { id: 'adventure', label: 'Adventure' },
                  { id: 'decoration', label: 'Decoration' },
                  { id: 'utility', label: 'Utility' },
                  { id: 'magic', label: 'Magic' },
                  { id: 'worldgen', label: 'World Gen' },
                ]).map(cat => (
                  <button
                    key={cat.id}
                    className={`category-pill ${modrinthCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setModrinthCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Modrinth Grid */}
              {!isOnline ? (
                <EmptyState
                  icon={ICONS.wifiOff}
                  title={t('offline.modrinthTitle')}
                  description={t('offline.modrinthDesc')}
                />
              ) : modrinthLoading ? (
                <div className="modrinth-loading-state">
                  <span className="modrinth-spinner" />
                  <span>{t('account.loading')}</span>
                </div>
              ) : modrinthResults.length === 0 ? (
                <EmptyState
                  icon={ICONS.search}
                  title={
                    exploreType === 'shaders'
                      ? t('mods.noShadersMatchTitle')
                      : exploreType === 'resourcepacks'
                        ? t('mods.noResourcePacksMatchTitle')
                        : t('mods.noMatchTitle')
                  }
                  description={
                    exploreType === 'shaders'
                      ? t('mods.noModrinthShadersResults')
                      : exploreType === 'resourcepacks'
                        ? t('mods.noModrinthResourcePacksResults')
                        : t('mods.noModrinthResults')
                  }
                  actionText={t('common.clearSearch')}
                  onAction={() => {
                    setModrinthQuery('');
                    setModrinthCategory('all');
                    setModrinthLoaderFilter('auto');
                    setModrinthVersionFilter('auto');
                  }}
                />
              ) : (
                <>
                  <div className="modrinth-grid">
                    {modrinthResults.map(proj => (
                      <ModrinthCard
                        key={proj.project_id || proj.slug}
                        project={proj}
                        installed={isModInstalled(proj)}
                        installing={Boolean(modrinthInstalling[proj.project_id || proj.slug])}
                        onInstall={handleInstallModrinthMod}
                        onOpenDetails={handleOpenModDetails}
                      />
                    ))}
                  </div>
                  <div ref={modrinthSentinelRef} className="modrinth-sentinel">
                    {modrinthLoadingMore && (
                      <div className="modrinth-load-more">
                        <span className="modrinth-spinner small" />
                        <span>{t('account.loading')}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── TAB: MODS (LIBRARY) ── */}
          <div
            className={`tab-panel ${isDragging ? 'dragging-over' : ''}`}
            style={{ display: activeTab === 'mods' ? 'flex' : 'none', position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="dropzone-overlay">
                <div className="dropzone-content">
                  <Icon d={ICONS.download} size={36} />
                  <span className="dropzone-title">{t('mods.dropzone')}</span>
                  <span className="dropzone-sub">{t('mods.dropzoneSub')}</span>
                </div>
              </div>
            )}

            <div className="mods-toolbar">
              <div className="mods-search-box">
                <Icon d={ICONS.search} size={13} />
                <input
                  type="text"
                  className="mods-search-input"
                  placeholder={t('mods.searchPlaceholder')}
                  value={modSearch}
                  onChange={e => setModSearch(e.target.value)}
                />
                {modSearch && (
                  <button className="search-clear-btn" onClick={() => setModSearch('')}>
                    <Icon d={ICONS.x} size={11} />
                  </button>
                )}
              </div>

              {mods.length > 0 && (
                <span className="mods-count-badge">
                  {mods.filter(m => m.enabled).length}/{mods.length} {t('mods.active')}
                </span>
              )}

              <div className="mods-toolbar-actions">
                {mods.length > 0 && (() => {
                  const anyEnabled = mods.some(m => m.enabled);
                  return (
                    <button
                      className="btn-secondary"
                      onClick={() => handleSetAllModsEnabled(!anyEnabled)}
                      title={anyEnabled ? t('mods.disableAll') : t('mods.enableAll')}
                    >
                      <Icon d={anyEnabled ? ICONS.stop : ICONS.check} size={12} />
                      <span>{anyEnabled ? t('mods.disableAll') : t('mods.enableAll')}</span>
                    </button>
                  );
                })()}
                <button
                  className="btn-secondary"
                  onClick={() => handleCheckModUpdates({ silent: false })}
                  disabled={checkingModUpdates}
                  title={t('mods.checkUpdates')}
                >
                  <Icon d={ICONS.refresh} size={12} className={checkingModUpdates ? 'spin-infinite' : ''} />
                  <span>{t('mods.checkUpdates')}</span>
                </button>
                <button className="btn-secondary" onClick={() => handleOpenContentFolder('mods')} title={t('mods.openModsFolder')}>
                  <Icon d={ICONS.folder} size={12} />
                  <span>{t('mods.openFolder')}</span>
                </button>
                <button className="btn-primary" onClick={() => handleAddContentClick('mods')} style={{ fontSize: 12, padding: '6px 14px' }}>
                  <Icon d={ICONS.plus} size={12} />
                  {t('mods.addMod')}
                </button>
              </div>
            </div>

            {mods.length === 0 ? (
              <EmptyState
                icon={ICONS.cube}
                title={t('mods.emptyTitle')}
                description={t('mods.emptyText')}
                actionText={t('explore.browseMods')}
                actionIcon={ICONS.compass}
                onAction={() => {
                  setExploreType('mods');
                  setActiveTab('explore');
                }}
                secondaryText={t('mods.openModsFolder')}
                onSecondary={() => handleOpenContentFolder('mods')}
              />
            ) : (() => {
              const filtered = mods.filter(m =>
                String(m.name || '').toLowerCase().includes(modSearch.toLowerCase()) ||
                String(m.fileName || '').toLowerCase().includes(modSearch.toLowerCase())
              );
              if (filtered.length === 0) {
                return (
                  <EmptyState
                    icon={ICONS.search}
                    title={t('mods.noMatchTitle')}
                    description={t('mods.noMatchText')}
                    actionText={t('common.clearSearch')}
                    onAction={() => setModSearch('')}
                  />
                );
              }
              return (
                <div className="mods-grid">
                  {filtered.map(mod => {
                    const fileKey = mod.fileName ? mod.fileName.replace(/\.jar(\.disabled)?$/i, '').toLowerCase() : '';
                    const updateInfo = modUpdates[mod.fileName] || modUpdates[fileKey] || modUpdates[mod.name] || modUpdates[mod.id] || null;
                    const isUpdating = updatingMods.has(mod.fileName) || updatingMods.has(fileKey);
                    return (
                      <ModCard
                        key={mod.id}
                        mod={mod}
                        updateInfo={updateInfo}
                        updating={isUpdating}
                        onToggle={handleModToggle}
                        onDelete={handleModDelete}
                        onUpdate={handleUpdateMod}
                      />
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* ── TAB: SHADERS (LIBRARY) ── */}
          <div
            className={`tab-panel ${isDragging ? 'dragging-over' : ''}`}
            style={{ display: activeTab === 'shaders' ? 'flex' : 'none', position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="dropzone-overlay">
                <div className="dropzone-content">
                  <Icon d={ICONS.download} size={36} />
                  <span className="dropzone-title">{t('mods.dropzone')}</span>
                  <span className="dropzone-sub">{t('mods.dropzoneSub')}</span>
                </div>
              </div>
            )}

            <div className="mods-toolbar">
              <div className="mods-search-box">
                <Icon d={ICONS.search} size={13} />
                <input
                  type="text"
                  className="mods-search-input"
                  placeholder={t('mods.searchShadersPlaceholder')}
                  value={shaderSearch}
                  onChange={e => setShaderSearch(e.target.value)}
                />
                {shaderSearch && (
                  <button className="search-clear-btn" onClick={() => setShaderSearch('')}>
                    <Icon d={ICONS.x} size={11} />
                  </button>
                )}
              </div>

              {shaders.length > 0 && (
                <span className="mods-count-badge">
                  {shaders.length} {t('sidebar.shaders')}
                </span>
              )}

              <div className="mods-toolbar-actions">
                <button className="btn-secondary" onClick={() => handleOpenContentFolder('shaders')} title={t('mods.openShadersFolder')}>
                  <Icon d={ICONS.folder} size={12} />
                  <span>{t('mods.openFolder')}</span>
                </button>
                <button className="btn-primary" onClick={() => handleAddContentClick('shaders')} style={{ fontSize: 12, padding: '6px 14px' }}>
                  <Icon d={ICONS.plus} size={12} />
                  {t('mods.addShader')}
                </button>
              </div>
            </div>

            {shaders.length === 0 ? (
              <EmptyState
                icon={ICONS.sun}
                title={t('mods.emptyShadersTitle')}
                description={t('mods.emptyShadersText')}
                actionText={t('explore.browseShaders')}
                actionIcon={ICONS.compass}
                onAction={() => {
                  setExploreType('shaders');
                  setActiveTab('explore');
                }}
                secondaryText={t('mods.openShadersFolder')}
                onSecondary={() => handleOpenContentFolder('shaders')}
              />
            ) : (() => {
              const filtered = shaders.filter(s =>
                String(s.name || '').toLowerCase().includes(shaderSearch.toLowerCase()) ||
                String(s.fileName || '').toLowerCase().includes(shaderSearch.toLowerCase())
              );
              if (filtered.length === 0) {
                return (
                  <EmptyState
                    icon={ICONS.search}
                    title={t('mods.noShadersMatchTitle')}
                    description={t('mods.noShadersMatchText')}
                    actionText={t('common.clearSearch')}
                    onAction={() => setShaderSearch('')}
                  />
                );
              }
              return (
                <div className="installed-packs-grid">
                  {filtered.map(shader => (
                    <div key={shader.id || shader.fileName} className="installed-pack-card">
                      <div className="installed-pack-header">
                        <div className="installed-pack-icon">
                          {shader.iconUrl ? (
                            <img src={shader.iconUrl} alt={shader.name} className="installed-pack-img" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <Icon d={ICONS.sun} size={20} />
                          )}
                        </div>
                        <div className="installed-pack-meta">
                          <span className="installed-pack-title" title={shader.name}>{shader.name}</span>
                          <span className="installed-pack-file" title={shader.fileName}>{shader.fileName}</span>
                        </div>
                      </div>
                      {shader.description && (
                        <div className="installed-pack-desc" title={shader.description}>
                          {shader.description}
                        </div>
                      )}
                      <div className="installed-pack-footer">
                        <span className="installed-pack-size">
                          {shader.size ? formatFileSize(shader.size) : (shader.isDirectory ? 'Folder' : '')}
                        </span>
                        <div className="installed-pack-actions">
                          <button
                            className="mod-delete-btn"
                            onClick={() => handleDeleteShader(shader)}
                            title={t('mods.deleteShader')}
                          >
                            <Icon d={ICONS.trash} size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── TAB: TEXTURE PACKS (LIBRARY) ── */}
          <div
            className={`tab-panel ${isDragging ? 'dragging-over' : ''}`}
            style={{ display: activeTab === 'resourcepacks' ? 'flex' : 'none', position: 'relative' }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="dropzone-overlay">
                <div className="dropzone-content">
                  <Icon d={ICONS.download} size={36} />
                  <span className="dropzone-title">{t('mods.dropzone')}</span>
                  <span className="dropzone-sub">{t('mods.dropzoneSub')}</span>
                </div>
              </div>
            )}

            <div className="mods-toolbar">
              <div className="mods-search-box">
                <Icon d={ICONS.search} size={13} />
                <input
                  type="text"
                  className="mods-search-input"
                  placeholder={t('mods.searchResourcePacksPlaceholder')}
                  value={resourcePackSearch}
                  onChange={e => setResourcePackSearch(e.target.value)}
                />
                {resourcePackSearch && (
                  <button className="search-clear-btn" onClick={() => setResourcePackSearch('')}>
                    <Icon d={ICONS.x} size={11} />
                  </button>
                )}
              </div>

              {resourcePacks.length > 0 && (
                <span className="mods-count-badge">
                  {resourcePacks.length} {t('sidebar.resourcePacks')}
                </span>
              )}

              <div className="mods-toolbar-actions">
                <button className="btn-secondary" onClick={() => handleOpenContentFolder('resourcepacks')} title={t('mods.openResourcePacksFolder')}>
                  <Icon d={ICONS.folder} size={12} />
                  <span>{t('mods.openFolder')}</span>
                </button>
                <button className="btn-primary" onClick={() => handleAddContentClick('resourcepacks')} style={{ fontSize: 12, padding: '6px 14px' }}>
                  <Icon d={ICONS.plus} size={12} />
                  {t('mods.addResourcePack')}
                </button>
              </div>
            </div>

            {resourcePacks.length === 0 ? (
              <EmptyState
                icon={ICONS.layers}
                title={t('mods.emptyResourcePacksTitle')}
                description={t('mods.emptyResourcePacksText')}
                actionText={t('explore.browseResourcePacks')}
                actionIcon={ICONS.compass}
                onAction={() => {
                  setExploreType('resourcepacks');
                  setActiveTab('explore');
                }}
                secondaryText={t('mods.openResourcePacksFolder')}
                onSecondary={() => handleOpenContentFolder('resourcepacks')}
              />
            ) : (() => {
              const filtered = resourcePacks.filter(p =>
                String(p.name || '').toLowerCase().includes(resourcePackSearch.toLowerCase()) ||
                String(p.fileName || '').toLowerCase().includes(resourcePackSearch.toLowerCase())
              );
              if (filtered.length === 0) {
                return (
                  <EmptyState
                    icon={ICONS.search}
                    title={t('mods.noResourcePacksMatchTitle')}
                    description={t('mods.noResourcePacksMatchText')}
                    actionText={t('common.clearSearch')}
                    onAction={() => setResourcePackSearch('')}
                  />
                );
              }
              return (
                <div className="installed-packs-grid">
                  {filtered.map(pack => (
                    <div key={pack.id || pack.fileName} className="installed-pack-card">
                      <div className="installed-pack-header">
                        <div className="installed-pack-icon">
                          {pack.iconUrl ? (
                            <img src={pack.iconUrl} alt={pack.name} className="installed-pack-img" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <Icon d={ICONS.layers} size={20} />
                          )}
                        </div>
                        <div className="installed-pack-meta">
                          <span className="installed-pack-title" title={pack.name}>{pack.name}</span>
                          <span className="installed-pack-file" title={pack.fileName}>{pack.fileName}</span>
                        </div>
                      </div>
                      {pack.description && (
                        <div className="installed-pack-desc" title={pack.description}>
                          {pack.description}
                        </div>
                      )}
                      <div className="installed-pack-footer">
                        <span className="installed-pack-size">
                          {pack.size ? formatFileSize(pack.size) : (pack.isDirectory ? 'Folder' : '')}
                        </span>
                        <div className="installed-pack-actions">
                          <button
                            className="mod-delete-btn"
                            onClick={() => handleDeleteResourcePack(pack)}
                            title={t('mods.deleteResourcePack')}
                          >
                            <Icon d={ICONS.trash} size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* ── TAB: CONSOLE ── */}
          <div className="tab-panel" style={{ display: activeTab === 'console' ? 'flex' : 'none' }}>
            <div className="console-wrapper">
              <div className="console-header">
                <div className="console-title">
                  <div className={`console-indicator ${gameState === 'running' ? 'running' : ''}`} />
                  <span>{t('console.outputLog')}</span>
                  {gameState === 'running' && (
                    <span style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      • {t('console.runningWithPid', { pid: runPid })}
                    </span>
                  )}
                </div>
                <div className="console-actions">
                  <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.3)', padding: 2, borderRadius: 6 }}>
                    {['all', 'info', 'warn', 'error'].map(lvl => (
                      <button
                        key={lvl}
                        className={`tab-btn ${logFilter === lvl ? 'active' : ''}`}
                        style={{ fontSize: 10, padding: '2px 8px', textTransform: 'uppercase' }}
                        onClick={() => setLogFilter(lvl)}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  <button className="btn-secondary" onClick={() => setAutoScroll(prev => !prev)} title={t('console.autoScroll')} style={{ padding: '4px 8px' }}>
                    <Icon d={autoScroll ? ICONS.play : ICONS.stop} size={11} />
                  </button>
                  <button className="btn-secondary" onClick={handleCopyConsole} title={t('console.copy')} style={{ padding: '4px 8px' }}>
                    <Icon d={ICONS.copy} size={11} />
                  </button>
                  <button className="btn-secondary" onClick={handleClearConsole} title={t('console.clear')} style={{ padding: '4px 8px' }}>
                    <Icon d={ICONS.clear} size={11} />
                  </button>
                </div>
              </div>
              <div className="console-body" ref={consoleRef}>
                {logs.length === 0 ? (
                  <div className="console-empty-box">
                    <Icon d={ICONS.console} size={28} />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{t('console.noLogsYet')}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{t('console.noLogsYetSub')}</span>
                  </div>
                ) : (() => {
                  const filteredLogs = logs.filter(entry => {
                    if (logFilter === 'all') return true;
                    const entryLevel = String(entry.level || '').toLowerCase();
                    if (logFilter === 'warn') return entryLevel === 'warn' || String(entry.msg || '').includes('WARN');
                    if (logFilter === 'error') return entryLevel === 'error' || String(entry.msg || '').includes('ERROR');
                    if (logFilter === 'info') return entryLevel === 'info' && !String(entry.msg || '').includes('WARN') && !String(entry.msg || '').includes('ERROR');
                    return true;
                  });
                  if (filteredLogs.length === 0) {
                    return <span style={{ color: 'var(--text-faint)', padding: 12 }}>{t('console.noLogsWithFilter', { filter: logFilter })}</span>;
                  }
                  return filteredLogs.map((entry, i) => <LogLine key={i} entry={entry} />);
                })()}
              </div>
            </div>
          </div>

          {/* ── THE PLAY DECK (BOTTOM DOCK) ── */}
          <div className="play-deck">
            <div className="play-deck-controls">
              {/* Version capsule */}
              <div className="version-capsule">
                <select
                  className="version-select"
                  value={selectedInstalledVersionId}
                  onChange={e => {
                    if (gameState === 'running') return;
                    const newVer = e.target.value;
                    if (!activeProfileId) return;
                    setProfiles(prev => {
                      const nextProfiles = prev.map(p =>
                        p.id === activeProfileId ? { ...p, version: newVer } : p
                      );
                      persistState({ profiles: nextProfiles });
                      return nextProfiles;
                    });
                  }}
                  disabled={gameState === 'running'}
                >
                  {installedVersions.length > 0 ? (
                    installedVersions.map(v => (
                      <option key={v.id} value={v.id}>{formatVersionLabel(v)}</option>
                    ))
                  ) : (
                    <option value="">{t('profile.noVersionsInstalled')}</option>
                  )}
                </select>
                <span className={`loader-badge ${loaderBadgeClass}`}>
                  {loaderBadgeLabel}
                </span>
              </div>

              {/* RAM meter */}
              <div className="ram-pill">
                <span>{activeProfile?.ram || 4} GB</span>
                <div className="ram-gauge">
                  <div
                    className="ram-gauge-fill"
                    style={{
                      width: `${Math.min(100, ((activeProfile?.ram || 4) / (systemTotalRam || Math.max(activeProfile?.ram || 4, 4))) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Play Button Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {installId && (
                <button className="btn-secondary" onClick={handleCancelInstall}>
                  {t('game.cancelInstall')}
                </button>
              )}
              <button
                className={`hero-play-btn ${gameState === 'loading' || authRefreshing ? 'loading' : gameState === 'running' ? 'running' : ''}`}
                onClick={() => {
                  if (installedVersions.length === 0 && !activeProfile?.version) {
                    setModal('install');
                    return;
                  }
                  handlePlay();
                }}
                disabled={gameState === 'loading' || authRefreshing}
              >
                {gameState === 'loading' || authRefreshing ? (
                  <>
                    <span className="spinning"><Icon d={ICONS.spinner} size={16} /></span>
                    <span>{authRefreshing ? t('game.authenticating') : t('game.loading')}</span>
                  </>
                ) : gameState === 'running' ? (
                  <>
                    <Icon d={ICONS.stop} size={16} />
                    <span>{t('game.stop')}</span>
                  </>
                ) : (
                  <>
                    <Icon d={ICONS.play} size={16} />
                    <span>{t('game.play')}</span>
                  </>
                )}
                {gameState === 'loading' && (
                  <div className="progress-capsule">
                    <div className="progress-capsule-fill" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* ── MODALS ── */}
      {profileEditor && (
        <ProfileModal
          mode={profileEditor.mode}
          profile={profileToEdit}
          versions={installedVersions}
          systemTotalRam={systemTotalRam}
          onClose={() => setProfileEditor(null)}
          onSave={handleSaveProfile}
        />
      )}
      {modal === 'install' && (
        <InstallModal
          initialType="minecraft"
          installTargets={installTargets}
          showSnapshots={settings.showSnapshots}
          onToggleSnapshots={(val) => handleSettingChange('showSnapshots', val)}
          onClose={() => setModal(null)}
          onInstall={handleInstall}
          onCatalogLoaded={(catalog) => {
            if (catalog?.versions) setVersionCatalog(catalog.versions);
            if (catalog?.installTargets) setInstallTargets(catalog.installTargets);
          }}
        />
      )}
      {modal === 'settings' && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingChange}
          onClose={() => setModal(null)}
          onCheckUpdates={handleCheckForUpdates}
          onOpenAbout={() => setModal('about')}
          onOpenMinecraftDirectory={handleOpenMinecraftDirectory}
          onOpenSourceCode={handleOpenSourceCode}
          onOpenReleases={handleOpenReleases}
          language={language}
          onLanguageChange={setLanguage}
          appVersion={appVersion}
        />
      )}
      {modal === 'about' && (
        <AboutModal
          appVersion={appVersion}
          language={language}
          onClose={() => setModal(null)}
          onOpenSourceCode={handleOpenSourceCode}
          onOpenReleases={handleOpenReleases}
          onCheckUpdates={handleCheckForUpdates}
        />
      )}
      {modConflict && (
        <ModConflictModal
          conflict={modConflict}
          mods={mods}
          onClose={() => setModConflict(null)}
          onResolveUpdate={handleResolveConflictUpdate}
          onAutoFixAll={handleAutoFixAllConflicts}
          fixingAll={fixingAllConflicts}
          onOpenModsFolder={handleOpenMinecraftDirectory}
        />
      )}
      {selectedModDetail && (
        <ModDetailModal
          project={selectedModDetail.project}
          initialTab={selectedModDetail.initialTab || 'overview'}
          currentLoader={currentLoader}
          currentMcVer={currentMcVer}
          mods={selectedModDetail?.project?.project_type === 'shader' || exploreType === 'shaders' ? shaders : selectedModDetail?.project?.project_type === 'resourcepack' || exploreType === 'resourcepacks' ? resourcePacks : mods}
          installingVersionId={installingVersionId}
          onClose={() => setSelectedModDetail(null)}
          onInstallVersion={handleInstallSpecificVersion}
        />
      )}
      {loginLoading && (
        <LoginLoadingModal
          onCancel={() => {
            if (loginAbortControllerRef.current) {
              loginAbortControllerRef.current.abort();
            }
            setLoginLoading(false);
            addLog('info', 'Login cancelled by user');
          }}
        />
      )}
    </>
  );
}

// Microsoft official 4-color square logo SVG
