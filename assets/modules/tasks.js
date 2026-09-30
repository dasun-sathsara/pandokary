PDY.TaskListModule = (() => {
  function initMarkdownTasks() {
    document.querySelectorAll('main li input[type="checkbox"]').forEach((checkbox) => {
      const item = checkbox.closest("li");
      item.classList.add("task-item");
      checkbox.removeAttribute("disabled");
      checkbox.setAttribute("aria-label", item.textContent.trim());
      const label = checkbox.closest("label");
      if (label && !label.querySelector(".task-text")) {
        const span = document.createElement("span");
        span.className = "task-text";
        const nodes = [...label.childNodes].filter((n) => n !== checkbox);
        span.append(...nodes);
        label.append(span);
      }
      const updateState = () => item.classList.toggle("task-completed", checkbox.checked);
      updateState();
      checkbox.addEventListener("change", updateState);
    });
    document.querySelectorAll("main ul").forEach((list) => {
      if ([...list.children].every((item) => item.classList.contains("task-item")))
        list.classList.add("task-list");
    });
  }

  function initInlineTasks() {
    document.querySelectorAll("main p, main li").forEach((element) => {
      if (element.closest("pre,code,.task-item,.inline-task-item")) return;
      const first = element.firstChild;
      if (first?.nodeType !== Node.TEXT_NODE) return;
      const match = first.textContent.match(/^\s*\[([ x])\]\s+/i);
      if (!match) return;
      first.textContent = first.textContent.slice(match[0].length);
      const label = document.createElement("label");
      label.className = "inline-task-item";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "inline-task-checkbox";
      checkbox.checked = match[1].toLowerCase() === "x";
      const text = document.createElement("span");
      text.append(...element.childNodes);
      label.append(checkbox, text);
      element.append(label);
      const update = () => label.classList.toggle("task-completed", checkbox.checked);
      checkbox.addEventListener("change", update);
      update();
    });
  }

  function init() {
    initMarkdownTasks();
    initInlineTasks();
  }

  return { init };
})();
