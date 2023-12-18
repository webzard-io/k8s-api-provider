export function shortenedImage(image: string) {
  return (image || '')
    .replace(/^(index\.)?docker.io\/(library\/)?/, '')
    .replace(/:latest$/, '')
    .replace(/^(.*@sha256:)([0-9a-f]{8})[0-9a-f]+$/i, '$1$2…');
}
