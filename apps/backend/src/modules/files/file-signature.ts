const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

/**
 * Does the content look like what the upload claims to be? The declared type comes from the client, so
 * checking it alone lets any file through by labelling it a PDF. This looks at the file's own signature
 * (magic bytes) for the few types the platform accepts.
 */
export function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'application/pdf':
      // The header may be preceded by a little junk; the spec allows it within the first KiB.
      return buffer.subarray(0, 1024).includes('%PDF-');
    case 'image/png':
      return buffer.length >= PNG.length && buffer.subarray(0, PNG.length).equals(PNG);
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/webp':
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
        buffer.subarray(8, 12).toString('latin1') === 'WEBP'
      );
    default:
      return false;
  }
}
