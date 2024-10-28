import WebTorrent from "https://esm.sh/webtorrent";

/**
 *
 * @param {string} magnetURI
 * @param {string} filename
 * @return {Promise<string>} text file content
 */
export function download(magnetURI, filename) {
  const client = new WebTorrent();
  return new Promise((resolve, reject) => {
    client.add(magnetURI, async (torrent) => {
      const interval = setInterval(() => {
        console.log("Progress: " + (torrent.progress * 100).toFixed(1) + "%");
      }, 1000);

      torrent.on("done", () => {
        console.log("Progress: 100%");
        clearInterval(interval);
      });

      const selectedFile = torrent.files.find((file) => file.name === filename);
      if (!selectedFile) {
        reject(`File ${filename} not found in torrent`);
      }

      // we know the flie is a text file
      selectedFile
        .blob()
        .then((blob) => blob.text())
        .then(resolve)
        .catch(reject);
    });
  });
}

/**
 *
 * @param {File} file
 * @param {(bytes: number) => void} onUploaded
 * @return {Promise<string>} magnetURI
 */
export function seed(file, onUploaded) {
  const client = new WebTorrent({
    announce: ["udp://tracker.opentrackr.org:1337", "wss://tracker.btorrent.xyz", "wss://tracker.openwebtorrent.com", "wss://tracker.webtorrent.dev"],
  });
  return new Promise((resolve, _reject) => {
    client.seed(file, (torrent) => {
      console.log("Client is seeding:", torrent);

      torrent.on("upload", onUploaded ?? (() => {}));

      torrent.on("wire", (wire) => {
        console.log("wire", wire);
      });

      resolve(torrent.magnetURI);
    });
  });
}
