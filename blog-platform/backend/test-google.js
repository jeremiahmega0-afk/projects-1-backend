const https = require("https");

https.get(
  "https://www.googleapis.com/oauth2/v1/certs",
  (res) => {
    console.log("Status:", res.statusCode);

    res.on("data", () => {});
    res.on("end", () => {
      console.log("Google connection successful");
    });
  }
).on("error", (error) => {
  console.error("Connection failed:", error);
});