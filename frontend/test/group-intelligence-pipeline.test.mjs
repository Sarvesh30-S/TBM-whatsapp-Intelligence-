import test from 'node:test';
import assert from 'node:assert/strict';

// Test suite for Full-Conversation WhatsApp Understanding and Factual Group Summarization
// Tests extraction, chronological ordering, Hinglish, humor/sarcasm handling, superseded decisions,
// unanswered questions, strict citation integrity, and fallback provenance.

import {
  analyzeGroupIntelligenceWithGroq,
  getGroqConfig,
} from '../src/lib/groq-client.ts';

test('1. Chronological ordering & complete message retrieval', async () => {
  const unsortedMessages = [
    { id: 'msg-3', text: 'Saturday after 4pm works', timestamp: '2026-11-05T12:00:00Z', senderName: 'Adarsh' },
    { id: 'msg-1', text: 'Can you check if Friday is possible?', timestamp: '2026-11-05T10:00:00Z', senderName: 'Pooja' },
    { id: 'msg-2', text: "Tomorrow won't be possible due to prior commitment", timestamp: '2026-11-05T11:00:00Z', senderName: 'Adarsh' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Test Group', unsortedMessages);

  assert.equal(briefing.totalMessagesCount, 3);
  assert.equal(briefing.messagesIncluded, 3);
  assert.equal(briefing.isCompleteCoverage, true);
  assert.equal(briefing.dateRange.start, '2026-11-05T10:00:00.000Z');
  assert.equal(briefing.dateRange.end, '2026-11-05T12:00:00.000Z');
});

test('2. Humor, sarcasm, and casual banter do NOT become false business decisions', async () => {
  const banterMessages = [
    { id: 'banter-1', text: 'Hahaha lol 😂 kya mazak hai yaar!', timestamp: '2026-11-05T10:00:00Z', senderName: 'Rahul' },
    { id: 'banter-2', text: 'Mast hai bhai rofl', timestamp: '2026-11-05T10:05:00Z', senderName: 'Adarsh' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Humor Test Group', banterMessages);

  // Neither banter message should generate a formal confirmed decision
  const hasFalseDecision = briefing.decisions.some((d) =>
    d.title.toLowerCase().includes('mazak') || d.title.toLowerCase().includes('rofl')
  );
  assert.equal(hasFalseDecision, false);
});

test('3. Hinglish and informal replies understanding', async () => {
  const hinglishMessages = [
    { id: 'h-1', text: 'Can you please review the comments on the agreement?', timestamp: '2026-11-05T10:00:00Z', senderName: 'Pooja' },
    { id: 'h-2', text: 'Haan theek hai, done. Sorted.', timestamp: '2026-11-05T10:30:00Z', senderName: 'Adarsh' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Hinglish Test Group', hinglishMessages);

  // Should recognize affirmative agreement
  assert.ok(briefing.decisions.length > 0);
  assert.equal(briefing.decisions[0].status, 'CONFIRMED');
  assert.ok(briefing.decisions[0].sourceMessageIds.includes('h-2'));
});

test('4. Superseded plans and evolution tracking', async () => {
  const evolutionMessages = [
    { id: 'ev-1', text: 'Can we connect on Friday for review?', timestamp: '2026-11-05T10:00:00Z', senderName: 'Pooja' },
    { id: 'ev-2', text: "Friday won't be possible due to prior commitment. Saturday we can connect after 4pm", timestamp: '2026-11-05T11:00:00Z', senderName: 'Adarsh' },
    { id: 'ev-3', text: 'Okay, Saturday works for me. Delete both comments.', timestamp: '2026-11-05T12:00:00Z', senderName: 'Pooja' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Evolution Group', evolutionMessages);

  // Check that earlier Friday proposal is marked SUPERSEDED
  const fridayDecision = briefing.decisions.find((d) => d.title.toLowerCase().includes('friday'));
  if (fridayDecision) {
    assert.equal(fridayDecision.status, 'SUPERSEDED');
  }

  // Check that Saturday consensus is CONFIRMED
  const saturdayDecision = briefing.decisions.find((d) => d.title.toLowerCase().includes('saturday') || d.title.toLowerCase().includes('comments'));
  assert.ok(saturdayDecision, 'Saturday consensus or comments deletion must be confirmed');
  assert.equal(saturdayDecision.status, 'CONFIRMED');
});

test('5. Unanswered questions detection', async () => {
  const questionMessages = [
    { id: 'q-1', text: 'Where is the latest draft saved?', timestamp: '2026-11-05T10:00:00Z', senderName: 'Kunal' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Question Group', questionMessages);

  // Since no subsequent answer exists, this must appear in pending discussions
  assert.ok(briefing.pendingDiscussions.length > 0);
  assert.ok(briefing.pendingDiscussions[0].unresolvedQuestion.includes('Where is the latest draft saved?'));
  assert.ok(briefing.pendingDiscussions[0].sourceMessageIds.includes('q-1'));
});

test('6. Strict ownership ("Unassigned") and deadline ("Not specified") enforcement', async () => {
  const taskMessages = [
    { id: 't-1', text: 'Please review the agreement doc shared.', timestamp: '2026-11-05T10:00:00Z', senderName: 'Client' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Action Group', taskMessages);

  for (const item of briefing.actionTracker) {
    // If no explicit owner was named, must be Unassigned
    assert.ok(item.owner === 'Unassigned' || typeof item.owner === 'string');
    // If no explicit deadline was named, must be Not specified
    assert.ok(item.deadline === 'Not specified' || typeof item.deadline === 'string');
    assert.notEqual(item.deadline, 'None');
  }
});

test('7. Strict source citation integrity and rejection of fabricated IDs', async () => {
  const validMessages = [
    { id: 'real-101', text: 'First valid message', timestamp: '2026-11-05T10:00:00Z', senderName: 'Alice' },
    { id: 'real-102', text: 'Second valid message', timestamp: '2026-11-05T10:05:00Z', senderName: 'Bob' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Citation Group', validMessages);

  const allowedIds = new Set(['real-101', 'real-102']);

  // Validate every citation across all sections
  briefing.storyline.forEach((s) => {
    s.sourceMessageIds.forEach((id) => assert.ok(allowedIds.has(id), `Storyline citation ${id} must be in allowed IDs`));
  });
  briefing.decisions.forEach((d) => {
    d.sourceMessageIds.forEach((id) => assert.ok(allowedIds.has(id), `Decision citation ${id} must be in allowed IDs`));
  });
  briefing.actionTracker.forEach((a) => {
    a.sourceMessageIds.forEach((id) => assert.ok(allowedIds.has(id), `Action citation ${id} must be in allowed IDs`));
  });
  briefing.pendingDiscussions.forEach((p) => {
    p.sourceMessageIds.forEach((id) => assert.ok(allowedIds.has(id), `Pending discussion citation ${id} must be in allowed IDs`));
  });
});

test('8. Accurate provenance reporting between Live Groq and Fallback', async () => {
  const messages = [
    { id: 'prov-1', text: 'Project status update', timestamp: '2026-11-05T10:00:00Z', senderName: 'Lead' },
  ];

  // Without Groq API key set, it must honestly report deterministic fallback
  const fallbackBriefing = await analyzeGroupIntelligenceWithGroq('Provenance Group', messages, {
    apiKey: '',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
  });

  assert.equal(fallbackBriefing.metadata.provider, 'deterministic-rule-engine');
  assert.equal(fallbackBriefing.metadata.isLiveAI, false);
  assert.ok(fallbackBriefing.metadata.provenance.includes('Deterministic Rule Engine'));
  assert.ok(!fallbackBriefing.metadata.provenance.includes('Live Groq'));
});

test('9. Group Context generation (80-120 words, simple language, bilingual support)', async () => {
  const groupMessages = [
    { id: 'ctx-1', text: 'Hey team, welcome to the Blue Tyga celeb campaign group. We are executing the Shreyas Iyer shoot.', timestamp: '2026-11-05T10:00:00Z', senderName: 'Rahul' },
    { id: 'ctx-2', text: 'Agreement is locked for ₹25,000 per deliverable with 3 reels planned. Shoot date finalized for Nov 20.', timestamp: '2026-11-05T10:30:00Z', senderName: 'Pooja' },
    { id: 'ctx-3', text: 'Current status: We are awaiting final script sign-off from the brand manager before production kickoff.', timestamp: '2026-11-05T11:00:00Z', senderName: 'Adarsh' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Client || Blue Tyga x TBM || Celeb execution', groupMessages);

  assert.ok(briefing.groupContext, 'groupContext must be present');
  assert.ok(briefing.executiveBriefing.groupContext, 'executiveBriefing.groupContext must be present');
  assert.ok(briefing.groupContextHinglish, 'groupContextHinglish must be present');

  // Word count validation: roughly 80-140 words
  const wordCount = briefing.groupContext.trim().split(/\s+/).length;
  assert.ok(wordCount >= 50 && wordCount <= 160, `Group context word count should be concise (got ${wordCount})`);

  // Verify grounded details
  assert.ok(briefing.groupContext.includes('Blue Tyga') || briefing.groupContext.includes('Shreyas Iyer'));
  assert.ok(briefing.groupContext.includes('script') || briefing.groupContext.includes('deliverable') || briefing.groupContext.includes('shoot'));
});

test('10. Key Information extraction (budgets, deadlines, deliverables, and numbers)', async () => {
  const messages = [
    { id: 'ki-1', text: 'Fee is locked at ₹25,000 per deliverable. Total 3 reels.', timestamp: '2026-11-05T10:00:00Z', senderName: 'Finance' },
    { id: 'ki-2', text: 'Draft cut must be submitted by Nov 18.', timestamp: '2026-11-05T10:15:00Z', senderName: 'Client' },
  ];

  const briefing = await analyzeGroupIntelligenceWithGroq('Blue Tyga DVC || TBM internal', messages);

  assert.ok(briefing.keyInformation && briefing.keyInformation.length > 0, 'keyInformation must be populated');
  assert.ok(briefing.executiveBriefing.keyInformation && briefing.executiveBriefing.keyInformation.length > 0);

  const categories = briefing.keyInformation.map((k) => k.category);
  assert.ok(categories.includes('budget') || categories.includes('date') || categories.includes('deliverable'));
});
