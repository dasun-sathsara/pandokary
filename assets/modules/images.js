PDY.ImageModule = (() => {
  const { clamp } = PDY;
  const { ICONS, createButton, requestFrame, updateScrollLock } = PDY.UIComponentFactory;
  const UIComponentFactory = PDY.UIComponentFactory;

  function openLightbox(image) {
    const backdrop = document.createElement("div");
    backdrop.className = "lightbox-backdrop";
    const zoomed = image.cloneNode();
    zoomed.className = "lightbox-img";
    zoomed.removeAttribute("id");
    zoomed.removeAttribute("tabindex");
    zoomed.removeAttribute("role");
    zoomed.loading = "eager";
    const close = createButton("lightbox-close", ICONS.x, "Close image");
    backdrop.append(close, zoomed);
    document.body.append(backdrop);
    UIComponentFactory.focusDialog(backdrop, image.alt || "Image viewer");
    requestFrame(() => {
      backdrop.classList.add("active");
      updateScrollLock();
    });

    let scale = 1;
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let initialDistance = 0;
    let initialScale = 1;
    let lastTap = 0;
    let pinching = false;

    const draw = (transition = false) => {
      zoomed.style.transition = transition ? "transform var(--dur-ui) var(--ease-out)" : "none";
      zoomed.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    };
    const toggleZoom = (clientX, clientY) => {
      if (scale > 1.5) {
        scale = 1;
        x = 0;
        y = 0;
      } else {
        scale = 2.5;
        const rect = zoomed.getBoundingClientRect();
        x = -(clientX - rect.left - rect.width / 2) * 1.5;
        y = -(clientY - rect.top - rect.height / 2) * 1.5;
      }
      draw(true);
    };
    const stopMouseDrag = () => {
      dragging = false;
    };
    const moveMouse = (event) => {
      if (!dragging) return;
      x = event.clientX - startX;
      y = event.clientY - startY;
      draw();
    };
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      UIComponentFactory.releaseDialog(backdrop);
      backdrop.classList.remove("active");
      window.removeEventListener("mousemove", moveMouse);
      window.removeEventListener("mouseup", stopMouseDrag);
      window.setTimeout(() => {
        backdrop.remove();
        updateScrollLock();
      }, 300);
    };

    backdrop.addEventListener("click", dismiss);
    backdrop.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      dismiss();
    });
    zoomed.addEventListener("click", (event) => event.stopPropagation());
    zoomed.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      toggleZoom(event.clientX, event.clientY);
    });
    zoomed.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      startX = event.clientX - x;
      startY = event.clientY - y;
    });
    window.addEventListener("mousemove", moveMouse);
    window.addEventListener("mouseup", stopMouseDrag);
    zoomed.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        scale = clamp(scale * Math.exp(-event.deltaY * 0.001), 0.8, 5);
        draw();
      },
      { passive: false },
    );
    zoomed.addEventListener(
      "touchstart",
      (event) => {
        event.stopPropagation();
        if (event.touches.length === 1) {
          pinching = false;
          dragging = true;
          startX = event.touches[0].clientX - x;
          startY = event.touches[0].clientY - y;
        } else if (event.touches.length === 2) {
          pinching = true;
          dragging = false;
          initialDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
          initialScale = scale;
        }
      },
      { passive: true },
    );
    zoomed.addEventListener(
      "touchmove",
      (event) => {
        event.stopPropagation();
        if (dragging && event.touches.length === 1) {
          x = event.touches[0].clientX - startX;
          y = event.touches[0].clientY - startY;
          draw();
        } else if (event.touches.length === 2 && initialDistance > 0) {
          pinching = true;
          const distance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
          scale = clamp(initialScale * (distance / initialDistance), 0.8, 5);
          draw();
        }
      },
      { passive: true },
    );
    zoomed.addEventListener(
      "touchend",
      (event) => {
        dragging = false;
        if (!pinching && event.changedTouches.length === 1) {
          const now = Date.now();
          if (now - lastTap < 300) {
            const touch = event.changedTouches[0];
            toggleZoom(touch.clientX, touch.clientY);
            lastTap = 0;
          } else {
            lastTap = now;
          }
        }
        if (event.touches.length === 0) pinching = false;
        if (scale < 1) {
          scale = 1;
          x = 0;
          y = 0;
          draw(true);
        }
      },
      { passive: true },
    );
  }

  function handleImageError(image) {
    const fallback = document.createElement("div");
    fallback.className = "image-fallback-card";
    fallback.setAttribute("role", "img");
    const label = image.alt || image.src.split("/").pop() || "Image unavailable";
    fallback.setAttribute("aria-label", label);
    const icon = document.createElement("span");
    icon.className = "image-fallback-icon";
    icon.innerHTML = ICONS.image;
    const text = document.createElement("span");
    text.className = "image-fallback-text";
    text.textContent = label;
    fallback.append(icon, text);
    image.replaceWith(fallback);
  }

  function initLightbox() {
    document.querySelectorAll("main img").forEach((image) => {
      if (image.closest(".mermaid-container,a,button")) return;
      if (image.complete && image.naturalWidth === 0 && image.src) {
        handleImageError(image);
        return;
      }
      image.addEventListener("error", () => handleImageError(image), { once: true });
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Enlarge image${image.alt ? `: ${image.alt}` : ""}`);
      image.decoding = "async";
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(image);
        }
      });
      image.style.cursor = "zoom-in";
      image.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openLightbox(image);
      });
    });
  }

  return { init: initLightbox };
})();
