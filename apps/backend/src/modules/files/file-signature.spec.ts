import { matchesDeclaredType } from './file-signature';

const pdf = Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF\n');
const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452', 'hex')]);
const jpeg = Buffer.from('ffd8ffe000104a464946', 'hex');
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const exe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1');

describe('matchesDeclaredType', () => {
  it('accepts each supported type with its own signature', () => {
    expect(matchesDeclaredType(pdf, 'application/pdf')).toBe(true);
    expect(matchesDeclaredType(png, 'image/png')).toBe(true);
    expect(matchesDeclaredType(jpeg, 'image/jpeg')).toBe(true);
    expect(matchesDeclaredType(webp, 'image/webp')).toBe(true);
  });

  it('accepts a PDF whose header is preceded by a few bytes', () => {
    expect(matchesDeclaredType(Buffer.concat([Buffer.from('\r\n  '), pdf]), 'application/pdf')).toBe(true);
  });

  it('refuses an executable labelled as any supported type', () => {
    for (const type of ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']) {
      expect(matchesDeclaredType(exe, type)).toBe(false);
    }
  });

  it('refuses one supported type labelled as another', () => {
    expect(matchesDeclaredType(png, 'application/pdf')).toBe(false);
    expect(matchesDeclaredType(pdf, 'image/png')).toBe(false);
    expect(matchesDeclaredType(jpeg, 'image/png')).toBe(false);
  });

  it('refuses empty and truncated content', () => {
    expect(matchesDeclaredType(Buffer.alloc(0), 'application/pdf')).toBe(false);
    expect(matchesDeclaredType(Buffer.from('89504e47', 'hex'), 'image/png')).toBe(false);
  });

  it('refuses a type that is not supported at all', () => {
    expect(matchesDeclaredType(pdf, 'application/x-msdownload')).toBe(false);
  });
});
