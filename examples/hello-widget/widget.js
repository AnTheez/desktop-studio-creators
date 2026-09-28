const title = document.querySelector("#title");

addEventListener("message", (event) => {
  if (event.source !== parent) return;
  if (event.data?.source !== "desktop-studio") return;
  if (event.data?.type !== "lifecycle") return;

  const properties = event.data.properties ?? {};

  if (typeof properties.title === "string") {
    title.textContent = properties.title.slice(0, 120);
  }

  if (/^#[0-9a-f]{6}$/i.test(properties.accent)) {
    document.documentElement.style.setProperty("--accent", properties.accent);
  }

  const radius = Number(properties.cornerRadius);
  if (Number.isFinite(radius)) {
    const boundedRadius = Math.max(0, Math.min(60, radius));
    document.documentElement.style.setProperty("--radius", `${boundedRadius}px`);
  }
});

