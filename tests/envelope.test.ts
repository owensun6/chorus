// Author: be-domain-modeler
import {
  createEnvelope,
  parseEnvelope,
  validateEnvelope,
  CHORUS_MEDIA_TYPE,
} from '../src/envelope';
import type { Part } from '../src/envelope';
import type { ChorusEnvelope } from '../src/schemas/envelope';

// ---------------------------------------------------------------------------
// createEnvelope
// ---------------------------------------------------------------------------

describe('createEnvelope', () => {
  it('creates envelope with all fields', () => {
    const envelope = createEnvelope({
      original_semantic: 'Request a meeting',
      sender_culture: 'zh-CN',
      intent_type: 'request',
      formality: 'formal',
      emotional_tone: 'polite',
      relationship_level: 'colleague',
    });

    expect(envelope.chorus_version).toBe('0.1');
    expect(envelope.original_semantic).toBe('Request a meeting');
    expect(envelope.sender_culture).toBe('zh-CN');
    expect(envelope.intent_type).toBe('request');
    expect(envelope.formality).toBe('formal');
    expect(envelope.emotional_tone).toBe('polite');
    expect(envelope.relationship_level).toBe('colleague');
  });

  it('creates envelope with only required fields', () => {
    const envelope = createEnvelope({
      original_semantic: 'Simple greeting',
      sender_culture: 'en',
    });

    expect(envelope.chorus_version).toBe('0.1');
    expect(envelope.original_semantic).toBe('Simple greeting');
    expect(envelope.sender_culture).toBe('en');
    expect(envelope.intent_type).toBeUndefined();
    expect(envelope.formality).toBeUndefined();
    expect(envelope.emotional_tone).toBeUndefined();
    expect(envelope.relationship_level).toBeUndefined();
  });

  it('always sets chorus_version to "0.1"', () => {
    const envelope = createEnvelope({
      original_semantic: 'test',
      sender_culture: 'ja',
    });

    expect(envelope.chorus_version).toBe('0.1');
  });

  it('throws on invalid data (empty original_semantic)', () => {
    expect(() =>
      createEnvelope({
        original_semantic: '',
        sender_culture: 'zh-CN',
      }),
    ).toThrow();
  });

  it('throws on invalid data (bad sender_culture)', () => {
    expect(() =>
      createEnvelope({
        original_semantic: 'test',
        sender_culture: 'INVALID',
      }),
    ).toThrow();
  });

  it('throws on invalid data (bad intent_type)', () => {
    expect(() =>
      createEnvelope({
        original_semantic: 'test',
        sender_culture: 'en',
        intent_type: 'invalid_intent',
      }),
    ).toThrow();
  });

  it('returns a frozen (immutable) object', () => {
    const envelope = createEnvelope({
      original_semantic: 'test',
      sender_culture: 'zh-CN',
    });

    expect(Object.isFrozen(envelope)).toBe(true);
    expect(() => {
      (envelope as Record<string, unknown>)['chorus_version'] = '0.2';
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseEnvelope
// ---------------------------------------------------------------------------

describe('parseEnvelope', () => {
  it('finds Chorus DataPart by mediaType', () => {
    const parts: Part[] = [
      { text: 'Hello', mediaType: 'text/plain' },
      {
        data: {
          chorus_version: '0.1',
          original_semantic: 'Greeting intent',
          sender_culture: 'zh-CN',
          intent_type: 'greeting',
        },
        mediaType: CHORUS_MEDIA_TYPE,
      },
    ];

    const envelope = parseEnvelope(parts);

    expect(envelope).not.toBeNull();
    expect(envelope!.chorus_version).toBe('0.1');
    expect(envelope!.original_semantic).toBe('Greeting intent');
    expect(envelope!.sender_culture).toBe('zh-CN');
    expect(envelope!.intent_type).toBe('greeting');
  });

  it('returns null when no Chorus part is present', () => {
    const parts: Part[] = [
      { text: 'Hello', mediaType: 'text/plain' },
      { data: { some: 'other' }, mediaType: 'application/json' },
    ];

    const result = parseEnvelope(parts);
    expect(result).toBeNull();
  });

  it('returns null for empty parts array', () => {
    const result = parseEnvelope([]);
    expect(result).toBeNull();
  });

  it('returns null when Chorus part has no data field', () => {
    const parts: Part[] = [
      { text: 'just text', mediaType: CHORUS_MEDIA_TYPE },
    ];

    const result = parseEnvelope(parts);
    expect(result).toBeNull();
  });

  it('returns null when Chorus part data is invalid (graceful)', () => {
    const parts: Part[] = [
      {
        data: { chorus_version: '999', sender_culture: 'INVALID' },
        mediaType: CHORUS_MEDIA_TYPE,
      },
    ];

    const result = parseEnvelope(parts);
    expect(result).toBeNull();
  });

  it('returns null when Chorus part data is a non-object', () => {
    const parts: Part[] = [
      {
        data: 'not an object',
        mediaType: CHORUS_MEDIA_TYPE,
      },
    ];

    const result = parseEnvelope(parts);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateEnvelope
// ---------------------------------------------------------------------------

describe('validateEnvelope', () => {
  it('returns success with parsed envelope for valid data', () => {
    const data: ChorusEnvelope = {
      chorus_version: '0.1',
      original_semantic: 'Test semantic',
      sender_culture: 'ja',
    };

    const result = validateEnvelope(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.envelope.chorus_version).toBe('0.1');
      expect(result.envelope.original_semantic).toBe('Test semantic');
    }
  });

  it('returns success with all optional fields', () => {
    const data: ChorusEnvelope = {
      chorus_version: '0.1',
      original_semantic: 'Full envelope',
      sender_culture: 'zh-CN',
      intent_type: 'request',
      formality: 'formal',
      emotional_tone: 'polite',
      relationship_level: 'colleague',
    };

    const result = validateEnvelope(data);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.envelope.intent_type).toBe('request');
    }
  });

  it('returns failure with error messages for invalid data', () => {
    const data = {
      chorus_version: '0.2',
      original_semantic: '',
      sender_culture: 'INVALID',
    };

    const result = validateEnvelope(data);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.every((e) => typeof e === 'string')).toBe(true);
    }
  });

  it('returns failure for completely missing fields', () => {
    const result = validateEnvelope({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('returns failure for non-object input', () => {
    const result = validateEnvelope('not an object');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('returns failure for null input', () => {
    const result = validateEnvelope(null);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
