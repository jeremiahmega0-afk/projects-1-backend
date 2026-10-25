
require("dotenv").config();

const cloudinary = require("./src/config/cloudinary");

async function testCloudinary() {
  try {
    const result = await cloudinary.api.ping();

    console.log("Cloudinary connection successful!");
    console.log("Status:", result.status);
  } catch (error) {
    console.error("Cloudinary connection failed.");
    console.error("Message:", error.message);
  }
}

testCloudinary();
