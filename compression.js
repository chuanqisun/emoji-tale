/**
 * @param {string} input
 * @returns {Promise<string>}
 */
export function compressText(input) {
  return compress(new Blob([input], { type: "text/plain" }))
    .then(blobToDataUrl)
    .then(dataUrlToBase64);
}

/**
 * @param {string} input
 * @returns {Promise<string>}
 */
export function decompressText(input) {
  return dataUrlToBlob(`data:text/plain;base64,${input}`)
    .then(decompress)
    .then((blob) => blob.text());
}

/**
 * @param {string} dataUrl
 * @returns {Promise<Blob>}
 */
async function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then((res) => res.blob());
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * @param {string} dataUrl
 * @returns {string}
 */
function dataUrlToBase64(dataUrl) {
  return dataUrl.slice(dataUrl.indexOf("base64,") + 7);
}

/**
 * @param {Blob} blob
 * @returns {Promise<Blob>}
 */
async function compress(blob) {
  const response = await new Response(blob.stream().pipeThrough(new CompressionStream("deflate")));
  return response.blob();
}

/**
 * @template {Blob} T
 * @param {T} blob
 * @returns {Promise<T>}
 */
async function decompress(blob) {
  const response = await new Response(blob.stream().pipeThrough(new DecompressionStream("deflate")));
  return response.blob();
}
