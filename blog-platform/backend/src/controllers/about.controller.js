const getAboutInfo = async (req, res) => {
    res.status(200).json({
        success: true,
        message: "AI Blog API is running",
    });
}
module.exports = {
    getAboutInfo,
};