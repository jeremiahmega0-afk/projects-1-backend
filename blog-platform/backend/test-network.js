const https = require("https");

https.get("https://example.com", (res) => {
    console.log("Connection successful!");
    console.log("Status:", res.statusCode);
}).on("error", (err) => {
    console.log("Connection failed:", err.code);
});