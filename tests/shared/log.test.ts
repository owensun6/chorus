// Author: be-domain-modeler
import { extractErrorMessage } from '../../src/shared/log';

describe('extractErrorMessage', () => {
  it('returns String(err) for non-Error values', () => {
    expect(extractErrorMessage('plain-string')).toBe('plain-string');
  });
});
