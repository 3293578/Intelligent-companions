const CRISIS_PATTERN = /(?:suicid(?:e|al)|kill\s*(?:myself|me)|self[-\s]?harm|want\s+to\s+die|不想活了|想死|自杀|伤害自己)/iu;
const PERSONAL_NEGATIVE_PATTERN = /(?:\b(?:i\s*(?:am|'m)|i\s+feel|i\s+have\s+been|so\s+tired|exhausted|lonely|sad|anxious|overwhelmed)\b|我(?:今天|真的|好|很)?(?:累|难过|伤心|孤独|焦虑|崩溃)|什么都不想做|只想有人陪)/iu;
const COMPANIONSHIP_PATTERN = /(?:someone\s+to\s+(?:stay|listen)|want\s+company|陪(?:陪我|着我)|有人陪|听我说)/iu;

function emptySignal() {
  return {
    level: 'none',
    reasons: [],
    confidence: 0,
    suppressLearning: false
  };
}

function recentUserMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message?.role === 'user')
    .slice(-4)
    .map((message) => String(message.content || '').trim())
    .filter(Boolean);
}

export function assessSupportSignal(messages = [], options = {}) {
  const userMessages = recentUserMessages(messages);
  const joined = userMessages.join('\n');
  if (!joined) return emptySignal();

  if (CRISIS_PATTERN.test(joined)) {
    return {
      level: 'crisis',
      reasons: ['crisis_language'],
      confidence: 1,
      suppressLearning: true
    };
  }

  const negativeCount = userMessages.filter((content) => PERSONAL_NEGATIVE_PATTERN.test(content)).length;
  const requestsCompany = COMPANIONSHIP_PATTERN.test(joined);
  const emotionNegative = options.emotion?.valence === 'negative';
  if (negativeCount >= 2 || (negativeCount >= 1 && requestsCompany)) {
    return {
      level: 'strong',
      reasons: ['repeated_personal_distress'],
      confidence: negativeCount >= 2 ? 0.86 : 0.78,
      suppressLearning: true
    };
  }

  if (negativeCount >= 1 || emotionNegative) {
    return {
      level: 'light',
      reasons: ['personal_negative_signal'],
      confidence: negativeCount ? 0.62 : 0.5,
      suppressLearning: false
    };
  }

  return emptySignal();
}

export function requestManualSupport() {
  return {
    level: 'manual',
    reasons: ['manual_request'],
    confidence: 1,
    suppressLearning: true
  };
}

export function resolveSupportPresence(signal = emptySignal(), options = {}) {
  if (signal.level === 'crisis') return 'crisis_static';
  if (signal.level === 'strong') return options.reduceMotion ? 'static_companion' : 'half_body';
  if (signal.level === 'manual') return options.reduceMotion ? 'static_companion' : 'avatar_close';
  if (signal.level === 'light') return 'avatar_close';
  return 'none';
}
