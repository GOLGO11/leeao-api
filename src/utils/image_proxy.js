const RAILWAY_URL = (process.env.RAILWAY_STATIC_URL ||
  'https://leeao-api-production.up.railway.app').replace(/\/$/, '');

const ALLOWED_IMAGE_HOSTS = [
  'qpic.cn',
  'douyinpic.com',
  'douyinvod.com',
  'hdslb.com',
  'bilibili.com',
];

function isAllowedImageHost(hostname) {
  const normalized = hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

function isLocalImageUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.origin === new URL(RAILWAY_URL).origin &&
      parsed.pathname.startsWith('/upload/');
  } catch (_) {
    return false;
  }
}

function toProxiedImageUrl(value) {
  if (!value || typeof value !== 'string' || isLocalImageUrl(value)) {
    return value || '';
  }

  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) ||
        !isAllowedImageHost(parsed.hostname)) {
      return value;
    }
    return `${RAILWAY_URL}/upload/external?url=${encodeURIComponent(value)}`;
  } catch (_) {
    return value;
  }
}

function isAllowedExternalImageUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) &&
      isAllowedImageHost(parsed.hostname);
  } catch (_) {
    return false;
  }
}

module.exports = {
  isAllowedExternalImageUrl,
  toProxiedImageUrl,
};
