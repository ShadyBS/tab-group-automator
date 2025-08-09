// scripts/package/package-build.js
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

function zipDir(source, out) {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = fs.createWriteStream(out);

  return new Promise((resolve, reject) => {
    archive
      .directory(source, false)
      .on("error", (err) => reject(err))
      .pipe(stream);

    stream.on("close", () => resolve());
    archive.finalize();
  });
}

async function main() {
  const builds = [
    { dir: "dist/chromium", out: "dist/chromium.zip" },
    { dir: "dist/firefox", out: "dist/firefox.zip" },
  ];

  for (const build of builds) {
    if (fs.existsSync(build.dir)) {
      await zipDir(build.dir, build.out);
      console.log(`Packaged: ${build.out}`);
    }
  }
}

main();
