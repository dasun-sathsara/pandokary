PDY.ReaderExtrasModule = (() => {
  const {
    UIComponentFactory,
    StorageManager,
    TOCModule,
    ImageModule,
    ShortcutsModule,
    isCompactLayout,
    clamp,
    scheduleFrame,
    debounce,
    eventElement,
    fragmentTarget,
    runFeature,
    requestFrame,
  } = PDY;
  const { ICONS, copyText } = UIComponentFactory;

  function initFloatingButtonAutoHide(settings) {
    const settingsToggle = settings?.toggle || document.querySelector(".settings-toggle");
    const settingsPanel = settings?.panel || document.querySelector(".settings-popover");
    let lastScrollTop = 0;
    // Only a keyboard-visible focus pins a button on screen. Mouse/touch
    // activation parks DOM focus on the toggle without ever matching
    // :focus-visible — that stale focus must not pin it, nor should hiding
    // strand focus on an invisible control.
    function focusPinned(element) {
      return (
        Boolean(element) && document.activeElement === element && element.matches(":focus-visible")
      );
    }
    const update = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const viewportHeight = document.documentElement.clientHeight;
      if (
        scrollTop < 0 ||
        scrollTop + viewportHeight > documentHeight ||
        Math.abs(scrollTop - lastScrollTop) < 10
      ) {
        return;
      }
      const hide = scrollTop > lastScrollTop && scrollTop > 150;
      const compactLayout = isCompactLayout();
      const updateToggle = (toggle, blocked) => {
        const hideIt = compactLayout && hide && !focusPinned(toggle) && !blocked;
        if (hideIt && document.activeElement === toggle) toggle.blur();
        toggle?.classList.toggle("hidden", hideIt);
      };
      updateToggle(settingsToggle, settingsPanel?.classList.contains("active"));
      updateToggle(
        document.querySelector(".toc-toggle"),
        document.documentElement.classList.contains("toc-open"),
      );
      lastScrollTop = scrollTop;
    };
    window.addEventListener("scroll", scheduleFrame(update), { passive: true });
    window.addEventListener(
      "resize",
      debounce(() => {
        if (!isCompactLayout()) {
          settingsToggle?.classList.remove("hidden");
          document.querySelector(".toc-toggle")?.classList.remove("hidden");
        }
      }, 100),
      { passive: true },
    );
  }

  function initMathJaxInteractionGuard() {
    const guard = (event) => {
      const target = eventElement(event);
      if (target?.closest(".mjx-svg, mjx-container, .MathJax")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", guard);
    document.addEventListener("contextmenu", guard);
  }

  function initReadingProgress() {
    const bar = document.createElement("div");
    bar.className = "reading-progress";
    document.body.append(bar);
    let maxScroll = 1;
    const measure = () => {
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    };
    const update = () => {
      const progress = clamp(window.scrollY / maxScroll, 0, 1);
      bar.style.transform = `scaleX(${progress})`;
    };
    measure();
    window.addEventListener("scroll", scheduleFrame(update), { passive: true });
    window.addEventListener(
      "resize",
      debounce(() => {
        measure();
        update();
      }, 100),
      { passive: true },
    );
    if (window.ResizeObserver)
      new ResizeObserver(() => {
        measure();
        update();
      }).observe(document.body);
    update();
  }

  function initHeadingLinks() {
    document.querySelectorAll("main h2,main h3,main h4,main h5").forEach((heading) => {
      if (heading.querySelector(".heading-anchor")) return;
      TOCModule.ensureHeadingID(heading);
      heading.classList.add("heading-with-anchor");
      const anchor = document.createElement("a");
      anchor.className = "heading-anchor";
      anchor.href = `#${encodeURIComponent(heading.id)}`;
      anchor.innerHTML = ICONS.link;
      anchor.title = "Copy link to this section";
      anchor.setAttribute("aria-label", `Link to ${heading.textContent}`);
      let feedbackTimer;
      anchor.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          window.history.pushState(null, "", anchor.hash);
        } catch (error) {
          console.warn("Could not update section URL", error);
        }
        try {
          await copyText(window.location.href);
          window.clearTimeout(feedbackTimer);
          anchor.innerHTML = ICONS.check;
          anchor.classList.add("copied");
          feedbackTimer = window.setTimeout(() => {
            anchor.innerHTML = ICONS.link;
            anchor.classList.remove("copied");
          }, 1500);
        } catch (error) {
          console.error("Copy link failed", error);
        }
      });
      heading.append(anchor);
    });
  }

  function restoreLocation() {
    if (window.location.hash) {
      fragmentTarget(window.location.hash)?.scrollIntoView({ block: "start", behavior: "instant" });
      return;
    }
    const saved = StorageManager.getScrollPosition();
    if (saved) window.scrollTo(0, saved);
  }

  let loadingFinished = false;
  let readerInteracted = false;
  let restorationController;

  function revealDocument() {
    const overlay = document.getElementById("loading-overlay");
    if (!overlay || overlay.classList.contains("fade-out")) return;
    overlay.classList.add("fade-out");
    window.setTimeout(() => overlay.remove(), 200);
  }

  function finishLoading() {
    if (loadingFinished) return;
    loadingFinished = true;
    revealDocument();
    requestFrame(() => {
      // Diagram sizing can move deep links. Restore once layout is ready,
      // unless the reader has already started navigating.
      if (!readerInteracted) restoreLocation();
      StorageManager.enableScrollListener();
      restorationController?.abort();
    });
  }

  function init(settings) {
    restorationController = new AbortController();
    for (const type of ["pointerdown", "wheel", "touchstart", "keydown"]) {
      document.addEventListener(
        type,
        () => {
          readerInteracted = true;
        },
        {
          once: true,
          passive: true,
          signal: restorationController.signal,
        },
      );
    }
    runFeature("Floating button auto-hide", () => initFloatingButtonAutoHide(settings));
    runFeature("MathJax interaction guard", initMathJaxInteractionGuard);
    runFeature("Reading progress", initReadingProgress);
    runFeature("Image lightbox", () => ImageModule.init());
    runFeature("Heading links", initHeadingLinks);
    runFeature("Keyboard shortcuts", () => ShortcutsModule.init());
  }

  return { init, initLightbox: ImageModule.init, revealDocument, finishLoading };
})();
