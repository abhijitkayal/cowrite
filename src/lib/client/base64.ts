export function uint8ToBase64(update: Uint8Array) {
  let binary = "";
  for (const byte of update) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToUint8(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
