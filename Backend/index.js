const express = require("express");
const cors = require("cors");
const path = require("path");
const apiApp = require("./server.js");

const app = express();
const port = process.env.PORT || 3000;
const projectRoot = path.resolve(__dirname, "..");

app.use(cors());
app.use(express.json());
app.use(express.static(projectRoot));
app.use(apiApp);

app.get("/api/counties", (_request, response) => {
  response.sendFile(path.join(projectRoot, "counties.json"));
});

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/admin", (_request, response) => {
  response.sendFile(path.join(projectRoot, "index.html"));
});

app.get("/{*splat}", (_request, response) => {
  response.sendFile(path.join(projectRoot, "index.html"));
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`KenyaStays is running at http://localhost:${port}`);
  });
}

module.exports = app;