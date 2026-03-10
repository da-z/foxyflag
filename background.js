const HOST_CACHE = new Map();
const ICON_CACHE = new Map();
const REQUEST_TIMEOUT_MS = 5000;

const INTERNAL_PROTOCOLS = new Set([
  "about:",
  "moz-extension:",
  "file:",
  "data:",
  "chrome:"
]);

browser.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0) {
    return;
  }

  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    hidePageAction(tabId);
    return;
  }

  try {
    const geo = await getGeoForHostname(parsedUrl.hostname);
    await showGeoPageAction(tabId, geo);
  } catch (error) {
    console.error("FoxyFlag navigation handling failed", { url, error });
    await showFallbackPageAction(tabId);
  }
});

function parseUrl(url) {
  try {
    const parsed = new URL(url);
    if (INTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }

    if (!parsed.hostname) {
      return null;
    }

    return parsed;
  } catch (error) {
    return null;
  }
}

async function getGeoForHostname(hostname) {
  const cached = HOST_CACHE.get(hostname);
  if (cached) {
    return cached;
  }

  const dnsResult = await browser.dns.resolve(hostname, ["disable_ipv6"]);
  const ip = pickResolvableIp(dnsResult);
  if (!ip || isNonRoutableIp(ip)) {
    const fallback = {
      country: "Unknown country",
      countryCode: null,
      ip: ip || "Unknown IP",
      isFallback: true
    };
    HOST_CACHE.set(hostname, fallback);
    return fallback;
  }

  const geo = await fetchGeo(ip);
  const value = {
    country: geo.country,
    countryCode: geo.countryCode,
    ip,
    isFallback: !geo.countryCode
  };
  HOST_CACHE.set(hostname, value);
  return value;
}

function pickResolvableIp(dnsResult) {
  if (!dnsResult) {
    return null;
  }

  if (dnsResult.addresses && dnsResult.addresses.length > 0) {
    return dnsResult.addresses[0];
  }

  if (dnsResult.canonicalName && isIpAddress(dnsResult.canonicalName)) {
    return dnsResult.canonicalName;
  }

  if (dnsResult.address && typeof dnsResult.address === "string") {
    return dnsResult.address;
  }

  return null;
}

async function fetchGeo(ip) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode,country,status`, {
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Geo lookup failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (payload.status !== "success" || !payload.countryCode || !payload.country) {
      return {
        country: "Unknown country",
        countryCode: null
      };
    }

    return {
      country: payload.country,
      countryCode: payload.countryCode
    };
  } catch (error) {
    console.warn("FoxyFlag GeoIP lookup failed", { ip, error });
    return {
      country: "Unknown country",
      countryCode: null
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function showGeoPageAction(tabId, geo) {
  const title = geo.isFallback
    ? "Unknown country"
    : `${geo.country} (${geo.ip})`;

  const icon = geo.countryCode
    ? await getFlagIconData(geo.countryCode)
    : {
        16: browser.runtime.getURL("icons/globe-16.png"),
        32: browser.runtime.getURL("icons/globe-32.png")
      };

  await browser.pageAction.setTitle({ tabId, title });
  if (geo.countryCode) {
    await browser.pageAction.setIcon({ tabId, imageData: icon });
  } else {
    await browser.pageAction.setIcon({ tabId, path: icon });
  }
  await browser.pageAction.show(tabId);
}

async function showFallbackPageAction(tabId) {
  await browser.pageAction.setTitle({ tabId, title: "Unknown country" });
  await browser.pageAction.setIcon({
    tabId,
    path: {
      16: browser.runtime.getURL("icons/globe-16.png"),
      32: browser.runtime.getURL("icons/globe-32.png")
    }
  });
  await browser.pageAction.show(tabId);
}

function hidePageAction(tabId) {
  browser.pageAction.hide(tabId).catch(() => {});
}

async function getFlagIconData(countryCode) {
  const normalized = countryCode.toUpperCase();
  const cached = ICON_CACHE.get(normalized);
  if (cached) {
    return cached;
  }

  const emoji = toFlagEmoji(normalized);
  const icon = {
    16: await renderFlagImageData(emoji, 16),
    32: await renderFlagImageData(emoji, 32)
  };

  ICON_CACHE.set(normalized, icon);
  return icon;
}

function toFlagEmoji(countryCode) {
  return [...countryCode]
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

async function renderFlagImageData(emoji, size) {
  if (typeof OffscreenCanvas !== "undefined") {
    return renderWithOffscreenCanvas(emoji, size);
  }

  return renderWithDocumentCanvas(emoji, size);
}

function renderWithOffscreenCanvas(emoji, size) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  drawEmojiFlag(context, emoji, size);
  return context.getImageData(0, 0, size, size);
}

function renderWithDocumentCanvas(emoji, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  drawEmojiFlag(context, emoji, size);
  return context.getImageData(0, 0, size, size);
}

function drawEmojiFlag(context, emoji, size) {
  context.clearRect(0, 0, size, size);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${Math.floor(size * 0.9)}px serif`;
  context.fillText(emoji, size / 2, size / 2 + size * 0.04);
}

function isIpAddress(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) || value.includes(":");
}

function isNonRoutableIp(ip) {
  if (ip.includes(":")) {
    return ip === "::1" || ip.toLowerCase().startsWith("fe80:") || ip.toLowerCase().startsWith("fc") || ip.toLowerCase().startsWith("fd");
  }

  const [a, b] = ip.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  return false;
}
