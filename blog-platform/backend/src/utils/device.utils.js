
const getDeviceInfo = (req) => {
  const userAgent = req.headers["user-agent"] || "";

  let browser = "Unknown browser";
  let device = "Unknown device";

  // Detect browser or API client
  if (userAgent.includes("Edg/")) {
    browser = "Microsoft Edge";
  } else if (userAgent.includes("Chrome/")) {
    browser = "Google Chrome";
  } else if (userAgent.includes("Firefox/")) {
    browser = "Mozilla Firefox";
  } else if (userAgent.includes("Safari/")) {
    browser = "Safari";
  } else if (userAgent.includes("PostmanRuntime")) {
    browser = "Postman API client";
  } else if (userAgent.toLowerCase().includes("curl")) {
    browser = "cURL";
  } else if (userAgent.includes("axios")) {
    browser = "Axios API client";
  }

  // Detect operating system or client device
  if (userAgent.includes("Windows")) {
    device = "Windows PC";
  } else if (userAgent.includes("Android")) {
    device = "Android device";
  } else if (userAgent.includes("iPhone")) {
    device = "iPhone";
  } else if (userAgent.includes("iPad")) {
    device = "iPad";
  } else if (userAgent.includes("Macintosh")) {
    device = "Mac";
  } else if (userAgent.includes("Linux")) {
    device = "Linux device";
  } else if (userAgent.includes("PostmanRuntime")) {
    device = "API testing client";
  }

  const ipAddress =
    req.ip ||
    req.socket?.remoteAddress ||
    "Unknown";

  return {
    device,
    browser,
    ipAddress,
  };
};

module.exports = {
  getDeviceInfo,
};

