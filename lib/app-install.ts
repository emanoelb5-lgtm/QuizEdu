export type AppInstallStatus = "waiting" | "manual" | "ready" | "prompting" | "dismissed" | "error" | "installed";
export type AppInstallState = {status:AppInstallStatus;ios:boolean};
export type AppInstaller = {
  getState: () => AppInstallState;
  subscribe: (listener: () => void) => () => void;
  install: () => Promise<"accepted" | "dismissed" | "error" | "unavailable">;
};
declare global {interface Window {__quizEduInstall?:AppInstaller;}}

// Runs in the document head, before hydration, so an early browser event is
// retained for the student's later click. The prompt itself must stay inside
// that click: waiting for another event or request loses user activation.
export const INSTALL_BOOTSTRAP = String.raw`(() => {
  if (window.__quizEduInstall) return;
  const media = window.matchMedia("(display-mode: standalone)");
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const supported = "onbeforeinstallprompt" in window || typeof window.BeforeInstallPromptEvent === "function";
  let state = {status:media.matches || navigator.standalone ? "installed" : supported && !ios ? "waiting" : "manual",ios};
  let deferred = null;
  const listeners = new Set();
  const update = status => {
    if (state.status === status) return;
    state = {status,ios};
    listeners.forEach(listener => listener());
  };
  const complete = () => {deferred = null;update("installed");};
  window.addEventListener("beforeinstallprompt", event => {
    if (typeof event.prompt !== "function") return;
    event.preventDefault();
    if (state.status === "installed" || state.status === "prompting") return;
    deferred = event;
    update("ready");
  });
  window.addEventListener("appinstalled",complete);
  media.addEventListener?.("change",() => {if (media.matches || navigator.standalone) complete();});
  window.__quizEduInstall = {
    getState: () => state,
    subscribe: listener => {listeners.add(listener);return () => listeners.delete(listener);},
    install: () => {
      if (!deferred || state.status !== "ready") return Promise.resolve("unavailable");
      const event = deferred;
      deferred = null;
      update("prompting");
      const fail = () => {if (state.status !== "installed") update("error");return "error";};
      try {
        // No await, timeout or fetch before this call: preserve the click.
        return Promise.resolve(event.prompt())
          .then(result => result && result.outcome ? result : event.userChoice)
          .then(result => {
            if (result?.outcome !== "accepted" && result?.outcome !== "dismissed") return fail();
            if (state.status !== "installed") update(result.outcome === "accepted" ? "installed" : "dismissed");
            return result.outcome;
          }).catch(fail);
      } catch {return Promise.resolve(fail());}
    }
  };
})();`;
