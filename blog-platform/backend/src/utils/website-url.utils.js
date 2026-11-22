const getServerUrl = () => {
  return process.env.SERVER_URL || "http://localhost:5000";
};

const getClientUrl = () => {
  return process.env.CLIENT_URL || "http://localhost:5173";
};

module.exports = {
  getServerUrl,
  getClientUrl,
};