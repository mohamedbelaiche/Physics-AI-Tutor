(function () {
  var supabase = null;
  var currentUser = null;
  var currentProfile = null;
  var isReady = false;
  var readyListeners = [];

  function getSupabaseUrl() {
    var cfg = window.__SUPABASE_CONFIG__ || {};
    return cfg.url || '';
  }

  function getSupabaseAnonKey() {
    var cfg = window.__SUPABASE_CONFIG__ || {};
    return cfg.anonKey || '';
  }

  function fetchConfig() {
    return fetch('/api/config')
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        window.__SUPABASE_CONFIG__ = window.__SUPABASE_CONFIG__ || {};
        window.__SUPABASE_CONFIG__.url = data.url;
        window.__SUPABASE_CONFIG__.anonKey = data.anonKey;
        return data;
      });
  }

  function initSupabase(url, anonKey) {
    if (!window.supabase) throw new Error('supabase-js غير محمّل');
    supabase = window.supabase.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
  }

  function notifyReady() {
    isReady = true;
    readyListeners.forEach(function (fn) { fn(); });
    readyListeners = [];
  }

  function onReady(cb) {
    if (isReady) {
      cb();
      return;
    }
    readyListeners.push(cb);
  }

  function onAuth(cb) {
    onReady(function () {
      supabase.auth.onAuthStateChange(function (event, session) {
        currentUser = session ? session.user : null;
        if (currentUser) {
          loadProfile().then(cb, cb);
        } else {
          currentProfile = null;
          cb();
        }
      });
    });
  }

  function loadProfile() {
    if (!supabase || !currentUser) return Promise.resolve(null);
    return supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle()
      .then(function (result) {
        if (result.error) throw result.error;
        currentProfile = result.data;
        return currentProfile;
      });
  }

  function signUpWithEmail(email, password, fullName) {
    if (!supabase) return Promise.reject(new Error('Supabase غير مهيأ'));
    return supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: fullName || '' }
      }
    });
  }

  function signInWithEmail(email, password) {
    if (!supabase) return Promise.reject(new Error('Supabase غير مهيأ'));
    return supabase.auth.signInWithPassword({ email: email, password: password });
  }

  function signInWithGoogle() {
    if (!supabase) return Promise.reject(new Error('Supabase غير مهيأ'));
    var redirectTo = window.location.origin + '/';
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo
      }
    });
  }

  function signOut() {
    if (!supabase) return Promise.resolve();
    return supabase.auth.signOut().then(function () {
      currentUser = null;
      currentProfile = null;
    });
  }

  function updateProfile(updates) {
    if (!supabase || !currentUser) return Promise.reject(new Error('غير مسجل دخول'));
    return supabase
      .from('profiles')
      .update(updates)
      .eq('id', currentUser.id)
      .select()
      .maybeSingle()
      .then(function (result) {
        if (result.error) throw result.error;
        currentProfile = result.data;
        return result.data;
      });
  }

  function getSession() {
    if (!supabase) return Promise.resolve(null);
    return supabase.auth.getSession().then(function (res) {
      return res.data.session;
    });
  }

  function getUser() {
    return currentUser;
  }

  function getProfile() {
    return currentProfile;
  }

  // Ensure config is fetched and client is created before anything else.
  function bootstrap() {
    return fetchConfig()
      .catch(function (err) {
        // Fall back to the static (publishable) config embedded in supabase-config.js
        var fallback = window.__SUPABASE_CONFIG__ || {};
        if (fallback.url && fallback.anonKey) {
          console.warn('/api/config فشل، استخدام التكوين المضمّن:', err && err.message);
          return { url: fallback.url, anonKey: fallback.anonKey };
        }
        throw err;
      })
      .then(function (cfg) {
        initSupabase(cfg.url, cfg.anonKey);

        // Restore session from storage if any
        return getSession().then(function (session) {
          if (session && session.user) {
            currentUser = session.user;
            return loadProfile().catch(function () {
              currentProfile = null;
            });
          }
          return null;
        });
      });
  }

  // Call bootstrap once (when this script loads).
  bootstrap()
    .then(function () {
      notifyReady();
    })
    .catch(function (err) {
      console.error('Supabase bootstrap failed:', err.message);
      notifyReady();
    });

  window.AppAuth = {
    onReady: onReady,
    onAuth: onAuth,
    getUser: getUser,
    getProfile: getProfile,
    getSession: getSession,
    signUpWithEmail: signUpWithEmail,
    signInWithEmail: signInWithEmail,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    updateProfile: updateProfile,
    loadProfile: loadProfile,
    getClient: function () { return supabase; }
  };
})();