const config = require("./src/config");
const app = require("./src/app");

app.listen(config.port, () => {
    console.log(`KenyaStays backend running on port ${config.port} (${config.nodeEnv})`);
});
